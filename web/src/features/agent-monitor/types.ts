// ===== AI Call Types =====
export type AICallStatus = 'ringing' | 'in_progress' | 'completed'

export interface AICall {
  id: string
  contactId: string | null
  contactName: string
  phoneNumber: string
  agentId: string
  agentName: string
  status: AICallStatus
  startedAt: string
  durationSeconds: number
  aiSummary: AISummary | null
}

// ===== AI Summary Types =====
export type Sentiment = 'positive' | 'neutral' | 'negative'

export interface AISummary {
  sentiment: Sentiment
  intent: string
  confidence: number
  summary: string
}

// ===== Transcript Types =====
export type Speaker = 'agent' | 'customer'

export interface TranscriptSegment {
  speaker: Speaker
  text: string
  timestamp: string
}

// ===== Hook Types =====
export interface UseAgentMonitorProps {
  initialCalls: AICall[]
  pollingInterval?: number
}

export interface UseAgentMonitorReturn {
  calls: AICall[]
  selectedCall: AICall | null
  transcript: TranscriptSegment[]
  isRefreshing: boolean
  isLoadingTranscript: boolean
  error: string | null
  selectCall: (callId: string) => void
  clearSelection: () => void
  endCall: (callId: string) => Promise<{ success?: boolean; error?: string }>
  refresh: () => Promise<void>
}

// ===== Component Props =====
export interface MonitorPageProps {
  initialCalls: AICall[]
}

export interface ActiveCallsListProps {
  calls: AICall[]
  selectedCallId: string | null
  onSelectCall: (callId: string) => void
}

export interface CallCardProps {
  call: AICall
  isSelected: boolean
  onSelect: () => void
}

export interface CallDetailsPanelProps {
  call: AICall | null
  transcript: TranscriptSegment[]
  isLoadingTranscript: boolean
  onEndCall: () => void
  onClearSelection: () => void
}

export interface LiveTranscriptProps {
  transcript: TranscriptSegment[]
  isLoading: boolean
}

export interface AIAnalysisProps {
  aiSummary: AISummary | null
}
