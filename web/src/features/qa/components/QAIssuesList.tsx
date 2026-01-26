'use client'

import type { QAIssue } from '../types'
import { severityConfig, statusConfig, typeLabels, formatDate } from './qa-utils'

interface Props {
  issues: QAIssue[]
  loading: boolean
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  onSelectIssue: (issue: QAIssue) => void
}

export function QAIssuesList({ issues, loading, page, totalPages, onPageChange, onSelectIssue }: Props) {
  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800 overflow-hidden">
        {issues.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-zinc-500 dark:text-zinc-400">No issues found</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-700">
            {issues.map((issue) => (
              <div
                key={issue.id}
                onClick={() => onSelectIssue(issue)}
                className="p-4 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${severityConfig[issue.severity].bg} ${severityConfig[issue.severity].text}`}>
                        {severityConfig[issue.severity].label}
                      </span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {typeLabels[issue.issueType]}
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusConfig[issue.status].bg} ${statusConfig[issue.status].text}`}>
                        {statusConfig[issue.status].label}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">{issue.title}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      {issue.pagePath} • {issue.occurrenceCount}x • Last seen {formatDate(issue.lastSeenAt)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-3 py-1 rounded border border-zinc-200 dark:border-zinc-700 disabled:opacity-50 text-sm"
          >
            Previous
          </button>
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 rounded border border-zinc-200 dark:border-zinc-700 disabled:opacity-50 text-sm"
          >
            Next
          </button>
        </div>
      )}
    </>
  )
}
