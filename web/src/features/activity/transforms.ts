import type {
  CallActivity,
  SMSActivity,
  CallbackActivity,
  CallbackStatus,
  ActivityContact,
} from './types'

// Database row types (snake_case)
export interface CallRow {
  id: string
  direction: string
  phone_number: string
  status: string
  outcome: string | null
  duration_seconds: number
  started_at: string
  contact_id: string | null
  contacts: { id: string; first_name: string; last_name: string; phone: string } | null
  rep: { full_name: string } | null
}

export interface SMSMessageRow {
  id: string
  direction: string
  body: string
  status: string
  created_at: string
  contact_id: string | null
  contacts: { id: string; first_name: string; last_name: string; phone: string } | null
}

export interface CallbackRow {
  id: string
  scheduled_at: string
  status: string
  priority: string
  reason: string | null
  contact_id: string | null
  contacts: { id: string; first_name: string; last_name: string; phone: string } | null
}

type ContactRow = { id: string; first_name: string; last_name: string; phone: string } | null

function toContact(row: ContactRow): ActivityContact | null {
  if (!row) return null
  return { id: row.id, firstName: row.first_name, lastName: row.last_name, phone: row.phone }
}

export function toCallActivity(row: CallRow): CallActivity {
  return {
    id: row.id,
    type: 'call',
    timestamp: row.started_at,
    contactId: row.contact_id,
    contact: toContact(row.contacts),
    data: {
      direction: row.direction as 'inbound' | 'outbound',
      phoneNumber: row.phone_number,
      status: row.status,
      outcome: row.outcome,
      durationSeconds: row.duration_seconds,
      repName: row.rep?.full_name || null,
    },
  }
}

export function toSMSActivity(row: SMSMessageRow): SMSActivity {
  return {
    id: row.id,
    type: 'sms',
    timestamp: row.created_at,
    contactId: row.contact_id,
    contact: toContact(row.contacts),
    data: {
      direction: row.direction as 'inbound' | 'outbound',
      body: row.body,
      status: row.status,
    },
  }
}

export function toCallbackActivity(row: CallbackRow): CallbackActivity {
  return {
    id: row.id,
    type: 'callback',
    timestamp: row.scheduled_at,
    contactId: row.contact_id,
    contact: toContact(row.contacts),
    data: {
      scheduledAt: row.scheduled_at,
      status: row.status as CallbackStatus,
      priority: row.priority as 'high' | 'normal' | 'low',
      reason: row.reason,
    },
  }
}
