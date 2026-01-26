'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { refreshDashboard } from '../actions/refreshDashboard'
import type {
  UseSupervisorDashboardProps,
  UseSupervisorDashboardReturn,
  TeamMetrics,
  ActiveCall,
  LeaderboardEntry,
} from '../types'

export function useSupervisorDashboard({
  initialMetrics,
  initialActiveCalls,
  initialLeaderboard,
  pollingInterval = 30000,
}: UseSupervisorDashboardProps): UseSupervisorDashboardReturn {
  const [metrics, setMetrics] = useState<TeamMetrics>(initialMetrics)
  const [activeCalls, setActiveCalls] = useState<ActiveCall[]>(initialActiveCalls)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(initialLeaderboard)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(new Date())
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const refresh = useCallback(async () => {
    setIsRefreshing(true)
    setError(null)
    try {
      const result = await refreshDashboard()
      if (result.error) {
        setError(result.error)
      } else {
        if (result.metrics) setMetrics(result.metrics)
        if (result.activeCalls) setActiveCalls(result.activeCalls)
        if (result.leaderboard) setLeaderboard(result.leaderboard)
        setLastUpdated(new Date())
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh data')
    } finally {
      setIsRefreshing(false)
    }
  }, [])

  // Update active call durations every second
  useEffect(() => {
    const durationInterval = setInterval(() => {
      setActiveCalls((prev) =>
        prev.map((call) => ({
          ...call,
          durationSeconds: call.durationSeconds + 1,
        }))
      )
    }, 1000)

    return () => clearInterval(durationInterval)
  }, [])

  // Polling for data updates
  useEffect(() => {
    intervalRef.current = setInterval(refresh, pollingInterval)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [refresh, pollingInterval])

  return {
    metrics,
    activeCalls,
    leaderboard,
    isRefreshing,
    lastUpdated,
    error,
    refresh,
  }
}
