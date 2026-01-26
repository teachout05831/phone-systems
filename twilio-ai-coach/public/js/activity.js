/**
 * Activity Page JavaScript
 *
 * Displays activity feed with filters for calls, SMS, and status changes.
 * Follows security patterns from CODING_STANDARDS.md:
 * - Auth check first
 * - Filter by company_id
 * - Only select needed fields
 * - Use .limit() for lists
 * - escapeHtml() for XSS prevention
 */

// ===========================================
// STATE
// ===========================================
let activities = []
let currentFilter = 'all'
let currentDateRange = 'week'
let currentOffset = 0
const PAGE_SIZE = 50
let isLoading = false
let hasMore = true

// Filter counts
let filterCounts = {
  all: 0,
  calls: 0,
  sms: 0,
  status: 0
}

// ===========================================
// INITIALIZATION
// ===========================================

document.addEventListener('DOMContentLoaded', () => {
  initPage({
    requireAuth: true,
    onReady: async (user) => {
      // Update user display
      if (user) {
        const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'
        const userNameEl = document.getElementById('userName')
        const userAvatarEl = document.getElementById('userAvatar')
        if (userNameEl) userNameEl.textContent = name
        if (userAvatarEl) userAvatarEl.textContent = name.charAt(0).toUpperCase()
      }

      // Load initial data
      await loadActivity()

      // Set up event listeners
      setupEventListeners()
    },
    onError: (error) => {
      console.error('Activity page init error:', error)
      showError('#activityTimeline', 'Failed to load activity feed')
    }
  })
})

// ===========================================
// DATA LOADING
// ===========================================

/**
 * Load activity data from Supabase
 * Security: Filters by company_id, uses .limit(), selects specific fields
 *
 * NOTE: Activities are loaded from multiple source tables (calls, sms_messages)
 * and combined into a unified activity feed.
 */
async function loadActivity(append = false) {
  if (isLoading) return
  isLoading = true

  try {
    const { companyId, error: membershipError } = await getCompanyMembership()
    if (membershipError || !companyId) {
      showError('#activityTimeline', 'Unable to load activity. Please try again.')
      return
    }

    // Calculate date range filter
    const dateFilter = getDateRangeFilter(currentDateRange)

    // Load data from actual source tables
    const allActivities = []

    // Load calls if filter includes calls or all
    if (currentFilter === 'all' || currentFilter === 'calls') {
      const callsData = await loadCallsAsActivities(companyId, dateFilter)
      console.log('Calls loaded:', callsData.length, 'Filter:', currentFilter)
      if (callsData.length > 0) {
        console.log('First call:', JSON.stringify(callsData[0]))
      }
      allActivities.push(...callsData)
      console.log('After adding calls, allActivities:', allActivities.length)
    }

    // Load SMS if filter includes sms or all
    if (currentFilter === 'all' || currentFilter === 'sms') {
      const smsData = await loadSmsAsActivities(companyId, dateFilter)
      console.log('SMS loaded:', smsData.length, 'Filter:', currentFilter)
      allActivities.push(...smsData)
      console.log('After adding SMS, allActivities:', allActivities.length)
    }

    // Load other activities (status changes, etc.) from activity_log if filter includes status or all
    if (currentFilter === 'all' || currentFilter === 'status') {
      const statusData = await loadStatusActivities(companyId, dateFilter)
      console.log('Status loaded:', statusData.length, 'Filter:', currentFilter)
      allActivities.push(...statusData)
      console.log('After adding status, allActivities:', allActivities.length)
    }

    // Debug: Log all activities before sorting
    console.log('All activities before sort:', allActivities.length)
    console.log('Activity types breakdown:', allActivities.reduce((acc, a) => {
      acc[a.entity_type] = (acc[a.entity_type] || 0) + 1
      return acc
    }, {}))

    // Sort all activities by created_at descending
    allActivities.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

    // Apply pagination
    const startIndex = append ? currentOffset : 0
    const endIndex = startIndex + PAGE_SIZE
    const paginatedActivities = allActivities.slice(startIndex, endIndex)

    // Check if there's more data
    hasMore = allActivities.length > endIndex

    if (append) {
      activities = [...activities, ...paginatedActivities]
    } else {
      activities = paginatedActivities
      currentOffset = 0
    }

    // Render the activity feed
    renderActivityFeed()

    // Update filter counts (only on initial load)
    if (!append) {
      await updateFilterCountsFromData(companyId, dateFilter)
    }

  } catch (error) {
    console.error('Activity load error:', error)
    showError('#activityTimeline', 'Failed to load activity feed')
  } finally {
    isLoading = false
  }
}

