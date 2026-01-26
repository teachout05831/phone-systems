import { createClient } from '@/lib/supabase/server'
import type { CallHistoryFilters, CallHistoryResponse, CallRecord } from '../types'

const PAGE_SIZE = 20

export async function getCallHistory(
  filters: Partial<CallHistoryFilters> = {},
  page: number = 1
): Promise<CallHistoryResponse> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .single()

  if (!membership) throw new Error('No company membership')

  let query = supabase
    .from('calls')
    .select(`
      id, external_call_id, direction, phone_number, status,
      duration_seconds, outcome, has_recording, recording_url,
      started_at, ended_at,
      contact:contacts(id, first_name, last_name, phone, business_name),
      rep:profiles!calls_rep_id_fkey(id, full_name)
    `, { count: 'exact' })
    .eq('company_id', membership.company_id)

  // Apply date filter
  if (filters.date && filters.date !== 'all') {
    const now = new Date()
    let startDate: Date

    switch (filters.date) {
      case 'today':
        startDate = new Date(now.setHours(0, 0, 0, 0))
        break
      case 'yesterday':
        startDate = new Date(now.setDate(now.getDate() - 1))
        startDate.setHours(0, 0, 0, 0)
        break
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7))
        break
      case 'month':
        startDate = new Date(now.setMonth(now.getMonth() - 1))
        break
      default:
        startDate = new Date(0)
    }
    query = query.gte('started_at', startDate.toISOString())
  }

  // Apply status filter
  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status)
  }

  // Apply outcome filter
  if (filters.outcome && filters.outcome !== 'all') {
    query = query.eq('outcome', filters.outcome)
  }

  // Apply search filter
  if (filters.search) {
    query = query.or(`phone_number.ilike.%${filters.search}%`)
  }

  // Apply sorting
  const sort = filters.sort || 'newest'
  switch (sort) {
    case 'oldest':
      query = query.order('started_at', { ascending: true })
      break
    case 'longest':
      query = query.order('duration_seconds', { ascending: false })
      break
    case 'shortest':
      query = query.order('duration_seconds', { ascending: true })
      break
    default:
      query = query.order('started_at', { ascending: false })
  }

  // Apply pagination
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  query = query.range(from, to)

  const { data, error, count } = await query

  if (error) throw error

  const total = count || 0

  return {
    calls: (data || []) as unknown as CallRecord[],
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.ceil(total / PAGE_SIZE)
  }
}
