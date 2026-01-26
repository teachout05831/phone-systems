'use server'

import { createClient } from '@/lib/supabase/server'
import type { ImportResult, ImportError } from '../types'
import { normalizePhone } from '../utils'

interface ContactInput {
  first_name?: string | null
  last_name?: string | null
  phone: string
  email?: string | null
  business_name?: string | null
  job_title?: string | null
  website?: string | null
  source?: string | null
  notes?: string | null
}

interface ImportInput {
  contacts: ContactInput[]
  source?: string
}

export async function importContacts(input: ImportInput): Promise<ImportResult> {
  const supabase = await createClient()

  // Step 1: Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, imported: 0, skipped: 0, errors: [{ rowNumber: 0, error: 'Not authenticated' }] }

  // Step 2: Company membership
  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .single()
  if (!membership) return { success: false, imported: 0, skipped: 0, errors: [{ rowNumber: 0, error: 'No company access' }] }

  // Step 3: Validate input shape
  if (!input || !Array.isArray(input.contacts) || input.contacts.length === 0) {
    return { success: false, imported: 0, skipped: 0, errors: [{ rowNumber: 0, error: 'No contacts provided' }] }
  }

  // Step 4: Normalize phones and filter valid
  const errors: ImportError[] = []
  const validContacts: Array<ContactInput & { company_id: string }> = []

  input.contacts.forEach((c, i) => {
    if (!c.phone) {
      errors.push({ rowNumber: i + 1, error: 'Phone required' })
      return
    }
    const phone = normalizePhone(c.phone)
    validContacts.push({
      ...c,
      phone,
      source: c.source || input.source || 'csv_import',
      company_id: membership.company_id,
    })
  })

  if (validContacts.length === 0) {
    return { success: false, imported: 0, skipped: input.contacts.length, errors }
  }

  // Step 5: Check for existing phones
  const phones = validContacts.map(c => c.phone)
  const { data: existing } = await supabase
    .from('contacts')
    .select('phone')
    .eq('company_id', membership.company_id)
    .in('phone', phones)

  const existingPhones = new Set(existing?.map(e => e.phone) || [])
  const newContacts = validContacts.filter(c => !existingPhones.has(c.phone))
  const skipped = validContacts.length - newContacts.length

  if (newContacts.length === 0) {
    return { success: true, imported: 0, skipped, errors }
  }

  // Step 6: Batch insert
  const { data, error } = await supabase
    .from('contacts')
    .insert(newContacts)
    .select('id')

  if (error) {
    return { success: false, imported: 0, skipped, errors: [{ rowNumber: 0, error: error.message }] }
  }

  return { success: true, imported: data?.length || 0, skipped, errors }
}
