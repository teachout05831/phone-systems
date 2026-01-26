'use server'

import { createClient } from '@/lib/supabase/server'
import type { UpdateNotificationsInput } from '../types'

interface ActionResult {
  success?: boolean
  error?: string
}

export async function updateNotifications(
  input: UpdateNotificationsInput
): Promise<ActionResult> {
  const supabase = await createClient()

  // Step 1: Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Step 2: Get company membership
  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (!membership) return { error: 'No company access' }

  // Step 3: Validate input shape
  if (!input || typeof input !== 'object') {
    return { error: 'Invalid input' }
  }

  // Step 4: Validate field values (all should be booleans)
  const booleanFields = ['emailEnabled', 'smsEnabled', 'callReminders', 'dailyDigest']
  for (const field of booleanFields) {
    const value = input[field as keyof UpdateNotificationsInput]
    if (value !== undefined && typeof value !== 'boolean') {
      return { error: `${field} must be a boolean` }
    }
  }

  // Step 5: Get current company settings
  const { data: company } = await supabase
    .from('companies')
    .select('settings')
    .eq('id', membership.company_id)
    .single()

  if (!company) return { error: 'Company not found' }

  // Step 6: Merge notification settings
  const currentSettings = (company.settings || {}) as Record<string, unknown>
  const currentNotifications = (currentSettings.notifications || {}) as Record<string, boolean>

  const newNotifications = {
    emailEnabled: input.emailEnabled ?? currentNotifications.emailEnabled ?? true,
    smsEnabled: input.smsEnabled ?? currentNotifications.smsEnabled ?? true,
    callReminders: input.callReminders ?? currentNotifications.callReminders ?? true,
    dailyDigest: input.dailyDigest ?? currentNotifications.dailyDigest ?? false,
  }

  // Step 7: Update company settings
  const { error } = await supabase
    .from('companies')
    .update({
      settings: {
        ...currentSettings,
        notifications: newNotifications,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', membership.company_id)

  if (error) {
    console.error('Update notifications error:', error)
    return { error: 'Failed to update notifications' }
  }

  return { success: true }
}
