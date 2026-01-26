import { createClient } from '@/lib/supabase/server'
import type { Contact, ContactRow, ContactStats } from '../types'
import { transformContact } from '../types'

export async function getContactById(id: string): Promise<Contact | null> {
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

  // SECURITY: Filter by company_id to ensure multi-tenant isolation
  const { data, error } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, phone, phone_secondary, email, business_name, job_title, website, source, status, notes, tags, company_id, created_by, assigned_to, created_at, updated_at')
    .eq('id', id)
    .eq('company_id', membership.company_id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // Not found
    throw error
  }

  return transformContact(data as ContactRow)
}

export async function getContactStats(contactId: string): Promise<ContactStats> {
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

  // Verify contact belongs to company
  const { data: contact } = await supabase
    .from('contacts')
    .select('id')
    .eq('id', contactId)
    .eq('company_id', membership.company_id)
    .single()

  if (!contact) throw new Error('Contact not found')

  // Get call stats
  const { data: calls } = await supabase
    .from('calls')
    .select('status, duration_seconds, started_at')
    .eq('contact_id', contactId)
    .limit(500)

  const callList = calls || []
  const connectedCalls = callList.filter(c => c.status === 'completed')
  const totalTalkTime = callList.reduce((sum, c) => sum + (c.duration_seconds || 0), 0)

  const lastCall = callList.length > 0
    ? callList.sort((a, b) =>
        new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
      )[0]
    : null

  return {
    totalCalls: callList.length,
    connectedCalls: connectedCalls.length,
    totalTalkTime,
    lastContactedAt: lastCall?.started_at || null,
  }
}
