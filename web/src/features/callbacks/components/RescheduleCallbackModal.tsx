'use client'

import { useState, useEffect } from 'react'
import { rescheduleCallback } from '../actions/rescheduleCallback'
import type { Callback } from '../types'

interface Props {
  isOpen: boolean
  callback: Callback | null
  onClose: () => void
  onSuccess: () => void
}

export function RescheduleCallbackModal({ isOpen, callback, onClose, onSuccess }: Props) {
  const [scheduledAt, setScheduledAt] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && callback) {
      // Pre-fill with current scheduled time + 1 hour
      const currentTime = new Date(callback.scheduled_at)
      const newTime = new Date(currentTime.getTime() + 60 * 60 * 1000)
      setScheduledAt(newTime.toISOString().slice(0, 16))
    }
  }, [isOpen, callback])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!callback || !scheduledAt) return

    setLoading(true)
    setError(null)

    const result = await rescheduleCallback({
      callbackId: callback.id,
      scheduledAt: new Date(scheduledAt).toISOString(),
      reason: reason.trim() || undefined,
    })

    setLoading(false)

    if (result.error) {
      setError(result.error)
    } else {
      onSuccess()
      handleClose()
    }
  }

  function handleClose() {
    setScheduledAt('')
    setReason('')
    setError(null)
    onClose()
  }

  if (!isOpen || !callback) return null

  const contactName = `${callback.contact.first_name} ${callback.contact.last_name}`.trim()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-800">
        <h2 className="mb-1 text-lg font-semibold text-zinc-900 dark:text-white">
          Reschedule Callback
        </h2>
        <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          {contactName} - {callback.contact.phone}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              New Date & Time
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              required
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-700"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Reason for rescheduling (optional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why are you rescheduling this callback?"
              rows={2}
              maxLength={500}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-700"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 rounded-lg bg-zinc-100 px-4 py-2 font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !scheduledAt}
              className="flex-1 rounded-lg bg-orange-600 px-4 py-2 font-medium text-white hover:bg-orange-700 disabled:opacity-50"
            >
              {loading ? 'Rescheduling...' : 'Reschedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
