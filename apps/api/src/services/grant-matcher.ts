// ============================================================
// GRANT MATCHING SERVICE
// Evaluates each district's profile against grant eligibility rules.
// Runs nightly as a scheduled job.
// ============================================================

import { withDb, withTransaction } from '../db'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface DistrictProfile {
  id: string
  name: string
  state: string
  enrollment: number
  highNeedsPct: number
}

// ─── evaluateEligibility ──────────────────────────────────────
// Checks a district against a grant's eligibility rules.
// Rules are stored as JSONB in the federal_grants table.
function evaluateEligibility(
  district: DistrictProfile,
  rules: Record<string, unknown>
): { eligible: boolean; confidence: number; reason: string } {
  const checks: Array<{ pass: boolean; reason: string }> = []

  // State requirement
  if (rules.state && rules.state !== district.state) {
    return {
      eligible: false,
      confidence: 0,
      reason: `Requires state: ${rules.state}`,
    }
  }

  // Minimum high-needs student percentage (Title I)
  if (typeof rules.min_high_needs_pct === 'number') {
    const passes = district.highNeedsPct >= rules.min_high_needs_pct
    checks.push({
      pass: passes,
      reason: `High-needs %: ${district.highNeedsPct.toFixed(1)}% (min: ${rules.min_high_needs_pct}%)`,
    })
  }

  // Minimum enrollment
  if (typeof rules.min_enrollment === 'number') {
    const passes = district.enrollment >= rules.min_enrollment
    checks.push({
      pass: passes,
      reason: `Enrollment: ${district.enrollment} (min: ${rules.min_enrollment})`,
    })
  }

  // Device requirement (E-Rate)
  if (rules.requires_devices) {
    checks.push({ pass: true, reason: 'Device requirement assumed met (Chromebook fleet)' })
  }

  // Special ed students (IDEA)
  if (rules.has_sped_students) {
    checks.push({ pass: true, reason: 'SPED students assumed present' })
  }

  const failedChecks = checks.filter((c) => !c.pass)
  const eligible = failedChecks.length === 0
  const confidence = eligible
    ? Math.min(95, 70 + checks.filter((c) => c.pass).length * 8)
    : 0

  return {
    eligible,
    confidence,
    reason: checks.map((c) => `${c.pass ? '✓' : '✗'} ${c.reason}`).join('; '),
  }
}

// ─── estimateGrantAmount ──────────────────────────────────────
// Calculates personalized grant estimate based on district size and need
function estimateGrantAmount(
  district: DistrictProfile,
  grantCode: string,
  minAmount: number,
  maxAmount: number
): number {
  const scaleFactor = district.enrollment / 10000  // normalized to 10K student district

  switch (grantCode) {
    case 'TITLE_I_A':
      // Title I formula: high-needs % × enrollment × federal rate (~$1,400/high-needs student)
      return Math.round(district.enrollment * (district.highNeedsPct / 100) * 1400 * 100)

    case 'ERATE':
      // E-Rate: estimated 40% discount on $50/student broadband cost
      return Math.round(district.enrollment * 50 * 0.40 * 100)

    case 'IDEA_B':
      // IDEA B: approximately $900/SPED student (assuming 13% SPED rate)
      return Math.round(district.enrollment * 0.13 * 900 * 100)

    case 'CA_COLLEGE_CORPS':
      // College Corps: 1 corps member per 30 students, $10K award value
      return Math.round((district.enrollment / 30) * 10000 * 100)

    case 'TITLE_IV_A':
      // Title IV-A: formula-based, ~$150/student
      return Math.round(district.enrollment * 150 * 100)

    default:
      // Interpolate based on enrollment
      return Math.round(
        minAmount + (maxAmount - minAmount) * Math.min(scaleFactor / 3, 1)
      )
  }
}

// ─── generateApplicationNarrative ────────────────────────────
// Uses Claude to draft a grant application paragraph
async function generateApplicationNarrative(
  district: DistrictProfile,
  grantName: string,
  grantDescription: string,
  estimatedAmount: number
): Promise<string> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 400,
    messages: [
      {
        role: 'user',
        content: `Write a 3-4 sentence grant application statement of need for ${district.name} applying for the ${grantName}.

District facts:
- Enrollment: ${district.enrollment.toLocaleString()} students
- High-needs student %: ${district.highNeedsPct.toFixed(1)}%
- State: ${district.state}
- Estimated award: $${(estimatedAmount / 100).toLocaleString()}

Grant description: ${grantDescription}

Write in first-person plural (we/our district). Be specific, factual, and compelling. No filler phrases.`,
      },
    ],
  })

  return message.content[0].type === 'text' ? message.content[0].text : ''
}

// ─── runGrantMatchingForDistrict ──────────────────────────────
// Main entry point — called nightly for each district
export async function runGrantMatchingForDistrict(districtId: string): Promise<{
  matched: number
  totalEstimatedValue: number
}> {
  // Get district profile
  const district = await withDb(districtId, async (client) => {
    const result = await client.query(
      `SELECT id, name, state, enrollment, high_needs_pct FROM districts WHERE id = $1`,
      [districtId]
    )
    return result.rows[0] as DistrictProfile
  })

  if (!district) throw new Error(`District ${districtId} not found`)

  // Get all active grants
  const grants = await withDb(districtId, async (client) => {
    const result = await client.query(
      `SELECT * FROM federal_grants WHERE is_active = true`
    )
    return result.rows
  })

  let matchedCount = 0
  let totalValue = 0

  for (const grant of grants) {
    const { eligible, confidence, reason } = evaluateEligibility(
      district,
      grant.eligibility_rules
    )

    if (!eligible) continue

    const estimatedAmount = estimateGrantAmount(
      district,
      grant.program_code,
      grant.typical_amount_min || 0,
      grant.typical_amount_max || 0
    )

    // Generate narrative (only for top grants to save API calls)
    let narrative: string | null = null
    if (confidence >= 80) {
      narrative = await generateApplicationNarrative(
        district,
        grant.name,
        grant.description || '',
        estimatedAmount
      )
    }

    // Upsert matched grant
    await withTransaction(districtId, async (client) => {
      await client.query(
        `INSERT INTO matched_grants 
         (district_id, grant_id, estimated_amount, match_confidence, application_narrative, status)
         VALUES ($1, $2, $3, $4, $5, 'identified')
         ON CONFLICT (district_id, grant_id) 
         DO UPDATE SET 
           estimated_amount = EXCLUDED.estimated_amount,
           match_confidence = EXCLUDED.match_confidence,
           application_narrative = COALESCE(EXCLUDED.application_narrative, matched_grants.application_narrative),
           matched_at = NOW()`,
        [districtId, grant.id, estimatedAmount, confidence, narrative]
      )
    })

    matchedCount++
    totalValue += estimatedAmount
  }

  return { matched: matchedCount, totalEstimatedValue: totalValue }
}
