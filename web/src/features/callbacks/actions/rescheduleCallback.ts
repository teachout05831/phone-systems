'use server'

import { createClient } from '@/lib/supabase/server'
import type { RescheduleCallbackInput, ActionResult } from '../types'

export async function rescheduleCallback(input: RescheduleCallbackInput): Promise<ActionResult> {
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

  if (!input.scheduledAt || typeof input.scheduledAt !== 'string') {
    return { error: 'New scheduled time is required' }
  }

  const scheduledDate = new Date(input.scheduledAt)
  if (isNaN(scheduledDate.getTime())) {
    return { error: 'Invalid date format' }
  }

  // Validate reason length
  if (input.reason && input.reason.length > 500) {
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

  // Cannot reschedule completed or cancelled callbacks
  if (callback.status === 'completed' || callback.status === 'cancelled') {
    return { error: 'Cannot reschedule a completed or cancelled callback' }
  }

  // Update callback
  const { error } = await supabase
    .from('callbacks')
    .update({
      scheduled_at: input.scheduledAt,
      status: 'rescheduled',
      reason: input.reason?.trim() || null,
    })
    .eq('id', input.callbackId)

  if (error) {
    console.error('Reschedule callback error:', error)
    return { error: 'Failed to reschedule callback' }
  }

  return { success: true }
}
