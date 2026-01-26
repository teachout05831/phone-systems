'use server'

import { createClient } from '@/lib/supabase/server'
import type { CancelCallbackInput, ActionResult } from '../types'

export async function cancelCallback(input: CancelCallbackInput): Promise<ActionResult> {
  const supabase = await createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Get user's company
  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (!membership) return { error: 'No company access' }

  // Validate input
  if (!input.callbackId || typeof input.callbackId !== 'string') {
    return { error: 'Callback ID is required' }
  }

  if (!input.reason || typeof input.reason !== 'string') {
    return { error: 'Cancellation reason is required' }
  }

  if (input.reason.length < 3) {
    return { error: 'Please provide a reason for cancellation' }
  }

  if (input.reason.length > 500) {
    return { error: 'Reason must be less than 500 characters' }
  }

  // Verify callback belongs to company and check current status
  const { data: callback } = await supabase
    .from('callbacks')
    .select('id, status, company_id')
    .eq('id', input.callbackId)
    .eq('company_id', membership.company_id)
    .single()

  if (!callback) return { error: 'Callback not found' }

  // Cannot cancel already completed or cancelled callbacks
  if (callback.status === 'completed') {
    return { error: 'Cannot cancel a completed callback' }
  }

  if (callback.status === 'cancelled') {
    return { error: 'Callback is already cancelled' }
  }

  // Update callback
  const { error } = await supabase
    .from('callbacks')
    .update({
      status: 'cancelled',
      notes: input.reason.trim(),
    })
    .eq('id', input.callbackId)

  if (error) {
    console.error('Cancel callback error:', error)
    return { error: 'Failed to cancel callback' }
  }

  return { success: true }
}
