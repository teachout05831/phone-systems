import { createClient } from '@/lib/supabase/server'
import type { Contact, ContactFilters, ContactRow } from '../types'
import { transformContact } from '../types'

export async function getContacts(filters?: ContactFilters): Promise<Contact[]> {
  const supabase = await createClient()

  // SECURITY: Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Get user's company
  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (!membership) throw new Error('No company found')

  // Build query with company filter
  let query = supabase
    .from('contacts')
    .select('id, first_name, last_name, phone, phone_secondary, email, business_name, job_title, website, source, status, notes, tags, company_id, created_by, assigned_to, created_at, updated_at')
    .eq('company_id', membership.company_id)

  // Apply search filter
  if (filters?.search) {
    const searchTerm = `%${filters.search}%`
    query = query.or(
      `first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},phone.ilike.${searchTerm},email.ilike.${searchTerm},business_name.ilike.${searchTerm}`
    )
  }

  // Apply status filter
  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  // Apply source filter
  if (filters?.source) {
    query = query.eq('source', filters.source)
  }

  // Apply date range filter
  if (filters?.dateRange && filters.dateRange !== 'all') {
    const now = new Date()
    let startDate: Date

    switch (filters.dateRange) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        break
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(0)
    }

    query = query.gte('created_at', startDate.toISOString())
  }

  // Apply pagination
  const limit = filters?.limit || 50
  const offset = filters?.offset || 0
  query = query.range(offset, offset + limit - 1)

  // Order by created_at desc
  query = query.order('created_at', { ascending: false })

  const { data, error } = await query

  if (error) throw error

  return (data as ContactRow[]).map(transformContact)
}

export async function getContactsCount(filters?: ContactFilters): Promise<number> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (!membership) throw new Error('No company found')

  let query = supabase
    .from('contacts')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', membership.company_id)

  if (filters?.status) query = query.eq('status', filters.status)
  if (filters?.source) query = query.eq('source', filters.source)

  const { count, error } = await query

  if (error) throw error
  return count || 0
}
