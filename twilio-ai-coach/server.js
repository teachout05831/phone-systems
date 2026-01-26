require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const twilio = require('twilio');
const { createClient: createDeepgramClient, LiveTranscriptionEvents } = require('@deepgram/sdk');
const { createClient: createSupabaseClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');

const app = express();
const server = http.createServer(app);

// WebSocket server for Twilio Media Streams
const wss = new WebSocket.Server({ server });

// Browser clients - now track by role (rep vs supervisor)
const browserClients = new Map(); // clientId -> { ws, role, identity, listeningTo }

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// CORS middleware - allow frontend to connect from different ports
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Dashboard page routes (defined BEFORE static middleware)
app.get('/', (req, res) => {
  // Redirect to login page - login.js will redirect to dashboard if already authenticated
  res.redirect('/index.html');
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/call', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'call.html'));
});

app.get('/history', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'history.html'));
});

app.get('/callbacks', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'callbacks.html'));
});

app.get('/supervisor', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'supervisor.html'));
});

app.get('/newsfeed', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'newsfeed.html'));
});

// Health check endpoint for Railway deployment and debugging
app.get('/health', async (req, res) => {
  const startTime = Date.now();

  const checks = {
    server: { status: 'ok' },
    supabase: { status: 'ok' },
    twilio: { status: 'ok' },
    deepgram: { status: 'ok' },
    anthropic: { status: 'ok' },
    environment: { status: 'ok' },
  };

  // Check required environment variables
  const requiredVars = ['SUPABASE_URL', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN'];
  const missingVars = requiredVars.filter(v => !process.env[v] && !process.env[`NEXT_PUBLIC_${v}`]);
  if (missingVars.length > 0) {
    checks.environment = { status: 'error', message: `Missing: ${missingVars.join(', ')}` };
  }

  // Check Supabase connectivity
  if (supabase) {
    try {
      const supabaseStart = Date.now();
      const { error } = await supabase.from('companies').select('id').limit(1);
      if (error) {
        checks.supabase = { status: 'error', message: error.message };
      } else {
        checks.supabase = { status: 'ok', latency: Date.now() - supabaseStart };
      }
    } catch (err) {
      checks.supabase = { status: 'error', message: err.message };
    }
  } else {
    checks.supabase = { status: 'error', message: 'Not configured' };
  }

  // Check Twilio
  if (!twilioClient) {
    checks.twilio = { status: 'error', message: 'Not configured' };
  }

  // Check Deepgram
  if (!process.env.DEEPGRAM_API_KEY) {
    checks.deepgram = { status: 'error', message: 'API key not set' };
  }

  // Check Anthropic
  if (!anthropic) {
    checks.anthropic = { status: 'error', message: 'API key not set' };
  }

  // Determine overall status
  const checkValues = Object.values(checks);
  const hasError = checkValues.some(c => c.status === 'error');
  const criticalChecks = [checks.server, checks.supabase, checks.twilio];
  const hasCriticalError = criticalChecks.some(c => c.status === 'error');

  let status = 'healthy';
  if (hasCriticalError) status = 'unhealthy';
  else if (hasError) status = 'degraded';

  res.status(status === 'unhealthy' ? 503 : 200).json({
    status,
    timestamp: new Date().toISOString(),
    responseTime: Date.now() - startTime,
    activeCalls: activeCalls?.size || 0,
    connectedClients: browserClients?.size || 0,
    checks
  });
});

// Serve static files (CSS, JS, images)
app.use(express.static(path.join(__dirname, 'public')));

// Twilio client
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Deepgram client
const deepgram = createDeepgramClient(process.env.DEEPGRAM_API_KEY);

// Anthropic client for AI coaching
const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
}) : null;

// Supabase client (service role for server-side operations)
// Support both naming conventions for environment variables
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = SUPABASE_URL && SUPABASE_SERVICE_KEY
  ? createSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  : null;

if (!supabase) {
  console.warn('WARNING: Supabase not configured. Call logging will be disabled.');
  console.warn('Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables.');
}

// Store active calls with full metadata
const activeCalls = new Map(); // callSid -> { streamSid, startTime, repIdentity, customerNumber, transcript, audioWs, callMode, deepgramConnection, deepgramReconnectAttempts }

// Store call transcripts for AI analysis
const callTranscripts = new Map(); // callSid -> [{ speaker, text, timestamp }]

// Deepgram reconnection settings
const DEEPGRAM_MAX_RECONNECT_ATTEMPTS = 3;
const DEEPGRAM_RECONNECT_DELAY_MS = 1000;
const DEEPGRAM_BUFFER_MAX_SIZE = 50; // Max audio chunks to buffer during reconnect

// AI Coaching settings - more frequent coaching
const AI_COACHING_INTERVAL = 2; // Trigger AI coaching every N final transcripts (changed from 3)
const AI_COACHING_MIN_TRANSCRIPT_LENGTH = 3; // Minimum transcript exchanges before coaching

// ============ SUPABASE HELPER FUNCTIONS ============
// These functions handle call logging to Supabase database

/**
 * Create a new call record in Supabase when a call starts
 * @param {Object} callData - Call information
 * @returns {Object|null} - Created call record or null on error
 */
async function createCallRecord(callData) {
  if (!supabase) {
    console.log('Supabase not configured - skipping call record creation');
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('calls')
      .insert({
        external_call_id: callData.callSid,
        company_id: callData.companyId || null,
        contact_id: callData.contactId || null,
        rep_id: callData.repId || null,
        direction: callData.direction || 'outbound',
        phone_number: callData.phoneNumber,
        from_number: callData.fromNumber || process.env.TWILIO_PHONE_NUMBER,
        status: 'in_progress',
        started_at: new Date().toISOString()
      })
      .select('id, external_call_id')
      .single();

    if (error) {
      console.error('Error creating call record:', error);
      return null;
    }

    console.log(`Call record created: ${data.id} (external: ${callData.callSid})`);
    return data;
  } catch (err) {
    console.error('Exception creating call record:', err);
    return null;
  }
}

