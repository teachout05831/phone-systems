import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role for webhooks (no user context)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { event, call } = body

    console.log('Retell webhook received:', event, call?.call_id)

    if (!call?.call_id) {
      return NextResponse.json({ error: 'Missing call_id' }, { status: 400 })
    }

    // Find our call record by external_call_id
    const { data: callRecord, error: findError } = await supabase
      .from('calls')
      .select('*')
      .eq('external_call_id', call.call_id)
      .single()

    if (findError || !callRecord) {
      // Try finding by metadata.call_id if we stored it
      if (call.metadata?.call_id) {
        const { data: altRecord } = await supabase
          .from('calls')
          .select('*')
          .eq('id', call.metadata.call_id)
          .single()

        if (!altRecord) {
          console.error('Call record not found:', call.call_id)
          return NextResponse.json({ error: 'Call not found' }, { status: 404 })
        }
      } else {
        console.error('Call record not found:', call.call_id)
        return NextResponse.json({ error: 'Call not found' }, { status: 404 })
      }
    }

    const callId = callRecord?.id || call.metadata?.call_id

    switch (event) {
      case 'call_started':
        await supabase
          .from('calls')
          .update({
            status: 'in_progress',
            started_at: new Date().toISOString(),
          })
          .eq('id', callId)
        break

      case 'call_ended':
        // Calculate duration
        const startedAt = callRecord?.started_at ? new Date(callRecord.started_at) : null
        const duration = startedAt ? Math.round((Date.now() - startedAt.getTime()) / 1000) : null

        // Map Retell end reason to our outcome
        let outcome = 'unknown'
        switch (call.end_call_reason) {
          case 'agent_hangup':
          case 'user_hangup':
            outcome = 'completed'
            break
          case 'voicemail':
            outcome = 'voicemail'
            break
          case 'no_answer':
            outcome = 'no_answer'
            break
          case 'busy':
            outcome = 'busy'
            break
          case 'failed':
            outcome = 'failed'
            break
        }

        await supabase
          .from('calls')
          .update({
            status: 'completed',
            ended_at: new Date().toISOString(),
            duration_seconds: call.duration_seconds || duration,
            outcome,
          })
          .eq('id', callId)
        break

      case 'call_analyzed':
        // Retell has analyzed the call - save AI summary
        if (call.analysis) {
          await supabase
            .from('calls')
            .update({
              ai_summary: {
                summary: call.analysis.call_summary,
                sentiment: call.analysis.user_sentiment,
                topics: call.analysis.custom_analysis_data,
                successful: call.analysis.call_successful,
              },
            })
            .eq('id', callId)

          // If Ralph identified this as a qualified lead, update contact status
          if (call.analysis.call_successful) {
            await supabase
              .from('contacts')
              .update({ status: 'qualified' })
              .eq('id', callRecord?.contact_id || call.metadata?.contact_id)
          }
        }
        break

      case 'transcript_ready':
        // Save transcript
        if (call.transcript) {
          await supabase.from('call_transcripts').insert({
            call_id: callId,
            full_text: call.transcript,
            segments: call.transcript_object || null,
          })
        }
        break
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Retell webhook error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Retell may send GET for verification
export async function GET() {
  return NextResponse.json({ status: 'ok' })
}
