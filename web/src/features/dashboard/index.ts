// Components
export { DashboardPage, StatsCards, RecentCallsList, CallbacksList, QuickDial } from './components'

// Queries
export { getDashboardStats, getRecentCalls, getUpcomingCallbacks } from './queries'

// Types
export type {
  DashboardStats,
  RecentCall,
  UpcomingCallback,
  DashboardPageProps,
  StatsCardsProps,
  RecentCallsListProps,
  CallbacksListProps,
} from './types'

export { defaultStats } from './types'
