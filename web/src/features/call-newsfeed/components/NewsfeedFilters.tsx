'use client'

import type { NewsfeedFilter, NewsfeedStats } from '../types'

interface Props {
  filter: NewsfeedFilter
  onChange: (filter: NewsfeedFilter) => void
  stats: NewsfeedStats
}

const filters: { value: NewsfeedFilter; label: string; countKey: keyof NewsfeedStats }[] = [
  { value: 'all', label: 'All', countKey: 'totalCalls' },
  { value: 'needs_action', label: 'Needs Action', countKey: 'needsAction' },
  { value: 'booked', label: 'Booked', countKey: 'booked' },
  { value: 'estimates', label: 'Estimates', countKey: 'estimates' },
  { value: 'missed', label: 'Missed', countKey: 'missed' },
]

export function NewsfeedFilters({ filter, onChange, stats }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {filters.map(({ value, label, countKey }) => (
        <button
          key={value}
          onClick={() => onChange(value)}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
            filter === value
              ? 'bg-blue-600 text-white'
              : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600'
          }`}
        >
          {label}
          <span
            className={`rounded-full px-1.5 py-0.5 text-xs ${
              filter === value ? 'bg-blue-500 text-white' : 'bg-zinc-200 dark:bg-zinc-600'
            }`}
          >
            {stats[countKey]}
          </span>
        </button>
      ))}
    </div>
  )
}
