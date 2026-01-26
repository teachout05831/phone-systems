// Queue status types
export type QueueStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'retry_scheduled'

// Priority: 1 = high, 2 = normal
export type QueuePriority = 1 | 2

// Call outcome types
export type QueueOutcome =
  | 'booked'
  | 'callback'
  | 'not_interested'
  | 'no_answer'
  | 'wrong_number'
  | 'voicemail'
  | null

// App-level queue item (camelCase)
export interface QueueItem {
  id: string
  contactId: string
  contactName: string
  phoneNumber: string
  businessName: string | null
  status: QueueStatus
  priority: QueuePriority
  attempts: number
  maxAttempts: number
  outcome: QueueOutcome
  notes: string | null
  scheduledAt: string | null
  addedAt: string
}

// Queue statistics
export interface QueueStats {
  pending: number
  inProgress: number
  completedToday: number
  failedToday: number
  costToday: number
}

// Database row type (snake_case)
export interface QueueItemRow {
  id: string
  company_id: string
  contact_id: string
  status: string
  priority: number
  attempts: number
  max_attempts: number
  outcome: string | null
  notes: string | null
  scheduled_at: string | null
  last_attempt_at: string | null
  created_at: string
  updated_at: string
  contact: {
    id: string
    first_name: string | null
    last_name: string | null
    phone: string
    business_name: string | null
  }
}

// Transform database row to app type
export function toQueueItem(row: QueueItemRow): QueueItem {
  const contact = row.contact
  const firstName = contact.first_name || ''
  const lastName = contact.last_name || ''
  const contactName = `${firstName} ${lastName}`.trim() || 'Unknown'

  return {
    id: row.id,
    contactId: row.contact_id,
    contactName,
    phoneNumber: contact.phone,
    businessName: contact.business_name,
    status: row.status as QueueStatus,
    priority: row.priority as QueuePriority,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    outcome: row.outcome as QueueOutcome,
    notes: row.notes,
    scheduledAt: row.scheduled_at,
    addedAt: row.created_at,
  }
}

// Input types for actions
export interface AddToQueueInput {
  contactIds: string[]
  priority?: QueuePriority
  scheduledAt?: string
}

export interface UpdatePriorityInput {
  itemId: string
  priority: QueuePriority
}

// Action result type
export interface ActionResult {
  success?: boolean
  error?: string
  count?: number
  message?: string
}

// Filter options
export interface QueueFilters {
  status?: QueueStatus | 'all'
  search?: string
}
