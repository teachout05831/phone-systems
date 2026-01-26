// ===== Dashboard Stats Types =====
export interface DashboardStats {
  totalCalls: number
  connectedCalls: number
  missedCalls: number
  avgDuration: number
  callsTrend: number // vs yesterday
}

// ===== Recent Call Types =====
export interface RecentCall {
  id: string
  contact_id: string | null
  phone_number: string
  direction: 'inbound' | 'outbound'
  status: 'connected' | 'missed' | 'no-answer' | 'busy' | 'voicemail'
  duration: number | null
  started_at: string
  contact: {
    id: string
    first_name: string
    last_name: string
    business_name: string | null
  } | null
}

// ===== Upcoming Callback Types =====
export interface UpcomingCallback {
  id: string
  scheduled_at: string
  priority: 'high' | 'normal' | 'low'
  reason: string | null
  contact: {
    id: string
    first_name: string
    last_name: string
    phone: string
    business_name: string | null
  }
}

// ===== Component Props =====
export interface DashboardPageProps {
  initialStats: DashboardStats
  initialRecentCalls: RecentCall[]
  initialCallbacks: UpcomingCallback[]
}

export interface StatsCardsProps {
  stats: DashboardStats
}

export interface RecentCallsListProps {
  calls: RecentCall[]
  onRefresh?: () => void
}

export interface CallbacksListProps {
  callbacks: UpcomingCallback[]
  onCallNow?: (callback: UpcomingCallback) => void
}

// ===== Default Values =====
export const defaultStats: DashboardStats = {
  totalCalls: 0,
  connectedCalls: 0,
  missedCalls: 0,
  avgDuration: 0,
  callsTrend: 0,
}
