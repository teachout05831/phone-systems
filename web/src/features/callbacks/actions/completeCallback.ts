'use server'

import { createClient } from '@/lib/supabase/server'
import type { CompleteCallbackInput, ActionResult } from '../types'

export async function completeCallback(input: CompleteCallbackInput): Promise<ActionResult> {
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

  // Validate notes length if provided
  if (input.notes && input.notes.length > 1000) {
    return { error: 'Notes must be less than 1000 characters' }
  }

  // Verify callback belongs to company and check current status
  const { data: callback } = await supabase
    .from('callbacks')
    .select('id, status, company_id, attempt_count')
    .eq('id', input.callbackId)
    .eq('company_id', membership.company_id)
    .single()

  if (!callback) return { error: 'Callback not found' }

  // Cannot complete already completed or cancelled callbacks
  if (callback.status === 'completed') {
    return { error: 'Callback is already completed' }
  }

  if (callback.status === 'cancelled') {
    return { error: 'Cannot complete a cancelled callback' }
  }

  // Update callback
  const { error } = await supabase
    .from('callbacks')
    .update({
      status: 'completed',
      notes: input.notes?.trim() || null,
      attempt_count: callback.attempt_count + 1,
    })
    .eq('id', input.callbackId)

  if (error) {
    console.error('Complete callback error:', error)
    return { error: 'Failed to complete callback' }
  }

  return { success: true }
}
