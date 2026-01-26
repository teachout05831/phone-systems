import { createClient } from '@/lib/supabase/server'
import type { Callback, CallbackStatus } from '../types'

interface GetCallbacksFilters {
  status?: CallbackStatus | CallbackStatus[]
  limit?: number
}

export async function getCallbacks(filters?: GetCallbacksFilters): Promise<Callback[]> {
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

  let query = supabase
    .from('callbacks')
    .select(`
      id,
      scheduled_at,
      status,
      priority,
      reason,
      notes,
      attempt_count,
      max_attempts,
      assigned_to,
      contact:contacts!contact_id(id, first_name, last_name, phone, business_name),
      assigned_to_profile:profiles!assigned_to(id, full_name)
    `)
    .eq('company_id', membership.company_id)
    .order('scheduled_at', { ascending: true })

  // Apply status filter
  if (filters?.status) {
    if (Array.isArray(filters.status)) {
      query = query.in('status', filters.status)
    } else {
      query = query.eq('status', filters.status)
    }
  }

  const { data, error } = await query.limit(filters?.limit || 50)

  if (error) throw error

  return (data || []) as unknown as Callback[]
}
