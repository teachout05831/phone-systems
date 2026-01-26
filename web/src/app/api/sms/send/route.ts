import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendSMS, formatE164, validatePhoneNumber } from '@/lib/twilio'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()

    // Auth check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Get company membership
    const { data: membership } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No company access' }, { status: 403 })
    }

    // Parse request body
    const body = await req.json()
    const { contactId, phoneNumber, message } = body as {
      contactId?: string
      phoneNumber?: string
      message: string
    }

    // Validate input
    if (!message || message.trim().length === 0) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    if (message.length > 1600) {
      return NextResponse.json({ error: 'Message too long' }, { status: 400 })
    }

    if (!contactId && !phoneNumber) {
      return NextResponse.json(
        { error: 'Contact ID or phone number required' },
        { status: 400 }
      )
    }

    // Get phone number from contact or validate direct input
    let toPhone: string
    let resolvedContactId: string | null = null

    if (contactId) {
      const { data: contact } = await supabase
        .from('contacts')
        .select('id, phone, company_id')
        .eq('id', contactId)
        .eq('company_id', membership.company_id)
        .single()

      if (!contact) {
        return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
      }

      toPhone = contact.phone
      resolvedContactId = contact.id
    } else {
      if (!validatePhoneNumber(phoneNumber!)) {
        return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
      }
      toPhone = phoneNumber!
    }

    // Get or create conversation
    const formattedPhone = formatE164(toPhone)
    const { data: conversationId, error: rpcError } = await supabase
      .rpc('get_or_create_sms_conversation', {
        p_company_id: membership.company_id,
        p_phone_number: formattedPhone,
        p_contact_id: resolvedContactId,
      })

    if (rpcError || !conversationId) {
      return NextResponse.json(
        { error: 'Failed to create conversation' },
        { status: 500 }
      )
    }

    // Send via Twilio
    const result = await sendSMS(toPhone, message)

    // Save message to database
    const { data: savedMessage, error: insertError } = await supabase
      .from('sms_messages')
      .insert({
        conversation_id: conversationId,
        company_id: membership.company_id,
        contact_id: resolvedContactId,
        direction: 'outbound',
        from_number: process.env.TWILIO_PHONE_NUMBER,
        to_number: formattedPhone,
        body: message,
        twilio_sid: result.sid,
        status: result.success ? 'sent' : 'failed',
        error_code: result.errorCode,
        error_message: result.error,
        sent_at: result.success ? new Date().toISOString() : null,
        sender_id: user.id,
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('Failed to save message:', insertError)
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to send SMS' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      messageId: savedMessage?.id,
      twilioSid: result.sid,
    })
  } catch (error) {
    console.error('SMS send error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
