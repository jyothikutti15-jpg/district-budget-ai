'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface Scenario {
  id: string
  name: string
  fiscal_year: string
  staff_reductions: number
  class_size_increase: number
  program_cut_pct: number
  projected_savings: number
  math_proficiency_delta: number
  board_memo_draft: string | null
  created_at: string
  status: string
}

function fmtM(cents: number) {
  const d = Math.abs(Number(cents || 0))
  if (d >= 100_000_000) return `$${(d / 100_000_000).toFixed(1)}M`
  return `$${(d / 100_000).toFixed(0)}K`
}

export default function ReportsPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Scenario | null>(null)
  const router = useRouter()
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null

  useEffect(() => {
    fetch(`${API_BASE}/api/scenarios`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => setScenarios((d.data || []).filter((s: Scenario) => s.board_memo_draft)))
      .catch(() => setScenarios([]))
      .finally(() => setLoading(false))
  }, [token])

  function downloadMemo(scenario: Scenario) {
    if (!scenario.board_memo_draft) return
    const blob = new Blob([scenario.board_memo_draft], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Board_Memo_${scenario.name.replace(/\s+/g, '_')}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  function printMemo(scenario: Scenario) {
    if (!scenario.board_memo_draft) return
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`
      <html><head><title>Board Memo — ${scenario.name}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12pt; line-height: 1.6; margin: 1in; color: #111; }
        h1 { font-size: 16pt; margin-bottom: 4px; }
        h2 { font-size: 13pt; margin-top: 24px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
        pre { white-space: pre-wrap; font-family: Arial, sans-serif; font-size: 11pt; }
      </style></head>
      <body><pre>${scenario.board_memo_draft}</pre>
      <script>window.onload = () => window.print();</script>
      </body></html>`)
    w.document.close()
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Board reports</h1>
          <p className="text-sm text-gray-500 mt-1">
            AI-generated board memos and resolutions saved from your budget scenarios.
          </p>
        </div>
        <button onClick={() => router.push('/dashboard/scenarios')}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
          </svg>
          New scenario
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full"/>
        </div>
      ) : scenarios.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <svg className="w-10 h-10 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          <p className="text-sm font-medium text-gray-900 mb-1">No board memos yet</p>
          <p className="text-xs text-gray-400 mb-5">Save a budget scenario and click "Generate board memo with AI" to create one.</p>
          <button onClick={() => router.push('/dashboard/scenarios')}
            className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
            Go to Budget Scenarios
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-5 gap-5">
          {/* Scenario list */}
          <div className="col-span-2 space-y-2">
            <p className="text-xs font-medium text-gray-500 mb-3">{scenarios.length} memo{scenarios.length !== 1 ? 's' : ''} saved</p>
            {scenarios.map(s => (
              <div key={s.id}
                onClick={() => setSelected(s)}
                className={`p-4 rounded-xl border cursor-pointer transition-colors
                  ${selected?.id === s.id ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className={`text-sm font-semibold ${selected?.id === s.id ? 'text-indigo-700' : 'text-gray-900'}`}>
                    {s.name}
                  </p>
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium flex-shrink-0">Memo</span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-xs text-gray-500">
                  <span>Staff: -{s.staff_reductions}</span>
                  <span>Savings: {fmtM(Number(s.projected_savings || 0) * 100)}</span>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  {new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            ))}
          </div>

          {/* Memo viewer */}
          <div className="col-span-3">
            {!selected ? (
              <div className="bg-white border border-gray-200 rounded-xl h-full flex items-center justify-center p-8 text-center">
                <div>
                  <svg className="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5"/>
                  </svg>
                  <p className="text-sm text-gray-400">Select a memo from the left to view it</p>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{selected.name}</p>
                    <p className="text-xs text-gray-400">FY {selected.fiscal_year} · Generated by AI</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => navigator.clipboard.writeText(selected.board_memo_draft || '')}
                      className="px-3 py-1.5 border border-gray-200 text-xs font-medium text-gray-600 rounded-lg hover:bg-white">
                      Copy
                    </button>
                    <button onClick={() => downloadMemo(selected)}
                      className="px-3 py-1.5 border border-gray-200 text-xs font-medium text-gray-600 rounded-lg hover:bg-white">
                      Download
                    </button>
                    <button onClick={() => printMemo(selected)}
                      className="px-3 py-1.5 bg-indigo-600 text-xs font-medium text-white rounded-lg hover:bg-indigo-700">
                      Print / PDF
                    </button>
                  </div>
                </div>
                <div className="p-5 max-h-96 overflow-y-auto">
                  <pre className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap font-sans">
                    {selected.board_memo_draft}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
