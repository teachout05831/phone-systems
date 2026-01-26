// Activity Types
export type ActivityType = 'call' | 'sms' | 'callback'

// Contact info included with activities
export interface ActivityContact {
  id: string
  firstName: string | null
  lastName: string | null
  phone: string
}

// Base activity interface
interface BaseActivity {
  id: string
  type: ActivityType
  timestamp: string
  contactId: string | null
  contact: ActivityContact | null
}

// Call Activity
export interface CallActivity extends BaseActivity {
  type: 'call'
  data: {
    direction: 'inbound' | 'outbound'
    phoneNumber: string
    status: string
    outcome: string | null
    durationSeconds: number
    repName: string | null
  }
}

// SMS Activity
export interface SMSActivity extends BaseActivity {
  type: 'sms'
  data: {
    direction: 'inbound' | 'outbound'
    body: string
    status: string
  }
}

// Callback Activity
export type CallbackStatus =
  | 'scheduled'
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'rescheduled'
  | 'cancelled'
  | 'exhausted'

export interface CallbackActivity extends BaseActivity {
  type: 'callback'
  data: {
    scheduledAt: string
    status: CallbackStatus
    priority: 'high' | 'normal' | 'low'
    reason: string | null
  }
}

// Discriminated union
export type Activity = CallActivity | SMSActivity | CallbackActivity

// Filter types
export interface ActivityFilters {
  types?: ActivityType[]
  dateFrom?: string
  dateTo?: string
  contactId?: string
}

// Pagination
export interface ActivityPagination {
  cursor?: string
  limit: number
}

// API Response
export interface ActivityFeedResponse {
  activities: Activity[]
  nextCursor: string | null
  hasMore: boolean
}
