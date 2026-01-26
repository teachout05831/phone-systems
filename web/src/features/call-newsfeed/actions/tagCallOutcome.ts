'use server'

import { createClient } from '@/lib/supabase/server'
import type { NewsfeedTag, CallOutcome } from '../types'

interface TagCallInput {
  callId: string
  tag: NewsfeedTag | null
}

interface ActionResult {
  success?: boolean
  error?: string
}

// Map UI tags to database outcome values
const tagToOutcome: Record<NewsfeedTag, CallOutcome> = {
  booked: 'booked',
  estimate: 'interested',
  question: 'callback',
  current_customer: 'no_outcome',
  not_interested: 'not_interested',
}

export async function tagCallOutcome(input: TagCallInput): Promise<ActionResult> {
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
  if (!input.callId || typeof input.callId !== 'string') {
    return { error: 'Call ID is required' }
  }

  // Validate tag if provided
  const validTags: NewsfeedTag[] = ['booked', 'estimate', 'question', 'current_customer', 'not_interested']
  if (input.tag !== null && !validTags.includes(input.tag)) {
    return { error: 'Invalid tag value' }
  }

  // Verify call belongs to company
  const { data: call } = await supabase
    .from('calls')
    .select('id')
    .eq('id', input.callId)
    .eq('company_id', membership.company_id)
    .single()

  if (!call) return { error: 'Call not found' }

  // Update call outcome
  const outcome = input.tag ? tagToOutcome[input.tag] : null
  const { error } = await supabase
    .from('calls')
    .update({ outcome, updated_at: new Date().toISOString() })
    .eq('id', input.callId)

  if (error) {
    console.error('tagCallOutcome error:', error)
    return { error: 'Failed to update call' }
  }

  return { success: true }
}
