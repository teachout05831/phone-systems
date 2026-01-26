'use server'

import { createClient } from '@/lib/supabase/server'
import type { UpdateCompanyInput } from '../types'

interface ActionResult {
  success?: boolean
  error?: string
}

export async function updateCompany(input: UpdateCompanyInput): Promise<ActionResult> {
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
    return { error: 'Only owners and admins can update company settings' }
  }

  // Step 3: Validate input shape
  if (!input || typeof input !== 'object') {
    return { error: 'Invalid input' }
  }

  // Step 4: Validate field values
  if (input.name !== undefined) {
    if (typeof input.name !== 'string') {
      return { error: 'Company name must be a string' }
    }
    if (input.name.trim().length < 2) {
      return { error: 'Company name must be at least 2 characters' }
    }
    if (input.name.length > 100) {
      return { error: 'Company name must be less than 100 characters' }
    }
  }

  if (input.timezone !== undefined) {
    if (typeof input.timezone !== 'string') {
      return { error: 'Timezone must be a string' }
    }
  }

  // Step 5: Get current company data
  const { data: company } = await supabase
    .from('companies')
    .select('settings')
    .eq('id', membership.company_id)
    .single()

  if (!company) return { error: 'Company not found' }

  // Step 6: Build update object
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (input.name !== undefined) {
    updates.name = input.name.trim()
  }

  if (input.timezone !== undefined) {
    const currentSettings = (company.settings || {}) as Record<string, unknown>
    updates.settings = {
      ...currentSettings,
      timezone: input.timezone,
    }
  }

  // Step 7: Update company
  const { error } = await supabase
    .from('companies')
    .update(updates)
    .eq('id', membership.company_id)

  if (error) {
    console.error('Update company error:', error)
    return { error: 'Failed to update company' }
  }

  return { success: true }
}
