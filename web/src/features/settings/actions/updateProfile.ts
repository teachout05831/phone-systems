'use server'

import { createClient } from '@/lib/supabase/server'
import type { UpdateProfileInput } from '../types'

interface ActionResult {
  success?: boolean
  error?: string
}

export async function updateProfile(input: UpdateProfileInput): Promise<ActionResult> {
  const supabase = await createClient()

  // Step 1: Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Step 2: Validate input shape
  if (!input || typeof input !== 'object') {
    return { error: 'Invalid input' }
  }

  // Step 3: Validate field values
  if (input.fullName !== undefined) {
    if (typeof input.fullName !== 'string') {
      return { error: 'Full name must be a string' }
    }
    if (input.fullName.length > 100) {
      return { error: 'Full name must be less than 100 characters' }
    }
  }

  if (input.phoneNumber !== undefined) {
    if (typeof input.phoneNumber !== 'string') {
      return { error: 'Phone number must be a string' }
    }
    if (input.phoneNumber.length > 20) {
      return { error: 'Phone number must be less than 20 characters' }
    }
    // Validate phone contains only digits, spaces, dashes, parentheses, and plus
    if (input.phoneNumber.trim() && !/^[+\d\s()-]+$/.test(input.phoneNumber)) {
      return { error: 'Phone number contains invalid characters' }
    }
  }

  if (input.avatarUrl !== undefined) {
    if (typeof input.avatarUrl !== 'string') {
      return { error: 'Avatar URL must be a string' }
    }
    if (input.avatarUrl.length > 500) {
      return { error: 'Avatar URL must be less than 500 characters' }
    }
    // Security: Only allow https URLs to prevent XSS via javascript: protocol
    if (input.avatarUrl.trim() && !input.avatarUrl.trim().startsWith('https://')) {
      return { error: 'Avatar URL must use HTTPS' }
    }
  }

  // Step 4: Build update object
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (input.fullName !== undefined) {
    updates.full_name = input.fullName.trim() || null
  }
  if (input.phoneNumber !== undefined) {
    updates.phone_number = input.phoneNumber.trim() || null
  }
  if (input.avatarUrl !== undefined) {
    updates.avatar_url = input.avatarUrl.trim() || null
  }

  // Step 5: Update profile
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)

  if (error) {
    console.error('Update profile error:', error)
    return { error: 'Failed to update profile' }
  }

  return { success: true }
}
