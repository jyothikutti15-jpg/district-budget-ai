'use client'
import Sidebar from '@/components/ui/Sidebar'
import { useAuthStore } from '@/lib/auth-store'
import { useRouter } from 'next/navigation'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { email, clearAuth } = useAuthStore()
  const router = useRouter()

  function handleSignOut() {
    clearAuth()
    router.push('/')
  }

  const initials = email ? email[0].toUpperCase() : 'S'

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 ml-60 flex flex-col min-h-screen">

        {/* Top bar with sign out */}
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-8 flex-shrink-0">
          <p className="text-xs text-gray-400">
            San Ramon Valley USD · FY 2025-26
          </p>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-xs font-semibold">
                {initials}
              </div>
              <span className="text-xs text-gray-600 hidden sm:block">{email || 'Superintendent'}</span>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-600 border border-gray-200 hover:border-red-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
              </svg>
              Sign out
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-8 bg-gray-50">
          {children}
        </main>

      </div>
    </div>
  )
}
