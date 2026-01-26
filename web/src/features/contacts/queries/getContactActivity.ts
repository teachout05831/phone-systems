import { createClient } from '@/lib/supabase/server'
import type { ContactActivity } from '../types'

interface GetContactActivityOptions {
  limit?: number
  offset?: number
  type?: ContactActivity['type']
}

export async function getContactActivity(
  contactId: string,
  options?: GetContactActivityOptions
): Promise<ContactActivity[]> {
  const supabase = await createClient()

  // SECURITY: Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Get user's company
  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (!membership) throw new Error('No company found')

  // SECURITY: Verify contact belongs to user's company
  const { data: contact } = await supabase
    .from('contacts')
    .select('id, created_at')
    .eq('id', contactId)
    .eq('company_id', membership.company_id)
    .single()

  if (!contact) throw new Error('Contact not found')

  const limit = options?.limit || 50
  const offset = options?.offset || 0
  const activities: ContactActivity[] = []

  // Get calls as activity
  if (!options?.type || options.type === 'call') {
    const { data: calls } = await supabase
      .from('calls')
      .select('id, direction, status, outcome, duration_seconds, started_at, ai_summary')
      .eq('contact_id', contactId)
      .order('started_at', { ascending: false })
      .limit(limit)

    if (calls) {
      for (const call of calls) {
        const outcome = call.outcome || call.status
        const duration = call.duration_seconds
          ? `${Math.floor(call.duration_seconds / 60)}:${(call.duration_seconds % 60).toString().padStart(2, '0')}`
          : null

        activities.push({
          id: `call-${call.id}`,
          type: 'call',
          title: `${call.direction === 'outbound' ? 'Outbound' : 'Inbound'} Call - ${outcome}`,
          description: duration ? `Duration: ${duration}` : null,
          metadata: { callId: call.id, direction: call.direction, outcome },
          createdAt: call.started_at,
          createdBy: null,
          createdByName: null,
        })
      }
    }
  }

  // Get notes as activity (if notes table exists)
  if (!options?.type || options.type === 'note') {
    try {
      const { data: notes } = await supabase
        .from('contact_notes')
        .select('id, content, created_at, created_by')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (notes) {
        for (const note of notes) {
          activities.push({
            id: `note-${note.id}`,
            type: 'note',
            title: 'Note Added',
            description: note.content,
            metadata: { noteId: note.id },
            createdAt: note.created_at,
            createdBy: note.created_by,
            createdByName: null,
          })
        }
      }
    } catch {
      // contact_notes table may not exist yet - skip notes
    }
  }

  // Add contact created activity
  if (!options?.type || options.type === 'created') {
    activities.push({
      id: `created-${contact.id}`,
      type: 'created',
      title: 'Contact Created',
      description: null,
      metadata: null,
      createdAt: contact.created_at,
      createdBy: null,
      createdByName: null,
    })
  }

  // Sort by date descending and apply pagination
  activities.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  return activities.slice(offset, offset + limit)
}
