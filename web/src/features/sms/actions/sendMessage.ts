'use server'

import { createClient } from '@/lib/supabase/server'
import { sendSMS, formatE164, validatePhoneNumber } from '@/lib/twilio'
import type { SendMessageInput } from '../types'

interface ActionResult {
  success?: boolean
  error?: string
  messageId?: string
}

export async function sendMessage(input: SendMessageInput): Promise<ActionResult> {
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

  // Step 3: Validate input shape
  if (!input || typeof input !== 'object') {
    return { error: 'Invalid input' }
  }

  // Step 4: Validate required fields
  if (!input.body || input.body.trim().length === 0) {
    return { error: 'Message body is required' }
  }

  if (!input.contactId && !input.phoneNumber) {
    return { error: 'Contact ID or phone number is required' }
  }

  // Step 5: Validate message length
  if (input.body.length > 1600) {
    return { error: 'Message too long (max 1600 characters)' }
  }

  // Step 6: Get phone number (from contact or direct)
  let phoneNumber: string
  let contactId: string | null = null

  if (input.contactId) {
    const { data: contact } = await supabase
      .from('contacts')
      .select('id, phone, company_id')
      .eq('id', input.contactId)
      .eq('company_id', membership.company_id)
      .single()

    if (!contact) return { error: 'Contact not found' }

    phoneNumber = contact.phone
    contactId = contact.id
  } else {
    if (!validatePhoneNumber(input.phoneNumber!)) {
      return { error: 'Invalid phone number' }
    }
    phoneNumber = input.phoneNumber!
  }

  // Step 7: Get or create conversation
  const formattedPhone = formatE164(phoneNumber)
  const { data: conversationId, error: rpcError } = await supabase
    .rpc('get_or_create_sms_conversation', {
      p_company_id: membership.company_id,
      p_phone_number: formattedPhone,
      p_contact_id: contactId,
    })

  if (rpcError) {
    console.error('RPC error:', rpcError)
    return { error: `Failed to create conversation: ${rpcError.message}` }
  }

  if (!conversationId) return { error: 'Failed to create conversation (no ID returned)' }

  // Step 8: Send via Twilio
  const twilioResult = await sendSMS(phoneNumber, input.body)

  // Step 9: Save message to database
  const { data: message, error: insertError } = await supabase
    .from('sms_messages')
    .insert({
      conversation_id: conversationId,
      company_id: membership.company_id,
      contact_id: contactId,
      direction: 'outbound',
      from_number: process.env.TWILIO_PHONE_NUMBER,
      to_number: formattedPhone,
      body: input.body,
      twilio_sid: twilioResult.sid,
      status: twilioResult.success ? 'sent' : 'failed',
      error_code: twilioResult.errorCode,
      error_message: twilioResult.error,
      sent_at: twilioResult.success ? new Date().toISOString() : null,
      sender_id: user.id,
    })
    .select('id')
    .single()

  if (insertError) {
    console.error('Insert error:', insertError)
    return { error: `Failed to save message: ${insertError.message}` }
  }

  if (!twilioResult.success) {
    return { error: twilioResult.error || 'Failed to send SMS' }
  }

  return { success: true, messageId: message.id }
}
