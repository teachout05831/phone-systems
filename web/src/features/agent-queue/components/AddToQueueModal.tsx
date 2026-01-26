'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { QueuePriority } from '../types'

interface ContactOption {
  id: string
  name: string
  phone: string
  businessName: string | null
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onSubmit: (contactIds: string[], priority?: QueuePriority, scheduledAt?: string) => Promise<{ success?: boolean; error?: string }>
}

export function AddToQueueModal({ isOpen, onClose, onSubmit }: Props) {
  const [contacts, setContacts] = useState<ContactOption[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [priority, setPriority] = useState<QueuePriority>(2)
  const [scheduledAt, setScheduledAt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (isOpen) fetchContacts()
  }, [isOpen])

  async function fetchContacts() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: membership } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (!membership) return

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

  function toggleContact(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (selectedIds.size === 0) return

    setLoading(true)
    setError(null)

    const result = await onSubmit(
      Array.from(selectedIds),
      priority,
      scheduledAt || undefined
    )

    setLoading(false)

    if (result.error) {
      setError(result.error)
    } else {
      handleClose()
    }
  }

  function handleClose() {
    setSelectedIds(new Set())
    setPriority(2)
    setScheduledAt('')
    setError(null)
    setSearchQuery('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-800 max-h-[90vh] overflow-hidden flex flex-col">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">
          Add to AI Queue
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          {/* Search */}
          <input
            type="text"
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="mb-3 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-700"
          />

          {/* Contact list */}
          <div className="flex-1 overflow-y-auto border border-zinc-200 rounded-lg dark:border-zinc-700 mb-4 min-h-[200px] max-h-[300px]">
            {filteredContacts.map(c => (
              <label
                key={c.id}
                className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-700 ${
                  selectedIds.has(c.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(c.id)}
                  onChange={() => toggleContact(c.id)}
                  className="h-4 w-4 rounded border-zinc-300"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-zinc-900 dark:text-white truncate">{c.name}</div>
                  <div className="text-sm text-zinc-500 truncate">{c.phone}</div>
                </div>
              </label>
            ))}
          </div>

          {/* Priority */}
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Priority
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPriority(1)}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
                  priority === 1
                    ? 'bg-red-600 text-white'
                    : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300'
                }`}
              >
                High
              </button>
              <button
                type="button"
                onClick={() => setPriority(2)}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
                  priority === 2
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300'
                }`}
              >
                Normal
              </button>
            </div>
          </div>

          {/* Schedule (optional) */}
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Schedule For (optional)
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-700"
            />
          </div>

          {error && (
            <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 rounded-lg bg-zinc-100 px-4 py-2 font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || selectedIds.size === 0}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Adding...' : `Add ${selectedIds.size} to Queue`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
