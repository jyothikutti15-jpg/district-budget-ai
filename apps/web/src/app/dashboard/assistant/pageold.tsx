'use client'
import { useState, useRef, useEffect } from 'react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTED = [
  "What grants is SRVUSD eligible for right now?",
  "How does our per-pupil funding compare to peer districts?",
  "What happens to our reserve % if we cut 50 more positions?",
  "When is the next state budget deadline I need to prepare for?",
  "Draft talking points for the board about the $26M deficit",
  "What is the LCFF funding formula and how does it affect us?",
]



export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: "Hello! I'm your District Budget AI assistant. I know everything about SRVUSD's budget, your peer districts, grant opportunities, and California education finance. What would you like to know?"
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(text?: string) {
    const userText = text || input.trim()
    if (!userText || loading) return
    setInput('')

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: userText }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    const assistantId = (Date.now() + 1).toString()
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }])

    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content }))
        })
      })

      if (!response.ok) throw new Error('API error')

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let full = ''

      while (reader) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.token) {
                full += data.token
                setMessages(prev => prev.map(m =>
                  m.id === assistantId ? { ...m, content: full } : m
                ))
              }
            } catch {}
          }
        }
      }
    } catch {
      // Fallback demo responses
      const demoAnswers: Record<string, string> = {
        'grant': "Based on SRVUSD's profile, you qualify for: **Title I, Part A** (~$2.1M) — your 10.36% high-needs population exceeds the 5% threshold. **E-Rate** (~$1.4M) — your Chromebook fleet qualifies for broadband discounts. **IDEA Part B** (~$890K) — pass-through special education funding. **CA College Corps** (~$420K) — high-dosage tutoring with college student tutors. Total available: ~$4.81M. The E-Rate window opens January 2027 — start your Form 471 application now.",
        'per-pupil': "SRVUSD receives $8,685 per student — the lowest among your peer districts. Dublin USD receives $9,450 (+$765), Pleasanton USD receives $8,984 (+$299). The gap exists because LCFF weights districts with higher percentages of high-needs students, and SRVUSD's 10.36% rate is lower than neighboring districts. To increase per-pupil funding, focus on accurately identifying and reporting all qualifying high-needs students.",
        'reserve': "Currently at 3.2%, just above the state minimum of 3.0%. Cutting 50 more positions would save approximately $4.75M, which would improve your reserve to roughly 4.4% — meaningfully above the minimum. However, this must be weighed against projected academic impact. I'd recommend modeling this in the Budget Scenarios page to see the full student outcome projections.",
        'deadline': "Your most urgent deadline is **March 31, 2026** — the Second Interim Budget Report due to your County Office of Education. This must show positive certification. Missing this or showing negative certification triggers state oversight. After that: E-Rate Form 471 closes April 1, and LCAP Annual Update is due May 15.",
        'board': "Here are talking points for your board presentation:\n\n• SRVUSD faces a $26M structural deficit driven by declining enrollment (-615 students annually) and LCFF funding that doesn't keep pace with costs\n• We are one of the lowest-funded districts in Contra Costa County at $8,685/student vs. the county average of $9,200\n• The district has identified $4.81M in available federal and state grants not yet applied for\n• Three budget scenarios have been modeled, ranging from $14M to $26M in savings with varying student impact\n• The AI tutoring platform can offset instructional capacity losses at $42/student — far less than the $95,000 cost of a teacher position",
        'lcff': "The Local Control Funding Formula (LCFF) is California's school funding system. It gives every district a base grant per student (~$9,200 statewide average), then adds supplemental grants (20% more) for low-income, English learner, or foster youth students, and concentration grants (50% more) when those students exceed 55% of enrollment. SRVUSD's challenge: at 10.36% high-needs students, you receive minimal supplemental funding and zero concentration funding. Districts like Oakland USD (85% high-needs) receive significantly more per student despite similar costs."
      }

      const lower = userText.toLowerCase()
      let response = "That's a great question about SRVUSD's finances. Based on the district data I have access to, I can tell you that SRVUSD is facing a $26M deficit for FY 2025-26, with 27,805 students enrolled and $4.81M in matched grant opportunities available. For a more detailed answer, please ensure the API server is running at localhost:3001."

      for (const [key, answer] of Object.entries(demoAnswers)) {
        if (lower.includes(key)) { response = answer; break }
      }

      let i = 0
      const interval = setInterval(() => {
        i += 3
        setMessages(prev => prev.map(m =>
          m.id === assistantId ? { ...m, content: response.slice(0, i) } : m
        ))
        if (i >= response.length) clearInterval(interval)
      }, 20)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl flex flex-col" style={{ height: 'calc(100vh - 4rem)' }}>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Ask the AI</h1>
        <p className="text-sm text-gray-500 mt-1">
          Your superintendent-level AI assistant. Ask anything about the SRVUSD budget, grants, or California education finance.
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 min-h-0">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 bg-indigo-600 rounded-full flex items-center justify-center flex-shrink-0 mr-2 mt-0.5">
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                </svg>
              </div>
            )}
            <div className={`max-w-xl px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap
              ${msg.role === 'user'
                ? 'bg-indigo-600 text-white rounded-br-sm'
                : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'}`}>
              {msg.content || (
                <span className="flex gap-1 py-1">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}/>
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}/>
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}/>
                </span>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Suggested questions */}
      {messages.length <= 1 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {SUGGESTED.map((q) => (
            <button key={q} onClick={() => sendMessage(q)}
              className="text-xs px-3 py-1.5 bg-white border border-gray-200 rounded-full text-gray-600 hover:border-indigo-300 hover:text-indigo-700 transition-colors">
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-3 bg-white border border-gray-200 rounded-xl p-3">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          placeholder="Ask about budgets, grants, staffing, compliance..."
          disabled={loading}
          className="flex-1 text-sm outline-none bg-transparent"
        />
        <button
          onClick={() => sendMessage()}
          disabled={!input.trim() || loading}
          className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0 hover:bg-indigo-700 disabled:opacity-40 transition-colors">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
