'use server'

import { createClient } from '@/lib/supabase/server'

interface ActionResult {
  success?: boolean
  error?: string
}

export async function removeTeamMember(memberId: string): Promise<ActionResult> {
  const supabase = await createClient()

  // Step 1: Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Step 2: Validate input
  if (!memberId || typeof memberId !== 'string') {
    return { error: 'Member ID is required' }
  }

  // Step 3: Get current user's membership and verify admin role
  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (!membership) return { error: 'No company access' }

  if (membership.role !== 'owner' && membership.role !== 'admin') {
    return { error: 'Only owners and admins can remove team members' }
  }

  // Step 4: Get the member to be removed
  const { data: targetMember } = await supabase
    .from('company_members')
    .select('id, user_id, role, company_id')
    .eq('id', memberId)
    .single()

  if (!targetMember) return { error: 'Member not found' }

  // Step 5: Verify same company
  if (targetMember.company_id !== membership.company_id) {
    return { error: 'Member not in your company' }
  }

  // Step 6: Prevent removing owner
  if (targetMember.role === 'owner') {
    return { error: 'Cannot remove the company owner' }
  }

  // Step 7: Prevent self-removal
  if (targetMember.user_id === user.id) {
    return { error: 'Cannot remove yourself' }
  }

  // Step 8: Remove member
  const { error } = await supabase
    .from('company_members')
    .delete()
    .eq('id', memberId)

  if (error) {
    console.error('Remove member error:', error)
    return { error: 'Failed to remove team member' }
  }

  return { success: true }
}
