import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LogoutButton } from '@/components/auth/logout-button'
import { CallProviderWrapper } from '@/components/calls/call-provider-wrapper'
import { QAProviderWrapper } from '@/components/qa/qa-provider-wrapper'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user profile with role for nav visibility
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, role')
    .eq('id', user.id)
    .single()

  const canAccessSupervisor = profile?.role === 'admin' || profile?.role === 'manager'

  return (
    <CallProviderWrapper>
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
        {/* Header */}
        <header className="border-b border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
            <div className="flex items-center gap-8">
              <Link href="/dashboard" className="text-xl font-bold text-zinc-900 dark:text-white">
                Outreach System
              </Link>
              <nav className="flex items-center gap-4">
                <Link
                  href="/dashboard"
                  className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                >
                  Dashboard
                </Link>
                <Link
                  href="/contacts"
                  className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                >
                  Contacts
                </Link>
                <Link
                  href="/call"
                  className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                >
                  Call
                </Link>
                <Link
                  href="/calls"
                  className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                >
                  History
                </Link>
                <Link
                  href="/callbacks"
                  className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                >
                  Callbacks
                </Link>
                <Link
                  href="/messages"
                  className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                >
                  Messages
                </Link>
                <Link
                  href="/activity"
                  className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                >
                  Activity
                </Link>
                <Link
                  href="/newsfeed"
                  className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                >
                  Newsfeed
                </Link>
                <Link
                  href="/pipeline"
                  className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                >
                  Pipeline
                </Link>
                <Link
                  href="/settings"
                  className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                >
                  Settings
                </Link>
                <Link
                  href="/agent-queue"
                  className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                >
                  AI Queue
                </Link>
                <Link
                  href="/agent-monitor"
                  className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                >
                  AI Monitor
                </Link>
                {canAccessSupervisor && (
                  <Link
                    href="/supervisor"
                    className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                  >
                    Supervisor
                  </Link>
                )}
                {canAccessSupervisor && (
                  <Link
                    href="/qa"
                    className="text-sm font-medium text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300"
                  >
                    QA
                  </Link>
                )}
              </nav>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                {profile?.full_name || profile?.email || user.email}
              </span>
              <LogoutButton />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="mx-auto max-w-7xl p-4">{children}</main>
      </div>
      <QAProviderWrapper />
    </CallProviderWrapper>
  )
}
