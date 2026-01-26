'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

interface DeleteDealResult {
  success?: boolean
  error?: string
}

export async function deleteDeal(dealId: string): Promise<DeleteDealResult> {
  const supabase = await createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Validation
  if (!dealId) return { error: 'Deal ID is required' }

  // Get user's company
  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (!membership) return { error: 'No company access' }

  // Get the deal and verify ownership
  const { data: deal } = await supabase
    .from('deals')
    .select('id, title, company_id')
    .eq('id', dealId)
    .single()

  if (!deal) return { error: 'Deal not found' }
  if (deal.company_id !== membership.company_id) return { error: 'Not authorized' }

  // Delete the deal
  const { error } = await supabase
    .from('deals')
    .delete()
    .eq('id', dealId)

  if (error) {
    console.error('Delete deal error:', error)
    return { error: 'Failed to delete deal' }
  }

  // Log activity
  await supabase.from('activity_log').insert({
    company_id: membership.company_id,
    user_id: user.id,
    entity_type: 'deal',
    entity_id: dealId,
    action: 'deleted',
    old_value: { title: deal.title },
  })

  revalidatePath('/pipeline')

  return { success: true }
}