/**
 * Update call record when call ends
 * @param {string} callSid - Twilio call SID
 * @param {Object} updateData - Data to update
 * @returns {Object|null} - Updated call record or null on error
 */
async function updateCallRecord(callSid, updateData) {
  if (!supabase) {
    console.log('Supabase not configured - skipping call record update');
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('calls')
      .update({
        status: updateData.status || 'completed',
        ended_at: updateData.endedAt || new Date().toISOString(),
        duration_seconds: updateData.durationSeconds || 0,
        outcome: updateData.outcome || null,
        has_recording: updateData.hasRecording || false,
        recording_url: updateData.recordingUrl || null,
        recording_duration_seconds: updateData.recordingDurationSeconds || null,
        updated_at: new Date().toISOString()
      })
      .eq('external_call_id', callSid)
      .select('id')
      .single();

    if (error) {
      console.error('Error updating call record:', error);
      return null;
    }

    console.log(`Call record updated: ${callSid}`);
    return data;
  } catch (err) {
    console.error('Exception updating call record:', err);
    return null;
  }
}

/**
 * Save transcript to Supabase
 * @param {string} callSid - Twilio call SID
 * @param {Array} segments - Transcript segments [{text, timestamp, isFinal}]
 * @returns {Object|null} - Created transcript record or null on error
 */
async function saveTranscript(callSid, segments) {
  if (!supabase) {
    console.log('Supabase not configured - skipping transcript save');
    return null;
  }

  try {
    // First get the call ID from external_call_id
    const { data: call, error: callError } = await supabase
      .from('calls')
      .select('id')
      .eq('external_call_id', callSid)
      .single();

    if (callError || !call) {
      console.error('Error finding call for transcript:', callError);
      return null;
    }

    // Format segments for storage
    const formattedSegments = segments.map((seg, index) => ({
      speaker: index % 2 === 0 ? 'rep' : 'customer',
      text: seg.text,
      timestamp: seg.timestamp
    }));

    // Create full text for search
    const fullText = segments.map(s => s.text).join(' ');

    const { data, error } = await supabase
      .from('call_transcripts')
      .insert({
        call_id: call.id,
        segments: formattedSegments,
        full_text: fullText,
        word_count: fullText.split(/\s+/).length,
        duration_seconds: segments.length > 0
          ? Math.floor((new Date(segments[segments.length - 1].timestamp) - new Date(segments[0].timestamp)) / 1000)
          : 0
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error saving transcript:', error);
      return null;
    }

    console.log(`Transcript saved for call ${callSid}: ${data.id}`);
    return data;
  } catch (err) {
    console.error('Exception saving transcript:', err);
    return null;
  }
}

/**
 * Save call analysis to Supabase
 * @param {string} callSid - Twilio call SID
 * @param {Object} analysis - AI analysis results
 * @returns {Object|null} - Created analysis record or null on error
 */
async function saveCallAnalysis(callSid, analysis) {
  if (!supabase) {
    console.log('Supabase not configured - skipping analysis save');
    return null;
  }

  try {
    // First get the call ID and transcript ID
    const { data: call, error: callError } = await supabase
      .from('calls')
      .select('id')
      .eq('external_call_id', callSid)
      .single();

    if (callError || !call) {
      console.error('Error finding call for analysis:', callError);
      return null;
    }

    // Get the transcript ID if it exists
    const { data: transcript } = await supabase
      .from('call_transcripts')
      .select('id')
      .eq('call_id', call.id)
      .single();

    const { data, error } = await supabase
      .from('call_analysis')
      .insert({
        call_id: call.id,
        transcript_id: transcript?.id || null,
        analysis_type: 'post_call',
        summary: analysis.summary,
        sentiment: analysis.sentiment,
        sentiment_score: analysis.sentimentScore,
        key_points: analysis.keyPoints || [],
        objections_raised: analysis.objections || [],
        buying_signals: analysis.buyingSignals || [],
        action_items: analysis.actionItems || [],
        talk_ratio: analysis.talkRatio || {},
        questions_asked: analysis.questionsAsked || 0,
        predicted_outcome: analysis.predictedOutcome,
        confidence_score: analysis.confidenceScore,
        coaching_tips: analysis.coachingTips || [],
        model_used: analysis.modelUsed || 'claude-3-haiku-20240307',
        tokens_used: analysis.tokensUsed || null
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error saving call analysis:', error);
      return null;
    }

    console.log(`Call analysis saved for ${callSid}: ${data.id}`);
    return data;
  } catch (err) {
    console.error('Exception saving call analysis:', err);
    return null;
  }
}

/**
 * Perform post-call AI analysis on transcript
 * @param {string} callSid - Twilio call SID
 * @param {string} transcriptText - Full transcript text
 * @returns {Object|null} - Analysis results or null on error
 */
async function performPostCallAnalysis(callSid, transcriptText) {
  if (!anthropic) {
    console.log('Anthropic API key not configured - skipping post-call analysis');
    return null;
  }

  if (!transcriptText || transcriptText.length < 50) {
    console.log('Transcript too short for analysis');
    return null;
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1500,
      system: `You are a sales call analyst. Analyze the following call transcript and provide a structured analysis in JSON format. Focus on:

1. Brief summary (2-3 sentences)
2. Overall sentiment (positive, neutral, negative, mixed) and score (-1.0 to 1.0)
3. Key points discussed (max 5)
4. Objections raised and whether they were handled
5. Buying signals detected
6. Action items for follow-up
7. Predicted outcome (booked, callback, interested, not_interested, uncertain) with confidence
8. Coaching tips for the sales rep (max 3)

Respond ONLY with valid JSON, no other text.`,
      messages: [{
        role: 'user',
        content: `Analyze this sales call transcript:\n\n${transcriptText}\n\nProvide JSON analysis:`
      }]
    });

    const responseText = response.content[0].text.trim();

    // Parse the JSON response
    let analysis;
    try {
      analysis = JSON.parse(responseText);
    } catch (parseError) {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        console.error('Failed to parse AI response as JSON');
        return null;
      }
    }

    // Normalize the analysis structure
    const normalizedAnalysis = {
      summary: analysis.summary || analysis.brief_summary || '',
      sentiment: (analysis.sentiment || analysis.overall_sentiment || 'neutral').toLowerCase(),
      sentimentScore: analysis.sentiment_score || analysis.sentimentScore || 0,
      keyPoints: (analysis.key_points || analysis.keyPoints || []).map(p =>
        typeof p === 'string' ? { point: p, importance: 'medium' } : p
      ),
      objections: analysis.objections_raised || analysis.objections || [],
      buyingSignals: analysis.buying_signals || analysis.buyingSignals || [],
      actionItems: analysis.action_items || analysis.actionItems || [],
      talkRatio: analysis.talk_ratio || analysis.talkRatio || {},
      questionsAsked: analysis.questions_asked || 0,
      predictedOutcome: analysis.predicted_outcome || analysis.predictedOutcome || 'uncertain',
      confidenceScore: analysis.confidence || analysis.confidence_score || 0.5,
      coachingTips: (analysis.coaching_tips || analysis.coachingTips || []).map(t =>
        typeof t === 'string' ? { tip: t, category: 'general' } : t
      ),
      modelUsed: 'claude-3-haiku-20240307',
      tokensUsed: response.usage?.input_tokens + response.usage?.output_tokens || null
    };

    // Save to database
    await saveCallAnalysis(callSid, normalizedAnalysis);

    return normalizedAnalysis;
  } catch (error) {
    console.error('Post-call analysis error:', error.message);
    return null;
  }
}

