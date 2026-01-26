'use server'

import { createClient } from '@/lib/supabase/server'
import type { InviteTeamMemberInput } from '../types'

interface ActionResult {
  success?: boolean
  error?: string
}

export async function inviteTeamMember(
  input: InviteTeamMemberInput
): Promise<ActionResult> {
  const supabase = await createClient()

  // Step 1: Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Step 2: Get company membership and verify admin role
  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (!membership) return { error: 'No company access' }

  if (membership.role !== 'owner' && membership.role !== 'admin') {
    return { error: 'Only owners and admins can invite team members' }
  }

  // Step 3: Validate input shape
  if (!input || typeof input !== 'object') {
    return { error: 'Invalid input' }
  }

  // Step 4: Validate email
  if (!input.email || typeof input.email !== 'string') {
    return { error: 'Email is required' }
  }

  // Normalize email to lowercase for consistent matching
  const normalizedEmail = input.email.trim().toLowerCase()

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(normalizedEmail)) {
    return { error: 'Invalid email format' }
  }

  if (normalizedEmail.length > 255) {
    return { error: 'Email must be less than 255 characters' }
  }

  // Step 5: Validate role
  const validRoles = ['admin', 'member']
  if (!input.role || !validRoles.includes(input.role)) {
    return { error: 'Role must be admin or member' }
  }

  // Prevent inviting as owner
  if (input.role === 'owner') {
    return { error: 'Cannot invite as owner' }
  }

  // Step 6: Check if user already exists
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', normalizedEmail)
    .single()

  if (existingProfile) {
    // Check if already a member
    const { data: existingMember } = await supabase
      .from('company_members')
      .select('id')
      .eq('company_id', membership.company_id)
      .eq('user_id', existingProfile.id)
      .single()

    if (existingMember) {
      return { error: 'User is already a team member' }
    }

    // Add existing user to company
    const { error: addError } = await supabase
      .from('company_members')
      .insert({
        company_id: membership.company_id,
        user_id: existingProfile.id,
        role: input.role,
      })

    if (addError) {
      console.error('Add member error:', addError)
      return { error: 'Failed to add team member' }
    }

    return { success: true }
  }

  // Step 7: For new users, we would typically send an invite email
  // For now, return an error indicating the user needs to sign up first
  // In a production app, you would integrate with an email service here
  return { error: 'User not found. They must sign up first, then you can add them.' }
}
