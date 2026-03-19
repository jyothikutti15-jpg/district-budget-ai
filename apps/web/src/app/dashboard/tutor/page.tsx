'use client'
import { useState, useRef, useEffect, useCallback } from 'react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface Message {
  id: string
  role: 'student' | 'tutor'
  content: string
  timestamp: Date
}

interface SessionState {
  sessionId: string | null
  concept: { conceptId: string; conceptName: string; code: string } | null
  isActive: boolean
}

// Demo mode — uses hardcoded student for UI testing
const DEMO_STUDENT = { id: 'demo-student-001', name: 'Arjun', gradeLevel: 5 }

export default function TutorPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [session, setSession] = useState<SessionState>({
    sessionId: null, concept: null, isActive: false,
  })
  const [isStreaming, setIsStreaming] = useState(false)
  const [subject, setSubject] = useState<'math' | 'ela'>('math')
  const [speakEnabled, setSpeakEnabled] = useState(false)
  const [startTime, setStartTime] = useState<number | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function speak(text: string) {
    if (!speakEnabled || !('speechSynthesis' in window)) return
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.95
    utterance.pitch = 1.05
    window.speechSynthesis.speak(utterance)
  }

  function addMessage(role: 'student' | 'tutor', content: string): string {
    const id = crypto.randomUUID()
    setMessages((prev) => [...prev, { id, role, content, timestamp: new Date() }])
    return id
  }

  async function startSession() {
    try {
      const res = await fetch(`${API_BASE}/api/tutor/sessions/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ studentId: DEMO_STUDENT.id, subject }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setSession({
        sessionId: data.data.sessionId,
        concept: data.data.concept,
        isActive: true,
      })
      addMessage('tutor', data.data.tutorMessage)
      speak(data.data.tutorMessage)
      inputRef.current?.focus()
    } catch (err) {
      addMessage('tutor', `Let's practice ${subject}! (Demo mode — configure API to connect)`)
      setSession({ sessionId: 'demo', concept: { conceptId: 'cn-010', conceptName: 'Fraction division', code: '5.NF.3' }, isActive: true })
    }
  }

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isStreaming || !session.isActive) return
    const studentMessage = input.trim()
    const responseTimeSecs = startTime ? (Date.now() - startTime) / 1000 : 0
    setInput('')
    setStartTime(null)
    addMessage('student', studentMessage)
    setIsStreaming(true)

    // Add empty tutor message that we'll fill via streaming
    const tutorMsgId = crypto.randomUUID()
    setMessages((prev) => [...prev, {
      id: tutorMsgId, role: 'tutor', content: '', timestamp: new Date()
    }])

    try {
      const res = await fetch(`${API_BASE}/api/tutor/sessions/${session.sessionId}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          studentMessage,
          studentId: DEMO_STUDENT.id,
          responseTimeSecs,
        }),
      })

      if (!res.ok) throw new Error('Stream failed')

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let fullResponse = ''

      while (reader) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') break
            try {
              const { token: tok } = JSON.parse(data)
              if (tok) {
                fullResponse += tok
                setMessages((prev) => prev.map((m) =>
                  m.id === tutorMsgId ? { ...m, content: fullResponse } : m
                ))
              }
            } catch {}
          }
        }
      }
      speak(fullResponse)
    } catch {
      // Demo mode fallback
      const demoResponses = [
        "Great thinking! You're on the right track. What happens when you flip the second fraction first?",
        "Not quite — let's try a different approach. If you have 3/4 ÷ 1/2, think of it as asking: how many halves fit in three-quarters?",
        "Excellent! You've got it! Now what do you think 2/3 ÷ 1/4 would be?",
      ]
      const demo = demoResponses[Math.floor(Math.random() * demoResponses.length)]
      let displayed = ''
      for (const char of demo) {
        await new Promise((r) => setTimeout(r, 20))
        displayed += char
        setMessages((prev) => prev.map((m) =>
          m.id === tutorMsgId ? { ...m, content: displayed } : m
        ))
      }
      speak(demo)
    } finally {
      setIsStreaming(false)
      inputRef.current?.focus()
    }
  }, [input, isStreaming, session, startTime, token])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
    if (!startTime) setStartTime(Date.now())
  }

  async function endSession() {
    if (session.sessionId && session.sessionId !== 'demo') {
      await fetch(`${API_BASE}/api/tutor/sessions/${session.sessionId}/end`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
    }
    setSession({ sessionId: null, concept: null, isActive: false })
    setMessages([])
  }

  return (
    <div className="max-w-3xl mx-auto">

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Hi, {DEMO_STUDENT.name}!
          </h1>
          {session.concept && (
            <p className="text-sm text-gray-500 mt-1">
              Practicing: <span className="font-medium text-brand-600">{session.concept.conceptName}</span>
              <span className="ml-2 text-gray-400">{session.concept.code}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Read aloud toggle */}
          <button
            onClick={() => setSpeakEnabled(!speakEnabled)}
            className={`btn-secondary text-xs py-1.5 px-3 ${speakEnabled ? 'bg-brand-50 border-brand-300 text-brand-700' : ''}`}
            title="Toggle read-aloud"
          >
            {speakEnabled ? 'Read aloud: on' : 'Read aloud: off'}
          </button>
          {session.isActive && (
            <button onClick={endSession} className="btn-secondary text-xs py-1.5 px-3">
              End session
            </button>
          )}
        </div>
      </div>

      {/* Pre-session state */}
      {!session.isActive && (
        <div className="card text-center py-12">
          <div className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Ready to practice?</h2>
          <p className="text-sm text-gray-500 mb-6">Your AI tutor will pick up right where you left off.</p>

          <div className="flex justify-center gap-3 mb-6">
            {(['math', 'ela'] as const).map((s) => (
              <button key={s} onClick={() => setSubject(s)}
                className={`px-5 py-2 rounded-lg text-sm font-medium border transition-colors
                  ${subject === s
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-brand-300'}`}>
                {s === 'math' ? 'Math' : 'Reading & Writing'}
              </button>
            ))}
          </div>

          <button onClick={startSession} className="btn-primary px-8 py-3 text-sm">
            Start practice session
          </button>
        </div>
      )}

      {/* Chat interface */}
      {session.isActive && (
        <div className="card p-0 overflow-hidden flex flex-col" style={{ height: '560px' }}>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'student' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'tutor' && (
                  <div className="w-7 h-7 bg-brand-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 mr-2">
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                )}
                <div className={`max-w-lg px-4 py-3 rounded-2xl text-sm leading-relaxed
                  ${msg.role === 'student'
                    ? 'bg-brand-600 text-white rounded-br-sm'
                    : 'bg-gray-100 text-gray-800 rounded-bl-sm'}`}>
                  {msg.content || (
                    <span className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-100 p-4 flex gap-3">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => { setInput(e.target.value); if (!startTime) setStartTime(Date.now()) }}
              onKeyDown={handleKeyDown}
              placeholder="Type your answer..."
              disabled={isStreaming}
              className="flex-1 input"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isStreaming}
              className="btn-primary px-4 disabled:opacity-40"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
