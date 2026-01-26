import { NextRequest, NextResponse } from 'next/server'
import { getActivities } from '@/features/activity/queries'
import type { ActivityFilters, ActivityPagination } from '@/features/activity/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const filters = body.filters as ActivityFilters | undefined
    const pagination = body.pagination as ActivityPagination | undefined

    const result = await getActivities(filters, pagination)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const status = message === 'Not authenticated' ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
