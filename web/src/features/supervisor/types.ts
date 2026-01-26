// ===== User Role Types =====
export type UserRole = 'admin' | 'manager' | 'rep' | 'closer'

export interface UserRoleResult {
  role: UserRole | null
  hasAccess: boolean
}

// ===== Metrics Types =====
export interface TeamMetrics {
  callsToday: number
  callsByRep: RepCallCount[]
  averageCallDuration: number
  conversionRate: number
  smsSentToday: number
}

export interface RepCallCount {
  repId: string
  repName: string
  callCount: number
}

// ===== Active Calls Types =====
export interface ActiveCall {
  id: string
  repId: string
  repName: string
  contactId: string | null
  contactName: string
  phoneNumber: string
  direction: 'inbound' | 'outbound'
  startedAt: string
  durationSeconds: number
}

// ===== Leaderboard Types =====
export interface LeaderboardEntry {
  rank: number
  repId: string
  repName: string
  avatarUrl: string | null
  callsMade: number
  dealsBooked: number
  conversionRate: number
}

// ===== Dashboard Props =====
export interface SupervisorDashboardProps {
  initialMetrics: TeamMetrics
  initialActiveCalls: ActiveCall[]
  initialLeaderboard: LeaderboardEntry[]
}

// ===== Hook Types =====
export interface UseSupervisorDashboardProps {
  initialMetrics: TeamMetrics
  initialActiveCalls: ActiveCall[]
  initialLeaderboard: LeaderboardEntry[]
  pollingInterval?: number
}

export interface UseSupervisorDashboardReturn {
  metrics: TeamMetrics
  activeCalls: ActiveCall[]
  leaderboard: LeaderboardEntry[]
  isRefreshing: boolean
  lastUpdated: Date | null
  error: string | null
  refresh: () => Promise<void>
}

// ===== Default Values =====
export const defaultMetrics: TeamMetrics = {
  callsToday: 0,
  callsByRep: [],
  averageCallDuration: 0,
  conversionRate: 0,
  smsSentToday: 0,
}
