'use client'

import type { SMSConversation } from '../types'

interface Props {
  conversation: SMSConversation
  isSelected: boolean
  onClick: () => void
}

export function ConversationItem({ conversation, isSelected, onClick }: Props) {
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

  const getDisplayName = () => {
    if (conversation.contact) {
      const name = [conversation.contact.firstName, conversation.contact.lastName]
        .filter(Boolean)
        .join(' ')
      return name || conversation.phoneNumber
    }
    return conversation.phoneNumber
  }

  const getInitials = () => {
    if (conversation.contact) {
      const first = conversation.contact.firstName?.[0] || ''
      const last = conversation.contact.lastName?.[0] || ''
      return (first + last).toUpperCase() || conversation.phoneNumber.slice(-2)
    }
    return conversation.phoneNumber.slice(-2)
  }

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 border-b border-zinc-100 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors ${
        isSelected ? 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-l-blue-500' : ''
      } ${conversation.unreadCount > 0 ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''}`}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="relative w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
            {getInitials()}
          </span>
          {conversation.unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white dark:border-zinc-900" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span
              className={`font-medium truncate ${
                conversation.unreadCount > 0
                  ? 'text-zinc-900 dark:text-white'
                  : 'text-zinc-700 dark:text-zinc-300'
              }`}
            >
              {getDisplayName()}
            </span>
            <span className="text-xs text-zinc-400 dark:text-zinc-500 flex-shrink-0">
              {formatTime(conversation.lastMessageAt)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 mt-0.5">
            {conversation.lastMessagePreview && (
              <p
                className={`text-sm truncate ${
                  conversation.unreadCount > 0
                    ? 'text-zinc-600 dark:text-zinc-400 font-medium'
                    : 'text-zinc-500 dark:text-zinc-500'
                }`}
              >
                {conversation.lastMessagePreview}
              </p>
            )}
            {conversation.unreadCount > 0 && (
              <span className="flex-shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center">
                {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}
