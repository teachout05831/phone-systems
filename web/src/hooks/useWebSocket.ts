'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { TranscriptEntry, TranscriptMessage, FullTranscriptMessage } from '@/lib/deepgram';
import { CoachingMessage, CoachingSuggestion, generateCoachingId } from '@/lib/ai-coaching';

interface WebSocketState {
  connected: boolean;
  error: string | null;
}

interface CallStartedMessage {
  type: 'call_started';
  callSid: string;
  repIdentity?: string;
  customerNumber?: string;
  startTime: number;
}

interface CallEndedMessage {
  type: 'call_ended';
  callSid: string;
  duration: number;
}

interface ActiveCallsMessage {
  type: 'active_calls';
  calls: Array<{
    callSid: string;
    repIdentity?: string;
    customerNumber?: string;
    startTime: number;
  }>;
}

type WebSocketMessage =
  | TranscriptMessage
  | FullTranscriptMessage
  | CoachingMessage
  | CallStartedMessage
  | CallEndedMessage
  | ActiveCallsMessage;

interface UseWebSocketOptions {
  role: 'rep' | 'supervisor';
  identity: string;
  userId: string;
  onTranscript?: (message: TranscriptMessage) => void;
  onCoaching?: (suggestion: CoachingSuggestion) => void;
  onCallStarted?: (callSid: string, info: { repIdentity?: string; customerNumber?: string; startTime: number }) => void;
  onCallEnded?: (callSid: string, duration: number) => void;
}

export function useWebSocket(options: UseWebSocketOptions) {
  const { role, identity, userId, onTranscript, onCoaching, onCallStarted, onCallEnded } = options;

  const [state, setState] = useState<WebSocketState>({
    connected: false,
    error: null,
  });
  const [transcripts, setTranscripts] = useState<Map<string, TranscriptEntry[]>>(new Map());
  const [coachingSuggestions, setCoachingSuggestions] = useState<CoachingSuggestion[]>([]);
  const [activeCalls, setActiveCalls] = useState<string[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    // Don't reconnect if already connected
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/browser?role=${role}&identity=${encodeURIComponent(identity)}&userId=${encodeURIComponent(userId)}`;

    console.log('Connecting to WebSocket:', wsUrl);

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      setState({ connected: true, error: null });
    };

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);

        switch (message.type) {
          case 'transcript':
            // Update transcripts map
            setTranscripts((prev) => {
              const newMap = new Map(prev);
              const existing = newMap.get(message.callSid) || [];
              if (message.isFinal) {
                newMap.set(message.callSid, [
                  ...existing,
                  {
                    text: message.text,
                    timestamp: message.timestamp,
                    isFinal: true,
                  },
                ]);
              }
              return newMap;
            });
            onTranscript?.(message);
            break;

          case 'full_transcript':
            // Replace entire transcript for a call (used when supervisor joins)
            setTranscripts((prev) => {
              const newMap = new Map(prev);
              newMap.set(message.callSid, message.transcript);
              return newMap;
            });
            break;

          case 'ai_coaching':
            const suggestion: CoachingSuggestion = {
              id: generateCoachingId(),
              suggestion: message.suggestion,
              timestamp: message.timestamp,
              dismissed: false,
            };
            setCoachingSuggestions((prev) => [suggestion, ...prev].slice(0, 10));
            onCoaching?.(suggestion);
            break;

          case 'call_started':
            setActiveCalls((prev) => [...prev, message.callSid]);
            onCallStarted?.(message.callSid, {
              repIdentity: message.repIdentity,
              customerNumber: message.customerNumber,
              startTime: message.startTime,
            });
            break;

          case 'call_ended':
            setActiveCalls((prev) => prev.filter((sid) => sid !== message.callSid));
            onCallEnded?.(message.callSid, message.duration);
            break;

          case 'active_calls':
            setActiveCalls(message.calls.map((c) => c.callSid));
            break;
        }
      } catch (e) {
        console.error('Error parsing WebSocket message:', e);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setState((prev) => ({ ...prev, error: 'Connection error' }));
    };

    ws.onclose = () => {
      console.log('WebSocket closed');
      setState({ connected: false, error: null });

      // Attempt to reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log('Attempting to reconnect...');
        connect();
      }, 3000);
    };
  }, [role, identity, userId, onTranscript, onCoaching, onCallStarted, onCallEnded]);

  // Connect on mount
  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  // Send a message to the server
  const send = useCallback((message: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  // Register call info (called by rep when initiating a call)
  const registerCall = useCallback(
    (callSid: string, customerNumber: string, contactId?: string, companyId?: string) => {
      send({
        type: 'register_call',
        callSid,
        customerNumber,
        contactId,
        companyId,
      });
    },
    [send]
  );

  // Supervisor: listen to a specific call
  const listenToCall = useCallback(
    (callSid: string) => {
      send({ type: 'listen_to_call', callSid });
    },
    [send]
  );

  // Supervisor: stop listening
  const stopListening = useCallback(() => {
    send({ type: 'stop_listening' });
  }, [send]);

  // Dismiss a coaching suggestion
  const dismissCoaching = useCallback((id: string) => {
    setCoachingSuggestions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, dismissed: true } : s))
    );
  }, []);

  // Get transcript for a specific call
  const getTranscript = useCallback(
    (callSid: string): TranscriptEntry[] => {
      return transcripts.get(callSid) || [];
    },
    [transcripts]
  );

  return {
    // State
    connected: state.connected,
    error: state.error,
    activeCalls,
    coachingSuggestions: coachingSuggestions.filter((s) => !s.dismissed),

    // Actions
    registerCall,
    listenToCall,
    stopListening,
    dismissCoaching,
    getTranscript,
  };
}
