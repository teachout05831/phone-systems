'use server'

import { getActivities } from '../queries'
import type { ActivityFilters, ActivityPagination, ActivityFeedResponse } from '../types'

export async function fetchActivities(
  filters?: ActivityFilters,
  pagination?: ActivityPagination
): Promise<ActivityFeedResponse> {
  try {
    return await getActivities(filters, pagination)
  } catch (error) {
    console.error('fetchActivities error:', error)
    return { activities: [], nextCursor: null, hasMore: false }
  }
}
