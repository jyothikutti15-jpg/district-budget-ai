'use client'
import { useEffect, useState } from 'react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

function fetchTeacher(path: string) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
  return fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json())
}

interface AtRiskStudent {
  id: string
  display_name: string
  grade_level: number
  overall_risk: number
  academic_regression: number
  behavioral_disengagement: number
  persistent_blockage: number
  alert_reason: string
  blocking_concept: string | null
}

interface MasteryRow {
  student_id: string
  display_name: string
  concept_id: string
  concept_name: string
  mastery_score: number
}

interface WeeklyReport {
  student_id: string
  display_name: string
  grade_level: number
  summary_text: string
  sessions_count: number
  week_ending: string
}

function RiskBadge({ score }: { score: number }) {
  const color = score >= 70 ? 'badge-red' : score >= 40 ? 'badge-amber' : 'badge-green'
  const label = score >= 70 ? 'High risk' : score >= 40 ? 'Watch' : 'On track'
  return <span className={`badge ${color}`}>{label}</span>
}

function MasteryCell({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const bg =
    pct >= 80 ? 'bg-green-500' :
    pct >= 60 ? 'bg-amber-400' :
    pct >= 40 ? 'bg-orange-400' : 'bg-red-400'

  return (
    <div className={`w-8 h-8 rounded flex items-center justify-center text-white text-xs font-bold ${bg}`}
      title={`${pct}% mastery`}>
      {pct}
    </div>
  )
}

export default function TeacherDashboard() {
  const [atRisk, setAtRisk] = useState<AtRiskStudent[]>([])
  const [mastery, setMastery] = useState<MasteryRow[]>([])
  const [reports, setReports] = useState<WeeklyReport[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'alerts' | 'mastery' | 'reports'>('alerts')

  useEffect(() => {
    Promise.all([
      fetchTeacher('/api/tutor/teacher/at-risk'),
      fetchTeacher('/api/tutor/teacher/class-mastery'),
      fetchTeacher('/api/tutor/teacher/weekly-reports'),
    ]).then(([riskRes, masteryRes, reportsRes]) => {
      setAtRisk(riskRes.data || [])
      setMastery(masteryRes.data || [])
      setReports(reportsRes.data || [])
    }).catch(() => {
      // Demo mode
      setAtRisk([
        { id: '1', display_name: 'Arjun M.', grade_level: 5, overall_risk: 85,
          academic_regression: 80, behavioral_disengagement: 40, persistent_blockage: 85,
          alert_reason: 'Stuck on fraction division 4 sessions in a row — needs direct intervention.',
          blocking_concept: 'Fraction division' },
        { id: '2', display_name: 'Sofia L.', grade_level: 5, overall_risk: 62,
          academic_regression: 55, behavioral_disengagement: 62, persistent_blockage: 20,
          alert_reason: 'Repeatedly exits sessions early — possible reading difficulty.',
          blocking_concept: null },
        { id: '3', display_name: 'Kenji P.', grade_level: 5, overall_risk: 48,
          academic_regression: 48, behavioral_disengagement: 30, persistent_blockage: 25,
          alert_reason: 'Early signs of struggle — worth a check-in.',
          blocking_concept: null },
      ])
      setReports([
        { student_id: '4', display_name: 'Maya R.', grade_level: 5,
          summary_text: 'Maya completed 4 practice sessions this week, spending 42 minutes total on fraction operations. Her mastery of fraction addition improved from 61% to 79%, showing strong progress. She struggled briefly with equivalent fractions but recovered well with hints. Recommend introducing fraction division next session.',
          sessions_count: 4, week_ending: '2026-03-14' },
        { student_id: '5', display_name: 'Leo T.', grade_level: 5,
          summary_text: 'Leo logged in twice this week for 18 minutes total, below his usual engagement. His long division mastery remains at 52% with no improvement. He showed disengagement signals in 3 of 5 exchanges. Consider a brief one-on-one check-in to understand any external factors affecting his motivation.',
          sessions_count: 2, week_ending: '2026-03-14' },
      ])
    }).finally(() => setLoading(false))
  }, [])

  // Build mastery matrix
  const students = [...new Map(mastery.map((m) => [m.student_id, m.display_name])).entries()]
  const concepts = [...new Map(mastery.map((m) => [m.concept_id, m.concept_name])).entries()]
  const masteryMap = new Map(mastery.map((m) => [`${m.student_id}:${m.concept_id}`, m.mastery_score]))

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full" />
    </div>
  )

  return (
    <div className="max-w-6xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Teacher dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            {atRisk.filter((s) => s.overall_risk >= 70).length} students need attention today
          </p>
        </div>
        <div className="flex gap-2">
          {(['alerts', 'mastery', 'reports'] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors
                ${activeTab === tab
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
              {tab === 'alerts' ? `Alerts (${atRisk.length})` :
               tab === 'mastery' ? 'Mastery heatmap' : 'Weekly reports'}
            </button>
          ))}
        </div>
      </div>

      {/* ── At-Risk Alerts ── */}
      {activeTab === 'alerts' && (
        <div className="space-y-3">
          {atRisk.length === 0 && (
            <div className="card text-center py-12">
              <p className="text-green-600 font-medium">All students on track today!</p>
              <p className="text-sm text-gray-400 mt-1">No alerts to review.</p>
            </div>
          )}
          {atRisk.map((student) => (
            <div key={student.id} className="card">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 font-semibold text-sm text-gray-700">
                  {student.display_name.split(' ').map((n) => n[0]).join('')}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900">{student.display_name}</span>
                    <span className="text-xs text-gray-400">Grade {student.grade_level}</span>
                    <RiskBadge score={student.overall_risk} />
                    {student.blocking_concept && (
                      <span className="badge badge-purple">Blocked: {student.blocking_concept}</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{student.alert_reason}</p>

                  {/* Risk breakdown bars */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Academic', value: student.academic_regression },
                      { label: 'Engagement', value: student.behavioral_disengagement },
                      { label: 'Blockage', value: student.persistent_blockage },
                    ].map((item) => (
                      <div key={item.label}>
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>{item.label}</span>
                          <span className="font-medium">{item.value}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${
                            item.value >= 70 ? 'bg-red-500' :
                            item.value >= 40 ? 'bg-amber-400' : 'bg-green-400'
                          }`} style={{ width: `${item.value}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <button className="btn-secondary text-xs py-1.5 px-3 flex-shrink-0">
                  View full profile
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Mastery Heatmap ── */}
      {activeTab === 'mastery' && (
        <div className="card overflow-auto">
          {students.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-sm">No mastery data yet. Students need to complete sessions first.</p>
            </div>
          ) : (
            <table className="text-xs min-w-full">
              <thead>
                <tr>
                  <th className="text-left py-2 pr-4 font-medium text-gray-700 sticky left-0 bg-white min-w-28">
                    Student
                  </th>
                  {concepts.map(([id, name]) => (
                    <th key={id} className="px-1 py-2 font-medium text-gray-600 max-w-20 text-center">
                      <div className="truncate" title={name}>{name.split(' ')[0]}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.map(([studentId, name]) => (
                  <tr key={studentId} className="border-t border-gray-50">
                    <td className="py-2 pr-4 font-medium text-gray-800 sticky left-0 bg-white">{name}</td>
                    {concepts.map(([conceptId]) => {
                      const score = masteryMap.get(`${studentId}:${conceptId}`) ?? 0
                      return (
                        <td key={conceptId} className="px-1 py-1.5 text-center">
                          <MasteryCell score={score} />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-100 text-xs text-gray-500">
            <span>Mastery key:</span>
            {[['bg-red-400', '0–39%'], ['bg-orange-400', '40–59%'], ['bg-amber-400', '60–79%'], ['bg-green-500', '80–100%']].map(([color, label]) => (
              <span key={label} className="flex items-center gap-1.5">
                <span className={`w-3 h-3 rounded ${color}`} />{label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Weekly Reports ── */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          {reports.length === 0 && (
            <div className="card text-center py-12 text-gray-400">
              <p className="text-sm">Weekly reports generate every Friday. Check back then.</p>
            </div>
          )}
          {reports.map((report) => (
            <div key={report.student_id} className="card">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center text-xs font-semibold">
                    {report.display_name.split(' ').map((n) => n[0]).join('')}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{report.display_name}</p>
                    <p className="text-xs text-gray-400">Grade {report.grade_level} · {report.sessions_count} sessions this week</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="badge badge-purple">AI summary</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(report.summary_text)}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Copy
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-lg p-3">
                {report.summary_text}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
