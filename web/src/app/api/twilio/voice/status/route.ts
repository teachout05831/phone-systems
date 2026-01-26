import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role for webhooks (no user context)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Handle Twilio status callback for call updates
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    // Twilio sends different field names for different callback types
    // ParentCallSid is sent for child legs (like client dial)
    const callSid = (formData.get('ParentCallSid') || formData.get('CallSid')) as string;
    const callStatus = formData.get('CallStatus') as string;
    const callDuration = formData.get('CallDuration') as string;
    const from = formData.get('From') as string;
    const to = formData.get('To') as string;

    console.log('Twilio status callback:', {
      callSid,
      callStatus,
      callDuration,
      from,
      to,
      parentCallSid: formData.get('ParentCallSid'),
      originalCallSid: formData.get('CallSid'),
    });

    if (!callSid) {
      return NextResponse.json({ error: 'Missing CallSid' }, { status: 400 });
    }

    // Find call by external_call_id (CallSid)
    const { data: callRecord, error: findError } = await supabase
      .from('calls')
      .select('*')
      .eq('external_call_id', callSid)
      .single();

    if (findError || !callRecord) {
      console.log('Call record not found for CallSid:', callSid);
      // Not an error - might be an outbound call handled by Retell
      return NextResponse.json({ success: true, message: 'Call not found, possibly handled elsewhere' });
    }

    // Map Twilio status to our status
    let status = callRecord.status;
    let outcome = callRecord.outcome;

    switch (callStatus) {
      case 'initiated':
        status = 'initiated';
        break;
      case 'ringing':
        status = 'ringing';
        break;
      case 'answered':
      case 'in-progress':
        status = 'in_progress';
        break;
      case 'completed':
        status = 'completed';
        // Only set outcome to completed if not already set (preserves declined, etc.)
        outcome = outcome || 'completed';
        break;
      case 'busy':
        status = 'completed';
        outcome = 'busy';
        break;
      case 'no-answer':
        status = 'completed';
        outcome = 'no_answer';
        break;
      case 'failed':
        status = 'failed';
        outcome = 'failed';
        break;
      case 'canceled':
        status = 'completed';
        // Preserve 'declined' if already set by the decline endpoint
        // Otherwise mark as missed (caller hung up before answer)
        if (outcome !== 'declined') {
          outcome = 'missed';
        }
        break;
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      status,
      outcome,
    };

    // Add duration if call completed
    if (callDuration) {
      updateData.duration_seconds = parseInt(callDuration, 10);
    }

    // Add ended_at if call is finished
    if (['completed', 'busy', 'no-answer', 'failed', 'canceled'].includes(callStatus)) {
      updateData.ended_at = new Date().toISOString();
    }

    // Add answered_at if call just connected
    if (callStatus === 'in-progress' && !callRecord.answered_at) {
      updateData.answered_at = new Date().toISOString();
    }

    // Update the call record
    const { error: updateError } = await supabase
      .from('calls')
      .update(updateData)
      .eq('id', callRecord.id);

    if (updateError) {
      console.error('Failed to update call record:', updateError);
      return NextResponse.json({ error: 'Failed to update call' }, { status: 500 });
    }

    console.log('Updated call record:', callRecord.id, 'to status:', status);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Twilio status callback error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Twilio may send GET for verification
export async function GET() {
  return NextResponse.json({ status: 'ok' });
}
