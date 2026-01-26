'use client'

import { useSettings } from '../hooks/useSettings'
import { ProfileSection } from './ProfileSection'
import { CompanySection } from './CompanySection'
import { NotificationsSection } from './NotificationsSection'
import { TeamSection } from './TeamSection'
import type { SettingsData, TeamMember } from '../types'
import { defaultNotificationSettings } from '../types'

interface Props {
  initialSettings: SettingsData
  initialTeamMembers: TeamMember[]
}

export function SettingsPage({ initialSettings, initialTeamMembers }: Props) {
  const {
    settings,
    isLoading,
    error,
    updateProfileData,
    updateCompanyData,
    updateNotificationSettings,
  } = useSettings(initialSettings)

  const notifications = settings.company.settings.notifications || defaultNotificationSettings

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Settings</h1>
        <p className="text-sm text-zinc-500">Manage your account and company preferences</p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <ProfileSection
          profile={settings.profile}
          onSave={updateProfileData}
          isLoading={isLoading}
        />

        <CompanySection
          company={settings.company}
          memberRole={settings.membership.role}
          onSave={updateCompanyData}
          isLoading={isLoading}
        />

        <NotificationsSection
          notifications={notifications}
          onSave={updateNotificationSettings}
          isLoading={isLoading}
        />

        <TeamSection
          initialMembers={initialTeamMembers}
          currentUserId={settings.profile.id}
          memberRole={settings.membership.role}
        />
      </div>
    </div>
  )
}
