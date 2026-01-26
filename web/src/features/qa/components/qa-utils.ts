import type { QAIssueSeverity, QAIssueStatus, QAIssueType } from '../types'

export const severityConfig: Record<QAIssueSeverity, { bg: string; text: string; label: string }> = {
  critical: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', label: 'Critical' },
  high: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400', label: 'High' },
  medium: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', label: 'Medium' },
  low: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', label: 'Low' },
  info: { bg: 'bg-zinc-100 dark:bg-zinc-700', text: 'text-zinc-700 dark:text-zinc-400', label: 'Info' },
}

export const statusConfig: Record<QAIssueStatus, { bg: string; text: string; label: string }> = {
  open: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', label: 'Open' },
  acknowledged: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', label: 'Acknowledged' },
  in_progress: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', label: 'In Progress' },
  resolved: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', label: 'Resolved' },
  dismissed: { bg: 'bg-zinc-100 dark:bg-zinc-700', text: 'text-zinc-500 dark:text-zinc-400', label: 'Dismissed' },
}

export const typeLabels: Record<QAIssueType, string> = {
  console_error: 'Console Error',
  security_issue: 'Security',
  performance_issue: 'Performance',
  accessibility_issue: 'Accessibility',
  ux_issue: 'UX Issue',
  custom: 'Custom',
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
