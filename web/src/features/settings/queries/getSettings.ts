import { createClient } from '@/lib/supabase/server'
import type { SettingsData } from '../types'
import { toUserProfile, toCompany, defaultNotificationSettings } from '../types'

export async function getSettings(): Promise<SettingsData> {
  const supabase = await createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Get profile
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, full_name, avatar_url, role, phone_number, created_at, updated_at')
    .eq('id', user.id)
    .single()

  if (profileError) throw profileError
  if (!profileData) throw new Error('Profile not found')

  // Get company membership
  const { data: membershipData, error: membershipError } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (membershipError) throw membershipError
  if (!membershipData) throw new Error('No company access')

  // Get company
  const { data: companyData, error: companyError } = await supabase
    .from('companies')
    .select('id, name, slug, settings, created_at, updated_at')
    .eq('id', membershipData.company_id)
    .single()

  if (companyError) throw companyError
  if (!companyData) throw new Error('Company not found')

  const profile = toUserProfile(profileData)
  const company = toCompany(companyData)

  // Ensure notification settings have defaults
  if (!company.settings.notifications) {
    company.settings.notifications = defaultNotificationSettings
  }

  return {
    profile,
    company,
    membership: {
      role: membershipData.role as SettingsData['membership']['role'],
    },
  }
}
