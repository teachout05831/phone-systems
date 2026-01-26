'use client'

import { useState, useEffect, useCallback } from 'react'
import type { QAIssue, QAIssuesFilters, QAStats, QAIssueStatus } from '../types'

const DEFAULT_FILTERS: Partial<QAIssuesFilters> = {
  status: 'all',
  issueType: 'all',
  severity: 'all',
  search: '',
}

export function useQADashboard() {
  const [issues, setIssues] = useState<QAIssue[]>([])
  const [stats, setStats] = useState<QAStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [selectedIssue, setSelectedIssue] = useState<QAIssue | null>(null)

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/qa?stats=true')
      if (response.ok) setStats(await response.json())
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }, [])

  const fetchIssues = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: page.toString() })
      if (filters.status && filters.status !== 'all') params.set('status', filters.status)
      if (filters.issueType && filters.issueType !== 'all') params.set('issueType', filters.issueType)
      if (filters.severity && filters.severity !== 'all') params.set('severity', filters.severity)
      if (filters.search) params.set('search', filters.search)

      const response = await fetch(`/api/qa?${params}`)
      if (response.ok) {
        const data = await response.json()
        setIssues(data.issues)
        setTotalPages(data.totalPages)
      }
    } catch (error) {
      console.error('Error fetching issues:', error)
    } finally {
      setLoading(false)
    }
  }, [page, filters])

  const updateStatus = useCallback(async (issueId: string, status: QAIssueStatus) => {
    try {
      const response = await fetch(`/api/qa/${issueId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (response.ok) {
        fetchIssues()
        fetchStats()
        setSelectedIssue(null)
      }
    } catch (error) {
      console.error('Error updating issue:', error)
    }
  }, [fetchIssues, fetchStats])

  const refresh = useCallback(() => {
    fetchIssues()
    fetchStats()
  }, [fetchIssues, fetchStats])

  const updateFilters = useCallback((newFilters: Partial<QAIssuesFilters>) => {
    setFilters(f => ({ ...f, ...newFilters }))
    setPage(1)
  }, [])

  useEffect(() => { fetchStats() }, [fetchStats])
  useEffect(() => { fetchIssues() }, [fetchIssues])

  return {
    issues,
    stats,
    loading,
    page,
    totalPages,
    filters,
    selectedIssue,
    setPage,
    setSelectedIssue,
    updateFilters,
    updateStatus,
    refresh,
  }
}
