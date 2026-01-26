'use server'

import { createClient } from '@/lib/supabase/server'
import type { QueueItem, QueueItemRow, QueueStatus } from '../types'
import { toQueueItem } from '../types'

interface GetQueueItemsOptions {
  status?: QueueStatus | 'all'
  search?: string
}

export async function getQueueItems(
  options: GetQueueItemsOptions = {}
): Promise<QueueItem[]> {
  const supabase = await createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Get user's company
  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (!membership) throw new Error('No company access')

  // Build query with contact join
  let query = supabase
    .from('ai_queue')
    .select(`
      id,
      company_id,
      contact_id,
      status,
      priority,
      attempts,
      max_attempts,
      outcome,
      notes,
      scheduled_at,
      last_attempt_at,
      created_at,
      updated_at,
      contact:contacts!ai_queue_contact_id_fkey(
        id,
        first_name,
        last_name,
        phone,
        business_name
      )
    `)
    .eq('company_id', membership.company_id)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(100)

  // Apply status filter
  if (options.status && options.status !== 'all') {
    query = query.eq('status', options.status)
  }

  const { data, error } = await query

  if (error) throw error

  // Transform to app types
  return (data as unknown as QueueItemRow[]).map(toQueueItem)
}
