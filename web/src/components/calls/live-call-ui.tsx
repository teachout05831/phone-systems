'use client';

import { CallTimer } from './call-timer';
import { CallControls } from './call-controls';
import { TranscriptPanel } from './transcript-panel';
import { CoachingPanel } from './coaching-panel';
import { DialPad } from './dial-pad';
import { TranscriptEntry } from '@/lib/deepgram';
import { CoachingSuggestion } from '@/lib/ai-coaching';
import { CallState, DeviceState } from '@/hooks/useCallState';

interface LiveCallUIProps {
  // Device state
  deviceState: DeviceState;
  deviceReady: boolean;

  // Call state
  callState: CallState;
  isOnCall: boolean;
  callSid: string | null;
  formattedDuration: string;

  // Contact info
  contactName?: string;
  phoneNumber?: string;

  // Audio state
  isMuted: boolean;

  // Transcript
  transcript: TranscriptEntry[];
  interimText: string;

  // AI Coaching
  coachingSuggestions: CoachingSuggestion[];

  // Connection state
  wsConnected: boolean;
  error: string | null;

  // Actions
  onMakeCall: (phoneNumber: string) => void;
  onHangUp: () => void;
  onToggleMute: () => void;
  onSendDigits: (digits: string) => void;
  onDismissCoaching: (id: string) => void;

  // Initial number (for calling from contact)
  initialPhoneNumber?: string;
}

export function LiveCallUI({
  deviceState,
  deviceReady,
  callState,
  isOnCall,
  formattedDuration,
  contactName,
  phoneNumber,
  isMuted,
  transcript,
  interimText,
  coachingSuggestions,
  wsConnected,
  error,
  onMakeCall,
  onHangUp,
  onToggleMute,
  onSendDigits,
  onDismissCoaching,
  initialPhoneNumber,
}: LiveCallUIProps) {
  // Show different content based on state
  const renderMainContent = () => {
    // Not ready yet
    if (!deviceReady) {
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mb-4" />
          <p className="text-gray-600">
            {deviceState === 'registering' ? 'Initializing phone...' : 'Connecting...'}
          </p>
          {error && (
            <p className="mt-2 text-red-500 text-sm">{error}</p>
          )}
        </div>
      );
    }

    // On a call - show full call interface
    if (isOnCall) {
      return (
        <div className="flex flex-col h-full">
          {/* Call header */}
          <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-b">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {contactName || phoneNumber || 'Active Call'}
              </h2>
              {contactName && phoneNumber && (
                <p className="text-gray-500">{phoneNumber}</p>
              )}
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded ${
                    callState === 'open'
                      ? 'bg-green-100 text-green-700'
                      : callState === 'ringing'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {callState === 'open' ? 'Connected' : callState === 'ringing' ? 'Ringing' : 'Connecting'}
                </span>
                {!wsConnected && (
                  <span className="px-2 py-0.5 text-xs font-medium rounded bg-red-100 text-red-700">
                    Transcript Offline
                  </span>
                )}
              </div>
            </div>
            <CallTimer duration={formattedDuration} isActive={callState === 'open'} />
          </div>

          {/* Main content area - transcript and coaching */}
          <div className="flex-1 flex gap-4 p-4 overflow-hidden">
            {/* Transcript */}
            <TranscriptPanel
              transcript={transcript}
              interimText={interimText}
              className="flex-1"
            />

            {/* AI Coaching */}
            <CoachingPanel
              suggestions={coachingSuggestions}
              onDismiss={onDismissCoaching}
              className="w-80"
            />
          </div>

          {/* Call controls */}
          <div className="px-6 py-4 bg-gray-50 border-t">
            <CallControls
              isOnCall={isOnCall}
              isMuted={isMuted}
              onMuteToggle={onToggleMute}
              onHangUp={onHangUp}
            />
          </div>
        </div>
      );
    }

    // Not on a call - show dial pad
    return (
      <div className="flex flex-col items-center justify-center h-full py-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Make a Call</h2>
        <p className="text-gray-500 mb-8">Enter a phone number or use the dial pad</p>
        <DialPad
          onCall={onMakeCall}
          onDigit={isOnCall ? onSendDigits : undefined}
          disabled={!deviceReady}
          initialNumber={initialPhoneNumber}
        />
        {error && (
          <p className="mt-4 text-red-500 text-sm">{error}</p>
        )}
      </div>
    );
  };

  return (
    <div className="h-full bg-white rounded-lg shadow-lg overflow-hidden">
      {renderMainContent()}
    </div>
  );
}
