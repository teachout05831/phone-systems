import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role for this endpoint
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Mark a call as declined (user actively rejected it)
export async function POST(req: NextRequest) {
  try {
    const { callSid } = await req.json();

    if (!callSid) {
      return NextResponse.json({ error: 'Missing callSid' }, { status: 400 });
    }

    console.log('Marking call as declined:', callSid);

    // Update the call record to mark it as declined
    const { error: updateError } = await supabase
      .from('calls')
      .update({
        outcome: 'declined',
        status: 'completed',
        ended_at: new Date().toISOString(),
      })
      .eq('external_call_id', callSid);

    if (updateError) {
      console.error('Failed to mark call as declined:', updateError);
      return NextResponse.json({ error: 'Failed to update call' }, { status: 500 });
    }

    console.log('Call marked as declined:', callSid);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Decline call error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
