import { createClient } from '@/lib/supabase/server'
import type { DashboardStats } from '../types'

export async function getDashboardStats(): Promise<DashboardStats> {
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

  if (!membership) {
    return { totalCalls: 0, connectedCalls: 0, missedCalls: 0, avgDuration: 0, callsTrend: 0 }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayIso = today.toISOString()

  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayIso = yesterday.toISOString()

  // Get today's calls
  const { data: todayCalls } = await supabase
    .from('calls')
    .select('id, status, duration')
    .eq('company_id', membership.company_id)
    .gte('started_at', todayIso)
    .limit(1000)

  // Get yesterday's call count for trend
  const { count: yesterdayCount } = await supabase
    .from('calls')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', membership.company_id)
    .gte('started_at', yesterdayIso)
    .lt('started_at', todayIso)

  const calls = todayCalls || []
  const totalCalls = calls.length
  const connectedCalls = calls.filter(c => c.status === 'connected').length
  const missedCalls = calls.filter(c => c.status === 'missed' || c.status === 'no-answer').length

  // Calculate average duration
  const durations = calls.filter(c => c.duration && c.duration > 0).map(c => c.duration as number)
  const avgDuration = durations.length > 0
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0

  // Calculate trend
  const callsTrend = totalCalls - (yesterdayCount || 0)

  return {
    totalCalls,
    connectedCalls,
    missedCalls,
    avgDuration,
    callsTrend,
  }
}
