'use client'

import type { AISummary } from '../types'

interface Props {
  summary: AISummary
}

export function AISummaryCard({ summary }: Props) {
  return (
    <div className="rounded-lg border border-amber-300 bg-gradient-to-br from-amber-50 to-amber-100 p-4 dark:border-amber-700 dark:from-amber-900/30 dark:to-amber-800/30">
      <div className="mb-2 flex items-center gap-2">
        <span>🤖</span>
        <span className="text-xs font-semibold uppercase text-amber-800 dark:text-amber-300">
          AI Summary
        </span>
        {summary.sentiment && (
          <span className="ml-auto rounded-full bg-amber-200 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-800 dark:text-amber-200">
            {summary.sentiment}
          </span>
        )}
      </div>
      <p className="text-sm text-amber-900 dark:text-amber-100">{summary.summary}</p>
      {summary.keyPoints && summary.keyPoints.length > 0 && (
        <ul className="mt-2 space-y-1">
          {summary.keyPoints.map((point, i) => (
            <li key={i} className="text-xs text-amber-800 dark:text-amber-200">
              • {point}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
