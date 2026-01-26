import { createClient } from '@/lib/supabase/server'
import type { TranscriptSegment } from '../types'

export async function getCallTranscript(callId: string): Promise<TranscriptSegment[]> {
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

  // Verify call belongs to user's company
  const { data: call } = await supabase
    .from('calls')
    .select('id')
    .eq('id', callId)
    .eq('company_id', membership.company_id)
    .single()

  if (!call) throw new Error('Call not found')

  // Get transcript
  const { data: transcript, error } = await supabase
    .from('call_transcripts')
    .select('segments')
    .eq('call_id', callId)
    .single()

  if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows

  if (!transcript?.segments) return []

  return transcript.segments as TranscriptSegment[]
}
