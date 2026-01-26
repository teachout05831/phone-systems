// Contact Types

export interface Contact {
  id: string
  firstName: string | null
  lastName: string | null
  phone: string
  phoneSecondary: string | null
  email: string | null
  businessName: string | null
  jobTitle: string | null
  website: string | null
  source: ContactSource | null
  status: ContactStatus
  notes: string | null
  tags: string[]
  companyId: string
  createdBy: string | null
  assignedTo: string | null
  createdAt: string
  updatedAt: string
}

export type ContactStatus =
  | 'new'
  | 'contacted'
  | 'engaged'
  | 'qualified'
  | 'closed_won'
  | 'closed_lost'
  | 'do_not_contact'

export type ContactSource =
  | 'facebook_ads'
  | 'google_ads'
  | 'website'
  | 'referral'
  | 'cold_email'
  | 'import'
  | 'manual'
  | 'other'

export interface ContactFilters {
  search?: string
  status?: ContactStatus
  source?: ContactSource
  dateRange?: 'today' | 'week' | 'month' | 'all'
  limit?: number
  offset?: number
}

export interface CreateContactInput {
  firstName?: string
  lastName?: string
  phone: string
  phoneSecondary?: string
  email?: string
  businessName?: string
  jobTitle?: string
  website?: string
  source?: ContactSource
  notes?: string
  tags?: string[]
  assignedTo?: string
}

export interface UpdateContactInput {
  firstName?: string
  lastName?: string
  phone?: string
  phoneSecondary?: string
  email?: string
  businessName?: string
  jobTitle?: string
  website?: string
  source?: ContactSource
  status?: ContactStatus
  notes?: string
  tags?: string[]
  assignedTo?: string
}

export interface ContactCall {
  id: string
  direction: 'inbound' | 'outbound'
  status: string
  outcome: string | null
  durationSeconds: number | null
  startedAt: string
  endedAt: string | null
  recordingUrl: string | null
  transcriptUrl: string | null
  aiSummary: string | null
}

export interface ContactActivity {
  id: string
  type: 'call' | 'note' | 'email' | 'stage_change' | 'created' | 'updated'
  title: string
  description: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
  createdBy: string | null
  createdByName: string | null
}

export interface ContactNote {
  id: string
  content: string
  isPinned: boolean
  createdAt: string
  createdBy: string
  createdByName: string | null
}

export interface ContactStats {
  totalCalls: number
  connectedCalls: number
  totalTalkTime: number
  lastContactedAt: string | null
}

// Database row types (snake_case from Supabase)
export interface ContactRow {
  id: string
  first_name: string | null
  last_name: string | null
  phone: string
  phone_secondary: string | null
  email: string | null
  business_name: string | null
  job_title: string | null
  website: string | null
  source: string | null
  status: string
  notes: string | null
  tags: string[] | null
  company_id: string
  created_by: string | null
  assigned_to: string | null
  created_at: string
  updated_at: string
}

export interface CallRow {
  id: string
  direction: string
  status: string
  outcome: string | null
  duration_seconds: number | null
  started_at: string
  ended_at: string | null
  recording_url: string | null
  transcript_url: string | null
  ai_summary: unknown
}

// Transform functions
export function transformContact(row: ContactRow): Contact {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    phoneSecondary: row.phone_secondary,
    email: row.email,
    businessName: row.business_name,
    jobTitle: row.job_title,
    website: row.website,
    source: row.source as ContactSource | null,
    status: row.status as ContactStatus,
    notes: row.notes,
    tags: row.tags || [],
    companyId: row.company_id,
    createdBy: row.created_by,
    assignedTo: row.assigned_to,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function transformCall(row: CallRow): ContactCall {
  return {
    id: row.id,
    direction: row.direction as 'inbound' | 'outbound',
    status: row.status,
    outcome: row.outcome,
    durationSeconds: row.duration_seconds,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    recordingUrl: row.recording_url,
    transcriptUrl: row.transcript_url,
    aiSummary: typeof row.ai_summary === 'object' && row.ai_summary !== null
      ? (row.ai_summary as { summary?: string }).summary || null
      : null,
  }
}
