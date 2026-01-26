'use client'

import { useState } from 'react'
import type { NotificationSettings, UpdateNotificationsInput } from '../types'

interface Props {
  notifications: NotificationSettings
  onSave: (input: UpdateNotificationsInput) => Promise<boolean>
  isLoading: boolean
}

export function NotificationsSection({ notifications, onSave, isLoading }: Props) {
  const [settings, setSettings] = useState(notifications)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleToggle = async (key: keyof NotificationSettings) => {
    const newValue = !settings[key]
    setSettings((prev) => ({ ...prev, [key]: newValue }))
    setIsSaving(true)
    setMessage(null)

    const success = await onSave({ [key]: newValue })

    if (success) {
      setMessage({ type: 'success', text: 'Notification settings updated' })
    } else {
      // Revert on failure
      setSettings((prev) => ({ ...prev, [key]: !newValue }))
      setMessage({ type: 'error', text: 'Failed to update settings' })
    }

    setIsSaving(false)
    setTimeout(() => setMessage(null), 3000)
  }

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <button
      type="button"
      onClick={onChange}
      disabled={isSaving || isLoading}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-zinc-600'
      } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
      <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">
        Notification Preferences
      </h2>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-900 dark:text-white">Email Notifications</p>
            <p className="text-sm text-zinc-500">Receive updates via email</p>
          </div>
          <Toggle
            checked={settings.emailEnabled}
            onChange={() => handleToggle('emailEnabled')}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-900 dark:text-white">SMS Notifications</p>
            <p className="text-sm text-zinc-500">Receive updates via text message</p>
          </div>
          <Toggle
            checked={settings.smsEnabled}
            onChange={() => handleToggle('smsEnabled')}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-900 dark:text-white">Call Reminders</p>
            <p className="text-sm text-zinc-500">Get reminded about scheduled callbacks</p>
          </div>
          <Toggle
            checked={settings.callReminders}
            onChange={() => handleToggle('callReminders')}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-900 dark:text-white">Daily Digest</p>
            <p className="text-sm text-zinc-500">Receive a daily summary of activity</p>
          </div>
          <Toggle
            checked={settings.dailyDigest}
            onChange={() => handleToggle('dailyDigest')}
          />
        </div>

        {message && (
          <p className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
            {message.text}
          </p>
        )}
      </div>
    </div>
  )
}
