import { createClient } from '@/lib/supabase/server'
import type { ContactCall, CallRow } from '../types'
import { transformCall } from '../types'

interface GetContactCallsOptions {
  limit?: number
  offset?: number
}

export async function getContactCalls(
  contactId: string,
  options?: GetContactCallsOptions
): Promise<ContactCall[]> {
  const supabase = await createClient()

  // SECURITY: Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Get user's company
  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (!membership) throw new Error('No company found')

  // SECURITY: Verify contact belongs to user's company
  const { data: contact } = await supabase
    .from('contacts')
    .select('id')
    .eq('id', contactId)
    .eq('company_id', membership.company_id)
    .single()

  if (!contact) throw new Error('Contact not found')

  // Get calls for this contact
  const limit = options?.limit || 50
  const offset = options?.offset || 0

  const { data, error } = await supabase
    .from('calls')
    .select('id, direction, status, outcome, duration_seconds, started_at, ended_at, recording_url, transcript_url, ai_summary')
    .eq('contact_id', contactId)
    .order('started_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw error

  return (data as CallRow[]).map(transformCall)
}

export async function getContactCallsCount(contactId: string): Promise<number> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (!membership) throw new Error('No company found')

  // Verify contact belongs to company
  const { data: contact } = await supabase
    .from('contacts')
    .select('id')
    .eq('id', contactId)
    .eq('company_id', membership.company_id)
    .single()

  if (!contact) throw new Error('Contact not found')

  const { count, error } = await supabase
    .from('calls')
    .select('id', { count: 'exact', head: true })
    .eq('contact_id', contactId)

  if (error) throw error
  return count || 0
}
