import { createClient } from '@/lib/supabase/server'
import type { AICall, AISummary } from '../types'

export async function getActiveAICalls(): Promise<AICall[]> {
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Get user's company
  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (!membership) throw new Error('No company access')

  // Query active AI calls (agent_id IS NOT NULL)
  const { data, error } = await supabase
    .from('calls')
    .select(
      `
      id, contact_id, phone_number, agent_id, status, started_at, ai_summary,
      contacts (id, first_name, last_name),
      agents (id, name)
    `
    )
    .eq('company_id', membership.company_id)
    .not('agent_id', 'is', null)
    .in('status', ['ringing', 'in_progress'])
    .order('started_at', { ascending: false })
    .limit(20)

  if (error) throw error

  const now = new Date()
  return (data || []).map((call) => {
    const contactData = call.contacts as unknown
    const contact = Array.isArray(contactData) ? contactData[0] : contactData
    const agentData = call.agents as unknown
    const agent = Array.isArray(agentData) ? agentData[0] : agentData

    const startedAt = new Date(call.started_at)
    const durationSeconds = Math.floor((now.getTime() - startedAt.getTime()) / 1000)

    const contactName = contact
      ? `${(contact as { first_name?: string }).first_name || ''} ${(contact as { last_name?: string }).last_name || ''}`.trim() ||
        'Unknown'
      : 'Unknown Contact'

    const agentName = (agent as { name?: string })?.name || 'AI Agent'

    return {
      id: call.id,
      contactId: call.contact_id,
      contactName,
      phoneNumber: call.phone_number || '',
      agentId: call.agent_id || '',
      agentName,
      status: call.status as AICall['status'],
      startedAt: call.started_at,
      durationSeconds,
      aiSummary: call.ai_summary as AISummary | null,
    }
  })
}
