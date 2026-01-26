'use client'

import { useState, useCallback, KeyboardEvent } from 'react'

interface Props {
  onSend: (message: string) => Promise<{ success: boolean; error?: string }>
  isSending: boolean
  disabled?: boolean
}

export function MessageInput({ onSend, isSending, disabled }: Props) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSend = useCallback(async () => {
    if (!text.trim() || isSending || disabled) return

    setError(null)
    const result = await onSend(text.trim())

    if (result.success) {
      setText('')
    } else {
      setError(result.error || 'Failed to send')
    }
  }, [text, isSending, disabled, onSend])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const charCount = text.length
  const isOverLimit = charCount > 1600

  return (
    <div className="border-t border-zinc-200 dark:border-zinc-700 p-4">
      {error && (
        <div className="mb-2 text-sm text-red-600 dark:text-red-400">{error}</div>
      )}
      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            disabled={disabled || isSending}
            rows={1}
            className="w-full resize-none rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-3 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            style={{ minHeight: '44px', maxHeight: '120px' }}
          />
          <div
            className={`absolute bottom-1 right-2 text-xs ${
              isOverLimit ? 'text-red-500' : 'text-zinc-400'
            }`}
          >
            {charCount}/1600
          </div>
        </div>
        <button
          onClick={handleSend}
          disabled={!text.trim() || isSending || disabled || isOverLimit}
          className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSending ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            </span>
          ) : (
            'Send'
          )}
        </button>
      </div>
    </div>
  )
}
