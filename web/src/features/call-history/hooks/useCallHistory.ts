'use client'

import { useState, useCallback } from 'react'
import type {
  CallRecord,
  CallHistoryFilters,
  CallHistoryResponse,
  CallDetails
} from '../types'

const DEFAULT_FILTERS: CallHistoryFilters = {
  date: 'all',
  status: 'all',
  outcome: 'all',
  search: '',
  sort: 'newest'
}

interface UseCallHistoryProps {
  initialData: CallHistoryResponse
}

export function useCallHistory({ initialData }: UseCallHistoryProps) {
  const [calls, setCalls] = useState<CallRecord[]>(initialData.calls)
  const [total, setTotal] = useState(initialData.total)
  const [page, setPage] = useState(initialData.page)
  const [totalPages, setTotalPages] = useState(initialData.totalPages)
  const [filters, setFilters] = useState<CallHistoryFilters>(DEFAULT_FILTERS)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedCall, setSelectedCall] = useState<CallDetails | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const fetchCalls = useCallback(async (newFilters: CallHistoryFilters, newPage: number) => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(newPage),
        date: newFilters.date,
        status: newFilters.status,
        outcome: newFilters.outcome,
        sort: newFilters.sort,
        ...(newFilters.search && { search: newFilters.search })
      })

      const res = await fetch(`/api/call-history?${params}`)
      if (!res.ok) throw new Error('Failed to fetch')

      const data: CallHistoryResponse = await res.json()
      setCalls(data.calls)
      setTotal(data.total)
      setPage(data.page)
      setTotalPages(data.totalPages)
    } catch (error) {
      console.error('Error fetching calls:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const applyFilters = useCallback((newFilters: Partial<CallHistoryFilters>) => {
    const updated = { ...filters, ...newFilters }
    setFilters(updated)
    fetchCalls(updated, 1)
  }, [filters, fetchCalls])

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS)
    fetchCalls(DEFAULT_FILTERS, 1)
  }, [fetchCalls])

  const goToPage = useCallback((newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return
    fetchCalls(filters, newPage)
  }, [filters, totalPages, fetchCalls])

  const openCallDetail = useCallback(async (callId: string) => {
    try {
      const res = await fetch(`/api/call-history/${callId}`)
      if (!res.ok) throw new Error('Failed to fetch call details')

      const data: CallDetails = await res.json()
      setSelectedCall(data)
      setIsModalOpen(true)
    } catch (error) {
      console.error('Error fetching call details:', error)
    }
  }, [])

  const closeModal = useCallback(() => {
    setIsModalOpen(false)
    setSelectedCall(null)
  }, [])

  return {
    calls,
    total,
    page,
    totalPages,
    filters,
    isLoading,
    selectedCall,
    isModalOpen,
    applyFilters,
    clearFilters,
    goToPage,
    openCallDetail,
    closeModal
  }
}
