require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const twilio = require('twilio');
// Deepgram SDK import removed - using raw WebSocket for better reliability
const { createClient: createSupabaseClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');
const { RBsoftService, RBsoftRateLimiter, RBsoftLoadBalancer } = require('./services/rbsoft');

// RBsoft SMS Gateway instances (per company, lazy loaded)
const rbsoftInstances = new Map(); // companyId -> { service, rateLimiter, loadBalancer }
const rbsoftRateLimiter = new RBsoftRateLimiter();

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
  // Serve landing page at root
  res.sendFile(path.join(__dirname, 'public', 'landing.html'));
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

app.get('/coaching-lab', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'coaching-lab.html'));
});

// Health check endpoint for Railway deployment and debugging
app.get('/health', async (req, res) => {
  const startTime = Date.now();

  const checks = {
    server: { status: 'ok' },
    supabase: { status: 'ok' },
    twilio: { status: 'ok' },
    deepgram: { status: 'ok' },
    elevenlabs: { status: 'ok' },
    anthropic: { status: 'ok' },
    environment: { status: 'ok' },
    transcriptionProvider: { status: 'ok', active: transcriptionProvider },
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
  } else {
    checks.deepgram = { status: 'ok', provider: transcriptionProvider === 'deepgram' ? 'active' : 'standby' };
  }

  // Check ElevenLabs
  if (!process.env.ELEVENLABS_API_KEY) {
    checks.elevenlabs = { status: 'warning', message: 'API key not set (optional)' };
  } else {
    checks.elevenlabs = { status: 'ok', provider: transcriptionProvider === 'elevenlabs' ? 'active' : 'standby' };
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

// Deepgram: using raw WebSocket (configured in setupDeepgram function)

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
const DEEPGRAM_BUFFER_MAX_SIZE = 200; // Max audio chunks to buffer during connect/reconnect

// AI Coaching settings - more frequent coaching
const AI_COACHING_INTERVAL = 2; // Trigger AI coaching every N final transcripts (changed from 3)
const AI_COACHING_MIN_TRANSCRIPT_LENGTH = 3; // Minimum transcript exchanges before coaching

// ============ CALL PHASE & CONTEXT TRACKING ============
// Background context per call - stores AI-generated summaries
const callContextSummaries = new Map(); // callSid -> { summary, topics, sentiment, insights, lastUpdatedAt, entryCount }

// Phase tracking per call - stores current phase and history
const callPhases = new Map(); // callSid -> { currentPhase, phaseHistory, lastTransitionAt }

// Cooldown tracking for script suggestions
const scriptCooldowns = new Map(); // callSid -> { lastSuggestionAt, recentlyShownScripts: Map(scriptId -> timestamp), suggestionCount }

// Context update settings
const CONTEXT_UPDATE_INTERVAL = 12; // Update context every N transcript entries
const CONTEXT_UPDATE_TIMEOUT_MS = 2000; // Max time for context generation

// Suggestion cooldown settings
const SUGGESTION_COOLDOWN_MS = 30000; // 30 seconds between suggestions
const SCRIPT_REPEAT_COOLDOWN_MS = 300000; // 5 minutes before repeating same script
const MAX_SUGGESTIONS_PER_CALL = 20; // Maximum suggestions per call

// Call phases in order
const CALL_PHASES = ['intro', 'discovery', 'presentation', 'pricing', 'objection_handling', 'closing'];

// Phase detection keywords (checked in order, first match wins)
const PHASE_KEYWORDS = {
  intro: [
    'hello', 'hi there', 'good morning', 'good afternoon', 'good evening',
    'my name is', 'calling from', 'reaching out', 'how are you'
  ],
  discovery: [
    'tell me about', 'what challenges', 'currently using', 'what do you',
    'how do you', 'what\'s your', 'biggest problem', 'main concern',
    'looking for', 'what brings you', 'why did you', 'interested in'
  ],
  presentation: [
    'let me show you', 'let me tell you', 'our solution', 'we offer',
    'the benefit', 'what we do', 'how it works', 'feature', 'advantage',
    'unlike other', 'what makes us', 'we can help'
  ],
  pricing: [
    'price', 'cost', 'budget', 'how much', 'investment', 'payment',
    'affordable', 'expensive', 'dollars', 'monthly', 'financing',
    'pay', 'fee', 'charge', 'rate'
  ],
  objection_handling: [
    'too expensive', 'not sure', 'think about it', 'talk to', 'spouse',
    'husband', 'wife', 'partner', 'not interested', 'already have',
    'don\'t need', 'bad timing', 'call back', 'send information',
    'not right now', 'can\'t afford', 'competitors'
  ],
  closing: [
    'ready to start', 'sign up', 'get started', 'next steps', 'move forward',
    'schedule', 'appointment', 'book', 'confirm', 'credit card',
    'let\'s do it', 'sounds good', 'go ahead', 'deal'
  ]
};

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
    // Use actual speaker from segment if available, otherwise fall back to alternating pattern
    const formattedSegments = segments.map((seg, index) => ({
      speaker: seg.speaker || (index % 2 === 0 ? 'rep' : 'customer'),
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
    // Safely extract sentiment as string
    let sentimentValue = analysis.sentiment || analysis.overall_sentiment || 'neutral';
    if (typeof sentimentValue !== 'string') {
      sentimentValue = 'neutral';
    }

    const normalizedAnalysis = {
      summary: analysis.summary || analysis.brief_summary || '',
      sentiment: sentimentValue.toLowerCase(),
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
// Supports three modes:
// - 'basic': Post-call Twilio transcription (slowest, simplest)
// - 'advanced': Deepgram streaming via WebSocket (current default)
// - 'twilio-realtime': Twilio's native real-time transcription with Deepgram backend (potentially fastest)
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
  console.log(`Request host header: ${req.headers.host}`);

  // Store pending call info (will be matched when stream starts or call status updates)
  const pendingCallKey = `pending_${to}`;
  activeCalls.set(pendingCallKey, {
    customerNumber: to,
    repIdentity: from,
    startTime: Date.now(),
    callMode: callMode
  });

  if (callMode === 'twilio-realtime') {
    // TWILIO REALTIME MODE: Use Twilio's native real-time transcription (Deepgram backend)
    // This eliminates the server->Deepgram hop for potentially lower latency
    // Using raw TwiML since older SDK versions don't have .transcription() method
    const transcriptionTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Start>
    <Transcription statusCallbackUrl="https://${req.headers.host}/transcription-realtime" track="both_tracks" transcriptionEngine="deepgram" speechModel="nova-2" languageCode="en-US" />
  </Start>
  <Dial callerId="${process.env.TWILIO_PHONE_NUMBER}" answerOnBridge="true" record="record-from-answer-dual" recordingStatusCallback="https://${req.headers.host}/recording-callback" recordingStatusCallbackEvent="completed">
    <Number>${to}</Number>
  </Dial>
</Response>`;

    console.log('TwiML Response for twilio-realtime mode:', transcriptionTwiml);
    res.type('text/xml');
    return res.send(transcriptionTwiml);
  } else if (callMode === 'advanced') {
    // ADVANCED MODE: Use Deepgram for live transcription via WebSocket
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
    // BASIC MODE: Simple dial with recording and Twilio transcription
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
  }

  const twimlString = twiml.toString();
  console.log(`TwiML Response for ${callMode} mode:`, twimlString);

  res.type('text/xml');
  res.send(twimlString);
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

// Transcription provider setting ('deepgram', 'elevenlabs', or 'twilio')
// 'twilio' uses Twilio's native real-time transcription with Deepgram backend (fewer hops, potentially lower latency)
let transcriptionProvider = process.env.TRANSCRIPTION_PROVIDER || 'deepgram';

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

// API endpoint to get/set transcription provider
app.get('/api/settings/transcription-provider', (req, res) => {
  res.json({ provider: transcriptionProvider });
});

app.post('/api/settings/transcription-provider', (req, res) => {
  const { provider } = req.body;
  if (provider && ['deepgram', 'elevenlabs', 'twilio'].includes(provider)) {
    transcriptionProvider = provider;
    console.log('Transcription provider updated:', transcriptionProvider);
    res.json({ success: true, provider: transcriptionProvider });
  } else {
    res.status(400).json({ success: false, error: 'Invalid provider. Use "deepgram", "elevenlabs", or "twilio"' });
  }
});

// ============ RBSOFT SMS GATEWAY SETTINGS ============

/**
 * Get RBsoft configuration for a company
 * GET /api/settings/rbsoft?companyId=xxx
 */
app.get('/api/settings/rbsoft', async (req, res) => {
  try {
    const { companyId } = req.query;

    if (!companyId) {
      return res.status(400).json({ success: false, error: 'companyId is required' });
    }

    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Database not configured' });
    }

    // Get company settings
    const { data: settings, error } = await supabase
      .from('company_settings')
      .select('rbsoft_enabled, rbsoft_api_url, rbsoft_api_key, rbsoft_webhook_secret')
      .eq('company_id', companyId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // Get devices for this company
    const { data: devices, error: devicesError } = await supabase
      .from('rbsoft_devices')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: true });

    if (devicesError) {
      console.error('Error fetching devices:', devicesError);
    }

    res.json({
      success: true,
      config: {
        enabled: settings?.rbsoft_enabled || false,
        apiUrl: settings?.rbsoft_api_url || '',
        apiKey: settings?.rbsoft_api_key ? '••••••••' : '', // Mask API key
        hasApiKey: !!settings?.rbsoft_api_key,
        webhookSecret: settings?.rbsoft_webhook_secret ? '••••••••' : '',
        hasWebhookSecret: !!settings?.rbsoft_webhook_secret
      },
      devices: devices || []
    });

  } catch (error) {
    console.error('Error fetching RBsoft settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Save RBsoft configuration for a company
 * POST /api/settings/rbsoft
 * Body: { companyId, enabled, apiUrl, apiKey, webhookSecret }
 */
app.post('/api/settings/rbsoft', async (req, res) => {
  try {
    const { companyId, enabled, apiUrl, apiKey, webhookSecret } = req.body;

    if (!companyId) {
      return res.status(400).json({ success: false, error: 'companyId is required' });
    }

    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Database not configured' });
    }

    // Build update object (only include fields that were provided)
    const updateData = {
      company_id: companyId,
      updated_at: new Date().toISOString()
    };

    if (enabled !== undefined) updateData.rbsoft_enabled = enabled;
    if (apiUrl !== undefined) updateData.rbsoft_api_url = apiUrl;
    if (apiKey !== undefined && apiKey !== '••••••••') updateData.rbsoft_api_key = apiKey;
    if (webhookSecret !== undefined && webhookSecret !== '••••••••') updateData.rbsoft_webhook_secret = webhookSecret;

    // Upsert company settings
    const { error } = await supabase
      .from('company_settings')
      .upsert(updateData, { onConflict: 'company_id' });

    if (error) throw error;

    // Clear cached RBsoft instance for this company
    rbsoftInstances.delete(companyId);

    console.log(`RBsoft settings updated for company ${companyId}`);
    res.json({ success: true });

  } catch (error) {
    console.error('Error saving RBsoft settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Test RBsoft connection
 * POST /api/settings/rbsoft/test
 * Body: { companyId } or { apiUrl, apiKey }
 */
app.post('/api/settings/rbsoft/test', async (req, res) => {
  try {
    const { companyId, apiUrl, apiKey } = req.body;

    let testUrl = apiUrl;
    let testKey = apiKey;

    // If companyId provided, get credentials from database
    if (companyId && (!apiUrl || !apiKey)) {
      if (!supabase) {
        return res.status(500).json({ success: false, error: 'Database not configured' });
      }

      const { data: settings, error } = await supabase
        .from('company_settings')
        .select('rbsoft_api_url, rbsoft_api_key')
        .eq('company_id', companyId)
        .single();

      if (error) throw error;

      testUrl = settings?.rbsoft_api_url;
      testKey = settings?.rbsoft_api_key;
    }

    if (!testUrl || !testKey) {
      return res.status(400).json({
        success: false,
        error: 'API URL and API Key are required'
      });
    }

    // Test the connection
    const rbsoft = new RBsoftService(testUrl, testKey);
    const result = await rbsoft.testConnection();

    res.json(result);

  } catch (error) {
    console.error('Error testing RBsoft connection:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Connection test failed'
    });
  }
});

/**
 * Get RBsoft devices for a company
 * GET /api/settings/rbsoft/devices?companyId=xxx
 */
app.get('/api/settings/rbsoft/devices', async (req, res) => {
  try {
    const { companyId } = req.query;

    if (!companyId) {
      return res.status(400).json({ success: false, error: 'companyId is required' });
    }

    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Database not configured' });
    }

    const { data: devices, error } = await supabase
      .from('rbsoft_devices')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    res.json({ success: true, devices: devices || [] });

  } catch (error) {
    console.error('Error fetching RBsoft devices:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Add a new RBsoft device
 * POST /api/settings/rbsoft/devices
 * Body: { companyId, deviceId, name, phoneNumber }
 */
app.post('/api/settings/rbsoft/devices', async (req, res) => {
  try {
    const { companyId, deviceId, name, phoneNumber } = req.body;

    if (!companyId || !deviceId || !name) {
      return res.status(400).json({
        success: false,
        error: 'companyId, deviceId, and name are required'
      });
    }

    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Database not configured' });
    }

    const { data: device, error } = await supabase
      .from('rbsoft_devices')
      .insert({
        company_id: companyId,
        device_id: deviceId,
        name: name,
        phone_number: phoneNumber || null,
        is_active: true,
        status: 'unknown'
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({
          success: false,
          error: 'A device with this ID already exists'
        });
      }
      throw error;
    }

    console.log(`RBsoft device added: ${name} (${deviceId}) for company ${companyId}`);
    res.json({ success: true, device });

  } catch (error) {
    console.error('Error adding RBsoft device:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update an RBsoft device
 * PUT /api/settings/rbsoft/devices/:id
 * Body: { name, phoneNumber, isActive }
 */
app.put('/api/settings/rbsoft/devices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phoneNumber, isActive } = req.body;

    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Database not configured' });
    }

    const updateData = { updated_at: new Date().toISOString() };
    if (name !== undefined) updateData.name = name;
    if (phoneNumber !== undefined) updateData.phone_number = phoneNumber;
    if (isActive !== undefined) updateData.is_active = isActive;

    const { data: device, error } = await supabase
      .from('rbsoft_devices')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, device });

  } catch (error) {
    console.error('Error updating RBsoft device:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Delete an RBsoft device
 * DELETE /api/settings/rbsoft/devices/:id
 */
app.delete('/api/settings/rbsoft/devices/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Database not configured' });
    }

    const { error } = await supabase
      .from('rbsoft_devices')
      .delete()
      .eq('id', id);

    if (error) throw error;

    console.log(`RBsoft device deleted: ${id}`);
    res.json({ success: true });

  } catch (error) {
    console.error('Error deleting RBsoft device:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * RBsoft webhook for delivery status and incoming messages
 * POST /api/rbsoft/webhook
 */
app.post('/api/rbsoft/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-rbsoft-signature'];
    const payload = JSON.stringify(req.body);

    // TODO: Verify webhook signature with company's webhook secret
    // For now, process the webhook directly

    const { event, data, companyId } = req.body;

    console.log(`RBsoft webhook received: ${event}`, data);

    if (!supabase) {
      return res.sendStatus(200);
    }

    switch (event) {
      case 'message.sent':
      case 'message.delivered':
      case 'message.failed':
        // Update message status in database
        if (data.messageId) {
          // Find message by provider message ID and update status
          const statusMap = {
            'message.sent': 'sent',
            'message.delivered': 'delivered',
            'message.failed': 'failed'
          };

          // You would need to store rbsoft message ID in sms_messages
          // For now, log it
          console.log(`Message ${data.messageId} status: ${statusMap[event]}`);
        }
        break;

      case 'message.received':
        // Handle incoming SMS from RBsoft device
        console.log(`Incoming SMS via RBsoft: ${data.from} -> ${data.message}`);
        break;

      case 'device.online':
      case 'device.offline':
        // Update device status
        if (data.deviceId) {
          const status = event === 'device.online' ? 'online' : 'offline';
          await supabase
            .from('rbsoft_devices')
            .update({
              status: status,
              last_seen_at: new Date().toISOString()
            })
            .eq('device_id', data.deviceId);
        }
        break;
    }

    res.sendStatus(200);

  } catch (error) {
    console.error('Error handling RBsoft webhook:', error);
    res.sendStatus(200); // Always return 200 to prevent retries
  }
});

/**
 * Get or create RBsoft service instance for a company
 */
async function getRBsoftInstance(companyId) {
  // Check cache
  if (rbsoftInstances.has(companyId)) {
    return rbsoftInstances.get(companyId);
  }

  if (!supabase) return null;

  // Get company settings
  const { data: settings, error } = await supabase
    .from('company_settings')
    .select('rbsoft_enabled, rbsoft_api_url, rbsoft_api_key')
    .eq('company_id', companyId)
    .single();

  if (error || !settings?.rbsoft_enabled || !settings?.rbsoft_api_url || !settings?.rbsoft_api_key) {
    return null;
  }

  // Create and cache instance
  const service = new RBsoftService(settings.rbsoft_api_url, settings.rbsoft_api_key);
  const loadBalancer = new RBsoftLoadBalancer(rbsoftRateLimiter);

  const instance = { service, loadBalancer };
  rbsoftInstances.set(companyId, instance);

  return instance;
}

/**
 * Get available RBsoft devices for a company
 */
async function getAvailableRBsoftDevices(companyId) {
  if (!supabase) return [];

  const { data: devices, error } = await supabase
    .from('rbsoft_devices')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching RBsoft devices:', error);
    return [];
  }

  return devices || [];
}

/**
 * Check if a phone number is blacklisted for a company
 */
async function isPhoneBlacklisted(companyId, phoneNumber) {
  if (!supabase) return false;

  // Normalize phone number
  const normalizedPhone = phoneNumber.replace(/\D/g, '');

  const { data, error } = await supabase
    .from('sms_blacklist')
    .select('id')
    .eq('company_id', companyId)
    .or(`phone_number.eq.${phoneNumber},phone_number.eq.+${normalizedPhone},phone_number.eq.+1${normalizedPhone.slice(-10)}`);

  if (error) {
    console.error('Error checking blacklist:', error);
    return false;
  }

  return data && data.length > 0;
}

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

// ============ CALL TRANSFER ENDPOINTS ============

// Blind Transfer - immediately transfer the call to another number
app.post('/api/call/transfer', async (req, res) => {
  const { callSid, transferTo, transferType } = req.body;

  if (!callSid || !transferTo) {
    return res.status(400).json({ success: false, error: 'Missing callSid or transferTo' });
  }

  console.log(`Transfer request: ${transferType} transfer of ${callSid} to ${transferTo}`);

  try {
    if (transferType === 'blind') {
      // Blind transfer: Update the call with new TwiML that dials the transfer number
      const twiml = new twilio.twiml.VoiceResponse();
      twiml.say({ voice: 'alice' }, 'Please hold while we transfer your call.');

      const dial = twiml.dial({
        callerId: process.env.TWILIO_PHONE_NUMBER,
        timeout: 30,
        action: `https://${req.headers.host}/transfer-status`
      });
      dial.number(transferTo);

      // Update the call with the new TwiML
      await twilioClient.calls(callSid).update({
        twiml: twiml.toString()
      });

      res.json({
        success: true,
        message: `Call transferred to ${transferTo}`,
        transferType: 'blind'
      });
    } else {
      // Warm transfer: Create a conference for the warm handoff
      // First, put the current call into a conference
      const conferenceName = `transfer-${callSid}-${Date.now()}`;

      const twiml = new twilio.twiml.VoiceResponse();
      twiml.say({ voice: 'alice' }, 'Please hold while we connect you.');

      const dial = twiml.dial();
      dial.conference({
        startConferenceOnEnter: true,
        endConferenceOnExit: false,
        waitUrl: 'http://twimlets.com/holdmusic?Bucket=com.twilio.music.soft-rock'
      }, conferenceName);

      // Update the current call to join the conference
      await twilioClient.calls(callSid).update({
        twiml: twiml.toString()
      });

      // Make an outbound call to the transfer target and add them to the conference
      const outboundCall = await twilioClient.calls.create({
        to: transferTo,
        from: process.env.TWILIO_PHONE_NUMBER,
        twiml: `<Response><Dial><Conference startConferenceOnEnter="true" endConferenceOnExit="true">${conferenceName}</Conference></Dial></Response>`
      });

      res.json({
        success: true,
        message: `Warm transfer initiated to ${transferTo}`,
        transferType: 'warm',
        conferenceName: conferenceName,
        outboundCallSid: outboundCall.sid
      });
    }
  } catch (error) {
    console.error('Transfer error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Transfer failed'
    });
  }
});

// Transfer status callback
app.post('/transfer-status', (req, res) => {
  const dialStatus = req.body.DialCallStatus;
  console.log('Transfer dial completed:', dialStatus, req.body);

  const twiml = new twilio.twiml.VoiceResponse();

  if (dialStatus === 'completed') {
    // Transfer successful
    twiml.hangup();
  } else {
    // Transfer failed
    twiml.say({ voice: 'alice' }, 'We were unable to complete the transfer. Goodbye.');
    twiml.hangup();
  }

  res.type('text/xml');
  res.send(twiml.toString());
});

// Complete warm transfer (agent drops from conference)
app.post('/api/call/transfer/complete', async (req, res) => {
  const { conferenceName, agentCallSid } = req.body;

  if (!conferenceName) {
    return res.status(400).json({ success: false, error: 'Missing conferenceName' });
  }

  try {
    // If we have the agent's call SID, we can end just their leg
    if (agentCallSid) {
      await twilioClient.calls(agentCallSid).update({ status: 'completed' });
    }

    res.json({ success: true, message: 'Agent dropped from conference' });
  } catch (error) {
    console.error('Error completing transfer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
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

// ============ TWILIO REAL-TIME TRANSCRIPTION WEBHOOK ============
// This webhook receives real-time transcription events from Twilio's native transcription
// Uses Deepgram as backend but Twilio handles the streaming (fewer network hops)

app.post('/transcription-realtime', async (req, res) => {
  try {
    const {
      CallSid,
      TranscriptionEvent,  // 'transcription-started', 'transcription-content', 'transcription-stopped'
      TranscriptionSid,
      Track,               // 'inbound_track' (customer) or 'outbound_track' (rep)
      TranscriptionData,   // JSON string with transcript content
      SequenceId
    } = req.body;

    // Validate required fields
    if (!CallSid) {
      console.error('Transcription realtime callback missing CallSid');
      return res.sendStatus(400);
    }

    const timestamp = new Date().toISOString();

    switch (TranscriptionEvent) {
      case 'transcription-started':
        console.log(`[Twilio RT] Transcription started for call ${CallSid}`);

        // Initialize transcript storage if not exists
        if (!callTranscripts.has(CallSid)) {
          callTranscripts.set(CallSid, []);
        }

        // Match with pending call if needed
        activeCalls.forEach((data, key) => {
          if (key.startsWith('pending_')) {
            const callInfo = { ...data, transcriptionSid: TranscriptionSid, startTime: Date.now() };
            activeCalls.set(CallSid, callInfo);
            activeCalls.delete(key);
          }
        });

        // Notify browser clients
        broadcastToClients({
          type: 'call_started',
          callSid: CallSid,
          transcriptionSid: TranscriptionSid,
          provider: 'twilio-realtime'
        });

        broadcastToClients({
          type: 'transcription_status',
          callSid: CallSid,
          status: 'active',
          provider: 'twilio-realtime',
          message: 'Twilio real-time transcription started'
        }, (client) => client.role === 'rep');
        break;

      case 'transcription-content':
        if (TranscriptionData) {
          let transcriptData;
          try {
            transcriptData = typeof TranscriptionData === 'string'
              ? JSON.parse(TranscriptionData)
              : TranscriptionData;
          } catch (e) {
            console.error('Failed to parse TranscriptionData:', e);
            return res.sendStatus(200);
          }

          // Log the raw data to understand Twilio's format
          console.log('[Twilio RT] Raw TranscriptionData:', JSON.stringify(transcriptData));

          const transcript = transcriptData.transcript || transcriptData.text || '';
          const confidence = transcriptData.confidence || 0;
          // Check multiple possible field names for final status
          // Twilio may send: is_final, final, stability=1.0, or always final results
          const isFinal = transcriptData.is_final === true ||
                          transcriptData.final === true ||
                          transcriptData.stability === 1.0 ||
                          transcriptData.stability === '1.0' ||
                          (transcriptData.stability === undefined && transcript.length > 0); // Assume final if no stability field

          // Determine speaker from track
          // For outbound calls: inbound_track = rep's voice, outbound_track = customer's voice
          const speaker = Track === 'inbound_track' ? 'rep' : 'customer';

          if (transcript) {
            console.log(`[Twilio RT ${isFinal ? 'FINAL' : 'interim'}] [${speaker}] ${transcript}`);

            // Store final transcripts for AI analysis
            if (isFinal && CallSid) {
              if (!callTranscripts.has(CallSid)) {
                callTranscripts.set(CallSid, []);
              }
              callTranscripts.get(CallSid).push({
                speaker,
                text: transcript,
                timestamp,
                isFinal: true,
                confidence
              });

              // Process for phase detection and context updates (non-blocking)
              processTranscriptEntry(CallSid, transcript, speaker).catch(err => {
                console.error('[Phase/Context] Error processing transcript:', err.message);
              });

              // Trigger AI coaching
              const transcriptCount = callTranscripts.get(CallSid).length;
              if (transcriptCount >= AI_COACHING_MIN_TRANSCRIPT_LENGTH &&
                  transcriptCount % AI_COACHING_INTERVAL === 0) {
                const callData = activeCalls.get(CallSid);
                const knowledgeBaseId = callData?.knowledgeBaseId || null;
                getAICoachingSuggestion(CallSid, transcript, knowledgeBaseId).then(coachingResult => {
                  if (coachingResult) {
                    // Extract type and rename to coachingType to avoid conflict with message type
                    const { type: coachingType, ...restCoaching } = coachingResult;
                    const coachMsg = {
                      type: 'ai_coaching',
                      coachingType,
                      callSid: CallSid,
                      ...restCoaching,
                      timestamp
                    };
                    broadcastToClients(coachMsg, (client) => client.role === 'rep');
                    broadcastToClients(coachMsg, (client) =>
                      client.role === 'supervisor' && client.listeningTo === CallSid
                    );
                  }
                });
              }
            }

            // Send transcript to browser clients
            const message = {
              type: 'transcript',
              callSid: CallSid,
              speaker,
              text: transcript,
              isFinal,
              timestamp,
              confidence,
              provider: 'twilio-realtime',
              sequenceId: SequenceId
            };

            // Send to reps
            broadcastToClients(message, (client) => client.role === 'rep');

            // Send to supervisors listening to this call
            broadcastToClients(message, (client) =>
              client.role === 'supervisor' && client.listeningTo === CallSid
            );
          }
        }
        break;

      case 'transcription-stopped':
        console.log(`[Twilio RT] Transcription stopped for call ${CallSid}`);

        // Get transcript and perform post-call analysis
        const transcript = callTranscripts.get(CallSid) || [];
        if (transcript.length > 0) {
          // Save transcript to Supabase
          await saveTranscript(CallSid, transcript);

          // Trigger post-call AI analysis
          const fullTranscriptText = transcript.map(t => t.text).join(' ');
          if (fullTranscriptText.length > 50) {
            console.log(`Starting post-call analysis for Twilio RT call ${CallSid}`);
            performPostCallAnalysis(CallSid, fullTranscriptText)
              .then(analysis => {
                if (analysis) {
                  console.log(`Post-call analysis complete for ${CallSid}: ${analysis.sentiment}`);
                }
              })
              .catch(err => console.error('Post-call analysis failed:', err));
          }
        }

        // Notify browser clients
        broadcastToClients({
          type: 'call_ended',
          callSid: CallSid,
          provider: 'twilio-realtime'
        });

        // Clean up after delay
        setTimeout(() => {
          callTranscripts.delete(CallSid);
        }, 30 * 60 * 1000);
        break;

      default:
        console.log(`[Twilio RT] Unknown event: ${TranscriptionEvent}`);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Error processing Twilio real-time transcription:', error);
    res.sendStatus(500);
  }
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

// ============ KNOWLEDGE BASE & SCRIPT MATCHING ============

// Track active flows per call: callSid -> { flowId, currentNodeId, stepNumber }
const activeCallFlows = new Map();

/**
 * Detect objection category from customer text
 * @param {string} text - Customer text to analyze
 * @param {string} knowledgeBaseId - Knowledge base to search in
 * @returns {Object|null} - Best matching category with score
 */
async function detectObjectionCategory(text, knowledgeBaseId) {
  if (!supabase || !text) return null;

  try {
    const { data: categories, error } = await supabase
      .from('objection_categories')
      .select('id, name, display_name, icon, color, detection_keywords')
      .eq('knowledge_base_id', knowledgeBaseId)
      .eq('is_active', true);

    if (error || !categories || categories.length === 0) return null;

    const lowerText = text.toLowerCase();
    let bestCategory = null;
    let bestScore = 0;

    for (const category of categories) {
      if (!category.detection_keywords || category.detection_keywords.length === 0) continue;

      let score = 0;
      for (const keyword of category.detection_keywords) {
        if (lowerText.includes(keyword.toLowerCase())) {
          // Exact phrase match scores higher
          score += keyword.includes(' ') ? 3 : 1;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestCategory = { ...category, matchScore: score };
      }
    }

    if (bestCategory && bestScore > 0) {
      console.log(`Objection category detected: ${bestCategory.display_name} (score: ${bestScore})`);
    }

    return bestCategory;
  } catch (error) {
    console.error('Category detection error:', error.message);
    return null;
  }
}

/**
 * Get conversation flow for an objection category
 * @param {string} categoryId - Objection category UUID
 * @returns {Object|null} - Flow with first node
 */
async function getFlowForCategory(categoryId) {
  if (!supabase || !categoryId) return null;

  try {
    // Get flow for this category
    const { data: flows, error } = await supabase
      .from('conversation_flows')
      .select('id, name, description')
      .eq('entry_category_id', categoryId)
      .eq('is_active', true)
      .limit(1);

    if (error || !flows || flows.length === 0) return null;

    const flow = flows[0];

    // Get the entry node
    const { data: nodes, error: nodeError } = await supabase
      .from('flow_nodes')
      .select('id, node_type, step_number, title, script_text, story_text, tips, expected_responses')
      .eq('flow_id', flow.id)
      .eq('node_type', 'entry')
      .limit(1);

    if (nodeError || !nodes || nodes.length === 0) return null;

    // Get total steps in flow
    const { count } = await supabase
      .from('flow_nodes')
      .select('*', { count: 'exact', head: true })
      .eq('flow_id', flow.id);

    return {
      flow,
      firstNode: nodes[0],
      totalSteps: count || 1
    };
  } catch (error) {
    console.error('Get flow error:', error.message);
    return null;
  }
}

/**
 * Get next node in a flow based on customer response
 * @param {string} currentNodeId - Current node UUID
 * @param {string} customerText - Customer's response text
 * @returns {Object|null} - Next node or null if flow complete
 */
async function getNextFlowNode(currentNodeId, customerText) {
  if (!supabase || !currentNodeId) return null;

  try {
    // Get branches from current node
    const { data: branches, error } = await supabase
      .from('flow_branches')
      .select('id, to_node_id, trigger_keywords, label, is_default')
      .eq('from_node_id', currentNodeId)
      .order('is_default', { ascending: true })
      .order('sort_order');

    if (error || !branches || branches.length === 0) return null;

    const lowerText = customerText ? customerText.toLowerCase() : '';
    let bestBranch = null;
    let bestScore = 0;

    for (const branch of branches) {
      if (branch.trigger_keywords && branch.trigger_keywords.length > 0) {
        let score = 0;
        for (const keyword of branch.trigger_keywords) {
          if (lowerText.includes(keyword.toLowerCase())) {
            score++;
          }
        }
        if (score > bestScore) {
          bestScore = score;
          bestBranch = branch;
        }
      } else if (branch.is_default && !bestBranch) {
        bestBranch = branch;
      }
    }

    if (!bestBranch) return null;

    // Get the next node
    const { data: nodes, error: nodeError } = await supabase
      .from('flow_nodes')
      .select('id, node_type, step_number, title, script_text, story_text, tips, expected_responses')
      .eq('id', bestBranch.to_node_id)
      .limit(1);

    if (nodeError || !nodes || nodes.length === 0) return null;

    return {
      node: nodes[0],
      branchLabel: bestBranch.label
    };
  } catch (error) {
    console.error('Get next node error:', error.message);
    return null;
  }
}

/**
 * AI-powered script selection using Claude Haiku
 * @param {string} recentCustomerText - Recent customer statements
 * @param {Array} scripts - Available scripts with id, title, trigger_phrases
 * @param {Array} recentTranscript - Last few transcript entries for context
 * @param {number} timeoutMs - Timeout in milliseconds (default 800ms)
 * @param {Object} enhancedContext - Optional { phase, contextSummary, feedbackContext }
 * @returns {Object} - { scriptIndex, aiSelected, latencyMs } - scriptIndex is array index or null
 */
async function selectScriptWithAI(recentCustomerText, scripts, recentTranscript, timeoutMs = 800, enhancedContext = {}) {
  if (!anthropic || !scripts || scripts.length === 0) {
    return { scriptIndex: null, aiSelected: false, latencyMs: 0 };
  }

  const startTime = Date.now();
  const { phase, contextSummary, feedbackContext } = enhancedContext;

  try {
    // Build compact script list using 1-based indices (simpler for AI than UUIDs)
    const scriptList = scripts.map((s, idx) => {
      const triggers = (s.trigger_phrases || []).slice(0, 5).join(', ');
      return `${idx + 1}|${s.title}|${triggers}`;
    }).join('\n');

    // Build conversation context (last 4 turns)
    const conversationContext = recentTranscript
      .slice(-4)
      .map(t => `${t.speaker === 'customer' ? 'Customer' : 'Rep'}: ${t.text}`)
      .join('\n');

    // Build enhanced prompt with phase and context
    let phaseSection = '';
    if (phase) {
      phaseSection = `CURRENT CALL PHASE: ${phase}\n\n`;
    }

    let contextSection = '';
    if (contextSummary) {
      contextSection = `CALL CONTEXT: ${contextSummary}\n\n`;
    }

    let feedbackSection = '';
    if (feedbackContext) {
      feedbackSection = `${feedbackContext}\n\n`;
    }

    const prompt = `You are a sales coaching assistant. Select the most relevant script for the current situation.

${phaseSection}${contextSection}${feedbackSection}SCRIPTS (Number|Title|Sample Triggers):
${scriptList}

RECENT CONVERSATION:
${conversationContext}

CUSTOMER JUST SAID: "${recentCustomerText}"

Instructions:
- Return ONLY the script number (1-${scripts.length}) that best matches the situation
- Return 0 if no script is a good fit
- Consider the call phase - suggest scripts appropriate for this stage
- If scripts were already shown and marked "not helpful", avoid similar ones
- Be selective - only match if there's a clear connection

SCRIPT NUMBER:`;

    // Use Promise.race for reliable timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('AI_TIMEOUT')), timeoutMs);
    });

    const apiPromise = anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 10,
      messages: [{ role: 'user', content: prompt }]
    });

    const response = await Promise.race([apiPromise, timeoutPromise]);

    const latencyMs = Date.now() - startTime;
    const responseText = response.content[0]?.text?.trim() || '';

    // Parse the response - expect just a number
    const match = responseText.match(/^(\d+)/);
    if (!match) {
      console.log(`[AI Script Select] Invalid response: "${responseText}" (${latencyMs}ms)`);
      return { scriptIndex: null, aiSelected: false, latencyMs };
    }

    const selectedNum = parseInt(match[1], 10);

    // Return 0 means no good match
    if (selectedNum === 0) {
      console.log(`[AI Script Select] AI returned no match (${latencyMs}ms)`);
      return { scriptIndex: null, aiSelected: true, latencyMs };
    }

    // Convert 1-based number to 0-based index and validate
    const scriptIndex = selectedNum - 1;
    if (scriptIndex < 0 || scriptIndex >= scripts.length) {
      console.log(`[AI Script Select] Invalid script number: ${selectedNum} (${latencyMs}ms)`);
      return { scriptIndex: null, aiSelected: false, latencyMs };
    }

    console.log(`[AI Script Select] Selected "${scripts[scriptIndex].title}" (${latencyMs}ms)`);
    return { scriptIndex, aiSelected: true, latencyMs };

  } catch (error) {
    const latencyMs = Date.now() - startTime;

    if (error.message === 'AI_TIMEOUT') {
      console.log(`[AI Script Select] Timeout after ${latencyMs}ms, falling back to keywords`);
    } else {
      console.error(`[AI Script Select] Error: ${error.message} (${latencyMs}ms)`);
    }

    return { scriptIndex: null, aiSelected: false, latencyMs };
  }
}

/**
 * Enhanced script matching with word overlap and partial matching
 * @param {string} text - Text to match against
 * @param {Array} triggerPhrases - Array of trigger phrases
 * @returns {number} - Match score
 */
function calculateScriptMatchScore(text, triggerPhrases) {
  if (!text || !triggerPhrases || triggerPhrases.length === 0) return 0;

  const lowerText = text.toLowerCase();
  const textWords = lowerText.split(/\s+/).filter(w => w.length > 2);
  let score = 0;

  for (const phrase of triggerPhrases) {
    const lowerPhrase = phrase.toLowerCase();

    // Exact phrase match (highest score)
    if (lowerText.includes(lowerPhrase)) {
      score += 10 * (lowerPhrase.split(' ').length); // Multi-word phrases score higher
      continue;
    }

    // Word overlap matching
    const phraseWords = lowerPhrase.split(/\s+/).filter(w => w.length > 2);
    let wordMatches = 0;
    for (const phraseWord of phraseWords) {
      if (textWords.some(textWord => textWord.includes(phraseWord) || phraseWord.includes(textWord))) {
        wordMatches++;
      }
    }

    if (wordMatches > 0) {
      score += wordMatches * 2;
    }
  }

  return score;
}

// ============ CALL PHASE & CONTEXT HELPER FUNCTIONS ============

/**
 * Detect the current call phase based on keywords in the text
 * @param {string} callSid - Call identifier
 * @param {string} text - Text to analyze
 * @param {string} speaker - Who said it ('rep' or 'customer')
 * @returns {Object|null} - { phase, confidence, detectedBy } or null if no change
 */
function detectCallPhase(callSid, text, speaker) {
  if (!text) return null;

  const lowerText = text.toLowerCase();
  const currentPhaseInfo = callPhases.get(callSid) || { currentPhase: 'intro', phaseHistory: [], lastTransitionAt: Date.now() };
  const currentPhase = currentPhaseInfo.currentPhase;
  const currentPhaseIndex = CALL_PHASES.indexOf(currentPhase);

  let bestMatch = null;
  let bestScore = 0;

  // Check each phase for keyword matches
  for (const [phase, keywords] of Object.entries(PHASE_KEYWORDS)) {
    const phaseIndex = CALL_PHASES.indexOf(phase);

    // Typically phases progress forward, but allow backward for objections
    // Give bonus to forward progression
    let directionBonus = 0;
    if (phaseIndex > currentPhaseIndex) {
      directionBonus = 2; // Prefer forward progression
    } else if (phase === 'objection_handling') {
      directionBonus = 1; // Objections can happen anytime
    }

    let matchCount = 0;
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        matchCount++;
      }
    }

    if (matchCount > 0) {
      const score = matchCount + directionBonus;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = phase;
      }
    }
  }

  // Only transition if we found a match and it's different from current
  if (bestMatch && bestMatch !== currentPhase && bestScore >= 1) {
    return {
      phase: bestMatch,
      confidence: Math.min(bestScore / 5, 1), // Normalize to 0-1
      detectedBy: 'keyword'
    };
  }

  return null;
}

/**
 * Update the call phase and record the transition
 * @param {string} callSid - Call identifier
 * @param {string} newPhase - The new phase
 * @param {Object} info - Detection info { confidence, detectedBy }
 */
async function updateCallPhase(callSid, newPhase, info) {
  const now = Date.now();
  const currentPhaseInfo = callPhases.get(callSid) || { currentPhase: 'intro', phaseHistory: [], lastTransitionAt: now };
  const previousPhase = currentPhaseInfo.currentPhase;
  const phaseDuration = Math.floor((now - currentPhaseInfo.lastTransitionAt) / 1000);

  // Update in-memory state
  currentPhaseInfo.phaseHistory.push({
    phase: previousPhase,
    duration: phaseDuration,
    endedAt: now
  });
  currentPhaseInfo.currentPhase = newPhase;
  currentPhaseInfo.lastTransitionAt = now;
  callPhases.set(callSid, currentPhaseInfo);

  console.log(`[Phase] Call ${callSid}: ${previousPhase} -> ${newPhase} (after ${phaseDuration}s, confidence: ${info.confidence?.toFixed(2) || 'N/A'})`);

  // Broadcast phase change to UI
  broadcastToClients({
    type: 'phase_change',
    callSid: callSid,
    previousPhase: previousPhase,
    currentPhase: newPhase,
    confidence: info.confidence,
    timestamp: new Date().toISOString()
  });

  // Record in database (async, don't await)
  if (supabase) {
    // Close previous phase record
    supabase.from('call_phase_analytics')
      .update({
        ended_at: new Date().toISOString(),
        duration_seconds: phaseDuration
      })
      .eq('call_sid', callSid)
      .eq('phase', previousPhase)
      .is('ended_at', null)
      .then(({ error }) => {
        if (error) console.error('[Phase] Error closing phase record:', error.message);
      });

    // Create new phase record
    supabase.from('call_phase_analytics')
      .insert({
        call_sid: callSid,
        phase: newPhase,
        started_at: new Date().toISOString(),
        detected_by: info.detectedBy || 'keyword',
        confidence_score: info.confidence || null
      })
      .then(({ error }) => {
        if (error) console.error('[Phase] Error creating phase record:', error.message);
      });
  }
}

/**
 * Initialize phase tracking for a new call
 * @param {string} callSid - Call identifier
 */
async function initializeCallPhase(callSid) {
  callPhases.set(callSid, {
    currentPhase: 'intro',
    phaseHistory: [],
    lastTransitionAt: Date.now()
  });

  // Create initial phase record in DB
  if (supabase) {
    await supabase.from('call_phase_analytics').insert({
      call_sid: callSid,
      phase: 'intro',
      started_at: new Date().toISOString(),
      detected_by: 'default',
      confidence_score: 1.0
    });
  }
}

/**
 * Get the current phase for a call
 * @param {string} callSid - Call identifier
 * @returns {string} - Current phase name
 */
function getCurrentPhase(callSid) {
  const phaseInfo = callPhases.get(callSid);
  return phaseInfo?.currentPhase || 'intro';
}

/**
 * Trigger background context update (non-blocking)
 * Called periodically as transcript grows
 * @param {string} callSid - Call identifier
 */
function updateCallContextBackground(callSid) {
  const transcript = callTranscripts.get(callSid) || [];
  const currentContext = callContextSummaries.get(callSid);

  // Check if update is needed
  const entryCount = transcript.length;
  const lastEntryCount = currentContext?.entryCount || 0;

  if (entryCount - lastEntryCount < CONTEXT_UPDATE_INTERVAL) {
    return; // Not enough new entries
  }

  // Run update in background
  generateContextSummary(callSid, transcript).catch(err => {
    console.error(`[Context] Error generating summary for ${callSid}:`, err.message);
  });
}

/**
 * Generate AI context summary (background, with timeout)
 * @param {string} callSid - Call identifier
 * @param {Array} transcript - Full transcript array
 */
async function generateContextSummary(callSid, transcript) {
  if (!anthropic || transcript.length < 5) return;

  const startTime = Date.now();

  try {
    // Build transcript text (last 30 entries max for context generation)
    const recentTranscript = transcript.slice(-30);
    const transcriptText = recentTranscript
      .map(t => `${t.speaker === 'customer' ? 'Customer' : 'Rep'}: ${t.text}`)
      .join('\n');

    const prompt = `Analyze this sales call excerpt and provide a brief context summary.

CONVERSATION:
${transcriptText}

Respond in this exact JSON format (no markdown):
{"summary":"1-2 sentence summary of conversation","topics":["topic1","topic2"],"sentiment":"positive|neutral|negative|mixed","insights":{"key_concern":"main customer concern if any","buying_signals":"any positive signals","objections":"any objections raised"}}`;

    // Use Promise.race for timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('CONTEXT_TIMEOUT')), CONTEXT_UPDATE_TIMEOUT_MS);
    });

    const apiPromise = anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }]
    });

    const response = await Promise.race([apiPromise, timeoutPromise]);
    const responseText = response.content[0]?.text?.trim() || '';

    // Parse JSON response
    let contextData;
    try {
      contextData = JSON.parse(responseText);
    } catch (e) {
      console.log(`[Context] Failed to parse JSON response: ${responseText.substring(0, 100)}`);
      return;
    }

    const latencyMs = Date.now() - startTime;

    // Store in memory
    callContextSummaries.set(callSid, {
      summary: contextData.summary || '',
      topics: contextData.topics || [],
      sentiment: contextData.sentiment || 'neutral',
      insights: contextData.insights || {},
      lastUpdatedAt: Date.now(),
      entryCount: transcript.length
    });

    console.log(`[Context] Updated summary for ${callSid} (${latencyMs}ms): ${contextData.summary?.substring(0, 50)}...`);

    // Save snapshot to DB (async, don't await)
    if (supabase) {
      supabase.from('call_context_snapshots').insert({
        call_sid: callSid,
        summary: contextData.summary,
        topics: contextData.topics,
        customer_sentiment: contextData.sentiment,
        key_insights: contextData.insights,
        transcript_entry_count: transcript.length
      }).then(({ error }) => {
        if (error) console.error('[Context] Error saving snapshot:', error.message);
      });
    }

  } catch (error) {
    if (error.message === 'CONTEXT_TIMEOUT') {
      console.log(`[Context] Timeout generating summary for ${callSid}`);
    } else {
      console.error(`[Context] Error generating summary:`, error.message);
    }
  }
}

