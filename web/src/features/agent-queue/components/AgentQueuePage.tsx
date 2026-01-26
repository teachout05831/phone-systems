'use client'

import { useState } from 'react'
import { useAgentQueue } from '../hooks/useAgentQueue'
import { QueueStats } from './QueueStats'
import { QueueTable } from './QueueTable'
import { AddToQueueModal } from './AddToQueueModal'
import type { QueueItem, QueueStats as QueueStatsType } from '../types'

interface Props {
  initialItems: QueueItem[]
  initialStats: QueueStatsType
}

export function AgentQueuePage({ initialItems, initialStats }: Props) {
  const [showAddModal, setShowAddModal] = useState(false)

  const {
    items,
    stats,
    loading,
    error,
    selectedIds,
    filter,
    setFilter,
    refresh,
    addToQueue,
    removeFromQueue,
    updatePriority,
    dispatch,
    toggleSelect,
    selectAll,
  } = useAgentQueue({ initialItems, initialStats })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">AI Queue</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Manage contacts for AI agent calling
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add to Queue
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Stats */}
      <QueueStats stats={stats} />

      {/* Table */}
      <QueueTable
        items={items}
        selectedIds={selectedIds}
        filter={filter}
        onFilterChange={setFilter}
        onToggleSelect={toggleSelect}
        onSelectAll={selectAll}
        onDispatch={dispatch}
        onRemove={removeFromQueue}
        onPriorityChange={updatePriority}
      />

      {/* Add Modal */}
      <AddToQueueModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={addToQueue}
      />
    </div>
  )
}
