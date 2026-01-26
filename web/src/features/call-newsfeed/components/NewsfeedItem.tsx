'use client'

import type { NewsfeedCall, NewsfeedTag } from '../types'
import { QuickTagButtons } from './QuickTagButtons'
import { CallNoteInput } from './CallNoteInput'
import { AISummaryCard } from './AISummaryCard'
import { CallActions } from './CallActions'

interface Props {
  call: NewsfeedCall
  onTag: (tag: NewsfeedTag | null) => void
  onAddNote: (content: string) => Promise<{ success?: boolean; error?: string }>
}

const statusConfig: Record<string, { icon: string; label: string; bgClass: string; textClass: string }> = {
  completed: { icon: '✅', label: 'Connected', bgClass: 'bg-green-50 dark:bg-green-900/30', textClass: 'text-green-700 dark:text-green-400' },
  missed: { icon: '📵', label: 'Missed', bgClass: 'bg-red-50 dark:bg-red-900/30', textClass: 'text-red-700 dark:text-red-400' },
  no_answer: { icon: '📞', label: 'No Answer', bgClass: 'bg-zinc-100 dark:bg-zinc-700', textClass: 'text-zinc-600 dark:text-zinc-400' },
  voicemail: { icon: '📧', label: 'Voicemail', bgClass: 'bg-amber-50 dark:bg-amber-900/30', textClass: 'text-amber-700 dark:text-amber-400' },
}

function getBorderColor(call: NewsfeedCall): string {
  if (call.outcome === 'booked') return 'border-l-green-500'
  if (call.outcome === 'interested') return 'border-l-blue-500'
  if (call.outcome === 'callback') return 'border-l-purple-500'
  if (call.outcome === 'no_outcome') return 'border-l-cyan-500'
  if (call.outcome === 'not_interested') return 'border-l-zinc-400'
  if (call.status === 'missed') return 'border-l-red-500'
  if (call.status === 'no_answer') return 'border-l-zinc-400'
  return 'border-l-amber-500'
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
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins} min ago`
  if (diffHours < 24) return `${diffHours} hr ago`
  return date.toLocaleDateString()
}

export function NewsfeedItem({ call, onTag, onAddNote }: Props) {
  const status = statusConfig[call.status] || statusConfig.completed
  const borderColor = getBorderColor(call)
  const contactName = call.contact
    ? `${call.contact.firstName || ''} ${call.contact.lastName || ''}`.trim() || call.phoneNumber
    : call.phoneNumber

  return (
    <div className={`rounded-lg border border-l-4 bg-white p-4 transition-shadow hover:shadow-md dark:bg-zinc-800 ${borderColor}`}>
      {/* Header */}
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-full ${status.bgClass}`}>
            <span className="text-lg">{status.icon}</span>
          </div>
          <div>
            <div className="text-lg font-semibold text-zinc-900 dark:text-white">
              {formatPhoneNumber(contactName)}
            </div>
            <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
              <span>{formatRelativeTime(call.startedAt)}</span>
              {call.durationSeconds > 0 && <span>{formatDuration(call.durationSeconds)}</span>}
              {call.direction && <span className="capitalize">{call.direction}</span>}
            </div>
          </div>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status.bgClass} ${status.textClass}`}>
          {status.label}
        </span>
      </div>

      {/* Quick Tags */}
      <div className="mb-3">
        <QuickTagButtons currentOutcome={call.outcome} onTag={onTag} />
      </div>

      {/* AI Summary */}
      {call.aiSummary && (
        <div className="mb-3">
          <AISummaryCard summary={call.aiSummary} />
        </div>
      )}

      {/* Notes */}
      <div className="mb-3">
        <CallNoteInput notes={call.notes} onAddNote={onAddNote} />
      </div>

      {/* Actions */}
      <CallActions call={call} />
    </div>
  )
}
