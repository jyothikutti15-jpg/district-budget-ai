// ============================================================
// TUTOR SESSION ORCHESTRATOR
// Manages the conversation loop between a student and Claude.
// Key responsibilities:
//   1. Build the system prompt (Socratic persona, grade-appropriate)
//   2. Maintain conversation history in Redis
//   3. Stream Claude responses token-by-token to the client
//   4. Classify student errors after each response
//   5. Update mastery scores after each exchange
// ============================================================

import Anthropic from '@anthropic-ai/sdk'
import { withDb, withTransaction } from '../../db'
import { classifyError } from './error-classifier'
import { updateMastery } from './mastery-engine'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// In-memory session store (use Redis in production)
// Maps sessionId → conversation history
const sessionStore = new Map<string, Anthropic.MessageParam[]>()

interface SessionContext {
  sessionId: string
  studentId: string
  districtId: string
  gradeLevel: number
  subject: 'math' | 'ela' | 'science'
  conceptId: string
  conceptName: string
  conceptCode: string
  languagePref?: string
}

// ─── buildSystemPrompt ────────────────────────────────────────
// The most important function in the tutor — defines exactly
// how Claude behaves with students.
function buildSystemPrompt(ctx: SessionContext): string {
  const gradeDesc =
    ctx.gradeLevel <= 2 ? 'early elementary (K-2)' :
    ctx.gradeLevel <= 5 ? 'upper elementary (3-5)' :
    ctx.gradeLevel <= 8 ? 'middle school (6-8)' : 'high school (9-12)'

  const languageNote = ctx.languagePref !== 'en'
    ? `The student prefers ${ctx.languagePref}. Use simple English but feel free to include key terms in ${ctx.languagePref} when helpful.`
    : ''

  return `You are a patient, encouraging AI math tutor helping a ${gradeDesc} student.

CURRENT FOCUS: ${ctx.conceptName} (${ctx.conceptCode})

YOUR TEACHING APPROACH — follow these rules strictly:
1. NEVER give the answer directly. Always guide the student to find it themselves.
2. Ask one question at a time. Never pile on multiple questions.
3. When a student is wrong, say something like "Good try! Let's think about it differently..." then give a hint, not the answer.
4. When a student is right, celebrate briefly then deepen understanding: "Exactly! Now what do you think would happen if..."
5. If a student is stuck after 2 hints, break the problem into a smaller step.
6. Keep responses SHORT — 2-4 sentences max. You are not lecturing; you are having a conversation.
7. Use concrete examples and real-world context when introducing new ideas.
8. Adjust your vocabulary to be age-appropriate for ${gradeDesc} students.

TONE: Warm, patient, non-judgmental. Like a helpful older sibling, not a strict teacher.

BOUNDARIES:
- Only discuss academic topics related to ${ctx.subject}.
- If asked anything off-topic, kindly redirect: "That's interesting! Let's finish this problem first, then we can chat."
- Never express frustration or impatience.
- Never say "That's wrong." Say "Let's try a different approach."

${languageNote}

Start by briefly introducing today's concept in one friendly sentence, then pose a starter problem.`
}

// ─── startSession ─────────────────────────────────────────────
// Called when a student opens the tutor interface.
// Returns the tutor's opening message.
export async function startSession(ctx: SessionContext): Promise<{
  tutorMessage: string
  sessionId: string
}> {
  const systemPrompt = buildSystemPrompt(ctx)

  // Initialize empty history for this session
  sessionStore.set(ctx.sessionId, [])

  // Get the opening message from Claude
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 200,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `[Session start — student is ready to begin practicing ${ctx.conceptName}]`,
      },
    ],
  })

  const tutorMessage =
    response.content[0].type === 'text' ? response.content[0].text : ''

  // Store the opening exchange
  const history = sessionStore.get(ctx.sessionId)!
  history.push(
    { role: 'user', content: `[Session start — student is ready]` },
    { role: 'assistant', content: tutorMessage }
  )

  // Save opening message to DB
  await withDb(ctx.districtId, async (client) => {
    await client.query(
      `INSERT INTO session_messages (session_id, district_id, role, content, concept_id)
       VALUES ($1, $2, 'tutor', $3, $4)`,
      [ctx.sessionId, ctx.districtId, tutorMessage, ctx.conceptId]
    )
  })

  return { tutorMessage, sessionId: ctx.sessionId }
}

