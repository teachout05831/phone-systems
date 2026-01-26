import { createClient } from '@/lib/supabase/server'
import type { QAStats, QAIssueType, QAIssueSeverity } from '../types'

export async function getQAStats(): Promise<QAStats> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .single()

  if (!membership) throw new Error('No company membership')

  // Get all open issues for stats
  const { data: issues, error } = await supabase
    .from('qa_issues')
    .select('id, issue_type, severity, status, created_at')
    .eq('company_id', membership.company_id)

  if (error) throw error

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const openIssues = issues?.filter(i => !['resolved', 'dismissed'].includes(i.status)) || []
  const resolvedThisWeek = issues?.filter(i =>
    i.status === 'resolved' && new Date(i.created_at) > weekAgo
  ).length || 0

  const byType: Record<QAIssueType, number> = {
    console_error: 0,
    security_issue: 0,
    performance_issue: 0,
    accessibility_issue: 0,
    ux_issue: 0,
    custom: 0,
  }

  const bySeverity: Record<QAIssueSeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  }

  openIssues.forEach(issue => {
    const type = issue.issue_type as QAIssueType
    const severity = issue.severity as QAIssueSeverity
    if (byType[type] !== undefined) byType[type]++
    if (bySeverity[severity] !== undefined) bySeverity[severity]++
  })

  return {
    openIssues: openIssues.length,
    criticalCount: bySeverity.critical,
    highCount: bySeverity.high,
    todayCount: issues?.filter(i => new Date(i.created_at) > todayStart).length || 0,
    resolvedThisWeek,
    byType,
    bySeverity,
  }
}
