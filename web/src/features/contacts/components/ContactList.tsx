'use client'

import Link from 'next/link'
import type { Contact } from '../types'

interface ContactListProps {
  contacts: Contact[]
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onToggleSelectAll: () => void
  isAllSelected: boolean
  onDelete: (id: string) => void
  view?: 'table' | 'grid'
}

export function ContactList({
  contacts,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  isAllSelected,
  onDelete,
  view = 'table',
}: ContactListProps) {
  if (contacts.length === 0) {
    return (
      <div className="py-12 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-700">
          <svg className="h-6 w-6 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <p className="mb-2 text-zinc-600 dark:text-zinc-300">No contacts found</p>
        <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          Add your first contact to get started.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-700">
            <th className="w-10 px-4 py-3">
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={onToggleSelectAll}
                className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
              />
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Name
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Phone
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Business
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Source
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
          {contacts.map((contact) => (
            <ContactRow
              key={contact.id}
              contact={contact}
              isSelected={selectedIds.has(contact.id)}
              onToggleSelect={() => onToggleSelect(contact.id)}
              onDelete={() => onDelete(contact.id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface ContactRowProps {
  contact: Contact
  isSelected: boolean
  onToggleSelect: () => void
  onDelete: () => void
}

function ContactRow({ contact, isSelected, onToggleSelect, onDelete }: ContactRowProps) {
  const displayName = contact.firstName || contact.lastName
    ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim()
    : 'No name'

  return (
    <tr className="hover:bg-zinc-50 dark:hover:bg-zinc-700/50">
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          onClick={(e) => e.stopPropagation()}
          className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
        />
      </td>
      <td className="px-4 py-3">
        <Link href={`/contacts/${contact.id}`} className="block">
          <div className="font-medium text-zinc-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-400">
            {displayName}
          </div>
          {contact.email && (
            <div className="text-sm text-zinc-500 dark:text-zinc-400">
              {contact.email}
            </div>
          )}
        </Link>
      </td>
      <td className="px-4 py-3 font-mono text-sm text-zinc-600 dark:text-zinc-300">
        {formatPhone(contact.phone)}
      </td>
      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
        {contact.businessName || '-'}
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getSourceStyle(contact.source)}`}>
          {formatSource(contact.source)}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ${getStatusStyle(contact.status)}`}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {formatStatus(contact.status)}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-2">
          <Link
            href={`/contacts/${contact.id}`}
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            View
          </Link>
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (confirm('Are you sure you want to delete this contact?')) {
                onDelete()
              }
            }}
            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  )
}

function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  }
  return phone
}

function formatStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

function formatSource(source: string | null): string {
  if (!source) return 'Unknown'
  return source.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

function getStatusStyle(status: string): string {
  const styles: Record<string, string> = {
    new: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    contacted: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    engaged: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    qualified: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    closed_won: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    closed_lost: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    do_not_contact: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400',
  }
  return styles[status] || 'bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400'
}

function getSourceStyle(source: string | null): string {
  const styles: Record<string, string> = {
    facebook_ads: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    google_ads: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    website: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    referral: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    import: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
    manual: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400',
  }
  return styles[source || 'manual'] || 'bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400'
}
