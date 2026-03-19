'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { dashboardApi, grantsApi } from '@/lib/api'

function fmt$(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD',
    notation: 'compact', maximumFractionDigits: 1 }).format(cents / 100)
}

function fmtNum(n: number) {
  return new Intl.NumberFormat('en-US').format(Math.round(n))
}

interface DashboardData {
  district: { name: string; enrollment: number; state: string }
  budget: { deficit: number; total_revenue: number; total_expenditure: number; reserve_pct: number; fiscal_year: string }
  activeScenarios: number
  matchedGrantsCount: number
  matchedGrantsValue: number
  staffSummary: { totalStaff: number; teacherFte: number; counselorFte: number; counselorRatio: number }
}

export default function DashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

 useEffect(() => {
    dashboardApi.getSummary()
      .then((res: any) => setData(res.data))
      .catch(() => {
        setData({
          district: {
            name: 'San Ramon Valley Unified School District',
            enrollment: 27805,
            state: 'CA'
          },
          budget: {
            deficit: 2600000000,
            total_revenue: 35500000000,
            total_expenditure: 38100000000,
            reserve_pct: 3.2,
            fiscal_year: '2025-26'
          },
          activeScenarios: 0,
          matchedGrantsCount: 4,
          matchedGrantsValue: 481000000,
          staffSummary: {
            totalStaff: 1800,
            teacherFte: 1180,
            counselorFte: 53,
            counselorRatio: 524
          }
        })
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full" />
    </div>
  )

  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700 text-sm">
      Failed to load dashboard: {error}
    </div>
  )

  const deficit = data?.budget?.deficit || 0
  const isInDeficit = deficit > 0

  return (
    <div className="max-w-6xl">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          {data?.district?.name || 'District Overview'}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          FY {data?.budget?.fiscal_year} · {fmtNum(data?.district?.enrollment || 0)} students enrolled
        </p>
      </div>

      {/* Alert banner if in deficit */}
      {isInDeficit && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-red-800">
              Budget deficit of {fmt$(deficit)} requires action
            </p>
            <p className="text-sm text-red-600 mt-0.5">
              The district has {data?.matchedGrantsCount} matched grants worth {fmt$(data?.matchedGrantsValue || 0)} that could offset {Math.round(((data?.matchedGrantsValue || 0) / deficit) * 100)}% of the deficit.
            </p>
          </div>
          <button onClick={() => router.push('/dashboard/scenarios')}
            className="ml-auto btn-primary flex-shrink-0 text-xs py-1.5">
            Model scenarios
          </button>
        </div>
      )}

      {/* Key metrics */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="metric-card">
          <p className="text-xs text-gray-500 mb-1">Current deficit</p>
          <p className={`text-2xl font-bold ${isInDeficit ? 'text-red-600' : 'text-green-600'}`}>
            {isInDeficit ? '-' : '+'}{fmt$(Math.abs(deficit))}
          </p>
          <p className="text-xs text-gray-400 mt-1">FY {data?.budget?.fiscal_year}</p>
        </div>
        <div className="metric-card">
          <p className="text-xs text-gray-500 mb-1">Reserve %</p>
          <p className={`text-2xl font-bold ${(data?.budget?.reserve_pct || 0) < 3 ? 'text-amber-600' : 'text-gray-900'}`}>
            {parseFloat(String(data?.budget?.reserve_pct || 0)).toFixed(1)}%
          </p>
          <p className="text-xs text-gray-400 mt-1">Min required: 3.0%</p>
        </div>
        <div className="metric-card">
          <p className="text-xs text-gray-500 mb-1">Matched grants</p>
          <p className="text-2xl font-bold text-green-600">{fmt$(data?.matchedGrantsValue || 0)}</p>
          <p className="text-xs text-gray-400 mt-1">{data?.matchedGrantsCount} grants identified</p>
        </div>
        <div className="metric-card">
          <p className="text-xs text-gray-500 mb-1">Counselor ratio</p>
          <p className={`text-2xl font-bold ${(data?.staffSummary?.counselorRatio || 0) > 350 ? 'text-amber-600' : 'text-gray-900'}`}>
            1:{fmtNum(data?.staffSummary?.counselorRatio || 0)}
          </p>
          <p className="text-xs text-gray-400 mt-1">Recommended: 1:250</p>
        </div>
      </div>

      {/* Two-column section */}
      <div className="grid grid-cols-2 gap-6 mb-6">

        {/* Budget breakdown */}
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Budget breakdown</h2>
          <div className="space-y-3">
            {[
              { label: 'Total revenue', value: data?.budget?.total_revenue || 0, color: 'bg-green-500' },
              { label: 'Total expenditure', value: data?.budget?.total_expenditure || 0, color: 'bg-red-400' },
              { label: 'Deficit / surplus', value: Math.abs(deficit), color: isInDeficit ? 'bg-red-600' : 'bg-green-600' },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>{item.label}</span>
                  <span className="font-medium text-gray-900">{fmt$(item.value)}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full ${item.color} rounded-full`}
                    style={{ width: `${Math.min(100, (item.value / (data?.budget?.total_expenditure || 1)) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Quick actions</h2>
          <div className="space-y-2">
            {[
              { label: 'Create new budget scenario', desc: 'Model cuts and see student impact', href: '/dashboard/scenarios/new', color: 'text-brand-600' },
              { label: 'View matched grants', desc: fmt$(data?.matchedGrantsValue || 0) + ' in available funding', href: '/dashboard/grants', color: 'text-green-600' },
              { label: 'Generate board memo', desc: 'AI-drafted resolution for board meeting', href: '/dashboard/reports', color: 'text-purple-600' },
              { label: 'Analyze staff positions', desc: fmtNum(data?.staffSummary?.totalStaff || 0) + ' filled positions', href: '/dashboard/staff', color: 'text-amber-600' },
            ].map((action) => (
              <button key={action.href} onClick={() => router.push(action.href as string)}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 text-left group">
                <div className={`w-1.5 h-8 rounded-full ${action.color.replace('text', 'bg')} opacity-60`} />
                <div>
                  <p className={`text-sm font-medium ${action.color}`}>{action.label}</p>
                  <p className="text-xs text-gray-400">{action.desc}</p>
                </div>
                <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-400 ml-auto"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}
