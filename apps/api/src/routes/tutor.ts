import { Router, Request, Response } from 'express'
import { withDb, withTransaction } from '../db'
import {
  startSession,
  sendMessage,
  endSession,
} from '../services/tutor/session-orchestrator'
import { getNextConcept, getMasteryProfile } from '../services/tutor/mastery-engine'
import { runNightlyScoring, generateWeeklyReports } from '../services/tutor/risk-scorer'
import { authenticateToken } from '../auth'
import { z } from 'zod'

const router = Router()

// ─── POST /tutor/sessions/start ───────────────────────────────
// Student starts a tutoring session
router.post('/sessions/start', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const { studentId, subject } = req.body
  const districtId = req.districtId!

  // Get student info
  const student = await withDb(districtId, async (client) => {
    const result = await client.query(
      `SELECT id, display_name, grade_level, language_pref FROM students WHERE id = $1`,
      [studentId]
    )
    return result.rows[0]
  })

  if (!student) { res.status(404).json({ error: 'Student not found' }); return }

  // Find the best concept to practice
  const nextConcept = await getNextConcept(districtId, studentId, subject, student.grade_level)
  if (!nextConcept) { res.status(200).json({ message: 'All concepts mastered!' }); return }

  // Create session record in DB
  const session = await withTransaction(districtId, async (client) => {
    const result = await client.query(
      `INSERT INTO tutor_sessions (district_id, student_id, subject, current_concept_id)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [districtId, studentId, subject, nextConcept.conceptId]
    )
    return result.rows[0]
  })

  // Start orchestrator session
  const { tutorMessage } = await startSession({
    sessionId: session.id,
    studentId,
    districtId,
    gradeLevel: student.grade_level,
    subject,
    conceptId: nextConcept.conceptId,
    conceptName: nextConcept.conceptName,
    conceptCode: nextConcept.code,
    languagePref: student.language_pref,
  })

  res.json({
    data: {
      sessionId: session.id,
      tutorMessage,
      concept: nextConcept,
    },
  })
})

// ─── POST /tutor/sessions/:id/message — streaming response ────
// Student sends a message — response streams back token by token
router.post('/sessions/:id/message', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const { id: sessionId } = req.params
  const { studentMessage, studentId, responseTimeSecs = 0 } = req.body
  const districtId = req.districtId!

  // Validate session belongs to district
  const session = await withDb(districtId, async (client) => {
    const result = await client.query(
      `SELECT ts.id, ts.subject, ts.current_concept_id,
              cn.name as concept_name, cn.code as concept_code,
              s.grade_level, s.language_pref
       FROM tutor_sessions ts
       JOIN students s ON s.id = ts.student_id
       JOIN concept_nodes cn ON cn.id = ts.current_concept_id
       WHERE ts.id = $1 AND ts.district_id = $2`,
      [sessionId, districtId]
    )
    return result.rows[0]
  })

  if (!session) { res.status(404).json({ error: 'Session not found' }); return }

  // Set up SSE streaming
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  try {
    const generator = sendMessage(
      {
        sessionId,
        studentId,
        districtId,
        gradeLevel: session.grade_level,
        subject: session.subject,
        conceptId: session.current_concept_id,
        conceptName: session.concept_name,
        conceptCode: session.concept_code,
        languagePref: session.language_pref,
      },
      studentMessage,
      responseTimeSecs
    )

    for await (const token of generator) {
      res.write(`data: ${JSON.stringify({ token })}\n\n`)
    }

    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: 'Session error' })}\n\n`)
    res.end()
  }
})

// ─── POST /tutor/sessions/:id/end ─────────────────────────────
router.post('/sessions/:id/end', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const { id: sessionId } = req.params
  const districtId = req.districtId!
  await endSession(sessionId, districtId)
  res.json({ data: { sessionId, status: 'ended' } })
})

// ─── GET /tutor/students/:id/mastery ──────────────────────────
// Get full mastery profile for a student (teacher dashboard)
router.get('/students/:id/mastery', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const { id: studentId } = req.params
  const districtId = req.districtId!
  const profile = await getMasteryProfile(districtId, studentId)
  res.json({ data: profile })
})

// ─── GET /tutor/teacher/at-risk ───────────────────────────────
// Today's at-risk students for the authenticated teacher
router.get('/teacher/at-risk', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const districtId = req.districtId!
  const teacherId = req.user!.id

  const atRisk = await withDb(districtId, async (client) => {
    const result = await client.query(
      `SELECT s.id, s.display_name, s.grade_level,
              srs.overall_risk, srs.academic_regression,
              srs.behavioral_disengagement, srs.persistent_blockage,
              srs.alert_reason, srs.is_dismissed,
              cn.name as blocking_concept
       FROM student_risk_scores srs
       JOIN students s ON s.id = srs.student_id
       LEFT JOIN concept_nodes cn ON cn.id = srs.blocking_concept_id
       WHERE srs.district_id = $1
         AND s.teacher_id = $2
         AND srs.scored_at = CURRENT_DATE
         AND srs.overall_risk >= 40
         AND srs.is_dismissed = FALSE
       ORDER BY srs.overall_risk DESC`,
      [districtId, teacherId]
    )
    return result.rows
  })

  res.json({ data: atRisk })
})

// ─── GET /tutor/teacher/class-mastery ────────────────────────
// Mastery heatmap data for teacher's whole class
router.get('/teacher/class-mastery', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const districtId = req.districtId!
  const teacherId = req.user!.id

  const mastery = await withDb(districtId, async (client) => {
    const result = await client.query(
      `SELECT s.id as student_id, s.display_name,
              cn.id as concept_id, cn.name as concept_name, cn.code,
              COALESCE(sm.mastery_score, 0) as mastery_score
       FROM students s
       CROSS JOIN concept_nodes cn
       LEFT JOIN student_mastery sm ON sm.student_id = s.id AND sm.concept_id = cn.id
       WHERE s.teacher_id = $1 AND s.district_id = $2
         AND cn.subject = 'math' AND cn.grade_band IN ('3-5', '6-8')
       ORDER BY s.display_name, cn.difficulty`,
      [teacherId, districtId]
    )
    return result.rows
  })

  res.json({ data: mastery })
})

// ─── GET /tutor/teacher/weekly-reports ───────────────────────
// Weekly AI-generated student summaries for teacher
router.get('/teacher/weekly-reports', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const districtId = req.districtId!
  const teacherId = req.user!.id

  const reports = await withDb(districtId, async (client) => {
    const result = await client.query(
      `SELECT wr.*, s.display_name, s.grade_level
       FROM weekly_reports wr
       JOIN students s ON s.id = wr.student_id
       WHERE wr.district_id = $1 AND s.teacher_id = $2
         AND wr.week_ending >= CURRENT_DATE - INTERVAL '7 days'
       ORDER BY s.display_name`,
      [districtId, teacherId]
    )
    return result.rows
  })

  res.json({ data: reports })
})

// ─── POST /tutor/admin/run-scoring ───────────────────────────
// Trigger nightly scoring manually (for testing / admin)
router.post('/admin/run-scoring', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const districtId = req.districtId!
  const result = await runNightlyScoring(districtId)
  res.json({ data: result })
})

// ─── POST /tutor/admin/generate-reports ──────────────────────
// Trigger weekly report generation manually
router.post('/admin/generate-reports', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const districtId = req.districtId!
  await generateWeeklyReports(districtId)
  res.json({ data: { message: 'Weekly reports generated' } })
})

export { router as tutorRouter }
