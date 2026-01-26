'use client'

import { useAgentMonitor } from '../hooks/useAgentMonitor'
import { ActiveCallsList } from './ActiveCallsList'
import { CallDetailsPanel } from './CallDetailsPanel'
import type { MonitorPageProps } from '../types'

export function MonitorPage({ initialCalls }: MonitorPageProps) {
  const {
    calls,
    selectedCall,
    transcript,
    isLoadingTranscript,
    selectCall,
    clearSelection,
    endCall,
  } = useAgentMonitor({ initialCalls })

  const handleEndCall = async () => {
    if (selectedCall) {
      await endCall(selectedCall.id)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-4 h-[calc(100vh-140px)]">
      <ActiveCallsList
        calls={calls}
        selectedCallId={selectedCall?.id || null}
        onSelectCall={selectCall}
      />
      <CallDetailsPanel
        call={selectedCall}
        transcript={transcript}
        isLoadingTranscript={isLoadingTranscript}
        onEndCall={handleEndCall}
        onClearSelection={clearSelection}
      />
    </div>
  )
}