/**
 * Load calls and transform them into activity format
 */
async function loadCallsAsActivities(companyId, dateFilter) {
  try {
    // First try with all columns including notes (added in migration 00012)
    let query = supabase
      .from('calls')
      .select(`
        id,
        direction,
        status,
        outcome,
        duration_seconds,
        notes,
        ai_summary,
        phone_number,
        started_at,
        contact_id
      `)
      .eq('company_id', companyId)
      .order('started_at', { ascending: false })
      .limit(100)

    if (dateFilter) {
      query = query.gte('started_at', dateFilter)
    }

    let { data, error } = await query

    // If notes column doesn't exist, try without it
    if (error && error.message && error.message.includes('notes')) {
      console.log('Notes column not found, trying without it...')
      query = supabase
        .from('calls')
        .select(`
          id,
          direction,
          status,
          outcome,
          duration_seconds,
          ai_summary,
          phone_number,
          started_at,
          contact_id
        `)
        .eq('company_id', companyId)
        .order('started_at', { ascending: false })
        .limit(100)

      if (dateFilter) {
        query = query.gte('started_at', dateFilter)
      }

      const result = await query
      data = result.data
      error = result.error
    }

    if (error) {
      console.error('Error loading calls for activity:', error)
      return []
    }

    console.log(`Loaded ${(data || []).length} calls for activity feed`)

    // Load contacts for calls that have contact_id
    const contactIds = [...new Set((data || []).filter(c => c.contact_id).map(c => c.contact_id))]
    let contactsMap = {}

    if (contactIds.length > 0) {
      const { data: contacts, error: contactsError } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, business_name, phone')
        .in('id', contactIds)

      if (contactsError) {
        console.error('Error loading contacts for calls:', contactsError)
      } else if (contacts) {
        contactsMap = contacts.reduce((acc, c) => { acc[c.id] = c; return acc }, {})
      }
    }

    // Add contact info to calls
    const callsWithContacts = (data || []).map(call => ({
      ...call,
      contact: call.contact_id ? contactsMap[call.contact_id] : null
    }))

    // Transform calls into activity format
    return callsWithContacts.map(call => {
      let action = 'call_made'
      if (call.direction === 'inbound') {
        // Treat initiated/ringing inbound calls as missed (call was not answered)
        const missedStatuses = ['missed', 'no-answer', 'no_answer', 'initiated', 'ringing']
        action = missedStatuses.includes(call.status) ? 'call_missed' : 'call_received'
      } else {
        action = call.status === 'missed' || call.status === 'no-answer' ? 'call_missed' : 'call_made'
      }

      // Ensure we have a valid date - use started_at or fallback to now
      const createdAt = call.started_at || new Date().toISOString()

      return {
        id: call.id,
        action: action,
        entity_type: 'call',
        entity_id: call.id,
        created_at: createdAt,
        contact: call.contact,
        metadata: {
          duration: call.duration_seconds,
          outcome: call.outcome,
          notes: call.notes || null,
          summary: call.ai_summary,
          phone_number: call.phone_number,
          status: call.status
        }
      }
    })
  } catch (err) {
    console.error('Exception loading calls for activity:', err)
    return []
  }
}

/**
 * Load SMS messages and transform them into activity format
 */
