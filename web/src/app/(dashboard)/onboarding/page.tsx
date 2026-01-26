'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()

  const [companyName, setCompanyName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Generate slug from company name
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error('Not authenticated')
      }

      const slug = generateSlug(companyName)

      if (!slug) {
        throw new Error('Please enter a valid company name')
      }

      // Create the company
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .insert({
          name: companyName,
          slug: slug,
        })
        .select()
        .single()

      if (companyError) {
        if (companyError.code === '23505') {
          throw new Error('A company with this name already exists')
        }
        throw companyError
      }

      // Add user as owner of the company
      const { error: memberError } = await supabase.from('company_members').insert({
        company_id: company.id,
        user_id: user.id,
        role: 'owner',
      })

      if (memberError) {
        // Clean up the company if member creation fails
        await supabase.from('companies').delete().eq('id', company.id)
        throw memberError
      }

      // Redirect to dashboard
      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      console.error('Company creation error:', err)
      const errorMessage = err instanceof Error ? err.message : JSON.stringify(err)
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg py-12">
      <div className="rounded-xl border border-zinc-200 bg-white p-8 dark:border-zinc-700 dark:bg-zinc-800">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            Create Your Company
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Set up your first company to start managing contacts and agents.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="companyName"
              className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Company Name
            </label>
            <input
              id="companyName"
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
              className={cn(
                'w-full rounded-lg border border-zinc-300 px-4 py-2',
                'bg-white text-zinc-900',
                'focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20',
                'dark:border-zinc-600 dark:bg-zinc-800 dark:text-white'
              )}
              placeholder="Acme Cleaning Services"
            />
            {companyName && (
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Slug: {generateSlug(companyName) || '...'}
              </p>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !companyName.trim()}
            className={cn(
              'w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white',
              'hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'transition-colors'
            )}
          >
            {loading ? 'Creating...' : 'Create Company'}
          </button>
        </form>
      </div>
    </div>
  )
}
