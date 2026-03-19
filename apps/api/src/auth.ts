// ============================================================
// AUTH — Supabase JWT verification
// No Google OAuth needed. Supabase handles email/password login.
// The frontend logs in via Supabase, gets a JWT access token,
// and sends it as Bearer token to our API.
// We verify it here using Supabase's JWKS endpoint.
// ============================================================
import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(__dirname, '../../../.env') })
import { Request, Response, NextFunction } from 'express'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // service role key — server only
)

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string
        email: string
        role: string
        districtId: string
      }
      districtId?: string
    }
  }
}

// ─── authenticateToken ────────────────────────────────────────
// Verifies the Supabase JWT on every protected request.
// Supabase JWTs are self-contained — no DB lookup needed.
export async function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    res.status(401).json({ error: 'No token provided' })
    return
  }

  try {
    // Verify the Supabase access token
    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      res.status(401).json({ error: 'Invalid or expired token' })
      return
    }

    // Get district assignment from user metadata
    // Set this when you create users in Supabase dashboard:
    // Authentication → Users → click user → Edit → Raw user meta data
    // Add: { "district_id": "00000000-0000-0000-0000-000000000001", "role": "superintendent" }
    const districtId = user.user_metadata?.district_id
      || '00000000-0000-0000-0000-000000000001' // default to SRVUSD for dev

    const role = user.user_metadata?.role || 'superintendent'

    req.user = {
      id: user.id,
      email: user.email || '',
      role,
      districtId,
    }
    req.districtId = districtId
    next()
  } catch {
    res.status(401).json({ error: 'Token verification failed' })
  }
}

// ─── requireRole ─────────────────────────────────────────────
export function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) { res.status(401).json({ error: 'Not authenticated' }); return }
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' }); return
    }
    next()
  }
}

// ─── handleGoogleAuth — REMOVED ──────────────────────────────
// We no longer use Google OAuth.
// Login is handled entirely by Supabase on the frontend.
// The /auth/google endpoint is no longer needed.
