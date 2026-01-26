'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// Twilio Voice SDK v2.x types
declare global {
  interface Window {
    Twilio?: {
      Device?: new (token: string, options?: Record<string, unknown>) => TwilioDevice;
    };
  }
}

interface TwilioDevice {
  on: (event: string, callback: (...args: unknown[]) => void) => void;
  connect: (options?: { params: Record<string, string> }) => Promise<TwilioCall>;
  disconnectAll: () => void;
  register: () => Promise<void>;
  destroy: () => void;
  state: string;
}

interface TwilioCall {
  on: (event: string, callback: (...args: unknown[]) => void) => void;
  disconnect: () => void;
  mute: (muted?: boolean) => void;
  isMuted: () => boolean;
  status: () => string;
  parameters: { CallSid?: string; From?: string; To?: string };
  accept?: () => void;
  reject?: () => void;
}

interface IncomingCallInfo {
  call: TwilioCall;
  from: string;
  to: string;
}

interface TwilioContextType {
  device: TwilioDevice | null;
  isDeviceReady: boolean;
  incomingCall: IncomingCallInfo | null;
  activeCall: TwilioCall | null;
  callState: 'idle' | 'incoming' | 'connecting' | 'ringing' | 'connected' | 'ended';
  error: string | null;
  acceptIncomingCall: () => void;
  rejectIncomingCall: () => void;
  makeCall: (phoneNumber: string, params?: Record<string, string>) => Promise<TwilioCall | null>;
  hangUp: () => void;
  toggleMute: () => void;
  isMuted: boolean;
}

const TwilioContext = createContext<TwilioContextType | null>(null);

// Default values for when context is not available (e.g., during SSR)
const defaultContextValue: TwilioContextType = {
  device: null,
  isDeviceReady: false,
  incomingCall: null,
  activeCall: null,
  callState: 'idle',
  error: null,
  acceptIncomingCall: () => {},
  rejectIncomingCall: () => {},
  makeCall: async () => null,
  hangUp: () => {},
  toggleMute: () => {},
  isMuted: false,
};

export function useTwilio() {
  const context = useContext(TwilioContext);
  // Return default values during SSR or if provider isn't ready yet
  // This prevents errors during hydration
  if (!context) {
    return defaultContextValue;
  }
  return context;
}

interface TwilioProviderProps {
  children: ReactNode;
}

