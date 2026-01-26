import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env
config({ path: resolve(process.cwd(), '.env') });

import express, { Request, Response } from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import next from 'next';
import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import Anthropic from '@anthropic-ai/sdk';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3006', 10);

// Initialize Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Initialize Deepgram
const deepgram = createClient(process.env.DEEPGRAM_API_KEY!);

// Initialize Anthropic for AI coaching
const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

// Initialize Supabase (service role for server operations)
const supabase = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Types
interface BrowserClient {
  ws: WebSocket;
  role: 'rep' | 'supervisor';
  identity: string;
  userId: string;
  listeningTo: string | null;
}

interface CallInfo {
  callSid: string;
  streamSid?: string;
  repIdentity?: string;
  repUserId?: string;
  customerNumber?: string;
  contactId?: string;
  companyId?: string;
  direction?: 'inbound' | 'outbound';
  startTime: number;
}

interface TranscriptEntry {
  text: string;
  timestamp: string;
  isFinal: boolean;
  speaker?: 'rep' | 'customer';
}

// State management
const browserClients = new Map<string, BrowserClient>();
const activeCalls = new Map<string, CallInfo>();
const callTranscripts = new Map<string, TranscriptEntry[]>();

// Helper to broadcast to browser clients
function broadcastToClients(
  message: object,
  filter?: (client: BrowserClient) => boolean
) {
  const msgString = JSON.stringify(message);
  browserClients.forEach((clientData) => {
    if (clientData.ws.readyState === WebSocket.OPEN) {
      if (!filter || filter(clientData)) {
        clientData.ws.send(msgString);
      }
    }
  });
}

// AI Coaching - analyze transcript and provide suggestions
async function getAICoachingSuggestion(
  callSid: string,
  latestTranscript: string
): Promise<string | null> {
  if (!anthropic) {
    console.log('Anthropic API key not configured - skipping AI coaching');
    return null;
  }

  const transcript = callTranscripts.get(callSid) || [];
  if (transcript.length < 3) return null; // Need some context

  // Get last 10 exchanges for context
  const recentTranscript = transcript
    .slice(-10)
    .map((t) => t.text)
    .join('\n');

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
      messages: [
        {
          role: 'user',
          content: `Recent call transcript:\n${recentTranscript}\n\nLatest: "${latestTranscript}"\n\nProvide one coaching tip:`,
        },
      ],
    });

    const suggestion =
      response.content[0].type === 'text'
        ? response.content[0].text.trim()
        : null;
    if (!suggestion || suggestion === 'NONE' || suggestion.length < 5)
      return null;

    return suggestion;
  } catch (error) {
    console.error('AI coaching error:', error);
    return null;
  }
}

