import { Router, Request, Response } from 'express'
import Anthropic from '@anthropic-ai/sdk'
import { withDb, withTransaction, writeAuditLog } from '../db'
import { authenticateToken, requireRole } from '../auth'
import { computeOutcomes } from '../services/impact-model'
import { z } from 'zod'
import type { BudgetScenario, ScenarioInputs } from '@district-budget/types'

const router = Router()
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ─── Validation schema ───────────────────────────────────────
const ScenarioInputSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  fiscalYear: z.string().regex(/^\d{4}-\d{2}$/),
  inputs: z.object({
    staffReductions: z.number().int().min(0).max(500),
    classSizeIncrease: z.number().min(0).max(10),
    programCutPct: z.number().min(0).max(100),
    siteBudgetCutPct: z.number().min(0).max(30),
    salaryFreeze: z.boolean(),
  }),
})

// ─── GET /scenarios — list all scenarios for district ────────
router.get(
  '/',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    const districtId = req.districtId!
    const scenarios = await withDb(districtId, async (client) => {
      const result = await client.query<BudgetScenario>(
        `SELECT bs.*, u.full_name as creator_name
         FROM budget_scenarios bs
         JOIN users u ON u.id = bs.created_by
         WHERE bs.district_id = $1
         ORDER BY bs.created_at DESC
         LIMIT 50`,
        [districtId]
      )
      return result.rows
    })

    await writeAuditLog({
      districtId,
      userId: req.user!.id,
      action: 'READ',
      tableName: 'budget_scenarios',
    })

    res.json({ data: scenarios })
  }
)

// ─── POST /scenarios — create + compute a new scenario ───────
router.post(
  '/',
  authenticateToken,
  requireRole(['superintendent', 'assistant_superintendent', 'finance_director']),
  async (req: Request, res: Response): Promise<void> => {
    const parsed = ScenarioInputSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.issues })
      return
    }

    const { name, description, fiscalYear, inputs } = parsed.data
    const districtId = req.districtId!

    // 1. Get district context for impact modeling
    const districtData = await withDb(districtId, async (client) => {
      const [districtResult, budgetResult, staffResult] = await Promise.all([
        client.query(`SELECT * FROM districts WHERE id = $1`, [districtId]),
        client.query(
          `SELECT * FROM district_budgets WHERE district_id = $1 AND fiscal_year = $2`,
          [districtId, fiscalYear]
        ),
        client.query(
          `SELECT COUNT(*) as total_staff, 
           SUM(CASE WHEN category = 'counselor' THEN fte ELSE 0 END) as counselor_fte
           FROM staff_positions WHERE district_id = $1 AND is_filled = true`,
          [districtId]
        ),
      ])
      return {
        district: districtResult.rows[0],
        budget: budgetResult.rows[0],
        staff: staffResult.rows[0],
      }
    })

    // 2. Run the Python impact model (via internal service call)
    const outcomes = computeOutcomes(inputs, {
      enrollment: districtData.district.enrollment,
      totalStaff: parseInt(districtData.staff.total_staff),
      counselorFte: parseFloat(districtData.staff.counselor_fte || '0'),
      currentDeficit: districtData.budget?.deficit || 0,
      avgSalaryWithBenefits: 95000_00, // cents — from district data
    })

    // 3. Save scenario to DB
    const scenario = await withTransaction(districtId, async (client) => {
      const result = await client.query<BudgetScenario>(
        `INSERT INTO budget_scenarios (
           district_id, created_by, fiscal_year, name, description,
           staff_reductions, class_size_increase, program_cut_pct,
           site_budget_cut_pct, salary_freeze,
           projected_savings, projected_deficit, projected_reserve_pct,
           math_proficiency_delta, ela_proficiency_delta,
           grad_rate_delta, absenteeism_delta,
           counselor_ratio_new, teacher_workload_delta
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
         RETURNING *`,
        [
          districtId, req.user!.id, fiscalYear, name, description || null,
          inputs.staffReductions, inputs.classSizeIncrease,
          inputs.programCutPct, inputs.siteBudgetCutPct, inputs.salaryFreeze,
          outcomes.projectedSavings, outcomes.projectedDeficit, outcomes.projectedReservePct,
          outcomes.mathProficiencyDelta, outcomes.elaProficiencyDelta,
          outcomes.gradRateDelta, outcomes.absenteeismDelta,
          outcomes.counselorRatioNew, outcomes.teacherWorkloadDelta,
        ]
      )
      return result.rows[0]
    })

    await writeAuditLog({
      districtId,
      userId: req.user!.id,
      action: 'CREATE',
      tableName: 'budget_scenarios',
      recordId: scenario.id,
      newValues: { name, inputs },
    })

    res.status(201).json({ data: scenario })
  }
)

