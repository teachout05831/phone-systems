'use client'

import { useDroppable } from '@dnd-kit/core'
import type { Deal, PipelineStage } from '../types/deals'
import { DealCard } from './DealCard'

interface DealsPipelineColumnProps {
  stage: PipelineStage
  deals: Deal[]
  onViewDeal?: (deal: Deal) => void
  onCallContact?: (phone: string) => void
  onAddDeal?: (stageId: string) => void
}

function formatCurrency(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`
  return `$${value.toFixed(0)}`
}

export function DealsPipelineColumn({
  stage,
  deals,
  onViewDeal,
  onCallContact,
  onAddDeal,
}: DealsPipelineColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
  })

  const totalValue = deals.reduce((sum, d) => sum + d.value, 0)

  return (
    <div
      ref={setNodeRef}
      className={`
        flex-shrink-0 w-72 flex flex-col max-h-[calc(100vh-280px)]
        bg-zinc-100 dark:bg-zinc-800/50 rounded-xl
        ${isOver ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' : ''}
        transition-all duration-200
      `}
    >
      {/* Header */}
      <div
        className="p-3 border-b-2"
        style={{ borderBottomColor: stage.color }}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-zinc-800 dark:text-white flex items-center gap-2">
            {stage.isClosedWon && '🏆 '}
            {stage.isClosedLost && '❌ '}
            {stage.name}
            <span className="text-xs font-normal bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 px-2 py-0.5 rounded-full">
              {deals.length}
            </span>
          </h3>
        </div>
        <div className="text-sm text-zinc-500 dark:text-zinc-400">
          {formatCurrency(totalValue)}
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {deals.map((deal) => (
          <DealCard
            key={deal.id}
            deal={deal}
            onView={onViewDeal}
            onCall={onCallContact}
          />
        ))}

        {deals.length === 0 && (
          <div className="text-center py-6 text-sm text-zinc-400 dark:text-zinc-500">
            No deals in this stage
          </div>
        )}
      </div>

      {/* Add Deal Button */}
      {onAddDeal && !stage.isClosedWon && !stage.isClosedLost && (
        <div className="p-2 border-t border-zinc-200 dark:border-zinc-700">
          <button
            onClick={() => onAddDeal(stage.id)}
            className="w-full py-2 border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-lg text-sm text-zinc-500 dark:text-zinc-400 hover:border-blue-500 hover:text-blue-500 dark:hover:border-blue-400 dark:hover:text-blue-400 transition-colors"
          >
            + Add Deal
          </button>
        </div>
      )}
    </div>
  )
}
