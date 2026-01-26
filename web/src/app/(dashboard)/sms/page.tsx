import { getConversations } from '@/features/sms/queries/getConversations'
import { getTemplates } from '@/features/sms/queries/getTemplates'
import { SMSPage } from '@/features/sms'
import type { SMSConversation, SMSTemplate } from '@/features/sms/types'

export const metadata = {
  title: 'SMS Messages',
  description: 'Send and receive SMS messages',
}

export default async function SmsPageRoute() {
  let conversations: SMSConversation[] = []
  let templates: SMSTemplate[] = []

  try {
    const results = await Promise.all([
      getConversations({ status: 'active' }),
      getTemplates(),
    ])
    conversations = results[0]
    templates = results[1]
  } catch (error) {
    console.error('Failed to load SMS data:', error)
    // Continue with empty arrays - component will show empty state
  }

  return (
    <SMSPage
      initialConversations={conversations}
      initialTemplates={templates}
    />
  )
}
