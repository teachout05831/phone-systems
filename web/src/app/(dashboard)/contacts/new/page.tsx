'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

export default function NewContactPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    business_name: '',
    job_title: '',
    notes: '',
    source: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Get user's company
      const { data: membership } = await supabase
        .from('company_members')
        .select('company_id')
        .limit(1)
        .single()

      if (!membership) {
        throw new Error('No company found. Please create a company first.')
      }

      // Validate phone
      if (!formData.phone.trim()) {
        throw new Error('Phone number is required')
      }

      // Create contact
      const { error: insertError } = await supabase.from('contacts').insert({
        company_id: membership.company_id,
        first_name: formData.first_name || null,
        last_name: formData.last_name || null,
        phone: formData.phone,
        email: formData.email || null,
        business_name: formData.business_name || null,
        job_title: formData.job_title || null,
        notes: formData.notes || null,
        source: formData.source || null,
        status: 'new',
      })

      if (insertError) {
        console.error('Insert error:', insertError)
        throw insertError
      }

      router.push('/contacts')
      router.refresh()
    } catch (err) {
      console.error('Error creating contact:', err)
      setError(err instanceof Error ? err.message : 'Failed to create contact')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Link
          href="/contacts"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          ← Back to Contacts
        </Link>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-8 dark:border-zinc-700 dark:bg-zinc-800">
        <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-white">Add New Contact</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name Row */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                First Name
              </label>
              <input
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                className={cn(
                  'w-full rounded-lg border border-zinc-300 px-4 py-2',
                  'bg-white text-zinc-900',
                  'focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20',
                  'dark:border-zinc-600 dark:bg-zinc-800 dark:text-white'
                )}
                placeholder="John"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Last Name
              </label>
              <input
                type="text"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                className={cn(
                  'w-full rounded-lg border border-zinc-300 px-4 py-2',
                  'bg-white text-zinc-900',
                  'focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20',
                  'dark:border-zinc-600 dark:bg-zinc-800 dark:text-white'
                )}
                placeholder="Doe"
              />
            </div>
          </div>

          {/* Phone - Required for Ralph to call */}
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Phone Number <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              required
              className={cn(
                'w-full rounded-lg border border-zinc-300 px-4 py-2',
                'bg-white text-zinc-900',
                'focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20',
                'dark:border-zinc-600 dark:bg-zinc-800 dark:text-white'
              )}
              placeholder="+1 (555) 123-4567"
            />
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Required for Ralph to make outbound calls
            </p>
          </div>

          {/* Email */}
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={cn(
                'w-full rounded-lg border border-zinc-300 px-4 py-2',
                'bg-white text-zinc-900',
                'focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20',
                'dark:border-zinc-600 dark:bg-zinc-800 dark:text-white'
              )}
              placeholder="john@example.com"
            />
          </div>

          {/* Business Info */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Business Name
              </label>
              <input
                type="text"
                name="business_name"
                value={formData.business_name}
                onChange={handleChange}
                className={cn(
                  'w-full rounded-lg border border-zinc-300 px-4 py-2',
                  'bg-white text-zinc-900',
                  'focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20',
                  'dark:border-zinc-600 dark:bg-zinc-800 dark:text-white'
                )}
                placeholder="Acme Inc"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Job Title
              </label>
              <input
                type="text"
                name="job_title"
                value={formData.job_title}
                onChange={handleChange}
                className={cn(
                  'w-full rounded-lg border border-zinc-300 px-4 py-2',
                  'bg-white text-zinc-900',
                  'focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20',
                  'dark:border-zinc-600 dark:bg-zinc-800 dark:text-white'
                )}
                placeholder="Owner"
              />
            </div>
          </div>

          {/* Lead Source */}
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Lead Source
            </label>
            <select
              name="source"
              value={formData.source}
              onChange={handleChange}
              className={cn(
                'w-full rounded-lg border border-zinc-300 px-4 py-2',
                'bg-white text-zinc-900',
                'focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20',
                'dark:border-zinc-600 dark:bg-zinc-800 dark:text-white'
              )}
            >
              <option value="">Select source...</option>
              <option value="facebook_ads">Facebook Ads</option>
              <option value="google_ads">Google Ads</option>
              <option value="cold_email">Cold Email</option>
              <option value="referral">Referral</option>
              <option value="website">Website</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              className={cn(
                'w-full rounded-lg border border-zinc-300 px-4 py-2',
                'bg-white text-zinc-900',
                'focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20',
                'dark:border-zinc-600 dark:bg-zinc-800 dark:text-white'
              )}
              placeholder="Any initial notes about this lead..."
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className={cn(
                'flex-1 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white',
                'hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50',
                'disabled:cursor-not-allowed disabled:opacity-50',
                'transition-colors'
              )}
            >
              {loading ? 'Creating...' : 'Create Contact'}
            </button>
            <Link
              href="/contacts"
              className="rounded-lg border border-zinc-300 px-4 py-2 font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
