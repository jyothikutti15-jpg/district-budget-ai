'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [signupDone, setSignupDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      if (mode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        if (data.session) {
          localStorage.setItem('auth_token', data.session.access_token)
          localStorage.setItem('user_email', email)
        }
        router.push('/dashboard')
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setSignupDone(true)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      if (msg.includes('Invalid login credentials')) setError('Wrong email or password. Try again.')
      else if (msg.includes('Email not confirmed')) setError('Check your email and confirm your account first.')
      else if (msg.includes('User already registered')) { setError('Already registered. Try logging in.'); setMode('login') }
      else setError(msg)
    } finally {
      setLoading(false)
    }
  }

  if (signupDone) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{background:'linear-gradient(135deg,#1e1b4b,#4338ca,#6366f1)'}}>
        <div className="bg-white rounded-2xl p-10 w-full max-w-md text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Check your email</h2>
          <p className="text-sm text-gray-500 mb-6">Confirmation link sent to <strong>{email}</strong>. Click it then come back to log in.</p>
          <button onClick={() => { setMode('login'); setSignupDone(false) }} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700">Back to login</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{background:'linear-gradient(135deg,#1e1b4b,#4338ca,#6366f1)'}}>
      <div className="bg-white rounded-2xl p-10 w-full max-w-md">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10"/></svg>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">District Budget AI</h1>
            <p className="text-xs text-gray-400">San Ramon Valley USD</p>
          </div>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">{mode === 'login' ? 'Welcome back' : 'Create account'}</h2>
        <p className="text-sm text-gray-500 mb-6">{mode === 'login' ? 'Sign in to access the budget planning dashboard.' : 'Set up your administrator account.'}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Email address</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="superintendent@srvusd.net" required className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Password</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required minLength={8} className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
          </div>
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
          <button type="submit" disabled={loading||!email||!password} className="w-full py-3 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
        <div className="mt-5 text-center text-sm text-gray-500">
          {mode === 'login' ? (<>No account? <button onClick={()=>{setMode('signup');setError(null)}} className="text-indigo-600 font-medium hover:underline">Create one</button></>) : (<>Have an account? <button onClick={()=>{setMode('login');setError(null)}} className="text-indigo-600 font-medium hover:underline">Sign in</button></>)}
        </div>
        <p className="mt-6 text-xs text-center text-gray-400">FERPA-compliant · No Google account required</p>
      </div>
    </div>
  )
}
