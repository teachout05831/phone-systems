'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { scheduleCallback } from '../actions/scheduleCallback'
import type { ContactOption } from '../types'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  preselectedContactId?: string
}

export function ScheduleCallbackModal({ isOpen, onClose, onSuccess, preselectedContactId }: Props) {
  const [contacts, setContacts] = useState<ContactOption[]>([])
  const [selectedContactId, setSelectedContactId] = useState(preselectedContactId || '')
  const [scheduledAt, setScheduledAt] = useState('')
  const [priority, setPriority] = useState<'high' | 'normal' | 'low'>('normal')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (isOpen) {
      fetchContacts()
      // Set default datetime to 1 hour from now
      const defaultTime = new Date(Date.now() + 60 * 60 * 1000)
      setScheduledAt(defaultTime.toISOString().slice(0, 16))
    }
  }, [isOpen])

  useEffect(() => {
    if (preselectedContactId) setSelectedContactId(preselectedContactId)
  }, [preselectedContactId])

  async function fetchContacts() {
    const supabase = createClient()

    // Get user's company for security filtering
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: membership } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (!membership) return

    // Only fetch contacts from user's company
    const { data } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, phone, business_name')
      .eq('company_id', membership.company_id)
      .order('first_name')
      .limit(100)

    if (data) {
      setContacts(data.map(c => ({
        id: c.id,
        name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unknown',
        phone: c.phone,
        businessName: c.business_name,
      })))
    }
  }

  const filteredContacts = contacts.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.includes(searchQuery) ||
    c.businessName?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedContactId || !scheduledAt) return

    setLoading(true)
    setError(null)

    const result = await scheduleCallback({
      contactId: selectedContactId,
      scheduledAt: new Date(scheduledAt).toISOString(),
      priority,
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
    setSelectedContactId(preselectedContactId || '')
    setScheduledAt('')
    setPriority('normal')
    setReason('')
    setError(null)
    setSearchQuery('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-800">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">
          Schedule Callback
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Contact Search */}
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Contact
            </label>
            <input
              type="text"
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="mb-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-700"
            />
            <select
              value={selectedContactId}
              onChange={(e) => setSelectedContactId(e.target.value)}
              required
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-700"
            >
              <option value="">Select a contact</option>
              {filteredContacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} - {c.phone}
                </option>
              ))}
            </select>
          </div>

          {/* Date/Time */}
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Schedule For
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              required
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-700"
            />
          </div>

          {/* Priority */}
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Priority
            </label>
            <div className="flex gap-2">
              {(['low', 'normal', 'high'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium capitalize transition-colors ${
                    priority === p
                      ? p === 'high' ? 'bg-red-600 text-white'
                        : p === 'low' ? 'bg-zinc-600 text-white'
                        : 'bg-blue-600 text-white'
                      : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Reason (optional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why are you scheduling this callback?"
              rows={2}
              maxLength={500}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-700"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          {/* Actions */}
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
              disabled={loading || !selectedContactId || !scheduledAt}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Scheduling...' : 'Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
