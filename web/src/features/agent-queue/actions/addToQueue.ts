'use server'

import { createClient } from '@/lib/supabase/server'
import type { AddToQueueInput, ActionResult } from '../types'

export async function addToQueue(input: AddToQueueInput): Promise<ActionResult> {
  const supabase = await createClient()

  // 1. Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // 2. Get company
  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (!membership) return { error: 'No company access' }

  // 3. Validate inputs (Ralph Wiggum Loop)
  if (!input.contactIds || !Array.isArray(input.contactIds)) {
    return { error: 'Contact IDs must be an array' }
  }

  if (input.contactIds.length === 0) {
    return { error: 'At least one contact required' }
  }

  if (input.contactIds.length > 50) {
    return { error: 'Maximum 50 contacts per batch' }
  }

  // Validate priority
  if (input.priority !== undefined && ![1, 2].includes(input.priority)) {
    return { error: 'Invalid priority value' }
  }

  // Validate scheduled date if provided
  if (input.scheduledAt) {
    const scheduledDate = new Date(input.scheduledAt)
    if (isNaN(scheduledDate.getTime())) {
      return { error: 'Invalid scheduled date' }
    }
  }

  // 4. Verify contacts belong to company
  const { data: validContacts } = await supabase
    .from('contacts')
    .select('id')
    .in('id', input.contactIds)
    .eq('company_id', membership.company_id)
    .limit(50)

  if (!validContacts || validContacts.length === 0) {
    return { error: 'No valid contacts found' }
  }

  // 5. Check if any contacts are already in pending queue
  const { data: existing } = await supabase
    .from('ai_queue')
    .select('contact_id')
    .in('contact_id', validContacts.map(c => c.id))
    .in('status', ['pending', 'in_progress', 'retry_scheduled'])

  const existingIds = new Set(existing?.map(e => e.contact_id) || [])
  const newContacts = validContacts.filter(c => !existingIds.has(c.id))

  if (newContacts.length === 0) {
    return { error: 'All selected contacts are already in the queue' }
  }

  const items = newContacts.map(c => ({
    company_id: membership.company_id,
    contact_id: c.id,
    priority: input.priority || 2,
    scheduled_at: input.scheduledAt || null,
    status: 'pending',
    attempts: 0,
    max_attempts: 3,
  }))

  const { error } = await supabase.from('ai_queue').insert(items)

  if (error) {
    console.error('Add to queue error:', error)
    return { error: `Database error: ${error.message}` }
  }

  const skipped = validContacts.length - newContacts.length
  if (skipped > 0) {
    return { success: true, count: items.length, message: `Added ${items.length}, skipped ${skipped} already in queue` }
  }

  return { success: true, count: items.length }
}
