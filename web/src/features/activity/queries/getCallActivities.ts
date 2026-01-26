import type { SupabaseClient } from '@supabase/supabase-js'
import type { CallActivity, ActivityFilters } from '../types'
import { toCallActivity, type CallRow } from '../transforms'

interface QueryParams {
  filters?: ActivityFilters
  cursor?: string
  limit: number
}

export async function getCallActivities(
  supabase: SupabaseClient,
  { filters, cursor, limit }: QueryParams
): Promise<CallActivity[]> {
  let query = supabase
    .from('calls')
    .select(`
      id, direction, phone_number, status, outcome, duration_seconds,
      started_at, contact_id,
      contacts(id, first_name, last_name, phone),
      rep:profiles!calls_rep_id_fkey(full_name)
    `)
    .order('started_at', { ascending: false })
    .limit(limit)

  if (cursor) query = query.lt('started_at', cursor)
  if (filters?.dateFrom) query = query.gte('started_at', filters.dateFrom)
  if (filters?.dateTo) query = query.lte('started_at', filters.dateTo)
  if (filters?.contactId) query = query.eq('contact_id', filters.contactId)

  const { data } = await query
  return (data || []).map((row) => toCallActivity(row as unknown as CallRow))
}
