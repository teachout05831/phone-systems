'use server'

import { getCallTranscript } from '../queries/getCallTranscript'
import type { TranscriptSegment } from '../types'

interface FetchResult {
  transcript: TranscriptSegment[] | null
  error: string | null
}

export async function fetchTranscript(callId: string): Promise<FetchResult> {
  if (!callId) return { transcript: null, error: 'Call ID is required' }

  try {
    const transcript = await getCallTranscript(callId)
    return { transcript, error: null }
  } catch (err) {
    return {
      transcript: null,
      error: err instanceof Error ? err.message : 'Failed to fetch transcript',
    }
  }
}
