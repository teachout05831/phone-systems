'use client'

import type { QueueStatus, QueuePriority } from '../types'

interface Props {
  status: QueueStatus
  priority: QueuePriority
  onDispatch: () => void
  onRemove: () => void
  onPriorityChange: (priority: QueuePriority) => void
  isLoading?: boolean
}

export function QueueItemActions({
  status,
  priority,
  onDispatch,
  onRemove,
  onPriorityChange,
  isLoading = false,
}: Props) {
  const canDispatch = ['pending', 'retry_scheduled'].includes(status)
  const canRemove = ['pending', 'retry_scheduled', 'cancelled'].includes(status)
  const canChangePriority = ['pending', 'retry_scheduled'].includes(status)

  return (
    <div className="flex items-center gap-2">
      {/* Priority Toggle */}
      {canChangePriority && (
        <button
          onClick={() => onPriorityChange(priority === 1 ? 2 : 1)}
          disabled={isLoading}
          className={`rounded-lg px-2 py-1 text-xs font-medium transition-colors ${
            priority === 1
              ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400'
              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-400'
          } disabled:opacity-50`}
          title={priority === 1 ? 'Set to Normal Priority' : 'Set to High Priority'}
        >
          {priority === 1 ? '🔴 High' : '⚪ Normal'}
        </button>
      )}

      {/* Dispatch Button */}
      {canDispatch && (
        <button
          onClick={onDispatch}
          disabled={isLoading}
          className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
          title="Start AI call now"
        >
          🚀 Dispatch
        </button>
      )}

      {/* Remove Button */}
      {canRemove && (
        <button
          onClick={onRemove}
          disabled={isLoading}
          className="flex items-center gap-1 rounded-lg bg-zinc-200 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-500 disabled:opacity-50 transition-colors"
          title="Remove from queue"
        >
          🗑️ Remove
        </button>
      )}

      {/* Status indicator for non-actionable items */}
      {!canDispatch && !canRemove && (
        <span className="text-xs text-zinc-400 italic">
          {status === 'in_progress' && 'Call in progress...'}
          {status === 'completed' && 'Completed'}
          {status === 'failed' && 'Failed'}
        </span>
      )}
    </div>
  )
}
