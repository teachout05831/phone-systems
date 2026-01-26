'use client';

import { useEffect, useRef } from 'react';
import { TranscriptEntry } from '@/lib/deepgram';

interface TranscriptPanelProps {
  transcript: TranscriptEntry[];
  interimText?: string;
  className?: string;
}

export function TranscriptPanel({ transcript, interimText, className = '' }: TranscriptPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new transcript arrives
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript, interimText]);

  const hasContent = transcript.length > 0 || interimText;

  return (
    <div className={`flex flex-col h-full bg-white rounded-lg shadow ${className}`}>
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <TranscriptIcon className="w-5 h-5 text-gray-500" />
          Live Transcript
        </h3>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-2"
      >
        {!hasContent ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <MicIcon className="w-12 h-12 mb-2" />
            <p>Transcript will appear here when call connects</p>
          </div>
        ) : (
          <>
            {transcript.map((entry, index) => (
              <TranscriptLine
                key={index}
                text={entry.text}
                timestamp={entry.timestamp}
                isFinal={entry.isFinal}
              />
            ))}
            {interimText && (
              <TranscriptLine
                text={interimText}
                timestamp=""
                isFinal={false}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface TranscriptLineProps {
  text: string;
  timestamp: string;
  isFinal: boolean;
}

function TranscriptLine({ text, timestamp, isFinal }: TranscriptLineProps) {
  const time = timestamp ? new Date(timestamp).toLocaleTimeString() : '';

  return (
    <div
      className={`p-2 rounded ${
        isFinal ? 'bg-gray-50' : 'bg-blue-50 italic'
      }`}
    >
      <p className={isFinal ? 'text-gray-900' : 'text-gray-600'}>
        {text}
      </p>
      {time && (
        <span className="text-xs text-gray-400">{time}</span>
      )}
    </div>
  );
}

function TranscriptIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
      />
    </svg>
  );
}
