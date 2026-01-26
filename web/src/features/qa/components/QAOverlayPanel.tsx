'use client'

import type { DetectedIssue } from '../hooks/useQADetection'
import type { QAIssueType, QAIssueSeverity } from '../types'

interface Props {
  issues: DetectedIssue[]
  isSyncing: boolean
  lastSync: Date | null
  unsyncedCount: number
  onSync: () => void
  onClearSynced: () => void
  onClose: () => void
}

function getTypeIcon(type: QAIssueType): string {
  const icons: Record<QAIssueType, string> = {
    console_error: '\u26A0',
    security_issue: '\u{1F512}',
    performance_issue: '\u23F1',
    accessibility_issue: '\u267F',
    ux_issue: '\u{1F441}',
    custom: '\u2139',
  }
  return icons[type] || '\u2139'
}

function getSeverityClasses(severity: QAIssueSeverity): string {
  const classes: Record<QAIssueSeverity, string> = {
    critical: 'border-red-700 bg-red-950/50',
    high: 'border-orange-700 bg-orange-950/50',
    medium: 'border-yellow-700 bg-yellow-950/50',
    low: 'border-blue-700 bg-blue-950/50',
    info: 'border-zinc-700 bg-zinc-800/50',
  }
  return classes[severity] || classes.info
}

function getSeverityBadgeClasses(severity: QAIssueSeverity): string {
  const classes: Record<QAIssueSeverity, string> = {
    critical: 'bg-red-600 text-white',
    high: 'bg-orange-600 text-white',
    medium: 'bg-yellow-600 text-black',
    low: 'bg-blue-600 text-white',
    info: 'bg-zinc-600 text-white',
  }
  return classes[severity] || classes.info
}

export function QAOverlayPanel({ issues, isSyncing, lastSync, unsyncedCount, onSync, onClearSynced, onClose }: Props) {
  return (
    <div className="fixed bottom-16 right-4 z-50 w-96 max-h-[70vh] overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl">
      <div className="flex items-center justify-between border-b border-zinc-700 px-4 py-3">
        <div>
          <h3 className="font-semibold text-white">QA Issues ({issues.length})</h3>
          {lastSync && <p className="text-xs text-zinc-500">Last sync: {lastSync.toLocaleTimeString()}</p>}
        </div>
        <div className="flex items-center gap-2">
          {unsyncedCount > 0 && (
            <button onClick={onSync} disabled={isSyncing} className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50">
              {isSyncing ? 'Syncing...' : `Sync (${unsyncedCount})`}
            </button>
          )}
          {issues.some(i => i.synced) && (
            <button onClick={onClearSynced} className="rounded px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-white">
              Clear synced
            </button>
          )}
          <button onClick={onClose} className="text-zinc-400 hover:text-white">✕</button>
        </div>
      </div>

      <div className="max-h-[calc(70vh-60px)] overflow-y-auto p-2">
        {issues.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">No issues detected on this page</p>
        ) : (
          <div className="space-y-2">
            {issues.map(issue => (
              <div key={issue.id} className={`rounded-lg border p-3 ${getSeverityClasses(issue.severity)} ${issue.synced ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm">
                    {getTypeIcon(issue.issueType)}{' '}
                    <span className="text-xs font-medium uppercase text-zinc-400">{issue.issueType.replace(/_/g, ' ')}</span>
                  </span>
                  <div className="flex items-center gap-1">
                    {issue.synced && <span className="text-xs text-green-500">✓</span>}
                    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${getSeverityBadgeClasses(issue.severity)}`}>{issue.severity}</span>
                  </div>
                </div>
                <p className="mt-1 text-sm text-white">{issue.title}</p>
                {issue.description && issue.description !== issue.title && (
                  <p className="mt-1 text-xs text-zinc-400 line-clamp-2">{issue.description}</p>
                )}
                <p className="mt-1 text-xs text-zinc-600">{issue.pagePath}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
