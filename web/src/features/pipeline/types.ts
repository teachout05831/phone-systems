// Pipeline status constants (visible in Kanban - 6 columns)
export const PIPELINE_STATUSES = [
  'new',
  'contacted',
  'engaged',
  'qualified',
  'closed_won',
  'closed_lost',
] as const

export type PipelineStatus = (typeof PIPELINE_STATUSES)[number]

// Full contact status type from database
export type ContactStatus =
  | 'new'
  | 'contacted'
  | 'engaged'
  | 'qualified'
  | 'nurturing'
  | 'closed_won'
  | 'closed_lost'
  | 'do_not_contact'

// Pipeline contact (subset of full contact for Kanban display)
export interface PipelineContact {
  id: string
  firstName: string | null
  lastName: string | null
  phone: string
  businessName: string | null
  status: ContactStatus
  lastActivityAt: string | null
}

// Database row type (snake_case from Supabase)
export interface ContactRow {
  id: string
  first_name: string | null
  last_name: string | null
  phone: string
  business_name: string | null
  status: string
  updated_at: string
}

// Contacts grouped by status for Kanban columns
export type ContactsByStatus = Record<PipelineStatus, PipelineContact[]>

// Column display configuration
export interface ColumnConfig {
  id: PipelineStatus
  title: string
  color: string
}

export const COLUMN_CONFIGS: ColumnConfig[] = [
  { id: 'new', title: 'New', color: 'bg-blue-500' },
  { id: 'contacted', title: 'Contacted', color: 'bg-yellow-500' },
  { id: 'engaged', title: 'Engaged', color: 'bg-purple-500' },
  { id: 'qualified', title: 'Qualified', color: 'bg-green-500' },
  { id: 'closed_won', title: 'Closed Won', color: 'bg-emerald-500' },
  { id: 'closed_lost', title: 'Closed Lost', color: 'bg-red-500' },
]

// Transform function: database row -> app type
export function toPipelineContact(row: ContactRow): PipelineContact {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    businessName: row.business_name,
    status: row.status as ContactStatus,
    lastActivityAt: row.updated_at,
  }
}
