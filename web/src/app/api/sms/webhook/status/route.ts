import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateTwilioRequest } from '@/lib/twilio'

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
      const url = `${process.env.NEXT_PUBLIC_APP_URL}/api/sms/webhook/status`

      if (!validateTwilioRequest(signature, url, params)) {
        console.error('Invalid Twilio signature')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    // Extract status data
    const {
      MessageSid: twilioSid,
      MessageStatus: status,
      ErrorCode: errorCode,
      ErrorMessage: errorMessage,
    } = params

    if (!twilioSid || !status) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    console.log('SMS status update:', { twilioSid, status })

    // Map Twilio status to our status
    const statusMap: Record<string, string> = {
      queued: 'queued',
      sending: 'sending',
      sent: 'sent',
      delivered: 'delivered',
      failed: 'failed',
      undelivered: 'undelivered',
    }

    const mappedStatus = statusMap[status] || status

    // Update message status
    const updateData: Record<string, unknown> = {
      status: mappedStatus,
      updated_at: new Date().toISOString(),
    }

    if (mappedStatus === 'delivered') {
      updateData.delivered_at = new Date().toISOString()
    }

    if (errorCode) {
      updateData.error_code = errorCode
      updateData.error_message = errorMessage
    }

    const { error: updateError } = await supabase
      .from('sms_messages')
      .update(updateData)
      .eq('twilio_sid', twilioSid)

    if (updateError) {
      console.error('Failed to update message status:', updateError)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('SMS status webhook error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