// Save call to database
async function saveCallToDatabase(callInfo: CallInfo, transcript: TranscriptEntry[]) {
  try {
    const duration = Math.floor((Date.now() - callInfo.startTime) / 1000);
    const endedAt = new Date().toISOString();
    const startedAt = new Date(callInfo.startTime).toISOString();

    console.log('Saving call to database:', {
      callSid: callInfo.callSid,
      companyId: callInfo.companyId,
      repUserId: callInfo.repUserId,
      contactId: callInfo.contactId,
      duration,
    });

    // First check if call record exists
    const { data: existingCall } = await supabase
      .from('calls')
      .select('id')
      .eq('external_call_id', callInfo.callSid)
      .single();

    let callId: string;

    if (existingCall) {
      // Update existing record
      const { error: updateError } = await supabase
        .from('calls')
        .update({
          status: 'completed',
          duration_seconds: duration,
          ended_at: endedAt,
          updated_at: endedAt,
        })
        .eq('id', existingCall.id);

      if (updateError) {
        console.error('Error updating call record:', updateError);
        return;
      }
      callId = existingCall.id;
      console.log('Updated existing call record:', callId);
    } else if (callInfo.companyId) {
      // Create new record
      const { data: newCall, error: insertError } = await supabase
        .from('calls')
        .insert({
          company_id: callInfo.companyId,
          rep_id: callInfo.repUserId || null,
          contact_id: callInfo.contactId || null,
          external_call_id: callInfo.callSid,
          phone_number: callInfo.customerNumber || 'Unknown',
          from_number: process.env.TWILIO_PHONE_NUMBER,
          direction: callInfo.direction || 'outbound',
          status: 'completed',
          duration_seconds: duration,
          started_at: startedAt,
          answered_at: startedAt,
          ended_at: endedAt,
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('Error inserting call record:', insertError);
        return;
      }
      callId = newCall.id;
      console.log('Created new call record:', callId);
    } else {
      console.log('Cannot save call - missing companyId');
      return;
    }

    // Save transcript if we have one
    if (transcript.length > 0) {
      const segments = transcript.map((t, i) => ({
        index: i,
        speaker: t.speaker || 'unknown',
        text: t.text,
        timestamp: t.timestamp,
      }));

      const fullText = transcript.map(t => t.text).join(' ');

      const { error: transcriptError } = await supabase
        .from('call_transcripts')
        .insert({
          call_id: callId,
          segments: segments,
          full_text: fullText,
          word_count: fullText.split(/\s+/).length,
          duration_seconds: duration,
        });

      if (transcriptError) {
        console.error('Error saving transcript:', transcriptError);
      } else {
        console.log('Saved transcript with', transcript.length, 'segments');
      }
    }

    // Log activity
    if (callInfo.companyId && callInfo.contactId) {
      await supabase.from('activity_log').insert({
        company_id: callInfo.companyId,
        contact_id: callInfo.contactId,
        user_id: callInfo.repUserId || null,
        activity_type: callInfo.direction === 'inbound' ? 'call_inbound' : 'call_outbound',
        description: `Call completed (${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')})`,
        related_call_id: callId,
        metadata: {
          duration_seconds: duration,
          external_call_id: callInfo.callSid,
        },
      });
    }

  } catch (error) {
    console.error('Error saving call to database:', error);
  }
}

app.prepare().then(() => {
  const server = express();
  const httpServer = createServer(server);

  // Parse JSON bodies
  server.use(express.json());

  // WebSocket server attached to same HTTP server, but only handles specific paths
  const wss = new WebSocketServer({
    server: httpServer,
    // Only handle specific paths, let Next.js handle the rest
    verifyClient: (info, callback) => {
      const url = info.req.url || '';
      // Only accept our specific WebSocket paths
      if (url.startsWith('/browser') || url.startsWith('/media-stream')) {
        callback(true);
      } else {
        // Reject - let Next.js or other handlers deal with it
        callback(false, 400, 'Not a valid WebSocket endpoint');
      }
    }
  });

  wss.on('connection', (ws, req) => {
    const url = req.url || '';
    console.log('App WebSocket connection:', url);

    // Browser client connection (reps and supervisors)
    if (url.startsWith('/browser')) {
      handleBrowserClient(ws, req);
      return;
    }

    // Twilio Media Stream connection
    if (url.startsWith('/media-stream')) {
      handleTwilioMediaStream(ws);
      return;
    }

    // This shouldn't happen due to verifyClient, but just in case
    console.log('Unknown WebSocket path (should not reach here):', url);
    ws.close(1000, 'Unknown path');
  });

  // Handle browser client connections
  function handleBrowserClient(ws: WebSocket, req: any) {
    const urlParams = new URL('http://localhost' + req.url);
    const role = (urlParams.searchParams.get('role') || 'rep') as 'rep' | 'supervisor';
    const identity = urlParams.searchParams.get('identity') || 'unknown';
    const userId = urlParams.searchParams.get('userId') || 'unknown';
    const clientId = `${role}_${identity}_${Date.now()}`;

    console.log(`Browser client connected: ${role} - ${identity}`);

    browserClients.set(clientId, {
      ws,
      role,
      identity,
      userId,
      listeningTo: null,
    });

    // Send current active calls to new client
    const activeCallsList = Array.from(activeCalls.entries()).map(([sid, info]) => ({
      callSid: sid,
      repIdentity: info.repIdentity,
      customerNumber: info.customerNumber,
      startTime: info.startTime,
    }));

    ws.send(JSON.stringify({
      type: 'active_calls',
      calls: activeCallsList,
    }));

    // Handle messages from browser clients
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        console.log(`[Browser WS] Received message from ${identity}:`, msg.type, msg);

        // Supervisor wants to listen to a call
        if (msg.type === 'listen_to_call') {
          const clientData = browserClients.get(clientId);
          if (clientData) {
            clientData.listeningTo = msg.callSid;
            console.log(`Supervisor ${identity} now listening to call ${msg.callSid}`);

            // Send current transcript to supervisor
            const transcript = callTranscripts.get(msg.callSid) || [];
            ws.send(
              JSON.stringify({
                type: 'full_transcript',
                callSid: msg.callSid,
                transcript,
              })
            );
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

        // Register call info (sent when rep initiates call)
        if (msg.type === 'register_call') {
          const pendingKey = `pending_${msg.callSid}`;
          activeCalls.set(pendingKey, {
            callSid: msg.callSid,
            repIdentity: identity,
            repUserId: userId,
            customerNumber: msg.customerNumber,
            contactId: msg.contactId,
            companyId: msg.companyId,
            startTime: Date.now(),
          });
          console.log(`Registered pending call: ${msg.callSid}`);
        }
      } catch (e) {
        // Ignore non-JSON messages
      }
    });

    ws.on('close', () => {
      browserClients.delete(clientId);
      console.log(`Browser client disconnected: ${role} - ${identity}`);
    });
  }

  // Handle Twilio Media Stream connections
  function handleTwilioMediaStream(ws: WebSocket) {
    console.log('Twilio Media Stream connected');

    let streamSid: string | null = null;
    let callSid: string | null = null;
    let deepgramWs: WebSocket | null = null;
    let deepgramReady = false;
    let audioBuffer: Buffer[] = []; // Buffer audio while Deepgram connects
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 3;

    // Set up Deepgram live transcription using raw WebSocket
    const setupDeepgram = async (isRetry = false): Promise<void> => {
      return new Promise((resolve) => {
        try {
          const dgApiKey = process.env.DEEPGRAM_API_KEY;
          if (!dgApiKey) {
            console.error('DEEPGRAM_API_KEY not set');
            resolve();
            return;
          }

          if (isRetry) {
            console.log(`Retrying Deepgram connection (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`);
          }

          // Build Deepgram WebSocket URL with parameters
          const dgUrl = new URL('wss://api.deepgram.com/v1/listen');
          dgUrl.searchParams.set('model', 'nova-2-phonecall');
          dgUrl.searchParams.set('language', 'en-US');
          dgUrl.searchParams.set('smart_format', 'true');
          dgUrl.searchParams.set('punctuate', 'true');
          dgUrl.searchParams.set('interim_results', 'true');
          dgUrl.searchParams.set('endpointing', '200');
          dgUrl.searchParams.set('encoding', 'mulaw');
          dgUrl.searchParams.set('sample_rate', '8000');
          dgUrl.searchParams.set('channels', '1');

          console.log('Connecting to Deepgram:', dgUrl.toString());

          // Create WebSocket connection with auth header
          deepgramWs = new WebSocket(dgUrl.toString(), {
            headers: {
              'Authorization': `Token ${dgApiKey}`,
            },
          });

          // Set a timeout for connection
          const connectionTimeout = setTimeout(() => {
            if (!deepgramReady && deepgramWs) {
              console.log('Deepgram connection timeout, closing...');
              deepgramWs.close();
            }
          }, 5000);

          deepgramWs.on('open', () => {
            clearTimeout(connectionTimeout);
            console.log('Deepgram WebSocket opened');
            deepgramReady = true;
            reconnectAttempts = 0;

            // Send any buffered audio
            if (audioBuffer.length > 0) {
              console.log(`Sending ${audioBuffer.length} buffered audio chunks to Deepgram`);
              audioBuffer.forEach((chunk) => {
                if (deepgramWs && deepgramWs.readyState === WebSocket.OPEN) {
                  deepgramWs.send(chunk);
                }
              });
              audioBuffer = [];
            }
            resolve();
          });

          deepgramWs.on('message', async (rawData: Buffer) => {
            try {
              const response = JSON.parse(rawData.toString());
              const transcript = response.channel?.alternatives?.[0]?.transcript;

              if (transcript && callSid) {
                const isFinal = response.is_final;
                const timestamp = new Date().toISOString();

                console.log(`[${isFinal ? 'FINAL' : 'interim'}] ${transcript}`);

                // Store final transcripts for AI analysis
                if (isFinal) {
                  if (!callTranscripts.has(callSid)) {
                    callTranscripts.set(callSid, []);
                  }
                  callTranscripts.get(callSid)!.push({
                    text: transcript,
                    timestamp,
                    isFinal: true,
                  });

                  // Trigger AI coaching on final transcripts (every 3rd final transcript)
                  const transcriptCount = callTranscripts.get(callSid)!.length;
                  if (transcriptCount % 3 === 0) {
                    const suggestion = await getAICoachingSuggestion(callSid, transcript);
                    if (suggestion) {
                      const coachMsg = {
                        type: 'ai_coaching',
                        callSid,
                        suggestion,
                        timestamp,
                      };
                      // Send to rep on this call
                      broadcastToClients(coachMsg, (client) => client.role === 'rep');
                      // Also send to supervisors listening to this call
                      broadcastToClients(
                        coachMsg,
                        (client) =>
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
                  isFinal,
                  timestamp,
                };

                // Send to reps
                broadcastToClients(message, (client) => client.role === 'rep');

                // Send to supervisors listening to this specific call
                broadcastToClients(
                  message,
                  (client) =>
                    client.role === 'supervisor' && client.listeningTo === callSid
                );
              }
            } catch (e) {
              // Ignore non-JSON messages
            }
          });

          deepgramWs.on('error', (error: any) => {
            clearTimeout(connectionTimeout);
            console.error('Deepgram WebSocket error:', error.message || error);
            deepgramReady = false;

            // Try to reconnect if we haven't exceeded attempts
            if (reconnectAttempts < maxReconnectAttempts) {
              reconnectAttempts++;
              setTimeout(() => {
                setupDeepgram(true);
              }, 1000); // Wait 1 second before retry
            }
            resolve();
          });

          deepgramWs.on('close', () => {
            clearTimeout(connectionTimeout);
            console.log('Deepgram WebSocket closed');
            deepgramReady = false;
            resolve();
          });
        } catch (error) {
          console.error('Error setting up Deepgram:', error);
          resolve();
        }
      });
    };

    setupDeepgram();

    ws.on('message', (message) => {
      try {
        const msg = JSON.parse(message.toString());

        switch (msg.event) {
          case 'connected':
            console.log('Twilio media stream connected');
            break;

          case 'start':
            streamSid = msg.start.streamSid;
            callSid = msg.start.callSid;
            console.log(`Stream started: ${streamSid}, Call: ${callSid}`);

            // Look for pending call info and merge it
            let callInfo: CallInfo = { callSid: callSid!, streamSid: streamSid!, startTime: Date.now() };
            activeCalls.forEach((data, key) => {
              if (key.startsWith('pending_')) {
                // Found pending call, merge info
                callInfo = { ...data, ...callInfo };
                activeCalls.delete(key);
              }
            });

            // Store active call with full info
            activeCalls.set(callSid!, callInfo);

            // Initialize transcript storage
            callTranscripts.set(callSid!, []);

            // Notify all browser clients about new call
            broadcastToClients({
              type: 'call_started',
              callSid,
              repIdentity: callInfo.repIdentity,
              customerNumber: callInfo.customerNumber,
              startTime: callInfo.startTime,
            });
            break;

          case 'media':
            // Send audio to Deepgram or buffer if not ready
            const audio = Buffer.from(msg.media.payload, 'base64');
            if (deepgramWs && deepgramReady && deepgramWs.readyState === WebSocket.OPEN) {
              deepgramWs.send(audio);
            } else {
              // Buffer audio while Deepgram is connecting (limit buffer size)
              if (audioBuffer.length < 500) {
                audioBuffer.push(audio);
              }
            }
            break;

          case 'stop':
            console.log('Stream stopped');

            if (callSid) {
              // Get call info before removing
              const endedCallInfo = activeCalls.get(callSid);
              const duration = endedCallInfo
                ? Math.floor((Date.now() - endedCallInfo.startTime) / 1000)
                : 0;
              const transcript = callTranscripts.get(callSid) || [];

              // Save to database
              if (endedCallInfo) {
                saveCallToDatabase(endedCallInfo, transcript);
              }

              // Remove from active calls
              activeCalls.delete(callSid);

              // Notify all browser clients
              broadcastToClients({
                type: 'call_ended',
                callSid,
                duration,
              });

              // Keep transcript for a while for post-call analysis
              // Clean up after 30 minutes
              const transcriptCallSid = callSid;
              setTimeout(() => {
                callTranscripts.delete(transcriptCallSid);
              }, 30 * 60 * 1000);
            }

            if (deepgramWs && deepgramWs.readyState === WebSocket.OPEN) {
              deepgramWs.close();
            }
            break;
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
    });

    ws.on('close', () => {
      console.log('Twilio WebSocket closed');
      if (deepgramWs && deepgramWs.readyState === WebSocket.OPEN) {
        deepgramWs.close();
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  }

  // Next.js handles all HTTP requests
  server.all(/.*/, (req: Request, res: Response) => {
    return handle(req, res);
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> WebSocket server ready for browser clients at ws://${hostname}:${port}/browser`);
    console.log(`> WebSocket server ready for Twilio media at ws://${hostname}:${port}/media-stream`);
  });
});
