'use client'

import { useState, useCallback } from 'react'
import type { SMSMessage, SendMessageInput } from '../types'
import { sendMessage } from '../actions/sendMessage'

interface UseMessagesReturn {
  messages: SMSMessage[]
  isLoading: boolean
  isSending: boolean
  error: string | null
  setMessages: (messages: SMSMessage[]) => void
  addMessage: (message: SMSMessage) => void
  send: (input: SendMessageInput) => Promise<{ success: boolean; error?: string }>
}

export function useMessages(initial: SMSMessage[] = []): UseMessagesReturn {
  const [messages, setMessages] = useState(initial)
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addMessage = useCallback((message: SMSMessage) => {
    setMessages((prev) => [...prev, message])
  }, [])

  const send = useCallback(async (input: SendMessageInput) => {
    setIsSending(true)
    setError(null)

    const result = await sendMessage(input)

    setIsSending(false)

    if (result.error) {
      setError(result.error)
      return { success: false, error: result.error }
    }

    return { success: true }
  }, [])

  return {
    messages,
    isLoading,
    isSending,
    error,
    setMessages,
    addMessage,
    send,
  }
}
