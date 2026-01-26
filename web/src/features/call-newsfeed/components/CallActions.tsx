'use client'

import Link from 'next/link'
import type { NewsfeedCall } from '../types'

interface Props {
  call: NewsfeedCall
  onScheduleCallback?: () => void
}

export function CallActions({ call, onScheduleCallback }: Props) {
  const isMissed = call.status === 'missed' || call.status === 'no_answer'
  const callPageUrl = `/call?number=${encodeURIComponent(call.phoneNumber)}`
  const detailPageUrl = `/calls/${call.id}`

  return (
    <div className="flex items-center justify-between border-t border-zinc-100 pt-3 dark:border-zinc-700">
      <div className="flex gap-2">
        <Link
          href={callPageUrl}
          className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
        >
          📞 Call Back
        </Link>
        {call.hasRecording && (
          <Link
            href={detailPageUrl}
            className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
          >
            📄 Transcript
          </Link>
        )}
        {isMissed && onScheduleCallback && (
          <button
            onClick={onScheduleCallback}
            className="inline-flex items-center gap-1.5 rounded-md bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-200 dark:bg-amber-900/50 dark:text-amber-300 dark:hover:bg-amber-900/70"
          >
            📅 Schedule Callback
          </button>
        )}
      </div>
      <span className="text-xs text-zinc-400">
        {new Date(call.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
      </span>
    </div>
  )
}
