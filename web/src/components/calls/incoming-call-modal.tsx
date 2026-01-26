'use client';

import { useTwilio } from './twilio-provider';

export function IncomingCallModal() {
  const { incomingCall, callState, acceptIncomingCall, rejectIncomingCall } = useTwilio();

  // Only show when there's an incoming call
  if (callState !== 'incoming' || !incomingCall) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative rounded-xl border border-zinc-200 bg-white p-8 dark:border-zinc-700 dark:bg-zinc-800 max-w-md w-full mx-4 text-center shadow-2xl animate-in fade-in zoom-in duration-200">
        {/* Ringing animation */}
        <div className="mb-6">
          <div className="mx-auto w-20 h-20 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center relative">
            {/* Pulse rings */}
            <div className="absolute inset-0 rounded-full bg-green-400/30 animate-ping" />
            <div className="absolute inset-2 rounded-full bg-green-400/20 animate-ping animation-delay-150" />
            <svg
              className="w-10 h-10 text-green-600 dark:text-green-400 relative z-10 animate-bounce"
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

        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">
          Incoming Call
        </h2>
        <p className="text-2xl font-mono text-zinc-700 dark:text-zinc-300 mb-2">
          {incomingCall.from}
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
          to {incomingCall.to || 'your line'}
        </p>

        <div className="flex gap-4 justify-center">
          <button
            onClick={acceptIncomingCall}
            className="flex items-center gap-2 px-8 py-3 bg-green-600 text-white rounded-full hover:bg-green-700 transition-all font-medium shadow-lg hover:shadow-xl hover:scale-105"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
              />
            </svg>
            Accept
          </button>
          <button
            onClick={rejectIncomingCall}
            className="flex items-center gap-2 px-8 py-3 bg-red-600 text-white rounded-full hover:bg-red-700 transition-all font-medium shadow-lg hover:shadow-xl hover:scale-105"
          >
            <svg
              className="w-5 h-5 rotate-[135deg]"
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
        </div>
      </div>
    </div>
  );
}