/**
 * Get the current context summary for a call
 * @param {string} callSid - Call identifier
 * @returns {Object|null} - Context object or null
 */
function getCallContext(callSid) {
  return callContextSummaries.get(callSid) || null;
}

/**
 * Check if a suggestion can be shown based on cooldowns
 * @param {string} callSid - Call identifier
 * @param {string} scriptId - Script UUID to check
 * @returns {Object} - { canShow: boolean, reason: string }
 */
function canShowSuggestion(callSid, scriptId) {
  const now = Date.now();
  const cooldownInfo = scriptCooldowns.get(callSid);

  if (!cooldownInfo) {
    return { canShow: true, reason: 'first_suggestion' };
  }

  // Check max suggestions per call
  if (cooldownInfo.suggestionCount >= MAX_SUGGESTIONS_PER_CALL) {
    return { canShow: false, reason: 'max_suggestions_reached' };
  }

  // Check global cooldown
  const timeSinceLastSuggestion = now - cooldownInfo.lastSuggestionAt;
  if (timeSinceLastSuggestion < SUGGESTION_COOLDOWN_MS) {
    return { canShow: false, reason: 'cooldown_active', remainingMs: SUGGESTION_COOLDOWN_MS - timeSinceLastSuggestion };
  }

  // Check script-specific cooldown
  if (scriptId && cooldownInfo.recentlyShownScripts) {
    const lastShownAt = cooldownInfo.recentlyShownScripts.get(scriptId);
    if (lastShownAt) {
      const timeSinceShown = now - lastShownAt;
      if (timeSinceShown < SCRIPT_REPEAT_COOLDOWN_MS) {
        return { canShow: false, reason: 'script_repeat_cooldown', scriptId };
      }
    }
  }

  return { canShow: true, reason: 'cooldown_clear' };
}

