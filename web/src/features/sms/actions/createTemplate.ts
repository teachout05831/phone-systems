'use server'

import { createClient } from '@/lib/supabase/server'
import type { CreateTemplateInput, SMSTemplate } from '../types'
import { toSMSTemplate } from '../types'

interface ActionResult {
  success?: boolean
  error?: string
  template?: SMSTemplate
}

export async function createTemplate(
  input: CreateTemplateInput
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

  // Step 4: Validate required fields
  if (!input.name || input.name.trim().length === 0) {
    return { error: 'Template name is required' }
  }

  if (!input.body || input.body.trim().length === 0) {
    return { error: 'Template body is required' }
  }

  // Step 5: Validate values
  if (input.name.length > 100) {
    return { error: 'Name must be less than 100 characters' }
  }

  if (input.body.length > 1600) {
    return { error: 'Body must be less than 1600 characters' }
  }

  // Step 6: Check for duplicate name
  const { data: existing } = await supabase
    .from('sms_templates')
    .select('id')
    .eq('company_id', membership.company_id)
    .eq('name', input.name.trim())
    .single()

  if (existing) {
    return { error: 'A template with this name already exists' }
  }

  // Step 7: Create template
  const { data: template, error: insertError } = await supabase
    .from('sms_templates')
    .insert({
      company_id: membership.company_id,
      name: input.name.trim(),
      body: input.body.trim(),
      category: input.category || 'general',
    })
    .select()
    .single()

  if (insertError || !template) {
    return { error: 'Failed to create template' }
  }

  return { success: true, template: toSMSTemplate(template) }
}
