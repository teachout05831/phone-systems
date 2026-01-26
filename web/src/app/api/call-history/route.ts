import { NextRequest, NextResponse } from 'next/server'
import { getCallHistory } from '@/features/call-history/queries/getCallHistory'
import type { CallHistoryFilters } from '@/features/call-history/types'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const filters: Partial<CallHistoryFilters> = {
      date: (searchParams.get('date') as CallHistoryFilters['date']) || 'all',
      status: (searchParams.get('status') as CallHistoryFilters['status']) || 'all',
      outcome: (searchParams.get('outcome') as CallHistoryFilters['outcome']) || 'all',
      search: searchParams.get('search') || '',
      sort: (searchParams.get('sort') as CallHistoryFilters['sort']) || 'newest'
    }

    const page = parseInt(searchParams.get('page') || '1', 10)

    const data = await getCallHistory(filters, page)

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching call history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch call history' },
      { status: 500 }
    )
  }
}
