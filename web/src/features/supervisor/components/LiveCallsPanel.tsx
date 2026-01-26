import type { ActiveCall } from '../types'

interface Props {
  activeCalls: ActiveCall[]
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function LiveCallsPanel({ activeCalls }: Props) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800 overflow-hidden">
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <h2 className="font-semibold text-zinc-900 dark:text-white">
            Live Calls ({activeCalls.length})
          </h2>
        </div>
      </div>

      {activeCalls.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-zinc-500 dark:text-zinc-400">No active calls</p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-200 dark:divide-zinc-700">
          {activeCalls.map((call) => (
            <div
              key={call.id}
              className="p-4 hover:bg-zinc-50 dark:hover:bg-zinc-700/30"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-zinc-900 dark:text-white">
                    {call.repName}
                  </p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {call.direction === 'outbound' ? '→' : '←'} {call.contactName}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-lg text-zinc-900 dark:text-white">
                    {formatDuration(call.durationSeconds)}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {call.phoneNumber}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
