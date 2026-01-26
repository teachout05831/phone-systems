// Contact-based Pipeline Components (legacy)
export { PipelineBoard } from './components'

// Deals-based Pipeline Components
export { DealsPipelinePage, DealCard, DealsPipelineColumn, AddDealModal } from './components'

// Hooks
export { usePipeline, useDealsPipeline } from './hooks'

// Queries
export { getContactsByStatus, getStages, getDeals } from './queries'

// Actions
export { updateContactStatus, createDeal, updateDealStage, deleteDeal } from './actions'

// Contact-based Types (legacy)
export type { PipelineContact, PipelineStatus, ContactsByStatus } from './types'

// Deals-based Types
export type {
  Deal,
  DealsByStage,
  PipelineStage,
  PipelineStats,
  DealPriority,
  DealSource,
  CreateDealInput,
  UpdateDealInput,
  DealFilters,
} from './types/deals'
