'use client'

import { useState } from 'react'
import type { Company, UpdateCompanyInput, TeamRole } from '../types'

interface Props {
  company: Company
  memberRole: TeamRole
  onSave: (input: UpdateCompanyInput) => Promise<boolean>
  isLoading: boolean
}

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Phoenix', label: 'Arizona (No DST)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'UTC', label: 'UTC' },
]

export function CompanySection({ company, memberRole, onSave, isLoading }: Props) {
  const [name, setName] = useState(company.name)
  const [timezone, setTimezone] = useState(company.settings.timezone || 'America/New_York')
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const canEdit = memberRole === 'owner' || memberRole === 'admin'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canEdit) return

    setIsSaving(true)
    setMessage(null)

    const success = await onSave({ name, timezone })

    if (success) {
      setMessage({ type: 'success', text: 'Company settings updated' })
    } else {
      setMessage({ type: 'error', text: 'Failed to update company settings' })
    }

    setIsSaving(false)
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
      <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">
        Company Settings
      </h2>

      {!canEdit && (
        <p className="mb-4 text-sm text-amber-600 dark:text-amber-400">
          Only owners and admins can edit company settings
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Company Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!canEdit}
            placeholder="Enter company name"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-zinc-100 disabled:text-zinc-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Timezone
          </label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            disabled={!canEdit}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-zinc-100 disabled:text-zinc-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </div>

        {message && (
          <p className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
            {message.text}
          </p>
        )}

        {canEdit && (
          <button
            type="submit"
            disabled={isSaving || isLoading}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        )}
      </form>
    </div>
  )
}
