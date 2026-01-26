'use server'

import { createClient } from '@/lib/supabase/server'

interface ActionResult {
  success?: boolean
  error?: string
}

export async function markAsRead(conversationId: string): Promise<ActionResult> {
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

  // Step 3: Validate input
  if (!conversationId || typeof conversationId !== 'string') {
    return { error: 'Conversation ID is required' }
  }

  // Step 4: Verify ownership - conversation belongs to user's company
  const { data: conversation } = await supabase
    .from('sms_conversations')
    .select('id, company_id')
    .eq('id', conversationId)
    .eq('company_id', membership.company_id)
    .single()

  if (!conversation) return { error: 'Conversation not found' }

  // Step 5: Mark as read using helper function
  const { error } = await supabase
    .rpc('mark_conversation_read', { p_conversation_id: conversationId })

  if (error) return { error: 'Failed to mark as read' }

  return { success: true }
}
