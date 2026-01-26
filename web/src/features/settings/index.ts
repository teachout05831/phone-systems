// Queries
export { getSettings, getTeamMembers } from './queries'

// Actions
export { updateProfile } from './actions/updateProfile'
export { updateCompany } from './actions/updateCompany'
export { updateNotifications } from './actions/updateNotifications'
export { inviteTeamMember } from './actions/inviteTeamMember'
export { removeTeamMember } from './actions/removeTeamMember'

// Hooks
export { useSettings, useTeamMembers } from './hooks'

// Components
export { SettingsPage } from './components'

// Types
export type {
  UserProfile,
  Company,
  TeamMember,
  SettingsData,
  NotificationSettings,
  UpdateProfileInput,
  UpdateCompanyInput,
  UpdateNotificationsInput,
  InviteTeamMemberInput,
} from './types'
