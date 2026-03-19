'use client'
import { useState } from 'react'

const deadlines = [
  { date: 'Mar 31, 2026', title: 'Second Interim Budget Report', category: 'State', urgent: true, description: 'Submit to County Office of Education. Must show positive certification or district faces state oversight.' },
  { date: 'Apr 1, 2026', title: 'E-Rate Form 471 deadline', category: 'Federal', urgent: true, description: 'File FCC Form 471 for broadband discounts. SRVUSD qualifies for ~$1.4M in annual discounts.' },
  { date: 'May 15, 2026', title: 'LCAP Annual Update due', category: 'State', urgent: false, description: 'Local Control and Accountability Plan update showing progress on goals and spending of LCFF funds.' },
  { date: 'Jun 15, 2026', title: 'Budget adoption deadline', category: 'State', urgent: false, description: 'Board must adopt the 2026-27 budget. Must show positive certification for all three years.' },
  { date: 'Jun 30, 2026', title: 'Parcel tax (Measure Q) expiry', category: 'Local', urgent: false, description: 'Current $144 annual parcel tax expires. Renewal requires 2/3 voter approval. ~$6.8M annual revenue at risk.' },
  { date: 'Jul 1, 2026', title: 'Title I, Part A allocation', category: 'Federal', urgent: false, description: 'New federal Title I allocation begins. Submit consolidated application to CDE to receive ~$2.1M.' },
  { date: 'Aug 1, 2026', title: 'IDEA Part B annual plan', category: 'Federal', urgent: false, description: 'Submit special education annual plan to CDE. Required to receive IDEA Part B passthrough funding.' },
  { date: 'Oct 1, 2026', title: 'California Healthy Kids Survey', category: 'State', urgent: false, description: 'Administer CHKS to students in grades 5, 7, 9, 11. Results used in LCAP and federal reporting.' },
  { date: 'Dec 15, 2026', title: 'First Interim Budget Report', category: 'State', urgent: false, description: 'First interim report to County Office. Shows actual vs. projected revenues and expenditures.' },
  { date: 'Jan 15, 2027', title: 'E-Rate Form 471 window opens', category: 'Federal', urgent: false, description: 'Annual E-Rate application window opens. Apply early for maximum discount on broadband services.' },
]

const categoryColors: Record<string, string> = {
  State:   'bg-blue-100 text-blue-800',
  Federal: 'bg-purple-100 text-purple-800',
  Local:   'bg-amber-100 text-amber-800',
}

export default function CompliancePage() {
  const [filter, setFilter] = useState('All')

  const filtered = filter === 'All' ? deadlines : deadlines.filter(d => d.category === filter)
  const urgentCount = deadlines.filter(d => d.urgent).length

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compliance calendar</h1>
          <p className="text-sm text-gray-500 mt-1">
            State, federal, and local deadlines for SRVUSD · FY 2025-26
          </p>
        </div>
        {urgentCount > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-center">
            <p className="text-xl font-bold text-red-700">{urgentCount}</p>
            <p className="text-xs text-red-600">due within 30 days</p>
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5">
        {['All', 'State', 'Federal', 'Local'].map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-xs px-4 py-1.5 rounded-full border font-medium transition-colors
              ${filter === f
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
            {f}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="space-y-3">
        {filtered.map((item) => (
          <div key={item.title}
            className={`border rounded-xl p-4 ${item.urgent ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${item.urgent ? 'bg-red-500' : 'bg-gray-300'}`}/>
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-semibold text-gray-900">{item.title}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${categoryColors[item.category]}`}>
                      {item.category}
                    </span>
                    {item.urgent && (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                        Urgent
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">{item.description}</p>
                </div>
              </div>
              <div className={`text-xs font-semibold flex-shrink-0 ${item.urgent ? 'text-red-700' : 'text-gray-500'}`}>
                {item.date}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
