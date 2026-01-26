import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { contact_id, agent_id } = body

    if (!contact_id) {
      return NextResponse.json({ error: 'contact_id is required' }, { status: 400 })
    }

    // Get contact details
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', contact_id)
      .single()

    if (contactError || !contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    // Format phone number to E.164 (add +1 for US numbers if missing)
    let phoneNumber = contact.phone.replace(/\D/g, '') // Remove non-digits
    if (phoneNumber.length === 10) {
      phoneNumber = '+1' + phoneNumber
    } else if (phoneNumber.length === 11 && phoneNumber.startsWith('1')) {
      phoneNumber = '+' + phoneNumber
    } else if (!phoneNumber.startsWith('+')) {
      phoneNumber = '+' + phoneNumber
    }

    // Get company's Retell agent ID (or use default)
    const { data: membership } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    let retellAgentId = process.env.RETELL_AGENT_ID // Default agent

    // If agent_id provided, look up the Retell agent ID from our agents table
    if (agent_id) {
      const { data: agent } = await supabase
        .from('agents')
        .select('llm_config')
        .eq('id', agent_id)
        .single()

      if (agent?.llm_config?.retell_agent_id) {
        retellAgentId = agent.llm_config.retell_agent_id
      }
    }

    if (!retellAgentId) {
      return NextResponse.json(
        { error: 'No Retell agent configured. Add RETELL_AGENT_ID to .env.local' },
        { status: 400 }
      )
    }

    // Create call record in our database first
    const { data: callRecord, error: callError } = await supabase
      .from('calls')
      .insert({
        company_id: membership?.company_id,
        contact_id: contact.id,
        agent_id: agent_id || null,
        direction: 'outbound',
        status: 'initiated',
        from_number: process.env.TWILIO_PHONE_NUMBER || null,
        phone_number: phoneNumber,
      })
      .select()
      .single()

    if (callError) {
      console.error('Failed to create call record:', callError)
      return NextResponse.json({ error: 'Failed to create call record' }, { status: 500 })
    }

    // Call Retell API to initiate the call
    const retellResponse = await fetch('https://api.retellai.com/v2/create-phone-call', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RETELL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agent_id: retellAgentId,
        to_number: phoneNumber,
        from_number: process.env.TWILIO_PHONE_NUMBER,
        metadata: {
          call_id: callRecord.id,
          contact_id: contact.id,
          contact_name: `${contact.first_name || ''} ${contact.last_name || ''}`.trim(),
          business_name: contact.business_name || '',
        },
      }),
    })

    if (!retellResponse.ok) {
      const errorData = await retellResponse.json().catch(() => ({}))
      console.error('Retell API error:', errorData)

      // Update call record to failed
      await supabase.from('calls').update({ status: 'failed' }).eq('id', callRecord.id)

      return NextResponse.json(
        { error: errorData.message || 'Failed to initiate call with Retell' },
        { status: retellResponse.status }
      )
    }

    const retellData = await retellResponse.json()

    // Update call record with Retell call ID
    await supabase
      .from('calls')
      .update({
        external_call_id: retellData.call_id,
        status: 'ringing',
      })
      .eq('id', callRecord.id)

    // Update contact status to contacted
    await supabase.from('contacts').update({ status: 'contacted' }).eq('id', contact.id)

    return NextResponse.json({
      success: true,
      call_id: callRecord.id,
      retell_call_id: retellData.call_id,
    })
  } catch (error) {
    console.error('Outbound call error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
