import { getQueueItems, getQueueStats, AgentQueuePage } from '@/features/agent-queue'

export const metadata = {
  title: 'AI Queue - Outreach System',
  description: 'Manage AI agent calling queue',
}

export default async function AgentQueueRoute() {
  const [items, stats] = await Promise.all([
    getQueueItems().catch(() => []),
    getQueueStats().catch(() => ({
      pending: 0,
      inProgress: 0,
      completedToday: 0,
      failedToday: 0,
      costToday: 0,
    })),
  ])

  return <AgentQueuePage initialItems={items} initialStats={stats} />
}
