import { notFound } from 'next/navigation'
import {
  getContactById,
  getContactStats,
  getContactCalls,
  getContactActivity,
  ContactProfilePage,
} from '@/features/contacts'

interface ContactPageProps {
  params: Promise<{ id: string }>
}

export default async function ContactDetailRoute({ params }: ContactPageProps) {
  const { id } = await params

  const contact = await getContactById(id)

  if (!contact) {
    notFound()
  }

  const [stats, calls, activities] = await Promise.all([
    getContactStats(id),
    getContactCalls(id, { limit: 20 }),
    getContactActivity(id, { limit: 30 }),
  ])

  return (
    <ContactProfilePage
      contact={contact}
      calls={calls}
      activities={activities}
      stats={stats}
    />
  )
}
