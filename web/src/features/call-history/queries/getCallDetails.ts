import { createClient } from '@/lib/supabase/server'
import type { CallDetails, AISummary, CallTranscript } from '../types'

export async function getCallDetails(callId: string): Promise<CallDetails | null> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .single()

  if (!membership) throw new Error('No company membership')

  // Fetch call with contact and rep
  const { data: call, error: callError } = await supabase
    .from('calls')
    .select(`
      id, external_call_id, direction, phone_number, from_number, status,
      duration_seconds, outcome, has_recording, recording_url, ai_summary,
      started_at, ended_at,
      contact:contacts(id, first_name, last_name, phone, business_name),
      rep:profiles!calls_rep_id_fkey(id, full_name)
    `)
    .eq('id', callId)
    .eq('company_id', membership.company_id)
    .single()

  if (callError || !call) return null

  // Fetch transcript
  const { data: transcriptData } = await supabase
    .from('call_transcripts')
    .select('id, segments, full_text, word_count')
    .eq('call_id', callId)
    .single()

  const transcript: CallTranscript | null = transcriptData
    ? {
        id: transcriptData.id,
        segments: transcriptData.segments || [],
        full_text: transcriptData.full_text || '',
        word_count: transcriptData.word_count || 0
      }
    : null

  // Parse AI summary
  let aiSummary: AISummary | null = null
  if (call.ai_summary && typeof call.ai_summary === 'object') {
    const summary = call.ai_summary as Record<string, unknown>
    aiSummary = {
      overview: (summary.overview as string) || '',
      sentiment: (summary.sentiment as 'positive' | 'neutral' | 'negative') || 'neutral',
      outcome: (summary.outcome as string) || '',
      action_items: (summary.action_items as string[]) || []
    }
  }

  // Extract first element from arrays (Supabase returns relations as arrays)
  const contact = Array.isArray(call.contact) ? call.contact[0] || null : call.contact
  const rep = Array.isArray(call.rep) ? call.rep[0] || null : call.rep

  return {
    id: call.id,
    external_call_id: call.external_call_id,
    direction: call.direction,
    phone_number: call.phone_number,
    from_number: call.from_number,
    status: call.status,
    duration_seconds: call.duration_seconds,
    outcome: call.outcome,
    has_recording: call.has_recording,
    recording_url: call.recording_url,
    started_at: call.started_at,
    ended_at: call.ended_at,
    contact,
    rep,
    ai_summary: aiSummary,
    transcript
  } as CallDetails
}
