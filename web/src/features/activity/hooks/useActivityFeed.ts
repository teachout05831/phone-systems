'use client'

import { useState, useCallback } from 'react'
import { fetchActivities as fetchActivitiesAction } from '../actions'
import type { Activity, ActivityFilters } from '../types'

interface UseActivityFeedOptions {
  initialActivities?: Activity[]
  pageSize?: number
}

interface UseActivityFeedReturn {
  activities: Activity[]
  isLoading: boolean
  isLoadingMore: boolean
  error: string | null
  hasMore: boolean
  filters: ActivityFilters
  setFilters: (filters: ActivityFilters) => void
  loadMore: () => Promise<void>
  refresh: () => Promise<void>
}

export function useActivityFeed(options: UseActivityFeedOptions = {}): UseActivityFeedReturn {
  const { initialActivities = [], pageSize = 20 } = options

  const [activities, setActivities] = useState<Activity[]>(initialActivities)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [filters, setFiltersState] = useState<ActivityFilters>({})

  const doFetch = useCallback(
    async (currentFilters: ActivityFilters, cursorValue: string | null, append: boolean) => {
      try {
        const data = await fetchActivitiesAction(currentFilters, {
          cursor: cursorValue ?? undefined,
          limit: pageSize,
        })
        setActivities((prev) => (append ? [...prev, ...data.activities] : data.activities))
        setCursor(data.nextCursor)
        setHasMore(data.hasMore)
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error')
      }
    },
    [pageSize]
  )

  const setFilters = useCallback(
    (newFilters: ActivityFilters) => {
      setFiltersState(newFilters)
      setIsLoading(true)
      setCursor(null)
      doFetch(newFilters, null, false).finally(() => setIsLoading(false))
    },
    [doFetch]
  )

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore) return
    setIsLoadingMore(true)
    await doFetch(filters, cursor, true)
    setIsLoadingMore(false)
  }, [hasMore, isLoadingMore, filters, cursor, doFetch])

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setCursor(null)
    await doFetch(filters, null, false)
    setIsLoading(false)
  }, [filters, doFetch])

  return {
    activities,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    filters,
    setFilters,
    loadMore,
    refresh,
  }
}
