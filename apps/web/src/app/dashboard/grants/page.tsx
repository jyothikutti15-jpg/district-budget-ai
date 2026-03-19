'use client'
import { useEffect, useState } from 'react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface Grant {
  id: string
  name: string
  description: string
  estimated_amount: number | null
  match_confidence: number | null
  status: string
  application_narrative: string | null
  program_code: string
  application_deadline: string | null
  application_url: string | null
}

function safeNum(val: unknown): number {
  const n = Number(val)
  return isNaN(n) ? 0 : n
}

function fmtMoney(cents: number): string {
  const dollars = cents / 100
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`
  if (dollars >= 1_000) return `$${(dollars / 1_000).toFixed(0)}K`
  return `$${dollars.toFixed(0)}`
}

const STATUS_COLORS: Record<string, string> = {
  identified:  'bg-blue-100 text-blue-800',
  in_progress: 'bg-amber-100 text-amber-800',
  submitted:   'bg-purple-100 text-purple-800',
  awarded:     'bg-green-100 text-green-800',
  declined:    'bg-red-100 text-red-800',
}

const DEMO_GRANTS: Grant[] = [
  {
    id: '1', name: 'Title I, Part A — Low-Income Student Support',
    description: 'Federal funding for districts with high concentrations of low-income students. Covers tutoring, instructional materials, and professional development.',
    estimated_amount: 210000000, match_confidence: 95, status: 'identified',
    application_narrative: null, program_code: 'TITLE_I_A',
    application_deadline: 'July 1 annually', application_url: 'https://oese.ed.gov'
  },
  {
    id: '2', name: 'E-Rate — Federal Connectivity Funding',
    description: 'FCC discounts on broadband internet and networking equipment. SRVUSD Chromebook fleet qualifies.',
    estimated_amount: 140000000, match_confidence: 90, status: 'identified',
    application_narrative: null, program_code: 'ERATE',
    application_deadline: 'January–March annually', application_url: 'https://www.usac.org/e-rate/'
  },
  {
    id: '3', name: 'IDEA Part B — Special Education Grants',
    description: 'Federal pass-through via CDE for special education services. Staff cuts in SPED trigger compliance review.',
    estimated_amount: 89000000, match_confidence: 85, status: 'identified',
    application_narrative: null, program_code: 'IDEA_B',
    application_deadline: 'August annually', application_url: 'https://www.cde.ca.gov'
  },
  {
    id: '4', name: 'CA College Corps — High-Dosage Tutoring',
    description: 'College students paid $10K for 450 tutoring hours. SRVUSD could host 30+ corps members.',
    estimated_amount: 42000000, match_confidence: 80, status: 'identified',
    application_narrative: null, program_code: 'CA_COLLEGE_CORPS',
    application_deadline: 'September annually', application_url: 'https://californiavolunteers.ca.gov'
  },
]

export default function GrantsPage() {
  const [grants, setGrants] = useState<Grant[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [usingDemo, setUsingDemo] = useState(false)

  function loadGrants() {
    setLoading(true)
    const token = localStorage.getItem('auth_token')
    fetch(`${API_BASE}/api/grants`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => {
        const data = d.data || []
        if (data.length === 0) {
          setGrants(DEMO_GRANTS)
          setUsingDemo(true)
        } else {
          setGrants(data)
          setUsingDemo(false)
        }
      })
      .catch(() => {
        setGrants(DEMO_GRANTS)
        setUsingDemo(true)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadGrants() }, [])

  async function runMatcher() {
    setRunning(true)
    const token = localStorage.getItem('auth_token')
    try {
      await fetch(`${API_BASE}/api/grants/run-matcher`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })
      await loadGrants()
    } catch {
      setGrants(DEMO_GRANTS)
      setUsingDemo(true)
    } finally {
      setRunning(false)
    }
  }

  const totalValue = grants.reduce((s, g) => s + safeNum(g.estimated_amount), 0)
  const byStatus = {
    identified:  grants.filter(g => g.status === 'identified').length,
    in_progress: grants.filter(g => g.status === 'in_progress').length,
    awarded:     grants.filter(g => g.status === 'awarded').length,
  }
  const totalAwarded = grants
    .filter(g => g.status === 'awarded')
    .reduce((s, g) => s + safeNum(g.estimated_amount), 0)

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Grant matcher</h1>
          <p className="text-sm text-gray-500 mt-1">
            {grants.length} grants matched · {fmtMoney(totalValue)} total estimated value
            {usingDemo && <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Demo data</span>}
          </p>
        </div>
        <button onClick={runMatcher} disabled={running}
          className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
          {running ? 'Running...' : 'Re-run matcher'}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Identified</p>
          <p className="text-2xl font-bold text-gray-900">{fmtMoney(totalValue)}</p>
          <p className="text-xs text-gray-400 mt-1">{byStatus.identified} grants</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">In progress</p>
          <p className="text-2xl font-bold text-gray-900">
            {byStatus.in_progress > 0 ? fmtMoney(
              grants.filter(g => g.status === 'in_progress')
                .reduce((s, g) => s + safeNum(g.estimated_amount), 0)
            ) : '$0'}
          </p>
          <p className="text-xs text-gray-400 mt-1">{byStatus.in_progress} grants</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Awarded</p>
          <p className="text-2xl font-bold text-green-600">
            {totalAwarded > 0 ? fmtMoney(totalAwarded) : '$0'}
          </p>
          <p className="text-xs text-gray-400 mt-1">{byStatus.awarded} grants</p>
        </div>
      </div>

      {/* Grant list */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full"/>
        </div>
      ) : grants.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <p className="text-gray-400 text-sm mb-4">No grants matched yet.</p>
          <button onClick={runMatcher} disabled={running}
            className="px-6 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {running ? 'Running matcher...' : 'Run grant matcher'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {grants.map((grant) => (
            <div key={grant.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="text-sm font-semibold text-gray-900">{grant.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[grant.status] || 'bg-gray-100 text-gray-700'}`}>
                        {grant.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed mb-2">{grant.description}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      {grant.application_deadline && (
                        <span>📅 {grant.application_deadline}</span>
                      )}
                      <span>✓ {safeNum(grant.match_confidence).toFixed(0)}% match confidence</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-bold text-green-600">
                      {fmtMoney(safeNum(grant.estimated_amount))}
                    </p>
                    <p className="text-xs text-gray-400">estimated</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={() => setExpanded(expanded === grant.id ? null : grant.id)}
                    className="text-xs text-indigo-600 hover:underline">
                    {expanded === grant.id ? 'Hide details' : 'View application narrative'}
                  </button>
                  {grant.application_url && (
                    <a href={grant.application_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-gray-400 hover:text-gray-600">
                      Official site ↗
                    </a>
                  )}
                </div>
              </div>

              {expanded === grant.id && (
                <div className="border-t border-gray-100 p-4 bg-gray-50">
                  <p className="text-xs font-medium text-gray-700 mb-2">AI-generated application narrative</p>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    {grant.application_narrative ||
                      `San Ramon Valley Unified School District respectfully requests funding under ${grant.name}. ` +
                      `With 27,805 students enrolled and a current budget deficit of $26M, SRVUSD meets all eligibility ` +
                      `criteria and will deploy these funds to directly support student outcomes across all 35 campuses. ` +
                      `Connect to the API server to generate a full custom narrative with AI.`
                    }
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {grants.length > 0 && (
        <div className="mt-4 p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
          <p className="text-sm font-medium text-indigo-900 mb-1">
            Total available: {fmtMoney(totalValue)}
          </p>
          <p className="text-xs text-indigo-700">
            Applying for all matched grants would offset {Math.round((totalValue / 100) / 26_000_000 * 100)}% of SRVUSD's $26M deficit.
          </p>
        </div>
      )}
    </div>
  )
}
