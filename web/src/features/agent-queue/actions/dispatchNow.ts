'use server'

import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '../types'

export async function dispatchNow(itemId: string): Promise<ActionResult> {
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

  // 3. Validate input
  if (!itemId || typeof itemId !== 'string') {
    return { error: 'Item ID is required' }
  }

  // 4. Verify item exists and is dispatchable
  const { data: item } = await supabase
    .from('ai_queue')
    .select('id, status, attempts, max_attempts')
    .eq('id', itemId)
    .eq('company_id', membership.company_id)
    .single()

  if (!item) return { error: 'Item not found' }

  if (!['pending', 'retry_scheduled'].includes(item.status)) {
    return { error: 'Item is not in a dispatchable state' }
  }

  if (item.attempts >= item.max_attempts) {
    return { error: 'Maximum attempts reached' }
  }

  // 5. Update status to in_progress
  const { error } = await supabase
    .from('ai_queue')
    .update({
      status: 'in_progress',
      last_attempt_at: new Date().toISOString(),
      attempts: item.attempts + 1,
    })
    .eq('id', itemId)
    .eq('company_id', membership.company_id)

  if (error) {
    console.error('Dispatch error:', error)
    return { error: 'Failed to dispatch' }
  }

  // Note: Actual AI call dispatch would be handled by a backend service
  // that listens for in_progress items and initiates calls

  return { success: true }
}
