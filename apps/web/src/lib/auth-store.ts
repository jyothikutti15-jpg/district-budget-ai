// ============================================================
// AUTH STORE — Supabase version
// Manages login state using Supabase session tokens.
// No Google OAuth. No custom JWTs.
// ============================================================

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface AuthState {
  token: string | null
  email: string | null
  districtId: string
  role: string
  setToken: (token: string, email: string) => void
  clearAuth: () => void
  isAuthenticated: () => boolean
}

// Default district ID for SRVUSD — in production set via Supabase user metadata
const DEFAULT_DISTRICT = '00000000-0000-0000-0000-000000000001'

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      email: null,
      districtId: DEFAULT_DISTRICT,
      role: 'superintendent',

      setToken: (token, email) => {
        localStorage.setItem('auth_token', token)
        set({ token, email })
      },

      clearAuth: async () => {
        await supabase.auth.signOut()
        localStorage.removeItem('auth_token')
        set({ token: null, email: null })
      },

      isAuthenticated: () => !!get().token,
    }),
    {
      name: 'auth-store',
      partialize: (state) => ({ token: state.token, email: state.email }),
    }
  )
)
