'use client'

import Link from 'next/link'
import { CallCard } from './CallCard'
import type { ActiveCallsListProps } from '../types'

export function ActiveCallsList({ calls, selectedCallId, onSelectCall }: ActiveCallsListProps) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800 p-4 flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="font-semibold text-zinc-900 dark:text-white">Active AI Calls</h2>
        <span className="px-2 py-0.5 text-xs font-medium bg-blue-500 text-white rounded-full">
          {calls.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        {calls.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-3 opacity-50">🤖</div>
            <p className="text-zinc-500 dark:text-zinc-400">No active AI calls</p>
            <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1">
              AI calls will appear here when agents start calling
            </p>
          </div>
        ) : (
          calls.map((call) => (
            <CallCard
              key={call.id}
              call={call}
              isSelected={call.id === selectedCallId}
              onSelect={() => onSelectCall(call.id)}
            />
          ))
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
        <Link
          href="/agent-queue"
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
        >
          📋 View Call Queue & History →
        </Link>
      </div>
    </div>
  )
}
