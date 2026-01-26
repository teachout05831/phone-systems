import { createClient } from '@/lib/supabase/server'
import {
  toDeal,
  type Deal,
  type DealsByStage,
  type DealFilters,
  type PipelineStats,
} from '../types/deals'

interface GetDealsResult {
  deals: DealsByStage
  stats: PipelineStats
}

export async function getDeals(filters?: DealFilters): Promise<GetDealsResult> {
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
    .from('deals')
    .select(`
      id, company_id, contact_id, stage_id, title, value, priority, source,
      expected_close_date, notes, created_by, assigned_to, closed_at,
      created_at, updated_at,
      contact:contacts(id, first_name, last_name, phone, business_name)
    `)
    .eq('company_id', membership.company_id)

  // Apply filters
  if (filters?.stageId) {
    query = query.eq('stage_id', filters.stageId)
  }

  if (filters?.priority) {
    query = query.eq('priority', filters.priority)
  }

  if (filters?.source) {
    query = query.eq('source', filters.source)
  }

  if (filters?.dateRange && filters.dateRange !== 'all') {
    const now = new Date()
    let startDate: Date

    switch (filters.dateRange) {
      case 'today':
        startDate = new Date(now.setHours(0, 0, 0, 0))
        break
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7))
        break
      case 'month':
        startDate = new Date(now.setMonth(now.getMonth() - 1))
        break
      case 'quarter':
        startDate = new Date(now.setMonth(now.getMonth() - 3))
        break
      default:
        startDate = new Date(0)
    }
    query = query.gte('created_at', startDate.toISOString())
  }

  if (filters?.search) {
    query = query.ilike('title', `%${filters.search}%`)
  }

  query = query.order('created_at', { ascending: false }).limit(500)

  const { data, error } = await query

  if (error) throw error

  // Transform and group by stage
  const allDeals = (data || []).map(toDeal)
  const dealsByStage: DealsByStage = {}

  for (const deal of allDeals) {
    if (!dealsByStage[deal.stageId]) {
      dealsByStage[deal.stageId] = []
    }
    dealsByStage[deal.stageId].push(deal)
  }

  // Calculate stats
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)

  const totalDeals = allDeals.length
  const newThisWeek = allDeals.filter(
    (d) => new Date(d.createdAt) >= weekAgo
  ).length
  const totalValue = allDeals.reduce((sum, d) => sum + d.value, 0)
  const closedWonDeals = allDeals.filter((d) => d.closedAt !== null)
  const conversionRate =
    totalDeals > 0 ? Math.round((closedWonDeals.length / totalDeals) * 100) : 0

  return {
    deals: dealsByStage,
    stats: {
      totalDeals,
      newThisWeek,
      totalValue,
      conversionRate,
    },
  }
}
