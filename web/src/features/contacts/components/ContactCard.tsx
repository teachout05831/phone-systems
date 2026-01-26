'use client'

import Link from 'next/link'
import type { Contact } from '../types'

interface ContactCardProps {
  contact: Contact
  isSelected?: boolean
  onSelect?: () => void
  onCall?: () => void
  onAddToQueue?: () => void
}

export function ContactCard({
  contact,
  isSelected = false,
  onSelect,
  onCall,
  onAddToQueue,
}: ContactCardProps) {
  const displayName = contact.firstName || contact.lastName
    ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim()
    : 'No name'

  const initials = getInitials(contact.firstName, contact.lastName)

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-lg font-semibold text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <Link
            href={`/contacts/${contact.id}`}
            className="font-medium text-zinc-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-400"
          >
            {displayName}
          </Link>
          {contact.businessName && (
            <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
              {contact.businessName}
            </p>
          )}
        </div>
        <span className={`rounded-full px-2 py-1 text-xs font-medium ${getSourceStyle(contact.source)}`}>
          {formatSource(contact.source)}
        </span>
      </div>

      <div className="mt-3 space-y-1 text-sm text-zinc-600 dark:text-zinc-300">
        <p className="flex items-center gap-2">
          <span>📞</span>
          <span className="font-mono">{formatPhone(contact.phone)}</span>
        </p>
        {contact.email && (
          <p className="flex items-center gap-2 truncate">
            <span>✉️</span>
            <span>{contact.email}</span>
          </p>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3 dark:border-zinc-700">
        <span className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ${getStatusStyle(contact.status)}`}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {formatStatus(contact.status)}
        </span>
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          {onCall && (
            <button
              onClick={onCall}
              className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
            >
              📞
            </button>
          )}
          {onAddToQueue && (
            <button
              onClick={onAddToQueue}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            >
              + Queue
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function getInitials(firstName: string | null, lastName: string | null): string {
  const first = firstName?.charAt(0)?.toUpperCase() || ''
  const last = lastName?.charAt(0)?.toUpperCase() || ''
  return first + last || '?'
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
