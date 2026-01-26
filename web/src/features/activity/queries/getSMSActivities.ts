import type { SupabaseClient } from '@supabase/supabase-js'
import type { SMSActivity, ActivityFilters } from '../types'
import { toSMSActivity, type SMSMessageRow } from '../transforms'

interface QueryParams {
  companyId: string
  filters?: ActivityFilters
  cursor?: string
  limit: number
}

export async function getSMSActivities(
  supabase: SupabaseClient,
  { companyId, filters, cursor, limit }: QueryParams
): Promise<SMSActivity[]> {
  let query = supabase
    .from('sms_messages')
    .select(`
      id, direction, body, status, created_at, contact_id,
      contacts(id, first_name, last_name, phone)
    `)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (cursor) query = query.lt('created_at', cursor)
  if (filters?.dateFrom) query = query.gte('created_at', filters.dateFrom)
  if (filters?.dateTo) query = query.lte('created_at', filters.dateTo)
  if (filters?.contactId) query = query.eq('contact_id', filters.contactId)

  const { data } = await query
  return (data || []).map((row) => toSMSActivity(row as unknown as SMSMessageRow))
}
