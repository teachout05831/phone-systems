'use server'

import { createClient } from '@/lib/supabase/server'
import type { ActionResult, QueuePriority } from '../types'

export async function updatePriority(
  itemId: string,
  priority: QueuePriority
): Promise<ActionResult> {
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

  // 3. Validate inputs
  if (!itemId || typeof itemId !== 'string') {
    return { error: 'Item ID is required' }
  }

  if (![1, 2].includes(priority)) {
    return { error: 'Priority must be 1 (high) or 2 (normal)' }
  }

  // 4. Update priority with company filter
  const { error } = await supabase
    .from('ai_queue')
    .update({ priority })
    .eq('id', itemId)
    .eq('company_id', membership.company_id)

  if (error) {
    console.error('Update priority error:', error)
    return { error: 'Failed to update priority' }
  }

  return { success: true }
}