// ─── POST /scenarios/:id/generate-memo — AI board memo ───────
router.post(
  '/:id/generate-memo',
  authenticateToken,
  requireRole(['superintendent', 'assistant_superintendent', 'finance_director']),
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params
    const districtId = req.districtId!

    const scenario = await withDb(districtId, async (client) => {
      const result = await client.query(
        `SELECT bs.*, d.name as district_name, d.enrollment, d.state
         FROM budget_scenarios bs
         JOIN districts d ON d.id = bs.district_id
         WHERE bs.id = $1 AND bs.district_id = $2`,
        [id, districtId]
      )
      return result.rows[0]
    })

    if (!scenario) {
      res.status(404).json({ error: 'Scenario not found' })
      return
    }

    // Generate board memo with AI
    // IMPORTANT: Only non-PII district data is sent — no student records
    const prompt = `You are an expert school district communications director helping a superintendent prepare board meeting materials.

DISTRICT: ${scenario.district_name} (${scenario.state})
FISCAL YEAR: ${scenario.fiscal_year}
SCENARIO NAME: ${scenario.name}

BUDGET SCENARIO DATA:
- Staff reductions: ${scenario.staff_reductions} positions
- Class size increase: +${scenario.class_size_increase} students per class
- Program budget cuts: ${scenario.program_cut_pct}%
- Site budget cuts: ${scenario.site_budget_cut_pct}%
- Projected savings: $${(scenario.projected_savings / 100).toLocaleString()}
- Remaining deficit after cuts: $${Math.max(0, (scenario.projected_deficit || 0) / 100).toLocaleString()}

PROJECTED STUDENT IMPACT:
- Math proficiency: ${scenario.math_proficiency_delta > 0 ? '+' : ''}${scenario.math_proficiency_delta?.toFixed(1)} percentage points
- ELA proficiency: ${scenario.ela_proficiency_delta > 0 ? '+' : ''}${scenario.ela_proficiency_delta?.toFixed(1)} percentage points
- Graduation rate: ${scenario.grad_rate_delta > 0 ? '+' : ''}${scenario.grad_rate_delta?.toFixed(1)} percentage points
- Chronic absenteeism: ${scenario.absenteeism_delta > 0 ? '+' : ''}${scenario.absenteeism_delta?.toFixed(1)} percentage points
- New counselor ratio: 1:${Math.round(scenario.counselor_ratio_new)}

Write a professional board memo with these sections:
1. EXECUTIVE SUMMARY (3-4 sentences, plain language)
2. FISCAL CONTEXT (why cuts are needed — reference LCFF funding constraints)
3. PROPOSED REDUCTIONS (clear list of what is being cut)
4. STUDENT IMPACT ANALYSIS (honest assessment using the data above)
5. MITIGATION STRATEGIES (what the district will do to minimize impact)
6. RECOMMENDATION (clear ask to the board)

Tone: Direct, professional, honest about tradeoffs. Do not soften bad news with vague language. Use exact numbers from the data provided.`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    })

    const memo = message.content[0].type === 'text' ? message.content[0].text : ''

    // Save memo back to scenario
    await withDb(districtId, async (client) => {
      await client.query(
        `UPDATE budget_scenarios SET board_memo_draft = $1, updated_at = NOW() WHERE id = $2`,
        [memo, id]
      )
    })

    await writeAuditLog({
      districtId,
      userId: req.user!.id,
      action: 'UPDATE',
      tableName: 'budget_scenarios',
      recordId: id,
      newValues: { action: 'generate_board_memo' },
    })

    res.json({ data: { memo } })
  }
)

export { router as scenarioRouter }
