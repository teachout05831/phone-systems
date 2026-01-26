'use client'

import type { DetectedIssue } from '../hooks/useQADetection'

interface Props {
  issues: DetectedIssue[]
  isOpen: boolean
  onClick: () => void
}

export function QAOverlayBadge({ issues, isOpen, onClick }: Props) {
  const criticalCount = issues.filter(i => i.severity === 'critical').length
  const highCount = issues.filter(i => i.severity === 'high').length

  const bgClass = criticalCount > 0
    ? 'bg-red-600 text-white hover:bg-red-700'
    : highCount > 0
      ? 'bg-orange-500 text-white hover:bg-orange-600'
      : issues.length > 0
        ? 'bg-yellow-500 text-black hover:bg-yellow-600'
        : 'bg-zinc-800 text-white hover:bg-zinc-700'

  return (
    <button
      onClick={onClick}
      className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full px-4 py-2 font-medium shadow-lg transition-all ${bgClass}`}
    >
      <span>QA</span>
      {issues.length > 0 && (
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-sm">
          {issues.length}
        </span>
      )}
    </button>
  )
}
