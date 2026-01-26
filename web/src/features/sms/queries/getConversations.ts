import { createClient } from '@/lib/supabase/server'
import type { SMSConversation, ConversationFilters } from '../types'
import { toSMSConversation } from '../types'

export async function getConversations(
  filters?: ConversationFilters
): Promise<SMSConversation[]> {
  const supabase = await createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Get user's company
  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (!membership) throw new Error('No company access')

  // Build query with user filter
  let query = supabase
    .from('sms_conversations')
    .select(`
      id, company_id, contact_id, phone_number,
      last_message_at, last_message_preview, unread_count,
      message_count, status, created_at, updated_at,
      contacts (id, first_name, last_name, email, phone)
    `)
    .eq('company_id', membership.company_id)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(50)

  // Apply filters
  if (filters?.status) {
    query = query.eq('status', filters.status)
  }
  if (filters?.hasUnread) {
    query = query.gt('unread_count', 0)
  }

  const { data, error } = await query

  if (error) throw error

  return (data || []).map((row) => {
    const conversation = toSMSConversation(row as never)
    // Handle contacts join - could be array or single object depending on Supabase version
    const contactData = row.contacts as unknown
    if (contactData) {
      const contact = Array.isArray(contactData) ? contactData[0] : contactData
      if (contact) {
        conversation.contact = {
          id: contact.id,
          firstName: contact.first_name,
          lastName: contact.last_name,
          email: contact.email,
          phone: contact.phone,
        }
      }
    }
    return conversation
  })
}
