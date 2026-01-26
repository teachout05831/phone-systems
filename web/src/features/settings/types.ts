// User Profile
export interface UserProfile {
  id: string
  email: string
  fullName: string | null
  avatarUrl: string | null
  role: UserRole
  phoneNumber: string | null
  createdAt: string
  updatedAt: string
}

export type UserRole = 'admin' | 'manager' | 'rep' | 'closer'

// Company
export interface Company {
  id: string
  name: string
  slug: string
  settings: CompanySettings
  createdAt: string
  updatedAt: string
}

export interface CompanySettings {
  timezone?: string
  notifications?: NotificationSettings
}

export interface NotificationSettings {
  emailEnabled: boolean
  smsEnabled: boolean
  callReminders: boolean
  dailyDigest: boolean
}

// Team Member
export interface TeamMember {
  id: string
  userId: string
  companyId: string
  role: TeamRole
  createdAt: string
  profile: {
    id: string
    email: string
    fullName: string | null
    avatarUrl: string | null
  }
}

export type TeamRole = 'owner' | 'admin' | 'member'

// Settings Data (combined for queries)
export interface SettingsData {
  profile: UserProfile
  company: Company
  membership: {
    role: TeamRole
  }
}

// Input types for actions
export interface UpdateProfileInput {
  fullName?: string
  phoneNumber?: string
  avatarUrl?: string
}

export interface UpdateCompanyInput {
  name?: string
  timezone?: string
}

export interface UpdateNotificationsInput {
  emailEnabled?: boolean
  smsEnabled?: boolean
  callReminders?: boolean
  dailyDigest?: boolean
}

export interface InviteTeamMemberInput {
  email: string
  role: TeamRole
}

// Database row types (snake_case from Supabase)
export interface ProfileRow {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: string
  phone_number: string | null
  created_at: string
  updated_at: string
}

export interface CompanyRow {
  id: string
  name: string
  slug: string
  settings: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CompanyMemberRow {
  id: string
  company_id: string
  user_id: string
  role: string
  created_at: string
}

// Transform functions
export function toUserProfile(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    avatarUrl: row.avatar_url,
    role: row.role as UserRole,
    phoneNumber: row.phone_number,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toCompany(row: CompanyRow): Company {
  const settings = row.settings as Record<string, unknown>
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    settings: {
      timezone: settings.timezone as string | undefined,
      notifications: settings.notifications as NotificationSettings | undefined,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toTeamMember(
  row: CompanyMemberRow & { profiles: ProfileRow }
): TeamMember {
  return {
    id: row.id,
    userId: row.user_id,
    companyId: row.company_id,
    role: row.role as TeamRole,
    createdAt: row.created_at,
    profile: {
      id: row.profiles.id,
      email: row.profiles.email,
      fullName: row.profiles.full_name,
      avatarUrl: row.profiles.avatar_url,
    },
  }
}

// Default notification settings
export const defaultNotificationSettings: NotificationSettings = {
  emailEnabled: true,
  smsEnabled: true,
  callReminders: true,
  dailyDigest: false,
}
