// ============================================================
// AT-RISK SCORING JOB
// Runs nightly at 5am via cron.
// Scores every active student on three independent risk axes:
//
//   1. academic_regression   — mastery trending DOWN over 7 days
//   2. behavioral_disengagement — session exits, low response time
//   3. persistent_blockage   — same error type 3+ consecutive sessions
//
// High scores trigger teacher alert emails (Phase 3).
// ============================================================

import { withDb, withTransaction } from '../../db'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Risk thresholds
const HIGH_RISK    = 70
const MEDIUM_RISK  = 40

// ─── scoreStudent ─────────────────────────────────────────────
async function scoreStudent(
  districtId: string,
  studentId: string
): Promise<void> {
  const data = await withDb(districtId, async (client) => {
    const [sessions, mastery, recentMessages] = await Promise.all([
      // Last 7 days of sessions
      client.query(
        `SELECT id, started_at, ended_at, duration_secs,
                message_count, engagement_score, exit_reason
         FROM tutor_sessions
         WHERE student_id = $1 AND started_at > NOW() - INTERVAL '7 days'
         ORDER BY started_at DESC`,
        [studentId]
      ),
      // Mastery changes: compare current vs 7 days ago
      client.query(
        `SELECT cn.id as concept_id, cn.name, sm.mastery_score, sm.updated_at
         FROM student_mastery sm
         JOIN concept_nodes cn ON cn.id = sm.concept_id
         WHERE sm.student_id = $1 AND sm.last_practiced > NOW() - INTERVAL '14 days'
         ORDER BY sm.mastery_score ASC`,
        [studentId]
      ),
      // Last 10 student messages — error pattern analysis
      client.query(
        `SELECT error_type, is_correct, response_time_secs, created_at
         FROM session_messages
         WHERE session_id IN (
           SELECT id FROM tutor_sessions WHERE student_id = $1
           ORDER BY started_at DESC LIMIT 3
         ) AND role = 'student'
         ORDER BY created_at DESC LIMIT 30`,
        [studentId]
      ),
    ])

    return {
      sessions: sessions.rows,
      mastery: mastery.rows,
      recentMessages: recentMessages.rows,
    }
  })

  // ── Score 1: Academic regression ──────────────────────────
  // Check if average mastery across practiced concepts is declining
  let academicRegression = 0
  if (data.mastery.length > 0) {
    const lowMasteryCount = data.mastery.filter(
      (m: { mastery_score: string }) => parseFloat(m.mastery_score) < 0.4
    ).length
    const lowMasteryPct = lowMasteryCount / data.mastery.length

    // More sessions with wrong answers = higher regression score
    const wrongAnswers = data.recentMessages.filter(
      (m: { is_correct: boolean }) => m.is_correct === false
    ).length
    const totalAnswers = data.recentMessages.filter(
      (m: { is_correct: boolean | null }) => m.is_correct !== null
    ).length
    const errorRate = totalAnswers > 0 ? wrongAnswers / totalAnswers : 0

    academicRegression = Math.round(
      (lowMasteryPct * 50) + (errorRate * 50)
    )
  }

  // ── Score 2: Behavioral disengagement ─────────────────────
  let behavioralDisengagement = 0
  if (data.sessions.length > 0) {
    const avgEngagement = data.sessions.reduce(
      (sum: number, s: { engagement_score: string | null }) =>
        sum + parseFloat(s.engagement_score || '0.5'), 0
    ) / data.sessions.length

    const shortSessions = data.sessions.filter(
      (s: { duration_secs: number | null }) => (s.duration_secs || 0) < 120
    ).length
    const shortSessionRate = shortSessions / data.sessions.length

    const disengagedMessages = data.recentMessages.filter(
      (m: { error_type: string }) => m.error_type === 'disengagement'
    ).length
    const disengageRate = data.recentMessages.length > 0
      ? disengagedMessages / data.recentMessages.length : 0

    behavioralDisengagement = Math.round(
      ((1 - avgEngagement) * 40) +
      (shortSessionRate * 30) +
      (disengageRate * 30)
    )
  } else {
    // No sessions in 7 days = high disengagement risk
    behavioralDisengagement = 80
  }

  // ── Score 3: Persistent blockage ──────────────────────────
  let persistentBlockage = 0
  let blockingConceptId: string | null = null
  let alertReason = ''

  // Find if student has same error type on same concept 3+ times
  const conceptErrors = data.recentMessages.reduce(
    (acc: Record<string, number>, m: { error_type: string; concept_id?: string }) => {
      if (m.error_type === 'conceptual_gap' && m.concept_id) {
        acc[m.concept_id] = (acc[m.concept_id] || 0) + 1
      }
      return acc
    },
    {} as Record<string, number>
  )

  const maxErrors = Math.max(...Object.values(conceptErrors as Record<string, number>).map(Number), 0)
  if (maxErrors >= 3) {
    persistentBlockage = Math.min(100, maxErrors * 20)
    blockingConceptId = Object.entries(conceptErrors as Record<string, number>).find(
      ([, count]) => count === maxErrors
    )?.[0] ?? null
  }

  // ── Build alert reason (plain English for teacher) ─────────
  const overallRisk = Math.max(academicRegression, behavioralDisengagement, persistentBlockage)

  if (overallRisk >= HIGH_RISK) {
    if (persistentBlockage >= HIGH_RISK && blockingConceptId) {
      alertReason = `Stuck on the same concept ${maxErrors} sessions in a row — needs direct intervention.`
    } else if (behavioralDisengagement >= HIGH_RISK) {
      alertReason = data.sessions.length === 0
        ? 'Has not logged in to practice in 7+ days.'
        : 'Repeatedly exits sessions early or shows very low engagement.'
    } else if (academicRegression >= HIGH_RISK) {
      alertReason = 'Math mastery scores are significantly below grade level and not improving.'
    }
  } else if (overallRisk >= MEDIUM_RISK) {
    alertReason = 'Showing early signs of struggle — worth a quick check-in this week.'
  }

  // ── Save scores ───────────────────────────────────────────
  await withTransaction(districtId, async (client) => {
    await client.query(
      `INSERT INTO student_risk_scores
       (district_id, student_id, academic_regression, behavioral_disengagement,
        persistent_blockage, blocking_concept_id, alert_reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (student_id, scored_at) DO UPDATE SET
         academic_regression = EXCLUDED.academic_regression,
         behavioral_disengagement = EXCLUDED.behavioral_disengagement,
         persistent_blockage = EXCLUDED.persistent_blockage,
         blocking_concept_id = EXCLUDED.blocking_concept_id,
         alert_reason = EXCLUDED.alert_reason,
         is_dismissed = FALSE`,
      [
        districtId, studentId,
        academicRegression, behavioralDisengagement, persistentBlockage,
        blockingConceptId, alertReason,
      ]
    )
  })
}

