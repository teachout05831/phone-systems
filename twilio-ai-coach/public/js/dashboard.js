/**
 * Dashboard Page JavaScript
 *
 * Loads and displays dashboard statistics from Supabase.
 * This is a direct port of web/src/features/dashboard/queries/getDashboardStats.ts
 */

// ===========================================
// DATA FETCHING
// ===========================================

/**
 * Get dashboard statistics
 * Direct port from: web/src/features/dashboard/queries/getDashboardStats.ts
 */
async function getDashboardStats() {
  const { companyId, error } = await getCompanyMembership()
  if (error || !companyId) {
    return { totalCalls: 0, connectedCalls: 0, missedCalls: 0, avgDuration: 0, callsTrend: 0 }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayIso = today.toISOString()

  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayIso = yesterday.toISOString()

  // Get today's calls
  const { data: todayCalls } = await supabase
    .from('calls')
    .select('id, status, duration_seconds')
    .eq('company_id', companyId)
    .gte('started_at', todayIso)
    .limit(1000)

  // Get yesterday's call count for trend
  const { count: yesterdayCount } = await supabase
    .from('calls')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .gte('started_at', yesterdayIso)
    .lt('started_at', todayIso)

  const calls = todayCalls || []
  const totalCalls = calls.length
  const connectedCalls = calls.filter(c => c.status === 'connected').length
  const missedCalls = calls.filter(c => c.status === 'missed' || c.status === 'no-answer').length

  // Calculate average duration
  const durations = calls.filter(c => c.duration_seconds && c.duration_seconds > 0).map(c => c.duration_seconds)
  const avgDuration = durations.length > 0
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0

  // Calculate trend
  const callsTrend = totalCalls - (yesterdayCount || 0)

  return {
    totalCalls,
    connectedCalls,
    missedCalls,
    avgDuration,
    callsTrend,
  }
}

/**
 * Get recent activity items
 */
async function getRecentActivity() {
  const { companyId, error } = await getCompanyMembership()
  if (error || !companyId) return []

  const { data: activities } = await supabase
    .from('activity_log')
    .select('id, type, description, created_at, user_id')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(10)

  return activities || []
}

/**
 * Get upcoming callbacks
 */
async function getUpcomingCallbacks() {
  const { companyId, error } = await getCompanyMembership()
  if (error || !companyId) return []

  const now = new Date().toISOString()

  const { data: callbacks } = await supabase
    .from('callbacks')
    .select(`
      id, scheduled_time, notes,
      contact:contacts(id, first_name, last_name, phone)
    `)
    .eq('company_id', companyId)
    .eq('status', 'pending')
    .gte('scheduled_time', now)
    .order('scheduled_time', { ascending: true })
    .limit(5)

  return callbacks || []
}

// ===========================================
// UI RENDERING
// ===========================================

/**
 * Render dashboard stats into the UI
 */
function renderStats(stats) {
  // Total Calls
  const totalCallsEl = document.getElementById('totalCalls')
  if (totalCallsEl) {
    totalCallsEl.textContent = stats.totalCalls
  }

  // Connected Calls
  const connectedCallsEl = document.getElementById('connectedCalls')
  if (connectedCallsEl) {
    connectedCallsEl.textContent = stats.connectedCalls
  }

  // Missed Calls
  const missedCallsEl = document.getElementById('missedCalls')
  if (missedCallsEl) {
    missedCallsEl.textContent = stats.missedCalls
  }

  // Average Duration
  const avgDurationEl = document.getElementById('avgDuration')
  if (avgDurationEl) {
    const minutes = Math.floor(stats.avgDuration / 60)
    const seconds = stats.avgDuration % 60
    avgDurationEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  // Trend indicator
  const trendEl = document.getElementById('callsTrend')
  if (trendEl) {
    const prefix = stats.callsTrend > 0 ? '+' : ''
    trendEl.textContent = `${prefix}${stats.callsTrend} from yesterday`
    trendEl.className = stats.callsTrend >= 0 ? 'trend-up' : 'trend-down'
  }
}

/**
 * Render recent activity list
 */
function renderActivity(activities) {
  const container = document.getElementById('activityList')
  if (!container) return

  if (activities.length === 0) {
    showEmpty(container, 'No recent activity', '📋')
    return
  }

  container.innerHTML = activities.map(activity => `
    <div class="activity-item">
      <span class="activity-icon">${getActivityIcon(activity.type)}</span>
      <div class="activity-content">
        <p class="activity-text">${escapeHtml(activity.description)}</p>
        <span class="activity-time">${timeAgo(activity.created_at)}</span>
      </div>
    </div>
  `).join('')
}

/**
 * Get icon for activity type
 */
function getActivityIcon(type) {
  const icons = {
    call: '📞',
    sms: '💬',
    email: '📧',
    deal: '💰',
    contact: '👤',
    note: '📝',
    default: '📋'
  }
  return icons[type] || icons.default
}

/**
 * Render upcoming callbacks
 */
function renderCallbacks(callbacks) {
  const container = document.getElementById('callbacksList')
  if (!container) return

  if (callbacks.length === 0) {
    showEmpty(container, 'No upcoming callbacks', '🔔')
    return
  }

  container.innerHTML = callbacks.map(callback => {
    const contact = callback.contact?.[0]
    const name = contact
      ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || contact.phone
      : 'Unknown'

    return `
      <div class="callback-item" data-id="${callback.id}">
        <div class="callback-info">
          <span class="callback-name">${escapeHtml(name)}</span>
          <span class="callback-time">${formatDateTime(callback.scheduled_time)}</span>
        </div>
        <button class="btn btn-sm btn-primary" onclick="handleCallCallback('${callback.id}')">
          Call
        </button>
      </div>
    `
  }).join('')
}

// ===========================================
// EVENT HANDLERS
// ===========================================

/**
 * Handle clicking the call button on a callback
 */
async function handleCallCallback(callbackId) {
  // Navigate to call page with callback context
  window.location.href = `call.html?callback=${callbackId}`
}

// ===========================================
// INITIALIZATION
// ===========================================

/**
 * Initialize the dashboard page
 */
async function initDashboard() {
  // Show loading states
  showLoading('#totalCalls', '...')
  showLoading('#activityList')
  showLoading('#callbacksList')

  try {
    // Fetch all data in parallel
    const [stats, activities, callbacks] = await Promise.all([
      getDashboardStats(),
      getRecentActivity(),
      getUpcomingCallbacks()
    ])

    // Render everything
    renderStats(stats)
    renderActivity(activities)
    renderCallbacks(callbacks)

  } catch (error) {
    console.error('Failed to load dashboard:', error)
    showError('#activityList', 'Failed to load activity')
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initPage({
    requireAuth: true,
    onReady: initDashboard,
    onError: (error) => {
      showError('.main-content', 'Failed to load dashboard. Please try again.')
    }
  })
})
