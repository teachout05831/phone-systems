'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

// Twilio Device types (loaded from CDN)
// Note: Window.Twilio is also declared in call/page.tsx
// We use a local type here to avoid conflicts
interface TwilioGlobal {
  Device: new (token: string, options?: Record<string, unknown>) => TwilioDevice;
}

// Access Twilio from window safely
function getTwilioGlobal(): TwilioGlobal | undefined {
  if (typeof window !== 'undefined') {
    return (window as unknown as { Twilio?: TwilioGlobal }).Twilio;
  }
  return undefined;
}

interface TwilioDevice {
  register(): Promise<void>;
  unregister(): Promise<void>;
  connect(options?: { params?: Record<string, string> }): Promise<TwilioCall>;
  destroy(): void;
  on(event: string, callback: (...args: any[]) => void): void;
  off(event: string, callback: (...args: any[]) => void): void;
  state: string;
  calls: TwilioCall[];
}

interface TwilioCall {
  parameters: { CallSid: string; To?: string; From?: string };
  status(): string;
  mute(shouldMute?: boolean): void;
  isMuted(): boolean;
  disconnect(): void;
  on(event: string, callback: (...args: any[]) => void): void;
  sendDigits(digits: string): void;
}

export type DeviceState = 'unregistered' | 'registering' | 'registered' | 'error';
export type CallState = 'idle' | 'connecting' | 'ringing' | 'open' | 'closed';

interface UseTwilioDeviceOptions {
  onIncomingCall?: (call: TwilioCall) => void;
  onCallStateChange?: (state: CallState, callSid?: string) => void;
  onError?: (error: Error) => void;
}

