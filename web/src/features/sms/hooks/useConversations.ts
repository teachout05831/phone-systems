'use client'

import { useState, useCallback } from 'react'
import type { SMSConversation } from '../types'
import { markAsRead } from '../actions/markAsRead'

interface UseConversationsReturn {
  conversations: SMSConversation[]
  selectedId: string | null
  isLoading: boolean
  error: string | null
  select: (id: string) => Promise<void>
  setConversations: (conversations: SMSConversation[]) => void
  updateConversation: (id: string, updates: Partial<SMSConversation>) => void
}

export function useConversations(
  initial: SMSConversation[]
): UseConversationsReturn {
  const [conversations, setConversations] = useState(initial)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const select = useCallback(async (id: string) => {
    setSelectedId(id)
    setError(null)

    // Find conversation and mark as read if has unread
    const conversation = conversations.find((c) => c.id === id)
    if (conversation && conversation.unreadCount > 0) {
      setIsLoading(true)
      const result = await markAsRead(id)
      setIsLoading(false)

      if (result.error) {
        setError(result.error)
      } else {
        // Update local state
        setConversations((prev) =>
          prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c))
        )
      }
    }
  }, [conversations])

  const updateConversation = useCallback(
    (id: string, updates: Partial<SMSConversation>) => {
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
      )
    },
    []
  )

  return {
    conversations,
    selectedId,
    isLoading,
    error,
    select,
    setConversations,
    updateConversation,
  }
}
