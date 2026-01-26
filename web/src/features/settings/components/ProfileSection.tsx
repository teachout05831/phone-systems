'use client'

import { useState } from 'react'
import type { UserProfile, UpdateProfileInput } from '../types'

interface Props {
  profile: UserProfile
  onSave: (input: UpdateProfileInput) => Promise<boolean>
  isLoading: boolean
}

export function ProfileSection({ profile, onSave, isLoading }: Props) {
  const [fullName, setFullName] = useState(profile.fullName || '')
  const [phoneNumber, setPhoneNumber] = useState(profile.phoneNumber || '')
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setMessage(null)

    const success = await onSave({ fullName, phoneNumber })

    if (success) {
      setMessage({ type: 'success', text: 'Profile updated successfully' })
    } else {
      setMessage({ type: 'error', text: 'Failed to update profile' })
    }

    setIsSaving(false)
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
      <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">
        Profile Settings
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Email
          </label>
          <input
            type="email"
            value={profile.email}
            disabled
            className="w-full rounded-md border border-zinc-300 bg-zinc-100 px-3 py-2 text-sm text-zinc-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-400"
          />
          <p className="mt-1 text-xs text-zinc-500">Email cannot be changed</p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Full Name
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Enter your full name"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Phone Number
          </label>
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+1 (555) 000-0000"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Role
          </label>
          <input
            type="text"
            value={profile.role}
            disabled
            className="w-full rounded-md border border-zinc-300 bg-zinc-100 px-3 py-2 text-sm capitalize text-zinc-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-400"
          />
        </div>

        {message && (
          <p className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
            {message.text}
          </p>
        )}

        <button
          type="submit"
          disabled={isSaving || isLoading}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  )
}
