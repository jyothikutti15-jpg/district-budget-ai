import { Router, Request, Response } from 'express'
import { withDb } from '../db'
import { runGrantMatchingForDistrict } from '../services/grant-matcher'

const router = Router()

// GET /api/grants — list all matched grants for the district
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const districtId = req.districtId!

  const grants = await withDb(districtId, async (client) => {
    const result = await client.query(
      `SELECT mg.*, fg.name, fg.program_code, fg.funding_source,
              fg.description, fg.application_deadline, fg.application_url,
              fg.typical_amount_min, fg.typical_amount_max
       FROM matched_grants mg
       JOIN federal_grants fg ON fg.id = mg.grant_id
       WHERE mg.district_id = $1
       ORDER BY mg.estimated_amount DESC`,
      [districtId]
    )
    return result.rows
  })

  const totalValue = grants.reduce((sum: number, g: { estimated_amount: number }) =>
    sum + (g.estimated_amount || 0), 0)

  res.json({ data: grants, meta: { totalValue, count: grants.length } })
})

// POST /api/grants/refresh — re-run grant matcher for this district
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  const districtId = req.districtId!
  const result = await runGrantMatchingForDistrict(districtId)
  res.json({ data: result })
})

// PATCH /api/grants/:id/status — update grant application status
router.patch('/:id/status', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params
  const { status } = req.body
  const districtId = req.districtId!

  const validStatuses = ['identified', 'in_progress', 'submitted', 'awarded', 'declined']
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: 'Invalid status' })
    return
  }

  await withDb(districtId, async (client) => {
    await client.query(
      `UPDATE matched_grants SET status = $1 WHERE id = $2 AND district_id = $3`,
      [status, id, districtId]
    )
  })

  res.json({ data: { id, status } })
})

export { router as grantsRouter }