/**
 * Update call with recording info
 * @param {string} callSid - Twilio call SID
 * @param {Object} recordingData - Recording information
 */
async function updateCallRecording(callSid, recordingData) {
  if (!supabase) return null;

  try {
    const { error } = await supabase
      .from('calls')
      .update({
        has_recording: true,
        recording_url: recordingData.recordingUrl,
        recording_duration_seconds: recordingData.recordingDuration,
        updated_at: new Date().toISOString()
      })
      .eq('external_call_id', callSid);

    if (error) {
      console.error('Error updating call recording:', error);
      return null;
    }

    console.log(`Recording info saved for call ${callSid}`);
    return true;
  } catch (err) {
    console.error('Exception updating call recording:', err);
    return null;
  }
}

// Generate access token for Twilio Client (browser softphone)
app.get('/token', (req, res) => {
  const AccessToken = twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;

  const identity = req.query.identity || 'sales-rep-' + Date.now();
  console.log('Token requested for identity:', identity);

  const accessToken = new AccessToken(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_API_KEY_SID,
    process.env.TWILIO_API_KEY_SECRET,
    { identity: identity }
  );

  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: process.env.TWILIO_TWIML_APP_SID,
    incomingAllow: true
  });

  accessToken.addGrant(voiceGrant);

  res.json({
    token: accessToken.toJwt(),
    identity: identity
  });
});

// TwiML for outbound calls from browser
// Supports both Basic Mode (Twilio transcription) and Advanced Mode (Deepgram streaming)
app.post('/voice-outbound', (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  // Fix: URL-encoded '+' becomes space, so convert leading space back to '+'
  let to = req.body.To;
  if (to && to.startsWith(' ')) {
    to = '+' + to.trim();
  }
  const from = req.body.From || 'unknown-rep';
  const callMode = req.body.CallMode || 'basic'; // 'basic' or 'advanced'

  // Validate required fields
  if (!to) {
    console.error('voice-outbound missing To parameter');
    twiml.say('Error: No phone number provided');
    res.type('text/xml');
    return res.send(twiml.toString());
  }

  console.log(`Outbound call to: ${to}, from rep: ${from}, mode: ${callMode}`);

  // Store pending call info (will be matched when stream starts or call status updates)
  const pendingCallKey = `pending_${to}`;
  activeCalls.set(pendingCallKey, {
    customerNumber: to,
    repIdentity: from,
    startTime: Date.now(),
    callMode: callMode
  });

  if (callMode === 'advanced') {
    // ADVANCED MODE: Use Deepgram for live transcription
    // Start media stream for real-time transcription
    const start = twiml.start();
    start.stream({
      url: `wss://${req.headers.host}/media-stream`,
      track: 'both_tracks'
    });

    // Dial with recording (no transcription - Deepgram handles it)
    const dial = twiml.dial({
      callerId: process.env.TWILIO_PHONE_NUMBER,
      answerOnBridge: true,
      record: 'record-from-answer-dual',
      recordingStatusCallback: `https://${req.headers.host}/recording-callback`,
      recordingStatusCallbackEvent: 'completed'
    });
    dial.number(to);
  } else {
    // BASIC MODE: Simple dial with recording
    const dial = twiml.dial({
      callerId: process.env.TWILIO_PHONE_NUMBER,
      answerOnBridge: true,
      record: 'record-from-answer-dual',
      recordingStatusCallback: `https://${req.headers.host}/recording-callback`,
      recordingStatusCallbackEvent: 'completed'
    });
    dial.number(to);
  }

  res.type('text/xml');
  res.send(twiml.toString());
});

