'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { refreshMonitor, fetchTranscript, endAICall } from '../actions'
import type { UseAgentMonitorProps, UseAgentMonitorReturn, AICall, TranscriptSegment } from '../types'

export function useAgentMonitor({
  initialCalls,
  pollingInterval = 5000,
}: UseAgentMonitorProps): UseAgentMonitorReturn {
  const [calls, setCalls] = useState<AICall[]>(initialCalls)
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null)
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isLoadingTranscript, setIsLoadingTranscript] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const selectedCall = calls.find((c) => c.id === selectedCallId) || null

  const refresh = useCallback(async () => {
    setIsRefreshing(true)
    setError(null)
    try {
      const result = await refreshMonitor()
      if (result.error) setError(result.error)
      else if (result.calls) setCalls(result.calls)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh')
    } finally {
      setIsRefreshing(false)
    }
  }, [])

  const selectCall = useCallback(async (callId: string) => {
    setSelectedCallId(callId)
    setIsLoadingTranscript(true)
    try {
      const result = await fetchTranscript(callId)
      if (result.transcript) setTranscript(result.transcript)
    } catch {
      setTranscript([])
    } finally {
      setIsLoadingTranscript(false)
    }
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedCallId(null)
    setTranscript([])
  }, [])

  const handleEndCall = useCallback(async (callId: string) => {
    const result = await endAICall(callId)
    if (result.success) {
      await refresh()
      if (selectedCallId === callId) clearSelection()
    }
    return result
  }, [refresh, selectedCallId, clearSelection])

  // Update durations every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCalls((prev) => prev.map((call) => ({ ...call, durationSeconds: call.durationSeconds + 1 })))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Poll for updates
  useEffect(() => {
    intervalRef.current = setInterval(refresh, pollingInterval)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [refresh, pollingInterval])

  return {
    calls, selectedCall, transcript, isRefreshing, isLoadingTranscript,
    error, selectCall, clearSelection, endCall: handleEndCall, refresh,
  }
}
