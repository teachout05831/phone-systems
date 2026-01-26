// Call status from database
export type CallStatus =
  | 'initiated'
  | 'ringing'
  | 'in_progress'
  | 'completed'
  | 'missed'
  | 'no_answer'
  | 'busy'
  | 'failed'
  | 'voicemail'

// Database outcome values
export type CallOutcome =
  | 'booked'
  | 'callback'
  | 'interested'
  | 'not_interested'
  | 'wrong_number'
  | 'do_not_call'
  | 'voicemail_left'
  | 'no_outcome'

// UI tag labels (mapped to CallOutcome in actions)
export type NewsfeedTag =
  | 'booked'
  | 'estimate'
  | 'question'
  | 'current_customer'
  | 'not_interested'

// Contact info
export interface NewsfeedContact {
  id: string
  firstName: string | null
  lastName: string | null
  phone: string
}

// AI Summary structure (from JSONB)
export interface AISummary {
  summary: string
  keyPoints?: string[]
  sentiment?: string
}

// Call note
export interface CallNote {
  id: string
  content: string
  noteType: string
  createdAt: string
  authorName: string | null
}

// Main newsfeed call item
export interface NewsfeedCall {
  id: string
  direction: 'inbound' | 'outbound'
  phoneNumber: string
  status: CallStatus
  outcome: CallOutcome | null
  durationSeconds: number
  startedAt: string
  contactId: string | null
  contact: NewsfeedContact | null
  repName: string | null
  aiSummary: AISummary | null
  hasRecording: boolean
  notes: CallNote[]
}

// Filter type for newsfeed
export type NewsfeedFilter = 'all' | 'needs_action' | 'booked' | 'estimates' | 'missed'

// Stats for header
export interface NewsfeedStats {
  totalCalls: number
  booked: number
  estimates: number
  needsAction: number
  missed: number
}

// Pagination
export interface NewsfeedPagination {
  cursor?: string
  limit: number
}

// Response type
export interface NewsfeedResponse {
  calls: NewsfeedCall[]
  stats: NewsfeedStats
  nextCursor: string | null
  hasMore: boolean
}
