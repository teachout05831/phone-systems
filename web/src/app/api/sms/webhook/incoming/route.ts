import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateTwilioRequest, formatE164 } from '@/lib/twilio'

// Use service role for webhook (no user auth)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const params = Object.fromEntries(formData.entries()) as Record<string, string>

    // Validate Twilio signature in production
    if (process.env.NODE_ENV === 'production') {
      const signature = req.headers.get('x-twilio-signature') || ''
      const url = `${process.env.NEXT_PUBLIC_APP_URL}/api/sms/webhook/incoming`

      if (!validateTwilioRequest(signature, url, params)) {
        console.error('Invalid Twilio signature')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    // Extract message data
    const {
      MessageSid: twilioSid,
      From: fromNumber,
      To: toNumber,
      Body: body,
    } = params

    if (!twilioSid || !fromNumber || !toNumber || !body) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    console.log('Incoming SMS:', { twilioSid, from: fromNumber, to: toNumber })

    // Find company by Twilio phone number
    const formattedTo = formatE164(toNumber)
    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .limit(1)
      .single()

    if (!company) {
      console.error('No company found for number:', toNumber)
      return NextResponse.json({ error: 'Unknown number' }, { status: 404 })
    }

    // Find or create contact by phone number
    const formattedFrom = formatE164(fromNumber)
    let contactId: string | null = null

    const { data: contact } = await supabase
      .from('contacts')
      .select('id')
      .eq('company_id', company.id)
      .eq('phone', formattedFrom)
      .single()

    if (contact) {
      contactId = contact.id
    }

    // Get or create conversation
    const { data: conversationId } = await supabase
      .rpc('get_or_create_sms_conversation', {
        p_company_id: company.id,
        p_phone_number: formattedFrom,
        p_contact_id: contactId,
      })

    if (!conversationId) {
      console.error('Failed to create conversation')
      return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }

    // Save message
    const { error: insertError } = await supabase
      .from('sms_messages')
      .insert({
        conversation_id: conversationId,
        company_id: company.id,
        contact_id: contactId,
        direction: 'inbound',
        from_number: formattedFrom,
        to_number: formattedTo,
        body,
        twilio_sid: twilioSid,
        status: 'received',
      })

    if (insertError) {
      console.error('Failed to save message:', insertError)
      return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
    }

    // Return empty TwiML (no auto-reply)
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { 'Content-Type': 'text/xml' } }
    )
  } catch (error) {
    console.error('Incoming SMS error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
