'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useContacts } from '../hooks/useContacts'
import { ContactList } from './ContactList'
import { ContactModal } from './ContactModal'
import { addToQueue } from '@/features/agent-queue/actions/addToQueue'
import type { Contact } from '../types'

interface ContactsPageProps {
  initialContacts: Contact[]
  initialCount: number
}

export function ContactsPage({ initialContacts, initialCount }: ContactsPageProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [isAddingToQueue, setIsAddingToQueue] = useState(false)
  const [queueError, setQueueError] = useState<string | null>(null)
  const [queueSuccess, setQueueSuccess] = useState<string | null>(null)

  const {
    contacts,
    totalCount,
    selectedIds,
    isLoading,
    error,
    handleCreate,
    handleDelete,
    handleBulkDelete,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
    isAllSelected,
    hasSelection,
  } = useContacts({ initialContacts, initialCount })

  async function handleAddToQueue() {
    if (selectedIds.size === 0) return
    setIsAddingToQueue(true)
    setQueueError(null)
    setQueueSuccess(null)

    const result = await addToQueue({ contactIds: Array.from(selectedIds) })

    setIsAddingToQueue(false)
    if (result.error) {
      setQueueError(result.error)
    } else {
      const msg = result.message || `Added ${result.count} contact${result.count !== 1 ? 's' : ''} to queue`
      setQueueSuccess(msg)
      clearSelection()
      setTimeout(() => setQueueSuccess(null), 3000)
    }
  }

  // Filter contacts client-side for instant feedback
  const filteredContacts = contacts.filter(contact => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const name = `${contact.firstName || ''} ${contact.lastName || ''}`.toLowerCase()
      const matches = name.includes(query) ||
        contact.phone.includes(query) ||
        contact.email?.toLowerCase().includes(query) ||
        contact.businessName?.toLowerCase().includes(query)
      if (!matches) return false
    }
    if (statusFilter && contact.status !== statusFilter) return false
    if (sourceFilter && contact.source !== sourceFilter) return false
    return true
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Contacts</h2>
          <p className="text-zinc-600 dark:text-zinc-400">
            Manage your leads and contacts
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/contacts/import"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            Import CSV
          </Link>
          <button
            onClick={() => setIsModalOpen(true)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Add Contact
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[250px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="text"
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 py-2 pl-10 pr-4 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
        >
          <option value="">All Statuses</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="engaged">Engaged</option>
          <option value="qualified">Qualified</option>
          <option value="closed_won">Closed Won</option>
          <option value="closed_lost">Closed Lost</option>
          <option value="do_not_contact">Do Not Contact</option>
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
        >
          <option value="">All Sources</option>
          <option value="facebook_ads">Facebook Ads</option>
          <option value="google_ads">Google Ads</option>
          <option value="website">Website</option>
          <option value="referral">Referral</option>
          <option value="cold_email">Cold Email</option>
          <option value="import">Import</option>
          <option value="manual">Manual</option>
        </select>
      </div>

      {/* Bulk Actions Bar */}
      {hasSelection && (
        <div className="flex items-center gap-4 rounded-lg bg-blue-600 px-4 py-3 text-white">
          <span className="font-medium">{selectedIds.size} selected</span>
          <button
            onClick={handleAddToQueue}
            disabled={isAddingToQueue}
            className="rounded bg-green-500 px-3 py-1.5 text-sm font-medium hover:bg-green-600 disabled:opacity-50"
          >
            {isAddingToQueue ? 'Adding...' : 'Add to Queue'}
          </button>
          <button
            onClick={handleBulkDelete}
            className="rounded bg-white/20 px-3 py-1.5 text-sm font-medium hover:bg-white/30"
          >
            Delete Selected
          </button>
          <button
            onClick={clearSelection}
            className="ml-auto text-sm hover:underline"
          >
            Clear Selection
          </button>
        </div>
      )}

      {/* Success/Error Messages */}
      {queueSuccess && (
        <div className="rounded-lg bg-green-50 p-4 text-green-600 dark:bg-green-900/20 dark:text-green-400">
          {queueSuccess}
        </div>
      )}
      {queueError && (
        <div className="rounded-lg bg-red-50 p-4 text-red-600 dark:bg-red-900/20 dark:text-red-400">
          Queue error: {queueError}
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Contacts Table */}
      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
        <ContactList
          contacts={filteredContacts}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          isAllSelected={isAllSelected}
          onDelete={handleDelete}
        />
      </div>

      {/* Pagination Info */}
      <div className="flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-400">
        <span>
          Showing {filteredContacts.length} of {totalCount} contacts
        </span>
      </div>

      {/* Add Contact Modal */}
      <ContactModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreate}
      />
    </div>
  )
}
