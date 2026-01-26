'use client'

import type { CallRecord } from '../types'

interface CallCardProps {
  call: CallRecord
  onViewDetails: (callId: string) => void
  onCallAgain: (phoneNumber: string) => void
}

function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 11 && cleaned[0] === '1') {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  }
  return phone
}

function formatDuration(seconds: number): string {
  if (!seconds) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

function getStatusBadge(status: string) {
  const styles: Record<string, string> = {
    completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    missed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    no_answer: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    busy: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    voicemail: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
  }
  return styles[status] || 'bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300'
}

function formatOutcome(outcome: string | null): string {
  if (!outcome) return ''
  const labels: Record<string, string> = {
    booked: 'Booked',
    callback: 'Callback',
    interested: 'Interested',
    not_interested: 'Not Interested',
    wrong_number: 'Wrong Number',
    do_not_call: 'Do Not Call',
    voicemail_left: 'Voicemail Left',
    no_outcome: 'No Outcome'
  }
  return labels[outcome] || outcome
}

export function CallCard({ call, onViewDetails, onCallAgain }: CallCardProps) {
  const contactName = call.contact
    ? `${call.contact.first_name || ''} ${call.contact.last_name || ''}`.trim() || 'Unknown'
    : 'Unknown'

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-zinc-900 dark:text-white">
            {contactName}
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 font-mono">
            {formatPhoneNumber(call.phone_number)}
          </p>
        </div>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {formatDateTime(call.started_at)}
        </span>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-3 mb-4 text-sm">
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(call.status)}`}>
          {call.status.replace('_', ' ')}
        </span>
        {call.duration_seconds > 0 && (
          <span className="text-zinc-600 dark:text-zinc-300 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {formatDuration(call.duration_seconds)}
          </span>
        )}
        {call.outcome && (
          <span className="text-zinc-600 dark:text-zinc-300">
            {formatOutcome(call.outcome)}
          </span>
        )}
        {call.has_recording && (
          <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            Recording
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {call.has_recording && (
          <button
            onClick={() => onViewDetails(call.id)}
            className="px-3 py-1.5 text-sm bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors"
          >
            View Details
          </button>
        )}
        <button
          onClick={() => onCallAgain(call.phone_number)}
          className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          Call Again
        </button>
      </div>
    </div>
  )
}
