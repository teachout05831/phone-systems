// Call History Feature Types

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

export type CallOutcome =
  | 'booked'
  | 'callback'
  | 'interested'
  | 'not_interested'
  | 'wrong_number'
  | 'do_not_call'
  | 'voicemail_left'
  | 'no_outcome'

export type CallDirection = 'inbound' | 'outbound'

export type SortOption = 'newest' | 'oldest' | 'longest' | 'shortest'

export type DateFilter = 'today' | 'yesterday' | 'week' | 'month' | 'all'

export type Sentiment = 'positive' | 'neutral' | 'negative'

export interface CallContact {
  id: string
  first_name: string | null
  last_name: string | null
  phone: string
  business_name: string | null
}

export interface CallRep {
  id: string
  full_name: string | null
}

export interface CallRecord {
  id: string
  external_call_id: string | null
  direction: CallDirection
  phone_number: string
  status: CallStatus
  duration_seconds: number
  outcome: CallOutcome | null
  has_recording: boolean
  recording_url: string | null
  started_at: string
  ended_at: string | null
  contact: CallContact | null
  rep: CallRep | null
}

export interface TranscriptSegment {
  index: number
  speaker: 'rep' | 'customer'
  text: string
  timestamp: string
}

export interface AISummary {
  overview: string
  sentiment: Sentiment
  outcome: string
  action_items: string[]
}

export interface CallTranscript {
  id: string
  segments: TranscriptSegment[]
  full_text: string
  word_count: number
}

export interface CallDetails extends CallRecord {
  from_number: string | null
  ai_summary: AISummary | null
  transcript: CallTranscript | null
}

export interface CallHistoryFilters {
  date: DateFilter
  status: CallStatus | 'all'
  outcome: CallOutcome | 'all'
  search: string
  sort: SortOption
}

export interface CallHistoryResponse {
  calls: CallRecord[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
