import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

interface Company {
  id: string
  name: string
  slug: string
  role: string
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Get user's companies
  const { data: memberships } = await supabase
    .from('company_members')
    .select('company_id, role, companies(id, name, slug)')
    .eq('user_id', user?.id)

  const companies: Company[] = (memberships || [])
    .map((m) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const company = m.companies as any
      if (!company || Array.isArray(company)) return null
      return {
        id: company.id as string,
        name: company.name as string,
        slug: company.slug as string,
        role: m.role as string,
      }
    })
    .filter((c): c is Company => c !== null)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Dashboard</h2>
        <p className="text-zinc-600 dark:text-zinc-400">Welcome to Outreach System</p>
      </div>

      {/* Companies Section */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Your Companies</h3>
          <Link
            href="/onboarding"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            + New Company
          </Link>
        </div>

        {companies.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {companies.map((company) => (
              <div
                key={company.id}
                className="rounded-lg border border-zinc-200 p-4 hover:border-blue-300 hover:bg-zinc-50 transition-colors cursor-pointer dark:border-zinc-600 dark:hover:border-blue-600 dark:hover:bg-zinc-700/50"
              >
                <h4 className="font-medium text-zinc-900 dark:text-white">{company.name}</h4>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Role: {company.role}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-700">
              <svg
                className="h-6 w-6 text-zinc-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </div>
            <p className="mb-2 text-zinc-600 dark:text-zinc-300">No companies yet</p>
            <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
              Create your first company to start managing contacts and agents.
            </p>
            <Link
              href="/onboarding"
              className="inline-block rounded-lg bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Create Your First Company
            </Link>
          </div>
        )}
      </div>

      {/* System Status */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
        <h3 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">System Status</h3>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-sm text-zinc-600 dark:text-zinc-400">Supabase Connected</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-sm text-zinc-600 dark:text-zinc-400">Authentication Active</span>
          </div>
        </div>
      </div>
    </div>
  )
}
