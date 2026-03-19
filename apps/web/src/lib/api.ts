// ============================================================
// API CLIENT
// Typed wrapper around fetch — used by all frontend components.
// Automatically attaches JWT, handles errors uniformly.
// ============================================================

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('auth_token')
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken()

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(error.error || `HTTP ${res.status}`)
  }

  return res.json()
}

// ─── Auth ────────────────────────────────────────────────────
export const authApi = {
  loginWithGoogle: (idToken: string, districtId: string) =>
    apiFetch<{ token: string; user: unknown }>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken, districtId }),
    }),
}

// ─── Dashboard ───────────────────────────────────────────────
export const dashboardApi = {
  getSummary: () =>
    apiFetch<{ data: unknown }>('/api/districts/dashboard'),
  getStaff: () =>
    apiFetch<{ data: unknown[] }>('/api/districts/staff'),
}

// ─── Scenarios ───────────────────────────────────────────────
export const scenariosApi = {
  list: () =>
    apiFetch<{ data: unknown[] }>('/api/scenarios'),

  create: (payload: {
    name: string
    description?: string
    fiscalYear: string
    inputs: {
      staffReductions: number
      classSizeIncrease: number
      programCutPct: number
      siteBudgetCutPct: number
      salaryFreeze: boolean
    }
  }) =>
    apiFetch<{ data: unknown }>('/api/scenarios', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  generateMemo: (scenarioId: string) =>
    apiFetch<{ data: { memo: string } }>(`/api/scenarios/${scenarioId}/generate-memo`, {
      method: 'POST',
    }),
}

// ─── Grants ──────────────────────────────────────────────────
export const grantsApi = {
  list: () =>
    apiFetch<{ data: unknown[]; meta: { totalValue: number; count: number } }>('/api/grants'),

  refresh: () =>
    apiFetch<{ data: { matched: number; totalEstimatedValue: number } }>('/api/grants/refresh', {
      method: 'POST',
    }),

  updateStatus: (id: string, status: string) =>
    apiFetch<{ data: unknown }>(`/api/grants/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
}