// ─── sendMessage ──────────────────────────────────────────────
// Called for every student message.
// Returns an async generator that streams the tutor's response.
export async function* sendMessage(
  ctx: SessionContext,
  studentMessage: string,
  responseTimeSecs: number
): AsyncGenerator<string> {
  const history = sessionStore.get(ctx.sessionId) || []
  const systemPrompt = buildSystemPrompt(ctx)

  // Add student message to history
  history.push({ role: 'user', content: studentMessage })

  // Stream Claude's response
  let fullResponse = ''

  const stream = anthropic.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    system: systemPrompt,
    messages: history,
  })

  for await (const chunk of stream) {
    if (
      chunk.type === 'content_block_delta' &&
      chunk.delta.type === 'text_delta'
    ) {
      fullResponse += chunk.delta.text
      yield chunk.delta.text
    }
  }

  // Add tutor response to history
  history.push({ role: 'assistant', content: fullResponse })
  sessionStore.set(ctx.sessionId, history)

  // Trim history to last 20 exchanges (keep context window manageable)
  if (history.length > 40) {
    sessionStore.set(ctx.sessionId, history.slice(-40))
  }

  // ── Post-message processing (async, non-blocking) ──────────
  // These run after the stream completes
  setImmediate(async () => {
    try {
      // 1. Classify the error type of the student's message
      const errorClassification = await classifyError({
        studentMessage,
        tutorResponse: fullResponse,
        conceptName: ctx.conceptName,
      })

      // 2. Save both messages to DB
      await withTransaction(ctx.districtId, async (client) => {
        // Student message
        await client.query(
          `INSERT INTO session_messages
           (session_id, district_id, role, content, concept_id,
            error_type, is_correct, response_time_secs)
           VALUES ($1, $2, 'student', $3, $4, $5, $6, $7)`,
          [
            ctx.sessionId, ctx.districtId, studentMessage, ctx.conceptId,
            errorClassification.errorType,
            errorClassification.isCorrect,
            responseTimeSecs,
          ]
        )
        // Tutor message
        await client.query(
          `INSERT INTO session_messages
           (session_id, district_id, role, content, concept_id)
           VALUES ($1, $2, 'tutor', $3, $4)`,
          [ctx.sessionId, ctx.districtId, fullResponse, ctx.conceptId]
        )
        // Increment message count on session
        await client.query(
          `UPDATE tutor_sessions SET message_count = message_count + 2 WHERE id = $1`,
          [ctx.sessionId]
        )
      })

      // 3. Update mastery score (Bayesian update)
      if (errorClassification.isCorrect !== null) {
        await updateMastery({
          districtId: ctx.districtId,
          studentId: ctx.studentId,
          conceptId: ctx.conceptId,
          isCorrect: errorClassification.isCorrect,
        })
      }
    } catch (err) {
      console.error('Post-message processing error:', err)
    }
  })
}

// ─── endSession ───────────────────────────────────────────────
// Called when student closes the session.
// Computes final session metrics.
export async function endSession(
  sessionId: string,
  districtId: string
): Promise<void> {
  sessionStore.delete(sessionId)

  await withDb(districtId, async (client) => {
    await client.query(
      `UPDATE tutor_sessions
       SET ended_at = NOW(),
           duration_secs = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER,
           exit_reason = 'manual_exit',
           engagement_score = (
             SELECT CASE WHEN COUNT(*) = 0 THEN 0
               ELSE ROUND(
                 (COUNT(CASE WHEN error_type = 'correct' THEN 1 END)::DECIMAL
                  / NULLIF(COUNT(CASE WHEN role = 'student' THEN 1 END), 0))::DECIMAL,
                 2
               )
             END
             FROM session_messages WHERE session_id = $1 AND role = 'student'
           )
       WHERE id = $1`,
      [sessionId]
    )
  })
}
