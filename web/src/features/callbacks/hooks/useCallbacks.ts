'use client'

import { useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Callback } from '../types'

type FilterType = 'pending' | 'all' | 'completed'

const CALLBACK_SELECT = `id, scheduled_at, status, priority, reason, notes, attempt_count, max_attempts, assigned_to, contact:contacts!contact_id(id, first_name, last_name, phone, business_name), assigned_to_profile:profiles!assigned_to(id, full_name)`

export function useCallbacks(initialCallbacks: Callback[], initialFilter: FilterType = 'pending') {
  const [callbacks, setCallbacks] = useState<Callback[]>(initialCallbacks)
  const [filter, setFilter] = useState<FilterType>(initialFilter)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchCallbacks = useCallback(async (currentFilter: FilterType) => {
    setIsLoading(true)
    setError(null)
    const supabase = createClient()

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data: membership } = await supabase
        .from('company_members').select('company_id').eq('user_id', user.id).limit(1).single()
      if (!membership) { setCallbacks([]); return }

      let query = supabase.from('callbacks').select(CALLBACK_SELECT)
        .eq('company_id', membership.company_id).order('scheduled_at', { ascending: true })

      if (currentFilter === 'pending') query = query.in('status', ['scheduled', 'pending', 'rescheduled'])
      else if (currentFilter === 'completed') query = query.in('status', ['completed', 'cancelled', 'exhausted'])

      const { data, error: queryError } = await query.limit(50)
      if (queryError) throw queryError
      setCallbacks(data as unknown as Callback[])
    } catch {
      setError('Failed to load callbacks')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const changeFilter = useCallback(async (newFilter: FilterType) => {
    setFilter(newFilter)
    await fetchCallbacks(newFilter)
  }, [fetchCallbacks])

  const refresh = useCallback(() => fetchCallbacks(filter), [fetchCallbacks, filter])

  const { overdueCallbacks, upcomingCallbacks } = useMemo(() => {
    const now = new Date()
    const completed = ['completed', 'cancelled', 'exhausted']
    return {
      overdueCallbacks: callbacks.filter(c => new Date(c.scheduled_at) < now && !completed.includes(c.status)),
      upcomingCallbacks: callbacks.filter(c => new Date(c.scheduled_at) >= now || completed.includes(c.status)),
    }
  }, [callbacks])

  return { callbacks, overdueCallbacks, upcomingCallbacks, filter, isLoading, error, changeFilter, refresh }
}
