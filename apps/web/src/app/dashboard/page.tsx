'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

const n = (v: unknown) => parseFloat(String(v || 0))

interface DashboardData {
  district: { name: string; enrollment: number; state: string; fiscal_year?: string }
  budget: { deficit: number; total_revenue: number; total_expenditure: number; reserve_pct: number; fiscal_year: string }
  activeScenarios: number
  matchedGrantsCount: number
  matchedGrantsValue: number
  staffSummary: { totalStaff: number; teacherFte: number; counselorFte: number; counselorRatio: number }
}

const DEMO: DashboardData = {
  district: { name: 'San Ramon Valley Unified School District', enrollment: 27805, state: 'CA', fiscal_year: '2025-26' },
  budget: { deficit: 2600000000, total_revenue: 35500000000, total_expenditure: 38100000000, reserve_pct: 3.2, fiscal_year: '2025-26' },
  activeScenarios: 1, matchedGrantsCount: 4, matchedGrantsValue: 481000000,
  staffSummary: { totalStaff: 1800, teacherFte: 1180, counselorFte: 53, counselorRatio: 524 }
}

function fmtM(cents: number) {
  const d = Math.abs(cents) / 100
  if (d >= 1_000_000) return `${cents < 0 ? '-' : ''}$${(d / 1_000_000).toFixed(1)}M`
  if (d >= 1_000) return `${cents < 0 ? '-' : ''}$${(d / 1_000).toFixed(0)}K`
  return `$0`
}

const quickActions = [
  { label: 'Create new budget scenario', desc: 'Model cuts and see student impact', href: '/dashboard/scenarios', color: 'text-indigo-600' },
  { label: 'View matched grants', desc: '$4.8M in available funding', href: '/dashboard/grants', color: 'text-green-600' },
  { label: 'Generate board memo', desc: 'AI-drafted resolution for board meeting', href: '/dashboard/reports', color: 'text-purple-600' },
  { label: 'Analyze staff positions', desc: '1,800 filled positions', href: '/dashboard/staff', color: 'text-amber-600' },
]

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    fetch(`${API_BASE}/api/districts/summary`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then((res: any) => setData(res.data || DEMO))
      .catch(() => setData(DEMO))
      .finally(() => setLoading(false))
  }, [])

  const d = data || DEMO
  const deficit = n(d.budget?.deficit)
  const revenue = n(d.budget?.total_revenue)
  const expenditure = n(d.budget?.total_expenditure)
  const reservePct = n(d.budget?.reserve_pct)
  const grantsValue = n(d.matchedGrantsValue)
  const counselorRatio = Math.round(n(d.staffSummary?.counselorRatio))

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full"/>
    </div>
  )

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{d.district?.name}</h1>
        <p className="text-sm text-gray-500 mt-1">FY {d.budget?.fiscal_year} · {n(d.district?.enrollment).toLocaleString()} students enrolled</p>
      </div>

      {deficit > 0 && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
            <div>
              <p className="text-sm font-semibold text-red-800">Budget deficit of {fmtM(deficit)} requires action</p>
              <p className="text-sm text-red-700 mt-0.5">
                The district has {d.matchedGrantsCount} matched grants worth {fmtM(grantsValue)} that could offset {Math.round((grantsValue / deficit) * 100)}% of the deficit.
              </p>
            </div>
          </div>
          <button onClick={() => router.push('/dashboard/scenarios')}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 flex-shrink-0">
            Model scenarios
          </button>
        </div>
      )}

      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Current deficit</p>
          <p className={`text-2xl font-bold ${deficit > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {deficit > 0 ? '-' : '+'}{fmtM(deficit)}
          </p>
          <p className="text-xs text-gray-400 mt-1">FY {d.budget?.fiscal_year}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Reserve %</p>
          <p className={`text-2xl font-bold ${reservePct < 3 ? 'text-red-600' : reservePct < 5 ? 'text-amber-500' : 'text-gray-900'}`}>
            {reservePct.toFixed(1)}%
          </p>
          <p className="text-xs text-gray-400 mt-1">Min required: 3.0%</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Matched grants</p>
          <p className="text-2xl font-bold text-green-600">{fmtMclean(grantsValue)}</p>
          <p className="text-xs text-gray-400 mt-1">{d.matchedGrantsCount} grants identified</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Counselor ratio</p>
          <p className={`text-2xl font-bold ${counselorRatio > 400 ? 'text-amber-500' : 'text-gray-900'}`}>
            1:{counselorRatio || 0}
          </p>
          <p className="text-xs text-gray-400 mt-1">Recommended: 1:250</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Budget breakdown</h2>
          {[
            { label: 'Total revenue', value: revenue, color: 'bg-green-500', max: expenditure },
            { label: 'Total expenditure', value: expenditure, color: 'bg-red-400', max: expenditure },
            { label: 'Deficit / surplus', value: deficit, color: 'bg-red-300', max: expenditure },
          ].map(item => (
            <div key={item.label} className="mb-3">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>{item.label}</span>
                <span className="font-medium text-gray-900">{fmtM(item.value)}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${item.color}`}
                  style={{ width: `${Math.min(100, (item.value / item.max) * 100)}%` }}/>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Quick actions</h2>
          <div className="space-y-1">
            {quickActions.map((action) => (
              <button key={action.href} onClick={() => router.push(action.href as any)}
                className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors text-left group">
                <div>
                  <p className={`text-sm font-medium ${action.color}`}>{action.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{action.desc}</p>
                </div>
                <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                </svg>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function fmtMclean(cents: number) {
  const d = Math.abs(cents) / 100
  if (d >= 1_000_000) return `$${(d / 1_000_000).toFixed(1)}M`
  if (d >= 1_000) return `$${(d / 1_000).toFixed(0)}K`
  return `$0`
}
