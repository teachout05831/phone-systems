'use server'

import { getActiveAICalls } from '../queries/getActiveAICalls'
import type { AICall } from '../types'

interface RefreshResult {
  calls: AICall[] | null
  error: string | null
}

export async function refreshMonitor(): Promise<RefreshResult> {
  try {
    const calls = await getActiveAICalls()
    return { calls, error: null }
  } catch (err) {
    return {
      calls: null,
      error: err instanceof Error ? err.message : 'Failed to refresh',
    }
  }
}