// Alternative: Basic mode outbound endpoint (explicit)
app.post('/voice-outbound-basic', (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  // Fix: URL-encoded '+' becomes space, so convert leading space back to '+'
  let to = req.body.To;
  if (to && to.startsWith(' ')) {
    to = '+' + to.trim();
  }
  const from = req.body.From || 'unknown-rep';

  // Validate required fields
  if (!to) {
    console.error('voice-outbound-basic missing To parameter');
    twiml.say('Error: No phone number provided');
    res.type('text/xml');
    return res.send(twiml.toString());
  }

  console.log(`Basic mode outbound call to: ${to}, from rep: ${from}`);

  // Store pending call info
  const pendingCallKey = `pending_${to}`;
  activeCalls.set(pendingCallKey, {
    customerNumber: to,
    repIdentity: from,
    startTime: Date.now(),
    callMode: 'basic'
  });

  // Basic mode: Direct dial with Twilio transcription
  const dial = twiml.dial({
    callerId: process.env.TWILIO_PHONE_NUMBER,
    answerOnBridge: true,
    record: 'record-from-answer-dual',
    recordingStatusCallback: `https://${req.headers.host}/recording-callback`,
    recordingStatusCallbackEvent: 'completed',
    transcribe: true,
    transcribeCallback: `https://${req.headers.host}/transcript-callback`
  });
  dial.number(to);

  res.type('text/xml');
  res.send(twiml.toString());
});

// TwiML for incoming calls
app.post('/voice-incoming', (req, res) => {
  incomingCallHandler(req, res);
});

// Alias for incoming calls (for phone number webhook)
app.post('/api/twilio/voice/incoming', (req, res) => {
  incomingCallHandler(req, res);
});

// Call forwarding number (can be set via environment variable or settings)
let callForwardingNumber = process.env.CALL_FORWARDING_NUMBER || null;

// API endpoint to get/set forwarding number
app.get('/api/settings/forwarding', (req, res) => {
  res.json({ forwardingNumber: callForwardingNumber });
});

app.post('/api/settings/forwarding', (req, res) => {
  const { forwardingNumber } = req.body;
  callForwardingNumber = forwardingNumber || null;
  console.log('Call forwarding number updated:', callForwardingNumber || 'disabled');
  res.json({ success: true, forwardingNumber: callForwardingNumber });
});

// Shared handler for incoming calls
function incomingCallHandler(req, res) {
  const twiml = new twilio.twiml.VoiceResponse();
  const from = req.body.From || 'Unknown';

  console.log(`Incoming call from: ${from}`);

  // First, say something so we know TwiML is working
  twiml.say({ voice: 'alice' }, 'Hello, connecting you to a sales representative.');

  // Then dial the browser client with an action URL to handle no-answer
  const dial = twiml.dial({
    timeout: 20,
    action: `https://${req.headers.host}/voice-incoming-status`
  });
  dial.client('sales-rep');

  const twimlString = twiml.toString();
  console.log(`Returning TwiML for incoming call:`, twimlString);

  res.type('text/xml');
  res.send(twimlString);
}

// Handler for incoming call status (after dial completes)
app.post('/voice-incoming-status', (req, res) => {
  const dialStatus = req.body.DialCallStatus;
  console.log('Incoming call dial completed:', dialStatus);

  const twiml = new twilio.twiml.VoiceResponse();

  // If the call was answered and completed normally, just end
  if (dialStatus === 'completed') {
    twiml.hangup();
  } else {
    // Call was not answered (busy, no-answer, failed, canceled)
    console.log('Call not answered, checking forwarding...');

    if (callForwardingNumber) {
      console.log('Forwarding to:', callForwardingNumber);
      twiml.say({ voice: 'alice' }, 'Please hold while we transfer your call.');

      const dial = twiml.dial({
        callerId: process.env.TWILIO_PHONE_NUMBER,
        timeout: 30
      });
      dial.number(callForwardingNumber);

      // If forwarding also fails
      twiml.say({ voice: 'alice' }, 'We were unable to complete your call. Please try again later.');
    } else {
      twiml.say({ voice: 'alice' }, 'Sorry, the representative is not available. Please try again later.');
    }
  }

  res.type('text/xml');
  res.send(twiml.toString());
});

// Recording callback - store recording URL when complete
app.post('/recording-callback', async (req, res) => {
  const { RecordingUrl, CallSid, RecordingDuration } = req.body;

  console.log(`Recording completed for call ${CallSid}: ${RecordingUrl}`);

  // Update call record in Supabase with recording info
  await updateCallRecording(CallSid, {
    recordingUrl: RecordingUrl + '.mp3',
    recordingDuration: parseInt(RecordingDuration) || 0
  });

  res.sendStatus(200);
});

// ============ TWILIO VOICE INTELLIGENCE WEBHOOK (BASIC MODE) ============
// This webhook receives transcripts after the call ends from Twilio Voice Intelligence

