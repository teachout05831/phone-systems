'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Contact {
  id: string
  first_name: string | null
  last_name: string | null
  phone: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onSend: (contactId: string, phoneNumber: string, message: string) => Promise<void>
}

export function NewMessageModal({ isOpen, onClose, onSend }: Props) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch contacts
  useEffect(() => {
    if (!isOpen) return

    const fetchContacts = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, phone')
        .order('first_name')
        .limit(100)

      setContacts(data || [])
    }

    fetchContacts()
  }, [isOpen])

  const filteredContacts = contacts.filter((c) => {
    const name = `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase()
    const phone = c.phone.toLowerCase()
    const q = search.toLowerCase()
    return name.includes(q) || phone.includes(q)
  })

  const handleSend = async () => {
    if (!selectedContact || !message.trim()) return

    setIsSending(true)
    setError(null)

    try {
      await onSend(selectedContact.id, selectedContact.phone, message.trim())
      setMessage('')
      setSelectedContact(null)
      setSearch('')
      onClose()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message'
      setError(errorMessage)
    } finally {
      setIsSending(false)
    }
  }

  if (!isOpen) return null

  const getDisplayName = (c: Contact) => {
    const name = [c.first_name, c.last_name].filter(Boolean).join(' ')
    return name || c.phone
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-zinc-800 rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-700">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">New Message</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Contact Selection */}
          {!selectedContact ? (
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Select Contact
              </label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search contacts..."
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="mt-2 max-h-48 overflow-y-auto border border-zinc-200 dark:border-zinc-700 rounded-lg">
                {filteredContacts.length === 0 ? (
                  <p className="p-3 text-sm text-zinc-500 dark:text-zinc-400 text-center">
                    No contacts found
                  </p>
                ) : (
                  filteredContacts.map((contact) => (
                    <button
                      key={contact.id}
                      onClick={() => setSelectedContact(contact)}
                      className="w-full text-left px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-700 border-b border-zinc-100 dark:border-zinc-700 last:border-0"
                    >
                      <p className="text-sm font-medium text-zinc-900 dark:text-white">
                        {getDisplayName(contact)}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">{contact.phone}</p>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                To
              </label>
              <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-700 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-white">
                    {getDisplayName(selectedContact)}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{selectedContact.phone}</p>
                </div>
                <button
                  onClick={() => setSelectedContact(null)}
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Message Input */}
          {selectedContact && (
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Message
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message..."
                rows={4}
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 text-right">
                {message.length}/1600
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-zinc-200 dark:border-zinc-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={!selectedContact || !message.trim() || isSending}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSending ? 'Sending...' : 'Send Message'}
          </button>
        </div>
      </div>
    </div>
  )
}
