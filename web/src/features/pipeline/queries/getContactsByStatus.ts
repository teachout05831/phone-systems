import { createClient } from '@/lib/supabase/server'
import {
  PIPELINE_STATUSES,
  type ContactsByStatus,
  type PipelineStatus,
  toPipelineContact,
} from '../types'

export async function getContactsByStatus(): Promise<ContactsByStatus> {
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

  // Fetch contacts with pipeline statuses only
  const { data, error } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, phone, business_name, status, updated_at')
    .eq('company_id', membership.company_id)
    .in('status', PIPELINE_STATUSES)
    .order('updated_at', { ascending: false })
    .limit(500)

  if (error) throw error

  // Initialize empty groups
  const grouped: ContactsByStatus = {
    new: [],
    contacted: [],
    engaged: [],
    qualified: [],
    closed_won: [],
    closed_lost: [],
  }

  // Group contacts by status
  for (const row of data || []) {
    const contact = toPipelineContact(row)
    const status = contact.status as PipelineStatus
    if (status in grouped) {
      grouped[status].push(contact)
    }
  }

  return grouped
}
