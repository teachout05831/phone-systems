import type { SupabaseClient } from '@supabase/supabase-js'
import type { CallbackActivity, ActivityFilters } from '../types'
import { toCallbackActivity, type CallbackRow } from '../transforms'

interface QueryParams {
  filters?: ActivityFilters
  cursor?: string
  limit: number
}

export async function getCallbackActivities(
  supabase: SupabaseClient,
  { filters, cursor, limit }: QueryParams
): Promise<CallbackActivity[]> {
  let query = supabase
    .from('callbacks')
    .select(`
      id, scheduled_at, status, priority, reason, contact_id,
      contacts(id, first_name, last_name, phone)
    `)
    .order('scheduled_at', { ascending: false })
    .limit(limit)

  if (cursor) query = query.lt('scheduled_at', cursor)
  if (filters?.dateFrom) query = query.gte('scheduled_at', filters.dateFrom)
  if (filters?.dateTo) query = query.lte('scheduled_at', filters.dateTo)
  if (filters?.contactId) query = query.eq('contact_id', filters.contactId)

  const { data } = await query
  return (data || []).map((row) => toCallbackActivity(row as unknown as CallbackRow))
}
