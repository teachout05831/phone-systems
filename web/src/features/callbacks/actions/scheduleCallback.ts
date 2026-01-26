'use server'

import { createClient } from '@/lib/supabase/server'

interface ScheduleCallbackInput {
  contactId: string
  scheduledAt: string
  priority?: 'high' | 'normal' | 'low'
  reason?: string
}

interface ActionResult {
  success?: boolean
  error?: string
  callbackId?: string
}

export async function scheduleCallback(input: ScheduleCallbackInput): Promise<ActionResult> {
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
  if (!input.contactId || typeof input.contactId !== 'string') {
    return { error: 'Contact ID is required' }
  }

  if (!input.scheduledAt || typeof input.scheduledAt !== 'string') {
    return { error: 'Scheduled time is required' }
  }

  const scheduledDate = new Date(input.scheduledAt)
  if (isNaN(scheduledDate.getTime())) {
    return { error: 'Invalid date format' }
  }

  // Validate priority
  const validPriorities = ['high', 'normal', 'low']
  if (input.priority && !validPriorities.includes(input.priority)) {
    return { error: 'Invalid priority value' }
  }

  // Validate reason length
  if (input.reason && input.reason.length > 500) {
    return { error: 'Reason must be less than 500 characters' }
  }

  // Verify contact belongs to company
  const { data: contact } = await supabase
    .from('contacts')
    .select('id')
    .eq('id', input.contactId)
    .eq('company_id', membership.company_id)
    .single()

  if (!contact) return { error: 'Contact not found' }

  // Create callback
  const { data: callback, error } = await supabase
    .from('callbacks')
    .insert({
      contact_id: input.contactId,
      company_id: membership.company_id,
      assigned_to: user.id,
      scheduled_at: input.scheduledAt,
      priority: input.priority || 'normal',
      reason: input.reason?.trim() || null,
      status: 'scheduled',
      attempt_count: 0,
      max_attempts: 3,
    })
    .select('id')
    .single()

  if (error) {
    console.error('Schedule callback error:', error)
    return { error: 'Failed to schedule callback' }
  }

  return { success: true, callbackId: callback.id }
}
