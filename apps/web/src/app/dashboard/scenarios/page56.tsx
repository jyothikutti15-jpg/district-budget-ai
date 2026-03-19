'use client'
import { useState, useEffect, useCallback } from 'react'
import { computeOutcomes } from '@/lib/impact-model-client'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface Outcomes {
  projectedSavings: number
  projectedDeficit: number
  projectedReservePct: number
  mathProficiencyDelta: number
  elaProficiencyDelta: number
  gradRateDelta: number
  absenteeismDelta: number
  counselorRatioNew: number
  teacherWorkloadDelta: number
}

interface SavedScenario {
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
}

function ImpactBar({ label, value, suffix = '', danger = false, invert = false }: {
  label: string; value: number; suffix?: string; danger?: boolean; invert?: boolean
}) {
  const isNeg = invert ? value < 0 : value > 0
  const color = danger
    ? (Math.abs(value) > 5 ? '#E24B4A' : Math.abs(value) > 2 ? '#EF9F27' : '#378ADD')
    : '#378ADD'
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-500">{label}</span>
        <span className={`font-medium ${danger && Math.abs(value) > 2 ? 'text-red-600' : 'text-gray-900'}`}>
          {value > 0 && !invert ? '+' : ''}{value.toFixed(1)}{suffix}
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-300"
          style={{ width: `${Math.min(95, Math.abs(value) * 12)}%`, background: color }} />
      </div>
    </div>
  )
}

