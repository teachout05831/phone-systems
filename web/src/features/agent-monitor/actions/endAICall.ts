'use server'

import { createClient } from '@/lib/supabase/server'

export async function endAICall(callId: string): Promise<{ success?: boolean; error?: string }> {
  if (!callId) return { error: 'Call ID is required' }

  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Get user's role and company
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // Role check - only admin/manager can end calls
  if (!profile || !['admin', 'manager'].includes(profile.role || '')) {
    return { error: 'Not authorized' }
  }

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (!membership) return { error: 'No company access' }

  // Verify call belongs to user's company and is active
  const { data: call } = await supabase
    .from('calls')
    .select('id, status')
    .eq('id', callId)
    .eq('company_id', membership.company_id)
    .single()

  if (!call) return { error: 'Call not found' }
  if (!['ringing', 'in_progress'].includes(call.status)) {
    return { error: 'Call is not active' }
  }

  // Update call to completed
  const { error } = await supabase
    .from('calls')
    .update({
      status: 'completed',
      ended_at: new Date().toISOString(),
    })
    .eq('id', callId)

  if (error) return { error: 'Failed to end call' }

  return { success: true }
}
