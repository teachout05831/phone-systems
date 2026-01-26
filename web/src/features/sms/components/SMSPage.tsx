'use client'

import { useEffect, useState, useCallback } from 'react'
import type { SMSConversation, SMSMessage, SMSTemplate } from '../types'
import { useSMS } from '../hooks/useSMS'
import { ConversationList } from './ConversationList'
import { ChatView } from './ChatView'
import { ContactPanel } from './ContactPanel'
import { NewMessageModal } from './NewMessageModal'
import { fetchMessages } from '../actions/fetchMessages'
import { sendMessage as sendMessageAction } from '../actions/sendMessage'

interface Props {
  initialConversations: SMSConversation[]
  initialTemplates?: SMSTemplate[]
}

export function SMSPage({ initialConversations, initialTemplates = [] }: Props) {
  const [showContactPanel, setShowContactPanel] = useState(true)
  const [showNewMessage, setShowNewMessage] = useState(false)

  const {
    conversations,
    selectedConversation,
    selectConversation,
    messages,
    setMessages,
    sendMessage,
    isSending,
    error,
  } = useSMS({
    initialConversations,
    initialTemplates,
  })

  // Load messages when conversation is selected
  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id)
        .then(setMessages)
        .catch(console.error)
    }
  }, [selectedConversation, setMessages])

  // Handle sending new message from modal
  const handleNewMessage = useCallback(async (contactId: string, phoneNumber: string, message: string) => {
    const result = await sendMessageAction({ contactId, body: message })
    if (result.error) {
      throw new Error(result.error)
    }
    // Refresh the page to show the new conversation
    window.location.reload()
  }, [])

  return (
    <>
      <NewMessageModal
        isOpen={showNewMessage}
        onClose={() => setShowNewMessage(false)}
        onSend={handleNewMessage}
      />
    <div className="flex h-[calc(100vh-4rem)] bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
      {/* Left: Conversation List */}
      <div className="w-80 flex-shrink-0 border-r border-zinc-200 dark:border-zinc-700 flex flex-col">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">Messages</h1>
            <button
              onClick={() => setShowNewMessage(true)}
              className="p-1.5 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
              title="New message"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {conversations.length} conversation{conversations.length !== 1 && 's'}
          </p>
        </div>
        <ConversationList
          conversations={conversations}
          selectedId={selectedConversation?.id || null}
          onSelect={selectConversation}
        />
      </div>

      {/* Center: Chat View */}
      <div className="flex-1 flex flex-col min-w-0">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}
        <ChatView
          conversation={selectedConversation}
          messages={messages}
          onSend={sendMessage}
          isSending={isSending}
        />
      </div>

      {/* Right: Contact Panel (collapsible) */}
      {showContactPanel && (
        <div className="w-72 flex-shrink-0 border-l border-zinc-200 dark:border-zinc-700 hidden lg:block">
          <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-700">
            <h2 className="text-sm font-medium text-zinc-900 dark:text-white">Contact</h2>
            <button
              onClick={() => setShowContactPanel(false)}
              className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <ContactPanel conversation={selectedConversation} />
        </div>
      )}

      {/* Toggle button for contact panel when hidden */}
      {!showContactPanel && (
        <button
          onClick={() => setShowContactPanel(true)}
          className="absolute right-4 top-20 p-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 hidden lg:block"
          title="Show contact panel"
        >
          <svg className="w-5 h-5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </button>
      )}
    </div>
    </>
  )
}
