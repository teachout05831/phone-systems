'use client'

import { useState } from 'react'
import { useTeamMembers } from '../hooks/useTeamMembers'
import type { TeamMember, TeamRole } from '../types'

interface Props {
  initialMembers: TeamMember[]
  currentUserId: string
  memberRole: TeamRole
}

export function TeamSection({ initialMembers, currentUserId, memberRole }: Props) {
  const { members, isLoading, error, invite, remove } = useTeamMembers(initialMembers)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<TeamRole>('member')
  const [inviteError, setInviteError] = useState<string | null>(null)

  const canManage = memberRole === 'owner' || memberRole === 'admin'

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviteError(null)

    const success = await invite({ email: inviteEmail, role: inviteRole })

    if (!success && error) {
      setInviteError(error)
    } else if (success) {
      setInviteEmail('')
      setShowInvite(false)
    }
  }

  const handleRemove = async (memberId: string, memberName: string) => {
    if (!confirm(`Are you sure you want to remove ${memberName} from the team?`)) {
      return
    }
    await remove(memberId)
  }

  const getRoleBadgeColor = (role: TeamRole) => {
    switch (role) {
      case 'owner':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
      case 'admin':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
      default:
        return 'bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300'
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Team Members</h2>
        {canManage && (
          <button
            onClick={() => setShowInvite(!showInvite)}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            {showInvite ? 'Cancel' : 'Add Member'}
          </button>
        )}
      </div>

      {showInvite && (
        <form onSubmit={handleInvite} className="mb-4 rounded-md bg-zinc-50 p-4 dark:bg-zinc-700">
          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Email Address
            </label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@company.com"
              required
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
            />
          </div>

          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Role
            </label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as TeamRole)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {(inviteError || error) && (
            <p className="mb-3 text-sm text-red-600">{inviteError || error}</p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? 'Adding...' : 'Add to Team'}
          </button>
        </form>
      )}

      <div className="space-y-3">
        {members.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between rounded-md border border-zinc-200 p-3 dark:border-zinc-700"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-200 text-sm font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                {member.profile.fullName
                  ? member.profile.fullName
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2)
                  : member.profile.email[0].toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-white">
                  {member.profile.fullName || member.profile.email}
                  {member.userId === currentUserId && (
                    <span className="ml-2 text-xs text-zinc-500">(You)</span>
                  )}
                </p>
                <p className="text-sm text-zinc-500">{member.profile.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${getRoleBadgeColor(member.role)}`}
              >
                {member.role}
              </span>
              {canManage && member.role !== 'owner' && member.userId !== currentUserId && (
                <button
                  onClick={() =>
                    handleRemove(member.id, member.profile.fullName || member.profile.email)
                  }
                  disabled={isLoading}
                  className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-700"
                  title="Remove member"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>
        ))}

        {members.length === 0 && (
          <p className="py-4 text-center text-sm text-zinc-500">No team members yet</p>
        )}
      </div>
    </div>
  )
}
