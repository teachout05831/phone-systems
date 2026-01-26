'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCenter } from '@dnd-kit/core'
import type { Deal, DealsByStage, PipelineStage, PipelineStats } from '../types/deals'
import { useDealsPipeline } from '../hooks/useDealsPipeline'
import { DealsPipelineColumn } from './DealsPipelineColumn'
import { DealCard } from './DealCard'
import { AddDealModal } from './AddDealModal'

interface DealsPipelinePageProps {
  initialDeals: DealsByStage
  initialStats: PipelineStats
  stages: PipelineStage[]
}

function formatCurrency(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`
  return `$${value.toFixed(0)}`
}

export function DealsPipelinePage({
  initialDeals,
  initialStats,
  stages,
}: DealsPipelinePageProps) {
  const router = useRouter()
  const {
    deals,
    stats,
    stages: pipelineStages,
    moveDeal,
    addDeal,
    isUpdating,
    error,
    clearError,
  } = useDealsPipeline({ initialDeals, initialStats, stages })

  const [activeDeal, setActiveDeal] = useState<Deal | null>(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [addModalStageId, setAddModalStageId] = useState<string | undefined>()

  const handleDragStart = (event: DragStartEvent) => {
    const deal = event.active.data.current?.deal as Deal | undefined
    if (deal) setActiveDeal(deal)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDeal(null)
    const { active, over } = event

    if (!over) return

    const dealId = active.id as string
    const deal = active.data.current?.deal as Deal | undefined
    const toStageId = over.id as string

    if (deal && deal.stageId !== toStageId) {
      moveDeal(dealId, deal.stageId, toStageId)
    }
  }

  const handleCallContact = (phone: string) => {
    router.push(`/call?number=${encodeURIComponent(phone)}`)
  }

  const handleAddDeal = (stageId: string) => {
    setAddModalStageId(stageId)
    setIsAddModalOpen(true)
  }

  const handleExport = () => {
    window.open('/api/pipeline/export', '_blank')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            Sales Pipeline
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Track and manage your deals through the sales process
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="px-4 py-2 text-sm bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors"
          >
            📤 Export
          </button>
          <button
            onClick={() => {
              setAddModalStageId(pipelineStages[0]?.id)
              setIsAddModalOpen(true)
            }}
            className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            + Add Deal
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 shadow-sm">
          <div className="text-2xl font-bold text-zinc-900 dark:text-white">
            {stats.totalDeals}
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase">
            Total Deals
          </div>
        </div>
        <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 shadow-sm">
          <div className="text-2xl font-bold text-zinc-900 dark:text-white">
            {stats.newThisWeek}
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase">
            New This Week
          </div>
        </div>
        <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 shadow-sm">
          <div className="text-2xl font-bold text-zinc-900 dark:text-white">
            {stats.conversionRate}%
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase">
            Conversion Rate
          </div>
        </div>
        <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 shadow-sm">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {formatCurrency(stats.totalValue)}
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase">
            Pipeline Value
          </div>
        </div>
      </div>

      {/* Error Toast */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center justify-between">
          <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
          <button
            onClick={clearError}
            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Loading Indicator */}
      {isUpdating && (
        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <span className="text-sm text-blue-600 dark:text-blue-400">
            Updating...
          </span>
        </div>
      )}

      {/* Kanban Board */}
      <DndContext
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4">
          {pipelineStages.map((stage) => (
            <DealsPipelineColumn
              key={stage.id}
              stage={stage}
              deals={deals[stage.id] || []}
              onCallContact={handleCallContact}
              onAddDeal={handleAddDeal}
            />
          ))}
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeDeal ? <DealCard deal={activeDeal} isOverlay /> : null}
        </DragOverlay>
      </DndContext>

      {/* Add Deal Modal */}
      <AddDealModal
        isOpen={isAddModalOpen}
        stages={pipelineStages}
        defaultStageId={addModalStageId}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={addDeal}
      />
    </div>
  )
}
