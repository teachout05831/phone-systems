'use client';

import { useEffect, useRef } from 'react';
import { useTwilio } from './twilio-provider';

export function IncomingCallNotification() {
  const { incomingCall, callState, acceptIncomingCall, rejectIncomingCall } = useTwilio();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Play ringtone when incoming call
  useEffect(() => {
    if (callState === 'incoming' && incomingCall) {
      // Create and play ringtone
      const audio = new Audio('/ringtone.mp3');
      audio.loop = true;
      audio.volume = 0.5;
      audioRef.current = audio;

      audio.play().catch((err) => {
        console.log('[IncomingCall] Could not play ringtone:', err);
      });

      return () => {
        audio.pause();
        audio.currentTime = 0;
      };
    }
  }, [callState, incomingCall]);

  // Don't render if no incoming call
  if (callState !== 'incoming' || !incomingCall) {
    return null;
  }

  // Format phone number for display
  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md animate-pulse rounded-2xl border border-green-200 bg-white p-6 shadow-2xl dark:border-green-800 dark:bg-zinc-800">
        {/* Incoming call icon */}
        <div className="mb-4 flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 animate-ping rounded-full bg-green-400 opacity-75" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-green-500">
              <svg
                className="h-8 w-8 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Caller info */}
        <div className="mb-6 text-center">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
            Incoming Call
          </h2>
          <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">
            {formatPhone(incomingCall.from)}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-4">
          {/* Decline button */}
          <button
            onClick={rejectIncomingCall}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 px-6 py-4 text-lg font-medium text-white transition-colors hover:bg-red-600 active:bg-red-700"
          >
            <svg
              className="h-6 w-6 rotate-135"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
              />
            </svg>
            Decline
          </button>

          {/* Accept button */}
          <button
            onClick={acceptIncomingCall}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-500 px-6 py-4 text-lg font-medium text-white transition-colors hover:bg-green-600 active:bg-green-700"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
              />
            </svg>
            Answer
          </button>
        </div>
      </div>
    </div>
  );
}
