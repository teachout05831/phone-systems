'use server'

import { createClient } from '@/lib/supabase/server'

interface AddNoteInput {
  callId: string
  content: string
  noteType?: 'general' | 'handoff' | 'followup'
}

interface ActionResult {
  success?: boolean
  error?: string
  noteId?: string
}

export async function addCallNote(input: AddNoteInput): Promise<ActionResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (!membership) return { error: 'No company access' }

  if (!input.callId || typeof input.callId !== 'string') return { error: 'Call ID is required' }
  if (!input.content || typeof input.content !== 'string') return { error: 'Note content is required' }

  const content = input.content.trim()
  if (content.length === 0) return { error: 'Note content cannot be empty' }
  if (content.length > 1000) return { error: 'Note must be less than 1000 characters' }

  const validTypes = ['general', 'handoff', 'followup']
  if (input.noteType && !validTypes.includes(input.noteType)) return { error: 'Invalid note type' }

  const { data: call } = await supabase
    .from('calls')
    .select('id, contact_id')
    .eq('id', input.callId)
    .eq('company_id', membership.company_id)
    .single()

  if (!call) return { error: 'Call not found' }

  const { data: note, error } = await supabase
    .from('call_notes')
    .insert({
      call_id: input.callId,
      contact_id: call.contact_id,
      author_id: user.id,
      note_type: input.noteType || 'general',
      content: content,
    })
    .select('id')
    .single()

  if (error) {
    console.error('addCallNote error:', error)
    return { error: 'Failed to add note' }
  }

  return { success: true, noteId: note.id }
}
