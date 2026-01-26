import { createClient } from '@/lib/supabase/server'

export interface MissedCall {
  id: string
  phone_number: string
  started_at: string
  callback_attempts: number
  contact: {
    id: string
    first_name: string
    last_name: string
    business_name: string | null
  } | null
}

export async function getMissedCalls(limit: number = 20): Promise<MissedCall[]> {
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

  // Get missed calls that don't have a scheduled callback
  const { data, error } = await supabase
    .from('calls')
    .select(`
      id,
      phone_number,
      started_at,
      contact:contacts!contact_id(id, first_name, last_name, business_name)
    `)
    .eq('company_id', membership.company_id)
    .in('status', ['missed', 'no-answer'])
    .order('started_at', { ascending: false })
    .limit(limit)

  if (error) throw error

  // Add callback_attempts (would need a join or separate query in real implementation)
  return (data || []).map(call => ({
    ...call,
    callback_attempts: 0, // Placeholder - would need actual count
  })) as unknown as MissedCall[]
}
