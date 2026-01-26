import { createClient } from '@/lib/supabase/server'
import type { TeamMember } from '../types'

export async function getTeamMembers(): Promise<TeamMember[]> {
  const supabase = await createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Get user's company
  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (!membership) throw new Error('No company access')

  // Get all team members with their profiles
  const { data, error } = await supabase
    .from('company_members')
    .select(`
      id, company_id, user_id, role, created_at,
      profiles (id, email, full_name, avatar_url)
    `)
    .eq('company_id', membership.company_id)
    .order('created_at', { ascending: true })
    .limit(50)

  if (error) throw error

  return (data || []).map((row) => {
    const profileData = row.profiles as unknown as {
      id: string
      email: string
      full_name: string | null
      avatar_url: string | null
    }

    return {
      id: row.id,
      userId: row.user_id,
      companyId: row.company_id,
      role: row.role as TeamMember['role'],
      createdAt: row.created_at,
      profile: {
        id: profileData.id,
        email: profileData.email,
        fullName: profileData.full_name,
        avatarUrl: profileData.avatar_url,
      },
    }
  })
}
