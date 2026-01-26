'use client'

import { useEffect, useRef } from 'react'
import type { LiveTranscriptProps } from '../types'
import { formatTime } from '../utils'

export function LiveTranscript({ transcript, isLoading }: LiveTranscriptProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [transcript])

  if (isLoading) {
    return (
      <div className="flex-1 bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4 flex items-center justify-center">
        <p className="text-zinc-500 dark:text-zinc-400">Loading transcript...</p>
      </div>
    )
  }

  if (transcript.length === 0) {
    return (
      <div className="flex-1 bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4 flex items-center justify-center">
        <p className="text-zinc-500 dark:text-zinc-400">No transcript available yet</p>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 bg-zinc-50 dark:bg-zinc-800 rounded-lg p-3 overflow-y-auto space-y-2"
    >
      {transcript.map((segment, index) => (
        <div
          key={index}
          className={`p-2 rounded-lg bg-white dark:bg-zinc-700 border-l-4 ${
            segment.speaker === 'agent'
              ? 'border-blue-500'
              : 'border-green-500'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span
              className={`text-xs font-semibold ${
                segment.speaker === 'agent'
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-green-600 dark:text-green-400'
              }`}
            >
              {segment.speaker === 'agent' ? 'AI Agent' : 'Customer'}
            </span>
            <span className="text-xs text-zinc-400">{formatTime(segment.timestamp)}</span>
          </div>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">{segment.text}</p>
        </div>
      ))}
    </div>
  )
}
