'use client'

import { useState, useCallback, useMemo } from 'react'
import type { SMSConversation, SMSMessage, SMSTemplate } from '../types'
import { useConversations } from './useConversations'
import { useMessages } from './useMessages'

interface UseSMSProps {
  initialConversations: SMSConversation[]
  initialMessages?: SMSMessage[]
  initialTemplates?: SMSTemplate[]
}

interface UseSMSReturn {
  // Conversations
  conversations: SMSConversation[]
  selectedConversation: SMSConversation | null
  selectConversation: (id: string) => Promise<void>
  // Messages
  messages: SMSMessage[]
  setMessages: (messages: SMSMessage[]) => void
  sendMessage: (body: string) => Promise<{ success: boolean; error?: string }>
  isSending: boolean
  // Templates
  templates: SMSTemplate[]
  // State
  isLoading: boolean
  error: string | null
}

export function useSMS({
  initialConversations,
  initialMessages = [],
  initialTemplates = [],
}: UseSMSProps): UseSMSReturn {
  const [templates] = useState(initialTemplates)

  const {
    conversations,
    selectedId,
    isLoading: conversationsLoading,
    error: conversationsError,
    select,
    updateConversation,
  } = useConversations(initialConversations)

  const {
    messages,
    isSending,
    error: messagesError,
    setMessages,
    send,
  } = useMessages(initialMessages)

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedId) || null,
    [conversations, selectedId]
  )

  const sendMessage = useCallback(
    async (body: string) => {
      if (!selectedConversation) {
        return { success: false, error: 'No conversation selected' }
      }

      const result = await send({
        contactId: selectedConversation.contactId || undefined,
        phoneNumber: selectedConversation.phoneNumber,
        body,
      })

      if (result.success) {
        // Update conversation preview
        updateConversation(selectedConversation.id, {
          lastMessageAt: new Date().toISOString(),
          lastMessagePreview: body.slice(0, 100),
          messageCount: selectedConversation.messageCount + 1,
        })
      }

      return result
    },
    [selectedConversation, send, updateConversation]
  )

  return {
    conversations,
    selectedConversation,
    selectConversation: select,
    messages,
    setMessages,
    sendMessage,
    isSending,
    templates,
    isLoading: conversationsLoading,
    error: conversationsError || messagesError,
  }
}