/**
 * Record that a suggestion was shown
 * @param {string} callSid - Call identifier
 * @param {string} scriptId - Script UUID shown
 */
function recordSuggestionShown(callSid, scriptId) {
  const now = Date.now();
  let cooldownInfo = scriptCooldowns.get(callSid);

  if (!cooldownInfo) {
    cooldownInfo = {
      lastSuggestionAt: now,
      recentlyShownScripts: new Map(),
      suggestionCount: 0
    };
  }

  cooldownInfo.lastSuggestionAt = now;
  cooldownInfo.suggestionCount++;

  if (scriptId) {
    cooldownInfo.recentlyShownScripts.set(scriptId, now);
  }

  scriptCooldowns.set(callSid, cooldownInfo);
}

/**
 * Initialize cooldown tracking for a new call
 * @param {string} callSid - Call identifier
 */
function initializeCooldowns(callSid) {
  scriptCooldowns.set(callSid, {
    lastSuggestionAt: 0,
    recentlyShownScripts: new Map(),
    suggestionCount: 0
  });
}

/**
 * Get scripts already used in this call with their feedback
 * @param {string} callSid - Call identifier
 * @returns {Array} - Array of { scriptId, title, wasUsed, wasHelpful }
 */
async function getScriptsUsedThisCall(callSid) {
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('call_script_usage')
      .select('script_id, was_used, was_helpful, scripts(title)')
      .eq('call_sid', callSid);

    if (error || !data) return [];

    return data.map(usage => ({
      scriptId: usage.script_id,
      title: usage.scripts?.title || 'Unknown',
      wasUsed: usage.was_used || false,
      wasHelpful: usage.was_helpful
    }));
  } catch (err) {
    console.error('[Feedback] Error getting scripts used:', err.message);
    return [];
  }
}

/**
 * Build feedback context string for AI prompt
 * @param {Array} usageHistory - Array from getScriptsUsedThisCall
 * @returns {string} - Formatted string for AI prompt
 */
function buildFeedbackContext(usageHistory) {
  if (!usageHistory || usageHistory.length === 0) return '';

  const lines = usageHistory.map(u => {
    let status = 'shown';
    if (u.wasUsed && u.wasHelpful === true) status = 'helpful';
    else if (u.wasUsed && u.wasHelpful === false) status = 'not helpful';
    else if (u.wasUsed) status = 'used';
    return `- "${u.title}" (${status})`;
  });

  return `SCRIPTS ALREADY SHOWN THIS CALL:\n${lines.join('\n')}`;
}

/**
 * Clean up all Maps for a call when it ends
 * @param {string} callSid - Call identifier
 */
function cleanupCallMaps(callSid) {
  // Clean up context
  callContextSummaries.delete(callSid);

  // Clean up phase tracking
  callPhases.delete(callSid);

  // Clean up cooldowns
  scriptCooldowns.delete(callSid);

  console.log(`[Cleanup] Cleared Maps for call ${callSid}`);
}

/**
 * Initialize all phase/context/cooldown tracking for a new call
 * Called when a call starts
 * @param {string} callSid - Call identifier
 */
async function initializeCallTracking(callSid) {
  await initializeCallPhase(callSid);
  initializeCooldowns(callSid);
  console.log(`[Init] Initialized phase/context/cooldown tracking for call ${callSid}`);
}

/**
 * Process a new transcript entry for phase detection and context updates
 * Called after each final transcript is added
 * @param {string} callSid - Call identifier
 * @param {string} text - The transcript text
 * @param {string} speaker - 'rep' or 'customer'
 */
async function processTranscriptEntry(callSid, text, speaker) {
  // Detect if phase should change
  const phaseChange = detectCallPhase(callSid, text, speaker);
  if (phaseChange) {
    await updateCallPhase(callSid, phaseChange.phase, {
      confidence: phaseChange.confidence,
      detectedBy: phaseChange.detectedBy
    });
  }

  // Trigger background context update (non-blocking)
  updateCallContextBackground(callSid);
}

