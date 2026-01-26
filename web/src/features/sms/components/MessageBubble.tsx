'use client'

import type { SMSMessage } from '../types'

interface Props {
  message: SMSMessage
}

export function MessageBubble({ message }: Props) {
  const isOutbound = message.direction === 'outbound'

  const getStatusIcon = () => {
    switch (message.status) {
      case 'delivered':
        return <span className="text-green-500">✓✓</span>
      case 'sent':
        return <span className="text-zinc-400">✓</span>
      case 'failed':
      case 'undelivered':
        return <span className="text-red-500">!</span>
      case 'sending':
      case 'queued':
        return <span className="text-zinc-400 animate-pulse">...</span>
      default:
        return null
    }
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[70%] rounded-2xl px-4 py-2 ${
          isOutbound
            ? 'bg-blue-600 text-white rounded-br-md'
            : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-white rounded-bl-md'
        }`}
      >
        <p className="text-sm whitespace-pre-wrap break-words">{message.body}</p>
        <div
          className={`flex items-center gap-1 mt-1 text-xs ${
            isOutbound ? 'text-blue-200' : 'text-zinc-500 dark:text-zinc-400'
          }`}
        >
          <span>{formatTime(message.createdAt)}</span>
          {isOutbound && getStatusIcon()}
        </div>
      </div>
    </div>
  )
}
