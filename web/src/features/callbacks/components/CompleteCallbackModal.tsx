'use client'

import { useState } from 'react'
import { completeCallback } from '../actions/completeCallback'
import type { Callback } from '../types'

interface Props {
  isOpen: boolean
  callback: Callback | null
  onClose: () => void
  onSuccess: () => void
}

export function CompleteCallbackModal({ isOpen, callback, onClose, onSuccess }: Props) {
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!callback) return

    setLoading(true)
    setError(null)

    const result = await completeCallback({
      callbackId: callback.id,
      notes: notes.trim() || undefined,
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
    setNotes('')
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
          Complete Callback
        </h2>
        <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          {contactName} - {callback.contact.phone}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this callback..."
              rows={3}
              maxLength={1000}
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
              disabled={loading}
              className="flex-1 rounded-lg bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? 'Completing...' : 'Mark Complete'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
