'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

interface DeleteContactResult {
  success?: boolean
  error?: string
}

export async function deleteContact(id: string): Promise<DeleteContactResult> {
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

  // Delete the contact
  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting contact:', error)
    return { error: 'Failed to delete contact' }
  }

  revalidatePath('/contacts')

  return { success: true }
}

export async function bulkDeleteContacts(ids: string[]): Promise<DeleteContactResult> {
  const supabase = await createClient()

  // SECURITY: Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // VALIDATION: IDs are required
  if (!ids || ids.length === 0) return { error: 'Contact IDs are required' }

  // Get user's company
  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (!membership) return { error: 'No company found' }

  // SECURITY: Delete only contacts that belong to user's company
  const { error } = await supabase
    .from('contacts')
    .delete()
    .in('id', ids)
    .eq('company_id', membership.company_id)

  if (error) {
    console.error('Error bulk deleting contacts:', error)
    return { error: 'Failed to delete contacts' }
  }

  revalidatePath('/contacts')

  return { success: true }
}