/**
 * 4-Layer Matching Algorithm for AI Coaching
 * Layer 1: Active Flow Check - Continue existing flow
 * Layer 2: Objection Category Detection - Find category and start flow
 * Layer 3: Enhanced Keyword Matching - Score-based script matching (with phase filtering)
 * Layer 4: AI Fallback - Generate suggestion with context
 *
 * Now includes: Phase-aware filtering, cooldown checks, context summaries, feedback integration
 *
 * @param {string} callSid - Call identifier
 * @param {string} knowledgeBaseId - Selected knowledge base UUID
 * @returns {Object|null} - Matching script, flow node, or null
 */
async function detectScriptMatch(callSid, knowledgeBaseId) {
  if (!supabase || !knowledgeBaseId) return null;

  try {
    // ========== COOLDOWN CHECK ==========
    // Check global suggestion cooldown first (skip if on cooldown)
    const cooldownCheck = canShowSuggestion(callSid, null);
    if (!cooldownCheck.canShow && cooldownCheck.reason !== 'first_suggestion') {
      // Silently skip if on cooldown
      return null;
    }

    // Get recent customer statements from transcript
    const transcript = callTranscripts.get(callSid) || [];
    const recentCustomerStatements = transcript
      .filter(t => t.speaker === 'customer')
      .slice(-3);
    const recentCustomerText = recentCustomerStatements
      .map(t => t.text.toLowerCase())
      .join(' ');

    if (!recentCustomerText) return null;

    const latestCustomerText = recentCustomerStatements.length > 0
      ? recentCustomerStatements[recentCustomerStatements.length - 1].text
      : '';

    // ========== GET CURRENT PHASE ==========
    const currentPhase = getCurrentPhase(callSid);

    // ========== LAYER 1: Active Flow Check ==========
    const activeFlow = activeCallFlows.get(callSid);
    if (activeFlow) {
      console.log(`[Layer 1] Checking active flow for call ${callSid}, current node: ${activeFlow.currentNodeId}`);

      const nextNodeResult = await getNextFlowNode(activeFlow.currentNodeId, latestCustomerText);
      if (nextNodeResult) {
        // Update flow progress
        activeFlow.currentNodeId = nextNodeResult.node.id;
        activeFlow.stepNumber = nextNodeResult.node.step_number;
        activeCallFlows.set(callSid, activeFlow);

        console.log(`[Layer 1] Flow continues: ${nextNodeResult.node.title} (Step ${nextNodeResult.node.step_number})`);

        // Track flow progress
        await supabase.from('call_flow_progress').update({
          current_node_id: nextNodeResult.node.id,
          steps_shown: activeFlow.stepNumber
        }).eq('call_sid', callSid).eq('flow_id', activeFlow.flowId);

        return {
          ...nextNodeResult.node,
          isFlowNode: true,
          flowId: activeFlow.flowId,
          flowName: activeFlow.flowName,
          stepNumber: nextNodeResult.node.step_number,
          totalSteps: activeFlow.totalSteps,
          branchLabel: nextNodeResult.branchLabel
        };
      } else {
        // Flow complete or no matching branch
        console.log(`[Layer 1] Flow complete or no branch match, clearing flow`);
        activeCallFlows.delete(callSid);

        // Mark flow as completed
        await supabase.from('call_flow_progress').update({
          completed_at: new Date().toISOString(),
          exit_reason: 'completed'
        }).eq('call_sid', callSid).eq('flow_id', activeFlow.flowId);
      }
    }

    // ========== LAYER 2: Objection Category Detection ==========
    const category = await detectObjectionCategory(recentCustomerText, knowledgeBaseId);
    if (category && category.matchScore >= 2) {
      console.log(`[Layer 2] Objection detected: ${category.display_name}`);

      // Try to get a flow for this category
      const flowResult = await getFlowForCategory(category.id);
      if (flowResult) {
        console.log(`[Layer 2] Starting flow: ${flowResult.flow.name}`);

        // Track flow start
        activeCallFlows.set(callSid, {
          flowId: flowResult.flow.id,
          flowName: flowResult.flow.name,
          currentNodeId: flowResult.firstNode.id,
          stepNumber: 1,
          totalSteps: flowResult.totalSteps,
          category: category
        });

        // Record flow progress in database
        await supabase.from('call_flow_progress').insert({
          call_sid: callSid,
          flow_id: flowResult.flow.id,
          knowledge_base_id: knowledgeBaseId,
          current_node_id: flowResult.firstNode.id,
          steps_shown: 1
        });

        // Increment flow start counter
        await supabase.from('conversation_flows')
          .update({ times_started: (flowResult.flow.times_started || 0) + 1 })
          .eq('id', flowResult.flow.id);

        return {
          ...flowResult.firstNode,
          isFlowNode: true,
          flowId: flowResult.flow.id,
          flowName: flowResult.flow.name,
          stepNumber: 1,
          totalSteps: flowResult.totalSteps,
          category: category
        };
      }
    }

    // ========== LAYER 3: AI-Powered Script Selection (with Keyword Fallback) ==========
    // Query scripts with phase filtering via applicable_phases column
    const { data: scripts, error } = await supabase
      .from('scripts')
      .select('id, title, trigger_phrases, script_text, story_text, tips, category, objection_category_id, match_score_weight, applicable_phases, phase_specific_guidance')
      .eq('knowledge_base_id', knowledgeBaseId)
      .eq('is_active', true)
      .contains('applicable_phases', [currentPhase]); // Filter by current phase

    if (error || !scripts || scripts.length === 0) {
      console.log(`[Layer 3] No scripts found for knowledge base ${knowledgeBaseId} in phase ${currentPhase}`);
      return null;
    }

    // Filter out scripts that are on individual cooldown
    const availableScripts = scripts.filter(script => {
      const scriptCooldownCheck = canShowSuggestion(callSid, script.id);
      return scriptCooldownCheck.canShow || scriptCooldownCheck.reason === 'first_suggestion';
    });

    if (availableScripts.length === 0) {
      console.log('[Layer 3] All matching scripts are on cooldown');
      return null;
    }

    // ========== GET CONTEXT AND FEEDBACK ==========
    const callContext = getCallContext(callSid);
    const contextSummary = callContext?.summary || '';
    const contextAvailable = !!contextSummary;

    // Get scripts already used this call for feedback context
    const usageHistory = await getScriptsUsedThisCall(callSid);
    const feedbackContext = buildFeedbackContext(usageHistory);

    // Build enhanced context for AI
    const enhancedContext = {
      phase: currentPhase,
      contextSummary: contextSummary,
      feedbackContext: feedbackContext
    };

    let bestMatch = null;
    let bestScore = 0;
    let matchMethod = 'keyword';
    let aiLatencyMs = 0;

    // Try AI selection first (800ms timeout) with enhanced context
    const aiResult = await selectScriptWithAI(recentCustomerText, availableScripts, transcript, 800, enhancedContext);
    aiLatencyMs = aiResult.latencyMs;

    if (aiResult.scriptIndex !== null) {
      // AI found a match (index is relative to availableScripts)
      bestMatch = availableScripts[aiResult.scriptIndex];
      matchMethod = 'ai';
      bestScore = 100; // AI matches bypass score threshold
      console.log(`[Layer 3] AI selected script: "${bestMatch?.title}" (${aiLatencyMs}ms, phase: ${currentPhase})`);
    } else if (!aiResult.aiSelected) {
      // AI failed or timed out - fall back to keyword matching
      console.log(`[Layer 3] AI unavailable, falling back to keyword matching`);

      for (const script of availableScripts) {
        const score = calculateScriptMatchScore(recentCustomerText, script.trigger_phrases);
        const weightedScore = score + (script.match_score_weight || 0);

        if (weightedScore > bestScore && score > 0) {
          bestScore = weightedScore;
          bestMatch = script;
        }
      }

      // Require minimum score threshold for keyword matches
      if (!bestMatch || bestScore < 5) {
        bestMatch = null;
      }
    }
    // else: AI returned 0 (no good match) - continue to Layer 4

    if (bestMatch && (matchMethod === 'ai' || bestScore >= 5)) {
      console.log(`[Layer 3] Script match found: "${bestMatch.title}" (method: ${matchMethod}, score: ${bestScore}, phase: ${currentPhase})`);

      // Record suggestion shown for cooldown tracking
      recordSuggestionShown(callSid, bestMatch.id);

      // Track that this script was shown with match method analytics and phase
      await supabase.from('call_script_usage').insert({
        call_sid: callSid,
        script_id: bestMatch.id,
        knowledge_base_id: knowledgeBaseId,
        shown_at: new Date().toISOString(),
        match_method: matchMethod,
        ai_latency_ms: aiLatencyMs > 0 ? aiLatencyMs : null,
        call_phase: currentPhase,
        context_summary_used: contextAvailable
      });

      // Increment times_shown counter
      await supabase
        .from('scripts')
        .update({ times_shown: (bestMatch.times_shown || 0) + 1 })
        .eq('id', bestMatch.id);

      // Update phase analytics - increment scripts_shown_count (async, non-blocking)
      supabase.rpc('increment_phase_scripts_shown', {
        p_call_sid: callSid,
        p_phase: currentPhase
      }).then(() => {}).catch(() => {
        // Fallback: If RPC doesn't exist, just log it
        console.log('[Phase] Note: increment_phase_scripts_shown RPC not available');
      });

      // Get category info if available
      let categoryInfo = null;
      if (bestMatch.objection_category_id) {
        const { data: cat } = await supabase
          .from('objection_categories')
          .select('name, display_name, icon, color')
          .eq('id', bestMatch.objection_category_id)
          .single();
        categoryInfo = cat;
      } else if (category) {
        categoryInfo = category;
      }

      // Get phase-specific guidance if available
      const phaseGuidance = bestMatch.phase_specific_guidance?.[currentPhase] || null;

      return {
        ...bestMatch,
        isFlowNode: false,
        matchScore: bestScore,
        matchMethod: matchMethod,
        category: categoryInfo,
        currentPhase: currentPhase,
        phaseGuidance: phaseGuidance,
        contextUsed: contextAvailable
      };
    }

    console.log('[Layer 3] No script match found');
    return null;
  } catch (error) {
    console.error('Script match error:', error.message);
    return null;
  }
}

/**
 * Get AI coaching suggestion - uses 4-layer matching then falls back to AI
 * @param {string} callSid - Call identifier
 * @param {string} latestTranscript - Most recent transcript text
 * @param {string} knowledgeBaseId - Selected knowledge base UUID (optional)
 * @returns {Object|null} - Coaching response with type 'script', 'flow', or 'ai'
 */
async function getAICoachingSuggestion(callSid, latestTranscript, knowledgeBaseId = null) {
  const transcript = callTranscripts.get(callSid) || [];
  if (transcript.length < 3) return null; // Need some context

  // First, try the 4-layer matching algorithm
  if (knowledgeBaseId) {
    const match = await detectScriptMatch(callSid, knowledgeBaseId);
    if (match) {
      // Check if this is a flow node or a regular script
      if (match.isFlowNode) {
        return {
          type: 'flow',
          flowId: match.flowId,
          flowName: match.flowName,
          nodeId: match.id,
          stepNumber: match.stepNumber,
          totalSteps: match.totalSteps,
          title: match.title,
          scriptText: match.script_text,
          storyText: match.story_text,
          tips: match.tips,
          expectedResponses: match.expected_responses,
          category: match.category,
          branchLabel: match.branchLabel
        };
      } else {
        return {
          type: 'script',
          scriptId: match.id,
          category: match.category,
          title: match.title,
          scriptText: match.script_text,
          storyText: match.story_text,
          tips: match.tips,
          matchScore: match.matchScore
        };
      }
    }
  }

  // Fall back to AI-generated suggestion (Layer 4)
  if (!anthropic) {
    console.log('[Layer 4] Anthropic API key not configured - skipping AI coaching');
    return null;
  }

  console.log('[Layer 4] Using AI fallback for coaching suggestion');

  // Get last 10 exchanges for context
  const recentTranscript = transcript.slice(-10).map(t => `${t.speaker}: ${t.text}`).join('\n');

  // Build enhanced context about the knowledge base
  let kbContext = '';
  let objectionCategoryContext = '';

  if (knowledgeBaseId && supabase) {
    // Get KB info
    const { data: kb } = await supabase
      .from('knowledge_bases')
      .select('name, description, industry')
      .eq('id', knowledgeBaseId)
      .single();

    if (kb) {
      kbContext = `\nKnowledge Base: "${kb.name}" (${kb.industry || 'general'} industry). ${kb.description || ''}`;
    }

    // Get objection categories for context
    const { data: categories } = await supabase
      .from('objection_categories')
      .select('name, display_name, detection_keywords')
      .eq('knowledge_base_id', knowledgeBaseId)
      .eq('is_active', true);

    if (categories && categories.length > 0) {
      objectionCategoryContext = `\nObjection Types to Watch For:\n${categories.map(c =>
        `- ${c.display_name}: ${c.detection_keywords.slice(0, 5).join(', ')}`
      ).join('\n')}`;
    }

    // Get recent customer text and try to identify likely objection
    const recentCustomerText = transcript
      .filter(t => t.speaker === 'customer')
      .slice(-3)
      .map(t => t.text.toLowerCase())
      .join(' ');

    const detectedCategory = await detectObjectionCategory(recentCustomerText, knowledgeBaseId);
    if (detectedCategory) {
      objectionCategoryContext += `\n\nDETECTED OBJECTION TYPE: ${detectedCategory.display_name}`;

      // Try to get relevant scripts for this category to inform AI
      const { data: categoryScripts } = await supabase
        .from('scripts')
        .select('title, script_text')
        .eq('knowledge_base_id', knowledgeBaseId)
        .eq('objection_category_id', detectedCategory.id)
        .eq('is_active', true)
        .limit(2);

      if (categoryScripts && categoryScripts.length > 0) {
        objectionCategoryContext += `\nRelevant Scripts:\n${categoryScripts.map(s =>
          `- "${s.title}": ${s.script_text.substring(0, 100)}...`
        ).join('\n')}`;
      }
    }
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 200,
      system: `You are a real-time sales coach providing guidance during a live call.

Your job is to give ONE specific, word-for-word suggestion the rep can say NOW.

Guidelines:
- Provide the EXACT words to say, in quotes
- Keep it under 30 words
- Focus on the customer's last statement
- If an objection is detected, address it directly
- If no coaching needed, respond with "NONE"
${kbContext}${objectionCategoryContext}`,
      messages: [{
        role: 'user',
        content: `Call Transcript:\n${recentTranscript}\n\nCustomer just said: "${latestTranscript}"\n\nWhat should the rep say next? Provide exact words in quotes:`
      }]
    });

    const suggestion = response.content[0].text.trim();
    if (suggestion === 'NONE' || suggestion.length < 5) return null;

    // Try to detect what category this AI suggestion relates to
    let aiCategory = null;
    if (knowledgeBaseId) {
      const recentCustomerText = transcript
        .filter(t => t.speaker === 'customer')
        .slice(-3)
        .map(t => t.text.toLowerCase())
        .join(' ');
      aiCategory = await detectObjectionCategory(recentCustomerText, knowledgeBaseId);
    }

    return {
      type: 'ai',
      suggestion: suggestion,
      category: aiCategory
    };
  } catch (error) {
    console.error('AI coaching error:', error.message);
    return null;
  }
}

// ============ KNOWLEDGE BASE API ENDPOINTS ============

/**
 * Get all active knowledge bases
 * GET /api/knowledge-bases
 */
