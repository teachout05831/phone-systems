'use client'

import type { CallOutcome, NewsfeedTag } from '../types'

interface Props {
  currentOutcome: CallOutcome | null
  onTag: (tag: NewsfeedTag | null) => void
  disabled?: boolean
}

interface TagConfig {
  tag: NewsfeedTag
  label: string
  icon: string
  outcome: CallOutcome
  colors: string
  selectedColors: string
}

const tags: TagConfig[] = [
  { tag: 'booked', label: 'Booked', icon: '✅', outcome: 'booked',
    colors: 'text-green-700 dark:text-green-400 hover:border-green-500',
    selectedColors: 'bg-green-50 border-green-500 dark:bg-green-900/30' },
  { tag: 'estimate', label: 'Gave Estimate', icon: '💰', outcome: 'interested',
    colors: 'text-blue-700 dark:text-blue-400 hover:border-blue-500',
    selectedColors: 'bg-blue-50 border-blue-500 dark:bg-blue-900/30' },
  { tag: 'question', label: 'Question', icon: '❓', outcome: 'callback',
    colors: 'text-purple-700 dark:text-purple-400 hover:border-purple-500',
    selectedColors: 'bg-purple-50 border-purple-500 dark:bg-purple-900/30' },
  { tag: 'current_customer', label: 'Current Customer', icon: '👤', outcome: 'no_outcome',
    colors: 'text-cyan-700 dark:text-cyan-400 hover:border-cyan-500',
    selectedColors: 'bg-cyan-50 border-cyan-500 dark:bg-cyan-900/30' },
  { tag: 'not_interested', label: 'Not Interested', icon: '❌', outcome: 'not_interested',
    colors: 'text-zinc-600 dark:text-zinc-400 hover:border-zinc-400',
    selectedColors: 'bg-zinc-100 border-zinc-400 dark:bg-zinc-700' },
]

export function QuickTagButtons({ currentOutcome, onTag, disabled }: Props) {
  const needsAction = !currentOutcome

  const handleClick = (config: TagConfig) => {
    if (disabled) return
    const isSelected = currentOutcome === config.outcome
    onTag(isSelected ? null : config.tag)
  }

  return (
    <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/50">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
          {needsAction ? '⚠️ Tag this call:' : 'Outcome:'}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {tags.map((config) => {
          const isSelected = currentOutcome === config.outcome
          return (
            <button
              key={config.tag}
              onClick={() => handleClick(config)}
              disabled={disabled}
              className={`flex items-center gap-1.5 rounded-md border-2 px-3 py-1.5 text-sm font-medium transition-all ${
                isSelected
                  ? `${config.selectedColors} ${config.colors}`
                  : `border-zinc-200 bg-white dark:border-zinc-600 dark:bg-zinc-800 ${config.colors}`
              } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
            >
              <span>{config.icon}</span>
              <span>{config.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
