'use client'
import { useState } from 'react'

const projectionData = [
  { year: '2024-25', enrollment: 27805, revenue: 355, change: 0 },
  { year: '2025-26', enrollment: 27190, revenue: 347, change: -615 },
  { year: '2026-27', enrollment: 26580, revenue: 339, change: -610 },
  { year: '2027-28', enrollment: 25990, revenue: 332, change: -590 },
  { year: '2028-29', enrollment: 25420, revenue: 325, change: -570 },
  { year: '2029-30', enrollment: 24870, revenue: 318, change: -550 },
]

const maxEnrollment = 27805

export default function EnrollmentPage() {
  const [showImpact, setShowImpact] = useState(false)

  const fiveYearLoss = projectionData[0].enrollment - projectionData[5].enrollment
  const revenueImpact = projectionData[0].revenue - projectionData[5].revenue

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Enrollment forecast</h1>
        <p className="text-sm text-gray-500 mt-1">
          5-year projection based on birth rates, housing trends, and historical data
        </p>
      </div>

      {/* Alert banner */}
      <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
        <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
        </svg>
        <div>
          <p className="text-sm font-semibold text-amber-800">
            Enrollment projected to decline 10.6% by 2029-30
          </p>
          <p className="text-sm text-amber-700 mt-0.5">
            SRVUSD will lose ~{fiveYearLoss.toLocaleString()} students over 5 years — equivalent to closing 3-4 schools.
            Revenue impact: -${revenueImpact}M annually.
          </p>
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">Current enrollment</p>
          <p className="text-xl font-bold text-gray-900">27,805</p>
          <p className="text-xs text-gray-400 mt-1">FY 2024-25</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">5-year loss</p>
          <p className="text-xl font-bold text-red-600">-{fiveYearLoss.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">students by 2029-30</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">Revenue impact</p>
          <p className="text-xl font-bold text-red-600">-${revenueImpact}M</p>
          <p className="text-xs text-gray-400 mt-1">annual LCFF reduction</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">Schools at risk</p>
          <p className="text-xl font-bold text-amber-600">3-4</p>
          <p className="text-xs text-gray-400 mt-1">consolidation candidates</p>
        </div>
      </div>

      {/* Enrollment chart */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-6">Enrollment projection 2024–2030</h2>
        <div className="space-y-3">
          {projectionData.map((row, i) => (
            <div key={row.year} className="flex items-center gap-4">
              <div className="w-16 text-xs text-gray-500 flex-shrink-0">{row.year}</div>
              <div className="flex-1 bg-gray-100 rounded-full h-7 overflow-hidden relative">
                <div
                  className={`h-full rounded-full flex items-center px-3 transition-all duration-500 ${i === 0 ? 'bg-indigo-500' : 'bg-indigo-300'}`}
                  style={{ width: `${(row.enrollment / maxEnrollment) * 100}%` }}
                >
                  <span className="text-xs font-medium text-white">{row.enrollment.toLocaleString()}</span>
                </div>
              </div>
              <div className={`w-16 text-xs text-right font-medium flex-shrink-0 ${row.change < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                {row.change < 0 ? row.change.toLocaleString() : '—'}
              </div>
              <div className="w-20 text-xs text-right text-gray-500 flex-shrink-0">
                ${row.revenue}M rev
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Recommendations */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900">AI recommendations</h2>
          <button
            onClick={() => setShowImpact(!showImpact)}
            className="text-xs text-indigo-600 hover:underline"
          >
            {showImpact ? 'Hide details' : 'Show action plan'}
          </button>
        </div>
        <div className="space-y-3">
          {[
            { priority: 'High', action: 'Begin school consolidation planning for 2026-27', detail: 'Identify 2-3 underenrolled elementary schools for consolidation. Each closure saves ~$2.1M annually in facilities and admin costs.' },
            { priority: 'High', action: 'Apply for declining enrollment stabilization funding', detail: 'CA Education Code §42238.02 provides one-time funding for districts with enrollment drops >2% annually. SRVUSD qualifies starting 2025-26.' },
            { priority: 'Medium', action: 'Launch TK expansion to capture 4-year-olds', detail: 'Transitional kindergarten expansion adds ~$8,685/student in LCFF. Could recover 150-200 students annually from neighboring districts.' },
            { priority: 'Medium', action: 'Right-size staffing 18 months ahead of enrollment drops', detail: 'Use attrition (retirements, departures) to reduce headcount without layoffs. Plan 18-24 months ahead to avoid triggering layoff procedures.' },
          ].map((item) => (
            <div key={item.action} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5 ${
                item.priority === 'High' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {item.priority}
              </span>
              <div>
                <p className="text-sm font-medium text-gray-900">{item.action}</p>
                {showImpact && (
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">{item.detail}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
