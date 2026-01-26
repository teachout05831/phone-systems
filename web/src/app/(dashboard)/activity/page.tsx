import { getActivities } from '@/features/activity/queries'
import { ActivityFeed } from '@/features/activity'

export const metadata = {
  title: 'Activity - Outreach System',
  description: 'View all activity across calls, messages, and callbacks',
}

export default async function ActivityPage() {
  try {
    const { activities } = await getActivities(undefined, { limit: 20 })
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Activity</h1>
        <ActivityFeed initialActivities={activities} />
      </div>
    )
  } catch (error) {
    console.error('Activity page error:', error)
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Activity</h1>
        <ActivityFeed initialActivities={[]} />
      </div>
    )
  }
}
