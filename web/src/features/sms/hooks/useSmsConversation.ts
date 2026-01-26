'use client'

import { useState, useCallback, useEffect } from 'react'
import type { SMSConversation, SMSMessage } from '../types'
import { sendMessage } from '../actions/sendMessage'
import { markAsRead } from '../actions/markAsRead'
import { fetchMessages } from '../actions/fetchMessages'

interface UseSmsConversationProps {
  conversation: SMSConversation | null
  initialMessages?: SMSMessage[]
}

interface UseSmsConversationReturn {
  messages: SMSMessage[]
  isLoading: boolean
  isSending: boolean
  error: string | null
  send: (body: string) => Promise<{ success: boolean; error?: string }>
  refresh: () => Promise<void>
}

export function useSmsConversation({
  conversation,
  initialMessages = [],
}: UseSmsConversationProps): UseSmsConversationReturn {
  const [messages, setMessages] = useState(initialMessages)
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load messages when conversation changes
  useEffect(() => {
    if (!conversation) {
      setMessages([])
      return
    }

    const conversationId = conversation.id
    const hasUnread = conversation.unreadCount > 0

    setIsLoading(true)
    setError(null)

    fetchMessages(conversationId)
      .then((data) => {
        setMessages(data)
        // Mark as read if has unread messages
        if (hasUnread) {
          markAsRead(conversationId).catch(console.error)
        }
      })
      .catch((err) => {
        setError(err.message || 'Failed to load messages')
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [conversation?.id, conversation?.unreadCount])

  const refresh = useCallback(async () => {
    if (!conversation) return

    setIsLoading(true)
    setError(null)

    try {
      const data = await fetchMessages(conversation.id)
      setMessages(data)
    } catch (err) {
      const e = err as Error
      setError(e.message || 'Failed to refresh messages')
    } finally {
      setIsLoading(false)
    }
  }, [conversation?.id])

  const send = useCallback(
    async (body: string) => {
      if (!conversation) {
        return { success: false, error: 'No conversation selected' }
      }

      setIsSending(true)
      setError(null)

      const result = await sendMessage({
        contactId: conversation.contactId || undefined,
        phoneNumber: conversation.phoneNumber,
        body,
      })

      setIsSending(false)

      if (result.error) {
        setError(result.error)
        return { success: false, error: result.error }
      }

      // Refresh messages to show the new one
      await refresh()

      return { success: true }
    },
    [conversation, refresh]
  )

  return {
    messages,
    isLoading,
    isSending,
    error,
    send,
    refresh,
  }
}
