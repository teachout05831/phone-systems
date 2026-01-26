import type { LeaderboardEntry } from '../types'

interface Props {
  entries: LeaderboardEntry[]
}

function getMedalEmoji(rank: number): string | null {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return null
}

export function Leaderboard({ entries }: Props) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800 overflow-hidden">
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
        <h2 className="font-semibold text-zinc-900 dark:text-white">
          Team Leaderboard
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Today&apos;s performance
        </p>
      </div>

      {entries.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-zinc-500 dark:text-zinc-400">No data yet</p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-200 dark:divide-zinc-700">
          {entries.map((entry) => (
            <div key={entry.repId} className="p-4 flex items-center gap-4">
              <div className="w-8 text-center">
                {getMedalEmoji(entry.rank) || (
                  <span className="text-zinc-400 font-medium">{entry.rank}</span>
                )}
              </div>

              <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-600 flex items-center justify-center flex-shrink-0">
                <span className="text-zinc-500 dark:text-zinc-300 font-medium">
                  {entry.repName.charAt(0).toUpperCase()}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-medium text-zinc-900 dark:text-white truncate">
                  {entry.repName}
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {entry.callsMade} calls · {entry.dealsBooked} booked
                </p>
              </div>

              <div className="text-right">
                <p className="font-medium text-zinc-900 dark:text-white">
                  {entry.conversionRate.toFixed(1)}%
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">conversion</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