async function loadSmsAsActivities(companyId, dateFilter) {
  try {
    // Try loading from sms_messages with conversation join
    let query = supabase
      .from('sms_messages')
      .select(`
        id,
        direction,
        body,
        status,
        created_at,
        contact_id,
        from_number,
        to_number,
        contact:contacts(id, first_name, last_name, business_name, phone)
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (dateFilter) {
      query = query.gte('created_at', dateFilter)
    }

    const { data, error } = await query

    if (error) {
      // SMS table might not exist or have different structure
      console.log('SMS messages not available:', error.message)
      return []
    }

    console.log(`Loaded ${(data || []).length} SMS messages for activity feed`)

    // Transform SMS into activity format
    return (data || []).map(sms => ({
      id: sms.id,
      action: sms.direction === 'outbound' ? 'sms_sent' : 'sms_received',
      entity_type: 'sms',
      entity_id: sms.id,
      created_at: sms.created_at,
      contact: sms.contact || null,
      metadata: {
        message: sms.body,
        status: sms.status,
        phone_number: sms.direction === 'outbound' ? sms.to_number : sms.from_number
      }
    }))
  } catch (err) {
    console.log('Error loading SMS activities:', err)
    return []
  }
}

/**
 * Load status change activities from activity_log
 * Note: Schema may vary - some have 'action' column, others have 'activity_type'
 */
async function loadStatusActivities(companyId, dateFilter) {
  try {
    // First try with 'action' column (newer schema from migration 00008)
    let query = supabase
      .from('activity_log')
      .select(`
        id,
        action,
        entity_type,
        entity_id,
        contact_id,
        metadata,
        created_at
      `)
      .eq('company_id', companyId)
      .in('action', ['status_changed', 'pipeline_moved', 'deal_won', 'deal_lost', 'note_added', 'callback_scheduled'])
      .order('created_at', { ascending: false })
      .limit(50)

    if (dateFilter) {
      query = query.gte('created_at', dateFilter)
    }

    const { data, error } = await query

    if (error) {
      // Try fallback with 'activity_type' column (older schema from migration 00001)
      console.log('Activity log query failed, trying fallback:', error.message)

      let fallbackQuery = supabase
        .from('activity_log')
        .select(`
          id,
          activity_type,
          contact_id,
          description,
          metadata,
          created_at
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (dateFilter) {
        fallbackQuery = fallbackQuery.gte('created_at', dateFilter)
      }

      const { data: fallbackData, error: fallbackError } = await fallbackQuery

      if (fallbackError) {
        console.log('Activity log fallback also failed:', fallbackError.message)
        return []
      }

      console.log(`Loaded ${(fallbackData || []).length} activities from activity_log (fallback schema)`)

      // Transform fallback data to expected format
      return (fallbackData || []).map(item => ({
        id: item.id,
        action: item.activity_type || 'unknown',
        entity_type: 'contact',
        entity_id: item.contact_id,
        contact_id: item.contact_id,
        metadata: item.metadata || { description: item.description },
        created_at: item.created_at
      }))
    }

    console.log(`Loaded ${(data || []).length} activities from activity_log`)

    // Load contacts for activities that have contact_id
    const contactIds = [...new Set((data || []).filter(a => a.contact_id).map(a => a.contact_id))]
    let contactsMap = {}

    if (contactIds.length > 0) {
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, business_name, phone')
        .in('id', contactIds)

      if (contacts) {
        contactsMap = contacts.reduce((acc, c) => { acc[c.id] = c; return acc }, {})
      }
    }

    // Add contact info to activities
    return (data || []).map(item => ({
      ...item,
      contact: item.contact_id ? contactsMap[item.contact_id] : null
    }))
  } catch (err) {
    console.log('Error loading status activities:', err)
    return []
  }
}

/**
 * Update filter counts based on actual data
 */
