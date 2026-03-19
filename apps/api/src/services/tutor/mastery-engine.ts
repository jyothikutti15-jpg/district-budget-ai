// ============================================================
// MASTERY ENGINE
// Updates a student's mastery score for a concept after each
// tutoring exchange using a Bayesian Knowledge Tracing (BKT)
// inspired approach.
//
// Core idea: mastery score reflects probability of knowing the
// concept. Correct answers raise it; wrong answers lower it.
// The update weight decays as attempts accumulate (more
// evidence = less change per new data point).
// ============================================================

import { withTransaction, withDb } from '../../db'

// BKT-inspired parameters
const LEARN_RATE  = 0.20  // how much a correct answer raises mastery
const FORGET_RATE = 0.05  // how much a wrong answer lowers mastery
const SLIP_RATE   = 0.10  // probability of slipping even if mastered
const GUESS_RATE  = 0.25  // probability of correct guess without mastery

interface MasteryUpdate {
  districtId: string
  studentId: string
  conceptId: string
  isCorrect: boolean
}

// ─── updateMastery ────────────────────────────────────────────
// Core BKT update — runs after every student answer
export async function updateMastery(params: MasteryUpdate): Promise<void> {
  const { districtId, studentId, conceptId, isCorrect } = params

  await withTransaction(districtId, async (client) => {
    // Get or create mastery record
    const existing = await client.query(
      `SELECT mastery_score, attempts, correct FROM student_mastery
       WHERE student_id = $1 AND concept_id = $2`,
      [studentId, conceptId]
    )

    let currentScore = 0.0
    let attempts = 0
    let correctCount = 0

    if (existing.rows.length > 0) {
      currentScore = parseFloat(existing.rows[0].mastery_score)
      attempts = existing.rows[0].attempts
      correctCount = existing.rows[0].correct
    }

    // Bayesian update
    const newScore = computeBKTUpdate(currentScore, isCorrect, attempts)

    if (existing.rows.length === 0) {
      await client.query(
        `INSERT INTO student_mastery
         (district_id, student_id, concept_id, mastery_score, attempts, correct, last_practiced)
         VALUES ($1, $2, $3, $4, 1, $5, NOW())`,
        [districtId, studentId, conceptId, newScore, isCorrect ? 1 : 0]
      )
    } else {
      await client.query(
        `UPDATE student_mastery
         SET mastery_score = $1,
             attempts = attempts + 1,
             correct = correct + $2,
             last_practiced = NOW(),
             updated_at = NOW()
         WHERE student_id = $3 AND concept_id = $4`,
        [newScore, isCorrect ? 1 : 0, studentId, conceptId]
      )
    }
  })
}

// ─── computeBKTUpdate ─────────────────────────────────────────
// Pure function — testable without DB
export function computeBKTUpdate(
  currentScore: number,
  isCorrect: boolean,
  attempts: number
): number {
  // P(correct | mastery) = 1 - SLIP_RATE
  // P(correct | no mastery) = GUESS_RATE

  // Update via Bayes rule
  let posterior: number
  if (isCorrect) {
    const pCorrectGivenMastery   = 1 - SLIP_RATE
    const pCorrectGivenNoMastery = GUESS_RATE
    const pCorrect = currentScore * pCorrectGivenMastery +
                     (1 - currentScore) * pCorrectGivenNoMastery
    posterior = (currentScore * pCorrectGivenMastery) / pCorrect
  } else {
    const pWrongGivenMastery   = SLIP_RATE
    const pWrongGivenNoMastery = 1 - GUESS_RATE
    const pWrong = currentScore * pWrongGivenMastery +
                   (1 - currentScore) * pWrongGivenNoMastery
    posterior = (currentScore * pWrongGivenMastery) / pWrong
  }

  // Apply learning opportunity (posterior → updated mastery)
  const updated = posterior + (1 - posterior) * LEARN_RATE
  // Clamp to [0.01, 0.99]
  return Math.max(0.01, Math.min(0.99, Math.round(updated * 1000) / 1000))
}

// ─── getNextConcept ───────────────────────────────────────────
// Given a student's mastery profile, returns the best concept
// to practice next: lowest mastery among unlocked prerequisites.
export async function getNextConcept(
  districtId: string,
  studentId: string,
  subject: string,
  gradeLevel: number
): Promise<{ conceptId: string; conceptName: string; code: string } | null> {
  const gradeBand =
    gradeLevel <= 2 ? 'K-2' :
    gradeLevel <= 5 ? '3-5' :
    gradeLevel <= 8 ? '6-8' : '9-12'

  const result = await withDb(districtId, async (client) => {
    // Find concepts in grade band where all prerequisites are mastered (>0.7)
    // and the concept itself is not yet mastered (<0.8)
    const query = await client.query(
      `SELECT cn.id, cn.name, cn.code, COALESCE(sm.mastery_score, 0) as mastery
       FROM concept_nodes cn
       LEFT JOIN student_mastery sm ON sm.concept_id = cn.id AND sm.student_id = $1
       WHERE cn.subject = $2 AND cn.grade_band = $3
         AND COALESCE(sm.mastery_score, 0) < 0.8
         -- All prerequisites must be mastered
         AND NOT EXISTS (
           SELECT 1 FROM concept_edges ce
           JOIN student_mastery prereq ON prereq.concept_id = ce.prerequisite_id
                                      AND prereq.student_id = $1
           WHERE ce.dependent_id = cn.id
             AND COALESCE(prereq.mastery_score, 0) < 0.7
         )
       ORDER BY COALESCE(sm.mastery_score, 0) ASC, cn.difficulty ASC
       LIMIT 1`,
      [studentId, subject, gradeBand]
    )
    return query.rows[0] ?? null
  })

  if (!result) return null
  return {
    conceptId: result.id,
    conceptName: result.name,
    code: result.code,
  }
}

// ─── getMasteryProfile ────────────────────────────────────────
// Returns full mastery profile for a student — used by teacher dashboard
export async function getMasteryProfile(
  districtId: string,
  studentId: string
) {
  return withDb(districtId, async (client) => {
    const result = await client.query(
      `SELECT cn.id, cn.name, cn.code, cn.subject, cn.grade_band, cn.difficulty,
              COALESCE(sm.mastery_score, 0) as mastery_score,
              sm.attempts, sm.last_practiced
       FROM concept_nodes cn
       LEFT JOIN student_mastery sm ON sm.concept_id = cn.id AND sm.student_id = $1
       ORDER BY cn.subject, cn.grade_band, cn.difficulty`,
      [studentId]
    )
    return result.rows
  })
}
