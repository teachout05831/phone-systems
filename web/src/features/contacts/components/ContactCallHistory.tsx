'use client'

import Link from 'next/link'
import type { ContactCall } from '../types'

interface ContactCallHistoryProps {
  calls: ContactCall[]
  onNewCall?: () => void
}

export function ContactCallHistory({ calls, onNewCall }: ContactCallHistoryProps) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
      <div className="flex items-center justify-between border-b border-zinc-200 p-4 dark:border-zinc-700">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
          Call History
        </h3>
        {onNewCall && (
          <button
            onClick={onNewCall}
            className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
          >
            New Call
          </button>
        )}
      </div>

      {calls.length === 0 ? (
        <div className="p-6 text-center text-zinc-500 dark:text-zinc-400">
          No calls yet.
        </div>
      ) : (
        <div className="divide-y divide-zinc-200 dark:divide-zinc-700">
          {calls.map((call) => (
            <CallItem key={call.id} call={call} />
          ))}
        </div>
      )}
    </div>
  )
}

interface CallItemProps {
  call: ContactCall
}

function CallItem({ call }: CallItemProps) {
  const isConnected = call.status === 'completed'
  const isMissed = call.status === 'no-answer' || call.status === 'busy'

  return (
    <div className="flex items-center gap-4 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-700/50">
      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${getCallIconStyle(call.status)}`}>
        {getCallIcon(call.direction, call.status)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-zinc-900 dark:text-white">
          {call.direction === 'outbound' ? 'Outbound' : 'Inbound'} Call - {formatOutcome(call.outcome || call.status)}
        </div>
        <div className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
          {call.durationSeconds !== null && (
            <span>{formatDuration(call.durationSeconds)}</span>
          )}
          <span>{formatDate(call.startedAt)}</span>
        </div>
      </div>
      <div className="flex gap-2">
        {call.recordingUrl && (
          <button
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
            title="Listen to recording"
          >
            Listen
          </button>
        )}
        <Link
          href={`/calls/${call.id}`}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          View
        </Link>
      </div>
    </div>
  )
}

function getCallIcon(direction: string, status: string): string {
  if (status === 'completed') return direction === 'outbound' ? '📲' : '📞'
  if (status === 'no-answer' || status === 'busy') return '📵'
  if (status === 'voicemail') return '📨'
  return '📞'
}

function getCallIconStyle(status: string): string {
  if (status === 'completed') return 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
  if (status === 'no-answer' || status === 'busy') return 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
  if (status === 'voicemail') return 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400'
  return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
}

function formatOutcome(outcome: string): string {
  return outcome.replace(/_/g, ' ').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}
