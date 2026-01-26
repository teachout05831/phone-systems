export type CallbackStatus =
  | 'scheduled'
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'rescheduled'
  | 'cancelled'
  | 'exhausted'

export type CallbackPriority = 'high' | 'normal' | 'low'

export interface Callback {
  id: string
  scheduled_at: string
  status: CallbackStatus
  priority: CallbackPriority
  reason: string | null
  notes: string | null
  attempt_count: number
  max_attempts: number
  contact: {
    id: string
    first_name: string
    last_name: string
    phone: string
    business_name: string | null
  }
  assigned_to_profile: {
    id: string
    full_name: string
  } | null
}

export interface ScheduleCallbackInput {
  contactId: string
  scheduledAt: string
  priority?: CallbackPriority
  reason?: string
}

export interface RescheduleCallbackInput {
  callbackId: string
  scheduledAt: string
  reason?: string
}

export interface CancelCallbackInput {
  callbackId: string
  reason: string
}

export interface CompleteCallbackInput {
  callbackId: string
  notes?: string
}

export interface ContactOption {
  id: string
  name: string
  phone: string
  businessName: string | null
}

export interface ActionResult {
  success?: boolean
  error?: string
}
