import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getQAIssues, getQAStats } from '@/features/qa/queries'
import type { QAIssuesFilters, CreateQAIssueInput } from '@/features/qa/types'

// GET: Fetch QA issues (authenticated)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Check if requesting stats
    if (searchParams.get('stats') === 'true') {
      const stats = await getQAStats()
      return NextResponse.json(stats)
    }

    const filters: Partial<QAIssuesFilters> = {
      status: (searchParams.get('status') as QAIssuesFilters['status']) || 'all',
      issueType: (searchParams.get('issueType') as QAIssuesFilters['issueType']) || 'all',
      severity: (searchParams.get('severity') as QAIssuesFilters['severity']) || 'all',
      pagePath: searchParams.get('pagePath') || undefined,
      search: searchParams.get('search') || '',
    }

    const page = parseInt(searchParams.get('page') || '1', 10)

    const data = await getQAIssues(filters, page)

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching QA issues:', error)
    const message = (error as Error).message
    const status = message === 'Not authenticated' ? 401 : 500
    return NextResponse.json({ error: message || 'Failed to fetch QA issues' }, { status })
  }
}

// POST: Create new QA issue (from overlay - semi-public in dev)
export async function POST(request: NextRequest) {
  try {
    const body: CreateQAIssueInput & { companyId?: string } = await request.json()

    // Validate required fields
    if (!body.pagePath || !body.issueType || !body.severity || !body.title) {
      return NextResponse.json(
        { error: 'Missing required fields: pagePath, issueType, severity, title' },
        { status: 400 }
      )
    }

    let companyId = body.companyId
    let userId: string | null = null

    // Try to get company from authenticated user
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      userId = user.id
      const { data: membership } = await supabase
        .from('company_members')
        .select('company_id')
        .eq('user_id', user.id)
        .single()

      if (membership) {
        companyId = membership.company_id
      }
    }

    // In development, allow submissions without company context for testing
    // The issue will be stored without company_id (or with a test company)
    if (!companyId && process.env.NODE_ENV !== 'development') {
      return NextResponse.json(
        { error: 'Could not determine company context' },
        { status: 400 }
      )
    }

    // Use admin client for insert (bypasses RLS)
    const adminClient = createAdminClient()

    // Try to find existing issue for deduplication
    let existingQuery = adminClient
      .from('qa_issues')
      .select('id, occurrence_count')
      .eq('page_path', body.pagePath)
      .eq('issue_type', body.issueType)
      .eq('title', body.title)
      .in('status', ['open', 'acknowledged', 'in_progress'])

    if (companyId) {
      existingQuery = existingQuery.eq('company_id', companyId)
    }

    const { data: existing } = await existingQuery.single()

    if (existing) {
      // Update occurrence count
      const { error: updateError } = await adminClient
        .from('qa_issues')
        .update({
          occurrence_count: existing.occurrence_count + 1,
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)

      if (updateError) throw updateError

      return NextResponse.json({ id: existing.id, deduplicated: true })
    }

    // Create new issue
    const insertData: Record<string, unknown> = {
      page_path: body.pagePath,
      issue_type: body.issueType,
      severity: body.severity,
      title: body.title,
      description: body.description || null,
      details: body.details || {},
      stack_trace: body.stackTrace || null,
      user_agent: body.userAgent || null,
      viewport_width: body.viewportWidth || null,
      viewport_height: body.viewportHeight || null,
      reported_by: userId,
    }

    if (companyId) {
      insertData.company_id = companyId
    }

    const { data: newIssue, error: insertError } = await adminClient
      .from('qa_issues')
      .insert(insertData)
      .select('id')
      .single()

    if (insertError) throw insertError

    return NextResponse.json({ id: newIssue.id, deduplicated: false }, { status: 201 })
  } catch (error) {
    console.error('Error creating QA issue:', error)
    return NextResponse.json({ error: 'Failed to create QA issue' }, { status: 500 })
  }
}
