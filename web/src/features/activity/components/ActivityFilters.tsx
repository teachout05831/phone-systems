'use client'

import type { ActivityFilters as Filters, ActivityType } from '../types'

interface Props {
  filters: Filters
  onChange: (filters: Filters) => void
}

const activityTypes: { value: ActivityType; label: string }[] = [
  { value: 'call', label: 'Calls' },
  { value: 'sms', label: 'Messages' },
  { value: 'callback', label: 'Callbacks' },
]

export function ActivityFilters({ filters, onChange }: Props) {
  const selectedTypes = filters.types || []
  const isAllSelected = selectedTypes.length === 0

  const selectType = (type: ActivityType) => {
    onChange({ ...filters, types: [type] })
  }

  const selectAll = () => {
    onChange({ ...filters, types: undefined })
  }

  const isSelected = (type: ActivityType) => {
    return selectedTypes.length === 1 && selectedTypes[0] === type
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={selectAll}
        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
          isAllSelected
            ? 'bg-blue-600 text-white'
            : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600'
        }`}
      >
        All
      </button>
      {activityTypes.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => selectType(value)}
          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
            isSelected(value)
              ? 'bg-blue-600 text-white'
              : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
