'use client'

import { useState, useCallback } from 'react'
import { inviteTeamMember } from '../actions/inviteTeamMember'
import { removeTeamMember } from '../actions/removeTeamMember'
import type { TeamMember, InviteTeamMemberInput } from '../types'

interface UseTeamMembersReturn {
  members: TeamMember[]
  isLoading: boolean
  error: string | null
  invite: (input: InviteTeamMemberInput) => Promise<boolean>
  remove: (memberId: string) => Promise<boolean>
}

export function useTeamMembers(initialMembers: TeamMember[]): UseTeamMembersReturn {
  const [members, setMembers] = useState(initialMembers)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const invite = useCallback(async (input: InviteTeamMemberInput): Promise<boolean> => {
    setIsLoading(true)
    setError(null)

    const result = await inviteTeamMember(input)

    if (result.error) {
      setError(result.error)
      setIsLoading(false)
      return false
    }

    // Reload page to get fresh member list
    // In production, you might want to fetch updated list
    window.location.reload()
    return true
  }, [])

  const remove = useCallback(async (memberId: string): Promise<boolean> => {
    setIsLoading(true)
    setError(null)

    const result = await removeTeamMember(memberId)

    if (result.error) {
      setError(result.error)
      setIsLoading(false)
      return false
    }

    // Optimistically remove from local state
    setMembers((prev) => prev.filter((m) => m.id !== memberId))

    setIsLoading(false)
    return true
  }, [])

  return {
    members,
    isLoading,
    error,
    invite,
    remove,
  }
}
