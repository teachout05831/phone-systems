'use client';

import { useState, useCallback } from 'react';

interface DialPadProps {
  onCall: (phoneNumber: string) => void;
  onDigit?: (digit: string) => void;
  disabled?: boolean;
  initialNumber?: string;
}

const DIAL_PAD_KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#'],
];

const KEY_LABELS: Record<string, string> = {
  '2': 'ABC',
  '3': 'DEF',
  '4': 'GHI',
  '5': 'JKL',
  '6': 'MNO',
  '7': 'PQRS',
  '8': 'TUV',
  '9': 'WXYZ',
};

export function DialPad({ onCall, onDigit, disabled = false, initialNumber = '' }: DialPadProps) {
  const [phoneNumber, setPhoneNumber] = useState(initialNumber);

  const handleDigit = useCallback(
    (digit: string) => {
      setPhoneNumber((prev) => prev + digit);
      onDigit?.(digit);
    },
    [onDigit]
  );

  const handleBackspace = useCallback(() => {
    setPhoneNumber((prev) => prev.slice(0, -1));
  }, []);

  const handleClear = useCallback(() => {
    setPhoneNumber('');
  }, []);

  const handleCall = useCallback(() => {
    if (phoneNumber.length >= 10) {
      onCall(phoneNumber);
    }
  }, [phoneNumber, onCall]);

  const formatPhoneNumber = (number: string): string => {
    const cleaned = number.replace(/\D/g, '');
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    if (cleaned.length <= 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return `+${cleaned.slice(0, 1)} (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7, 11)}`;
  };

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      {/* Phone number display */}
      <div className="relative w-full max-w-xs">
        <input
          type="tel"
          value={formatPhoneNumber(phoneNumber)}
          onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
          placeholder="Enter phone number"
          className="w-full px-4 py-3 text-center text-xl font-mono bg-gray-100 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={disabled}
        />
        {phoneNumber && (
          <button
            onClick={handleBackspace}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-gray-700"
            title="Backspace"
          >
            <BackspaceIcon className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Dial pad grid */}
      <div className="grid grid-cols-3 gap-3">
        {DIAL_PAD_KEYS.map((row, rowIndex) =>
          row.map((key) => (
            <button
              key={key}
              onClick={() => handleDigit(key)}
              disabled={disabled}
              className="flex flex-col items-center justify-center w-16 h-16 rounded-full bg-gray-100 hover:bg-gray-200 active:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="text-2xl font-semibold">{key}</span>
              {KEY_LABELS[key] && (
                <span className="text-xs text-gray-500 tracking-wider">
                  {KEY_LABELS[key]}
                </span>
              )}
            </button>
          ))
        )}
      </div>

      {/* Call button */}
      <div className="flex gap-3 mt-2">
        {phoneNumber && (
          <button
            onClick={handleClear}
            className="px-6 py-3 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-700 transition-colors"
          >
            Clear
          </button>
        )}
        <button
          onClick={handleCall}
          disabled={disabled || phoneNumber.length < 10}
          className="px-8 py-3 rounded-full bg-green-500 hover:bg-green-600 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <PhoneIcon className="w-5 h-5" />
          Call
        </button>
      </div>
    </div>
  );
}

function BackspaceIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z"
      />
    </svg>
  );
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
      />
    </svg>
  );
}
