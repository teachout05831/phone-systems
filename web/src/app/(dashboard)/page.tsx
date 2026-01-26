import {
  DashboardPage,
  getDashboardStats,
  getRecentCalls,
  getUpcomingCallbacks,
  defaultStats,
} from '@/features/dashboard'

export const metadata = {
  title: 'Dashboard - Outreach System',
  description: 'Your sales dashboard overview',
}

export default async function Dashboard() {
  const [stats, recentCalls, callbacks] = await Promise.all([
    getDashboardStats().catch(() => defaultStats),
    getRecentCalls(10).catch(() => []),
    getUpcomingCallbacks(5).catch(() => []),
  ])

  return (
    <DashboardPage
      initialStats={stats}
      initialRecentCalls={recentCalls}
      initialCallbacks={callbacks}
    />
  )
}
