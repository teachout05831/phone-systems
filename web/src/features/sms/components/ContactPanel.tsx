'use client'

import Link from 'next/link'
import type { SMSConversation } from '../types'

interface Props {
  conversation: SMSConversation | null
}

export function ContactPanel({ conversation }: Props) {
  if (!conversation) {
    return (
      <div className="flex items-center justify-center h-full p-6 text-center">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Select a conversation to see contact details
        </p>
      </div>
    )
  }

  const getDisplayName = () => {
    if (conversation.contact) {
      const name = [conversation.contact.firstName, conversation.contact.lastName]
        .filter(Boolean)
        .join(' ')
      return name || 'Unknown'
    }
    return 'Unknown Contact'
  }

  return (
    <div className="p-6">
      {/* Contact Avatar & Name */}
      <div className="text-center mb-6">
        <div className="w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center mx-auto mb-3">
          <span className="text-2xl font-medium text-blue-600 dark:text-blue-400">
            {getDisplayName().charAt(0).toUpperCase()}
          </span>
        </div>
        <h3 className="font-medium text-zinc-900 dark:text-white">{getDisplayName()}</h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{conversation.phoneNumber}</p>
      </div>

      {/* Contact Details */}
      {conversation.contact && (
        <div className="space-y-4">
          <div className="border-t border-zinc-200 dark:border-zinc-700 pt-4">
            <h4 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
              Contact Info
            </h4>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-zinc-500 dark:text-zinc-400">Phone</label>
                <p className="text-sm text-zinc-900 dark:text-white">
                  {conversation.contact.phone}
                </p>
              </div>
              {conversation.contact.email && (
                <div>
                  <label className="text-xs text-zinc-500 dark:text-zinc-400">Email</label>
                  <p className="text-sm text-zinc-900 dark:text-white">
                    {conversation.contact.email}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Conversation Stats */}
          <div className="border-t border-zinc-200 dark:border-zinc-700 pt-4">
            <h4 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
              Conversation
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-zinc-50 dark:bg-zinc-700/50 rounded-lg p-3">
                <p className="text-lg font-semibold text-zinc-900 dark:text-white">
                  {conversation.messageCount}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Messages</p>
              </div>
              <div className="bg-zinc-50 dark:bg-zinc-700/50 rounded-lg p-3">
                <p className="text-lg font-semibold text-zinc-900 dark:text-white">
                  {conversation.unreadCount}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Unread</p>
              </div>
            </div>
          </div>

          {/* View Contact Link */}
          <div className="border-t border-zinc-200 dark:border-zinc-700 pt-4">
            <Link
              href={`/contacts/${conversation.contactId}`}
              className="block w-full text-center px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
            >
              View Full Contact
            </Link>
          </div>
        </div>
      )}

      {/* No Contact - Create Link */}
      {!conversation.contact && (
        <div className="border-t border-zinc-200 dark:border-zinc-700 pt-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3 text-center">
            This number is not linked to a contact.
          </p>
          <Link
            href={`/contacts/new?phone=${encodeURIComponent(conversation.phoneNumber)}`}
            className="block w-full text-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Create Contact
          </Link>
        </div>
      )}
    </div>
  )
}
