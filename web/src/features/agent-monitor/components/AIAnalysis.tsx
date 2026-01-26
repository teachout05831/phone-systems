'use client'

import type { AIAnalysisProps } from '../types'

export function AIAnalysis({ aiSummary }: AIAnalysisProps) {
  if (!aiSummary) {
    return (
      <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4 border-l-4 border-purple-500">
        <h4 className="text-sm font-semibold text-purple-600 dark:text-purple-400 mb-2 flex items-center gap-2">
          <span>🧠</span> AI Analysis
        </h4>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          AI analysis will appear here once the call progresses
        </p>
      </div>
    )
  }

  const sentimentColors = {
    positive: 'text-green-600 dark:text-green-400',
    neutral: 'text-zinc-600 dark:text-zinc-400',
    negative: 'text-red-600 dark:text-red-400',
  }

  return (
    <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4 border-l-4 border-purple-500">
      <h4 className="text-sm font-semibold text-purple-600 dark:text-purple-400 mb-3 flex items-center gap-2">
        <span>🧠</span> AI Analysis
      </h4>

      <div className="grid grid-cols-3 gap-4 mb-3">
        <div className="text-center">
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Sentiment</p>
          <p className={`text-sm font-semibold capitalize ${sentimentColors[aiSummary.sentiment]}`}>
            {aiSummary.sentiment}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Intent</p>
          <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{aiSummary.intent}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Confidence</p>
          <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{aiSummary.confidence}%</p>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-700 rounded-lg p-3">
        <p className="text-sm text-zinc-700 dark:text-zinc-300">{aiSummary.summary}</p>
      </div>
    </div>
  )
}
