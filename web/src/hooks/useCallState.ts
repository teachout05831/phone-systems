'use client';

import { useState, useCallback, useEffect } from 'react';
import { useTwilioDevice, DeviceState, CallState } from './useTwilioDevice';
import { useWebSocket } from './useWebSocket';
import { TranscriptEntry } from '@/lib/deepgram';
import { CoachingSuggestion } from '@/lib/ai-coaching';

interface CallInfo {
  phoneNumber: string;
  contactId?: string;
  contactName?: string;
  companyId?: string;
}

interface UseCallStateOptions {
  userId: string;
  userEmail: string;
  role?: 'rep' | 'supervisor';
}

export function useCallState(options: UseCallStateOptions) {
  const { userId, userEmail, role = 'rep' } = options;

  // Call metadata
  const [callInfo, setCallInfo] = useState<CallInfo | null>(null);
  const [callStartTime, setCallStartTime] = useState<number | null>(null);
  const [callDuration, setCallDuration] = useState(0);

  // Transcript state
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [interimText, setInterimText] = useState<string>('');

  // Twilio Device
  const {
    deviceState,
    callState,
    isMuted,
    error: deviceError,
    currentCallSid,
    initDevice,
    makeCall: twilioMakeCall,
    hangUp: twilioHangUp,
    toggleMute,
    sendDigits,
  } = useTwilioDevice({
    onCallStateChange: (state, callSid) => {
      if (state === 'open' && callSid) {
        setCallStartTime(Date.now());
      }
      if (state === 'closed') {
        setCallStartTime(null);
        setCallDuration(0);
      }
    },
    onError: (error) => {
      console.error('Twilio error:', error);
    },
  });

  // WebSocket for real-time transcription and coaching
  const {
    connected: wsConnected,
    error: wsError,
    coachingSuggestions,
    registerCall,
    dismissCoaching,
    getTranscript,
  } = useWebSocket({
    role,
    identity: userEmail,
    userId,
    onTranscript: (message) => {
      if (message.callSid === currentCallSid) {
        if (message.isFinal) {
          setTranscript((prev) => [
            ...prev,
            {
              text: message.text,
              timestamp: message.timestamp,
              isFinal: true,
            },
          ]);
          setInterimText('');
        } else {
          setInterimText(message.text);
        }
      }
    },
  });

  // Update call duration every second when call is active
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (callState === 'open' && callStartTime) {
      interval = setInterval(() => {
        setCallDuration(Math.floor((Date.now() - callStartTime) / 1000));
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [callState, callStartTime]);

  // Initialize device when component mounts
  useEffect(() => {
    // Small delay to ensure Twilio SDK is loaded
    const timer = setTimeout(() => {
      initDevice();
    }, 1000);

    return () => clearTimeout(timer);
  }, [initDevice]);

  // Make a call
  const makeCall = useCallback(
    async (phoneNumber: string, contactId?: string, contactName?: string, companyId?: string) => {
      // Reset state
      setTranscript([]);
      setInterimText('');
      setCallInfo({ phoneNumber, contactId, contactName, companyId });

      // Initiate call via Twilio
      const callSid = await twilioMakeCall(phoneNumber);

      if (callSid && companyId) {
        // Register call with WebSocket server for transcription
        registerCall(callSid, phoneNumber, contactId, companyId);
      }

      return callSid;
    },
    [twilioMakeCall, registerCall]
  );

  // Hang up
  const hangUp = useCallback(() => {
    twilioHangUp();
    setCallInfo(null);
    setTranscript([]);
    setInterimText('');
  }, [twilioHangUp]);

  // Format duration as MM:SS
  const formatDuration = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Get current coaching (most recent non-dismissed)
  const currentCoaching = coachingSuggestions[0] || null;

  return {
    // Device state
    deviceState,
    deviceReady: deviceState === 'registered',

    // Call state
    callState,
    isOnCall: callState === 'open' || callState === 'ringing' || callState === 'connecting',
    callSid: currentCallSid,
    callInfo,
    callDuration,
    formattedDuration: formatDuration(callDuration),

    // Audio state
    isMuted,

    // Transcript
    transcript,
    interimText,
    fullTranscript: [...transcript, ...(interimText ? [{ text: interimText, timestamp: '', isFinal: false }] : [])],

    // AI Coaching
    currentCoaching,
    coachingSuggestions,

    // Connection state
    wsConnected,
    error: deviceError || wsError,

    // Actions
    initDevice,
    makeCall,
    hangUp,
    toggleMute,
    sendDigits,
    dismissCoaching,
  };
}

// Export types for consumers
export type { CallInfo, UseCallStateOptions };
export type { DeviceState, CallState };
