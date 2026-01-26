'use server'

import { getTeamMetrics } from '../queries/getTeamMetrics'
import { getActiveCalls } from '../queries/getActiveCalls'
import { getLeaderboard } from '../queries/getLeaderboard'
import type { TeamMetrics, ActiveCall, LeaderboardEntry } from '../types'

interface RefreshResult {
  metrics: TeamMetrics | null
  activeCalls: ActiveCall[] | null
  leaderboard: LeaderboardEntry[] | null
  error: string | null
}

export async function refreshDashboard(): Promise<RefreshResult> {
  try {
    const [metrics, activeCalls, leaderboard] = await Promise.all([
      getTeamMetrics(),
      getActiveCalls(),
      getLeaderboard(),
    ])
    return { metrics, activeCalls, leaderboard, error: null }
  } catch (err) {
    return {
      metrics: null,
      activeCalls: null,
      leaderboard: null,
      error: err instanceof Error ? err.message : 'Failed to refresh',
    }
  }
}
