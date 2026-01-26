import { createClient } from '@/lib/supabase/server'
import type { ActiveCall } from '../types'

export async function getActiveCalls(): Promise<ActiveCall[]> {
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

  // Query active calls with joins
  const { data, error } = await supabase
    .from('calls')
    .select(
      `
      id, rep_id, contact_id, direction, phone_number, started_at,
      profiles!calls_rep_id_fkey (id, full_name),
      contacts (id, first_name, last_name)
    `
    )
    .eq('company_id', membership.company_id)
    .eq('status', 'in_progress')
    .order('started_at', { ascending: false })
    .limit(20)

  if (error) throw error

  const now = new Date()
  return (data || []).map((call) => {
    // Handle Supabase join result which may be array or single object
    const profileData = call.profiles as unknown
    const profile = Array.isArray(profileData) ? profileData[0] : profileData
    const contactData = call.contacts as unknown
    const contact = Array.isArray(contactData) ? contactData[0] : contactData
    const startedAt = new Date(call.started_at)
    const durationSeconds = Math.floor((now.getTime() - startedAt.getTime()) / 1000)

    const contactName = contact
      ? `${(contact as { first_name?: string }).first_name || ''} ${(contact as { last_name?: string }).last_name || ''}`.trim() || 'Unknown'
      : 'Unknown Contact'

    return {
      id: call.id,
      repId: call.rep_id || '',
      repName: (profile as { full_name?: string })?.full_name || 'Unknown Rep',
      contactId: call.contact_id,
      contactName,
      phoneNumber: call.phone_number || '',
      direction: call.direction as 'inbound' | 'outbound',
      startedAt: call.started_at,
      durationSeconds,
    }
  })
}
