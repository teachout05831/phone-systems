'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { TranscriptPanel } from '@/components/calls/transcript-panel';
import { CoachingPanel } from '@/components/calls/coaching-panel';
import { CallControls } from '@/components/calls/call-controls';
import { DialPad } from '@/components/calls/dial-pad';
import { useTwilio } from '@/components/calls/twilio-provider';

// Local types that match component expectations
interface LocalTranscriptEntry {
  id: string;
  text: string;
  speaker: 'rep' | 'contact';
  timestamp: Date | string;
  isFinal: boolean;
}

interface LocalCoachingSuggestion {
  id: string;
  suggestion: string;
  timestamp: Date | string;
  dismissed?: boolean;
}

// Timer display component
function CallTimerDisplay({ startTime }: { startTime: Date | null }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startTime) return;

    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.getTime()) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-2">
      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
      <span className="font-mono text-lg tabular-nums">{formatTime(elapsed)}</span>
    </div>
  );
}

interface UserData {
  id: string;
  email: string;
  companyId?: string;
}

interface ContactData {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  company_id: string;
}

export default function CallPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Use the shared Twilio context
  const {
    isDeviceReady,
    activeCall,
    callState: twilioCallState,
    error: twilioError,
    makeCall: twilioMakeCall,
    hangUp: twilioHangUp,
    toggleMute: twilioToggleMute,
    isMuted,
  } = useTwilio();

  const [user, setUser] = useState<UserData | null>(null);
  const [contact, setContact] = useState<ContactData | null>(null);
  const [loading, setLoading] = useState(true);

  // Local call state for this page
  const [callStartTime, setCallStartTime] = useState<Date | null>(null);
  const [localCallState, setLocalCallState] = useState<'idle' | 'initializing' | 'connecting' | 'ringing' | 'connected' | 'ended'>('idle');
  const [error, setError] = useState<string | null>(null);

  // Transcript and coaching
  const [transcripts, setTranscripts] = useState<LocalTranscriptEntry[]>([]);
  const [suggestions, setSuggestions] = useState<LocalCoachingSuggestion[]>([]);

  // WebSocket ref
  const wsRef = useRef<WebSocket | null>(null);

  // Get contact ID and phone from URL params
  const contactId = searchParams.get('contactId');
  const phoneParam = searchParams.get('phone');

  // Sync with Twilio context state
  useEffect(() => {
    if (twilioCallState === 'connected' && localCallState !== 'connected') {
      setLocalCallState('connected');
      if (!callStartTime) {
        setCallStartTime(new Date());
      }
    } else if (twilioCallState === 'connecting') {
      setLocalCallState('connecting');
    } else if (twilioCallState === 'ringing') {
      setLocalCallState('ringing');
    } else if (twilioCallState === 'ended') {
      setLocalCallState('ended');
    }
  }, [twilioCallState, localCallState, callStartTime]);

  // Sync errors
  useEffect(() => {
    if (twilioError) {
      setError(twilioError);
    }
  }, [twilioError]);

  // Connect to WebSocket for transcripts
  const connectWebSocket = useCallback(() => {
    if (!user || wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/browser?role=rep&identity=${encodeURIComponent(user.email)}&userId=${user.id}`;

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket connected');
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'transcript') {
            const entry: LocalTranscriptEntry = {
              id: `${Date.now()}-${Math.random()}`,
              text: msg.text,
              speaker: msg.speaker || 'contact',
              timestamp: new Date(msg.timestamp || Date.now()),
              isFinal: msg.isFinal ?? true,
            };
            setTranscripts(prev => [...prev, entry]);
          }

          if (msg.type === 'ai_coaching') {
            const suggestion: LocalCoachingSuggestion = {
              id: `${Date.now()}-${Math.random()}`,
              suggestion: msg.suggestion,
              timestamp: new Date(msg.timestamp || Date.now()),
              dismissed: false,
            };
            setSuggestions(prev => [suggestion, ...prev].slice(0, 10));
          }

          if (msg.type === 'call_state') {
            if (msg.state === 'ended') {
              setLocalCallState('ended');
            }
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
      };

      ws.onclose = () => {
        console.log('WebSocket closed');
        wsRef.current = null;
      };

      wsRef.current = ws;
    } catch (err) {
      console.error('Failed to connect WebSocket:', err);
    }
  }, [user]);

  // Make a call using the shared context
  const handleMakeCall = useCallback(async (phoneNumber: string) => {
    if (!user) {
      setError('Please log in to make calls');
      return;
    }

    setError(null);
    setLocalCallState('initializing');
    setTranscripts([]);
    setSuggestions([]);
    setCallStartTime(null);

    const params: Record<string, string> = {
      userId: user.id,
    };

    if (contact) {
      params.contactId = contact.id;
      params.contactName = `${contact.first_name} ${contact.last_name}`;
    }

    // Pre-register call info BEFORE connecting (media stream starts immediately)
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'register_call',
        callSid: 'pending', // Will be matched by server
        customerNumber: phoneNumber,
        contactId: contact?.id,
        companyId: user.companyId,
      }));
    }

    const call = await twilioMakeCall(phoneNumber, params);

    if (call) {
      // Subscribe to call events via WebSocket when connected
      call.on('accept', () => {
        setCallStartTime(new Date());
      });
    } else {
      setLocalCallState('idle');
    }
  }, [user, contact, twilioMakeCall]);

  // Hang up
  const handleHangUp = useCallback(() => {
    twilioHangUp();
    setLocalCallState('ended');
  }, [twilioHangUp]);

  // Fetch user and contact data
  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();

      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !authUser) {
        router.push('/login');
        return;
      }

      const { data: membership } = await supabase
        .from('company_members')
        .select('company_id')
        .eq('user_id', authUser.id)
        .single();

      setUser({
        id: authUser.id,
        email: authUser.email || 'unknown',
        companyId: membership?.company_id,
      });

      if (contactId) {
        const { data: contactData } = await supabase
          .from('contacts')
          .select('id, first_name, last_name, phone, company_id')
          .eq('id', contactId)
          .single();

        if (contactData) {
          setContact(contactData);
        }
      }

      setLoading(false);
    }

    fetchData();
  }, [contactId, router]);

  // Connect WebSocket when user is loaded
  useEffect(() => {
    if (user) {
      connectWebSocket();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [user, connectWebSocket]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <p className="text-gray-500">Please log in to make calls</p>
      </div>
    );
  }

  // Active call UI
  if (localCallState === 'connecting' || localCallState === 'ringing' || localCallState === 'connected') {
    const callInfo = activeCall?.parameters as { From?: string; To?: string; CallSid?: string } | undefined;
    const isInbound = callInfo?.From && !contact;

    return (
      <div className="h-[calc(100vh-120px)] flex flex-col">
        {/* Call header */}
        <div className="bg-white dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                {contact ? `${contact.first_name} ${contact.last_name}` : (isInbound ? 'Incoming Call' : 'Call in progress')}
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {contact?.phone || callInfo?.From || phoneParam || 'Unknown'}
              </p>
            </div>
            <div className="flex items-center gap-4">
              {localCallState === 'connecting' && (
                <span className="text-yellow-600 dark:text-yellow-400 flex items-center gap-2">
                  <span className="animate-spin w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full" />
                  Connecting...
                </span>
              )}
              {localCallState === 'ringing' && (
                <span className="text-blue-600 dark:text-blue-400">Ringing...</span>
              )}
              {localCallState === 'connected' && (
                <CallTimerDisplay startTime={callStartTime} />
              )}
            </div>
          </div>
        </div>

        {/* Main content - transcript and coaching */}
        <div className="flex-1 flex overflow-hidden">
          {/* Transcript panel */}
          <div className="flex-1 border-r border-zinc-200 dark:border-zinc-700">
            <TranscriptPanel
              transcript={transcripts.map(t => ({
                text: t.text,
                timestamp: typeof t.timestamp === 'string' ? t.timestamp : t.timestamp.toISOString(),
                isFinal: t.isFinal,
                speaker: t.speaker,
              }))}
            />
          </div>

          {/* Coaching panel */}
          <div className="w-80">
            <CoachingPanel
              suggestions={suggestions.map(s => ({
                id: s.id,
                suggestion: s.suggestion,
                timestamp: typeof s.timestamp === 'string' ? s.timestamp : s.timestamp.toISOString(),
                dismissed: s.dismissed || false,
              }))}
              onDismiss={(id) => {
                setSuggestions(prev => prev.map(s =>
                  s.id === id ? { ...s, dismissed: true } : s
                ));
              }}
            />
          </div>
        </div>

        {/* Call controls */}
        <div className="bg-white dark:bg-zinc-800 border-t border-zinc-200 dark:border-zinc-700 px-6 py-4">
          <CallControls
            isOnCall={true}
            isMuted={isMuted}
            onMuteToggle={twilioToggleMute}
            onHangUp={handleHangUp}
          />
        </div>
      </div>
    );
  }

  // Call ended UI
  if (localCallState === 'ended') {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
          <div className="text-center mb-6">
            <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">
              Call Ended
            </h2>
            {contact && (
              <p className="text-zinc-600 dark:text-zinc-300">
                {contact.first_name} {contact.last_name}
              </p>
            )}
          </div>

          {transcripts.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Call Transcript ({transcripts.length} messages)
              </h3>
              <div className="max-h-48 overflow-y-auto bg-zinc-50 dark:bg-zinc-700 rounded-lg p-3 text-sm">
                {transcripts.slice(-5).map((t) => (
                  <p key={t.id} className="text-zinc-600 dark:text-zinc-300 mb-1">
                    <span className="font-medium">{t.speaker === 'rep' ? 'You' : 'Contact'}:</span> {t.text}
                  </p>
                ))}
                {transcripts.length > 5 && (
                  <p className="text-zinc-400 text-xs">... and {transcripts.length - 5} more messages</p>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-4 justify-center">
            <button
              onClick={() => {
                setLocalCallState('idle');
                setTranscripts([]);
                setSuggestions([]);
                setError(null);
              }}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              New Call
            </button>
            <button
              onClick={() => router.push('/contacts')}
              className="px-6 py-2 bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors"
            >
              Back to Contacts
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Idle/Initializing state - show dial pad
  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
            Make a Call
          </h2>
          {isDeviceReady && (
            <span className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <span className="w-2 h-2 bg-green-500 rounded-full" />
              Phone Ready
            </span>
          )}
        </div>

        {contact && (
          <div className="mb-6 p-4 bg-zinc-50 dark:bg-zinc-700 rounded-lg">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Calling:</p>
            <p className="text-lg font-medium text-zinc-900 dark:text-white">
              {contact.first_name} {contact.last_name}
            </p>
            <p className="text-zinc-600 dark:text-zinc-300">{contact.phone}</p>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {localCallState === 'initializing' ? (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-zinc-600 dark:text-zinc-300">Initializing phone...</p>
          </div>
        ) : (
          <>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Your browser microphone will be used for this call.
                You&apos;ll see live transcription and AI coaching suggestions during the call.
              </p>
            </div>

            <DialPad
              onCall={handleMakeCall}
              initialNumber={contact?.phone || phoneParam || ''}
            />
          </>
        )}
      </div>
    </div>
  );
}
