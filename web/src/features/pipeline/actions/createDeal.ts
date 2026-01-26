'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { CreateDealInput, Deal } from '../types/deals'

interface CreateDealResult {
  success?: boolean
  data?: Deal
  error?: string
}

export async function createDeal(input: CreateDealInput): Promise<CreateDealResult> {
  const supabase = await createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Get user's company
  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (!membership) return { error: 'No company access' }

  // Validation
  if (!input.title || input.title.trim().length < 2) {
    return { error: 'Title must be at least 2 characters' }
  }

  if (!input.stageId) {
    return { error: 'Stage is required' }
  }

  // Verify stage belongs to user's company
  const { data: stage } = await supabase
    .from('pipeline_stages')
    .select('id')
    .eq('id', input.stageId)
    .eq('company_id', membership.company_id)
    .single()

  if (!stage) return { error: 'Invalid stage' }

  // If contactId provided, verify it belongs to user's company
  if (input.contactId) {
    const { data: contact } = await supabase
      .from('contacts')
      .select('id')
      .eq('id', input.contactId)
      .eq('company_id', membership.company_id)
      .single()

    if (!contact) return { error: 'Invalid contact' }
  }

  // Create deal
  const { data, error } = await supabase
    .from('deals')
    .insert({
      company_id: membership.company_id,
      title: input.title.trim(),
      stage_id: input.stageId,
      contact_id: input.contactId || null,
      value: input.value || 0,
      priority: input.priority || 'warm',
      source: input.source || 'manual',
      expected_close_date: input.expectedCloseDate || null,
      notes: input.notes || null,
      created_by: user.id,
      assigned_to: input.assignedTo || user.id,
    })
    .select(`
      id, company_id, contact_id, stage_id, title, value, priority, source,
      expected_close_date, notes, created_by, assigned_to, closed_at,
      created_at, updated_at,
      contact:contacts(id, first_name, last_name, phone, business_name)
    `)
    .single()

  if (error) {
    console.error('Create deal error:', error)
    return { error: 'Failed to create deal' }
  }

  // Log activity
  await supabase.from('activity_log').insert({
    company_id: membership.company_id,
    user_id: user.id,
    entity_type: 'deal',
    entity_id: data.id,
    action: 'created',
    new_value: { title: input.title, value: input.value },
  })

  revalidatePath('/pipeline')

  // Transform response
  const deal: Deal = {
    id: data.id,
    stageId: data.stage_id,
    contactId: data.contact_id,
    title: data.title,
    value: Number(data.value) || 0,
    priority: data.priority as Deal['priority'],
    source: data.source as Deal['source'],
    expectedCloseDate: data.expected_close_date,
    notes: data.notes,
    createdBy: data.created_by,
    assignedTo: data.assigned_to,
    closedAt: data.closed_at,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    contact: data.contact && data.contact.length > 0
      ? {
          id: data.contact[0].id,
          firstName: data.contact[0].first_name,
          lastName: data.contact[0].last_name,
          phone: data.contact[0].phone,
          businessName: data.contact[0].business_name,
        }
      : null,
  }

  return { success: true, data: deal }
}
