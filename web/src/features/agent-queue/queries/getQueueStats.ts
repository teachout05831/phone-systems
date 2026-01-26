'use server'

import { createClient } from '@/lib/supabase/server'
import type { QueueStats } from '../types'

export async function getQueueStats(): Promise<QueueStats> {
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

  if (!membership) throw new Error('No company access')

  // Calculate today's date range
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayISO = today.toISOString()

  // Count pending
  const { count: pending } = await supabase
    .from('ai_queue')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', membership.company_id)
    .in('status', ['pending', 'retry_scheduled'])

  // Count in progress
  const { count: inProgress } = await supabase
    .from('ai_queue')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', membership.company_id)
    .eq('status', 'in_progress')

  // Count completed today
  const { count: completedToday } = await supabase
    .from('ai_queue')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', membership.company_id)
    .eq('status', 'completed')
    .gte('updated_at', todayISO)

  // Count failed today
  const { count: failedToday } = await supabase
    .from('ai_queue')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', membership.company_id)
    .eq('status', 'failed')
    .gte('updated_at', todayISO)

  // Estimate cost: $0.07 per completed call
  const costToday = (completedToday || 0) * 0.07

  return {
    pending: pending || 0,
    inProgress: inProgress || 0,
    completedToday: completedToday || 0,
    failedToday: failedToday || 0,
    costToday: Math.round(costToday * 100) / 100,
  }
}
