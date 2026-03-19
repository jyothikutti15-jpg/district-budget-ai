'use client'
import { useState } from 'react'

const districts = [
  { name: 'SRVUSD', enrollment: 27805, perPupil: 8685, deficit: 26, reservePct: 3.2, counselorRatio: 524, mathScore: 68, highlight: true },
  { name: 'Pleasanton USD', enrollment: 14200, perPupil: 8984, deficit: 0, reservePct: 8.1, counselorRatio: 380, mathScore: 74, highlight: false },
  { name: 'Fremont USD', enrollment: 32100, perPupil: 9200, deficit: 18, reservePct: 4.2, counselorRatio: 610, mathScore: 61, highlight: false },
  { name: 'Dublin USD', enrollment: 13800, perPupil: 9450, deficit: 0, reservePct: 12.3, counselorRatio: 290, mathScore: 79, highlight: false },
  { name: 'Livermore USD', enrollment: 13200, perPupil: 8800, deficit: 8, reservePct: 5.1, counselorRatio: 445, mathScore: 65, highlight: false },
  { name: 'Novato USD', enrollment: 6100, perPupil: 10200, deficit: 12, reservePct: 2.8, counselorRatio: 520, mathScore: 55, highlight: false },
]

type SortKey = 'enrollment' | 'perPupil' | 'deficit' | 'reservePct' | 'counselorRatio' | 'mathScore'

export default function ComparePage() {
  const [sortBy, setSortBy] = useState<SortKey>('enrollment')

  const sorted = [...districts].sort((a, b) => {
    if (sortBy === 'deficit') return b[sortBy] - a[sortBy]
    return b[sortBy] - a[sortBy]
  })

  function Cell({ value, suffix = '', good = true, threshold = 0 }: {
    value: number; suffix?: string; good?: boolean; threshold?: number
  }) {
    const isWarn = good ? value < threshold : value > threshold
    return (
      <span className={isWarn ? 'text-red-600 font-semibold' : 'text-gray-900'}>
        {suffix === '$' ? `$${value.toLocaleString()}` : `${value.toLocaleString()}${suffix}`}
      </span>
    )
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Peer district comparison</h1>
        <p className="text-sm text-gray-500 mt-1">
          How SRVUSD compares to similar Contra Costa and Alameda County districts
        </p>
      </div>

      {/* SRVUSD position summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-xs font-medium text-red-700 mb-1">Per-pupil funding</p>
          <p className="text-xl font-bold text-red-800">$8,685</p>
          <p className="text-xs text-red-600 mt-1">Lowest among peer districts · $765 below Dublin USD</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-xs font-medium text-red-700 mb-1">Counselor ratio</p>
          <p className="text-xl font-bold text-red-800">1:524</p>
          <p className="text-xs text-red-600 mt-1">2nd worst among peers · ASCA recommends 1:250</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs font-medium text-amber-700 mb-1">Math proficiency</p>
          <p className="text-xl font-bold text-amber-800">68%</p>
          <p className="text-xs text-amber-600 mt-1">Below Pleasanton (74%) and Dublin (79%)</p>
        </div>
      </div>

      {/* Sort controls */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-xs text-gray-500">Sort by:</span>
        {[
          { key: 'perPupil', label: 'Per-pupil $' },
          { key: 'deficit', label: 'Deficit' },
          { key: 'reservePct', label: 'Reserve %' },
          { key: 'counselorRatio', label: 'Counselor ratio' },
          { key: 'mathScore', label: 'Math score' },
        ].map((opt) => (
          <button key={opt.key}
            onClick={() => setSortBy(opt.key as SortKey)}
            className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors
              ${sortBy === opt.key
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
            {opt.label}
          </button>
        ))}
      </div>

      {/* Comparison table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">District</th>
              <th className="text-right py-3 px-4 text-xs font-medium text-gray-500">Enrollment</th>
              <th className="text-right py-3 px-4 text-xs font-medium text-gray-500">Per-pupil $</th>
              <th className="text-right py-3 px-4 text-xs font-medium text-gray-500">Deficit ($M)</th>
              <th className="text-right py-3 px-4 text-xs font-medium text-gray-500">Reserve %</th>
              <th className="text-right py-3 px-4 text-xs font-medium text-gray-500">Counselor ratio</th>
              <th className="text-right py-3 px-4 text-xs font-medium text-gray-500">Math %</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((d) => (
              <tr key={d.name}
                className={`border-b border-gray-100 ${d.highlight ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}>
                <td className="py-3 px-4">
                  <span className={`font-semibold ${d.highlight ? 'text-indigo-700' : 'text-gray-900'}`}>
                    {d.name}
                  </span>
                  {d.highlight && (
                    <span className="ml-2 text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium">You</span>
                  )}
                </td>
                <td className="py-3 px-4 text-right text-gray-900">{d.enrollment.toLocaleString()}</td>
                <td className="py-3 px-4 text-right">
                  <Cell value={d.perPupil} suffix="$" good threshold={9000} />
                </td>
                <td className="py-3 px-4 text-right">
                  <span className={d.deficit > 0 ? 'text-red-600 font-semibold' : 'text-green-600'}>
                    {d.deficit > 0 ? `-$${d.deficit}M` : 'Surplus'}
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  <Cell value={d.reservePct} suffix="%" good threshold={5} />
                </td>
                <td className="py-3 px-4 text-right">
                  <span className={d.counselorRatio > 400 ? 'text-red-600 font-semibold' : 'text-gray-900'}>
                    1:{d.counselorRatio}
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  <Cell value={d.mathScore} suffix="%" good threshold={70} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400 mt-3">
        Data sourced from California Dashboard, CAASPP 2023-24, and district LCFF summaries.
      </p>
    </div>
  )
}