app.post('/transcript-callback', async (req, res) => {
  try {
    const {
      CallSid,
      TranscriptionText,
      TranscriptionStatus
    } = req.body;

    // Validate required fields
    if (!CallSid) {
      console.error('Transcript callback missing CallSid');
      return res.sendStatus(400);
    }

    console.log(`Transcript callback for call ${CallSid}: status=${TranscriptionStatus}`);

    if (TranscriptionStatus === 'completed' && TranscriptionText) {
      console.log(`Transcript received (${TranscriptionText.length} chars)`);

      // Save transcript to Supabase
      const segments = [{
        text: TranscriptionText,
        timestamp: new Date().toISOString(),
        isFinal: true
      }];

      await saveTranscript(CallSid, segments);

      // Trigger post-call AI analysis
      console.log(`Starting post-call analysis for ${CallSid}`);
      const analysis = await performPostCallAnalysis(CallSid, TranscriptionText);

      if (analysis) {
        console.log(`Analysis complete for ${CallSid}: ${analysis.sentiment}, predicted: ${analysis.predictedOutcome}`);
      }
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Error processing transcript callback:', error);
    res.sendStatus(500);
  }
});

// Twilio Voice Intelligence detailed transcript webhook (JSON format)
app.post('/voice-intelligence-callback', async (req, res) => {
  try {
    const { CallSid } = req.body;
    const transcriptData = req.body;

    // Validate required fields
    if (!CallSid) {
      console.error('Voice Intelligence callback missing CallSid');
      return res.sendStatus(400);
    }

    console.log(`Voice Intelligence callback for call ${CallSid}`);

    // Voice Intelligence sends more detailed data including speaker diarization
    if (transcriptData.transcript) {
      // Parse the transcript with speaker labels
      const segments = [];
      let fullText = '';

      if (Array.isArray(transcriptData.transcript.utterances)) {
        transcriptData.transcript.utterances.forEach(utterance => {
          segments.push({
            speaker: utterance.channel === 0 ? 'rep' : 'customer',
            text: utterance.transcript,
            timestamp: utterance.start_time,
            confidence: utterance.confidence
          });
          fullText += utterance.transcript + ' ';
        });
      } else if (transcriptData.transcript.text) {
        fullText = transcriptData.transcript.text;
        segments.push({
          speaker: 'unknown',
          text: fullText,
          timestamp: new Date().toISOString()
        });
      }

      // Save to database
      if (segments.length > 0) {
        await saveTranscript(CallSid, segments);

        // Run post-call analysis
        const analysis = await performPostCallAnalysis(CallSid, fullText.trim());
        if (analysis) {
          console.log(`Voice Intelligence analysis complete for ${CallSid}`);
        }
      }
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Error processing Voice Intelligence callback:', error);
    res.sendStatus(500);
  }
});

// Manual trigger for post-call analysis (for testing or re-analysis)
app.post('/api/analyze-call', async (req, res) => {
  try {
    const { callSid, transcriptText } = req.body;

    if (!callSid) {
      return res.status(400).json({ error: 'callSid is required' });
    }

    let transcript = transcriptText;

    // If no transcript provided, try to get from memory or database
    if (!transcript) {
      const storedTranscript = callTranscripts.get(callSid);
      if (storedTranscript && storedTranscript.length > 0) {
        transcript = storedTranscript.map(t => t.text).join(' ');
      }
    }

    if (!transcript) {
      return res.status(400).json({ error: 'No transcript available for analysis' });
    }

    const analysis = await performPostCallAnalysis(callSid, transcript);

    if (analysis) {
      res.json({ success: true, analysis });
    } else {
      res.status(500).json({ error: 'Analysis failed' });
    }
  } catch (error) {
    console.error('Error in manual analysis:', error);
    res.status(500).json({ error: error.message });
  }
});

// End a call
app.post('/end-call', async (req, res) => {
  try {
    const { callSid } = req.body;

    if (callSid) {
      await twilioClient.calls(callSid).update({ status: 'completed' });
      res.json({ success: true });
    } else {
      res.status(400).json({ success: false, error: 'No callSid provided' });
    }
  } catch (error) {
    console.error('Error ending call:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ RETELL AI ENDPOINTS ============

// Get available AI agents
app.get('/api/ai-agents', (req, res) => {
  const agents = [
    {
      id: process.env.RETELL_AGENT_ID || 'default',
      name: 'Default Agent',
      description: 'Standard outbound sales agent',
      type: 'outbound-caller'
    },
    {
      id: 'agent_closer',
      name: 'The Closer',
      description: 'Sales conversion specialist for warm leads',
      type: 'closer'
    },
    {
      id: 'agent_ralph',
      name: 'Ralph Wiggum',
      description: 'Friendly initial contact agent',
      type: 'ralph-wiggum'
    }
  ];
  res.json({ agents });
});

// Dispatch AI agent to make a call
app.post('/api/ai-call', async (req, res) => {
  const { phoneNumber, agentId, contactName, queueId } = req.body;

  if (!phoneNumber) {
    return res.status(400).json({ error: 'Phone number is required' });
  }

  const selectedAgentId = agentId || process.env.RETELL_AGENT_ID;

  if (!selectedAgentId) {
    return res.status(400).json({ error: 'No AI agent configured' });
  }

  try {
    console.log(`Dispatching AI agent ${selectedAgentId} to call ${phoneNumber}`);

    // Call Retell API to create an outbound call
    const retellResponse = await fetch('https://api.retellai.com/v2/create-phone-call', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RETELL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        agent_id: selectedAgentId,
        to_number: phoneNumber,
        from_number: process.env.TWILIO_PHONE_NUMBER,
        metadata: {
          contact_name: contactName || 'Unknown',
          queue_id: queueId || null
        }
      })
    });

    if (!retellResponse.ok) {
      const errorData = await retellResponse.json();
      console.error('Retell API error:', errorData);
      return res.status(retellResponse.status).json({
        error: 'Failed to dispatch AI call',
        details: errorData
      });
    }

    const callData = await retellResponse.json();
    console.log('AI call dispatched successfully:', callData);

    res.json({
      success: true,
      callId: callData.call_id,
      message: `AI agent calling ${contactName || phoneNumber}...`
    });

  } catch (error) {
    console.error('Error dispatching AI call:', error);
    res.status(500).json({ error: 'Failed to dispatch AI call', details: error.message });
  }
});

// ============ REAL-TIME CALL ENDPOINTS (for supervisor monitoring) ============
// These endpoints return data about ACTIVE calls only (in-memory)
// Historical data is queried from Supabase via Next.js

// Get all active calls (live calls currently in progress)
app.get('/active-calls', (req, res) => {
  const calls = [];
  activeCalls.forEach((callData, callSid) => {
    // Skip pending calls (not yet connected)
    if (callSid.startsWith('pending_')) return;

    calls.push({
      callSid,
      repIdentity: callData.repIdentity || 'Unknown Rep',
      customerNumber: callData.customerNumber || 'Unknown',
      startTime: callData.startTime,
      duration: Math.floor((Date.now() - callData.startTime) / 1000),
      transcriptLength: (callTranscripts.get(callSid) || []).length
    });
  });
  res.json({ calls });
});

// AI Coaching - analyze transcript and provide suggestions
async function getAICoachingSuggestion(callSid, latestTranscript) {
  if (!anthropic) {
    console.log('Anthropic API key not configured - skipping AI coaching');
    return null;
  }

  const transcript = callTranscripts.get(callSid) || [];
  if (transcript.length < 3) return null; // Need some context

  // Get last 10 exchanges for context
  const recentTranscript = transcript.slice(-10).map(t => t.text).join('\n');

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 150,
      system: `You are a real-time sales coach. Analyze the conversation and provide ONE brief, actionable suggestion to help the sales rep. Focus on:
- Objection handling
- Building rapport
- Closing techniques
- Asking better questions
Keep suggestions under 20 words. Be specific and actionable. If no suggestion needed, respond with "NONE".`,
      messages: [{
        role: 'user',
        content: `Recent call transcript:\n${recentTranscript}\n\nLatest: "${latestTranscript}"\n\nProvide one coaching tip:`
      }]
    });

    const suggestion = response.content[0].text.trim();
    if (suggestion === 'NONE' || suggestion.length < 5) return null;

    return suggestion;
  } catch (error) {
    console.error('AI coaching error:', error.message);
    return null;
  }
}

