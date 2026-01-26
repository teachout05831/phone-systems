'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AICall, AISummary } from '../types'

interface UseActiveCallsProps {
  initialCalls: AICall[]
}

interface UseActiveCallsReturn {
  calls: AICall[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useActiveCalls({ initialCalls }: UseActiveCallsProps): UseActiveCallsReturn {
  const [calls, setCalls] = useState<AICall[]>(initialCalls)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Manual refresh function
  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    const supabase = createClient()

    try {
      // Get user's company
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Not authenticated')
        return
      }

      const { data: membership } = await supabase
        .from('company_members')
        .select('company_id')
        .eq('user_id', user.id)
        .limit(1)
        .single()

      if (!membership) {
        setError('No company access')
        return
      }

      // Fetch active AI calls
      const { data, error: fetchError } = await supabase
        .from('calls')
        .select(`
          id, contact_id, phone_number, agent_id, status, started_at, ai_summary,
          contacts (id, first_name, last_name),
          agents (id, name)
        `)
        .eq('company_id', membership.company_id)
        .not('agent_id', 'is', null)
        .in('status', ['ringing', 'in_progress'])
        .order('started_at', { ascending: false })
        .limit(20)

      if (fetchError) throw fetchError

      const now = new Date()
      const transformedCalls: AICall[] = (data || []).map((call) => {
        const contactData = call.contacts as unknown
        const contact = Array.isArray(contactData) ? contactData[0] : contactData
        const agentData = call.agents as unknown
        const agent = Array.isArray(agentData) ? agentData[0] : agentData

        const startedAt = new Date(call.started_at)
        const durationSeconds = Math.floor((now.getTime() - startedAt.getTime()) / 1000)

        const contactName = contact
          ? `${(contact as { first_name?: string }).first_name || ''} ${(contact as { last_name?: string }).last_name || ''}`.trim() || 'Unknown'
          : 'Unknown Contact'

        const agentName = (agent as { name?: string })?.name || 'AI Agent'

        return {
          id: call.id,
          contactId: call.contact_id,
          contactName,
          phoneNumber: call.phone_number || '',
          agentId: call.agent_id || '',
          agentName,
          status: call.status as AICall['status'],
          startedAt: call.started_at,
          durationSeconds,
          aiSummary: call.ai_summary as AISummary | null,
        }
      })

      setCalls(transformedCalls)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch calls')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Set up Supabase real-time subscription
  useEffect(() => {
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null

    async function setupSubscription() {
      // Get user's company for filtering
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: membership } = await supabase
        .from('company_members')
        .select('company_id')
        .eq('user_id', user.id)
        .limit(1)
        .single()

      if (!membership) return

      // Subscribe to calls table changes for this company
      channel = supabase
        .channel('active-ai-calls')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'calls',
            filter: `company_id=eq.${membership.company_id}`,
          },
          async (payload) => {
            // When a call changes, refresh the full list
            // This ensures we have consistent data with joins
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              await refresh()
            } else if (payload.eventType === 'DELETE') {
              // Remove from local state immediately for snappier UX
              setCalls((prev) => prev.filter((c) => c.id !== payload.old.id))
            }
          }
        )
        .subscribe()
    }

    setupSubscription()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [refresh])

  // Update durations every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCalls((prev) =>
        prev.map((call) => ({
          ...call,
          durationSeconds: call.durationSeconds + 1,
        }))
      )
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  return { calls, isLoading, error, refresh }
}
