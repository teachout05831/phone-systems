'use server'

import { createClient } from '@/lib/supabase/server'
import { PIPELINE_STATUSES, type PipelineStatus } from '../types'

interface UpdateResult {
  success?: boolean
  error?: string
}

export async function updateContactStatus(
  contactId: string,
  newStatus: PipelineStatus
): Promise<UpdateResult> {
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Get user's company
  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (!membership) return { error: 'No company access' }

  // Validate input
  if (!contactId || typeof contactId !== 'string') {
    return { error: 'Invalid contact ID' }
  }

  if (!PIPELINE_STATUSES.includes(newStatus)) {
    return { error: 'Invalid status' }
  }

  // Update contact status (company_id filter ensures ownership)
  const { error } = await supabase
    .from('contacts')
    .update({
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', contactId)
    .eq('company_id', membership.company_id)

  if (error) return { error: error.message }

  return { success: true }
}
