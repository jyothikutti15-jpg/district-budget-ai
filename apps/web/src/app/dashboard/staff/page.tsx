'use client'
import { useEffect, useState } from 'react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface StaffRow {
  category: string
  position_count: number
  total_fte: number
  avg_salary_usd: number
  total_cost_cents: number
}

const CATEGORY_COLORS: Record<string, string> = {
  teacher:       'bg-indigo-100 text-indigo-800',
  counselor:     'bg-green-100 text-green-800',
  administrator: 'bg-amber-100 text-amber-800',
  classified:    'bg-gray-100 text-gray-700',
  specialist:    'bg-purple-100 text-purple-800',
  aide:          'bg-pink-100 text-pink-800',
}

function fmt$(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1
  }).format(cents / 100)
}

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    fetch(`${API_BASE}/api/districts/staff`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => setStaff(d.data || []))
      .catch(() => {
        // Demo data
        setStaff([
          { category: 'teacher', position_count: 1200, total_fte: 1180, avg_salary_usd: 82000, total_cost_cents: 127920000000 },
          { category: 'administrator', position_count: 95, total_fte: 95, avg_salary_usd: 118000, total_cost_cents: 14796000000 },
          { category: 'counselor', position_count: 53, total_fte: 53, avg_salary_usd: 88000, total_cost_cents: 6168000000 },
          { category: 'specialist', position_count: 180, total_fte: 175, avg_salary_usd: 72000, total_cost_cents: 16380000000 },
          { category: 'classified', position_count: 420, total_fte: 380, avg_salary_usd: 48000, total_cost_cents: 23712000000 },
          { category: 'aide', position_count: 210, total_fte: 185, avg_salary_usd: 36000, total_cost_cents: 8640000000 },
        ])
      })
      .finally(() => setLoading(false))
  }, [])

  const totalCost = staff.reduce((s, r) => s + r.total_cost_cents, 0)
  const totalFte = staff.reduce((s, r) => s + Number(r.total_fte), 0)

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Staff analysis</h1>
        <p className="text-sm text-gray-500 mt-1">
          Breakdown of {Math.round(totalFte).toLocaleString()} filled positions · {fmt$(totalCost)} total annual cost
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full"/>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Category</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-gray-500">Positions</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-gray-500">FTE</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-gray-500">Avg salary</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-gray-500">Total cost</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-gray-500">% of total</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((row) => (
                <tr key={row.category} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${CATEGORY_COLORS[row.category] || 'bg-gray-100 text-gray-700'}`}>
                      {row.category}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-gray-900">{Number(row.position_count).toLocaleString()}</td>
                  <td className="py-3 px-4 text-right text-gray-900">{Number(row.total_fte).toFixed(1)}</td>
                  <td className="py-3 px-4 text-right text-gray-900">${Number(row.avg_salary_usd).toLocaleString()}</td>
                  <td className="py-3 px-4 text-right font-medium text-gray-900">{fmt$(row.total_cost_cents)}</td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full"
                          style={{ width: `${Math.round((row.total_cost_cents / totalCost) * 100)}%` }}/>
                      </div>
                      <span className="text-xs text-gray-500 w-8 text-right">
                        {Math.round((row.total_cost_cents / totalCost) * 100)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t border-gray-200">
              <tr>
                <td className="py-3 px-4 text-xs font-semibold text-gray-700">Total</td>
                <td className="py-3 px-4 text-right text-xs font-semibold text-gray-700">
                  {staff.reduce((s,r) => s + Number(r.position_count), 0).toLocaleString()}
                </td>
                <td className="py-3 px-4 text-right text-xs font-semibold text-gray-700">{totalFte.toFixed(1)}</td>
                <td className="py-3 px-4"></td>
                <td className="py-3 px-4 text-right text-xs font-semibold text-gray-700">{fmt$(totalCost)}</td>
                <td className="py-3 px-4 text-right text-xs text-gray-500">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
