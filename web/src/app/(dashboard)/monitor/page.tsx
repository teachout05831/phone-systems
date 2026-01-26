import { redirect } from 'next/navigation'
import { getUserRole } from '@/features/supervisor'
import { MonitorPage, getActiveAICalls } from '@/features/agent-monitor'

export const metadata = {
  title: 'AI Agent Monitor - Outreach System',
  description: 'Monitor active AI agent calls in real-time',
}

export default async function MonitorRoute() {
  const { hasAccess } = await getUserRole()
  if (!hasAccess) {
    redirect('/dashboard')
  }

  const activeCalls = await getActiveAICalls().catch(() => [])

  return <MonitorPage initialCalls={activeCalls} />
}
