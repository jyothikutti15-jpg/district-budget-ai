'use client'
import { useState } from 'react'

// All California school districts - top 50 by enrollment
const CA_DISTRICTS = [
  { id: '0622710', name: 'San Ramon Valley Unified', county: 'Contra Costa', enrollment: 27805, perPupil: 8685 },
  { id: '0161119', name: 'Los Angeles Unified', county: 'Los Angeles', enrollment: 596000, perPupil: 19500 },
  { id: '0735294', name: 'San Diego Unified', county: 'San Diego', enrollment: 96000, perPupil: 13200 },
  { id: '0169021', name: 'Fresno Unified', county: 'Fresno', enrollment: 72000, perPupil: 12800 },
  { id: '0161507', name: 'Long Beach Unified', county: 'Los Angeles', enrollment: 70000, perPupil: 13100 },
  { id: '0161259', name: 'Elk Grove Unified', county: 'Sacramento', enrollment: 64000, perPupil: 10200 },
  { id: '0169450', name: 'Santa Ana Unified', county: 'Orange', enrollment: 49000, perPupil: 11900 },
  { id: '0168559', name: 'Riverside Unified', county: 'Riverside', enrollment: 43000, perPupil: 10800 },
  { id: '0161929', name: 'Oakland Unified', county: 'Alameda', enrollment: 35000, perPupil: 18200 },
  { id: '0634816', name: 'Fremont Unified', county: 'Alameda', enrollment: 32000, perPupil: 9200 },
  { id: '0168096', name: 'Corona-Norco Unified', county: 'Riverside', enrollment: 52000, perPupil: 9800 },
  { id: '0100305', name: 'Pleasanton Unified', county: 'Alameda', enrollment: 14200, perPupil: 8984 },
  { id: '0100438', name: 'Dublin Unified', county: 'Alameda', enrollment: 13800, perPupil: 9450 },
  { id: '0168088', name: 'Livermore Valley Joint Unified', county: 'Alameda', enrollment: 13200, perPupil: 8800 },
  { id: '0622728', name: 'Mt. Diablo Unified', county: 'Contra Costa', enrollment: 29000, perPupil: 10200 },
  { id: '0622736', name: 'West Contra Costa Unified', county: 'Contra Costa', enrollment: 28000, perPupil: 12800 },
  { id: '0622744', name: 'Antioch Unified', county: 'Contra Costa', enrollment: 18000, perPupil: 11200 },
  { id: '0622751', name: 'Pittsburg Unified', county: 'Contra Costa', enrollment: 12000, perPupil: 12100 },
  { id: '0622769', name: 'Brentwood Union', county: 'Contra Costa', enrollment: 11000, perPupil: 9100 },
  { id: '0622777', name: 'Liberty Union High', county: 'Contra Costa', enrollment: 9500, perPupil: 9800 },
  { id: '0161390', name: 'Sacramento City Unified', county: 'Sacramento', enrollment: 40000, perPupil: 14200 },
  { id: '0752360', name: 'San Jose Unified', county: 'Santa Clara', enrollment: 25000, perPupil: 11800 },
  { id: '0752378', name: 'East Side Union High', county: 'Santa Clara', enrollment: 22000, perPupil: 10900 },
  { id: '0752386', name: 'Santa Clara Unified', county: 'Santa Clara', enrollment: 15000, perPupil: 10200 },
  { id: '0752394', name: 'Milpitas Unified', county: 'Santa Clara', enrollment: 11000, perPupil: 10800 },
  { id: '0752402', name: 'Campbell Union', county: 'Santa Clara', enrollment: 6500, perPupil: 11200 },
  { id: '0163022', name: 'Stockton Unified', county: 'San Joaquin', enrollment: 38000, perPupil: 13100 },
  { id: '0164699', name: 'Modesto City', county: 'Stanislaus', enrollment: 32000, perPupil: 11400 },
  { id: '0163030', name: 'Lodi Unified', county: 'San Joaquin', enrollment: 31000, perPupil: 10200 },
  { id: '0168302', name: 'San Bernardino City Unified', county: 'San Bernardino', enrollment: 53000, perPupil: 12800 },
]

const CA_COUNTIES = [...new Set(CA_DISTRICTS.map(d => d.county))].sort()

