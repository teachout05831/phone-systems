'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { getQueueItems } from '../queries/getQueueItems'
import { getQueueStats } from '../queries/getQueueStats'
import { addToQueue as addToQueueAction } from '../actions/addToQueue'
import { removeFromQueue as removeAction } from '../actions/removeFromQueue'
import { updatePriority as updatePriorityAction } from '../actions/updatePriority'
import { dispatchNow as dispatchAction } from '../actions/dispatchNow'
import type { QueueItem, QueueStats, QueueStatus, QueuePriority } from '../types'

interface UseAgentQueueProps {
  initialItems: QueueItem[]
  initialStats: QueueStats
  pollingInterval?: number
}

export function useAgentQueue({
  initialItems,
  initialStats,
  pollingInterval = 30000,
}: UseAgentQueueProps) {
  const [items, setItems] = useState<QueueItem[]>(initialItems)
  const [stats, setStats] = useState<QueueStats>(initialStats)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<QueueStatus | 'all'>('all')
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [newItems, newStats] = await Promise.all([
        getQueueItems({ status: filter }),
        getQueueStats(),
      ])
      setItems(newItems)
      setStats(newStats)
      setError(null)
    } catch (e) {
      setError('Failed to refresh queue')
    }
  }, [filter])

  // Polling
  useEffect(() => {
    intervalRef.current = setInterval(refresh, pollingInterval)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [refresh, pollingInterval])

  // Refresh when filter changes
  useEffect(() => {
    refresh()
  }, [filter, refresh])

  const addToQueue = useCallback(async (
    contactIds: string[],
    priority?: QueuePriority,
    scheduledAt?: string
  ) => {
    setLoading(true)
    const result = await addToQueueAction({ contactIds, priority, scheduledAt })
    setLoading(false)
    if (result.success) await refresh()
    return result
  }, [refresh])

  const removeFromQueue = useCallback(async (itemId: string) => {
    const result = await removeAction(itemId)
    if (result.success) {
      setItems(prev => prev.filter(i => i.id !== itemId))
      setSelectedIds(prev => { prev.delete(itemId); return new Set(prev) })
    }
    return result
  }, [])

  const updatePriority = useCallback(async (itemId: string, priority: QueuePriority) => {
    const result = await updatePriorityAction(itemId, priority)
    if (result.success) {
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, priority } : i))
    }
    return result
  }, [])

  const dispatch = useCallback(async (itemId: string) => {
    const result = await dispatchAction(itemId)
    if (result.success) await refresh()
    return result
  }, [refresh])

  const toggleSelect = useCallback((itemId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(items.map(i => i.id)))
    }
  }, [items, selectedIds.size])

  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])

  return {
    items, stats, loading, error, selectedIds, filter,
    setFilter, refresh, addToQueue, removeFromQueue,
    updatePriority, dispatch, toggleSelect, selectAll, clearSelection,
  }
}
