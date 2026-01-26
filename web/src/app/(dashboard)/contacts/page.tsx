import { getContacts, getContactsCount, ContactsPage } from '@/features/contacts'

export default async function ContactsRoute() {
  const [contacts, count] = await Promise.all([
    getContacts({ limit: 50 }),
    getContactsCount(),
  ])

  return <ContactsPage initialContacts={contacts} initialCount={count} />
}
