'use client'

import type { StatsCardsProps } from '../types'

function formatDuration(seconds: number): string {
  if (!seconds) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function StatsCards({ stats }: StatsCardsProps) {
  const connectionRate = stats.totalCalls > 0
    ? Math.round((stats.connectedCalls / stats.totalCalls) * 100)
    : 0

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Total Calls */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-xl dark:bg-blue-900/30">
            <span role="img" aria-label="calls">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </span>
          </div>
          <div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-white">{stats.totalCalls}</div>
            <div className="text-sm text-zinc-500 dark:text-zinc-400">Total Calls</div>
          </div>
        </div>
        <div className={`mt-2 text-xs ${stats.callsTrend >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {stats.callsTrend >= 0 ? '+' : ''}{stats.callsTrend} vs yesterday
        </div>
      </div>

      {/* Connected */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-xl dark:bg-green-900/30">
            <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-white">{stats.connectedCalls}</div>
            <div className="text-sm text-zinc-500 dark:text-zinc-400">Connected</div>
          </div>
        </div>
        <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          {connectionRate}% connection rate
        </div>
      </div>

      {/* Missed */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 text-xl dark:bg-red-900/30">
            <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-white">{stats.missedCalls}</div>
            <div className="text-sm text-zinc-500 dark:text-zinc-400">Missed</div>
          </div>
        </div>
        <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          Requires follow-up
        </div>
      </div>

      {/* Avg Duration */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-xl dark:bg-purple-900/30">
            <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-white">{formatDuration(stats.avgDuration)}</div>
            <div className="text-sm text-zinc-500 dark:text-zinc-400">Avg Duration</div>
          </div>
        </div>
        <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          Per connected call
        </div>
      </div>
    </div>
  )
}
