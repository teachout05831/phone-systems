'use client'

import { useRef, useEffect } from 'react'
import type { SMSMessage, SMSConversation } from '../types'
import { MessageBubble } from './MessageBubble'
import { MessageInput } from './MessageInput'

interface Props {
  conversation: SMSConversation | null
  messages: SMSMessage[]
  onSend: (message: string) => Promise<{ success: boolean; error?: string }>
  isSending: boolean
}

export function ChatView({ conversation, messages, onSend, isSending }: Props) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (!conversation) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-1">
          Select a conversation
        </h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Choose a conversation from the list to start messaging
        </p>
      </div>
    )
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

  const groupMessagesByDate = () => {
    const groups: { date: string; messages: SMSMessage[] }[] = []

    messages.forEach((msg) => {
      const date = new Date(msg.createdAt).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })

      const lastGroup = groups[groups.length - 1]
      if (lastGroup && lastGroup.date === date) {
        lastGroup.messages.push(msg)
      } else {
        groups.push({ date, messages: [msg] })
      }
    })

    return groups
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-zinc-200 dark:border-zinc-700">
        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
          <span className="text-blue-600 dark:text-blue-400 font-medium">
            {getDisplayName().charAt(0).toUpperCase()}
          </span>
        </div>
        <div>
          <h2 className="font-medium text-zinc-900 dark:text-white">{getDisplayName()}</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{conversation.phoneNumber}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No messages yet. Send one to start the conversation.
            </p>
          </div>
        ) : (
          groupMessagesByDate().map((group) => (
            <div key={group.date}>
              <div className="flex justify-center my-4">
                <span className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-700 px-3 py-1 rounded-full">
                  {group.date}
                </span>
              </div>
              <div className="space-y-2">
                {group.messages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} />
                ))}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <MessageInput onSend={onSend} isSending={isSending} />
    </div>
  )
}
