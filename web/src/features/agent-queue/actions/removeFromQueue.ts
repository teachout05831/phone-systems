'use server'

import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '../types'

export async function removeFromQueue(itemId: string): Promise<ActionResult> {
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

  // 4. Verify item exists, belongs to company, and is removable
  const { data: item } = await supabase
    .from('ai_queue')
    .select('id, status')
    .eq('id', itemId)
    .eq('company_id', membership.company_id)
    .single()

  if (!item) return { error: 'Item not found' }

  // Only allow removing pending or retry_scheduled items
  if (!['pending', 'retry_scheduled', 'cancelled'].includes(item.status)) {
    return { error: 'Cannot remove item that is in progress or completed' }
  }

  // 5. Delete the item
  const { error } = await supabase
    .from('ai_queue')
    .delete()
    .eq('id', itemId)
    .eq('company_id', membership.company_id)

  if (error) {
    console.error('Remove from queue error:', error)
    return { error: 'Failed to remove from queue' }
  }

  return { success: true }
}
