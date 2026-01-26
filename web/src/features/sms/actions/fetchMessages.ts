'use server'

import { createClient } from '@/lib/supabase/server'
import type { SMSMessage } from '../types'
import { toSMSMessage } from '../types'

export async function fetchMessages(conversationId: string): Promise<SMSMessage[]> {
  const supabase = await createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // Get user's company
  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (!membership) return []

  // Verify conversation belongs to user's company
  const { data: conversation } = await supabase
    .from('sms_conversations')
    .select('id, company_id')
    .eq('id', conversationId)
    .eq('company_id', membership.company_id)
    .single()

  if (!conversation) return []

  // Fetch messages
  const { data, error } = await supabase
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

  if (error) return []

  return (data || []).map((row) => toSMSMessage(row as never))
}
