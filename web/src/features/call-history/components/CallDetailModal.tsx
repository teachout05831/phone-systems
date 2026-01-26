'use client'

import { useCallback } from 'react'
import type { CallDetails } from '../types'
import { AudioPlayer } from './AudioPlayer'
import { AISummary } from './AISummary'
import { TranscriptView } from './TranscriptView'

interface CallDetailModalProps {
  call: CallDetails | null
  isOpen: boolean
  onClose: () => void
}

function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 11 && cleaned[0] === '1') {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  }
  return phone
}

function formatDuration(seconds: number): string {
  if (!seconds) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

export function CallDetailModal({ call, isOpen, onClose }: CallDetailModalProps) {
  const handleDownloadTranscript = useCallback(() => {
    if (!call?.transcript) return

    const text = call.transcript.segments
      .map((s) => `[${s.timestamp}] ${s.speaker.toUpperCase()}: ${s.text}`)
      .join('\n')

    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transcript-${call.id}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }, [call])

  const handleCopyTranscript = useCallback(async () => {
    if (!call?.transcript) return

    const text = call.transcript.segments
      .map((s) => `[${s.timestamp}] ${s.speaker.toUpperCase()}: ${s.text}`)
      .join('\n')

    await navigator.clipboard.writeText(text)
    alert('Transcript copied to clipboard!')
  }, [call])

  if (!isOpen || !call) return null

  const contactName = call.contact
    ? `${call.contact.first_name || ''} ${call.contact.last_name || ''}`.trim() || 'Unknown'
    : 'Unknown'

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-4xl bg-white dark:bg-zinc-800 rounded-xl shadow-xl">
          {/* Header */}
          <div className="flex items-start justify-between p-4 border-b border-zinc-200 dark:border-zinc-700">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                Call Details: {formatPhoneNumber(call.phone_number)}
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {contactName} • {formatDateTime(call.started_at)} • Duration: {formatDuration(call.duration_seconds)}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Recording Player */}
            <AudioPlayer
              src={call.recording_url}
              duration={call.duration_seconds}
            />

            {/* AI Summary */}
            <AISummary summary={call.ai_summary} />

            {/* Transcript */}
            <TranscriptView
              transcript={call.transcript}
              onDownload={handleDownloadTranscript}
              onCopy={handleCopyTranscript}
            />
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 p-4 border-t border-zinc-200 dark:border-zinc-700">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
