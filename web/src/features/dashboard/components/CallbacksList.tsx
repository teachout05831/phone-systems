'use client'

import Link from 'next/link'
import type { CallbacksListProps, UpcomingCallback } from '../types'

function formatPhoneNumber(number: string): string {
  if (!number) return ''
  const cleaned = number.replace(/\D/g, '')
  if (cleaned.length === 11 && cleaned[0] === '1') {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  }
  return number
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function getPriorityBadge(priority: UpcomingCallback['priority']) {
  const styles: Record<string, string> = {
    high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    normal: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    low: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300',
  }
  return styles[priority] || styles.normal
}

export function CallbacksList({ callbacks, onCallNow }: CallbacksListProps) {
  if (callbacks.length === 0) {
    return (
      <div className="py-8 text-center">
        <svg className="w-12 h-12 mx-auto text-zinc-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <h3 className="text-sm font-medium text-zinc-900 dark:text-white mb-1">No callbacks scheduled</h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Scheduled callbacks will appear here</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {callbacks.map((callback) => {
        const contactName = `${callback.contact.first_name} ${callback.contact.last_name}`.trim()

        return (
          <div
            key={callback.id}
            className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                    {formatTime(callback.scheduled_at)}
                  </span>
                  <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${getPriorityBadge(callback.priority)}`}>
                    {callback.priority}
                  </span>
                </div>
                <Link
                  href={`/contacts/${callback.contact.id}`}
                  className="font-medium text-zinc-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 block truncate"
                >
                  {contactName}
                </Link>
                <div className="text-sm text-zinc-500 dark:text-zinc-400">
                  {formatPhoneNumber(callback.contact.phone)}
                </div>
                {callback.reason && (
                  <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-300 italic truncate">
                    &quot;{callback.reason}&quot;
                  </div>
                )}
              </div>
              <div className="flex-shrink-0 flex gap-2">
                <Link
                  href={`/call?contactId=${callback.contact.id}&phone=${encodeURIComponent(callback.contact.phone)}&callbackId=${callback.id}`}
                  onClick={() => onCallNow?.(callback)}
                  className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors"
                >
                  Call Now
                </Link>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
