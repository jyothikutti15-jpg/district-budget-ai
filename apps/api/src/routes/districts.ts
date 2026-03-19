import { Router, Request, Response } from 'express'
import { withDb } from '../db'

const router = Router()

// GET /api/districts/dashboard — full dashboard summary for current district
router.get('/dashboard', async (req: Request, res: Response): Promise<void> => {
  const districtId = req.districtId!

  const summary = await withDb(districtId, async (client) => {
    const [district, budget, scenarios, grants, staff] = await Promise.all([
      client.query(`SELECT * FROM districts WHERE id = $1`, [districtId]),
      client.query(
        `SELECT * FROM district_budgets WHERE district_id = $1 ORDER BY fiscal_year DESC LIMIT 1`,
        [districtId]
      ),
      client.query(
        `SELECT COUNT(*) as count FROM budget_scenarios WHERE district_id = $1 AND status = 'draft'`,
        [districtId]
      ),
      client.query(
        `SELECT COUNT(*) as count, COALESCE(SUM(estimated_amount), 0) as total_value
         FROM matched_grants WHERE district_id = $1 AND status = 'identified'`,
        [districtId]
      ),
      client.query(
        `SELECT COUNT(*) as total,
                SUM(CASE WHEN category = 'teacher' THEN fte ELSE 0 END) as teacher_fte,
                SUM(CASE WHEN category = 'counselor' THEN fte ELSE 0 END) as counselor_fte
         FROM staff_positions WHERE district_id = $1 AND is_filled = true`,
        [districtId]
      ),
    ])

    const budgetRow = budget.rows[0]
    const staffRow = staff.rows[0]
    const enrollment = district.rows[0]?.enrollment || 0
    const counselorFte = parseFloat(staffRow?.counselor_fte || '0')
    const counselorRatio = counselorFte > 0 ? Math.round(enrollment / counselorFte) : null

    return {
      district: district.rows[0],
      budget: budgetRow,
      activeScenarios: parseInt(scenarios.rows[0]?.count || '0'),
      matchedGrantsCount: parseInt(grants.rows[0]?.count || '0'),
      matchedGrantsValue: parseInt(grants.rows[0]?.total_value || '0'),
      staffSummary: {
        totalStaff: parseFloat(staffRow?.total || '0'),
        teacherFte: parseFloat(staffRow?.teacher_fte || '0'),
        counselorFte,
        counselorRatio,
      },
    }
  })

  res.json({ data: summary })
})

// GET /api/districts/staff — staff positions breakdown
router.get('/staff', async (req: Request, res: Response): Promise<void> => {
  const districtId = req.districtId!

  const staff = await withDb(districtId, async (client) => {
    const result = await client.query(
      `SELECT category,
              COUNT(*) as position_count,
              SUM(fte) as total_fte,
              ROUND(AVG(avg_salary / 100.0)) as avg_salary_usd,
              SUM(total_cost) as total_cost_cents
       FROM staff_positions
       WHERE district_id = $1 AND is_filled = true
       GROUP BY category
       ORDER BY total_cost_cents DESC`,
      [districtId]
    )
    return result.rows
  })

  res.json({ data: staff })
})

export { router as districtRouter }
