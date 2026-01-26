'use client'

import type { QueueItem, QueuePriority } from '../types'

interface Props {
  item: QueueItem
  selected: boolean
  onSelect: () => void
  onDispatch: () => void
  onRemove: () => void
  onPriorityChange: (priority: QueuePriority) => void
}

export function QueueItemRow({
  item, selected, onSelect, onDispatch, onRemove, onPriorityChange,
}: Props) {
  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    cancelled: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300',
    retry_scheduled: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  }

  const canDispatch = ['pending', 'retry_scheduled'].includes(item.status)
  const canRemove = ['pending', 'retry_scheduled', 'cancelled'].includes(item.status)

  return (
    <tr className="border-b border-zinc-100 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          className="h-4 w-4 rounded border-zinc-300"
        />
      </td>
      <td className="px-4 py-3">
        <div className="font-medium text-zinc-900 dark:text-white">{item.contactName}</div>
        <div className="text-sm text-zinc-500">{item.phoneNumber}</div>
        {item.businessName && (
          <div className="text-xs text-zinc-400">{item.businessName}</div>
        )}
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[item.status]}`}>
          {item.status.replace('_', ' ')}
        </span>
      </td>
      <td className="px-4 py-3">
        <button
          onClick={() => onPriorityChange(item.priority === 1 ? 2 : 1)}
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
            item.priority === 1
              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300'
          }`}
        >
          {item.priority === 1 ? 'High' : 'Normal'}
        </button>
      </td>
      <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
        {item.attempts}/{item.maxAttempts}
      </td>
      <td className="px-4 py-3">
        {item.outcome && (
          <span className="text-sm text-zinc-600 dark:text-zinc-400 capitalize">
            {item.outcome.replace('_', ' ')}
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-zinc-500">
        {new Date(item.addedAt).toLocaleDateString()}
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-2">
          {canDispatch && (
            <button
              onClick={onDispatch}
              className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700"
            >
              Dispatch
            </button>
          )}
          {canRemove && (
            <button
              onClick={onRemove}
              className="rounded bg-zinc-200 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-600 dark:text-zinc-200"
            >
              Remove
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}
