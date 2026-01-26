// SMS Conversation
export interface SMSConversation {
  id: string
  companyId: string
  contactId: string | null
  phoneNumber: string
  lastMessageAt: string | null
  lastMessagePreview: string | null
  unreadCount: number
  messageCount: number
  status: 'active' | 'archived' | 'blocked'
  createdAt: string
  updatedAt: string
  // Joined from contact
  contact?: {
    id: string
    firstName: string | null
    lastName: string | null
    email: string | null
    phone: string
  }
}

// SMS Message
export interface SMSMessage {
  id: string
  conversationId: string
  companyId: string
  contactId: string | null
  direction: 'inbound' | 'outbound'
  fromNumber: string
  toNumber: string
  body: string
  twilioSid: string | null
  status: SMSMessageStatus
  errorCode: string | null
  errorMessage: string | null
  sentAt: string | null
  deliveredAt: string | null
  senderId: string | null
  createdAt: string
  updatedAt: string
}

export type SMSMessageStatus =
  | 'pending'
  | 'queued'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'undelivered'
  | 'received'

// SMS Template
export interface SMSTemplate {
  id: string
  companyId: string
  name: string
  body: string
  category: SMSTemplateCategory
  useCount: number
  lastUsedAt: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type SMSTemplateCategory =
  | 'general'
  | 'followup'
  | 'appointment'
  | 'reminder'
  | 'greeting'
  | 'closing'

// Input types for actions
export interface SendMessageInput {
  contactId?: string
  phoneNumber?: string
  body: string
  templateId?: string
}

export interface CreateTemplateInput {
  name: string
  body: string
  category?: SMSTemplateCategory
}

export interface UpdateTemplateInput {
  name?: string
  body?: string
  category?: SMSTemplateCategory
  isActive?: boolean
}

// Query filter types
export interface ConversationFilters {
  status?: 'active' | 'archived' | 'blocked'
  search?: string
  hasUnread?: boolean
}

export interface MessageFilters {
  direction?: 'inbound' | 'outbound'
  status?: SMSMessageStatus
}

// Database row types (snake_case from Supabase)
export interface SMSConversationRow {
  id: string
  company_id: string
  contact_id: string | null
  phone_number: string
  last_message_at: string | null
  last_message_preview: string | null
  unread_count: number
  message_count: number
  status: string
  created_at: string
  updated_at: string
}

export interface SMSMessageRow {
  id: string
  conversation_id: string
  company_id: string
  contact_id: string | null
  direction: string
  from_number: string
  to_number: string
  body: string
  twilio_sid: string | null
  status: string
  error_code: string | null
  error_message: string | null
  sent_at: string | null
  delivered_at: string | null
  sender_id: string | null
  created_at: string
  updated_at: string
}

export interface SMSTemplateRow {
  id: string
  company_id: string
  name: string
  body: string
  category: string
  use_count: number
  last_used_at: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// Transform functions
export function toSMSConversation(row: SMSConversationRow): SMSConversation {
  return {
    id: row.id,
    companyId: row.company_id,
    contactId: row.contact_id,
    phoneNumber: row.phone_number,
    lastMessageAt: row.last_message_at,
    lastMessagePreview: row.last_message_preview,
    unreadCount: row.unread_count,
    messageCount: row.message_count,
    status: row.status as SMSConversation['status'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toSMSMessage(row: SMSMessageRow): SMSMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    companyId: row.company_id,
    contactId: row.contact_id,
    direction: row.direction as SMSMessage['direction'],
    fromNumber: row.from_number,
    toNumber: row.to_number,
    body: row.body,
    twilioSid: row.twilio_sid,
    status: row.status as SMSMessageStatus,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    sentAt: row.sent_at,
    deliveredAt: row.delivered_at,
    senderId: row.sender_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toSMSTemplate(row: SMSTemplateRow): SMSTemplate {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    body: row.body,
    category: row.category as SMSTemplateCategory,
    useCount: row.use_count,
    lastUsedAt: row.last_used_at,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
