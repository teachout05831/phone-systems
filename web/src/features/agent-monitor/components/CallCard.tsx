'use client'

import type { CallCardProps } from '../types'
import { formatDuration, formatPhoneNumber } from '../utils'

export function CallCard({ call, isSelected, onSelect }: CallCardProps) {
  const statusColors = {
    ringing: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    in_progress: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    completed: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400',
  }

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
        isSelected
          ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
          : 'border-transparent bg-zinc-50 hover:border-blue-300 dark:bg-zinc-700/50 dark:hover:border-blue-600'
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="font-medium text-zinc-900 dark:text-white">{call.contactName}</span>
        <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500 text-white">AI</span>
      </div>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">
        {formatPhoneNumber(call.phoneNumber)}
      </p>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
          {formatDuration(call.durationSeconds)}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[call.status]}`}>
          {call.status === 'in_progress' ? 'Connected' : call.status === 'ringing' ? 'Ringing' : 'Ended'}
        </span>
      </div>
    </button>
  )
}
