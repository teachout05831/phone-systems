'use client'

import { useState, useEffect } from 'react'
import { useQADetection } from '../hooks/useQADetection'
import { QAOverlayBadge } from './QAOverlayBadge'
import { QAOverlayPanel } from './QAOverlayPanel'

export function QAOverlay() {
  const [isOpen, setIsOpen] = useState(false)

  const isQAEnabled =
    process.env.NEXT_PUBLIC_QA_ENABLED === 'true' ||
    process.env.NODE_ENV === 'development'

  const { issues, isSyncing, lastSync, syncIssues, clearSynced } = useQADetection(isQAEnabled)

  // Auto-sync every 30 seconds
  useEffect(() => {
    if (!isQAEnabled) return
    const interval = setInterval(syncIssues, 30000)
    return () => clearInterval(interval)
  }, [isQAEnabled, syncIssues])

  if (!isQAEnabled) return null

  const unsyncedCount = issues.filter(i => !i.synced).length

  return (
    <>
      <QAOverlayBadge
        issues={issues}
        isOpen={isOpen}
        onClick={() => setIsOpen(!isOpen)}
      />

      {isOpen && (
        <QAOverlayPanel
          issues={issues}
          isSyncing={isSyncing}
          lastSync={lastSync}
          unsyncedCount={unsyncedCount}
          onSync={syncIssues}
          onClearSynced={clearSynced}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  )
}
