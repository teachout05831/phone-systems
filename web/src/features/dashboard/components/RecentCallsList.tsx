'use client'

import Link from 'next/link'
import type { RecentCallsListProps, RecentCall } from '../types'

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

function formatDuration(seconds: number | null): string {
  if (!seconds) return '--'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function getStatusBadge(status: RecentCall['status']) {
  const styles: Record<string, string> = {
    connected: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    missed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    'no-answer': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    busy: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    voicemail: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  }
  return styles[status] || 'bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300'
}

function getStatusDot(status: RecentCall['status']) {
  const colors: Record<string, string> = {
    connected: 'bg-green-500',
    missed: 'bg-red-500',
    'no-answer': 'bg-yellow-500',
    busy: 'bg-orange-500',
    voicemail: 'bg-purple-500',
  }
  return colors[status] || 'bg-zinc-400'
}

export function RecentCallsList({ calls }: RecentCallsListProps) {
  if (calls.length === 0) {
    return (
      <div className="py-8 text-center">
        <svg className="w-12 h-12 mx-auto text-zinc-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
        <h3 className="text-sm font-medium text-zinc-900 dark:text-white mb-1">No calls yet</h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Your call history will appear here</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-zinc-100 dark:divide-zinc-700">
      {calls.map((call) => {
        const displayName = call.contact
          ? `${call.contact.first_name} ${call.contact.last_name}`.trim()
          : formatPhoneNumber(call.phone_number)
        const subText = call.contact ? formatPhoneNumber(call.phone_number) : null

        return (
          <div key={call.id} className="flex items-center justify-between py-3 px-4 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getStatusDot(call.status)}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {call.contact_id ? (
                    <Link
                      href={`/contacts/${call.contact_id}`}
                      className="font-medium text-zinc-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 truncate"
                    >
                      {displayName}
                    </Link>
                  ) : (
                    <span className="font-medium text-zinc-900 dark:text-white truncate">{displayName}</span>
                  )}
                  <span className="text-xs text-zinc-400">
                    {call.direction === 'inbound' ? '(in)' : '(out)'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {subText && <span>{subText}</span>}
                  <span>{formatTime(call.started_at)}</span>
                  <span>{formatDuration(call.duration)}</span>
                  <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${getStatusBadge(call.status)}`}>
                    {call.status}
                  </span>
                </div>
              </div>
            </div>
            <Link
              href={`/call?phone=${encodeURIComponent(call.phone_number)}`}
              className="flex-shrink-0 ml-2 p-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </Link>
          </div>
        )
      })}
    </div>
  )
}