// Legacy: Make an outbound call (server-initiated)
app.post('/make-call', async (req, res) => {
  try {
    const { to } = req.body;

    const call = await twilioClient.calls.create({
      url: `https://${req.headers.host}/voice-outbound`,
      to: to,
      from: process.env.TWILIO_PHONE_NUMBER
    });

    res.json({ success: true, callSid: call.sid });
  } catch (error) {
    console.error('Error making call:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ SMS API ENDPOINTS ============

/**
 * Send SMS message via Twilio
 * POST /api/sms/send
 * Body: { to: string, body: string, conversationId: string }
 */
app.post('/api/sms/send', async (req, res) => {
  try {
    const { to, body, conversationId } = req.body;

    // Validate inputs
    if (!to || !body) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: to, body'
      });
    }

    // Clean and format phone number
    let toNumber = to.replace(/\D/g, '');
    if (toNumber.length === 10) {
      toNumber = '+1' + toNumber;
    } else if (!toNumber.startsWith('+')) {
      toNumber = '+' + toNumber;
    }

    // Send via Twilio
    const message = await twilioClient.messages.create({
      body: body,
      to: toNumber,
      from: process.env.TWILIO_PHONE_NUMBER
    });

    console.log(`SMS sent to ${toNumber}: ${message.sid}`);

    // Update message status in database if conversationId provided
    if (supabase && conversationId) {
      // Update the conversation's last message
      await supabase
        .from('sms_conversations')
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: body.substring(0, 100)
        })
        .eq('id', conversationId);
    }

    res.json({
      success: true,
      messageSid: message.sid,
      status: message.status,
      fromNumber: process.env.TWILIO_PHONE_NUMBER
    });

  } catch (error) {
    console.error('Error sending SMS:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send SMS'
    });
  }
});

/**
 * Twilio SMS webhook - receives incoming SMS
 * POST /api/sms/incoming
 */
app.post('/api/sms/incoming', async (req, res) => {
  try {
    const { From, To, Body, MessageSid } = req.body;

    console.log(`Incoming SMS from ${From}: ${Body}`);

    if (supabase) {
      // Find or create conversation
      let { data: conversation } = await supabase
        .from('sms_conversations')
        .select('id, company_id')
        .eq('phone_number', From)
        .single();

      if (!conversation) {
        // Create new conversation - need to determine company_id
        // For now, skip if no existing conversation
        console.log('No existing conversation found for:', From);
      } else {
        // Add message to conversation
        await supabase
          .from('sms_messages')
          .insert({
            conversation_id: conversation.id,
            company_id: conversation.company_id,
            direction: 'inbound',
            from_number: From,
            to_number: To,
            body: Body,
            status: 'received',
            twilio_sid: MessageSid
          });

        // Update conversation - use RPC or select+update since raw() isn't available
        const { data: currentConv } = await supabase
          .from('sms_conversations')
          .select('unread_count')
          .eq('id', conversation.id)
          .single();

        await supabase
          .from('sms_conversations')
          .update({
            last_message_at: new Date().toISOString(),
            last_message_preview: Body.substring(0, 100),
            unread_count: (currentConv?.unread_count || 0) + 1
          })
          .eq('id', conversation.id);
      }
    }

    // Respond to Twilio
    res.type('text/xml');
    res.send('<Response></Response>');

  } catch (error) {
    console.error('Error handling incoming SMS:', error);
    res.type('text/xml');
    res.send('<Response></Response>');
  }
});

/**
 * SMS status callback from Twilio
 * POST /api/sms/status
 */
