import { createClient } from '@/lib/supabase/server'
import type { QAIssuesFilters, QAIssuesResponse, QAIssueRow } from '../types'
import { toQAIssue } from '../types'

const PAGE_SIZE = 20

export async function getQAIssues(
  filters: Partial<QAIssuesFilters> = {},
  page: number = 1
): Promise<QAIssuesResponse> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .single()

  if (!membership) throw new Error('No company membership')

  let query = supabase
    .from('qa_issues')
    .select('*', { count: 'exact' })
    .eq('company_id', membership.company_id)

  // Apply status filter
  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status)
  }

  // Apply issue type filter
  if (filters.issueType && filters.issueType !== 'all') {
    query = query.eq('issue_type', filters.issueType)
  }

  // Apply severity filter
  if (filters.severity && filters.severity !== 'all') {
    query = query.eq('severity', filters.severity)
  }

  // Apply page path filter
  if (filters.pagePath) {
    query = query.ilike('page_path', `%${filters.pagePath}%`)
  }

  // Apply search filter
  if (filters.search) {
    query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
  }

  // Order by last seen (most recent first)
  query = query.order('last_seen_at', { ascending: false })

  // Apply pagination
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  query = query.range(from, to)

  const { data, error, count } = await query

  if (error) throw error

  const total = count || 0

  return {
    issues: (data || []).map((row: QAIssueRow) => toQAIssue(row)),
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.ceil(total / PAGE_SIZE),
  }
}
