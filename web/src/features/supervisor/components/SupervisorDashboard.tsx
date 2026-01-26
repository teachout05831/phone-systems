'use client'

import { useSupervisorDashboard } from '../hooks/useSupervisorDashboard'
import { MetricsPanel } from './MetricsPanel'
import { LiveCallsPanel } from './LiveCallsPanel'
import { Leaderboard } from './Leaderboard'
import type { SupervisorDashboardProps } from '../types'

export function SupervisorDashboard({
  initialMetrics,
  initialActiveCalls,
  initialLeaderboard,
}: SupervisorDashboardProps) {
  const {
    metrics,
    activeCalls,
    leaderboard,
    isRefreshing,
    lastUpdated,
    error,
    refresh,
  } = useSupervisorDashboard({
    initialMetrics,
    initialActiveCalls,
    initialLeaderboard,
    pollingInterval: 30000,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            Supervisor Dashboard
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {lastUpdated && `Last updated: ${lastUpdated.toLocaleTimeString()}`}
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={isRefreshing}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
        >
          {isRefreshing && (
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          )}
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <MetricsPanel metrics={metrics} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LiveCallsPanel activeCalls={activeCalls} />
        <Leaderboard entries={leaderboard} />
      </div>
    </div>
  )
}
