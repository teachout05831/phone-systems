import { createClient } from '@/lib/supabase/server'
import type { SMSTemplate, SMSTemplateCategory } from '../types'
import { toSMSTemplate } from '../types'

export async function getTemplates(
  category?: SMSTemplateCategory
): Promise<SMSTemplate[]> {
  const supabase = await createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Get user's company
  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (!membership) throw new Error('No company access')

  // Build query
  let query = supabase
    .from('sms_templates')
    .select(`
      id, company_id, name, body, category,
      use_count, last_used_at, is_active, created_at, updated_at
    `)
    .eq('company_id', membership.company_id)
    .eq('is_active', true)
    .order('use_count', { ascending: false })
    .limit(50)

  // Apply category filter
  if (category) {
    query = query.eq('category', category)
  }

  const { data, error } = await query

  if (error) throw error

  return (data || []).map((row) => toSMSTemplate(row as never))
}
