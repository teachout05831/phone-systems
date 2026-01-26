'use client'

import type { QAIssue, QAIssueStatus } from '../types'
import { severityConfig, statusConfig, typeLabels, formatDate } from './qa-utils'

interface Props {
  issue: QAIssue
  onClose: () => void
  onUpdateStatus: (issueId: string, status: QAIssueStatus) => void
}

export function QAIssueModal({ issue, onClose, onUpdateStatus }: Props) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-zinc-800 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-700">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${severityConfig[issue.severity].bg} ${severityConfig[issue.severity].text}`}>
                  {severityConfig[issue.severity].label}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{typeLabels[issue.issueType]}</span>
              </div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{issue.title}</h2>
            </div>
            <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">✕</button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase mb-1">Page Path</p>
            <p className="text-sm text-zinc-900 dark:text-white font-mono">{issue.pagePath}</p>
          </div>

          {issue.description && (
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase mb-1">Description</p>
              <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">{issue.description}</p>
            </div>
          )}

          {issue.stackTrace && (
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase mb-1">Stack Trace</p>
              <pre className="text-xs text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-900 p-3 rounded-lg overflow-x-auto">
                {issue.stackTrace}
              </pre>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase mb-1">Occurrences</p>
              <p className="text-sm text-zinc-900 dark:text-white">{issue.occurrenceCount}x</p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase mb-1">First Seen</p>
              <p className="text-sm text-zinc-900 dark:text-white">{formatDate(issue.firstSeenAt)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase mb-1">Last Seen</p>
              <p className="text-sm text-zinc-900 dark:text-white">{formatDate(issue.lastSeenAt)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase mb-1">Status</p>
              <p className="text-sm text-zinc-900 dark:text-white">{statusConfig[issue.status].label}</p>
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-700">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase mb-2">Update Status</p>
            <div className="flex flex-wrap gap-2">
              {issue.status !== 'acknowledged' && (
                <button onClick={() => onUpdateStatus(issue.id, 'acknowledged')} className="px-3 py-1.5 text-sm rounded-lg bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400">
                  Acknowledge
                </button>
              )}
              {issue.status !== 'in_progress' && (
                <button onClick={() => onUpdateStatus(issue.id, 'in_progress')} className="px-3 py-1.5 text-sm rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400">
                  Mark In Progress
                </button>
              )}
              {issue.status !== 'resolved' && (
                <button onClick={() => onUpdateStatus(issue.id, 'resolved')} className="px-3 py-1.5 text-sm rounded-lg bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400">
                  Mark Resolved
                </button>
              )}
              {issue.status !== 'dismissed' && (
                <button onClick={() => onUpdateStatus(issue.id, 'dismissed')} className="px-3 py-1.5 text-sm rounded-lg bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300">
                  Dismiss
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
