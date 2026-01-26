import { getCallHistory } from '@/features/call-history/queries/getCallHistory'
import { HistoryPage } from '@/features/call-history'

export default async function CallsPage() {
  const initialData = await getCallHistory()

  return <HistoryPage initialData={initialData} />
}
