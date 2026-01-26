import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { QAIssueStatus } from '@/features/qa/types'

interface UpdateIssueBody {
  status?: QAIssueStatus
  notes?: string
}

// PATCH: Update QA issue status (authenticated, admin/manager only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'Issue ID is required' }, { status: 400 })
    }

    const supabase = await createClient()

    // Auth check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Get membership and check role
    const { data: membership } = await supabase
      .from('company_members')
      .select('company_id, role')
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No company membership' }, { status: 403 })
    }

    // Only admin/manager can update issues
    if (!['admin', 'manager'].includes(membership.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body: UpdateIssueBody = await request.json()

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (body.status) {
      updateData.status = body.status

      // Set resolved_at if marking as resolved
      if (body.status === 'resolved') {
        updateData.resolved_at = new Date().toISOString()
      }
      // Set dismissed_at if marking as dismissed
      if (body.status === 'dismissed') {
        updateData.dismissed_at = new Date().toISOString()
      }
    }

    // Update the issue (RLS ensures company isolation)
    const { data: updated, error } = await supabase
      .from('qa_issues')
      .update(updateData)
      .eq('id', id)
      .eq('company_id', membership.company_id)
      .select('id, status')
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Issue not found' }, { status: 404 })
      }
      throw error
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating QA issue:', error)
    return NextResponse.json({ error: 'Failed to update QA issue' }, { status: 500 })
  }
}

// DELETE: Dismiss/delete QA issue
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'Issue ID is required' }, { status: 400 })
    }

    const supabase = await createClient()

    // Auth check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Get membership and check role
    const { data: membership } = await supabase
      .from('company_members')
      .select('company_id, role')
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No company membership' }, { status: 403 })
    }

    if (!['admin', 'manager'].includes(membership.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Soft delete by marking as dismissed
    const { error } = await supabase
      .from('qa_issues')
      .update({
        status: 'dismissed',
        dismissed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('company_id', membership.company_id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting QA issue:', error)
    return NextResponse.json({ error: 'Failed to delete QA issue' }, { status: 500 })
  }
}
