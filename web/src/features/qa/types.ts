// QA Feature Types

export type QAIssueType =
  | 'console_error'
  | 'security_issue'
  | 'performance_issue'
  | 'accessibility_issue'
  | 'ux_issue'
  | 'custom'

export type QAIssueSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'

export type QAIssueStatus = 'open' | 'acknowledged' | 'in_progress' | 'resolved' | 'dismissed'

// App-level type (camelCase)
export interface QAIssue {
  id: string
  companyId: string
  pagePath: string
  issueType: QAIssueType
  severity: QAIssueSeverity
  title: string
  description: string | null
  details: Record<string, unknown>
  stackTrace: string | null
  userAgent: string | null
  viewportWidth: number | null
  viewportHeight: number | null
  status: QAIssueStatus
  reportedBy: string | null
  occurrenceCount: number
  firstSeenAt: string
  lastSeenAt: string
  createdAt: string
  updatedAt: string
}

// Database row type (snake_case)
export interface QAIssueRow {
  id: string
  company_id: string
  page_path: string
  issue_type: string
  severity: string
  title: string
  description: string | null
  details: Record<string, unknown>
  stack_trace: string | null
  user_agent: string | null
  viewport_width: number | null
  viewport_height: number | null
  status: string
  reported_by: string | null
  occurrence_count: number
  first_seen_at: string
  last_seen_at: string
  created_at: string
  updated_at: string
}

// Transform database row to app type
export function toQAIssue(row: QAIssueRow): QAIssue {
  return {
    id: row.id,
    companyId: row.company_id,
    pagePath: row.page_path,
    issueType: row.issue_type as QAIssueType,
    severity: row.severity as QAIssueSeverity,
    title: row.title,
    description: row.description,
    details: row.details,
    stackTrace: row.stack_trace,
    userAgent: row.user_agent,
    viewportWidth: row.viewport_width,
    viewportHeight: row.viewport_height,
    status: row.status as QAIssueStatus,
    reportedBy: row.reported_by,
    occurrenceCount: row.occurrence_count,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// Input for creating new issues (from overlay)
export interface CreateQAIssueInput {
  pagePath: string
  issueType: QAIssueType
  severity: QAIssueSeverity
  title: string
  description?: string
  details?: Record<string, unknown>
  stackTrace?: string
  userAgent?: string
  viewportWidth?: number
  viewportHeight?: number
}

// Filter options for dashboard
export interface QAIssuesFilters {
  status?: QAIssueStatus | 'all'
  issueType?: QAIssueType | 'all'
  severity?: QAIssueSeverity | 'all'
  pagePath?: string
  search?: string
}

// Response type for paginated issues
export interface QAIssuesResponse {
  issues: QAIssue[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// Stats for dashboard overview
export interface QAStats {
  openIssues: number
  criticalCount: number
  highCount: number
  todayCount: number
  resolvedThisWeek: number
  byType: Record<QAIssueType, number>
  bySeverity: Record<QAIssueSeverity, number>
}
