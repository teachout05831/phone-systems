'use client'

import type { QAIssuesFilters, QAIssueType, QAIssueSeverity, QAIssueStatus } from '../types'

interface Props {
  filters: Partial<QAIssuesFilters>
  onFilterChange: (filters: Partial<QAIssuesFilters>) => void
}

export function QAFilters({ filters, onFilterChange }: Props) {
  return (
    <div className="flex flex-wrap gap-4 items-center">
      <select
        value={filters.status || 'all'}
        onChange={(e) => onFilterChange({ status: e.target.value as QAIssueStatus | 'all' })}
        className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
      >
        <option value="all">All Statuses</option>
        <option value="open">Open</option>
        <option value="acknowledged">Acknowledged</option>
        <option value="in_progress">In Progress</option>
        <option value="resolved">Resolved</option>
        <option value="dismissed">Dismissed</option>
      </select>

      <select
        value={filters.severity || 'all'}
        onChange={(e) => onFilterChange({ severity: e.target.value as QAIssueSeverity | 'all' })}
        className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
      >
        <option value="all">All Severities</option>
        <option value="critical">Critical</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
        <option value="info">Info</option>
      </select>

      <select
        value={filters.issueType || 'all'}
        onChange={(e) => onFilterChange({ issueType: e.target.value as QAIssueType | 'all' })}
        className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
      >
        <option value="all">All Types</option>
        <option value="console_error">Console Errors</option>
        <option value="security_issue">Security</option>
        <option value="performance_issue">Performance</option>
        <option value="accessibility_issue">Accessibility</option>
        <option value="ux_issue">UX Issues</option>
      </select>

      <input
        type="text"
        placeholder="Search issues..."
        value={filters.search || ''}
        onChange={(e) => onFilterChange({ search: e.target.value })}
        className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white placeholder:text-zinc-400"
      />
    </div>
  )
}
