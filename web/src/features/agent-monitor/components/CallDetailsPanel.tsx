'use client'

import Link from 'next/link'
import { LiveTranscript } from './LiveTranscript'
import { AIAnalysis } from './AIAnalysis'
import type { CallDetailsPanelProps } from '../types'
import { formatDuration, formatPhoneNumber } from '../utils'

export function CallDetailsPanel({
  call,
  transcript,
  isLoadingTranscript,
  onEndCall,
}: CallDetailsPanelProps) {
  if (!call) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800 p-4 flex flex-col items-center justify-center h-full">
        <div className="text-6xl mb-4 opacity-50">🤖</div>
        <h3 className="text-lg font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
          Select a Call to Monitor
        </h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center max-w-sm">
          Click on an active AI call from the list to view the live transcript and AI analysis
        </p>
      </div>
    )
  }

  const costPerMinute = 0.07
  const costEstimate = ((call.durationSeconds / 60) * costPerMinute).toFixed(2)

  return (
    <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800 p-4 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between pb-4 border-b border-zinc-200 dark:border-zinc-700 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
            {call.contactName}
            <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500 text-white">AI Agent</span>
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Customer: {formatPhoneNumber(call.phoneNumber)}
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Duration: {formatDuration(call.durationSeconds)}
          </p>
          <p className="text-sm text-yellow-600 dark:text-yellow-400 font-medium">
            Est. Cost: ${costEstimate}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            disabled
            className="px-3 py-1.5 text-sm rounded-lg bg-green-500 text-white opacity-50 cursor-not-allowed flex items-center gap-1"
            title="Listen feature coming soon"
          >
            🎧 Listen
          </button>
          <button
            onClick={onEndCall}
            className="px-3 py-1.5 text-sm rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors flex items-center gap-1"
          >
            📵 End Call
          </button>
          {call.contactId && (
            <Link
              href={`/contacts/${call.contactId}`}
              className="px-3 py-1.5 text-sm rounded-lg bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600 transition-colors flex items-center gap-1"
            >
              👤 View Contact
            </Link>
          )}
        </div>
      </div>

      {/* Transcript Section */}
      <div className="flex-1 flex flex-col min-h-0 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <h4 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">Live Transcript</h4>
          {call.status === 'in_progress' && (
            <span className="px-2 py-0.5 text-xs font-semibold bg-red-500 text-white rounded flex items-center gap-1">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
              LIVE
            </span>
          )}
        </div>
        <LiveTranscript transcript={transcript} isLoading={isLoadingTranscript} />
      </div>

      {/* AI Analysis Section */}
      <AIAnalysis aiSummary={call.aiSummary} />
    </div>
  )
}
