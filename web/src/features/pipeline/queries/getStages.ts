import { createClient } from '@/lib/supabase/server'
import { toStage, type PipelineStage } from '../types/deals'

export async function getStages(): Promise<PipelineStage[]> {
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

  if (!membership) throw new Error('No company access')

  // Fetch stages ordered by position
  const { data, error } = await supabase
    .from('pipeline_stages')
    .select('id, company_id, name, slug, color, position, is_closed_won, is_closed_lost')
    .eq('company_id', membership.company_id)
    .order('position', { ascending: true })
    .limit(20)

  if (error) throw error

  return (data || []).map(toStage)
}
