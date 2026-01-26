'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { fetchNewsfeedCalls } from '../actions/fetchNewsfeedCalls'
import { tagCallOutcome } from '../actions/tagCallOutcome'
import { addCallNote } from '../actions/addCallNote'
import type { NewsfeedCall, NewsfeedStats, NewsfeedFilter, NewsfeedTag, NewsfeedResponse } from '../types'

interface UseNewsfeedOptions {
  initialData?: NewsfeedResponse
  pollInterval?: number
  autoRefresh?: boolean
}

const tagToOutcome: Record<NewsfeedTag, string> = {
  booked: 'booked',
  estimate: 'interested',
  question: 'callback',
  current_customer: 'no_outcome',
  not_interested: 'not_interested',
}

export function useNewsfeed(options: UseNewsfeedOptions = {}) {
  const { initialData, pollInterval = 30000, autoRefresh = true } = options

  const [calls, setCalls] = useState<NewsfeedCall[]>(initialData?.calls || [])
  const [stats, setStats] = useState<NewsfeedStats>(
    initialData?.stats || { totalCalls: 0, booked: 0, estimates: 0, needsAction: 0, missed: 0 }
  )
  const [filter, setFilterState] = useState<NewsfeedFilter>('all')
  const [cursor, setCursor] = useState<string | null>(initialData?.nextCursor || null)
  const [hasMore, setHasMore] = useState(initialData?.hasMore || false)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const filterRef = useRef(filter)

  useEffect(() => { filterRef.current = filter }, [filter])

  const doFetch = useCallback(async (currentFilter: NewsfeedFilter, cursorValue: string | null, append: boolean) => {
    try {
      const data = await fetchNewsfeedCalls(currentFilter, { cursor: cursorValue || undefined, limit: 20 })
      setCalls(prev => (append ? [...prev, ...data.calls] : data.calls))
      setStats(data.stats)
      setCursor(data.nextCursor)
      setHasMore(data.hasMore)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load calls')
    }
  }, [])

  const refresh = useCallback(async () => {
    setIsLoading(true)
    await doFetch(filterRef.current, null, false)
    setIsLoading(false)
  }, [doFetch])

  const setFilter = useCallback((newFilter: NewsfeedFilter) => {
    setFilterState(newFilter)
    setCursor(null)
    setIsLoading(true)
    doFetch(newFilter, null, false).finally(() => setIsLoading(false))
  }, [doFetch])

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore) return
    setIsLoadingMore(true)
    await doFetch(filterRef.current, cursor, true)
    setIsLoadingMore(false)
  }, [hasMore, isLoadingMore, cursor, doFetch])

  const handleTagCall = useCallback(async (callId: string, tag: NewsfeedTag | null) => {
    const outcome = tag ? tagToOutcome[tag] : null
    setCalls(prev => prev.map(c => (c.id === callId ? { ...c, outcome: outcome as NewsfeedCall['outcome'] } : c)))
    const result = await tagCallOutcome({ callId, tag })
    if (result.error) refresh()
  }, [refresh])

  const handleAddNote = useCallback(async (callId: string, content: string) => {
    const result = await addCallNote({ callId, content })
    if (result.success) refresh()
    return result
  }, [refresh])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(refresh, pollInterval)
    return () => clearInterval(interval)
  }, [autoRefresh, pollInterval, refresh])

  return {
    calls, stats, filter, setFilter, isLoading, isLoadingMore, error, hasMore,
    loadMore, refresh, tagCall: handleTagCall, addNote: handleAddNote,
  }
}