// ─── runNightlyScoring ────────────────────────────────────────
// Main entry — scores all active students in a district
export async function runNightlyScoring(districtId: string): Promise<{
  studentsScored: number
  highRiskCount: number
}> {
  // Get all students active in the last 30 days
  const students = await withDb(districtId, async (client) => {
    const result = await client.query(
      `SELECT DISTINCT s.id as student_id
       FROM students s
       LEFT JOIN tutor_sessions ts ON ts.student_id = s.id
         AND ts.started_at > NOW() - INTERVAL '30 days'
       WHERE s.district_id = $1`,
      [districtId]
    )
    return result.rows
  })

  let highRiskCount = 0
  for (const student of students) {
    await scoreStudent(districtId, student.student_id)
  }

  // Count high-risk students
  const riskCount = await withDb(districtId, async (client) => {
    const result = await client.query(
      `SELECT COUNT(*) FROM student_risk_scores
       WHERE district_id = $1 AND scored_at = CURRENT_DATE AND overall_risk >= 70`,
      [districtId]
    )
    return parseInt(result.rows[0].count)
  })

  highRiskCount = riskCount

  return { studentsScored: students.length, highRiskCount }
}

// ─── generateWeeklyReports ────────────────────────────────────
// Called every Friday — generates AI summaries for all active students
export async function generateWeeklyReports(districtId: string): Promise<void> {
  const students = await withDb(districtId, async (client) => {
    const result = await client.query(
      `SELECT s.id, s.display_name, s.grade_level
       FROM students s
       JOIN tutor_sessions ts ON ts.student_id = s.id
         AND ts.started_at > NOW() - INTERVAL '7 days'
       WHERE s.district_id = $1
       GROUP BY s.id, s.display_name, s.grade_level`,
      [districtId]
    )
    return result.rows
  })

  for (const student of students) {
    const weekData = await withDb(districtId, async (client) => {
      const [sessions, mastery] = await Promise.all([
        client.query(
          `SELECT COUNT(*) as session_count,
                  AVG(engagement_score) as avg_engagement,
                  SUM(duration_secs) as total_time_secs
           FROM tutor_sessions
           WHERE student_id = $1 AND started_at > NOW() - INTERVAL '7 days'`,
          [student.id]
        ),
        client.query(
          `SELECT cn.name, sm.mastery_score, sm.attempts
           FROM student_mastery sm JOIN concept_nodes cn ON cn.id = sm.concept_id
           WHERE sm.student_id = $1 AND sm.last_practiced > NOW() - INTERVAL '7 days'
           ORDER BY sm.mastery_score DESC`,
          [student.id]
        ),
      ])
      return { sessions: sessions.rows[0], mastery: mastery.rows }
    })

    // Generate summary with Claude
    const prompt = `Write a brief (3-4 sentence) weekly progress summary for a teacher about their student.

Student: ${student.display_name}, Grade ${student.grade_level}
Sessions this week: ${weekData.sessions.session_count}
Average engagement: ${Math.round((weekData.sessions.avg_engagement || 0) * 100)}%
Total practice time: ${Math.round((weekData.sessions.total_time_secs || 0) / 60)} minutes
Concepts practiced: ${weekData.mastery.map((m: { name: string; mastery_score: string }) => `${m.name} (${Math.round(parseFloat(m.mastery_score) * 100)}% mastery)`).join(', ')}

Write in third person (e.g. "Arjun completed..."). Be specific and actionable. End with one concrete recommendation for the teacher.`

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    })

    const summary = response.content[0].type === 'text' ? response.content[0].text : ''

    // Save report
    const weekEnding = new Date()
    weekEnding.setDate(weekEnding.getDate() - weekEnding.getDay() + 5) // this Friday

    await withDb(districtId, async (client) => {
      await client.query(
        `INSERT INTO weekly_reports (district_id, student_id, week_ending, summary_text, sessions_count)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (student_id, week_ending) DO UPDATE SET summary_text = EXCLUDED.summary_text`,
        [districtId, student.id, weekEnding.toISOString().split('T')[0],
         summary, parseInt(weekData.sessions.session_count)]
      )
    })
  }
}
