'use client'

import type { AISummary as AISummaryType } from '../types'

interface AISummaryProps {
  summary: AISummaryType | null
}

function getSentimentStyle(sentiment: string) {
  switch (sentiment) {
    case 'positive':
      return 'text-green-600 dark:text-green-400'
    case 'negative':
      return 'text-red-600 dark:text-red-400'
    default:
      return 'text-yellow-600 dark:text-yellow-400'
  }
}

export function AISummary({ summary }: AISummaryProps) {
  if (!summary) {
    return (
      <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase">
            AI-Generated Summary
          </span>
          <span className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
            AI
          </span>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No AI summary available for this call.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <span className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase">
            AI-Generated Summary
          </span>
        </div>
        <span className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full font-semibold">
          POWERED BY AI
        </span>
      </div>

      {/* Overview */}
      <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
        {summary.overview}
      </p>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Sentiment */}
        <div className="bg-white dark:bg-zinc-800 rounded-lg p-3 border border-blue-100 dark:border-zinc-700">
          <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1">
            Customer Sentiment
          </div>
          <div className={`text-sm font-semibold capitalize ${getSentimentStyle(summary.sentiment)}`}>
            {summary.sentiment}
          </div>
        </div>

        {/* Outcome */}
        <div className="bg-white dark:bg-zinc-800 rounded-lg p-3 border border-blue-100 dark:border-zinc-700">
          <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1">
            Call Outcome
          </div>
          <div className="text-sm font-semibold text-zinc-900 dark:text-white">
            {summary.outcome || 'Not determined'}
          </div>
        </div>

        {/* Action Items */}
        <div className="bg-white dark:bg-zinc-800 rounded-lg p-3 border border-blue-100 dark:border-zinc-700">
          <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1">
            Action Items
          </div>
          {summary.action_items.length > 0 ? (
            <ul className="space-y-1">
              {summary.action_items.map((item, idx) => (
                <li key={idx} className="text-sm text-zinc-700 dark:text-zinc-300 flex items-start gap-1">
                  <span className="text-blue-500 font-bold">→</span>
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">No action items</p>
          )}
        </div>
      </div>
    </div>
  )
}
