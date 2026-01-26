import { NextRequest, NextResponse } from 'next/server'
import { getCallHistory } from '@/features/call-history/queries/getCallHistory'
import type { CallHistoryFilters, CallRecord } from '@/features/call-history/types'

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function escapeCSV(value: string | null | undefined): string {
  if (!value) return ''
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function formatCallToCSV(call: CallRecord): string {
  const contactName = call.contact
    ? `${call.contact.first_name || ''} ${call.contact.last_name || ''}`.trim()
    : ''

  return [
    escapeCSV(call.phone_number),
    escapeCSV(contactName),
    escapeCSV(call.direction),
    escapeCSV(call.status),
    escapeCSV(call.outcome || ''),
    formatDuration(call.duration_seconds),
    escapeCSV(call.started_at),
    call.has_recording ? 'Yes' : 'No',
    escapeCSV(call.rep?.full_name || '')
  ].join(',')
}

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

    // Get all pages for export (up to 1000 records)
    const data = await getCallHistory(filters, 1)

    const headers = [
      'Phone Number',
      'Contact Name',
      'Direction',
      'Status',
      'Outcome',
      'Duration',
      'Date',
      'Has Recording',
      'Rep'
    ].join(',')

    const rows = data.calls.map(formatCallToCSV)
    const csv = [headers, ...rows].join('\n')

    const timestamp = new Date().toISOString().split('T')[0]

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="call-history-${timestamp}.csv"`
      }
    })
  } catch (error) {
    console.error('Error exporting call history:', error)
    return NextResponse.json(
      { error: 'Failed to export call history' },
      { status: 500 }
    )
  }
}
