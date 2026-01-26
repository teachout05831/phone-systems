'use client'

import { useQADashboard } from '../hooks/useQADashboard'
import { QAStatsCards } from './QAStatsCards'
import { QAFilters } from './QAFilters'
import { QAIssuesList } from './QAIssuesList'
import { QAIssueModal } from './QAIssueModal'

export function QADashboard() {
  const {
    issues,
    stats,
    loading,
    page,
    totalPages,
    filters,
    selectedIssue,
    setPage,
    setSelectedIssue,
    updateFilters,
    updateStatus,
    refresh,
  } = useQADashboard()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">QA Dashboard</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Track and manage detected issues across your application
          </p>
        </div>
        <button
          onClick={refresh}
          className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
        >
          Refresh
        </button>
      </div>

      {stats && <QAStatsCards stats={stats} />}

      <QAFilters filters={filters} onFilterChange={updateFilters} />

      <QAIssuesList
        issues={issues}
        loading={loading}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        onSelectIssue={setSelectedIssue}
      />

      {selectedIssue && (
        <QAIssueModal
          issue={selectedIssue}
          onClose={() => setSelectedIssue(null)}
          onUpdateStatus={updateStatus}
        />
      )}
    </div>
  )
}
