'use client'

import { QueueItemRow } from './QueueItemRow'
import type { QueueItem, QueuePriority, QueueStatus } from '../types'

interface Props {
  items: QueueItem[]
  selectedIds: Set<string>
  filter: QueueStatus | 'all'
  onFilterChange: (filter: QueueStatus | 'all') => void
  onToggleSelect: (id: string) => void
  onSelectAll: () => void
  onDispatch: (id: string) => void
  onRemove: (id: string) => void
  onPriorityChange: (id: string, priority: QueuePriority) => void
}

export function QueueTable({
  items, selectedIds, filter, onFilterChange,
  onToggleSelect, onSelectAll, onDispatch, onRemove, onPriorityChange,
}: Props) {
  const filters: { value: QueueStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'failed', label: 'Failed' },
  ]

  return (
    <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
      {/* Filter tabs */}
      <div className="flex gap-2 border-b border-zinc-200 p-4 dark:border-zinc-700">
        {filters.map(f => (
          <button
            key={f.value}
            onClick={() => onFilterChange(f.value)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === f.value
                ? 'bg-blue-600 text-white'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-4 border-b border-zinc-200 bg-blue-50 px-4 py-2 dark:border-zinc-700 dark:bg-blue-900/20">
          <span className="text-sm text-blue-700 dark:text-blue-400">
            {selectedIds.size} selected
          </span>
          <button className="text-sm text-blue-600 hover:underline">Dispatch All</button>
          <button className="text-sm text-red-600 hover:underline">Remove All</button>
        </div>
      )}

      {/* Table */}
      {items.length === 0 ? (
        <div className="p-12 text-center">
          <div className="text-4xl mb-4">📋</div>
          <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-1">
            No items in queue
          </h3>
          <p className="text-zinc-500 dark:text-zinc-400">
            Add contacts to start AI calling
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr className="text-left text-sm text-zinc-500 dark:text-zinc-400">
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === items.length && items.length > 0}
                    onChange={onSelectAll}
                    className="h-4 w-4 rounded border-zinc-300"
                  />
                </th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Attempts</th>
                <th className="px-4 py-3">Outcome</th>
                <th className="px-4 py-3">Added</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <QueueItemRow
                  key={item.id}
                  item={item}
                  selected={selectedIds.has(item.id)}
                  onSelect={() => onToggleSelect(item.id)}
                  onDispatch={() => onDispatch(item.id)}
                  onRemove={() => onRemove(item.id)}
                  onPriorityChange={(p) => onPriorityChange(item.id, p)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
