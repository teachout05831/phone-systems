import { getConversations } from '@/features/sms/queries'
import { getTemplates } from '@/features/sms/queries'
import { SMSPage } from '@/features/sms'

export const metadata = {
  title: 'Messages - Outreach System',
  description: 'SMS messaging with your contacts',
}

export default async function MessagesPage() {
  try {
    const [conversations, templates] = await Promise.all([
      getConversations().catch(() => []),
      getTemplates().catch(() => []),
    ])

    return <SMSPage initialConversations={conversations} initialTemplates={templates} />
  } catch (error) {
    console.error('Messages page error:', error)
    return <SMSPage initialConversations={[]} initialTemplates={[]} />
  }
}