export function useTwilioDevice(options: UseTwilioDeviceOptions = {}) {
  const { onIncomingCall, onCallStateChange, onError } = options;

  const [deviceState, setDeviceState] = useState<DeviceState>('unregistered');
  const [callState, setCallState] = useState<CallState>('idle');
  const [currentCall, setCurrentCall] = useState<TwilioCall | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deviceRef = useRef<TwilioDevice | null>(null);
  const tokenRef = useRef<string | null>(null);

  // Load Twilio SDK script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://media.twiliocdn.com/sdk/js/voice/releases/2.15.0/twilio.min.js';
    script.async = true;
    script.onload = () => {
      console.log('Twilio SDK loaded');
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  // Initialize device with token
  const initDevice = useCallback(async () => {
    const Twilio = getTwilioGlobal();
    if (!Twilio?.Device) {
      setError('Twilio SDK not loaded');
      return;
    }

    try {
      setDeviceState('registering');
      setError(null);

      // Fetch token from API
      const response = await fetch('/api/twilio/token');
      if (!response.ok) {
        throw new Error('Failed to fetch Twilio token');
      }
      const data = await response.json();
      tokenRef.current = data.token;

      // Clean up existing device
      if (deviceRef.current) {
        deviceRef.current.destroy();
      }

      // Create new device
      const device = new Twilio.Device(data.token, {
        codecPreferences: ['opus', 'pcmu'],
        enableRingingState: true,
        logLevel: 1,
      });

      // Register event handlers
      device.on('registered', () => {
        console.log('Twilio Device registered');
        setDeviceState('registered');
      });

      device.on('unregistered', () => {
        console.log('Twilio Device unregistered');
        setDeviceState('unregistered');
      });

      device.on('error', (err: Error) => {
        console.error('Twilio Device error:', err);
        setError(err.message);
        setDeviceState('error');
        onError?.(err);
      });

      device.on('incoming', (call: TwilioCall) => {
        console.log('Incoming call from:', call.parameters.From);
        onIncomingCall?.(call);
      });

      device.on('tokenWillExpire', async () => {
        console.log('Token will expire, refreshing...');
        const TwilioRefresh = getTwilioGlobal();
        if (!TwilioRefresh?.Device) return;
        try {
          const response = await fetch('/api/twilio/token');
          const data = await response.json();
          tokenRef.current = data.token;
          // Re-register device with new token
          await device.unregister();
          const newDevice = new TwilioRefresh.Device(data.token, {
            codecPreferences: ['opus', 'pcmu'],
            enableRingingState: true,
          });
          deviceRef.current = newDevice;
          await newDevice.register();
        } catch (err) {
          console.error('Error refreshing token:', err);
        }
      });

      deviceRef.current = device;

      // Register device
      await device.register();
    } catch (err) {
      console.error('Error initializing Twilio Device:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize');
      setDeviceState('error');
    }
  }, [onError, onIncomingCall]);

  // Set up call event handlers
  const setupCallHandlers = useCallback(
    (call: TwilioCall) => {
      const updateCallState = (state: CallState) => {
        setCallState(state);
        onCallStateChange?.(state, call.parameters.CallSid);
      };

      call.on('ringing', () => {
        console.log('Call ringing');
        updateCallState('ringing');
      });

      call.on('accept', () => {
        console.log('Call accepted');
        updateCallState('open');
      });

      call.on('disconnect', () => {
        console.log('Call disconnected');
        updateCallState('closed');
        setCurrentCall(null);
        setIsMuted(false);
        // Reset to idle after a short delay
        setTimeout(() => setCallState('idle'), 1000);
      });

      call.on('cancel', () => {
        console.log('Call cancelled');
        updateCallState('closed');
        setCurrentCall(null);
        setIsMuted(false);
        setTimeout(() => setCallState('idle'), 1000);
      });

      call.on('reject', () => {
        console.log('Call rejected');
        updateCallState('closed');
        setCurrentCall(null);
        setIsMuted(false);
        setTimeout(() => setCallState('idle'), 1000);
      });

      call.on('error', (err: Error) => {
        console.error('Call error:', err);
        setError(err.message);
        updateCallState('closed');
        setCurrentCall(null);
        setIsMuted(false);
      });
    },
    [onCallStateChange]
  );

  // Make outbound call
  const makeCall = useCallback(
    async (phoneNumber: string): Promise<string | null> => {
      if (!deviceRef.current || deviceState !== 'registered') {
        setError('Device not ready');
        return null;
      }

      if (currentCall) {
        setError('Already on a call');
        return null;
      }

      try {
        setCallState('connecting');
        setError(null);

        const call = await deviceRef.current.connect({
          params: { To: phoneNumber },
        });

        setCurrentCall(call);
        setupCallHandlers(call);

        return call.parameters.CallSid;
      } catch (err) {
        console.error('Error making call:', err);
        setError(err instanceof Error ? err.message : 'Failed to make call');
        setCallState('idle');
        return null;
      }
    },
    [deviceState, currentCall, setupCallHandlers]
  );

  // Hang up current call
  const hangUp = useCallback(() => {
    if (currentCall) {
      currentCall.disconnect();
      setCurrentCall(null);
      setCallState('idle');
      setIsMuted(false);
    }
  }, [currentCall]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (currentCall) {
      const newMuteState = !currentCall.isMuted();
      currentCall.mute(newMuteState);
      setIsMuted(newMuteState);
    }
  }, [currentCall]);

  // Send DTMF digits
  const sendDigits = useCallback(
    (digits: string) => {
      if (currentCall) {
        currentCall.sendDigits(digits);
      }
    },
    [currentCall]
  );

  // Accept incoming call
  const acceptCall = useCallback(
    (call: TwilioCall) => {
      setCurrentCall(call);
      setupCallHandlers(call);
      // Accept is handled automatically by Twilio
    },
    [setupCallHandlers]
  );

  // Reject incoming call
  const rejectCall = useCallback((call: TwilioCall) => {
    call.disconnect();
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (deviceRef.current) {
        deviceRef.current.destroy();
      }
    };
  }, []);

  return {
    // State
    deviceState,
    callState,
    isMuted,
    error,
    currentCallSid: currentCall?.parameters.CallSid || null,

    // Actions
    initDevice,
    makeCall,
    hangUp,
    toggleMute,
    sendDigits,
    acceptCall,
    rejectCall,
  };
}
