'use client'

import { useState, useCallback, useTransition } from 'react'
import type { ContactsByStatus, PipelineStatus } from '../types'
import { updateContactStatus } from '../actions/updateContactStatus'

interface UsePipelineProps {
  initialContacts: ContactsByStatus
}

interface UsePipelineReturn {
  contacts: ContactsByStatus
  counts: Record<PipelineStatus, number>
  moveContact: (contactId: string, from: PipelineStatus, to: PipelineStatus) => void
  isUpdating: boolean
  error: string | null
  clearError: () => void
}

export function usePipeline({ initialContacts }: UsePipelineProps): UsePipelineReturn {
  const [contacts, setContacts] = useState(initialContacts)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Calculate counts from current contacts state
  const counts = {
    new: contacts.new.length,
    contacted: contacts.contacted.length,
    engaged: contacts.engaged.length,
    qualified: contacts.qualified.length,
    closed_won: contacts.closed_won.length,
    closed_lost: contacts.closed_lost.length,
  }

  const moveContact = useCallback(
    (contactId: string, from: PipelineStatus, to: PipelineStatus) => {
      if (from === to) return

      // Find the contact in source column
      const contact = contacts[from].find((c) => c.id === contactId)
      if (!contact) return

      // Optimistic update: move immediately for smooth UX
      setContacts((prev) => ({
        ...prev,
        [from]: prev[from].filter((c) => c.id !== contactId),
        [to]: [{ ...contact, status: to }, ...prev[to]],
      }))

      // Server update in transition (non-blocking)
      startTransition(async () => {
        const result = await updateContactStatus(contactId, to)

        if (result.error) {
          // Revert on error
          setContacts((prev) => ({
            ...prev,
            [from]: [contact, ...prev[from]],
            [to]: prev[to].filter((c) => c.id !== contactId),
          }))
          setError(result.error)
        }
      })
    },
    [contacts]
  )

  const clearError = useCallback(() => setError(null), [])

  return {
    contacts,
    counts,
    moveContact,
    isUpdating: isPending,
    error,
    clearError,
  }
}
