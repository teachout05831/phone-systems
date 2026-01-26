import { getNewsfeedCalls } from '@/features/call-newsfeed/queries'
import { NewsfeedPage } from '@/features/call-newsfeed'

export const metadata = {
  title: 'Call Newsfeed - Outreach System',
  description: 'Real-time feed of calls with quick tagging',
}

export default async function NewsfeedRoute() {
  let initialData
  try {
    initialData = await getNewsfeedCalls({ limit: 20 })
  } catch {
    initialData = undefined
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Call Newsfeed</h1>
      <NewsfeedPage initialData={initialData} />
    </div>
  )
}
