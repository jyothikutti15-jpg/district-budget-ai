'use client'
import { useEffect, useState, useCallback } from 'react'
import { scenariosApi } from '@/lib/api'
import { computeOutcomes } from '@/lib/impact-model-client'

// Client-side impact model (mirrors the server-side TypeScript version)
// Used for real-time slider feedback before hitting the API

function fmt$(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1
  }).format(cents / 100)
}

interface Inputs {
  staffReductions: number
  classSizeIncrease: number
  programCutPct: number
  siteBudgetCutPct: number
  salaryFreeze: boolean
}

const DEFAULT_INPUTS: Inputs = {
  staffReductions: 0,
  classSizeIncrease: 0,
  programCutPct: 0,
  siteBudgetCutPct: 0,
  salaryFreeze: false,
}

// SRVUSD constants — in production pulled from API
const DISTRICT_CONTEXT = {
  enrollment: 27805,
  totalStaff: 1800,
  counselorFte: 53,
  currentDeficit: 26_000_000_00, // cents
  avgSalaryWithBenefits: 95_000_00,
}

function ImpactBar({ label, value, suffix = '', danger = false, inverse = false }: {
  label: string; value: number; suffix?: string; danger?: boolean; inverse?: boolean
}) {
  const isNegative = value < 0
  const isWarn = inverse ? value > 0 : value < 0
  const color = danger && isWarn ? 'bg-red-500' : 'bg-brand-500'
  const textColor = danger && isWarn ? 'text-red-600' : 'text-gray-900'
  const pct = Math.min(Math.abs(value) * 10, 100)

  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-500">{label}</span>
        <span className={`font-semibold ${textColor}`}>
          {value > 0 && !isNegative ? '+' : ''}{value.toFixed(1)}{suffix}
        </span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-300`}
          style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function ScenariosPage() {
  const [inputs, setInputs] = useState<Inputs>(DEFAULT_INPUTS)
  const [outcomes, setOutcomes] = useState(() => computeOutcomes(DEFAULT_INPUTS, DISTRICT_CONTEXT))
  const [saving, setSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState('')
  const [scenarioName, setScenarioName] = useState('')
  const [generatingMemo, setGeneratingMemo] = useState(false)
  const [memo, setMemo] = useState<string | null>(null)
  const [savedScenarioId, setSavedScenarioId] = useState<string | null>(null)

  const updateInputs = useCallback((patch: Partial<Inputs>) => {
    setInputs((prev) => {
      const next = { ...prev, ...patch }
      setOutcomes(computeOutcomes(next, DISTRICT_CONTEXT))
      return next
    })
  }, [])

  async function handleSave() {
    if (!scenarioName.trim()) { alert('Please enter a scenario name'); return }
    setSaving(true)
    try {
      const result = await scenariosApi.create({
        name: scenarioName,
        fiscalYear: '2025-26',
        inputs,
      }) as { data: { id: string } }
      setSavedScenarioId(result.data.id)
      setSavedMessage('Scenario saved!')
      setTimeout(() => setSavedMessage(''), 3000)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleGenerateMemo() {
    if (!savedScenarioId) { alert('Save the scenario first'); return }
    setGeneratingMemo(true)
    try {
      const result = await scenariosApi.generateMemo(savedScenarioId) as { data: { memo: string } }
      setMemo(result.data.memo)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setGeneratingMemo(false)
    }
  }

  const savings = outcomes.projectedSavings
  const deficit = DISTRICT_CONTEXT.currentDeficit
  const remainingDeficit = Math.max(0, deficit - savings)
  const coveragePct = Math.min(100, Math.round((savings / deficit) * 100))

  return (
    <div className="max-w-6xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Budget scenarios</h1>
          <p className="text-sm text-gray-500 mt-1">
            Adjust levers below — student impacts update in real time.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            value={scenarioName}
            onChange={(e) => setScenarioName(e.target.value)}
            placeholder="Scenario name…"
            className="input w-52"
          />
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : 'Save scenario'}
          </button>
          {savedMessage && <span className="text-xs text-green-600 font-medium">{savedMessage}</span>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">

        {/* Left: Levers */}
        <div className="col-span-1 space-y-5">
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Budget levers</h2>

            {/* Staff */}
            <div className="mb-5">
              <div className="flex justify-between text-xs mb-2">
                <label className="text-gray-600 font-medium">Staff reductions</label>
                <span className="font-bold text-gray-900">{inputs.staffReductions} positions</span>
              </div>
              <input type="range" min={0} max={200} step={1}
                value={inputs.staffReductions}
                onChange={(e) => updateInputs({ staffReductions: +e.target.value })}
                className="w-full accent-brand-600" />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>0</span><span>200</span>
              </div>
            </div>

            {/* Class size */}
            <div className="mb-5">
              <div className="flex justify-between text-xs mb-2">
                <label className="text-gray-600 font-medium">Class size increase</label>
                <span className="font-bold text-gray-900">+{inputs.classSizeIncrease} students</span>
              </div>
              <input type="range" min={0} max={6} step={0.5}
                value={inputs.classSizeIncrease}
                onChange={(e) => updateInputs({ classSizeIncrease: +e.target.value })}
                className="w-full accent-brand-600" />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>0</span><span>+6</span>
              </div>
            </div>

            {/* Programs */}
            <div className="mb-5">
              <div className="flex justify-between text-xs mb-2">
                <label className="text-gray-600 font-medium">Program cuts</label>
                <span className="font-bold text-gray-900">{inputs.programCutPct}%</span>
              </div>
              <input type="range" min={0} max={50} step={5}
                value={inputs.programCutPct}
                onChange={(e) => updateInputs({ programCutPct: +e.target.value })}
                className="w-full accent-brand-600" />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>0%</span><span>50%</span>
              </div>
            </div>

            {/* Site budget */}
            <div className="mb-5">
              <div className="flex justify-between text-xs mb-2">
                <label className="text-gray-600 font-medium">Site budget cuts</label>
                <span className="font-bold text-gray-900">{inputs.siteBudgetCutPct}%</span>
              </div>
              <input type="range" min={0} max={20} step={1}
                value={inputs.siteBudgetCutPct}
                onChange={(e) => updateInputs({ siteBudgetCutPct: +e.target.value })}
                className="w-full accent-brand-600" />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>0%</span><span>20%</span>
              </div>
            </div>

            {/* Salary freeze */}
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <div className="relative">
                <input type="checkbox"
                  checked={inputs.salaryFreeze}
                  onChange={(e) => updateInputs({ salaryFreeze: e.target.checked })}
                  className="sr-only" />
                <div className={`w-8 h-4 rounded-full transition-colors ${inputs.salaryFreeze ? 'bg-brand-600' : 'bg-gray-200'}`} />
                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${inputs.salaryFreeze ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-xs text-gray-600 font-medium">Salary freeze (no COLA)</span>
            </label>
          </div>
        </div>

        {/* Middle: Financial outcomes */}
        <div className="col-span-1 space-y-4">
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Financial impact</h2>

            <div className="text-center py-3 mb-4">
              <p className="text-xs text-gray-500 mb-1">Projected savings</p>
              <p className="text-3xl font-bold text-green-600">{fmt$(savings)}</p>
              <p className="text-xs text-gray-400 mt-1">of {fmt$(deficit)} deficit · {coveragePct}% covered</p>
            </div>

            {/* Progress toward closing deficit */}
            <div className="mb-4">
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full transition-all duration-300"
                  style={{ width: `${coveragePct}%` }} />
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>$0</span>
                <span>Remaining: {fmt$(remainingDeficit)}</span>
                <span>{fmt$(deficit)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="metric-card text-center">
                <p className="text-xs text-gray-500">Reserve %</p>
                <p className={`text-lg font-bold mt-0.5 ${outcomes.projectedReservePct < 3 ? 'text-amber-600' : 'text-gray-900'}`}>
                  {outcomes.projectedReservePct.toFixed(1)}%
                </p>
              </div>
              <div className="metric-card text-center">
                <p className="text-xs text-gray-500">Teacher workload</p>
                <p className={`text-lg font-bold mt-0.5 ${outcomes.teacherWorkloadDelta > 10 ? 'text-amber-600' : 'text-gray-900'}`}>
                  +{outcomes.teacherWorkloadDelta.toFixed(0)}%
                </p>
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Counselor ratio</h2>
            <div className="text-center">
              <p className={`text-3xl font-bold ${outcomes.counselorRatioNew > 350 ? 'text-red-500' : outcomes.counselorRatioNew > 250 ? 'text-amber-500' : 'text-green-600'}`}>
                1:{Math.round(outcomes.counselorRatioNew)}
              </p>
              <p className="text-xs text-gray-400 mt-1">ASCA recommends 1:250</p>
            </div>
          </div>
        </div>

        {/* Right: Student outcomes */}
        <div className="col-span-1 space-y-4">
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Student outcome projections</h2>
            <p className="text-xs text-gray-400 mb-4">Based on published EdResearch coefficients</p>

            <div className="space-y-4">
              <ImpactBar label="Math proficiency" value={outcomes.mathProficiencyDelta} suffix=" pts" danger inverse />
              <ImpactBar label="ELA proficiency" value={outcomes.elaProficiencyDelta} suffix=" pts" danger inverse />
              <ImpactBar label="Graduation rate" value={outcomes.gradRateDelta} suffix="%" danger inverse />
              <ImpactBar label="Chronic absenteeism" value={outcomes.absenteeismDelta} suffix="%" danger />
            </div>

            {outcomes.mathProficiencyDelta < -3 && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs text-amber-800 font-medium">High academic impact warning</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Math scores projected to drop {Math.abs(outcomes.mathProficiencyDelta).toFixed(1)} points.
                  AI tutoring ($42/student) can offset ~60% of this impact.
                </p>
              </div>
            )}
          </div>

          <div className="card space-y-2">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Generate board documents</h2>
            <button onClick={handleGenerateMemo} disabled={generatingMemo || !savedScenarioId}
              className="btn-primary w-full text-xs py-2.5">
              {generatingMemo ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin w-3 h-3 border border-white border-t-transparent rounded-full" />
                  Generating memo…
                </span>
              ) : 'Generate board memo with AI'}
            </button>
            {!savedScenarioId && (
              <p className="text-xs text-center text-gray-400">Save the scenario first to generate documents</p>
            )}
          </div>
        </div>
      </div>

      {/* AI-generated memo */}
      {memo && (
        <div className="mt-6 card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">AI-generated board memo</h2>
            <div className="flex gap-2">
              <span className="badge badge-purple">AI generated</span>
              <button onClick={() => navigator.clipboard.writeText(memo)}
                className="btn-secondary text-xs py-1 px-3">Copy</button>
            </div>
          </div>
          <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed bg-gray-50 rounded-lg p-4">
            {memo}
          </pre>
        </div>
      )}
    </div>
  )
}
