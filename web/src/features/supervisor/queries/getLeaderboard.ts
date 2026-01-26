import { createClient } from '@/lib/supabase/server'
import type { LeaderboardEntry } from '../types'

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
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

  // Get all team members
  const { data: teamMembers } = await supabase
    .from('company_members')
    .select('user_id, profiles (id, full_name, avatar_url, role)')
    .eq('company_id', membership.company_id)
    .limit(50)

  if (!teamMembers) return []

  // Calculate today's date range
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayISO = today.toISOString()

  // Get calls data for all reps today
  const { data: callsData } = await supabase
    .from('calls')
    .select('rep_id, outcome')
    .eq('company_id', membership.company_id)
    .gte('started_at', todayISO)
    .limit(1000)

  // Aggregate by rep
  const repStats = new Map<string, { calls: number; booked: number }>()
  for (const call of callsData || []) {
    if (!call.rep_id) continue
    const existing = repStats.get(call.rep_id) || { calls: 0, booked: 0 }
    existing.calls++
    if (call.outcome === 'booked') {
      existing.booked++
    }
    repStats.set(call.rep_id, existing)
  }

  // Build leaderboard entries (only reps and closers)
  const entries: LeaderboardEntry[] = []
  for (const member of teamMembers) {
    // Handle Supabase join result which may be array or single object
    const profileData = member.profiles as unknown
    const profile = (Array.isArray(profileData) ? profileData[0] : profileData) as {
      id: string
      full_name: string | null
      avatar_url: string | null
      role: string
    } | null

    if (!profile) continue
    if (profile.role !== 'rep' && profile.role !== 'closer') continue

    const stats = repStats.get(member.user_id) || { calls: 0, booked: 0 }
    entries.push({
      rank: 0,
      repId: profile.id,
      repName: profile.full_name || 'Unknown',
      avatarUrl: profile.avatar_url,
      callsMade: stats.calls,
      dealsBooked: stats.booked,
      conversionRate: stats.calls > 0 ? (stats.booked / stats.calls) * 100 : 0,
    })
  }

  // Sort by deals booked (primary), then calls made (secondary)
  entries.sort((a, b) => {
    if (b.dealsBooked !== a.dealsBooked) return b.dealsBooked - a.dealsBooked
    return b.callsMade - a.callsMade
  })

  // Assign ranks and return top 10
  entries.forEach((entry, index) => {
    entry.rank = index + 1
  })

  return entries.slice(0, 10)
}