export function TwilioProvider({ children }: TwilioProviderProps) {
  const router = useRouter();
  const [device, setDevice] = useState<TwilioDevice | null>(null);
  const [isDeviceReady, setIsDeviceReady] = useState(false);
  const [incomingCall, setIncomingCall] = useState<IncomingCallInfo | null>(null);
  const [activeCall, setActiveCall] = useState<TwilioCall | null>(null);
  const [callState, setCallState] = useState<TwilioContextType['callState']>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);

  const deviceRef = useRef<TwilioDevice | null>(null);
  const twilioScriptLoaded = useRef(false);

  // Load Twilio SDK script
  const loadTwilioScript = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (typeof window !== 'undefined' && window.Twilio?.Device) {
        resolve();
        return;
      }

      if (twilioScriptLoaded.current) {
        const checkInterval = setInterval(() => {
          if (window.Twilio?.Device) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
        setTimeout(() => {
          clearInterval(checkInterval);
          reject(new Error('Timeout waiting for Twilio SDK'));
        }, 10000);
        return;
      }

      twilioScriptLoaded.current = true;
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@twilio/voice-sdk@2.10.2/dist/twilio.min.js';
      script.async = true;
      script.onload = () => {
        if (window.Twilio?.Device) {
          resolve();
        } else {
          reject(new Error('Twilio SDK loaded but Device not found'));
        }
      };
      script.onerror = () => {
        twilioScriptLoaded.current = false;
        reject(new Error('Failed to load Twilio SDK'));
      };
      document.head.appendChild(script);
    });
  }, []);

  // Initialize Twilio Device
  const initializeDevice = useCallback(async () => {
    if (!user) return;
    if (deviceRef.current) {
      console.log('[TwilioProvider] Device already initialized');
      return;
    }

    try {
      console.log('[TwilioProvider] Initializing Twilio Device...');
      await loadTwilioScript();

      // Use 'rep' as the identity to match incoming call routing
      const response = await fetch('/api/twilio/token?identity=rep');
      if (!response.ok) {
        throw new Error(`Token request failed: ${response.status}`);
      }

      const { token, identity } = await response.json();
      console.log('[TwilioProvider] Got token for identity:', identity);
      console.log('[TwilioProvider] Token starts with:', token.substring(0, 50) + '...');

      if (!window.Twilio?.Device) {
        throw new Error('Twilio Device class not available');
      }

      const newDevice = new window.Twilio.Device(token, {
        codecPreferences: ['opus', 'pcmu'],
        enableRingingState: true,
        logLevel: 1,
      });

      newDevice.on('registered', () => {
        console.log('[TwilioProvider] Device registered and ready for incoming calls');
        console.log('[TwilioProvider] Device state:', newDevice.state);
        setIsDeviceReady(true);
      });

      newDevice.on('error', (err: unknown) => {
        const twilioErr = err as { message?: string; code?: number };
        console.error('[TwilioProvider] Device error:', twilioErr);
        setError(`Twilio error: ${twilioErr?.message || 'Unknown error'}`);
      });

      newDevice.on('unregistered', () => {
        console.log('[TwilioProvider] Device unregistered');
        setIsDeviceReady(false);
      });

      // Handle incoming calls
      newDevice.on('incoming', (callArg: unknown) => {
        const call = callArg as TwilioCall;
        console.log('[TwilioProvider] *** INCOMING CALL ***');
        console.log('[TwilioProvider] Call parameters:', call.parameters);
        console.log('[TwilioProvider] Call status:', call.status());

        setIncomingCall({
          call,
          from: call.parameters.From || 'Unknown',
          to: call.parameters.To || '',
        });
        setCallState('incoming');

        // Play a sound for incoming calls (browser's built-in)
        try {
          const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2Onp6WjoN3bWZrfIuVl5OIgHRsaGx4ipSVkoiAc2toanuKlJWRh4ByaWl7i5WVkYeAcmlpe4uVlZGHgHJpaXuLlZWRh4ByaWl7i5WVkYeAcmlpe4uVlZGHgHJpaXuLlZWRh4ByaWl7i5WVkYeAcmlpe4uVlZGHgHJpaQ==');
          audio.play().catch(() => {});
        } catch (e) {
          // Ignore audio errors
        }

        call.on('cancel', () => {
          console.log('[TwilioProvider] Incoming call cancelled');
          setIncomingCall(null);
          setCallState('idle');
        });

        call.on('disconnect', () => {
          console.log('[TwilioProvider] Call disconnected');
          setActiveCall(null);
          setIncomingCall(null);
          setCallState('ended');
          // Reset to idle after a moment
          setTimeout(() => setCallState('idle'), 2000);
        });
      });

      console.log('[TwilioProvider] Calling device.register()...');

      // Set a timeout to detect if registration hangs
      const registrationTimeout = setTimeout(() => {
        console.warn('[TwilioProvider] Registration is taking longer than expected...');
        console.log('[TwilioProvider] Current device state:', newDevice.state);
      }, 5000);

      await newDevice.register();
      clearTimeout(registrationTimeout);

      console.log('[TwilioProvider] Device.register() completed');
      console.log('[TwilioProvider] Final device state:', newDevice.state);
      deviceRef.current = newDevice;
      setDevice(newDevice);

    } catch (err) {
      console.error('[TwilioProvider] Failed to initialize device:', err);
      setError(`Failed to initialize phone: ${(err as Error)?.message}`);
    }
  }, [user, loadTwilioScript]);

  // Accept incoming call
  const acceptIncomingCall = useCallback(() => {
    if (!incomingCall) return;

    try {
      const call = incomingCall.call;
      (call as unknown as { accept: () => void }).accept();
      setActiveCall(call);
      setCallState('connected');
      setIncomingCall(null);

      // Navigate to call page
      router.push('/call');
    } catch (err) {
      console.error('[TwilioProvider] Failed to accept call:', err);
      setError(`Failed to accept call: ${(err as Error)?.message}`);
      setIncomingCall(null);
      setCallState('idle');
    }
  }, [incomingCall, router]);

  // Reject incoming call
  const rejectIncomingCall = useCallback(async () => {
    if (!incomingCall) return;

    try {
      // Mark the call as declined in the database before rejecting
      const callSid = incomingCall.call.parameters.CallSid;
      if (callSid) {
        try {
          await fetch('/api/twilio/voice/decline', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callSid }),
          });
        } catch (apiErr) {
          console.error('[TwilioProvider] Failed to mark call as declined:', apiErr);
        }
      }

      (incomingCall.call as unknown as { reject: () => void }).reject();
      setIncomingCall(null);
      setCallState('idle');
    } catch (err) {
      console.error('[TwilioProvider] Failed to reject call:', err);
      setIncomingCall(null);
      setCallState('idle');
    }
  }, [incomingCall]);

  // Make outbound call
  const makeCall = useCallback(async (phoneNumber: string, params?: Record<string, string>): Promise<TwilioCall | null> => {
    if (!deviceRef.current) {
      setError('Phone not ready');
      return null;
    }

    try {
      setCallState('connecting');
      const callParams = {
        To: phoneNumber,
        ...params,
      };

      const call = await deviceRef.current.connect({ params: callParams });
      setActiveCall(call);

      call.on('ringing', () => {
        setCallState('ringing');
      });

      call.on('accept', () => {
        setCallState('connected');
      });

      call.on('disconnect', () => {
        setActiveCall(null);
        setCallState('ended');
        setTimeout(() => setCallState('idle'), 2000);
      });

      call.on('cancel', () => {
        setActiveCall(null);
        setCallState('idle');
      });

      call.on('error', (err: unknown) => {
        const callErr = err as { message?: string };
        setError(`Call error: ${callErr?.message || 'Unknown error'}`);
        setActiveCall(null);
        setCallState('idle');
      });

      return call;
    } catch (err) {
      console.error('[TwilioProvider] Failed to make call:', err);
      setError(`Failed to make call: ${(err as Error)?.message}`);
      setCallState('idle');
      return null;
    }
  }, []);

  // Hang up
  const hangUp = useCallback(() => {
    if (activeCall) {
      activeCall.disconnect();
    }
    if (deviceRef.current) {
      deviceRef.current.disconnectAll();
    }
    setActiveCall(null);
    setCallState('ended');
  }, [activeCall]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (activeCall) {
      const newMuted = !isMuted;
      activeCall.mute(newMuted);
      setIsMuted(newMuted);
    }
  }, [activeCall, isMuted]);

  // Load user on mount
  useEffect(() => {
    async function loadUser() {
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        setUser({ id: authUser.id, email: authUser.email || '' });
      }
    }
    loadUser();
  }, []);

  // Initialize device when user is loaded
  useEffect(() => {
    if (user) {
      initializeDevice();
    }

    return () => {
      if (deviceRef.current) {
        deviceRef.current.destroy();
        deviceRef.current = null;
      }
    };
  }, [user, initializeDevice]);

  const value: TwilioContextType = {
    device,
    isDeviceReady,
    incomingCall,
    activeCall,
    callState,
    error,
    acceptIncomingCall,
    rejectIncomingCall,
    makeCall,
    hangUp,
    toggleMute,
    isMuted,
  };

  return (
    <TwilioContext.Provider value={value}>
      {children}
    </TwilioContext.Provider>
  );
}
