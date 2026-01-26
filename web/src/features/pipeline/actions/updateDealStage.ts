'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

interface UpdateDealStageResult {
  success?: boolean
  error?: string
}

export async function updateDealStage(
  dealId: string,
  newStageId: string
): Promise<UpdateDealStageResult> {
  const supabase = await createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Validation
  if (!dealId) return { error: 'Deal ID is required' }
  if (!newStageId) return { error: 'Stage ID is required' }

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
    .select('id, stage_id, company_id')
    .eq('id', dealId)
    .single()

  if (!deal) return { error: 'Deal not found' }
  if (deal.company_id !== membership.company_id) return { error: 'Not authorized' }

  // Verify new stage belongs to user's company
  const { data: stage } = await supabase
    .from('pipeline_stages')
    .select('id, is_closed_won, is_closed_lost')
    .eq('id', newStageId)
    .eq('company_id', membership.company_id)
    .single()

  if (!stage) return { error: 'Invalid stage' }

  // Prepare update data
  const updateData: Record<string, unknown> = {
    stage_id: newStageId,
  }

  // If moving to closed stage, set closed_at
  if (stage.is_closed_won || stage.is_closed_lost) {
    updateData.closed_at = new Date().toISOString()
  } else {
    updateData.closed_at = null
  }

  // Update the deal
  const { error } = await supabase
    .from('deals')
    .update(updateData)
    .eq('id', dealId)

  if (error) {
    console.error('Update deal stage error:', error)
    return { error: 'Failed to update deal stage' }
  }

  // Log activity
  await supabase.from('activity_log').insert({
    company_id: membership.company_id,
    user_id: user.id,
    entity_type: 'deal',
    entity_id: dealId,
    action: 'stage_changed',
    old_value: { stage_id: deal.stage_id },
    new_value: { stage_id: newStageId },
  })

  revalidatePath('/pipeline')

  return { success: true }
}
