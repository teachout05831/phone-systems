import { createClient } from '@/lib/supabase/server'
import type { NewsfeedFilter, NewsfeedResponse, NewsfeedCall } from '../types'
import { toNewsfeedCall, type NewsfeedCallRow } from '../transforms'
import { getNewsfeedStats } from './getNewsfeedStats'

interface QueryParams {
  filter?: NewsfeedFilter
  cursor?: string
  limit?: number
  dateFrom?: string
  dateTo?: string
}

export async function getNewsfeedCalls(params?: QueryParams): Promise<NewsfeedResponse> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (!membership) throw new Error('No company access')

  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const dateFrom = params?.dateFrom || startOfDay.toISOString()
  const dateTo = params?.dateTo || new Date().toISOString()
  const limit = Math.min(params?.limit || 20, 50)

  let query = supabase
    .from('calls')
    .select(`
      id, direction, phone_number, status, outcome, duration_seconds,
      started_at, contact_id, has_recording, ai_summary,
      contacts(id, first_name, last_name, phone),
      rep:profiles!calls_rep_id_fkey(full_name),
      call_notes(id, content, note_type, created_at, author:profiles!call_notes_author_id_fkey(full_name))
    `)
    .eq('company_id', membership.company_id)
    .in('status', ['completed', 'missed', 'no_answer', 'voicemail'])
    .gte('started_at', dateFrom)
    .lte('started_at', dateTo)
    .order('started_at', { ascending: false })
    .limit(limit + 1)

  if (params?.cursor) query = query.lt('started_at', params.cursor)
  if (params?.filter === 'needs_action') query = query.is('outcome', null).eq('status', 'completed')
  else if (params?.filter === 'booked') query = query.eq('outcome', 'booked')
  else if (params?.filter === 'estimates') query = query.eq('outcome', 'interested')
  else if (params?.filter === 'missed') query = query.in('status', ['missed', 'no_answer'])

  const { data, error } = await query
  if (error) throw new Error('Failed to fetch calls')

  const rows = (data || []) as unknown as NewsfeedCallRow[]
  const hasMore = rows.length > limit
  const calls: NewsfeedCall[] = rows.slice(0, limit).map(toNewsfeedCall)
  const nextCursor = hasMore && calls.length > 0 ? calls[calls.length - 1].startedAt : null
  const stats = await getNewsfeedStats(supabase, membership.company_id, dateFrom, dateTo)

  return { calls, stats, nextCursor, hasMore }
}
