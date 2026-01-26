import type {
  NewsfeedCall,
  NewsfeedContact,
  CallNote,
  AISummary,
  CallStatus,
  CallOutcome,
} from './types'

// Database row types (snake_case from Supabase)
export interface NewsfeedCallRow {
  id: string
  direction: string
  phone_number: string
  status: string
  outcome: string | null
  duration_seconds: number
  started_at: string
  contact_id: string | null
  has_recording: boolean
  ai_summary: AISummary | null
  contacts: { id: string; first_name: string; last_name: string; phone: string } | null
  rep: { full_name: string } | null
  call_notes: CallNoteRow[] | null
}

export interface CallNoteRow {
  id: string
  content: string
  note_type: string
  created_at: string
  author: { full_name: string } | null
}

type ContactRow = { id: string; first_name: string; last_name: string; phone: string } | null

function toContact(row: ContactRow): NewsfeedContact | null {
  if (!row) return null
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
  }
}

function toCallNote(row: CallNoteRow): CallNote {
  return {
    id: row.id,
    content: row.content,
    noteType: row.note_type,
    createdAt: row.created_at,
    authorName: row.author?.full_name || null,
  }
}

export function toNewsfeedCall(row: NewsfeedCallRow): NewsfeedCall {
  return {
    id: row.id,
    direction: row.direction as 'inbound' | 'outbound',
    phoneNumber: row.phone_number,
    status: row.status as CallStatus,
    outcome: row.outcome as CallOutcome | null,
    durationSeconds: row.duration_seconds,
    startedAt: row.started_at,
    contactId: row.contact_id,
    contact: toContact(row.contacts),
    repName: row.rep?.full_name || null,
    aiSummary: row.ai_summary,
    hasRecording: row.has_recording,
    notes: (row.call_notes || []).map(toCallNote),
  }
}
