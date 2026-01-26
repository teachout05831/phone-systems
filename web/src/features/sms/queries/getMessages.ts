import { createClient } from '@/lib/supabase/server'
import type { SMSMessage, MessageFilters } from '../types'
import { toSMSMessage } from '../types'

export async function getMessages(
  conversationId: string,
  filters?: MessageFilters
): Promise<SMSMessage[]> {
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

  // Verify conversation belongs to user's company
  const { data: conversation } = await supabase
    .from('sms_conversations')
    .select('id, company_id')
    .eq('id', conversationId)
    .eq('company_id', membership.company_id)
    .single()

  if (!conversation) throw new Error('Conversation not found')

  // Build query
  let query = supabase
    .from('sms_messages')
    .select(`
      id, conversation_id, company_id, contact_id,
      direction, from_number, to_number, body,
      twilio_sid, status, error_code, error_message,
      sent_at, delivered_at, sender_id, created_at, updated_at
    `)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(100)

  // Apply filters
  if (filters?.direction) {
    query = query.eq('direction', filters.direction)
  }
  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  const { data, error } = await query

  if (error) throw error

  return (data || []).map((row) => toSMSMessage(row as never))
}
