'use server'

import { getNewsfeedCalls } from '../queries/getNewsfeedCalls'
import type { NewsfeedFilter, NewsfeedResponse, NewsfeedPagination } from '../types'

export async function fetchNewsfeedCalls(
  filter?: NewsfeedFilter,
  pagination?: NewsfeedPagination
): Promise<NewsfeedResponse> {
  return getNewsfeedCalls({
    filter,
    cursor: pagination?.cursor,
    limit: pagination?.limit || 20,
  })
}