async function updateFilterCountsFromData(companyId, dateFilter) {
  try {
    // Count calls
    let callsQuery = supabase
      .from('calls')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)

    if (dateFilter) {
      callsQuery = callsQuery.gte('started_at', dateFilter)
    }

    const { count: callsCount, error: callsError } = await callsQuery
    if (callsError) console.log('Error counting calls:', callsError.message)

    // Count SMS
    let smsCount = 0
    try {
      let smsQuery = supabase
        .from('sms_messages')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)

      if (dateFilter) {
        smsQuery = smsQuery.gte('created_at', dateFilter)
      }

      const { count, error: smsError } = await smsQuery
      if (smsError) {
        console.log('Error counting SMS:', smsError.message)
      } else {
        smsCount = count || 0
      }
    } catch (e) {
      console.log('SMS table may not exist:', e.message)
    }

    // Count status activities - try both schema versions
    let statusCount = 0
    try {
      let statusQuery = supabase
        .from('activity_log')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)

      if (dateFilter) {
        statusQuery = statusQuery.gte('created_at', dateFilter)
      }

      const { count, error: statusError } = await statusQuery
      if (statusError) {
        console.log('Error counting activities:', statusError.message)
      } else {
        statusCount = count || 0
      }
    } catch (e) {
      console.log('Activity log table may not exist:', e.message)
    }

    filterCounts = {
      all: (callsCount || 0) + smsCount + statusCount,
      calls: callsCount || 0,
      sms: smsCount,
      status: statusCount
    }

    // Update UI
    updateFilterChipCounts()

  } catch (error) {
    console.error('Error updating filter counts:', error)
  }
}

/**
 * Get ISO date string for date range filter
 */
function getDateRangeFilter(range) {
  const now = new Date()
  let filterDate = new Date()

  switch (range) {
    case 'today':
      filterDate.setHours(0, 0, 0, 0)
      break
    case 'week':
      filterDate.setDate(now.getDate() - 7)
      break
    case 'month':
      filterDate.setMonth(now.getMonth() - 1)
      break
    case 'all':
      return null
    default:
      filterDate.setDate(now.getDate() - 7)
  }

  return filterDate.toISOString()
}


/**
 * Update filter chip count badges
 */
function updateFilterChipCounts() {
  document.querySelectorAll('.filter-chip').forEach(chip => {
    const filter = chip.dataset.filter
    const countEl = chip.querySelector('.chip-count')
    if (countEl && filterCounts[filter] !== undefined) {
      countEl.textContent = filterCounts[filter]
    }
  })
}

// ===========================================
// RENDERING
// ===========================================

/**
 * Render the activity feed grouped by day
 * Security: Uses escapeHtml() for all user content
 */
