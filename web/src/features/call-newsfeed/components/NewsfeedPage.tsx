'use client'

import { useNewsfeed } from '../hooks/useNewsfeed'
import { NewsfeedStats } from './NewsfeedStats'
import { NewsfeedFilters } from './NewsfeedFilters'
import { NewsfeedItem } from './NewsfeedItem'
import type { NewsfeedResponse } from '../types'

interface Props {
  initialData?: NewsfeedResponse
}

export function NewsfeedPage({ initialData }: Props) {
  const { calls, stats, filter, setFilter, isLoading, isLoadingMore, hasMore, loadMore, tagCall, addNote } =
    useNewsfeed({ initialData })

  return (
    <div className="space-y-6">
      {/* Live Indicator */}
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
        </span>
        <span className="text-xs font-medium text-green-600 dark:text-green-400">Live</span>
      </div>

      {/* Filters */}
      <NewsfeedFilters filter={filter} onChange={setFilter} stats={stats} />

      {/* Stats */}
      <NewsfeedStats stats={stats} />

      {/* Feed */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-blue-600" />
        </div>
      ) : calls.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-800">
          <div className="text-4xl">📞</div>
          <h3 className="mt-4 text-lg font-medium text-zinc-900 dark:text-white">
            {filter === 'all' ? 'No calls yet today' : 'No matching calls'}
          </h3>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {filter === 'all' ? 'Calls will appear here as they come in' : 'Try a different filter'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {calls.map((call) => (
            <NewsfeedItem
              key={call.id}
              call={call}
              onTag={(tag) => tagCall(call.id, tag)}
              onAddNote={(content) => addNote(call.id, content)}
            />
          ))}
          {hasMore && (
            <button
              onClick={loadMore}
              disabled={isLoadingMore}
              className="w-full rounded-lg border border-zinc-200 bg-white py-3 text-sm font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            >
              {isLoadingMore ? 'Loading...' : 'Load more'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