app.post('/api/sms/status', async (req, res) => {
  try {
    const { MessageSid, MessageStatus, To } = req.body;

    console.log(`SMS status update: ${MessageSid} -> ${MessageStatus}`);

    if (supabase) {
      // Update message status
      await supabase
        .from('sms_messages')
        .update({ status: MessageStatus, updated_at: new Date().toISOString() })
        .eq('twilio_sid', MessageSid);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Error handling SMS status:', error);
    res.sendStatus(200);
  }
});

// Helper to broadcast to browser clients
function broadcastToClients(message, filter = null) {
  const msgString = typeof message === 'string' ? message : JSON.stringify(message);
  browserClients.forEach((clientData, clientId) => {
    if (clientData.ws.readyState === WebSocket.OPEN) {
      if (!filter || filter(clientData)) {
        clientData.ws.send(msgString);
      }
    }
  });
}

// WebSocket handler for Twilio Media Streams
wss.on('connection', (ws, req) => {
  console.log('New WebSocket connection:', req.url);

  // Check if this is a browser client (rep or supervisor)
  if (req.url.startsWith('/browser')) {
    const urlParams = new URL('http://localhost' + req.url);
    const role = urlParams.searchParams.get('role') || 'rep';
    const identity = urlParams.searchParams.get('identity') || 'unknown';
    const clientId = `${role}_${identity}_${Date.now()}`;

    console.log(`Browser client connected: ${role} - ${identity}`);

    browserClients.set(clientId, {
      ws,
      role,
      identity,
      listeningTo: null // callSid if supervisor is listening
    });

    // Handle messages from browser clients
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data);

        // Supervisor wants to listen to a call
        if (msg.type === 'listen_to_call') {
          const clientData = browserClients.get(clientId);
          if (clientData) {
            clientData.listeningTo = msg.callSid;
            console.log(`Supervisor ${identity} now listening to call ${msg.callSid}`);

            // Send current transcript to supervisor
            const transcript = callTranscripts.get(msg.callSid) || [];
            ws.send(JSON.stringify({
              type: 'full_transcript',
              callSid: msg.callSid,
              transcript
            }));
          }
        }

        // Stop listening
        if (msg.type === 'stop_listening') {
          const clientData = browserClients.get(clientId);
          if (clientData) {
            clientData.listeningTo = null;
            console.log(`Supervisor ${identity} stopped listening`);
          }
        }
      } catch (e) {
        // Ignore non-JSON messages
      }
    });

    ws.on('close', () => {
      browserClients.delete(clientId);
      console.log(`Browser client disconnected: ${role} - ${identity}`);
    });
    return;
  }

  // This is a Twilio Media Stream
  console.log('Twilio Media Stream connected');

  let streamSid = null;
  let callSid = null;
  let deepgramConnection = null;
  let deepgramReconnectAttempts = 0;
  let isDeepgramReconnecting = false;
  let pendingAudioBuffer = [];

  // Set up Deepgram live transcription with reconnection support
  const setupDeepgram = async (isReconnect = false) => {
    if (isReconnect) {
      console.log(`Attempting Deepgram reconnection (attempt ${deepgramReconnectAttempts + 1}/${DEEPGRAM_MAX_RECONNECT_ATTEMPTS})`);
    }

    try {
      deepgramConnection = deepgram.listen.live({
        model: 'nova-2-phonecall',   // Optimized for phone call audio
        language: 'en-US',
        smart_format: true,
        punctuate: true,             // Better punctuation
        profanity_filter: false,     // Don't filter words (sales context)
        diarize: false,              // We handle speakers separately
        filler_words: true,          // Keep "um", "uh" for coaching insights
        interim_results: true,
        utterance_end_ms: 300,       // Fast end detection
        endpointing: 200,            // Fast endpoint detection
        vad_events: true,
        encoding: 'mulaw',
        sample_rate: 8000,
        channels: 1
      });

      deepgramConnection.on(LiveTranscriptionEvents.Open, () => {
        console.log('Deepgram connection opened' + (isReconnect ? ' (reconnected)' : ''));
        deepgramReconnectAttempts = 0;
        isDeepgramReconnecting = false;

        // Flush any buffered audio
        if (pendingAudioBuffer.length > 0) {
          console.log(`Flushing ${pendingAudioBuffer.length} buffered audio chunks`);
          pendingAudioBuffer.forEach(audio => {
            if (deepgramConnection) {
              deepgramConnection.send(audio);
            }
          });
          pendingAudioBuffer = [];
        }

        // Notify browser clients that transcription is active
        if (callSid) {
          broadcastToClients({
            type: 'transcription_status',
            callSid,
            status: 'active',
            message: isReconnect ? 'Transcription reconnected' : 'Transcription started'
          }, (client) => client.role === 'rep');
        }
      });

      deepgramConnection.on(LiveTranscriptionEvents.Transcript, async (data) => {
        const transcript = data.channel?.alternatives[0]?.transcript;

        if (transcript) {
          const isFinal = data.is_final;
          const timestamp = new Date().toISOString();

          console.log(`[${isFinal ? 'FINAL' : 'interim'}] ${transcript}`);

          // Store final transcripts for AI analysis
          if (isFinal && callSid) {
            if (!callTranscripts.has(callSid)) {
              callTranscripts.set(callSid, []);
            }
            callTranscripts.get(callSid).push({
              text: transcript,
              timestamp,
              isFinal: true
            });

            // Trigger AI coaching more frequently (every AI_COACHING_INTERVAL final transcripts)
            const transcriptCount = callTranscripts.get(callSid).length;
            if (transcriptCount >= AI_COACHING_MIN_TRANSCRIPT_LENGTH &&
                transcriptCount % AI_COACHING_INTERVAL === 0) {
              const suggestion = await getAICoachingSuggestion(callSid, transcript);
              if (suggestion) {
                const coachMsg = {
                  type: 'ai_coaching',
                  callSid,
                  suggestion,
                  timestamp
                };
                // Send to rep on this call
                broadcastToClients(coachMsg, (client) => client.role === 'rep');
                // Also send to supervisors listening to this call
                broadcastToClients(coachMsg, (client) =>
                  client.role === 'supervisor' && client.listeningTo === callSid
                );
              }
            }
          }

          // Send transcript to all browser clients
          const message = {
            type: 'transcript',
            callSid,
            text: transcript,
            isFinal: isFinal,
            timestamp
          };

          // Send to reps
          broadcastToClients(message, (client) => client.role === 'rep');

          // Send to supervisors listening to this specific call
          broadcastToClients(message, (client) =>
            client.role === 'supervisor' && client.listeningTo === callSid
          );
        }
      });

      deepgramConnection.on(LiveTranscriptionEvents.Error, (error) => {
        console.error('Deepgram error:', error);
        handleDeepgramError(error);
      });

      deepgramConnection.on(LiveTranscriptionEvents.Close, () => {
        console.log('Deepgram connection closed');
        // Only attempt reconnect if not intentionally closed and call is still active
        if (callSid && activeCalls.has(callSid) && !isDeepgramReconnecting) {
          handleDeepgramDisconnect();
        }
      });

    } catch (error) {
      console.error('Error setting up Deepgram:', error);
      handleDeepgramError(error);
    }
  };

  // Handle Deepgram errors with reconnection
  const handleDeepgramError = (error) => {
    console.error('Deepgram error occurred:', error.message || error);

    // Notify browser about transcription issue
    if (callSid) {
      broadcastToClients({
        type: 'transcription_status',
        callSid,
        status: 'error',
        message: 'Transcription error - attempting recovery'
      }, (client) => client.role === 'rep');
    }

    handleDeepgramDisconnect();
  };

  // Handle Deepgram disconnection with reconnection logic
  const handleDeepgramDisconnect = () => {
    if (isDeepgramReconnecting) return;

    // Check if call is still active
    if (!callSid || !activeCalls.has(callSid)) {
      console.log('Call ended, not attempting Deepgram reconnection');
      return;
    }

    if (deepgramReconnectAttempts >= DEEPGRAM_MAX_RECONNECT_ATTEMPTS) {
      console.log('Max Deepgram reconnection attempts reached');

      // Notify browser to fall back
      broadcastToClients({
        type: 'transcription_status',
        callSid,
        status: 'failed',
        message: 'Live transcription unavailable. Recording continues.'
      }, (client) => client.role === 'rep');

      // Clear the connection
      deepgramConnection = null;
      return;
    }

    isDeepgramReconnecting = true;
    deepgramReconnectAttempts++;

    // Notify browser about reconnection attempt
    broadcastToClients({
      type: 'transcription_status',
      callSid,
      status: 'reconnecting',
      attempt: deepgramReconnectAttempts,
      maxAttempts: DEEPGRAM_MAX_RECONNECT_ATTEMPTS
    }, (client) => client.role === 'rep');

    // Exponential backoff for reconnection
    const delay = DEEPGRAM_RECONNECT_DELAY_MS * Math.pow(2, deepgramReconnectAttempts - 1);
    console.log(`Scheduling Deepgram reconnection in ${delay}ms`);

    setTimeout(() => {
      if (callSid && activeCalls.has(callSid)) {
        setupDeepgram(true);
      } else {
        console.log('Call ended during reconnection delay');
        isDeepgramReconnecting = false;
      }
    }, delay);
  };

  // Buffer audio during reconnection
  const bufferAudio = (audio) => {
    if (pendingAudioBuffer.length < DEEPGRAM_BUFFER_MAX_SIZE) {
      pendingAudioBuffer.push(audio);
    }
    // If buffer is full, oldest chunks are dropped (they're already lost anyway)
  };

  setupDeepgram();

  ws.on('message', async (message) => {
    try {
      const msg = JSON.parse(message);

      switch (msg.event) {
        case 'connected':
          console.log('Twilio media stream connected');
          break;

        case 'start':
          streamSid = msg.start.streamSid;
          callSid = msg.start.callSid;
          console.log(`Stream started: ${streamSid}, Call: ${callSid}`);

          // Look for pending call info and merge it
          let callInfo = { streamSid, startTime: Date.now() };
          activeCalls.forEach((data, key) => {
            if (key.startsWith('pending_')) {
              // Found pending call, merge info
              callInfo = { ...data, ...callInfo };
              activeCalls.delete(key);
            }
          });

          // Store active call with full info
          activeCalls.set(callSid, callInfo);

          // Initialize transcript storage
          callTranscripts.set(callSid, []);

          // Note: Call record is created by the browser client (with company_id)
          // Server will update the record with transcript/recording info later

          // Notify all browser clients about new call
          broadcastToClients({
            type: 'call_started',
            callSid: callSid,
            repIdentity: callInfo.repIdentity,
            customerNumber: callInfo.customerNumber,
            startTime: callInfo.startTime
          });
          break;

        case 'media':
          // Send audio to Deepgram (or buffer if reconnecting)
          const audio = Buffer.from(msg.media.payload, 'base64');

          if (isDeepgramReconnecting) {
            // Buffer audio while reconnecting
            bufferAudio(audio);
          } else if (deepgramConnection) {
            try {
              deepgramConnection.send(audio);
            } catch (sendError) {
              console.error('Error sending audio to Deepgram:', sendError.message);
              // Buffer the audio and trigger reconnection
              bufferAudio(audio);
              if (!isDeepgramReconnecting) {
                handleDeepgramDisconnect();
              }
            }
          }
          break;

        case 'stop':
          console.log('Stream stopped');

          // Get call info before removing
          const endedCallInfo = activeCalls.get(callSid);
          const duration = endedCallInfo ? Math.floor((Date.now() - endedCallInfo.startTime) / 1000) : 0;
          const transcript = callTranscripts.get(callSid) || [];

          // Remove from active calls first
          activeCalls.delete(callSid);

          // Notify all browser clients
          broadcastToClients({
            type: 'call_ended',
            callSid: callSid,
            duration: duration
          });

          // Update call record in Supabase (await to ensure it completes before transcript save)
          await updateCallRecord(callSid, {
            status: duration > 0 ? 'completed' : 'no_answer',
            durationSeconds: duration,
            endedAt: new Date().toISOString()
          });

          // Save transcript to Supabase if we have one
          if (transcript.length > 0) {
            await saveTranscript(callSid, transcript);

            // Trigger post-call AI analysis for Advanced Mode
            // (Basic Mode gets this via /transcript-callback webhook)
            const fullTranscriptText = transcript.map(t => t.text).join(' ');
            if (fullTranscriptText.length > 50) {
              console.log(`Starting post-call analysis for Advanced Mode call ${callSid}`);
              performPostCallAnalysis(callSid, fullTranscriptText)
                .then(analysis => {
                  if (analysis) {
                    console.log(`Post-call analysis complete for ${callSid}: ${analysis.sentiment}`);
                  }
                })
                .catch(err => console.error('Post-call analysis failed:', err));
            }
          }

          // Keep transcript in memory for a while (for manual re-analysis)
          // Clean up after 30 minutes
          setTimeout(() => {
            callTranscripts.delete(callSid);
          }, 30 * 60 * 1000);

          // Clean up Deepgram connection and audio buffer
          pendingAudioBuffer = [];
          isDeepgramReconnecting = false;
          if (deepgramConnection) {
            deepgramConnection.finish();
            deepgramConnection = null;
          }
          break;
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  ws.on('close', () => {
    console.log('Twilio WebSocket closed');
    if (deepgramConnection) {
      deepgramConnection.finish();
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});
