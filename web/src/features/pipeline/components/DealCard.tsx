'use client'

import { useDraggable } from '@dnd-kit/core'
import type { Deal } from '../types/deals'

interface DealCardProps {
  deal: Deal
  onView?: (deal: Deal) => void
  onCall?: (phone: string) => void
  isOverlay?: boolean
}

const priorityStyles = {
  hot: 'border-l-red-500 bg-red-50 dark:bg-red-900/10',
  warm: 'border-l-amber-500 bg-amber-50 dark:bg-amber-900/10',
  cold: 'border-l-blue-500 bg-blue-50 dark:bg-blue-900/10',
}

const priorityBadge = {
  hot: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  warm: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  cold: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
}

const sourceStyles: Record<string, string> = {
  facebook: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  google: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  website: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  referral: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  manual: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-400',
  other: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-400',
}

function formatCurrency(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`
  return `$${value.toFixed(0)}`
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffHours < 1) return 'Just now'
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function DealCard({ deal, onView, onCall, isOverlay = false }: DealCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
    data: { deal },
    disabled: isOverlay,
  })

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined

  const contactName = deal.contact
    ? `${deal.contact.firstName || ''} ${deal.contact.lastName || ''}`.trim() || 'Unknown'
    : deal.title

  const businessName = deal.contact?.businessName

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`
        rounded-lg p-3 border-l-4 cursor-grab active:cursor-grabbing
        shadow-sm hover:shadow-md transition-all duration-200
        ${priorityStyles[deal.priority]}
        ${isDragging ? 'opacity-50 scale-105' : ''}
        ${isOverlay ? 'shadow-xl rotate-2' : ''}
      `}
      onClick={(e) => {
        if (onView && !isDragging) {
          e.stopPropagation()
          onView(deal)
        }
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0 flex-1">
          <h4 className="font-medium text-zinc-900 dark:text-white truncate">
            {deal.title}
          </h4>
          {businessName && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate">
              {businessName}
            </p>
          )}
        </div>
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${priorityBadge[deal.priority]}`}
        >
          {deal.priority.charAt(0).toUpperCase() + deal.priority.slice(1)}
        </span>
      </div>

      {/* Details */}
      <div className="space-y-1 text-sm text-zinc-600 dark:text-zinc-400 mb-3">
        {deal.contact?.phone && (
          <div className="flex items-center gap-1.5">
            <span>📞</span>
            <span className="truncate">{deal.contact.phone}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <span>💰</span>
          <span className="font-medium text-zinc-900 dark:text-white">
            {formatCurrency(deal.value)}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-zinc-200 dark:border-zinc-700">
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${sourceStyles[deal.source]}`}
        >
          {deal.source.charAt(0).toUpperCase() + deal.source.slice(1)}
        </span>
        <span className="text-xs text-zinc-400 dark:text-zinc-500">
          {formatDate(deal.createdAt)}
        </span>
      </div>

      {/* Quick Actions (on hover) */}
      {onCall && deal.contact?.phone && (
        <div className="mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onCall(deal.contact!.phone)
            }}
            className="w-full text-xs py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-md transition-colors"
          >
            📞 Call Now
          </button>
        </div>
      )}
    </div>
  )
}
