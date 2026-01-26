import { getSettings } from '@/features/settings/queries'
import { getTeamMembers } from '@/features/settings/queries'
import { SettingsPage } from '@/features/settings'

export default async function Settings() {
  const [settings, teamMembers] = await Promise.all([
    getSettings(),
    getTeamMembers(),
  ])

  return <SettingsPage initialSettings={settings} initialTeamMembers={teamMembers} />
}
