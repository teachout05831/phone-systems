import { createClient } from '@/lib/supabase/server'
import type { RecentCall } from '../types'

export async function getRecentCalls(limit: number = 10): Promise<RecentCall[]> {
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

  const { data, error } = await supabase
    .from('calls')
    .select(`
      id,
      contact_id,
      phone_number,
      direction,
      status,
      duration,
      started_at,
      contact:contacts!contact_id(id, first_name, last_name, business_name)
    `)
    .eq('company_id', membership.company_id)
    .order('started_at', { ascending: false })
    .limit(limit)

  if (error) throw error

  return (data || []) as unknown as RecentCall[]
}
