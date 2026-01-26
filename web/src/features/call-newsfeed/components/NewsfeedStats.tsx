'use client'

import type { NewsfeedStats } from '../types'

interface Props {
  stats: NewsfeedStats
}

export function NewsfeedStats({ stats }: Props) {
  return (
    <div className="grid grid-cols-5 gap-4">
      <StatCard label="Total Calls" value={stats.totalCalls} color="zinc" />
      <StatCard label="Booked" value={stats.booked} color="green" />
      <StatCard label="Estimates" value={stats.estimates} color="blue" />
      <StatCard label="Needs Action" value={stats.needsAction} color="amber" />
      <StatCard label="Missed" value={stats.missed} color="red" />
    </div>
  )
}

interface StatCardProps {
  label: string
  value: number
  color: 'zinc' | 'green' | 'blue' | 'amber' | 'red'
}

const colorClasses: Record<StatCardProps['color'], string> = {
  zinc: 'text-zinc-700 dark:text-zinc-300',
  green: 'text-green-600 dark:text-green-400',
  blue: 'text-blue-600 dark:text-blue-400',
  amber: 'text-amber-600 dark:text-amber-400',
  red: 'text-red-600 dark:text-red-400',
}

function StatCard({ label, value, color }: StatCardProps) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 text-center dark:border-zinc-700 dark:bg-zinc-800">
      <div className={`text-2xl font-bold ${colorClasses[color]}`}>{value}</div>
      <div className="text-xs text-zinc-500 dark:text-zinc-400">{label}</div>
    </div>
  )
}
