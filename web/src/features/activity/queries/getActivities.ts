import { createClient } from '@/lib/supabase/server'
import type { Activity, ActivityFilters, ActivityPagination, ActivityFeedResponse } from '../types'
import { getCallActivities } from './getCallActivities'
import { getSMSActivities } from './getSMSActivities'
import { getCallbackActivities } from './getCallbackActivities'

export async function getActivities(
  filters?: ActivityFilters,
  pagination?: ActivityPagination
): Promise<ActivityFeedResponse> {
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

  const limit = pagination?.limit || 20
  const cursor = pagination?.cursor
  const types = filters?.types || ['call', 'sms', 'callback']
  const fetchLimit = limit + 5
  const baseParams = { filters, cursor, limit: fetchLimit }

  // Build queries based on selected types
  const queries: Promise<Activity[]>[] = []
  if (types.includes('call')) queries.push(getCallActivities(supabase, baseParams))
  if (types.includes('sms')) queries.push(getSMSActivities(supabase, { ...baseParams, companyId: membership.company_id }))
  if (types.includes('callback')) queries.push(getCallbackActivities(supabase, baseParams))

  // Execute in parallel, merge, and sort
  const results = await Promise.all(queries)
  const allActivities = results
    .flat()
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  // Paginate
  const activities = allActivities.slice(0, limit)
  const hasMore = allActivities.length > limit
  const nextCursor = hasMore && activities.length > 0
    ? activities[activities.length - 1].timestamp
    : null

  return { activities, nextCursor, hasMore }
}
