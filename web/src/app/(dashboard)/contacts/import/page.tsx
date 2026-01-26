import { ImportPage } from '@/features/contacts-import'

export const metadata = {
  title: 'Import Contacts',
  description: 'Import contacts from CSV file',
}

export default function ContactsImportPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          Import Contacts
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Upload a CSV file to bulk import contacts
        </p>
      </div>
      <ImportPage />
    </div>
  )
}
