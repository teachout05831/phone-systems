'use client';

interface CallControlsProps {
  isOnCall: boolean;
  isMuted: boolean;
  onMuteToggle: () => void;
  onHangUp: () => void;
  disabled?: boolean;
}

export function CallControls({
  isOnCall,
  isMuted,
  onMuteToggle,
  onHangUp,
  disabled = false,
}: CallControlsProps) {
  return (
    <div className="flex items-center justify-center gap-4">
      {/* Mute Button */}
      <button
        onClick={onMuteToggle}
        disabled={!isOnCall || disabled}
        className={`p-4 rounded-full transition-colors ${
          isMuted
            ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
            : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
        } ${(!isOnCall || disabled) ? 'opacity-50 cursor-not-allowed' : ''}`}
        title={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? (
          <MicOffIcon className="w-6 h-6" />
        ) : (
          <MicIcon className="w-6 h-6" />
        )}
      </button>

      {/* Hang Up Button */}
      <button
        onClick={onHangUp}
        disabled={!isOnCall || disabled}
        className={`p-4 rounded-full bg-red-500 hover:bg-red-600 text-white transition-colors ${
          (!isOnCall || disabled) ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        title="Hang Up"
      >
        <PhoneOffIcon className="w-6 h-6" />
      </button>
    </div>
  );
}

// Simple SVG icons
function MicIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
      />
    </svg>
  );
}

function MicOffIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
      />
    </svg>
  );
}

function PhoneOffIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z"
      />
    </svg>
  );
}
