import twilio from 'twilio';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role for webhooks (no user context)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Store pending calls temporarily (in production, use Redis or database)
const pendingCalls = new Map<string, { customerNumber: string; repIdentity: string; startTime: number }>();

// Format phone number to E.164
function formatE164(phone: string): string {
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');

  // If already has country code (11 digits starting with 1)
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`;
  }

  // If 10 digits, assume US and add +1
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }

  // Otherwise just add + prefix
  return `+${cleaned}`;
}

// Helper to generate TwiML for outbound calls
function generateOutboundTwiML(to: string, from: string, host: string) {
  console.log('Generating TwiML - Outbound call to:', to, 'from rep:', from);
  console.log('Host for TwiML:', host);

  // Format the destination number to E.164
  const formattedTo = formatE164(to);
  console.log('Formatted phone number:', formattedTo);

  // Store pending call info (will be matched when stream starts)
  const pendingCallKey = `pending_${formattedTo}`;
  pendingCalls.set(pendingCallKey, {
    customerNumber: formattedTo,
    repIdentity: from,
    startTime: Date.now(),
  });

  // Build TwiML response
  const twiml = new twilio.twiml.VoiceResponse();

  // Start media stream for real-time transcription
  // Use wss:// for the ngrok tunnel
  const ngrokHost = 'reginald-crinose-unparenthetically.ngrok-free.dev';
  const start = twiml.start();
  start.stream({
    url: `wss://${ngrokHost}/media-stream`,
    track: 'both_tracks',
  });

  // Status callback URL for tracking call status
  const statusCallbackUrl = `https://${ngrokHost}/api/twilio/voice/status`;

  // Dial the number with E.164 format
  const dial = twiml.dial({
    callerId: process.env.TWILIO_PHONE_NUMBER,
    answerOnBridge: true,
  });
  dial.number({
    statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
    statusCallback: statusCallbackUrl,
  }, formattedTo);

  const twimlString = twiml.toString();
  console.log('Generated TwiML:', twimlString);

  return twimlString;
}

// Handle GET requests (Twilio sometimes sends GET)
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const to = searchParams.get('To') || '';
    const from = searchParams.get('From') || searchParams.get('Caller') || 'unknown-rep';
    const host = req.headers.get('host') || 'localhost:3006';

    console.log('GET /api/twilio/voice - To:', to, 'From:', from);

    const twimlString = generateOutboundTwiML(to, from, host);

    return new Response(twimlString, {
      headers: {
        'Content-Type': 'text/xml',
      },
    });
  } catch (error) {
    console.error('Error generating TwiML (GET):', error);

    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say('Sorry, there was an error placing your call. Please try again.');

    return new Response(twiml.toString(), {
      headers: {
        'Content-Type': 'text/xml',
      },
    });
  }
}

// Handle POST requests
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const to = formData.get('To') as string;
    const from = formData.get('From') as string || 'unknown-rep';
    const callSid = formData.get('CallSid') as string;
    const host = req.headers.get('host') || 'localhost:3006';

    // Extract custom params passed from browser
    const userId = formData.get('userId') as string;
    const contactId = formData.get('contactId') as string;

    console.log('POST /api/twilio/voice - To:', to, 'From:', from, 'CallSid:', callSid);
    console.log('Custom params - userId:', userId, 'contactId:', contactId);

    // Create outbound call record in database
    if (to && callSid) {
      const formattedTo = formatE164(to);

      // Get company_id from user's membership if we have userId
      let companyId = null;
      if (userId) {
        const { data: membership } = await supabase
          .from('company_members')
          .select('company_id')
          .eq('user_id', userId)
          .limit(1)
          .single();
        companyId = membership?.company_id;
      }

      // Create call record
      const { data: callRecord, error } = await supabase
        .from('calls')
        .insert({
          direction: 'outbound',
          status: 'initiated',
          phone_number: formattedTo,
          from_number: process.env.TWILIO_PHONE_NUMBER,
          external_call_id: callSid,
          contact_id: contactId || null,
          company_id: companyId,
          rep_id: userId || null,
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to create outbound call record:', error);
      } else {
        console.log('Created outbound call record:', callRecord.id);
      }
    }

    const twimlString = generateOutboundTwiML(to, from, host);

    return new Response(twimlString, {
      headers: {
        'Content-Type': 'text/xml',
      },
    });
  } catch (error) {
    console.error('Error generating TwiML (POST):', error);

    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say('Sorry, there was an error placing your call. Please try again.');

    return new Response(twiml.toString(), {
      headers: {
        'Content-Type': 'text/xml',
      },
    });
  }
}

// Export pending calls for use by other modules
export { pendingCalls };
