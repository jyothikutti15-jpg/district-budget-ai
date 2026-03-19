import 'dotenv/config'
import path from 'path'
import dotenv from 'dotenv'
dotenv.config({ path: path.resolve(__dirname, '../../../.env') })

import 'express-async-errors'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { authenticateToken } from './auth'
import { scenarioRouter } from './routes/scenarios'
import { grantsRouter } from './routes/grants'
import { districtRouter } from './routes/districts'
import { tutorRouter } from './routes/tutor'

const app = express()
const PORT = process.env.PORT || 3001

app.use(helmet())
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}))
app.use(express.json({ limit: '1mb' }))

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Protected API routes
app.use('/api/districts', authenticateToken, districtRouter)
app.use('/api/scenarios', authenticateToken, scenarioRouter)
app.use('/api/grants', authenticateToken, grantsRouter)
app.use('/api/tutor', tutorRouter)

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err)
  res.status(500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  })
})

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`)
})

export default app