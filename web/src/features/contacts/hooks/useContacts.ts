'use client'

import { useState, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteContact, bulkDeleteContacts } from '../actions/deleteContact'
import { createContact } from '../actions/createContact'
import { updateContact } from '../actions/updateContact'
import type { Contact, CreateContactInput, UpdateContactInput } from '../types'

interface UseContactsOptions {
  initialContacts: Contact[]
  initialCount?: number
}

export function useContacts({ initialContacts, initialCount = 0 }: UseContactsOptions) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [contacts, setContacts] = useState<Contact[]>(initialContacts)
  const [totalCount, setTotalCount] = useState(initialCount)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    startTransition(() => {
      router.refresh()
    })
  }, [router])

  const handleCreate = useCallback(async (input: CreateContactInput) => {
    setError(null)
    const result = await createContact(input)
    if (result.error) {
      setError(result.error)
      return { success: false, error: result.error }
    }
    refresh()
    return { success: true, data: result.data }
  }, [refresh])

  const handleUpdate = useCallback(async (id: string, input: UpdateContactInput) => {
    setError(null)
    const result = await updateContact(id, input)
    if (result.error) {
      setError(result.error)
      return { success: false, error: result.error }
    }
    refresh()
    return { success: true, data: result.data }
  }, [refresh])

  const handleDelete = useCallback(async (id: string) => {
    setError(null)
    const result = await deleteContact(id)
    if (result.error) {
      setError(result.error)
      return { success: false, error: result.error }
    }
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    refresh()
    return { success: true }
  }, [refresh])

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return { success: false, error: 'No contacts selected' }

    setError(null)
    const result = await bulkDeleteContacts(Array.from(selectedIds))
    if (result.error) {
      setError(result.error)
      return { success: false, error: result.error }
    }
    setSelectedIds(new Set())
    refresh()
    return { success: true }
  }, [selectedIds, refresh])

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(prev => {
      if (prev.size === contacts.length) {
        return new Set()
      }
      return new Set(contacts.map(c => c.id))
    })
  }, [contacts])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  return {
    contacts,
    totalCount,
    selectedIds,
    isLoading: isPending,
    error,
    refresh,
    handleCreate,
    handleUpdate,
    handleDelete,
    handleBulkDelete,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
    isAllSelected: selectedIds.size === contacts.length && contacts.length > 0,
    hasSelection: selectedIds.size > 0,
  }
}
