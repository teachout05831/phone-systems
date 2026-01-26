'use client'

import type { CallTranscript } from '../types'

interface TranscriptViewProps {
  transcript: CallTranscript | null
  onDownload: () => void
  onCopy: () => void
}

export function TranscriptView({ transcript, onDownload, onCopy }: TranscriptViewProps) {
  if (!transcript || transcript.segments.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
        <div className="bg-zinc-50 dark:bg-zinc-800 px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Full Transcript
            </span>
          </div>
        </div>
        <div className="p-8 text-center text-zinc-500 dark:text-zinc-400">
          No transcript available for this call.
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
      {/* Header */}
      <div className="bg-zinc-50 dark:bg-zinc-800 px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Full Transcript
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-700 px-2 py-1 rounded-full border border-zinc-200 dark:border-zinc-600">
            {transcript.segments.length} messages
          </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {transcript.word_count} words
          </span>
        </div>
      </div>

      {/* Transcript Content */}
      <div className="max-h-96 overflow-y-auto p-4 space-y-3">
        {transcript.segments.map((segment, idx) => (
          <div
            key={idx}
            className="flex gap-3 p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            {/* Timestamp */}
            <div className="text-xs text-zinc-400 dark:text-zinc-500 min-w-[60px] pt-1 font-mono">
              {segment.timestamp}
            </div>

            {/* Speaker Badge */}
            <div
              className={`text-xs font-bold uppercase px-2 py-1 rounded min-w-[70px] text-center h-fit ${
                segment.speaker === 'rep'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              }`}
            >
              {segment.speaker === 'rep' ? 'REP' : 'CUSTOMER'}
            </div>

            {/* Text */}
            <div className="flex-1 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
              {segment.text}
            </div>
          </div>
        ))}
      </div>

      {/* Footer Actions */}
      <div className="bg-zinc-50 dark:bg-zinc-800 px-4 py-3 border-t border-zinc-200 dark:border-zinc-700 flex gap-2">
        <button
          onClick={onDownload}
          className="px-3 py-1.5 text-sm bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-600 transition-colors"
        >
          Download Transcript
        </button>
        <button
          onClick={onCopy}
          className="px-3 py-1.5 text-sm bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-600 transition-colors"
        >
          Copy to Clipboard
        </button>
      </div>
    </div>
  )
}
