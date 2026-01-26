'use client'

import type { QAStats } from '../types'

interface Props {
  stats: QAStats
}

export function QAStatsCards({ stats }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase">Open Issues</p>
        <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">{stats.openIssues}</p>
      </div>
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-900/20">
        <p className="text-xs font-medium text-red-600 dark:text-red-400 uppercase">Critical</p>
        <p className="text-2xl font-bold text-red-700 dark:text-red-400 mt-1">{stats.criticalCount}</p>
      </div>
      <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 dark:border-orange-900 dark:bg-orange-900/20">
        <p className="text-xs font-medium text-orange-600 dark:text-orange-400 uppercase">High</p>
        <p className="text-2xl font-bold text-orange-700 dark:text-orange-400 mt-1">{stats.highCount}</p>
      </div>
      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase">Today</p>
        <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">{stats.todayCount}</p>
      </div>
      <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-900/20">
        <p className="text-xs font-medium text-green-600 dark:text-green-400 uppercase">Resolved (7d)</p>
        <p className="text-2xl font-bold text-green-700 dark:text-green-400 mt-1">{stats.resolvedThisWeek}</p>
      </div>
    </div>
  )
}
