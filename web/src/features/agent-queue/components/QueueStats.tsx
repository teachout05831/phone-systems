'use client'

import type { QueueStats as QueueStatsType } from '../types'

interface Props {
  stats: QueueStatsType
}

export function QueueStats({ stats }: Props) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <StatCard
        label="Pending"
        value={stats.pending}
        color="yellow"
      />
      <StatCard
        label="In Progress"
        value={stats.inProgress}
        color="blue"
      />
      <StatCard
        label="Completed Today"
        value={stats.completedToday}
        color="green"
      />
      <StatCard
        label="Est. Cost Today"
        value={`$${stats.costToday.toFixed(2)}`}
        color="purple"
      />
    </div>
  )
}

interface StatCardProps {
  label: string
  value: number | string
  color: 'yellow' | 'blue' | 'green' | 'purple'
}

function StatCard({ label, value, color }: StatCardProps) {
  const colorStyles = {
    yellow: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800',
    blue: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800',
    green: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800',
    purple: 'bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800',
  }

  const valueColors = {
    yellow: 'text-yellow-700 dark:text-yellow-400',
    blue: 'text-blue-700 dark:text-blue-400',
    green: 'text-green-700 dark:text-green-400',
    purple: 'text-purple-700 dark:text-purple-400',
  }

  return (
    <div className={`rounded-xl border p-4 ${colorStyles[color]}`}>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className={`text-2xl font-bold ${valueColors[color]}`}>{value}</p>
    </div>
  )
}
