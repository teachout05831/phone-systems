import { createClient } from '@/lib/supabase/server'
import type { UserRole, UserRoleResult } from '../types'

export async function getUserRole(): Promise<UserRoleResult> {
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { role: null, hasAccess: false }

  // Get user's profile role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile) return { role: null, hasAccess: false }

  const role = profile.role as UserRole
  const hasAccess = role === 'admin' || role === 'manager'

  return { role, hasAccess }
}
