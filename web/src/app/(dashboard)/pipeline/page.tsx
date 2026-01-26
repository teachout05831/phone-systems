import { getStages, getDeals } from '@/features/pipeline/queries'
import { DealsPipelinePage } from '@/features/pipeline'

export const metadata = {
  title: 'Pipeline - Outreach System',
  description: 'Manage your deals through the sales pipeline',
}

export default async function PipelinePage() {
  const [stages, dealsResult] = await Promise.all([
    getStages().catch(() => []),
    getDeals().catch(() => ({
      deals: {},
      stats: { totalDeals: 0, newThisWeek: 0, totalValue: 0, conversionRate: 0 },
    })),
  ])

  return (
    <DealsPipelinePage
      stages={stages}
      initialDeals={dealsResult.deals}
      initialStats={dealsResult.stats}
    />
  )
}
