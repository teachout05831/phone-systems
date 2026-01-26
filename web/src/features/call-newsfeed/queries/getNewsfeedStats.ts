import type { SupabaseClient } from '@supabase/supabase-js'
import type { NewsfeedStats } from '../types'

export async function getNewsfeedStats(
  supabase: SupabaseClient,
  companyId: string,
  dateFrom: string,
  dateTo: string
): Promise<NewsfeedStats> {
  const { data } = await supabase
    .from('calls')
    .select('status, outcome')
    .eq('company_id', companyId)
    .in('status', ['completed', 'missed', 'no_answer', 'voicemail'])
    .gte('started_at', dateFrom)
    .lte('started_at', dateTo)
    .limit(500)

  const calls = data || []

  return {
    totalCalls: calls.length,
    booked: calls.filter(c => c.outcome === 'booked').length,
    estimates: calls.filter(c => c.outcome === 'interested').length,
    needsAction: calls.filter(c => c.status === 'completed' && !c.outcome).length,
    missed: calls.filter(c => c.status === 'missed' || c.status === 'no_answer').length,
  }
}
