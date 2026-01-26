import { createClient } from '@/lib/supabase/server'
import type { UpcomingCallback } from '../types'

export async function getUpcomingCallbacks(limit: number = 5): Promise<UpcomingCallback[]> {
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

  if (!membership) return []

  // Get today's start
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Get tomorrow's end for "due today"
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const { data, error } = await supabase
    .from('callbacks')
    .select(`
      id,
      scheduled_at,
      priority,
      reason,
      contact:contacts!contact_id(id, first_name, last_name, phone, business_name)
    `)
    .eq('company_id', membership.company_id)
    .in('status', ['scheduled', 'pending', 'rescheduled'])
    .gte('scheduled_at', today.toISOString())
    .lt('scheduled_at', tomorrow.toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(limit)

  if (error) throw error

  return (data || []) as unknown as UpcomingCallback[]
}
