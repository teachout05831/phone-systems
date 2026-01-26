'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { CreateContactInput, Contact, ContactRow } from '../types'
import { transformContact } from '../types'

interface CreateContactResult {
  success?: boolean
  data?: Contact
  error?: string
}

export async function createContact(input: CreateContactInput): Promise<CreateContactResult> {
  const supabase = await createClient()

  // SECURITY: Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Get user's company
  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (!membership) return { error: 'No company found' }

  // VALIDATION: Phone is required
  if (!input.phone) {
    return { error: 'Phone number is required' }
  }

  // VALIDATION: Phone format (basic validation)
  const phoneClean = input.phone.replace(/\D/g, '')
  if (phoneClean.length < 10) {
    return { error: 'Phone number must have at least 10 digits' }
  }

  // VALIDATION: Email format if provided
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    return { error: 'Invalid email format' }
  }

  // VALIDATION: First or last name should be provided
  if (!input.firstName && !input.lastName) {
    return { error: 'At least first name or last name is required' }
  }

  // SECURITY: Attach to current user's company
  const { data, error } = await supabase
    .from('contacts')
    .insert({
      first_name: input.firstName?.trim() || null,
      last_name: input.lastName?.trim() || null,
      phone: input.phone.trim(),
      phone_secondary: input.phoneSecondary?.trim() || null,
      email: input.email?.trim().toLowerCase() || null,
      business_name: input.businessName?.trim() || null,
      job_title: input.jobTitle?.trim() || null,
      website: input.website?.trim() || null,
      source: input.source || 'manual',
      status: 'new',
      notes: input.notes?.trim() || null,
      tags: input.tags || [],
      company_id: membership.company_id,
      created_by: user.id,
      assigned_to: input.assignedTo || user.id,
    })
    .select('id, first_name, last_name, phone, phone_secondary, email, business_name, job_title, website, source, status, notes, tags, company_id, created_by, assigned_to, created_at, updated_at')
    .single()

  if (error) {
    console.error('Error creating contact:', error)
    return { error: 'Failed to create contact' }
  }

  revalidatePath('/contacts')

  return { success: true, data: transformContact(data as ContactRow) }
}