function renderActivityFeed() {
  const container = document.getElementById('activityTimeline')

  console.log('Rendering activity feed, total activities:', activities.length)
  console.log('Activities to render:', activities.map(a => ({ type: a.entity_type, action: a.action, id: a.id })))

  if (!activities || activities.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚡</div>
        <div class="empty-state-title">No activity yet</div>
        <div class="empty-state-text">Activity will appear here as you make calls, send messages, and update contacts.</div>
      </div>
    `
    updateLoadMoreButton()
    return
  }

  // Group activities by day
  const groupedActivities = groupByDay(activities)
  console.log('Grouped activities by day:', Object.keys(groupedActivities), 'Total groups:', Object.keys(groupedActivities).length)
  Object.entries(groupedActivities).forEach(([dateKey, items]) => {
    console.log(`  ${dateKey}: ${items.length} items -`, items.map(i => i.entity_type))
  })

  // Render each day group
  let html = ''
  for (const [dateKey, dayActivities] of Object.entries(groupedActivities)) {
    console.log(`Rendering day ${dateKey} with ${dayActivities.length} activities`)
    html += `
      <div class="activity-day">
        <div class="activity-day-header">${formatDayHeader(dateKey)}</div>
        <div class="activity-list">
          ${dayActivities.map(activity => renderActivityItem(activity)).join('')}
        </div>
      </div>
    `
  }

  console.log('Final HTML length:', html.length, 'Activity item count in HTML:', (html.match(/activity-item/g) || []).length)
  container.innerHTML = html
  updateLoadMoreButton()
}

/**
 * Get user's configured timezone from localStorage or default to browser's timezone
 */
function getUserTimezone() {
  return localStorage.getItem('userTimezone') || Intl.DateTimeFormat().resolvedOptions().timeZone
}

/**
 * Group activities by date (using user's configured timezone)
 */
function groupByDay(activityList) {
  const groups = {}
  const timezone = getUserTimezone()

  activityList.forEach(activity => {
    const date = new Date(activity.created_at)
    // Format date in user's timezone to get correct YYYY-MM-DD
    const dateKey = date.toLocaleDateString('en-CA', { timeZone: timezone }) // en-CA gives YYYY-MM-DD format

    if (!groups[dateKey]) {
      groups[dateKey] = []
    }
    groups[dateKey].push(activity)
  })

  return groups
}

/**
 * Format day header (using user's configured timezone)
 */
function formatDayHeader(dateKey) {
  const timezone = getUserTimezone()
  // Parse the YYYY-MM-DD dateKey and create a date at noon in the user's timezone
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(year, month - 1, day, 12, 0, 0)

  // Get today and yesterday in user's timezone for comparison
  const now = new Date()
  const todayKey = now.toLocaleDateString('en-CA', { timeZone: timezone })
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayKey = yesterday.toLocaleDateString('en-CA', { timeZone: timezone })

  const formattedDate = date.toLocaleDateString('en-US', {
    timeZone: timezone,
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })

  if (dateKey === todayKey) {
    return `Today - ${formattedDate}`
  } else if (dateKey === yesterdayKey) {
    return `Yesterday - ${formattedDate}`
  } else {
    return date.toLocaleDateString('en-US', {
      timeZone: timezone,
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })
  }
}

/**
 * Render a single activity item
 * Security: All user content passed through escapeHtml()
 */
function renderActivityItem(activity) {
  const { icon, iconClass, title, description, meta } = getActivityDisplay(activity)
  const time = formatActivityTime(activity.created_at)

  return `
    <div class="activity-item" data-type="${getActivityType(activity.action)}" data-id="${escapeHtml(activity.id)}">
      <div class="activity-icon ${iconClass}">${icon}</div>
      <div class="activity-content">
        <div class="activity-main">
          <div class="activity-title">${title}</div>
          <span class="activity-time">${escapeHtml(time)}</span>
        </div>
        ${description ? `<div class="activity-description">${escapeHtml(description)}</div>` : ''}
        ${meta ? `<div class="activity-meta">${meta}</div>` : ''}
        ${renderActivityPreview(activity)}
      </div>
    </div>
  `
}

/**
 * Get display properties for an activity
 * Security: Contact names escaped, onclick uses safe IDs
 */
function getActivityDisplay(activity) {
  const contactName = getContactName(activity.contact)
  const contactId = activity.contact?.id || activity.entity_id
  const metadata = activity.metadata || {}

  // Safe onclick handler with validated ID
  const contactLink = contactId
    ? `<span class="contact-name" onclick="goToContact('${escapeHtml(String(contactId))}')">${escapeHtml(contactName)}</span>`
    : escapeHtml(contactName)

  switch (activity.action) {
    // Call activities
    case 'call_made':
      return {
        icon: '📞',
        iconClass: 'call',
        title: `Outbound call to ${contactLink}`,
        description: metadata.summary || metadata.notes || null,
        meta: buildCallMeta(metadata)
      }

    case 'call_received':
      return {
        icon: '📞',
        iconClass: 'call',
        title: `Inbound call from ${contactLink}`,
        description: metadata.summary || metadata.notes || null,
        meta: buildCallMeta(metadata)
      }

    case 'call_missed':
      return {
        icon: '📞',
        iconClass: 'callback',
        title: `Missed call from ${contactLink}`,
        description: metadata.voicemail ? 'Voicemail left' : null,
        meta: `<span class="outcome-badge negative">Missed</span>${metadata.business ? `<span>📍 ${escapeHtml(metadata.business)}</span>` : ''}`
      }

    case 'callback_scheduled':
      return {
        icon: '🔔',
        iconClass: 'callback',
        title: `Callback scheduled with ${contactLink}`,
        description: metadata.notes || null,
        meta: metadata.scheduled_time ? `<span>📅 ${escapeHtml(formatDateTime(metadata.scheduled_time))}</span>` : ''
      }

    // SMS activities
    case 'sms_sent':
      return {
        icon: '💬',
        iconClass: 'sms',
        title: `SMS sent to ${contactLink}`,
        description: null,
        meta: `<span>✓ ${metadata.status === 'delivered' ? 'Delivered' : 'Sent'}</span>`
      }

    case 'sms_received':
      return {
        icon: '💬',
        iconClass: 'sms',
        title: `SMS from ${contactLink}`,
        description: null,
        meta: null
      }

    // Status activities
    case 'status_changed':
      return {
        icon: '🔄',
        iconClass: 'status',
        title: `${contactLink} status changed`,
        description: metadata.from && metadata.to
          ? `${escapeHtml(metadata.from)} → ${escapeHtml(metadata.to)}`
          : null,
        meta: null
      }

    case 'pipeline_moved':
      return {
        icon: '📈',
        iconClass: 'pipeline',
        title: `${contactLink} moved to ${escapeHtml(metadata.stage || 'new stage')}`,
        description: metadata.from && metadata.to
          ? `Pipeline stage changed from ${escapeHtml(metadata.from)} → ${escapeHtml(metadata.to)}`
          : null,
        meta: metadata.deal_value ? `<span>💰 ${escapeHtml(formatCurrency(metadata.deal_value))}</span>` : ''
      }

    case 'deal_won':
      return {
        icon: '🎉',
        iconClass: 'pipeline',
        title: `Deal closed with ${contactLink}`,
        description: metadata.description || 'Deal won!',
        meta: `<span class="outcome-badge positive">Won</span>${metadata.value ? `<span>💰 ${escapeHtml(formatCurrency(metadata.value))}</span>` : ''}`
      }

    case 'deal_lost':
      return {
        icon: '❌',
        iconClass: 'callback',
        title: `Deal lost with ${contactLink}`,
        description: metadata.reason || null,
        meta: `<span class="outcome-badge negative">Lost</span>`
      }

    case 'note_added':
      return {
        icon: '📝',
        iconClass: 'note',
        title: `Note added to ${contactLink}`,
        description: metadata.preview || null,
        meta: null
      }

    default:
      return {
        icon: '⚡',
        iconClass: 'status',
        title: `Activity for ${contactLink}`,
        description: metadata.description || null,
        meta: null
      }
  }
}

/**
 * Build call metadata HTML
 */
function buildCallMeta(metadata) {
  const parts = []

  if (metadata.duration) {
    parts.push(`<span>⏱️ ${formatDuration(metadata.duration)}</span>`)
  }

  if (metadata.outcome) {
    const outcomeClass = getOutcomeClass(metadata.outcome)
    parts.push(`<span class="outcome-badge ${outcomeClass}">${escapeHtml(metadata.outcome)}</span>`)
  }

  if (metadata.business) {
    parts.push(`<span>📍 ${escapeHtml(metadata.business)}</span>`)
  }

  return parts.join('')
}

/**
 * Get outcome badge class
 */
function getOutcomeClass(outcome) {
  const lowerOutcome = (outcome || '').toLowerCase()
  if (['interested', 'booked', 'won', 'qualified'].includes(lowerOutcome)) return 'positive'
  if (['not interested', 'lost', 'missed'].includes(lowerOutcome)) return 'negative'
  if (['scheduled', 'callback', 'follow-up'].includes(lowerOutcome)) return 'scheduled'
  return 'neutral'
}

/**
 * Render activity preview (for SMS messages)
 */
function renderActivityPreview(activity) {
  const metadata = activity.metadata || {}

  if ((activity.action === 'sms_sent' || activity.action === 'sms_received') && metadata.message) {
    return `
      <div class="activity-preview sms-preview">
        "${escapeHtml(truncateText(metadata.message, 150))}"
      </div>
    `
  }

  return ''
}

/**
 * Get contact display name
 */
function getContactName(contact) {
  if (!contact) return 'Unknown Contact'

  if (Array.isArray(contact) && contact.length > 0) {
    contact = contact[0]
  }

  const firstName = contact.first_name || ''
  const lastName = contact.last_name || ''
  const fullName = `${firstName} ${lastName}`.trim()

  return fullName || contact.business_name || 'Unknown Contact'
}

/**
 * Get activity type for filtering
 */
function getActivityType(action) {
  const typeMap = {
    call_made: 'calls',
    call_received: 'calls',
    call_missed: 'calls',
    callback_scheduled: 'calls',
    sms_sent: 'sms',
    sms_received: 'sms',
    status_changed: 'status',
    pipeline_moved: 'status',
    deal_won: 'status',
    deal_lost: 'status',
    note_added: 'status'
  }
  return typeMap[action] || 'status'
}

/**
 * Format activity time (using user's configured timezone)
 */
function formatActivityTime(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const timezone = getUserTimezone()
  return date.toLocaleTimeString('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

/**
 * Format duration in seconds to MM:SS
 */
function formatDuration(seconds) {
  if (!seconds) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * Truncate text with ellipsis
 */
function truncateText(text, maxLength) {
  if (!text || text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

/**
 * Update load more button visibility
 */
function updateLoadMoreButton() {
  const loadMoreContainer = document.querySelector('.load-more')
  if (loadMoreContainer) {
    const btn = loadMoreContainer.querySelector('.load-more-btn')
    if (btn) {
      btn.style.display = hasMore ? 'inline-block' : 'none'
      btn.disabled = isLoading
      btn.textContent = isLoading ? 'Loading...' : 'Load More Activity'
    }
  }
}

// ===========================================
// EVENT HANDLERS
// ===========================================

function setupEventListeners() {
  // Filter chip clicks
  const filterChips = document.querySelectorAll('.filter-chip')
  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      // Update active state
      filterChips.forEach(c => c.classList.remove('active'))
      chip.classList.add('active')

      // Set filter and reload
      currentFilter = chip.dataset.filter
      currentOffset = 0
      loadActivity()
    })
  })

  // Date range selector
  const dateRangeSelect = document.getElementById('dateRange')
  if (dateRangeSelect) {
    dateRangeSelect.addEventListener('change', (e) => {
      currentDateRange = e.target.value
      currentOffset = 0
      loadActivity()
    })
  }

  // Setup infinite scroll
  setupInfiniteScroll()
}

/**
 * Navigate to contact profile
 * Security: Validates contactId before navigation
 */
function goToContact(contactId) {
  // Ralph Wiggum validation - validate input before use
  if (!contactId || typeof contactId !== 'string') {
    console.error('Invalid contact ID')
    return
  }

  // Sanitize the ID - only allow alphanumeric and hyphens (UUIDs)
  const sanitizedId = contactId.replace(/[^a-zA-Z0-9-]/g, '')
  if (sanitizedId !== contactId) {
    console.error('Contact ID contained invalid characters')
    return
  }

  window.location.href = `contact-profile.html?id=${encodeURIComponent(sanitizedId)}`
}

// Make goToContact available globally for onclick handlers
window.goToContact = goToContact

/**
 * Load more activities (pagination)
 */
function loadMore() {
  if (isLoading || !hasMore) return
  currentOffset += PAGE_SIZE
  loadActivity(true)
}

// Make loadMore available globally
window.loadMore = loadMore

/**
 * Setup infinite scroll
 */
function setupInfiniteScroll() {
  const loadMoreBtn = document.querySelector('.load-more-btn')

  // Also support scroll-based loading
  let scrollTimeout
  window.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout)
    scrollTimeout = setTimeout(() => {
      const scrollPosition = window.innerHeight + window.scrollY
      const pageHeight = document.documentElement.scrollHeight

      // Load more when near bottom (within 200px)
      if (scrollPosition >= pageHeight - 200 && hasMore && !isLoading) {
        loadMore()
      }
    }, 100)
  })
}
