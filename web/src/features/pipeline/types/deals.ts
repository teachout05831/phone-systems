// Deal-based Pipeline Types

export type DealPriority = 'hot' | 'warm' | 'cold'

export type DealSource = 'manual' | 'facebook' | 'google' | 'website' | 'referral' | 'other'

// Pipeline Stage from database
export interface PipelineStage {
  id: string
  name: string
  slug: string
  color: string
  position: number
  isClosedWon: boolean
  isClosedLost: boolean
}

// Database row type for stage (snake_case from Supabase)
export interface StageRow {
  id: string
  company_id: string
  name: string
  slug: string
  color: string
  position: number
  is_closed_won: boolean
  is_closed_lost: boolean
}

// Contact info for deal
export interface DealContact {
  id: string
  firstName: string | null
  lastName: string | null
  phone: string
  businessName: string | null
}

// Deal from database
export interface Deal {
  id: string
  stageId: string
  contactId: string | null
  title: string
  value: number
  priority: DealPriority
  source: DealSource
  expectedCloseDate: string | null
  notes: string | null
  createdBy: string | null
  assignedTo: string | null
  closedAt: string | null
  createdAt: string
  updatedAt: string
  contact: DealContact | null
}

// Database row type for deal (snake_case from Supabase)
export interface DealRow {
  id: string
  company_id: string
  contact_id: string | null
  stage_id: string
  title: string
  value: number
  priority: string
  source: string
  expected_close_date: string | null
  notes: string | null
  created_by: string | null
  assigned_to: string | null
  closed_at: string | null
  created_at: string
  updated_at: string
  contact?: {
    id: string
    first_name: string | null
    last_name: string | null
    phone: string
    business_name: string | null
  }[] | null
}

// Deals grouped by stage for Kanban
export type DealsByStage = Record<string, Deal[]>

// Pipeline stats
export interface PipelineStats {
  totalDeals: number
  newThisWeek: number
  totalValue: number
  conversionRate: number
}

// Input for creating a deal
export interface CreateDealInput {
  title: string
  stageId: string
  contactId?: string
  value?: number
  priority?: DealPriority
  source?: DealSource
  expectedCloseDate?: string
  notes?: string
  assignedTo?: string
}

// Input for updating a deal
export interface UpdateDealInput {
  title?: string
  stageId?: string
  value?: number
  priority?: DealPriority
  expectedCloseDate?: string | null
  notes?: string
  assignedTo?: string | null
}

// Filter options for deals
export interface DealFilters {
  stageId?: string
  priority?: DealPriority
  source?: DealSource
  dateRange?: 'all' | 'today' | 'week' | 'month' | 'quarter'
  search?: string
}

// Transform functions
export function toStage(row: StageRow): PipelineStage {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    color: row.color,
    position: row.position,
    isClosedWon: row.is_closed_won,
    isClosedLost: row.is_closed_lost,
  }
}

export function toDeal(row: DealRow): Deal {
  return {
    id: row.id,
    stageId: row.stage_id,
    contactId: row.contact_id,
    title: row.title,
    value: Number(row.value) || 0,
    priority: row.priority as DealPriority,
    source: row.source as DealSource,
    expectedCloseDate: row.expected_close_date,
    notes: row.notes,
    createdBy: row.created_by,
    assignedTo: row.assigned_to,
    closedAt: row.closed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    contact: row.contact && row.contact.length > 0
      ? {
          id: row.contact[0].id,
          firstName: row.contact[0].first_name,
          lastName: row.contact[0].last_name,
          phone: row.contact[0].phone,
          businessName: row.contact[0].business_name,
        }
      : null,
  }
}
