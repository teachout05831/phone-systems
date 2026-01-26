import type { TeamMetrics } from '../types'

interface Props {
  metrics: TeamMetrics
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function MetricsPanel({ metrics }: Props) {
  const cards = [
    {
      label: 'Calls Today',
      value: metrics.callsToday.toString(),
      color: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    },
    {
      label: 'Avg Duration',
      value: formatDuration(metrics.averageCallDuration),
      color: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    },
    {
      label: 'Conversion Rate',
      value: `${metrics.conversionRate}%`,
      color: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
    },
    {
      label: 'SMS Sent',
      value: metrics.smsSentToday.toString(),
      color: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div key={card.label} className={`${card.color} rounded-xl p-4 border`}>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">{card.label}</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{card.value}</p>
        </div>
      ))}
    </div>
  )
}