export default function ScenariosPage() {
  const [staffReductions, setStaffReductions]   = useState(0)
  const [classSizeIncrease, setClassSizeIncrease] = useState(0)
  const [programCutPct, setProgramCutPct]       = useState(0)
  const [siteBudgetCutPct, setSiteBudgetCutPct] = useState(0)
  const [salaryFreeze, setSalaryFreeze]         = useState(false)
  const [scenarioName, setScenarioName]         = useState('')
  const [saving, setSaving]                     = useState(false)
  const [savedId, setSavedId]                   = useState<string | null>(null)
  const [savedMsg, setSavedMsg]                 = useState('')
  const [generating, setGenerating]             = useState(false)
  const [memo, setMemo]                         = useState<string | null>(null)
  const [savedScenarios, setSavedScenarios]     = useState<SavedScenario[]>([])
  const [activeTab, setActiveTab]               = useState<'model'|'saved'>('model')
  const [loadingScenarios, setLoadingScenarios] = useState(false)

  const outcomes: Outcomes = computeScenario({
    staffReductions, classSizeIncrease, programCutPct,
    siteBudgetCutPct, salaryFreeze,
  })

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
  const fmtM = (c: number) => `$${(Math.abs(c) / 100_000_000).toFixed(1)}M`

  // Load saved scenarios
  const loadSaved = useCallback(async () => {
    setLoadingScenarios(true)
    try {
      const r = await fetch(`${API_BASE}/api/scenarios`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const d = await r.json()
      setSavedScenarios(d.data || [])
    } catch { setSavedScenarios([]) }
    finally { setLoadingScenarios(false) }
  }, [token])

  useEffect(() => { if (activeTab === 'saved') loadSaved() }, [activeTab, loadSaved])

  async function saveScenario() {
    if (!scenarioName.trim()) { alert('Please enter a scenario name first.'); return }
    setSaving(true)
    setSavedMsg('')
    try {
      const r = await fetch(`${API_BASE}/api/scenarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: scenarioName, fiscalYear: '2025-26',
          inputs: { staffReductions, classSizeIncrease, programCutPct, siteBudgetCutPct, salaryFreeze }
        })
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Save failed')
      setSavedId(d.data.id)
      setSavedMsg('Scenario saved!')
      setTimeout(() => setSavedMsg(''), 3000)
    } catch (e: any) { alert(e.message) }
    finally { setSaving(false) }
  }

  async function generateMemo() {
    if (!savedId) { alert('Save the scenario first, then generate the memo.'); return }
    setGenerating(true)
    setMemo(null)
    try {
      const r = await fetch(`${API_BASE}/api/scenarios/${savedId}/generate-memo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Generation failed')
      setMemo(d.data.memo)
    } catch (e: any) { alert(e.message) }
    finally { setGenerating(false) }
  }

  function downloadMemo() {
    if (!memo) return
    const blob = new Blob([memo], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Board_Memo_${scenarioName || 'Scenario'}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  function loadScenario(s: SavedScenario) {
    setStaffReductions(s.staff_reductions || 0)
    setClassSizeIncrease(Number(s.class_size_increase) || 0)
    setProgramCutPct(Number(s.program_cut_pct) || 0)
    setScenarioName(s.name)
    setSavedId(s.id)
    setMemo(s.board_memo_draft)
    setActiveTab('model')
  }

  return (
    <div className="max-w-6xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Budget scenarios</h1>
          <p className="text-sm text-gray-500 mt-1">Adjust levers below — student impacts update in real time.</p>
        </div>
        <div className="flex gap-2">
          {(['model','saved'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors
                ${activeTab === tab ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
              {tab === 'model' ? 'Model scenario' : `Saved scenarios (${savedScenarios.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* ── SAVED SCENARIOS TAB ── */}
      {activeTab === 'saved' && (
        <div>
          {loadingScenarios ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full"/>
            </div>
          ) : savedScenarios.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
              <p className="text-gray-400 text-sm mb-3">No scenarios saved yet.</p>
              <button onClick={() => setActiveTab('model')}
                className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
                Create your first scenario
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {savedScenarios.map(s => (
                <div key={s.id} className="bg-white border border-gray-200 rounded-xl p-5 flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-sm font-semibold text-gray-900">{s.name}</h3>
                      <span className="text-xs text-gray-400">FY {s.fiscal_year}</span>
                      {s.board_memo_draft && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">Memo generated</span>
                      )}
                    </div>
                    <div className="grid grid-cols-4 gap-3 text-xs text-gray-500">
                      <span>Staff cuts: <strong className="text-gray-900">{s.staff_reductions}</strong></span>
                      <span>Class size: <strong className="text-gray-900">+{Number(s.class_size_increase).toFixed(1)}</strong></span>
                      <span>Programs: <strong className="text-gray-900">{Number(s.program_cut_pct).toFixed(0)}%</strong></span>
                      <span>Savings: <strong className="text-green-600">{fmtM(Number(s.projected_savings || 0) * 100)}</strong></span>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      Saved {new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  <button onClick={() => loadScenario(s)}
                    className="px-4 py-2 border border-indigo-200 text-indigo-600 text-xs font-medium rounded-lg hover:bg-indigo-50 flex-shrink-0">
                    Load scenario
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── MODEL TAB ── */}
      {activeTab === 'model' && (
        <>
          {/* Save bar */}
          <div className="flex items-center gap-3 mb-5 p-4 bg-white border border-gray-200 rounded-xl">
            <input value={scenarioName} onChange={e => setScenarioName(e.target.value)}
              placeholder="Scenario name (e.g. Conservative cuts FY 2025-26)..."
              className="flex-1 h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
            <button onClick={saveScenario} disabled={saving || !scenarioName.trim()}
              className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex-shrink-0">
              {saving ? 'Saving...' : 'Save scenario'}
            </button>
            {savedMsg && <span className="text-sm text-green-600 font-medium flex-shrink-0">{savedMsg}</span>}
          </div>

          <div className="grid grid-cols-3 gap-5">
            {/* Sliders */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Budget levers</h2>
              {[
                { label: 'Staff reductions', val: staffReductions, set: setStaffReductions, min: 0, max: 200, step: 1, suffix: ' positions' },
                { label: 'Class size increase', val: classSizeIncrease, set: setClassSizeIncrease, min: 0, max: 6, step: 0.5, suffix: ' students' },
                { label: 'Program cuts', val: programCutPct, set: setProgramCutPct, min: 0, max: 50, step: 5, suffix: '%' },
                { label: 'Site budget cuts', val: siteBudgetCutPct, set: setSiteBudgetCutPct, min: 0, max: 20, step: 1, suffix: '%' },
              ].map(({ label, val, set, min, max, step, suffix }) => (
                <div key={label} className="mb-4">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-gray-600">{label}</span>
                    <span className="font-semibold text-gray-900">{val > 0 && suffix !== ' positions' ? '+' : ''}{val}{suffix}</span>
                  </div>
                  <input type="range" min={min} max={max} step={step} value={val}
                    onChange={e => set(parseFloat(e.target.value))} className="w-full"/>
                  <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                    <span>{min}{suffix === '%' ? '%' : ''}</span>
                    <span>{max}{suffix === '%' ? '%' : ''}</span>
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-2 mt-2">
                <button onClick={() => setSalaryFreeze(!salaryFreeze)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${salaryFreeze ? 'bg-indigo-600' : 'bg-gray-200'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${salaryFreeze ? 'left-5' : 'left-0.5'}`}/>
                </button>
                <span className="text-xs text-gray-600">Salary freeze (no COLA)</span>
              </div>
            </div>

            {/* Financial impact */}
            <div className="flex flex-col gap-4">
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-3">Financial impact</h2>
                <div className="text-center mb-3">
                  <p className="text-xs text-gray-500 mb-1">Projected savings</p>
                  <p className={`text-3xl font-bold ${outcomes.projectedSavings > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                    {outcomes.projectedSavings > 0 ? fmtM(outcomes.projectedSavings) : '$0'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    of $26M deficit · {Math.min(100, Math.round((outcomes.projectedSavings / 2_600_000_000) * 100))}% covered
                  </p>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
                  <div className="h-full bg-green-500 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, (outcomes.projectedSavings / 2_600_000_000) * 100)}%` }}/>
                </div>
                <div className="flex justify-between text-xs text-gray-400 mb-4">
                  <span>$0</span>
                  <span>Remaining: {fmtM(Math.max(0, 2_600_000_000 - outcomes.projectedSavings))}</span>
                  <span>$26M</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500 mb-1">Reserve %</p>
                    <p className={`text-lg font-bold ${outcomes.projectedReservePct < 3 ? 'text-red-600' : 'text-amber-500'}`}>
                      {outcomes.projectedReservePct.toFixed(1)}%
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500 mb-1">Teacher workload</p>
                    <p className="text-lg font-bold text-gray-900">
                      +{outcomes.teacherWorkloadDelta.toFixed(0)}%
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-3">Counselor ratio</h2>
                <p className={`text-3xl font-bold text-center ${outcomes.counselorRatioNew > 400 ? 'text-red-600' : 'text-gray-900'}`}>
                  1:{Math.round(outcomes.counselorRatioNew)}
                </p>
                <p className="text-xs text-gray-400 text-center mt-1">ASCA recommends 1:250</p>
              </div>
            </div>

            {/* Student outcomes + board memo */}
            <div className="flex flex-col gap-4">
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-1">Student outcome projections</h2>
                <p className="text-xs text-gray-400 mb-4">Based on published EdResearch coefficients</p>
                <ImpactBar label="Math proficiency" value={outcomes.mathProficiencyDelta} suffix=" pts" danger />
                <ImpactBar label="ELA proficiency" value={outcomes.elaProficiencyDelta} suffix=" pts" danger />
                <ImpactBar label="Graduation rate" value={outcomes.gradRateDelta} suffix="%" danger />
                <ImpactBar label="Chronic absenteeism" value={outcomes.absenteeismDelta} suffix="%" danger />
                {outcomes.mathProficiencyDelta < -4 && (
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs font-semibold text-amber-800">High academic impact warning</p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      Math scores projected to drop {Math.abs(outcomes.mathProficiencyDelta).toFixed(1)} points.
                      AI tutoring ($42/student) can offset ~60% of this impact.
                    </p>
                  </div>
                )}
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-1">Generate board documents</h2>
                <p className="text-xs text-gray-400 mb-3">Save the scenario first to generate documents</p>
                <button onClick={generateMemo} disabled={generating || !savedId}
                  className="w-full py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed">
                  {generating ? 'Generating memo...' : 'Generate board memo with AI'}
                </button>
              </div>
            </div>
          </div>

          {/* Board memo display */}
          {memo && (
            <div className="mt-5 bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-gray-900">AI-generated board memo</h2>
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">AI generated</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => navigator.clipboard.writeText(memo)}
                    className="px-3 py-1.5 border border-gray-200 text-xs font-medium text-gray-600 rounded-lg hover:bg-gray-50">
                    Copy
                  </button>
                  <button onClick={downloadMemo}
                    className="px-3 py-1.5 border border-indigo-200 text-xs font-medium text-indigo-600 rounded-lg hover:bg-indigo-50">
                    Download .txt
                  </button>
                </div>
              </div>
              <pre className="p-5 text-xs text-gray-700 leading-relaxed whitespace-pre-wrap font-sans">{memo}</pre>
            </div>
          )}
        </>
      )}
    </div>
  )
}
