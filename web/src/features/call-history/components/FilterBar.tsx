'use client'

import { useState } from 'react'
import type { CallHistoryFilters, DateFilter, CallStatus, CallOutcome, SortOption } from '../types'

interface FilterBarProps {
  filters: CallHistoryFilters
  onApply: (filters: Partial<CallHistoryFilters>) => void
  onClear: () => void
}

export function FilterBar({ filters, onApply, onClear }: FilterBarProps) {
  const [search, setSearch] = useState(filters.search)

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onApply({ search })
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
      <div className="flex flex-wrap gap-4 items-end">
        {/* Date Filter */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase">
            Date
          </label>
          <select
            value={filters.date}
            onChange={(e) => onApply({ date: e.target.value as DateFilter })}
            className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white text-sm"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
        </div>

        {/* Status Filter */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase">
            Status
          </label>
          <select
            value={filters.status}
            onChange={(e) => onApply({ status: e.target.value as CallStatus | 'all' })}
            className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white text-sm"
          >
            <option value="all">All</option>
            <option value="completed">Completed</option>
            <option value="missed">Missed</option>
            <option value="no_answer">No Answer</option>
            <option value="busy">Busy</option>
            <option value="voicemail">Voicemail</option>
          </select>
        </div>

        {/* Outcome Filter */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase">
            Outcome
          </label>
          <select
            value={filters.outcome}
            onChange={(e) => onApply({ outcome: e.target.value as CallOutcome | 'all' })}
            className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white text-sm"
          >
            <option value="all">All</option>
            <option value="booked">Booked</option>
            <option value="callback">Callback</option>
            <option value="interested">Interested</option>
            <option value="not_interested">Not Interested</option>
            <option value="no_outcome">No Outcome</option>
          </select>
        </div>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[200px]">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase">
              Search
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search phone number..."
                className="flex-1 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white text-sm placeholder:text-zinc-400"
              />
            </div>
          </div>
        </form>

        {/* Sort */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase">
            Sort By
          </label>
          <select
            value={filters.sort}
            onChange={(e) => onApply({ sort: e.target.value as SortOption })}
            className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white text-sm"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="longest">Longest Duration</option>
            <option value="shortest">Shortest Duration</option>
          </select>
        </div>

        {/* Clear Button */}
        <button
          onClick={onClear}
          className="px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
        >
          Clear
        </button>
      </div>
    </div>
  )
}
