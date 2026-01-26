import { getCallHistory } from '@/features/call-history'
import { HistoryPage } from '@/features/call-history'

export const metadata = {
  title: 'Call History - Outreach System',
  description: 'View and manage your call history',
}

export default async function HistoryRoute() {
  const initialData = await getCallHistory({}, 1).catch(() => ({
    calls: [],
    total: 0,
    page: 1,
    pageSize: 20,
    totalPages: 0,
  }))

  return <HistoryPage initialData={initialData} />
}
