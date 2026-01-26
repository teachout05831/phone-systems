'use client'

import type { SMSConversation } from '../types'

interface Props {
  conversations: SMSConversation[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function ConversationList({ conversations, selectedId, onSelect }: Props) {
  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    } else if (days === 1) {
      return 'Yesterday'
    } else if (days < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' })
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const getDisplayName = (conv: SMSConversation) => {
    if (conv.contact) {
      const name = [conv.contact.firstName, conv.contact.lastName]
        .filter(Boolean)
        .join(' ')
      return name || conv.phoneNumber
    }
    return conv.phoneNumber
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center mb-3">
          <svg className="w-6 h-6 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">No conversations yet</p>
        <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
          Send a message to start a conversation
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-y-auto h-full">
      {conversations.map((conv) => (
        <button
          key={conv.id}
          onClick={() => onSelect(conv.id)}
          className={`w-full text-left p-4 border-b border-zinc-100 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors ${
            selectedId === conv.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`font-medium truncate ${
                  conv.unreadCount > 0 ? 'text-zinc-900 dark:text-white' : 'text-zinc-700 dark:text-zinc-300'
                }`}>
                  {getDisplayName(conv)}
                </span>
                {conv.unreadCount > 0 && (
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center">
                    {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                  </span>
                )}
              </div>
              {conv.lastMessagePreview && (
                <p className={`text-sm truncate mt-0.5 ${
                  conv.unreadCount > 0
                    ? 'text-zinc-600 dark:text-zinc-400'
                    : 'text-zinc-500 dark:text-zinc-500'
                }`}>
                  {conv.lastMessagePreview}
                </p>
              )}
            </div>
            {conv.lastMessageAt && (
              <span className="text-xs text-zinc-400 dark:text-zinc-500 flex-shrink-0">
                {formatTime(conv.lastMessageAt)}
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  )
}
