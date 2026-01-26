import { redirect } from 'next/navigation'
import {
  getUserRole,
  getTeamMetrics,
  getActiveCalls,
  getLeaderboard,
  SupervisorDashboard,
  defaultMetrics,
} from '@/features/supervisor'

export const metadata = {
  title: 'Supervisor Dashboard - Outreach System',
  description: 'Monitor team performance and live calls',
}

export default async function SupervisorPage() {
  const { hasAccess } = await getUserRole()
  if (!hasAccess) {
    redirect('/dashboard')
  }

  const [metrics, activeCalls, leaderboard] = await Promise.all([
    getTeamMetrics().catch(() => defaultMetrics),
    getActiveCalls().catch(() => []),
    getLeaderboard().catch(() => []),
  ])

  return (
    <SupervisorDashboard
      initialMetrics={metrics}
      initialActiveCalls={activeCalls}
      initialLeaderboard={leaderboard}
    />
  )
}
