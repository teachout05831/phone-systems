'use client'

import { useRouter } from 'next/navigation'
import { useCallHistory } from '../hooks/useCallHistory'
import { CallCard } from './CallCard'
import { FilterBar } from './FilterBar'
import { Pagination } from './Pagination'
import { CallDetailModal } from './CallDetailModal'
import type { CallHistoryResponse } from '../types'

interface HistoryPageProps {
  initialData: CallHistoryResponse
}

export function HistoryPage({ initialData }: HistoryPageProps) {
  const router = useRouter()
  const {
    calls,
    total,
    page,
    totalPages,
    filters,
    isLoading,
    selectedCall,
    isModalOpen,
    applyFilters,
    clearFilters,
    goToPage,
    openCallDetail,
    closeModal
  } = useCallHistory({ initialData })

  const handleCallAgain = (phoneNumber: string) => {
    router.push(`/call?number=${encodeURIComponent(phoneNumber)}`)
  }

  const handleExport = () => {
    const params = new URLSearchParams({
      date: filters.date,
      status: filters.status,
      outcome: filters.outcome,
      sort: filters.sort,
      ...(filters.search && { search: filters.search })
    })
    window.open(`/api/call-history/export?${params}`, '_blank')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            Call History
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {total} calls recorded
          </p>
        </div>
        <button
          onClick={handleExport}
          className="px-4 py-2 text-sm bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors"
        >
          Export
        </button>
      </div>

      {/* Filters */}
      <FilterBar
        filters={filters}
        onApply={applyFilters}
        onClear={clearFilters}
      />

      {/* Results Info */}
      <div className="flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-400">
        <span>
          Showing {calls.length} of {total} calls
        </span>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      )}

      {/* Empty State */}
      {!isLoading && calls.length === 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-12 dark:border-zinc-700 dark:bg-zinc-800 text-center">
          <svg className="w-12 h-12 mx-auto text-zinc-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
          <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-1">
            No calls found
          </h3>
          <p className="text-zinc-500 dark:text-zinc-400">
            Try adjusting your filters or make your first call
          </p>
        </div>
      )}

      {/* Call Cards */}
      {!isLoading && calls.length > 0 && (
        <div className="grid gap-4">
          {calls.map((call) => (
            <CallCard
              key={call.id}
              call={call}
              onViewDetails={openCallDetail}
              onCallAgain={handleCallAgain}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={goToPage}
        />
      )}

      {/* Call Detail Modal */}
      <CallDetailModal
        call={selectedCall}
        isOpen={isModalOpen}
        onClose={closeModal}
      />
    </div>
  )
}