app.get('/api/knowledge-bases', async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ success: false, error: 'Database not configured' });
  }

  try {
    const { data, error } = await supabase
      .from('knowledge_bases')
      .select('id, name, description, industry, is_default')
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .order('name');

    if (error) throw error;
    res.json({ success: true, knowledgeBases: data });
  } catch (error) {
    console.error('Error fetching knowledge bases:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get scripts for a knowledge base
 * GET /api/knowledge-bases/:id/scripts
 */
app.get('/api/knowledge-bases/:id/scripts', async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ success: false, error: 'Database not configured' });
  }

  try {
    const { data, error } = await supabase
      .from('scripts')
      .select('*')
      .eq('knowledge_base_id', req.params.id)
      .eq('is_active', true)
      .order('category')
      .order('sort_order');

    if (error) throw error;
    res.json({ success: true, scripts: data });
  } catch (error) {
    console.error('Error fetching scripts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Mark a script as used during a call
 * POST /api/scripts/:scriptId/used
 * Body: { callSid: string }
 */
app.post('/api/scripts/:scriptId/used', async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ success: false, error: 'Database not configured' });
  }

  try {
    const { scriptId } = req.params;
    const { callSid } = req.body;

    // Update the call_script_usage record
    const { error: usageError } = await supabase
      .from('call_script_usage')
      .update({ was_used: true })
      .eq('script_id', scriptId)
      .eq('call_sid', callSid)
      .order('shown_at', { ascending: false })
      .limit(1);

    // Increment times_used on the script
    const { data: script } = await supabase
      .from('scripts')
      .select('times_used')
      .eq('id', scriptId)
      .single();

    await supabase
      .from('scripts')
      .update({ times_used: (script?.times_used || 0) + 1 })
      .eq('id', scriptId);

    console.log(`Script ${scriptId} marked as used for call ${callSid}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking script as used:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Submit feedback for a script
 * POST /api/scripts/:scriptId/feedback
 * Body: { callSid: string, helpful: boolean, outcome?: string }
 */
app.post('/api/scripts/:scriptId/feedback', async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ success: false, error: 'Database not configured' });
  }

  try {
    const { scriptId } = req.params;
    const { callSid, helpful, outcome } = req.body;

    // Update the call_script_usage record
    const updateData = { was_helpful: helpful };
    if (outcome) updateData.call_outcome = outcome;

    await supabase
      .from('call_script_usage')
      .update(updateData)
      .eq('script_id', scriptId)
      .eq('call_sid', callSid)
      .order('shown_at', { ascending: false })
      .limit(1);

    // If outcome is 'booked' or 'converted', increment times_converted
    if (outcome === 'booked' || outcome === 'converted') {
      const { data: script } = await supabase
        .from('scripts')
        .select('times_converted')
        .eq('id', scriptId)
        .single();

      await supabase
        .from('scripts')
        .update({ times_converted: (script?.times_converted || 0) + 1 })
        .eq('id', scriptId);
    }

    console.log(`Feedback recorded for script ${scriptId}: helpful=${helpful}, outcome=${outcome}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Error recording script feedback:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get script performance analytics
 * GET /api/scripts/analytics
 */
app.get('/api/scripts/analytics', async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ success: false, error: 'Database not configured' });
  }

  try {
    const { data, error } = await supabase
      .from('scripts')
      .select(`
        id,
        title,
        category,
        times_shown,
        times_used,
        times_converted,
        conversion_rate,
        knowledge_bases!inner(name)
      `)
      .gt('times_shown', 0)
      .order('conversion_rate', { ascending: false });

    if (error) throw error;
    res.json({ success: true, analytics: data });
  } catch (error) {
    console.error('Error fetching script analytics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Create a new knowledge base
 * POST /api/knowledge-bases
 */
app.post('/api/knowledge-bases', async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ success: false, error: 'Database not configured' });
  }

  try {
    const { name, description, industry, is_default } = req.body;

    // If setting as default, unset other defaults first
    if (is_default) {
      await supabase.from('knowledge_bases').update({ is_default: false }).eq('is_default', true);
    }

    const { data, error } = await supabase
      .from('knowledge_bases')
      .insert({ name, description, industry, is_default: is_default || false, is_active: true })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, knowledgeBase: data });
  } catch (error) {
    console.error('Error creating knowledge base:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update a knowledge base
 * PUT /api/knowledge-bases/:id
 */
app.put('/api/knowledge-bases/:id', async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ success: false, error: 'Database not configured' });
  }

  try {
    const { name, description, industry, is_default } = req.body;

    // If setting as default, unset other defaults first
    if (is_default) {
      await supabase.from('knowledge_bases').update({ is_default: false }).eq('is_default', true);
    }

    const { data, error } = await supabase
      .from('knowledge_bases')
      .update({ name, description, industry, is_default, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, knowledgeBase: data });
  } catch (error) {
    console.error('Error updating knowledge base:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Delete a knowledge base
 * DELETE /api/knowledge-bases/:id
 */
app.delete('/api/knowledge-bases/:id', async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ success: false, error: 'Database not configured' });
  }

  try {
    const { error } = await supabase
      .from('knowledge_bases')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting knowledge base:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Create a new script
 * POST /api/scripts
 */
app.post('/api/scripts', async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ success: false, error: 'Database not configured' });
  }

  try {
    const { knowledge_base_id, category, title, trigger_phrases, script_text, story_text, tips } = req.body;

    const { data, error } = await supabase
      .from('scripts')
      .insert({
        knowledge_base_id,
        category,
        title,
        trigger_phrases,
        script_text,
        story_text,
        tips,
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, script: data });
  } catch (error) {
    console.error('Error creating script:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update a script
 * PUT /api/scripts/:id
 */
app.put('/api/scripts/:id', async (req, res) => {
  console.log('=== PUT /api/scripts/:id DEBUG ===');
  console.log('Script ID from URL:', req.params.id);
  console.log('Request body:', req.body);

  if (!supabase) {
    return res.status(500).json({ success: false, error: 'Database not configured' });
  }

  try {
    const { category, title, trigger_phrases, script_text, story_text, tips } = req.body;

    // Build update object with only provided fields
    const updateData = { updated_at: new Date().toISOString() };
    if (category !== undefined) updateData.category = category;
    if (title !== undefined) updateData.title = title;
    if (trigger_phrases !== undefined) updateData.trigger_phrases = trigger_phrases;
    if (script_text !== undefined) updateData.script_text = script_text;
    if (story_text !== undefined) updateData.story_text = story_text;
    if (tips !== undefined) updateData.tips = tips;

    console.log('Update data:', updateData);

    const { data, error } = await supabase
      .from('scripts')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    console.log('Supabase response - data:', data);
    console.log('Supabase response - error:', error);

    if (error) throw error;

    // Check if a row was actually updated
    if (!data) {
      console.log('No data returned - script not found');
      return res.status(404).json({ success: false, error: 'Script not found' });
    }

    console.log('Script updated successfully:', data.id);
    res.json({ success: true, script: data });
  } catch (error) {
    console.error('Error updating script:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Delete a script
 * DELETE /api/scripts/:id
 */
app.delete('/api/scripts/:id', async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ success: false, error: 'Database not configured' });
  }

  try {
    const { error } = await supabase
      .from('scripts')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting script:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ OBJECTION CATEGORIES API ENDPOINTS ============

/**
 * Get objection categories for a knowledge base
 * GET /api/knowledge-bases/:kbId/categories
 */
app.get('/api/knowledge-bases/:kbId/categories', async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ success: false, error: 'Database not configured' });
  }

  try {
    const { data, error } = await supabase
      .from('objection_categories')
      .select('*')
      .eq('knowledge_base_id', req.params.kbId)
      .eq('is_active', true)
      .order('sort_order');

    if (error) throw error;
    res.json({ success: true, categories: data });
  } catch (error) {
    console.error('Error fetching objection categories:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Create a new objection category
 * POST /api/objection-categories
 */
app.post('/api/objection-categories', async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ success: false, error: 'Database not configured' });
  }

  try {
    const { knowledge_base_id, name, display_name, icon, color, detection_keywords, sort_order } = req.body;

    const { data, error } = await supabase
      .from('objection_categories')
      .insert({
        knowledge_base_id,
        name,
        display_name,
        icon,
        color,
        detection_keywords: detection_keywords || [],
        sort_order: sort_order || 0,
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, category: data });
  } catch (error) {
    console.error('Error creating objection category:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update an objection category
 * PUT /api/objection-categories/:id
 */
app.put('/api/objection-categories/:id', async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ success: false, error: 'Database not configured' });
  }

  try {
    const { name, display_name, icon, color, detection_keywords, sort_order } = req.body;

    const { data, error } = await supabase
      .from('objection_categories')
      .update({
        name,
        display_name,
        icon,
        color,
        detection_keywords,
        sort_order,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, category: data });
  } catch (error) {
    console.error('Error updating objection category:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Delete an objection category
 * DELETE /api/objection-categories/:id
 */
app.delete('/api/objection-categories/:id', async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ success: false, error: 'Database not configured' });
  }

  try {
    const { error } = await supabase
      .from('objection_categories')
      .update({ is_active: false })
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting objection category:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ CONVERSATION FLOWS API ENDPOINTS ============

/**
 * Get conversation flows for a knowledge base
 * GET /api/knowledge-bases/:kbId/flows
 */
app.get('/api/knowledge-bases/:kbId/flows', async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ success: false, error: 'Database not configured' });
  }

  try {
    const { data, error } = await supabase
      .from('conversation_flows')
      .select(`
        *,
        objection_categories!entry_category_id(id, name, display_name, icon, color)
      `)
      .eq('knowledge_base_id', req.params.kbId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, flows: data });
  } catch (error) {
    console.error('Error fetching conversation flows:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get a single conversation flow with nodes
 * GET /api/flows/:id
 */
app.get('/api/flows/:id', async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ success: false, error: 'Database not configured' });
  }

  try {
    // Get flow
    const { data: flow, error: flowError } = await supabase
      .from('conversation_flows')
      .select(`
        *,
        objection_categories!entry_category_id(id, name, display_name, icon, color)
      `)
      .eq('id', req.params.id)
      .single();

    if (flowError) throw flowError;

    // Get nodes
    const { data: nodes, error: nodesError } = await supabase
      .from('flow_nodes')
      .select('*')
      .eq('flow_id', req.params.id)
      .order('step_number')
      .order('sort_order');

    if (nodesError) throw nodesError;

    // Get branches
    const nodeIds = nodes.map(n => n.id);
    const { data: branches, error: branchesError } = await supabase
      .from('flow_branches')
      .select('*')
      .in('from_node_id', nodeIds);

    if (branchesError) throw branchesError;

    res.json({ success: true, flow, nodes, branches });
  } catch (error) {
    console.error('Error fetching conversation flow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Create a new conversation flow
 * POST /api/flows
 */
app.post('/api/flows', async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ success: false, error: 'Database not configured' });
  }

  try {
    const { knowledge_base_id, name, description, entry_category_id, entry_triggers } = req.body;

    const { data, error } = await supabase
      .from('conversation_flows')
      .insert({
        knowledge_base_id,
        name,
        description,
        entry_category_id,
        entry_triggers: entry_triggers || [],
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, flow: data });
  } catch (error) {
    console.error('Error creating conversation flow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update a conversation flow
 * PUT /api/flows/:id
 */
app.put('/api/flows/:id', async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ success: false, error: 'Database not configured' });
  }

  try {
    const { name, description, entry_category_id, entry_triggers, is_active } = req.body;

    const { data, error } = await supabase
      .from('conversation_flows')
      .update({
        name,
        description,
        entry_category_id,
        entry_triggers,
        is_active,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, flow: data });
  } catch (error) {
    console.error('Error updating conversation flow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Delete a conversation flow
 * DELETE /api/flows/:id
 */
app.delete('/api/flows/:id', async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ success: false, error: 'Database not configured' });
  }

  try {
    const { error } = await supabase
      .from('conversation_flows')
      .update({ is_active: false })
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting conversation flow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ FLOW NODES API ENDPOINTS ============

/**
 * Create a flow node
 * POST /api/flow-nodes
 */
app.post('/api/flow-nodes', async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ success: false, error: 'Database not configured' });
  }

  try {
    const { flow_id, node_type, step_number, title, script_text, story_text, tips, expected_responses, is_optional, sort_order } = req.body;

    const { data, error } = await supabase
      .from('flow_nodes')
      .insert({
        flow_id,
        node_type,
        step_number,
        title,
        script_text,
        story_text,
        tips,
        expected_responses: expected_responses || [],
        is_optional: is_optional || false,
        sort_order: sort_order || 0
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, node: data });
  } catch (error) {
    console.error('Error creating flow node:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update a flow node
 * PUT /api/flow-nodes/:id
 */
app.put('/api/flow-nodes/:id', async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ success: false, error: 'Database not configured' });
  }

  try {
    const { node_type, step_number, title, script_text, story_text, tips, expected_responses, is_optional, sort_order } = req.body;

    // Build update object with only provided fields
    const updateData = { updated_at: new Date().toISOString() };
    if (node_type !== undefined) updateData.node_type = node_type;
    if (step_number !== undefined) updateData.step_number = step_number;
    if (title !== undefined) updateData.title = title;
    if (script_text !== undefined) updateData.script_text = script_text;
    if (story_text !== undefined) updateData.story_text = story_text;
    if (tips !== undefined) updateData.tips = tips;
    if (expected_responses !== undefined) updateData.expected_responses = expected_responses;
    if (is_optional !== undefined) updateData.is_optional = is_optional;
    if (sort_order !== undefined) updateData.sort_order = sort_order;

    const { data, error } = await supabase
      .from('flow_nodes')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    // Check if a row was actually updated
    if (!data) {
      return res.status(404).json({ success: false, error: 'Flow node not found' });
    }

    res.json({ success: true, node: data });
  } catch (error) {
    console.error('Error updating flow node:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Delete a flow node
 * DELETE /api/flow-nodes/:id
 */
app.delete('/api/flow-nodes/:id', async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ success: false, error: 'Database not configured' });
  }

  try {
    const { error } = await supabase
      .from('flow_nodes')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting flow node:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ FLOW BRANCHES API ENDPOINTS ============

/**
 * Create a flow branch
 * POST /api/flow-branches
 */
app.post('/api/flow-branches', async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ success: false, error: 'Database not configured' });
  }

  try {
    const { from_node_id, to_node_id, trigger_keywords, label, is_default, sort_order } = req.body;

    const { data, error } = await supabase
      .from('flow_branches')
      .insert({
        from_node_id,
        to_node_id,
        trigger_keywords: trigger_keywords || [],
        label,
        is_default: is_default || false,
        sort_order: sort_order || 0
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, branch: data });
  } catch (error) {
    console.error('Error creating flow branch:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Delete a flow branch
 * DELETE /api/flow-branches/:id
 */
app.delete('/api/flow-branches/:id', async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ success: false, error: 'Database not configured' });
  }

  try {
    const { error } = await supabase
      .from('flow_branches')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting flow branch:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ ACTIVE FLOW MANAGEMENT ============

/**
 * Clear active flow for a call (allows starting a new flow)
 * DELETE /api/calls/:callSid/active-flow
 */
app.delete('/api/calls/:callSid/active-flow', (req, res) => {
  const { callSid } = req.params;
  if (activeCallFlows.has(callSid)) {
    activeCallFlows.delete(callSid);
    console.log(`Active flow cleared for call ${callSid}`);
    res.json({ success: true, message: 'Active flow cleared' });
  } else {
    res.json({ success: true, message: 'No active flow to clear' });
  }
});

/**
 * Get current flow state for a call
 * GET /api/calls/:callSid/flow-state
 */
app.get('/api/calls/:callSid/flow-state', (req, res) => {
  const { callSid } = req.params;
  const flowState = activeCallFlows.get(callSid);
  res.json({
    success: true,
    hasActiveFlow: !!flowState,
    flowState: flowState || null
  });
});

// ============ COACHING LAB API ENDPOINTS ============

/**
 * Build WHY explanation for a coaching match
 * @param {string} text - Customer text that was analyzed
 * @param {Object} category - Detected category with keywords
 * @param {Object} match - The matching coaching result
 * @param {Array} allCategories - All categories checked
 * @returns {Object} - Detailed explanation of why this triggered
 */
function buildWhyExplanation(text, category, match, allCategories = []) {
  const lowerText = text.toLowerCase();
  const why = {
    keywordsFound: [],
    keywordsChecked: [],
    confidenceBreakdown: [],
    source: {},
    alternatives: []
  };

  // Extract matched keywords
  if (category && category.detection_keywords) {
    for (const keyword of category.detection_keywords) {
      const lowerKeyword = keyword.toLowerCase();
      if (lowerText.includes(lowerKeyword)) {
        why.keywordsFound.push(keyword);
      } else {
        why.keywordsChecked.push(keyword);
      }
    }
  }

  // Build confidence breakdown
  let totalScore = 0;
  if (why.keywordsFound.length > 0) {
    // Primary keyword detection
    const primaryScore = 40;
    totalScore += primaryScore;
    why.confidenceBreakdown.push({
      factor: `Primary keyword "${why.keywordsFound[0]}"`,
      points: primaryScore
    });

    // Additional keywords
    if (why.keywordsFound.length > 1) {
      const additionalScore = (why.keywordsFound.length - 1) * 15;
      totalScore += additionalScore;
      why.confidenceBreakdown.push({
        factor: `${why.keywordsFound.length - 1} additional keyword(s)`,
        points: additionalScore
      });
    }

    // Modifier detection (intensifiers like "too", "very", "really")
    const modifiers = ['too', 'very', 'really', 'so', 'way', 'extremely', 'super'];
    const foundModifiers = modifiers.filter(m => lowerText.includes(m));
    if (foundModifiers.length > 0) {
      const modifierScore = 20;
      totalScore += modifierScore;
      why.confidenceBreakdown.push({
        factor: `Intensifier "${foundModifiers[0]}"`,
        points: modifierScore
      });
    }

    // Context bonus (sentence structure suggests objection)
    const objectionPhrases = ['can\'t', 'don\'t', 'won\'t', 'not', 'no', 'but'];
    if (objectionPhrases.some(p => lowerText.includes(p))) {
      const contextScore = 15;
      totalScore += contextScore;
      why.confidenceBreakdown.push({
        factor: 'Objection context detected',
        points: contextScore
      });
    }
  }

  why.confidence = Math.min(totalScore, 100);

  // Source information
  if (match) {
    if (match.isFlowNode) {
      why.source = {
        type: 'flow',
        flowName: match.flowName || 'Unknown Flow',
        nodeName: match.title || 'Step',
        stepNumber: match.stepNumber || 1,
        totalSteps: match.totalSteps || 1
      };
    } else {
      why.source = {
        type: 'script',
        scriptId: match.id,
        scriptTitle: match.title || 'Script',
        category: category?.display_name || 'General'
      };
    }
  }

  // Build alternatives from other categories
  if (allCategories && allCategories.length > 0) {
    why.alternatives = allCategories
      .filter(c => c.id !== category?.id && c.matchScore > 0)
      .slice(0, 3)
      .map(c => ({
        category: c.display_name,
        score: c.matchScore,
        icon: c.icon
      }));
  }

  return why;
}

/**
 * Get coaching lab status - check if AI is configured
 * GET /api/coaching-lab/status
 */
app.get('/api/coaching-lab/status', (req, res) => {
  res.json({
    success: true,
    aiEnabled: !!anthropic,
    databaseEnabled: !!supabase,
    features: {
      aiScriptSelection: !!anthropic,
      aiContextGeneration: !!anthropic,
      phaseDetection: true,
      keywordMatching: true
    }
  });
});

/**
 * Test coaching match - main endpoint for Coaching Lab
 * POST /api/coaching-lab/test
 * Body: { text, knowledgeBaseId, currentFlowId?, currentNodeId?, phase?, useLiveMode?, conversationHistory? }
 *
 * NEW: If useLiveMode is true, uses the same detectScriptMatch function as live calls
 * with phase filtering, AI selection, and context awareness.
 */
app.post('/api/coaching-lab/test', async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ success: false, error: 'Database not configured' });
  }

  try {
    const { text, knowledgeBaseId, currentFlowId, currentNodeId, phase, useLiveMode, conversationHistory, contextUpdateInterval } = req.body;
    const effectiveContextInterval = contextUpdateInterval || CONTEXT_UPDATE_INTERVAL; // Use setting or default

    if (!text || !knowledgeBaseId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: text, knowledgeBaseId'
      });
    }

    const lowerText = text.toLowerCase();

    // Get all categories for this KB (for alternatives)
    const { data: allCategories, error: catError } = await supabase
      .from('objection_categories')
      .select('id, name, display_name, icon, color, detection_keywords')
      .eq('knowledge_base_id', knowledgeBaseId)
      .eq('is_active', true);

    if (catError) {
      console.error('Error fetching categories:', catError);
    }

    // Score all categories
    const scoredCategories = (allCategories || []).map(category => {
      let score = 0;
      if (category.detection_keywords) {
        for (const keyword of category.detection_keywords) {
          if (lowerText.includes(keyword.toLowerCase())) {
            score += keyword.includes(' ') ? 3 : 1;
          }
        }
      }
      return { ...category, matchScore: score };
    }).sort((a, b) => b.matchScore - a.matchScore);

    // Best matching category
    const bestCategory = scoredCategories.find(c => c.matchScore > 0) || null;

    let match = null;
    let coachingResult = null;

    // ========== LIVE MODE: Use the same logic as live calls ==========
    if (useLiveMode) {
      // Create a temporary callSid for this test session
      const testCallSid = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Set up temporary transcript from conversation history
      if (conversationHistory && conversationHistory.length > 0) {
        callTranscripts.set(testCallSid, conversationHistory.map(msg => ({
          speaker: msg.speaker,
          text: msg.text,
          timestamp: msg.timestamp || new Date().toISOString(),
          isFinal: true
        })));
      } else {
        // Create minimal transcript with just the test text
        callTranscripts.set(testCallSid, [{
          speaker: 'customer',
          text: text,
          timestamp: new Date().toISOString(),
          isFinal: true
        }]);
      }

      // Set up phase if provided, otherwise detect from text
      if (phase) {
        callPhases.set(testCallSid, {
          currentPhase: phase,
          phaseHistory: [],
          lastTransitionAt: Date.now()
        });
      } else {
        const detectedPhase = detectCallPhase(testCallSid, text, 'customer');
        callPhases.set(testCallSid, {
          currentPhase: detectedPhase?.phase || 'intro',
          phaseHistory: [],
          lastTransitionAt: Date.now()
        });
      }

      // Initialize cooldowns (won't affect test results)
      initializeCooldowns(testCallSid);

      const currentPhase = callPhases.get(testCallSid)?.currentPhase || 'intro';

      // LAYER 1: Check if we're continuing an active flow
      if (currentNodeId) {
        const nextNodeResult = await getNextFlowNode(currentNodeId, text);
        if (nextNodeResult) {
          const { data: flowInfo } = await supabase
            .from('conversation_flows')
            .select('name')
            .eq('id', currentFlowId)
            .single();

          const { count: totalSteps } = await supabase
            .from('flow_nodes')
            .select('*', { count: 'exact', head: true })
            .eq('flow_id', currentFlowId);

          match = {
            ...nextNodeResult.node,
            isFlowNode: true,
            flowId: currentFlowId,
            flowName: flowInfo?.name || 'Flow',
            stepNumber: nextNodeResult.node.step_number,
            totalSteps: totalSteps || 1,
            branchLabel: nextNodeResult.branchLabel
          };
        }
      }

      // LAYER 2-4: Use detectScriptMatch (same as live calls - includes AI, phase filtering)
      if (!match) {
        try {
          match = await detectScriptMatch(testCallSid, knowledgeBaseId);
        } catch (err) {
          console.error('[Coaching Lab Live] Error in detectScriptMatch:', err.message);
        }
      }

      // Clean up temporary data
      callTranscripts.delete(testCallSid);
      callPhases.delete(testCallSid);
      scriptCooldowns.delete(testCallSid);

      // Build WHY explanation with live mode info
      const why = buildWhyExplanation(text, bestCategory, match, scoredCategories);
      why.phase = currentPhase;
      why.usedLiveMode = true;
      if (match?.matchMethod) why.matchMethod = match.matchMethod;
      if (match?.contextUsed) why.contextUsed = true;

      // Build response
      if (match) {
        coachingResult = {
          type: match.isFlowNode ? 'flow' : 'script',
          category: match.category || (bestCategory ? {
            id: bestCategory.id,
            name: bestCategory.name,
            displayName: bestCategory.display_name,
            icon: bestCategory.icon,
            color: bestCategory.color
          } : null),
          coaching: {
            id: match.id,
            title: match.title,
            scriptText: match.script_text,
            storyText: match.story_text,
            tips: match.phaseGuidance || match.tips,
            expectedResponses: match.expected_responses
          },
          flow: match.isFlowNode ? {
            flowId: match.flowId,
            flowName: match.flowName,
            currentNodeId: match.id,
            stepNumber: match.stepNumber,
            totalSteps: match.totalSteps,
            branchLabel: match.branchLabel
          } : null,
          phase: currentPhase,
          matchMethod: match.matchMethod,
          why
        };
      } else {
        coachingResult = {
          type: 'no_match',
          category: bestCategory ? {
            id: bestCategory.id,
            name: bestCategory.name,
            displayName: bestCategory.display_name,
            icon: bestCategory.icon,
            color: bestCategory.color
          } : null,
          coaching: null,
          flow: null,
          phase: currentPhase,
          why: {
            ...why,
            message: `No matching script found for phase "${currentPhase}". Try adding scripts applicable to this phase.`
          }
        };
      }

      // Generate context data for the UI if we have conversation history
      let contextResponse = null;
      const historyLength = conversationHistory?.length || 0;

      // In Coaching Lab, always generate context if we have enough messages
      // The interval setting shows what would happen in live calls
      console.log(`[Context] History: ${historyLength}, Interval setting: ${effectiveContextInterval}`);

      if (conversationHistory && historyLength >= 3) {
        // Generate quick context summary for the UI
        try {
          const recentTranscript = conversationHistory.slice(-20);
          const transcriptText = recentTranscript
            .map(t => `${t.speaker === 'customer' ? 'Customer' : 'Rep'}: ${t.text}`)
            .join('\n');

          // Quick context generation with short timeout
          if (anthropic) {
            const contextPrompt = `Analyze this sales call excerpt and provide a brief context summary.

CONVERSATION:
${transcriptText}

Respond in this exact JSON format (no markdown):
{"summary":"1-2 sentence summary of conversation","topics":["topic1","topic2"],"sentiment":"positive|neutral|negative","insights":["insight1","insight2"]}`;

            const contextApiPromise = anthropic.messages.create({
              model: 'claude-3-haiku-20240307',
              max_tokens: 200,
              messages: [{ role: 'user', content: contextPrompt }]
            });

            const contextTimeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('CONTEXT_TIMEOUT')), 1500);
            });

            try {
              const contextApiResponse = await Promise.race([contextApiPromise, contextTimeoutPromise]);
              const contextText = contextApiResponse.content[0]?.text?.trim() || '';
              const parsed = JSON.parse(contextText);
              contextResponse = {
                phase: currentPhase,
                summary: parsed.summary || null,
                topics: parsed.topics || [],
                sentiment: parsed.sentiment || 'neutral',
                insights: parsed.insights || [],
                updateInterval: effectiveContextInterval,
                messageCount: historyLength
              };
            } catch (contextErr) {
              // Context generation failed, use basic fallback
              contextResponse = {
                phase: currentPhase,
                summary: null,
                topics: [],
                sentiment: 'neutral',
                insights: [],
                updateInterval: effectiveContextInterval,
                messageCount: historyLength
              };
            }
          }
        } catch (contextGenErr) {
          console.log('[Coaching Lab] Context generation error:', contextGenErr.message);
        }
      }

      // Add phase info even without full context
      if (!contextResponse) {
        contextResponse = {
          phase: currentPhase,
          summary: null,
          topics: [],
          sentiment: 'neutral',
          insights: [],
          updateInterval: effectiveContextInterval,
          messageCount: historyLength
        };
      }

      return res.json({
        success: true,
        input: { text, knowledgeBaseId, phase: currentPhase, useLiveMode: true },
        result: coachingResult,
        context: contextResponse
      });
    }

    // ========== ORIGINAL MODE (Legacy) ==========

    // LAYER 1: Check if we're continuing an active flow
    if (currentNodeId) {
      const nextNodeResult = await getNextFlowNode(currentNodeId, text);
      if (nextNodeResult) {
        match = {
          ...nextNodeResult.node,
          isFlowNode: true,
          flowId: currentFlowId,
          stepNumber: nextNodeResult.node.step_number,
          branchLabel: nextNodeResult.branchLabel
        };

        // Get flow info for total steps
        const { data: flowInfo } = await supabase
          .from('conversation_flows')
          .select('name')
          .eq('id', currentFlowId)
          .single();

        const { count: totalSteps } = await supabase
          .from('flow_nodes')
          .select('*', { count: 'exact', head: true })
          .eq('flow_id', currentFlowId);

        match.flowName = flowInfo?.name || 'Flow';
        match.totalSteps = totalSteps || 1;
      }
    }

    // LAYER 2: Try to start a new flow for detected category
    if (!match && bestCategory && bestCategory.matchScore >= 1) {
      const flowResult = await getFlowForCategory(bestCategory.id);
      if (flowResult) {
        match = {
          ...flowResult.firstNode,
          isFlowNode: true,
          flowId: flowResult.flow.id,
          flowName: flowResult.flow.name,
          stepNumber: 1,
          totalSteps: flowResult.totalSteps,
          category: bestCategory
        };
      }
    }

    // LAYER 3: Try to find a matching script
    if (!match && bestCategory) {
      const { data: scripts } = await supabase
        .from('scripts')
        .select('*')
        .eq('knowledge_base_id', knowledgeBaseId)
        .eq('objection_category_id', bestCategory.id)
        .eq('is_active', true)
        .order('times_used', { ascending: false })
        .limit(1);

      if (scripts && scripts.length > 0) {
        match = scripts[0];
      }
    }

    // LAYER 4: General script matching by trigger phrases
    if (!match) {
      const { data: allScripts } = await supabase
        .from('scripts')
        .select('*')
        .eq('knowledge_base_id', knowledgeBaseId)
        .eq('is_active', true);

      if (allScripts) {
        let bestScript = null;
        let bestScriptScore = 0;

        for (const script of allScripts) {
          if (script.trigger_phrases) {
            let score = 0;
            for (const phrase of script.trigger_phrases) {
              if (lowerText.includes(phrase.toLowerCase())) {
                score += phrase.includes(' ') ? 3 : 1;
              }
            }
            if (score > bestScriptScore) {
              bestScriptScore = score;
              bestScript = script;
            }
          }
        }

        if (bestScript && bestScriptScore > 0) {
          match = bestScript;
        }
      }
    }

    // Build WHY explanation
    const why = buildWhyExplanation(text, bestCategory, match, scoredCategories);

    // Build response
    if (match) {
      coachingResult = {
        type: match.isFlowNode ? 'flow' : 'script',
        category: bestCategory ? {
          id: bestCategory.id,
          name: bestCategory.name,
          displayName: bestCategory.display_name,
          icon: bestCategory.icon,
          color: bestCategory.color
        } : null,
        coaching: {
          id: match.id,
          title: match.title,
          scriptText: match.script_text,
          storyText: match.story_text,
          tips: match.tips,
          expectedResponses: match.expected_responses
        },
        flow: match.isFlowNode ? {
          flowId: match.flowId,
          flowName: match.flowName,
          currentNodeId: match.id,
          stepNumber: match.stepNumber,
          totalSteps: match.totalSteps,
          branchLabel: match.branchLabel
        } : null,
        why
      };
    } else {
      // No match - return AI suggestion placeholder
      coachingResult = {
        type: 'no_match',
        category: bestCategory ? {
          id: bestCategory.id,
          name: bestCategory.name,
          displayName: bestCategory.display_name,
          icon: bestCategory.icon,
          color: bestCategory.color
        } : null,
        coaching: null,
        flow: null,
        why: {
          ...why,
          message: 'No matching script or flow found. Consider adding a new script for this scenario.'
        }
      };
    }

    // For legacy mode, detect phase from text and return basic context
    const detectedPhase = detectCallPhase(null, text, 'customer');
    const legacyPhase = phase || detectedPhase?.phase || 'intro';

    res.json({
      success: true,
      input: { text, knowledgeBaseId },
      result: coachingResult,
      context: {
        phase: legacyPhase,
        summary: null,
        topics: [],
        sentiment: 'neutral',
        insights: []
      }
    });

  } catch (error) {
    console.error('Coaching lab test error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// COACHING ASSISTANT CHAT ENDPOINTS
// ============================================

/**
 * Build comprehensive system prompt for the Coaching Assistant
 * This gives the AI full context about how the coaching system works
 */
function buildCoachingAssistantPrompt(context) {
  // Format available scripts
  let scriptsSection = 'No scripts loaded in knowledge base.';
  if (context?.availableScripts?.length > 0) {
    scriptsSection = context.availableScripts.map((s, i) =>
      `${i + 1}. "${s.title}" (${s.category || 'General'})\n   Triggers: ${s.triggers?.length > 0 ? s.triggers.join(', ') : 'No keyword triggers'}\n   Phases: ${s.applicablePhases?.join(', ') || 'all'}`
    ).join('\n');
  }

  // Format phase keywords
  let phaseKeywordsSection = 'Phase keywords not configured.';
  if (context?.phaseKeywords) {
    phaseKeywordsSection = Object.entries(context.phaseKeywords)
      .map(([phase, keywords]) => `- ${phase}: "${keywords.join('", "')}"`)
      .join('\n');
  }

  // Format last coaching trigger with full details
  let lastTriggerSection = 'No coaching has triggered yet in this session.';
  if (context?.lastCoachingTrigger) {
    const t = context.lastCoachingTrigger;
    lastTriggerSection = `
CUSTOMER SAID: "${t.customerSaid || 'Unknown'}"

WHAT TRIGGERED:
- Script: "${t.coaching?.scriptTitle || 'Unknown'}"
- Category: ${t.category?.displayName || 'Unknown'} ${t.category?.icon || ''}
- Match Method: ${t.why?.matchMethod === 'ai' ? 'AI Selection (Claude analyzed context)' : t.why?.matchMethod === 'keyword' ? 'Keyword Match' : 'Unknown'}

WHY IT MATCHED:
- Keywords Found: ${t.why?.keywordsFound?.length > 0 ? `"${t.why.keywordsFound.join('", "')}"` : 'None (AI selected based on context)'}
- Keywords Checked: ${t.why?.keywordsChecked?.slice(0, 10).join(', ') || 'N/A'}
- Confidence: ${t.why?.confidence || 0}%
- Confidence Breakdown: ${t.why?.confidenceBreakdown?.map(b => `${b.factor} (+${b.points}%)`).join(', ') || 'N/A'}
- Phase at trigger: ${t.why?.phase || 'Unknown'}

SCRIPT SHOWN TO REP:
"${t.coaching?.scriptText || 'No script text'}"
${t.coaching?.tips ? `Tips: ${t.coaching.tips}` : ''}

ALTERNATIVES CONSIDERED:
${t.why?.alternatives?.length > 0 ? t.why.alternatives.map(a => `- ${a.category} (score: ${a.score})`).join('\n') : 'None'}`;
  }

  // Format recent coaching history
  let recentHistorySection = 'No previous coaching triggers.';
  if (context?.recentCoachingMoments?.length > 0) {
    recentHistorySection = context.recentCoachingMoments.map((m, i) =>
      `${i + 1}. "${m.scriptTitle}" triggered by "${m.customerSaid?.substring(0, 50)}..." (${m.matchMethod}, ${m.confidence}% confidence, keywords: ${m.keywordsFound?.join(', ') || 'none'})`
    ).join('\n');
  }

  // Format conversation context
  let contextSummarySection = 'No AI-generated context summary available yet.';
  if (context?.contextSummary) {
    contextSummarySection = `Summary: ${context.contextSummary}
Topics: ${context.contextTopics?.join(', ') || 'None identified'}
Sentiment: ${context.contextSentiment || 'Unknown'}
Insights: ${context.contextInsights?.join('; ') || 'None'}`;
  }

  return `You are the Coaching Assistant for DialPro's AI-powered sales coaching system. You have FULL ACCESS to how the system works and can explain everything in detail.

=== SYSTEM ARCHITECTURE ===
The coaching system uses a 3-layer approach:
1. LAYER 1 - FLOWS: Multi-step guided conversations (like objection handling flows)
2. LAYER 2 - OBJECTION CATEGORIES: Detects objection types and triggers appropriate flows
3. LAYER 3 - SCRIPTS: Individual scripts matched by AI or keywords

Script matching works like this:
- First, the system checks if the current phase allows the script
- Then it either uses AI (Claude) to select the best script, OR falls back to keyword matching
- AI matching analyzes conversation context and picks the most relevant script
- Keyword matching looks for trigger words in what the customer said
- Confidence scores are calculated based on: keyword matches, phase alignment, and context relevance

=== CURRENT SESSION STATE ===
- Knowledge Base: ${context?.knowledgeBaseName || 'Not selected'}
- Current Call Phase: ${context?.phase || 'intro'}
- Messages in Conversation: ${context?.conversationLength || 0}

=== PHASE DETECTION ===
The system detects call phases using these keywords:
${phaseKeywordsSection}

Current phase "${context?.phase || 'intro'}" was detected because the conversation contains keywords from that phase.

=== AVAILABLE SCRIPTS IN THIS KB ===
${scriptsSection}

=== LAST COACHING TRIGGER (DETAILED) ===
${lastTriggerSection}

=== COACHING HISTORY THIS SESSION ===
${recentHistorySection}

=== CONVERSATION CONTEXT (AI-GENERATED) ===
${contextSummarySection}

=== YOUR CAPABILITIES ===
You can:
1. Explain EXACTLY why a script triggered (what keywords matched, why AI selected it)
2. Explain why something DIDN'T trigger (missing keywords, wrong phase, etc.)
3. Explain how phase detection works and why the current phase was detected
4. Suggest new trigger keywords that should be added
5. Suggest improvements to scripts
6. Create improvement tickets when you identify issues

=== RESPONSE GUIDELINES ===
- Be specific and technical - you have full access to the system details
- When explaining matches, cite the actual keywords and scores
- When something didn't trigger, explain what WOULD need to trigger it
- If you identify a gap (missing keyword, wrong phase, etc.), offer to create a ticket
- Keep responses focused and actionable

=== TICKET CREATION ===
When you identify an improvement, ask: "Would you like me to create a ticket for this?"
If the user agrees, respond with EXACTLY this format on its own line:
[CREATE_TICKET: {"title": "Brief title", "description": "Detailed description", "category": "category_code", "suggestedFix": "Specific fix", "priority": "medium"}]

Valid categories: missing_trigger, script_improvement, phase_detection, new_script_request, bug_report, feature_request, other
Valid priorities: low, medium, high, critical`;
}

/**
 * Send a message to the Coaching Assistant
 * POST /api/coaching-lab/chat
 * Body: { sessionToken, message, context }
 */
app.post('/api/coaching-lab/chat', async (req, res) => {
  if (!anthropic) {
    return res.status(500).json({ success: false, error: 'AI not configured' });
  }

  try {
    const { sessionToken, message, contextSnapshot, context: legacyContext, conversationHistory: clientConversation } = req.body;
    // Support both contextSnapshot (new) and context (legacy)
    const context = contextSnapshot || legacyContext || {};
    // clientConversation contains the sales conversation from the coaching lab (not used in chat history)

    if (!sessionToken || !message) {
      return res.status(400).json({ success: false, error: 'sessionToken and message required' });
    }

    console.log(`[Coaching Assistant] Message from session ${sessionToken.substring(0, 8)}...`);
    console.log(`[Coaching Assistant] Context: KB=${context.knowledgeBaseName}, Phase=${context.phase}, Scripts=${context.availableScripts?.length || 0}`);

    // Get or create session
    let session = null;
    if (supabase) {
      // First try to find existing session (use maybeSingle to avoid error on no match)
      const { data: existingSession, error: findError } = await supabase
        .from('coaching_assistant_sessions')
        .select('*')
        .eq('session_token', sessionToken)
        .maybeSingle();

      if (findError) {
        console.error('[Coaching Assistant] Error finding session:', findError.message);
      }

      if (existingSession) {
        session = existingSession;
        console.log('[Coaching Assistant] Found existing session:', session.id);
      } else {
        // Create new session
        const { data: newSession, error: createError } = await supabase
          .from('coaching_assistant_sessions')
          .insert({
            session_token: sessionToken,
            knowledge_base_id: context?.knowledgeBaseId || null,
            knowledge_base_name: context?.knowledgeBaseName || null
          })
          .select()
          .single();

        if (createError) {
          console.error('[Coaching Assistant] Error creating session:', createError.message);
        } else {
          session = newSession;
          console.log('[Coaching Assistant] Created new session:', session?.id);
        }
      }
    }

    // Save user message to database
    if (supabase && session) {
      const { error: msgError } = await supabase.from('coaching_assistant_messages').insert({
        session_id: session.id,
        role: 'user',
        content: message,
        context_snapshot: context || {}
      });
      if (msgError) {
        console.error('[Coaching Assistant] Error saving user message:', msgError.message);
      }
    }

    // Build system prompt with RICH context about the coaching system
    const systemPrompt = buildCoachingAssistantPrompt(context);

    // Get conversation history for context
    let conversationHistory = [];
    if (supabase && session) {
      const { data: history } = await supabase
        .from('coaching_assistant_messages')
        .select('role, content')
        .eq('session_id', session.id)
        .order('created_at', { ascending: true })
        .limit(20);

      if (history) {
        conversationHistory = history.map(m => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content
        }));
      }
    }

    // Add current message
    conversationHistory.push({ role: 'user', content: message });

    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1000,
      system: systemPrompt,
      messages: conversationHistory
    });

    const assistantMessage = response.content[0]?.text || 'Sorry, I could not generate a response.';

    // Check if the response contains a ticket creation request
    let ticketCreated = null;
    const ticketMatch = assistantMessage.match(/\[CREATE_TICKET:\s*(\{.*?\})\]/);
    if (ticketMatch) {
      try {
        const ticketData = JSON.parse(ticketMatch[1]);
        if (supabase && session) {
          const { data: ticket, error: ticketError } = await supabase
            .from('coaching_improvement_tickets')
            .insert({
              session_id: session.id,
              title: ticketData.title,
              description: ticketData.description,
              category: ticketData.category || 'other',
              suggested_fix: ticketData.suggestedFix,
              affected_knowledge_base_id: context?.knowledgeBaseId,
              context_snapshot: context || {},
              priority: ticketData.priority || 'medium'
            })
            .select('id, ticket_number')
            .single();

          if (ticketError) {
            console.error('[Coaching Assistant] Error creating ticket:', ticketError.message);
          } else if (ticket) {
            ticketCreated = {
              id: ticket.id,
              ticketNumber: ticket.ticket_number,
              title: ticketData.title
            };
            console.log(`[Coaching Assistant] Ticket #${ticket.ticket_number} created: ${ticketData.title}`);
          }
        }
      } catch (e) {
        console.error('[Coaching Assistant] Error parsing ticket data:', e.message);
      }
    }

    // Clean response (remove ticket markup if present)
    const cleanResponse = assistantMessage.replace(/\[CREATE_TICKET:.*?\]/g, '').trim();

    // Save assistant response to database
    if (supabase && session) {
      const { error: saveError } = await supabase.from('coaching_assistant_messages').insert({
        session_id: session.id,
        role: 'assistant',
        content: cleanResponse,
        context_snapshot: context || {},
        ticket_id: ticketCreated?.id || null
      });
      if (saveError) {
        console.error('[Coaching Assistant] Error saving assistant message:', saveError.message);
      }
    }

    res.json({
      success: true,
      response: cleanResponse,
      ticketCreated: ticketCreated,
      sessionId: session?.id
    });

  } catch (error) {
    console.error('[Coaching Assistant] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Create an improvement ticket manually
 * POST /api/coaching-lab/tickets
 * Body: { sessionToken, title, description, category, suggestedFix, context }
 */
app.post('/api/coaching-lab/tickets', async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ success: false, error: 'Database not configured' });
  }

  try {
    const { sessionToken, title, description, category, suggestedFix, context } = req.body;

    if (!title || !category) {
      return res.status(400).json({ success: false, error: 'title and category required' });
    }

    // Get session if token provided
    let sessionId = null;
    if (sessionToken) {
      const { data: session } = await supabase
        .from('coaching_assistant_sessions')
        .select('id')
        .eq('session_token', sessionToken)
        .single();
      sessionId = session?.id;
    }

    const { data: ticket, error } = await supabase
      .from('coaching_improvement_tickets')
      .insert({
        session_id: sessionId,
        title,
        description,
        category,
        suggested_fix: suggestedFix,
        affected_knowledge_base_id: context?.knowledgeBaseId,
        context_snapshot: context || {},
        priority: 'medium'
      })
      .select('id, ticket_number, title, category, priority, status, created_at')
      .single();

    if (error) {
      console.error('[Tickets] Error creating ticket:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    console.log(`[Tickets] Ticket #${ticket.ticket_number} created: ${title}`);

    res.json({
      success: true,
      ticket: {
        id: ticket.id,
        ticketNumber: ticket.ticket_number,
        title: ticket.title,
        category: ticket.category,
        priority: ticket.priority,
        status: ticket.status,
        createdAt: ticket.created_at
      }
    });

  } catch (error) {
    console.error('[Tickets] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get chat history and tickets (admin view)
 * GET /api/coaching-lab/admin/activity
 * Query: ?limit=50
 */
app.get('/api/coaching-lab/admin/activity', async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ success: false, error: 'Database not configured' });
  }

  try {
    const limit = parseInt(req.query.limit) || 50;

    // Get recent sessions with message counts
    const { data: sessions, error: sessionsError } = await supabase
      .from('coaching_assistant_sessions')
      .select(`
        id,
        session_token,
        user_identifier,
        knowledge_base_name,
        message_count,
        tickets_created,
        started_at,
        last_activity_at
      `)
      .order('last_activity_at', { ascending: false })
      .limit(limit);

    if (sessionsError) {
      console.error('[Admin Activity] Sessions error:', sessionsError);
    }

    // Get recent tickets
    const { data: tickets, error: ticketsError } = await supabase
      .from('coaching_improvement_tickets')
      .select(`
        id,
        ticket_number,
        title,
        description,
        category,
        priority,
        status,
        created_at,
        updated_at
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (ticketsError) {
      console.error('[Admin Activity] Tickets error:', ticketsError);
    }

    res.json({
      success: true,
      sessions: sessions || [],
      tickets: tickets || [],
      summary: {
        totalSessions: sessions?.length || 0,
        totalTickets: tickets?.length || 0,
        openTickets: tickets?.filter(t => t.status === 'open').length || 0
      }
    });

  } catch (error) {
    console.error('[Admin Activity] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get messages for a specific chat session
 * GET /api/coaching-lab/admin/sessions/:sessionId/messages
 */
app.get('/api/coaching-lab/admin/sessions/:sessionId/messages', async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ success: false, error: 'Database not configured' });
  }

  try {
    const { sessionId } = req.params;

    const { data: messages, error } = await supabase
      .from('coaching_assistant_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({
      success: true,
      messages: messages || []
    });

  } catch (error) {
    console.error('[Admin Messages] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get list of recent calls with transcripts
 * GET /api/calls
 * Query: ?limit=20&hasTranscript=true
 */
app.get('/api/calls', async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ success: false, error: 'Database not configured' });
  }

  try {
    const limit = parseInt(req.query.limit) || 20;
    const hasTranscript = req.query.hasTranscript === 'true';

    let query = supabase
      .from('calls')
      .select(`
        id,
        external_call_id,
        phone_number,
        direction,
        status,
        duration_seconds,
        outcome,
        started_at,
        ended_at,
        call_transcripts (id)
      `)
      .order('started_at', { ascending: false })
      .limit(hasTranscript ? limit * 3 : limit); // Fetch more if filtering, to ensure we get enough

    const { data: calls, error } = await query;

    // Filter to only calls with transcripts in JavaScript (Supabase nested filter doesn't work reliably)
    let filteredCalls = calls || [];
    if (hasTranscript) {
      filteredCalls = filteredCalls.filter(call =>
        call.call_transcripts && call.call_transcripts.length > 0
      ).slice(0, limit);
    }

    if (error) {
      console.error('Error fetching calls:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    // Format response
    const formattedCalls = filteredCalls.map(call => ({
      id: call.id,
      callSid: call.external_call_id,
      phone: call.phone_number,
      direction: call.direction,
      status: call.status,
      duration: call.duration_seconds,
      outcome: call.outcome,
      date: call.started_at,
      hasTranscript: call.call_transcripts && call.call_transcripts.length > 0
    }));

    res.json({
      success: true,
      calls: formattedCalls
    });

  } catch (error) {
    console.error('Error in /api/calls:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get full transcript for a call
 * GET /api/calls/:callSid/transcript
 */
app.get('/api/calls/:callSid/transcript', async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ success: false, error: 'Database not configured' });
  }

  try {
    const { callSid } = req.params;

    // Get call by external_call_id
    const { data: call, error: callError } = await supabase
      .from('calls')
      .select('id, phone_number, direction, started_at, duration_seconds')
      .eq('external_call_id', callSid)
      .single();

    if (callError || !call) {
      return res.status(404).json({
        success: false,
        error: 'Call not found'
      });
    }

    // Get transcript
    const { data: transcript, error: transcriptError } = await supabase
      .from('call_transcripts')
      .select('id, segments, full_text, word_count, duration_seconds')
      .eq('call_id', call.id)
      .single();

    if (transcriptError || !transcript) {
      return res.status(404).json({
        success: false,
        error: 'Transcript not found for this call'
      });
    }

    res.json({
      success: true,
      call: {
        id: call.id,
        callSid,
        phone: call.phone_number,
        direction: call.direction,
        date: call.started_at,
        duration: call.duration_seconds
      },
      transcript: {
        id: transcript.id,
        segments: transcript.segments || [],
        fullText: transcript.full_text,
        wordCount: transcript.word_count,
        duration: transcript.duration_seconds
      }
    });

  } catch (error) {
    console.error('Error fetching transcript:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Replay coaching for a call - analyze each turn and return what coaching would have triggered
 * GET /api/calls/:callSid/coaching-replay
 * Query: ?knowledgeBaseId=uuid
 */
app.get('/api/calls/:callSid/coaching-replay', async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ success: false, error: 'Database not configured' });
  }

  try {
    const { callSid } = req.params;
    const { knowledgeBaseId } = req.query;

    if (!knowledgeBaseId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query parameter: knowledgeBaseId'
      });
    }

    // Get call
    const { data: call, error: callError } = await supabase
      .from('calls')
      .select('id')
      .eq('external_call_id', callSid)
      .single();

    if (callError || !call) {
      return res.status(404).json({ success: false, error: 'Call not found' });
    }

    // Get transcript
    const { data: transcript, error: transcriptError } = await supabase
      .from('call_transcripts')
      .select('segments')
      .eq('call_id', call.id)
      .single();

    if (transcriptError || !transcript) {
      return res.status(404).json({ success: false, error: 'Transcript not found' });
    }

    const segments = transcript.segments || [];
    const coachingMoments = [];

    // Get all categories for this KB
    const { data: allCategories } = await supabase
      .from('objection_categories')
      .select('id, name, display_name, icon, color, detection_keywords')
      .eq('knowledge_base_id', knowledgeBaseId)
      .eq('is_active', true);

    // Analyze each customer turn
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      if (segment.speaker === 'customer' && segment.text) {
        const lowerText = segment.text.toLowerCase();

        // Score categories
        const scoredCategories = (allCategories || []).map(category => {
          let score = 0;
          if (category.detection_keywords) {
            for (const keyword of category.detection_keywords) {
              if (lowerText.includes(keyword.toLowerCase())) {
                score += keyword.includes(' ') ? 3 : 1;
              }
            }
          }
          return { ...category, matchScore: score };
        }).sort((a, b) => b.matchScore - a.matchScore);

        const bestCategory = scoredCategories.find(c => c.matchScore > 0);

        if (bestCategory) {
          // Find matching keywords
          const matchedKeywords = bestCategory.detection_keywords.filter(
            kw => lowerText.includes(kw.toLowerCase())
          );

          coachingMoments.push({
            turnIndex: i,
            timestamp: segment.timestamp,
            text: segment.text,
            category: {
              id: bestCategory.id,
              name: bestCategory.name,
              displayName: bestCategory.display_name,
              icon: bestCategory.icon,
              color: bestCategory.color
            },
            matchedKeywords,
            confidence: Math.min(bestCategory.matchScore * 25, 100)
          });
        }
      }
    }

    res.json({
      success: true,
      callSid,
      totalTurns: segments.length,
      coachingMoments
    });

  } catch (error) {
    console.error('Error in coaching replay:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

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
 * Send SMS message via RBsoft (if available) or Twilio (fallback)
 * POST /api/sms/send
 * Body: { to: string, body: string, conversationId?: string, companyId?: string, preferredProvider?: 'rbsoft'|'twilio', mediaUrl?: string }
 *
 * If companyId is provided and RBsoft is enabled for that company, will try RBsoft first.
 * Falls back to Twilio if RBsoft fails or is not configured.
 */
app.post('/api/sms/send', async (req, res) => {
  try {
    const { to, body, conversationId, companyId, preferredProvider, mediaUrl } = req.body;

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

    // Check blacklist if company ID provided
    if (companyId && await isPhoneBlacklisted(companyId, toNumber)) {
      return res.status(400).json({
        success: false,
        error: 'This number has been blacklisted and cannot receive messages'
      });
    }

    let result = null;

    // Try RBsoft if company has it enabled and not explicitly requesting Twilio
    if (companyId && preferredProvider !== 'twilio') {
      try {
        const rbsoftInstance = await getRBsoftInstance(companyId);

        if (rbsoftInstance) {
          const devices = await getAvailableRBsoftDevices(companyId);

          if (devices.length > 0) {
            // Select a device using load balancer
            const device = rbsoftInstance.loadBalancer.selectDevice(devices);

            if (device && rbsoftRateLimiter.canSend(device.device_id)) {
              // Try to send via RBsoft
              const rbsoftResult = await rbsoftInstance.service.sendSMS(
                device.device_id,
                toNumber,
                body,
                { mediaUrl }
              );

              if (rbsoftResult && (rbsoftResult.success || rbsoftResult.messageId)) {
                // Record rate limit usage
                rbsoftRateLimiter.recordSent(device.device_id);

                result = {
                  success: true,
                  messageSid: rbsoftResult.messageId || rbsoftResult.id,
                  status: 'sent',
                  provider: 'rbsoft',
                  deviceId: device.id,
                  fromNumber: device.phone_number || 'RBsoft Device'
                };

                console.log(`SMS sent via RBsoft to ${toNumber}: ${result.messageSid} (device: ${device.name})`);
              }
            }
          }
        }
      } catch (rbsoftError) {
        console.error('RBsoft send failed, falling back to Twilio:', rbsoftError.message);
        // Continue to Twilio fallback
      }
    }

    // Fallback to Twilio if RBsoft didn't work or wasn't available
    if (!result) {
      const twilioMessage = await twilioClient.messages.create({
        body: body,
        to: toNumber,
        from: process.env.TWILIO_PHONE_NUMBER,
        ...(mediaUrl && { mediaUrl: [mediaUrl] })
      });

      result = {
        success: true,
        messageSid: twilioMessage.sid,
        status: twilioMessage.status,
        provider: 'twilio',
        fromNumber: process.env.TWILIO_PHONE_NUMBER
      };

      console.log(`SMS sent via Twilio to ${toNumber}: ${twilioMessage.sid}`);
    }

    // Update database if conversationId provided
    if (supabase && conversationId) {
      // Update the conversation's last message
      await supabase
        .from('sms_conversations')
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: body.substring(0, 100)
        })
        .eq('id', conversationId);

      // Also update the message record with provider info if we have an sms_messages record
      // This assumes the message was already inserted before calling this endpoint
    }

    res.json(result);

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
        // Create new conversation for inbound message
        console.log('Creating new conversation for:', From);

        // Find company_id - look for a company that uses this Twilio number or get first company
        let companyId = null;

        // Try to find company from existing conversations (same Twilio number)
        const { data: existingConv } = await supabase
          .from('sms_conversations')
          .select('company_id')
          .limit(1)
          .single();

        if (existingConv) {
          companyId = existingConv.company_id;
        } else {
          // Fallback: get first company from company_settings
          const { data: company } = await supabase
            .from('company_settings')
            .select('company_id')
            .limit(1)
            .single();

          if (company) {
            companyId = company.company_id;
          }
        }

        if (companyId) {
          // Create the conversation
          const { data: newConv, error: convError } = await supabase
            .from('sms_conversations')
            .insert({
              company_id: companyId,
              phone_number: From,
              status: 'active',
              last_message_at: new Date().toISOString(),
              last_message_preview: Body.substring(0, 100),
              unread_count: 1
            })
            .select('id, company_id')
            .single();

          if (convError) {
            console.error('Error creating conversation:', convError);
          } else {
            conversation = newConv;
            console.log('Created new conversation:', conversation.id);
          }
        } else {
          console.error('No company found to assign conversation to');
        }
      }

      if (conversation) {
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

        // Set knowledge base for AI coaching
        if (msg.type === 'set_knowledge_base') {
          const clientData = browserClients.get(clientId);
          if (clientData) {
            clientData.knowledgeBaseId = msg.knowledgeBaseId;
            console.log(`Client ${identity} set knowledge base to: ${msg.knowledgeBaseId}`);

            // Also update the active call if one exists
            if (msg.callSid && activeCalls.has(msg.callSid)) {
              const callData = activeCalls.get(msg.callSid);
              callData.knowledgeBaseId = msg.knowledgeBaseId;
              activeCalls.set(msg.callSid, callData);
            }
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

  // Track which speaker is currently active based on Twilio track
  // 'inbound' = customer speaking, 'outbound' = rep speaking
  let currentSpeaker = 'customer';
  let lastTrackTimestamp = 0;

  // Set up transcription based on current provider setting
  const setupTranscription = async (isReconnect = false) => {
    const provider = transcriptionProvider; // Capture current setting
    console.log(`Setting up transcription with provider: ${provider}`);

    if (provider === 'elevenlabs') {
      await setupElevenLabs(isReconnect);
    } else {
      await setupDeepgram(isReconnect);
    }
  };

  // Set up ElevenLabs Scribe transcription via WebSocket
  const setupElevenLabs = async (isReconnect = false) => {
    if (isReconnect) {
      console.log(`Attempting ElevenLabs reconnection (attempt ${deepgramReconnectAttempts + 1}/${DEEPGRAM_MAX_RECONNECT_ATTEMPTS})`);
    }

    try {
      const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
      if (!elevenLabsApiKey) {
        console.error('ELEVENLABS_API_KEY not set - falling back to Deepgram');
        await setupDeepgram(isReconnect);
        return;
      }

      // ElevenLabs Scribe WebSocket URL
      // Using speech-to-text streaming endpoint
      const wsUrl = 'wss://api.elevenlabs.io/v1/speech-to-text/stream';

      console.log('Connecting to ElevenLabs Scribe...');

      deepgramConnection = new WebSocket(wsUrl, {
        headers: {
          'xi-api-key': elevenLabsApiKey,
        },
      });

      // Set a timeout for connection
      const connectionTimeout = setTimeout(() => {
        if (deepgramConnection && deepgramConnection.readyState !== WebSocket.OPEN) {
          console.log('ElevenLabs connection timeout, closing...');
          deepgramConnection.close();
          handleDeepgramError(new Error('Connection timeout'));
        }
      }, 5000);

      deepgramConnection.on('open', () => {
        clearTimeout(connectionTimeout);
        console.log('ElevenLabs WebSocket opened' + (isReconnect ? ' (reconnected)' : ''));
        deepgramReconnectAttempts = 0;
        isDeepgramReconnecting = false;

        // Send configuration message for ElevenLabs
        const config = {
          type: 'start',
          encoding: 'mulaw',
          sample_rate: 8000,
          language: 'en',
        };
        deepgramConnection.send(JSON.stringify(config));

        // Flush any buffered audio
        if (pendingAudioBuffer.length > 0) {
          console.log(`Flushing ${pendingAudioBuffer.length} buffered audio chunks`);
          pendingAudioBuffer.forEach(audio => {
            if (deepgramConnection && deepgramConnection.readyState === WebSocket.OPEN) {
              deepgramConnection.send(audio);
            }
          });
          pendingAudioBuffer = [];
        }

        // Notify browser clients
        if (callSid) {
          broadcastToClients({
            type: 'transcription_status',
            callSid,
            status: 'active',
            provider: 'elevenlabs',
            message: isReconnect ? 'Transcription reconnected (ElevenLabs)' : 'Transcription started (ElevenLabs)'
          }, (client) => client.role === 'rep');
        }
      });

      deepgramConnection.on('message', async (rawData) => {
        try {
          const data = JSON.parse(rawData.toString());

          // ElevenLabs sends different message types
          if (data.type === 'transcript') {
            const transcript = data.text;
            const isFinal = data.is_final || false;

            if (transcript) {
              const timestamp = new Date().toISOString();

              console.log(`[EL ${isFinal ? 'FINAL' : 'interim'}] ${transcript}`);

              // Store final transcripts for AI analysis
              if (isFinal && callSid) {
                if (!callTranscripts.has(callSid)) {
                  callTranscripts.set(callSid, []);
                }
                callTranscripts.get(callSid).push({
                  speaker: currentSpeaker,
                  text: transcript,
                  timestamp,
                  isFinal: true
                });

                // Process for phase detection and context updates (non-blocking)
                processTranscriptEntry(callSid, transcript, currentSpeaker).catch(err => {
                  console.error('[Phase/Context] Error processing transcript:', err.message);
                });

                // Trigger AI coaching
                const transcriptCount = callTranscripts.get(callSid).length;
                if (transcriptCount >= AI_COACHING_MIN_TRANSCRIPT_LENGTH &&
                    transcriptCount % AI_COACHING_INTERVAL === 0) {
                  const callData = activeCalls.get(callSid);
                  const knowledgeBaseId = callData?.knowledgeBaseId || null;
                  const coachingResult = await getAICoachingSuggestion(callSid, transcript, knowledgeBaseId);
                  if (coachingResult) {
                    // Extract type and rename to coachingType to avoid conflict with message type
                    const { type: coachingType, ...restCoaching } = coachingResult;
                    const coachMsg = {
                      type: 'ai_coaching',
                      coachingType,
                      callSid,
                      ...restCoaching,
                      timestamp
                    };
                    broadcastToClients(coachMsg, (client) => client.role === 'rep');
                    broadcastToClients(coachMsg, (client) =>
                      client.role === 'supervisor' && client.listeningTo === callSid
                    );
                  }
                }
              }

              // Send transcript to browser clients
              const message = {
                type: 'transcript',
                callSid,
                speaker: currentSpeaker,
                text: transcript,
                isFinal: isFinal,
                timestamp,
                provider: 'elevenlabs'
              };

              broadcastToClients(message, (client) => client.role === 'rep');
              broadcastToClients(message, (client) =>
                client.role === 'supervisor' && client.listeningTo === callSid
              );
            }
          } else if (data.type === 'error') {
            console.error('ElevenLabs error:', data.message);
            handleDeepgramError(new Error(data.message));
          }
        } catch (e) {
          // Ignore non-JSON messages
        }
      });

      deepgramConnection.on('error', (error) => {
        clearTimeout(connectionTimeout);
        console.error('ElevenLabs WebSocket error:', error.message || error);
        handleDeepgramError(error);
      });

      deepgramConnection.on('close', () => {
        clearTimeout(connectionTimeout);
        console.log('ElevenLabs WebSocket closed');
        if (callSid && activeCalls.has(callSid) && !isDeepgramReconnecting) {
          handleDeepgramDisconnect();
        }
      });

    } catch (error) {
      console.error('Error setting up ElevenLabs:', error);
      handleDeepgramError(error);
    }
  };

  // Set up Deepgram live transcription using raw WebSocket (more reliable than SDK)
  const setupDeepgram = async (isReconnect = false) => {
    if (isReconnect) {
      console.log(`Attempting Deepgram reconnection (attempt ${deepgramReconnectAttempts + 1}/${DEEPGRAM_MAX_RECONNECT_ATTEMPTS})`);
    }

    try {
      const dgApiKey = process.env.DEEPGRAM_API_KEY;
      if (!dgApiKey) {
        console.error('DEEPGRAM_API_KEY not set');
        return;
      }

      // Build Deepgram WebSocket URL with parameters optimized for complete phrases
      const dgUrl = new URL('wss://api.deepgram.com/v1/listen');
      dgUrl.searchParams.set('model', 'nova-2-phonecall');
      dgUrl.searchParams.set('language', 'en-US');
      dgUrl.searchParams.set('smart_format', 'true');
      dgUrl.searchParams.set('punctuate', 'true');
      dgUrl.searchParams.set('interim_results', 'true');
      dgUrl.searchParams.set('endpointing', '200');           // Fast endpoint detection (200ms)
      dgUrl.searchParams.set('encoding', 'mulaw');
      dgUrl.searchParams.set('sample_rate', '8000');
      dgUrl.searchParams.set('channels', '1');

      console.log('Connecting to Deepgram via raw WebSocket...');

      // Create WebSocket connection with auth header
      deepgramConnection = new WebSocket(dgUrl.toString(), {
        headers: {
          'Authorization': `Token ${dgApiKey}`,
        },
      });

      // Set a timeout for connection
      const connectionTimeout = setTimeout(() => {
        if (deepgramConnection && deepgramConnection.readyState !== WebSocket.OPEN) {
          console.log('Deepgram connection timeout, closing...');
          deepgramConnection.close();
          handleDeepgramError(new Error('Connection timeout'));
        }
      }, 5000);

      deepgramConnection.on('open', () => {
        clearTimeout(connectionTimeout);
        console.log('Deepgram WebSocket opened' + (isReconnect ? ' (reconnected)' : ''));
        deepgramReconnectAttempts = 0;
        isDeepgramReconnecting = false;

        // Flush any buffered audio
        if (pendingAudioBuffer.length > 0) {
          console.log(`Flushing ${pendingAudioBuffer.length} buffered audio chunks`);
          pendingAudioBuffer.forEach(audio => {
            if (deepgramConnection && deepgramConnection.readyState === WebSocket.OPEN) {
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

      deepgramConnection.on('message', async (rawData) => {
        try {
          const data = JSON.parse(rawData.toString());
          const transcript = data.channel?.alternatives?.[0]?.transcript;

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
                speaker: currentSpeaker,
                text: transcript,
                timestamp,
                isFinal: true
              });

              // Process for phase detection and context updates (non-blocking)
              processTranscriptEntry(callSid, transcript, currentSpeaker).catch(err => {
                console.error('[Phase/Context] Error processing transcript:', err.message);
              });

              // Trigger AI coaching more frequently (every AI_COACHING_INTERVAL final transcripts)
              const transcriptCount = callTranscripts.get(callSid).length;
              if (transcriptCount >= AI_COACHING_MIN_TRANSCRIPT_LENGTH &&
                  transcriptCount % AI_COACHING_INTERVAL === 0) {
                const callData = activeCalls.get(callSid);
                const knowledgeBaseId = callData?.knowledgeBaseId || null;
                const coachingResult = await getAICoachingSuggestion(callSid, transcript, knowledgeBaseId);
                if (coachingResult) {
                  // Extract type and rename to coachingType to avoid conflict with message type
                  const { type: coachingType, ...restCoaching } = coachingResult;
                  const coachMsg = {
                    type: 'ai_coaching',
                    coachingType,
                    callSid,
                    ...restCoaching,
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
            // Include speaker based on which track was last active
            const message = {
              type: 'transcript',
              callSid,
              speaker: currentSpeaker,
              text: transcript,
              isFinal: isFinal,
              timestamp
            };

            console.log(`[Transcript] ${isFinal ? 'FINAL' : 'interim'} from ${currentSpeaker}: "${transcript.substring(0, 50)}..."`);

            // Send to reps
            broadcastToClients(message, (client) => client.role === 'rep');

            // Send to supervisors listening to this specific call
            broadcastToClients(message, (client) =>
              client.role === 'supervisor' && client.listeningTo === callSid
            );
          }
        } catch (e) {
          // Ignore non-JSON messages
        }
      });

      deepgramConnection.on('error', (error) => {
        clearTimeout(connectionTimeout);
        console.error('Deepgram WebSocket error:', error.message || error);
        handleDeepgramError(error);
      });

      deepgramConnection.on('close', () => {
        clearTimeout(connectionTimeout);
        console.log('Deepgram WebSocket closed');
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
        setupTranscription(true);
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

  // Start transcription with current provider setting
  setupTranscription();

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

          // Initialize phase/context/cooldown tracking for this call
          initializeCallTracking(callSid).catch(err => {
            console.error('[Init] Error initializing call tracking:', err.message);
          });

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
          // Track which track is sending audio to identify speaker
          // 'inbound' = customer, 'outbound' = rep
          const track = msg.media.track;
          if (track) {
            const now = Date.now();
            // Update speaker if this track has audio
            // inbound track = audio from customer, outbound track = audio from rep
            if (track === 'inbound') {
              currentSpeaker = 'customer';
            } else if (track === 'outbound') {
              currentSpeaker = 'rep';
            }
            lastTrackTimestamp = now;
          }

          // Send audio to Deepgram (or buffer if not ready)
          const audio = Buffer.from(msg.media.payload, 'base64');

          if (isDeepgramReconnecting) {
            // Buffer audio while reconnecting
            bufferAudio(audio);
          } else if (deepgramConnection) {
            // Check WebSocket state: 0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED
            const wsState = deepgramConnection.readyState;

            if (wsState === WebSocket.OPEN) {
              // Connection is open - send audio
              try {
                deepgramConnection.send(audio);
              } catch (sendError) {
                console.error('Error sending audio to Deepgram:', sendError.message);
                bufferAudio(audio);
              }
            } else if (wsState === WebSocket.CONNECTING) {
              // Still connecting - just buffer, don't trigger reconnect
              bufferAudio(audio);
            } else {
              // CLOSING or CLOSED - buffer and trigger reconnect
              bufferAudio(audio);
              if (!isDeepgramReconnecting) {
                console.log('Deepgram WebSocket in bad state:', wsState);
                handleDeepgramDisconnect();
              }
            }
          } else {
            // No connection at all - buffer audio
            bufferAudio(audio);
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

          // Clean up phase/context/cooldown Maps for this call
          cleanupCallMaps(callSid);

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
            deepgramConnection.close();
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
      deepgramConnection.close();
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
  console.log(`\n=== Configuration Status ===`);
  console.log(`  AI (Claude): ${anthropic ? '✓ Enabled' : '✗ Disabled (set ANTHROPIC_API_KEY for AI features)'}`);
  console.log(`  Database: ${supabase ? '✓ Connected' : '✗ Not connected'}`);
  console.log(`  Coaching Lab: /coaching-lab.html`);
  console.log(`============================\n`);
});
