// ============================================================
// ERROR CLASSIFIER
// After each student response, classifies the error type.
// This drives WHAT the tutor teaches next.
//
// Error types:
//   conceptual_gap   — student misunderstands the underlying concept
//   arithmetic_slip  — student understands but made a calculation mistake
//   reading_difficulty — student struggling to parse the question
//   disengagement    — student is not engaging meaningfully
//   correct          — student answered correctly
// ============================================================

import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface ClassificationResult {
  errorType: 'conceptual_gap' | 'arithmetic_slip' | 'reading_difficulty' | 'disengagement' | 'correct' | null
  isCorrect: boolean | null
  confidence: number
}

export async function classifyError(params: {
  studentMessage: string
  tutorResponse: string
  conceptName: string
}): Promise<ClassificationResult> {
  const { studentMessage, tutorResponse, conceptName } = params

  // Skip classification for very short or non-substantive messages
  const trimmed = studentMessage.trim()
  if (trimmed.length < 3 || /^(ok|yes|no|hi|hey|thanks?)$/i.test(trimmed)) {
    return { errorType: 'disengagement', isCorrect: null, confidence: 0.6 }
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', // Use Haiku for speed + cost on classification
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: `Classify this student response in a tutoring session about "${conceptName}".

Student said: "${studentMessage}"
Tutor responded: "${tutorResponse.slice(0, 200)}"

Respond with ONLY a JSON object, no other text:
{
  "errorType": "correct" | "conceptual_gap" | "arithmetic_slip" | "reading_difficulty" | "disengagement",
  "isCorrect": true | false | null,
  "confidence": 0.0-1.0
}

Rules:
- "correct" if the student's answer or reasoning is right
- "conceptual_gap" if they fundamentally misunderstand the concept
- "arithmetic_slip" if they understand but made a calculation error
- "reading_difficulty" if they seem confused by the question wording
- "disengagement" if the response is off-topic, very short, or dismissive
- isCorrect: true if correct, false if wrong, null if unclear`,
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
    const parsed = JSON.parse(text.trim())

    return {
      errorType: parsed.errorType ?? null,
      isCorrect: parsed.isCorrect ?? null,
      confidence: parsed.confidence ?? 0.5,
    }
  } catch {
    // Classification is best-effort — don't fail the session if it errors
    return { errorType: null, isCorrect: null, confidence: 0 }
  }
}
