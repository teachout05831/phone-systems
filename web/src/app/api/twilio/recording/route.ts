import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const recordingSid = formData.get('RecordingSid') as string;
    const recordingUrl = formData.get('RecordingUrl') as string;
    const callSid = formData.get('CallSid') as string;
    const recordingDuration = formData.get('RecordingDuration') as string;

    console.log(`Recording completed for call ${callSid}: ${recordingUrl}`);

    // Use service role for webhook (no user session)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Find the call by Twilio call SID and update with recording info
    const { data: call, error: findError } = await supabase
      .from('calls')
      .select('id')
      .eq('external_call_id', callSid)
      .single();

    if (findError || !call) {
      console.log(`Call ${callSid} not found in database, storing recording info for later`);
      // Could store in a temporary table or retry later
      return Response.json({ success: true, message: 'Call not found, recording noted' });
    }

    // Update the call with recording info
    const { error: updateError } = await supabase
      .from('calls')
      .update({
        has_recording: true,
        recording_url: `${recordingUrl}.mp3`, // Twilio provides MP3 format
        recording_duration_seconds: parseInt(recordingDuration) || 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', call.id);

    if (updateError) {
      console.error('Failed to update call with recording:', updateError);
      return Response.json({ error: 'Failed to update recording' }, { status: 500 });
    }

    console.log(`Updated call ${callSid} with recording URL`);

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error handling recording callback:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
