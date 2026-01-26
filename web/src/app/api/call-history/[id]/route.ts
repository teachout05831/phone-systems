import { NextRequest, NextResponse } from 'next/server'
import { getCallDetails } from '@/features/call-history/queries/getCallDetails'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { error: 'Call ID is required' },
        { status: 400 }
      )
    }

    const call = await getCallDetails(id)

    if (!call) {
      return NextResponse.json(
        { error: 'Call not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(call)
  } catch (error) {
    console.error('Error fetching call details:', error)
    return NextResponse.json(
      { error: 'Failed to fetch call details' },
      { status: 500 }
    )
  }
}
