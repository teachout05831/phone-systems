'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { UpdateContactInput, Contact, ContactRow } from '../types'
import { transformContact } from '../types'

interface UpdateContactResult {
  success?: boolean
  data?: Contact
  error?: string
}

export async function updateContact(
  id: string,
  input: UpdateContactInput
): Promise<UpdateContactResult> {
  const supabase = await createClient()

  // SECURITY: Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // VALIDATION: ID is required
  if (!id) return { error: 'Contact ID is required' }

  // Get user's company
  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (!membership) return { error: 'No company found' }

  // SECURITY: Ownership check - verify contact belongs to user's company
  const { data: existing } = await supabase
    .from('contacts')
    .select('id, company_id')
    .eq('id', id)
    .single()

  if (!existing) return { error: 'Contact not found' }
  if (existing.company_id !== membership.company_id) {
    return { error: 'Not authorized' }
  }

  // VALIDATION: Phone format if provided
  if (input.phone) {
    const phoneClean = input.phone.replace(/\D/g, '')
    if (phoneClean.length < 10) {
      return { error: 'Phone number must have at least 10 digits' }
    }
  }

  // VALIDATION: Email format if provided
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    return { error: 'Invalid email format' }
  }

  // Build update object with only provided fields
  const updateData: Record<string, unknown> = {}

  if (input.firstName !== undefined) updateData.first_name = input.firstName?.trim() || null
  if (input.lastName !== undefined) updateData.last_name = input.lastName?.trim() || null
  if (input.phone !== undefined) updateData.phone = input.phone.trim()
  if (input.phoneSecondary !== undefined) updateData.phone_secondary = input.phoneSecondary?.trim() || null
  if (input.email !== undefined) updateData.email = input.email?.trim().toLowerCase() || null
  if (input.businessName !== undefined) updateData.business_name = input.businessName?.trim() || null
  if (input.jobTitle !== undefined) updateData.job_title = input.jobTitle?.trim() || null
  if (input.website !== undefined) updateData.website = input.website?.trim() || null
  if (input.source !== undefined) updateData.source = input.source
  if (input.status !== undefined) updateData.status = input.status
  if (input.notes !== undefined) updateData.notes = input.notes?.trim() || null
  if (input.tags !== undefined) updateData.tags = input.tags
  if (input.assignedTo !== undefined) updateData.assigned_to = input.assignedTo

  updateData.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('contacts')
    .update(updateData)
    .eq('id', id)
    .select('id, first_name, last_name, phone, phone_secondary, email, business_name, job_title, website, source, status, notes, tags, company_id, created_by, assigned_to, created_at, updated_at')
    .single()

  if (error) {
    console.error('Error updating contact:', error)
    return { error: 'Failed to update contact' }
  }

  revalidatePath('/contacts')
  revalidatePath(`/contacts/${id}`)

  return { success: true, data: transformContact(data as ContactRow) }
}
