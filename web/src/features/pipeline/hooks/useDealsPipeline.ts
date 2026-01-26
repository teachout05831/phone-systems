'use client'

import { useState, useCallback, useTransition } from 'react'
import type { Deal, DealsByStage, PipelineStage, PipelineStats } from '../types/deals'
import { updateDealStage } from '../actions/updateDealStage'
import { deleteDeal } from '../actions/deleteDeal'

interface UseDealsPipelineProps {
  initialDeals: DealsByStage
  initialStats: PipelineStats
  stages: PipelineStage[]
}

interface UseDealsPipelineReturn {
  deals: DealsByStage
  stats: PipelineStats
  stages: PipelineStage[]
  moveDeal: (dealId: string, fromStageId: string, toStageId: string) => void
  removeDeal: (dealId: string, stageId: string) => Promise<boolean>
  addDeal: (deal: Deal) => void
  isUpdating: boolean
  error: string | null
  clearError: () => void
}

export function useDealsPipeline({
  initialDeals,
  initialStats,
  stages,
}: UseDealsPipelineProps): UseDealsPipelineReturn {
  const [deals, setDeals] = useState(initialDeals)
  const [stats, setStats] = useState(initialStats)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const moveDeal = useCallback(
    (dealId: string, fromStageId: string, toStageId: string) => {
      if (fromStageId === toStageId) return

      // Find the deal in source column
      const sourceDeal = deals[fromStageId]?.find((d) => d.id === dealId)
      if (!sourceDeal) return

      // Optimistic update: move immediately for smooth UX
      setDeals((prev) => {
        const newDeals = { ...prev }

        // Remove from source
        newDeals[fromStageId] = (prev[fromStageId] || []).filter(
          (d) => d.id !== dealId
        )

        // Add to destination
        const movedDeal = { ...sourceDeal, stageId: toStageId }
        newDeals[toStageId] = [movedDeal, ...(prev[toStageId] || [])]

        return newDeals
      })

      // Server update in transition (non-blocking)
      startTransition(async () => {
        const result = await updateDealStage(dealId, toStageId)

        if (result.error) {
          // Revert on error
          setDeals((prev) => {
            const newDeals = { ...prev }
            newDeals[fromStageId] = [sourceDeal, ...(prev[fromStageId] || [])]
            newDeals[toStageId] = (prev[toStageId] || []).filter(
              (d) => d.id !== dealId
            )
            return newDeals
          })
          setError(result.error)
        }
      })
    },
    [deals]
  )

  const removeDeal = useCallback(
    async (dealId: string, stageId: string): Promise<boolean> => {
      const deal = deals[stageId]?.find((d) => d.id === dealId)
      if (!deal) return false

      // Optimistic update
      setDeals((prev) => ({
        ...prev,
        [stageId]: (prev[stageId] || []).filter((d) => d.id !== dealId),
      }))

      setStats((prev) => ({
        ...prev,
        totalDeals: prev.totalDeals - 1,
        totalValue: prev.totalValue - deal.value,
      }))

      const result = await deleteDeal(dealId)

      if (result.error) {
        // Revert on error
        setDeals((prev) => ({
          ...prev,
          [stageId]: [deal, ...(prev[stageId] || [])],
        }))
        setStats((prev) => ({
          ...prev,
          totalDeals: prev.totalDeals + 1,
          totalValue: prev.totalValue + deal.value,
        }))
        setError(result.error)
        return false
      }

      return true
    },
    [deals]
  )

  const addDeal = useCallback((deal: Deal) => {
    setDeals((prev) => ({
      ...prev,
      [deal.stageId]: [deal, ...(prev[deal.stageId] || [])],
    }))

    setStats((prev) => ({
      ...prev,
      totalDeals: prev.totalDeals + 1,
      newThisWeek: prev.newThisWeek + 1,
      totalValue: prev.totalValue + deal.value,
    }))
  }, [])

  const clearError = useCallback(() => setError(null), [])

  return {
    deals,
    stats,
    stages,
    moveDeal,
    removeDeal,
    addDeal,
    isUpdating: isPending,
    error,
    clearError,
  }
}