export default function SettingsPage() {
  const [selectedDistrict, setSelectedDistrict] = useState('0622710')
  const [search, setSearch] = useState('')
  const [county, setCounty] = useState('All')
  const [saved, setSaved] = useState(false)
  const [activeTab, setActiveTab] = useState<'district'|'users'|'support'>('district')

  const [users] = useState([
    { name: 'Superintendent', email: 'superintendent@srvusd.net', role: 'superintendent', status: 'Active' },
    { name: 'Finance Director', email: 'finance@srvusd.net', role: 'finance_director', status: 'Active' },
    { name: 'Asst. Superintendent', email: 'asst@srvusd.net', role: 'assistant_superintendent', status: 'Pending' },
  ])

  const filtered = CA_DISTRICTS.filter(d => {
    const matchSearch = d.name.toLowerCase().includes(search.toLowerCase())
    const matchCounty = county === 'All' || d.county === county
    return matchSearch && matchCounty
  })

  const current = CA_DISTRICTS.find(d => d.id === selectedDistrict)

  function saveSettings() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Configure your district, manage users, and get support</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {(['district', 'users', 'support'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors
              ${activeTab === tab ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {tab === 'district' ? 'District setup' : tab === 'users' ? 'Users (5 max)' : 'Email support'}
          </button>
        ))}
      </div>

      {/* District Tab */}
      {activeTab === 'district' && (
        <div className="space-y-5">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Select your California school district</h2>

            <div className="flex gap-3 mb-4">
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search district name..."
                className="flex-1 h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
              <select value={county} onChange={e => setCounty(e.target.value)}
                className="h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option>All</option>
                {CA_COUNTIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>

            <div className="max-h-64 overflow-y-auto border border-gray-100 rounded-lg">
              {filtered.map((d, i) => (
                <div key={d.id}
                  onClick={() => setSelectedDistrict(d.id)}
                  className={`flex items-center justify-between px-4 py-3 cursor-pointer text-sm border-b border-gray-50 last:border-0
                    ${selectedDistrict === d.id ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 
                      ${selectedDistrict === d.id ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300'}`}/>
                    <div>
                      <p className={`font-medium ${selectedDistrict === d.id ? 'text-indigo-700' : 'text-gray-900'}`}>{d.name}</p>
                      <p className="text-xs text-gray-400">{d.county} County</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-gray-500">{d.enrollment.toLocaleString()} students</p>
                    <p className="text-xs text-gray-400">${d.perPupil.toLocaleString()}/student</p>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="p-6 text-center text-sm text-gray-400">No districts found. Try a different search.</div>
              )}
            </div>
          </div>

          {current && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-indigo-900 mb-2">Selected: {current.name}</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-indigo-700">County</p>
                  <p className="text-sm font-medium text-indigo-900">{current.county}</p>
                </div>
                <div>
                  <p className="text-xs text-indigo-700">Enrollment</p>
                  <p className="text-sm font-medium text-indigo-900">{current.enrollment.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-indigo-700">Per-pupil funding</p>
                  <p className="text-sm font-medium text-indigo-900">${current.perPupil.toLocaleString()}</p>
                </div>
              </div>
            </div>
          )}

          <button onClick={saveSettings}
            className="w-full py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
            {saved ? '✓ Settings saved!' : 'Save district settings'}
          </button>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            Budget Planner plan includes up to <strong>5 users</strong>. You have {users.length} of 5 seats used.
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">User</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Role</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Status</th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={i} className="border-b border-gray-100 last:border-0">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-xs font-semibold">
                          {u.name[0]}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{u.name}</p>
                          <p className="text-xs text-gray-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-600 capitalize">{u.role.replace('_', ' ')}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                        ${u.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button className="text-xs text-gray-400 hover:text-red-500">Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {users.length < 5 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Invite a team member</h3>
              <div className="flex gap-3">
                <input placeholder="Email address" className="flex-1 h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                <select className="h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option>superintendent</option>
                  <option>finance_director</option>
                  <option>assistant_superintendent</option>
                  <option>viewer</option>
                </select>
                <button className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
                  Send invite
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Support Tab */}
      {activeTab === 'support' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Send us a message</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Subject</label>
                <select className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option>I need help with budget scenarios</option>
                  <option>Grant matcher question</option>
                  <option>How do I add more users?</option>
                  <option>I found a bug</option>
                  <option>I want to upgrade my plan</option>
                  <option>Billing question</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Message</label>
                <textarea rows={4} placeholder="Describe what you need help with..."
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"/>
              </div>
              <button
                onClick={() => {
                  const subject = (document.querySelector('select') as HTMLSelectElement)?.value || 'Support request'
                  const body = (document.querySelector('textarea') as HTMLTextAreaElement)?.value || ''
                  window.location.href = `mailto:scientiathrive@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
                }}
                className="w-full py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
                Send message — opens your email app
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-gray-900 mb-2">Email support</p>
              <p className="text-xs text-gray-500 mb-3">Included in all plans. We respond within 1 business day.</p>
              <a href="mailto:support@districtbudgetai.com"
                className="text-sm text-indigo-600 hover:underline font-medium">
                support@districtbudgetai.com
              </a>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-gray-900 mb-2">Quick start guide</p>
              <p className="text-xs text-gray-500 mb-3">Step-by-step guide to modeling your first budget scenario.</p>
              <button className="text-sm text-indigo-600 hover:underline font-medium">
                View guide →
              </button>
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-gray-900 mb-3">Frequently asked questions</p>
            {[
              { q: 'How do I model a budget scenario?', a: 'Go to Budget Scenarios → drag the sliders for staff reductions, class size increase, program cuts and site budget cuts. The financial impact and student outcome projections update in real time.' },
              { q: 'How accurate are the student outcome projections?', a: 'Projections are based on published EdResearch coefficients from RAND and NBER studies. They represent district-level averages and should be used as directional guidance, not precise predictions.' },
              { q: 'Can I add my own district\'s data?', a: 'Yes — go to Settings → District setup and select your district from the California district list. Your per-pupil funding, enrollment, and peer comparison data will update automatically.' },
              { q: 'How do I generate a board memo?', a: 'First save a budget scenario (type a name and click Save scenario). Once saved, the Generate board memo button activates. The AI writes a full professional memo in about 10 seconds.' },
            ].map((item, i) => (
              <div key={i} className={`py-3 ${i < 3 ? 'border-b border-gray-200' : ''}`}>
                <p className="text-sm font-medium text-gray-900 mb-1">{item.q}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
