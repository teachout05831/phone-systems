import twilio from 'twilio';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role for webhooks (no user context)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Handle incoming calls to the Twilio phone number
// This routes the call to the browser client (rep)

function generateInboundTwiML(from: string, to: string, callSid: string) {
  console.log('Incoming call from:', from, 'to:', to, 'CallSid:', callSid);

  const twiml = new twilio.twiml.VoiceResponse();

  // Start media stream for real-time transcription
  const ngrokHost = 'reginald-crinose-unparenthetically.ngrok-free.dev';
  const start = twiml.start();
  start.stream({
    url: `wss://${ngrokHost}/media-stream`,
    track: 'both_tracks',
  });

  // Build status callback URL for tracking call completion
  // Must use ngrok URL for Twilio to reach our webhook
  const statusCallbackUrl = `https://${ngrokHost}/api/twilio/voice/status`;

  // Connect the incoming call to a browser client
  // The client identity format matches what we use in the token
  const dial = twiml.dial({
    callerId: from, // Show the caller's number to the rep
    answerOnBridge: true,
  });

  // Dial all registered browser clients (reps)
  // In production, you'd route to a specific rep or queue
  dial.client({
    statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
    statusCallback: statusCallbackUrl,
  }, 'rep');

  const twimlString = twiml.toString();
  console.log('Generated inbound TwiML:', twimlString);

  return twimlString;
}

// Create inbound call record in database
async function createInboundCallRecord(from: string, to: string, callSid: string) {
  try {
    // Format phone number for lookup
    let formattedPhone = from.replace(/\D/g, '');
    if (formattedPhone.startsWith('1') && formattedPhone.length === 11) {
      formattedPhone = formattedPhone.substring(1);
    }

    // Try to find existing contact by phone number
    const { data: contact } = await supabase
      .from('contacts')
      .select('id, company_id')
      .or(`phone.ilike.%${formattedPhone}%,phone.ilike.%${from}%`)
      .limit(1)
      .single();

    // Create the call record
    const { data: callRecord, error } = await supabase
      .from('calls')
      .insert({
        direction: 'inbound',
        status: 'ringing',
        phone_number: from,
        from_number: from,
        external_call_id: callSid,
        contact_id: contact?.id || null,
        company_id: contact?.company_id || null,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create inbound call record:', error);
      return null;
    }

    console.log('Created inbound call record:', callRecord.id);
    return callRecord;
  } catch (err) {
    console.error('Error creating inbound call record:', err);
    return null;
  }
}

// Handle GET requests
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const from = searchParams.get('From') || 'unknown';
    const to = searchParams.get('To') || '';
    const callSid = searchParams.get('CallSid') || '';

    console.log('GET /api/twilio/voice/incoming - From:', from, 'To:', to, 'CallSid:', callSid);

    // Create inbound call record in database
    if (callSid) {
      await createInboundCallRecord(from, to, callSid);
    }

    const twimlString = generateInboundTwiML(from, to, callSid);

    return new Response(twimlString, {
      headers: {
        'Content-Type': 'text/xml',
      },
    });
  } catch (error) {
    console.error('Error generating inbound TwiML (GET):', error);

    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say('Sorry, we are unable to take your call right now. Please try again later.');

    return new Response(twiml.toString(), {
      headers: {
        'Content-Type': 'text/xml',
      },
    });
  }
}

// Handle POST requests (Twilio's default)
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const from = formData.get('From') as string || 'unknown';
    const to = formData.get('To') as string || '';
    const callSid = formData.get('CallSid') as string || '';

    console.log('POST /api/twilio/voice/incoming - From:', from, 'To:', to, 'CallSid:', callSid);

    // Create inbound call record in database
    if (callSid) {
      await createInboundCallRecord(from, to, callSid);
    }

    const twimlString = generateInboundTwiML(from, to, callSid);

    return new Response(twimlString, {
      headers: {
        'Content-Type': 'text/xml',
      },
    });
  } catch (error) {
    console.error('Error generating inbound TwiML (POST):', error);

    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say('Sorry, we are unable to take your call right now. Please try again later.');

    return new Response(twiml.toString(), {
      headers: {
        'Content-Type': 'text/xml',
      },
    });
  }
}
