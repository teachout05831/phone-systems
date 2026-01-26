import { createClient } from '@/lib/supabase/server'
import type { TeamMetrics, RepCallCount } from '../types'

export async function getTeamMetrics(): Promise<TeamMetrics> {
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Get user's company
  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (!membership) throw new Error('No company access')

  // Calculate today's date range
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayISO = today.toISOString()

  // Query 1: Total calls today
  const { count: callsToday } = await supabase
    .from('calls')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', membership.company_id)
    .gte('started_at', todayISO)

  // Query 2: Calls by rep with profile join
  const { data: callsByRepData } = await supabase
    .from('calls')
    .select('rep_id, profiles!calls_rep_id_fkey (id, full_name)')
    .eq('company_id', membership.company_id)
    .gte('started_at', todayISO)
    .limit(500)

  // Aggregate calls by rep
  const repCallMap = new Map<string, { name: string; count: number }>()
  for (const call of callsByRepData || []) {
    if (!call.rep_id) continue
    // Handle Supabase join result which may be array or single object
    const profileData = call.profiles as unknown
    const profile = (Array.isArray(profileData) ? profileData[0] : profileData) as { id: string; full_name: string | null } | null
    const repName = profile?.full_name || 'Unknown'
    const existing = repCallMap.get(call.rep_id)
    if (existing) {
      existing.count++
    } else {
      repCallMap.set(call.rep_id, { name: repName, count: 1 })
    }
  }
  const callsByRep: RepCallCount[] = Array.from(repCallMap.entries()).map(
    ([repId, { name, count }]) => ({ repId, repName: name, callCount: count })
  )

  // Query 3: Average call duration (completed calls today)
  const { data: completedCalls } = await supabase
    .from('calls')
    .select('duration_seconds')
    .eq('company_id', membership.company_id)
    .eq('status', 'completed')
    .gte('started_at', todayISO)
    .limit(500)

  const totalDuration = (completedCalls || []).reduce(
    (sum, call) => sum + (call.duration_seconds || 0),
    0
  )
  const avgDuration = completedCalls?.length
    ? Math.round(totalDuration / completedCalls.length)
    : 0

  // Query 4: Conversion rate (booked outcomes / total calls)
  const { count: bookedCount } = await supabase
    .from('calls')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', membership.company_id)
    .eq('outcome', 'booked')
    .gte('started_at', todayISO)

  const conversionRate =
    callsToday && callsToday > 0
      ? Math.round(((bookedCount || 0) / callsToday) * 1000) / 10
      : 0

  // Query 5: SMS sent today
  const { count: smsSentToday } = await supabase
    .from('sms_messages')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', membership.company_id)
    .eq('direction', 'outbound')
    .gte('created_at', todayISO)

  return {
    callsToday: callsToday || 0,
    callsByRep,
    averageCallDuration: avgDuration,
    conversionRate,
    smsSentToday: smsSentToday || 0,
  }
}
