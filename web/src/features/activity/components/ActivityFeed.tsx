'use client'

import { useActivityFeed } from '../hooks'
import { ActivityItem } from './ActivityItem'
import { ActivityFilters } from './ActivityFilters'
import type { Activity } from '../types'

interface Props {
  initialActivities?: Activity[]
}

export function ActivityFeed({ initialActivities = [] }: Props) {
  const { activities, isLoading, isLoadingMore, hasMore, filters, setFilters, loadMore } =
    useActivityFeed({ initialActivities })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <ActivityFilters filters={filters} onChange={setFilters} />

      {activities.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-12 dark:border-zinc-700 dark:bg-zinc-800 text-center">
          <svg
            className="w-12 h-12 mx-auto text-zinc-400 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-1">No activity yet</h3>
          <p className="text-zinc-500 dark:text-zinc-400">
            Activities will appear here as calls, messages, and callbacks happen
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          <div className="relative">
            <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-zinc-200 dark:bg-zinc-700" />
            {activities.map((activity) => (
              <ActivityItem key={`${activity.type}-${activity.id}`} activity={activity} />
            ))}
          </div>

          {hasMore && (
            <button
              onClick={loadMore}
              disabled={isLoadingMore}
              className="w-full py-3 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50"
            >
              {isLoadingMore ? 'Loading...' : 'Load more'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
