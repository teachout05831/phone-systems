/**
 * Newsfeed Page JavaScript
 *
 * Displays today's calls with quick tagging and notes functionality.
 * Follows security patterns from CODING_STANDARDS.md:
 * - Auth check first
 * - Filter by company_id
 * - Only select needed fields
 * - Use .limit() for lists
 * - escapeHtml() for XSS prevention
 * - Ralph Wiggum validation pattern
 */

// ===========================================
// STATE
// ===========================================
let calls = []
let currentFilter = 'all'
let companyId = null

// Pagination state
let currentPage = 1
const PAGE_SIZE = 10
let totalPages = 1

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
        const userNameEl = document.getElementById('userAvatar')
        if (userNameEl) userNameEl.textContent = name.charAt(0).toUpperCase()
        const userStatusEl = document.getElementById('connectionText')
        if (userStatusEl) userStatusEl.textContent = 'Available'
      }

      // Get company membership
      const membership = await getCompanyMembership()
      if (membership.error || !membership.companyId) {
        showError('#feedContainer', 'Unable to load newsfeed. Please try again.')
        return
      }
      companyId = membership.companyId

      // Load initial data
      await loadCalls()

      // Set up real-time subscription
      setupRealtimeSubscription()

      // Update connection status
      updateConnectionStatus(true)
    },
    onError: (error) => {
      console.error('Newsfeed page init error:', error)
      showError('#feedContainer', 'Failed to load newsfeed')
    }
  })
})

// ===========================================
// DATA LOADING
// ===========================================

/**
 * Load calls from Supabase
 * Security: Filters by company_id, uses .limit(), selects specific fields
 *
 * Shows today's calls first, but falls back to recent calls if none found
 */
async function loadCalls() {
  if (!companyId) {
    console.error('No company ID available')
    return
  }

  try {
    showLoading('#feedContainer', 'Loading calls...')

    // Get date ranges
    const now = new Date()
    const today = new Date(now)
    today.setHours(0, 0, 0, 0)
    const todayIso = today.toISOString()

    // Also calculate a week ago for fallback
    const weekAgo = new Date(now)
    weekAgo.setDate(weekAgo.getDate() - 7)
    const weekAgoIso = weekAgo.toISOString()

    // First try to load today's calls
    let { data, error } = await supabase
      .from('calls')
      .select(`
        id,
        external_call_id,
        phone_number,
        direction,
        status,
        outcome,
        duration_seconds,
        ai_summary,
        notes,
        started_at,
        ended_at,
        contact:contacts(id, first_name, last_name, business_name)
      `)
      .eq('company_id', companyId)
      .gte('started_at', todayIso)
      .order('started_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Error loading calls:', error)
      showError('#feedContainer', 'Failed to load calls: ' + error.message)
      return
    }

    // If no calls today, try loading recent calls (past week)
    if (!data || data.length === 0) {
      console.log('No calls today, loading recent calls...')
      const recentResult = await supabase
        .from('calls')
        .select(`
          id,
          external_call_id,
          phone_number,
          direction,
          status,
          outcome,
          duration_seconds,
          ai_summary,
          notes,
          started_at,
          ended_at,
          contact:contacts(id, first_name, last_name, business_name)
        `)
        .eq('company_id', companyId)
        .gte('started_at', weekAgoIso)
        .order('started_at', { ascending: false })
        .limit(50)

      if (!recentResult.error) {
        data = recentResult.data
        // Update the header to indicate we're showing recent calls
        const headerTitle = document.querySelector('.top-header-title')
        if (headerTitle && data && data.length > 0) {
          headerTitle.textContent = 'Recent Calls (This Week)'
        }
      }
    }

    calls = transformCallsData(data || [])

    console.log(`Loaded ${calls.length} calls`)

    renderFeed()
    updateStats()
    updateFilterCounts()

  } catch (error) {
    console.error('Load calls error:', error)
    showError('#feedContainer', 'Failed to load calls: ' + error.message)
  }
}

/**
 * Transform Supabase data to UI format
 */
function transformCallsData(data) {
  return data.map(call => ({
    id: call.id,
    callSid: call.external_call_id || call.id,
    phoneNumber: call.phone_number,
    direction: call.direction,
    status: call.status,
    outcome: call.outcome,
    duration: call.duration_seconds,
    notes: call.notes || null,
    aiSummary: call.ai_summary,
    transcript: [], // Transcript stored in call_transcripts table
    startTime: call.started_at,
    endTime: call.ended_at,
    contact: call.contact
  }))
}

/**
 * Parse transcript data safely
 */
function parseTranscript(transcript) {
  if (!transcript) return []
  if (typeof transcript === 'string') {
    try {
      return JSON.parse(transcript)
    } catch {
      return []
    }
  }
  if (Array.isArray(transcript)) return transcript
  return []
}

// ===========================================
// REAL-TIME UPDATES
// ===========================================

/**
 * Set up Supabase real-time subscription for new calls
 */
function setupRealtimeSubscription() {
  if (!companyId) return

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  supabase
    .channel('calls-newsfeed')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'calls',
      filter: `company_id=eq.${companyId}`
    }, (payload) => {
      handleRealtimeUpdate(payload)
    })
    .subscribe()
}

/**
 * Handle real-time call updates
 */
function handleRealtimeUpdate(payload) {
  const { eventType, new: newRecord, old: oldRecord } = payload

  if (eventType === 'INSERT') {
    // New call - check if it's from today
    const callDate = new Date(newRecord.started_at)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (callDate >= today) {
      // Add to beginning of list
      const transformedCall = transformCallsData([newRecord])[0]
      calls.unshift(transformedCall)

      // If user is on page 1, re-render to show new call
      // Otherwise, show notification that new calls are available
      if (currentPage === 1) {
        renderFeed()
      } else {
        showNewCallsBanner()
      }
      updateStats()
      updateFilterCounts()
    }
  } else if (eventType === 'UPDATE') {
    // Update existing call
    const index = calls.findIndex(c => c.id === newRecord.id)
    if (index !== -1) {
      calls[index] = transformCallsData([newRecord])[0]
      renderFeed()
      updateStats()
      updateFilterCounts()
    }
  }
}

/**
 * Show banner when new calls arrive and user is not on page 1
 */
function showNewCallsBanner() {
  let banner = document.getElementById('newCallsBanner')

  if (!banner) {
    banner = document.createElement('div')
    banner.id = 'newCallsBanner'
    banner.className = 'new-calls-banner'
    banner.innerHTML = `
      <span>📞 New calls available!</span>
      <button onclick="goToFirstPage()">View Latest</button>
      <button class="dismiss-btn" onclick="dismissNewCallsBanner()">×</button>
    `
    const feedContainer = document.getElementById('feedContainer')
    feedContainer.parentNode.insertBefore(banner, feedContainer)
  }

  banner.style.display = 'flex'
}

/**
 * Go to first page to see new calls
 */
function goToFirstPage() {
  dismissNewCallsBanner()
  goToPage(1)
}

window.goToFirstPage = goToFirstPage

/**
 * Dismiss the new calls banner
 */
function dismissNewCallsBanner() {
  const banner = document.getElementById('newCallsBanner')
  if (banner) banner.style.display = 'none'
}

window.dismissNewCallsBanner = dismissNewCallsBanner

// ===========================================
// RENDERING
// ===========================================

/**
 * Render the call feed with pagination
 * Security: Uses escapeHtml() for all user content
 */
function renderFeed() {
  const container = document.getElementById('feedContainer')
  const filteredCalls = filterCalls(calls)

  if (filteredCalls.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📞</div>
        <div class="empty-state-title">${currentFilter === 'all' ? 'No calls yet today' : 'No matching calls'}</div>
        <div class="empty-state-text">${currentFilter === 'all' ? 'Calls will appear here as they come in' : 'Try a different filter'}</div>
      </div>
    `
    renderPagination(0)
    return
  }

  // Calculate pagination
  totalPages = Math.ceil(filteredCalls.length / PAGE_SIZE)

  // Ensure current page is valid
  if (currentPage > totalPages) currentPage = totalPages
  if (currentPage < 1) currentPage = 1

  // Get calls for current page
  const startIndex = (currentPage - 1) * PAGE_SIZE
  const endIndex = startIndex + PAGE_SIZE
  const paginatedCalls = filteredCalls.slice(startIndex, endIndex)

  container.innerHTML = paginatedCalls.map(call => renderFeedItem(call)).join('')

  // Render pagination controls
  renderPagination(filteredCalls.length)
}

/**
 * Render pagination controls
 */
function renderPagination(totalItems) {
  let paginationContainer = document.getElementById('paginationControls')

  // Create pagination container if it doesn't exist
  if (!paginationContainer) {
    paginationContainer = document.createElement('div')
    paginationContainer.id = 'paginationControls'
    paginationContainer.className = 'pagination-controls'
    const feedContainer = document.getElementById('feedContainer')
    feedContainer.parentNode.insertBefore(paginationContainer, feedContainer.nextSibling)
  }

  if (totalItems === 0 || totalPages <= 1) {
    paginationContainer.innerHTML = ''
    return
  }

  paginationContainer.innerHTML = `
    <div class="pagination-info">
      Showing ${((currentPage - 1) * PAGE_SIZE) + 1}-${Math.min(currentPage * PAGE_SIZE, totalItems)} of ${totalItems} calls
    </div>
    <div class="pagination-buttons">
      <button class="pagination-btn" onclick="goToPage(1)" ${currentPage === 1 ? 'disabled' : ''}>
        ⏮️ First
      </button>
      <button class="pagination-btn" onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
        ◀️ Previous
      </button>
      <span class="pagination-current">Page ${currentPage} of ${totalPages}</span>
      <button class="pagination-btn" onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
        Next ▶️
      </button>
      <button class="pagination-btn" onclick="goToPage(${totalPages})" ${currentPage === totalPages ? 'disabled' : ''}>
        Last ⏭️
      </button>
    </div>
  `
}

/**
 * Navigate to a specific page
 */
function goToPage(page) {
  if (page < 1 || page > totalPages) return
  currentPage = page
  renderFeed()
  // Scroll to top of feed
  document.getElementById('feedContainer')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

window.goToPage = goToPage

/**
 * Filter calls based on current filter
 */
// Helper to check if call was successfully connected
function isConnectedCall(status) {
  return status === 'connected' || status === 'completed' || status === 'in_progress'
}

// Helper to check if call is missed (including initiated/ringing inbound calls)
function isMissedCall(call) {
  const missedStatuses = ['missed', 'no-answer', 'no_answer']
  // Inbound calls with initiated/ringing status are also missed (not answered)
  if (call.direction === 'inbound') {
    return missedStatuses.includes(call.status) || call.status === 'initiated' || call.status === 'ringing'
  }
  return missedStatuses.includes(call.status)
}

function filterCalls(callsList) {
  switch (currentFilter) {
    case 'untagged':
      return callsList.filter(c => isConnectedCall(c.status) && !c.outcome)
    case 'booked':
      return callsList.filter(c => c.outcome === 'booked')
    case 'estimate':
      return callsList.filter(c => c.outcome === 'estimate')
    case 'missed':
      return callsList.filter(c => isMissedCall(c))
    default:
      return callsList
  }
}

/**
 * Render a single feed item
 * Security: All user content passed through escapeHtml()
 */
function renderFeedItem(call) {
  const isConnected = isConnectedCall(call.status)
  const isMissed = isMissedCall(call)
  const outcomeClass = call.outcome || (isConnected ? 'untagged' : (isMissed ? 'missed' : call.status))
  const statusIcon = isConnected ? '✅' : (isMissed ? '📵' : '📞')
  const needsAction = isConnected && !call.outcome

  // Safely escape all user-provided content
  const safePhoneNumber = escapeHtml(formatPhoneNumber(call.phoneNumber))
  const safeCallSid = escapeHtml(call.callSid || call.id)
  const safeNotes = call.notes ? escapeHtml(call.notes) : ''
  const safeAiSummary = call.aiSummary ? escapeHtml(call.aiSummary) : ''

  // Contact info for profile link
  const contactId = call.contact?.id || null
  const contactName = call.contact
    ? escapeHtml([call.contact.first_name, call.contact.last_name].filter(Boolean).join(' ') || call.contact.business_name || '')
    : ''
  const profileUrl = contactId
    ? `contact-profile.html?id=${contactId}`
    : `contact-profile.html?phone=${encodeURIComponent(call.phoneNumber)}`

  return `
    <div class="feed-item ${escapeHtml(outcomeClass)}" data-call-id="${safeCallSid}">
      <div class="feed-item-header">
        <div class="feed-item-left">
          <div class="feed-item-status ${escapeHtml(call.status)}">
            ${statusIcon}
          </div>
          <div class="feed-item-info">
            <a href="${profileUrl}" class="feed-item-phone-link" title="View contact profile">
              <div class="feed-item-phone">${contactName || safePhoneNumber}</div>
              ${contactName ? `<div class="feed-item-phone-small">${safePhoneNumber}</div>` : ''}
            </a>
            <div class="feed-item-meta">
              <span>${escapeHtml(formatRelativeTime(call.startTime))}</span>
              ${call.duration ? `<span>${escapeHtml(formatDuration(call.duration))}</span>` : ''}
            </div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: var(--spacing-sm);">
          ${call.outcome ? `<span class="badge badge-${getOutcomeBadgeClass(call.outcome)}">${escapeHtml(formatOutcome(call.outcome))}</span>` : ''}
          <span class="call-result-badge ${escapeHtml(call.status)}">${escapeHtml(formatStatus(call.status))}</span>
        </div>
      </div>

      ${isConnected ? `
        <div class="quick-tags">
          <span class="quick-tags-label">${needsAction ? '⚠️ Tag this call:' : 'Outcome:'}</span>
          <button class="tag-btn booked ${call.outcome === 'booked' ? 'selected' : ''}" onclick="tagCall('${safeCallSid}', 'booked')">
            ✅ Booked
          </button>
          <button class="tag-btn estimate ${call.outcome === 'estimate' ? 'selected' : ''}" onclick="tagCall('${safeCallSid}', 'estimate')">
            💰 Gave Estimate
          </button>
          <button class="tag-btn question ${call.outcome === 'question' ? 'selected' : ''}" onclick="tagCall('${safeCallSid}', 'question')">
            ❓ Question
          </button>
          <button class="tag-btn current-customer ${call.outcome === 'current_customer' ? 'selected' : ''}" onclick="tagCall('${safeCallSid}', 'current_customer')">
            👤 Current Customer
          </button>
          <button class="tag-btn not-interested ${call.outcome === 'not_interested' ? 'selected' : ''}" onclick="tagCall('${safeCallSid}', 'not_interested')">
            ❌ Not Interested
          </button>
        </div>
      ` : ''}

      ${safeAiSummary ? `
        <div class="ai-summary">
          <div class="ai-summary-header">
            <span>🤖</span> AI Summary
          </div>
          <div class="ai-summary-text">${safeAiSummary}</div>
        </div>
      ` : ''}

      <div class="feed-item-notes">
        ${safeNotes ? `
          <div class="notes-display">
            <span class="notes-icon">📝</span>
            <span>${safeNotes}</span>
            <button class="btn btn-sm btn-secondary" onclick="editNotes('${safeCallSid}')" style="margin-left: auto;">Edit</button>
          </div>
        ` : `
          <div class="notes-input-container" id="notes-${safeCallSid}">
            <input type="text" class="notes-input" placeholder="Add notes..." onkeypress="handleNotesKeypress(event, '${safeCallSid}')" maxlength="500">
            <button class="btn btn-sm btn-primary" onclick="saveNotes('${safeCallSid}')">Save</button>
          </div>
        `}
      </div>

      <div class="feed-item-actions">
        <div class="action-buttons">
          <button class="btn btn-sm btn-success" onclick="callBack('${escapeHtml(call.phoneNumber)}')">
            📞 Call Back
          </button>
          ${call.transcript && call.transcript.length > 0 ? `
            <button class="btn btn-sm btn-secondary" onclick="viewTranscript('${safeCallSid}')">
              📄 Transcript
            </button>
          ` : ''}
          ${isMissedCall(call) ? `
            <button class="btn btn-sm btn-warning" onclick="scheduleCallback('${safeCallSid}', '${escapeHtml(call.phoneNumber)}')">
              📅 Schedule Callback
            </button>
          ` : ''}
        </div>
        <span class="text-xs text-muted">${escapeHtml(formatDateTime(call.startTime))}</span>
      </div>
    </div>
  `
}

// ===========================================
// CALL ACTIONS
// ===========================================

/**
 * Tag a call with an outcome
 * Security: Validates input, uses prepared statements via Supabase
 */
async function tagCall(callId, outcome) {
  // Ralph Wiggum validation - validate all inputs
  if (!callId || typeof callId !== 'string') {
    console.error('Invalid call ID')
    return
  }

  const validOutcomes = ['booked', 'estimate', 'question', 'current_customer', 'not_interested', null]
  if (outcome !== null && !validOutcomes.includes(outcome)) {
    console.error('Invalid outcome value')
    return
  }

  const call = calls.find(c => (c.callSid || c.id) === callId)
  if (!call) {
    console.error('Call not found')
    return
  }

  // Toggle if same outcome clicked
  const newOutcome = call.outcome === outcome ? null : outcome

  try {
    // Update in Supabase
    const { error } = await supabase
      .from('calls')
      .update({ outcome: newOutcome })
      .eq('company_id', companyId) // Security: Always filter by company_id
      .eq('id', call.id)

    if (error) {
      console.error('Error updating call outcome:', error)
      return
    }

    // Update local state
    call.outcome = newOutcome
    renderFeed()
    updateStats()
    updateFilterCounts()

  } catch (error) {
    console.error('Tag call error:', error)
  }
}

// Make tagCall available globally
window.tagCall = tagCall

/**
 * Save notes for a call
 * Security: Validates input, sanitizes notes, uses company_id filter
 */
async function saveNotes(callId) {
  // Ralph Wiggum validation
  if (!callId || typeof callId !== 'string') {
    console.error('Invalid call ID')
    return
  }

  const container = document.getElementById(`notes-${callId}`)
  if (!container) return

  const input = container.querySelector('input')
  const notes = input.value.trim()

  // Validate notes length
  if (notes.length > 500) {
    alert('Notes must be 500 characters or less')
    return
  }

  const call = calls.find(c => (c.callSid || c.id) === callId)
  if (!call) {
    console.error('Call not found')
    return
  }

  try {
    // Update in Supabase
    const { error } = await supabase
      .from('calls')
      .update({ notes: notes })
      .eq('company_id', companyId) // Security: Always filter by company_id
      .eq('id', call.id)

    if (error) {
      console.error('Error saving notes:', error)
      return
    }

    // Update local state
    call.notes = notes
    renderFeed()

  } catch (error) {
    console.error('Save notes error:', error)
  }
}

// Make saveNotes available globally
window.saveNotes = saveNotes

/**
 * Handle Enter key in notes input
 */
function handleNotesKeypress(event, callId) {
  if (event.key === 'Enter') {
    saveNotes(callId)
  }
}

window.handleNotesKeypress = handleNotesKeypress

/**
 * Edit existing notes
 */
function editNotes(callId) {
  const call = calls.find(c => (c.callSid || c.id) === callId)
  if (!call) return

  const newNotes = prompt('Edit notes:', call.notes || '')
  if (newNotes !== null && newNotes.length <= 500) {
    call.notes = newNotes
    saveNotesDirectly(call.id, newNotes)
    renderFeed()
  } else if (newNotes && newNotes.length > 500) {
    alert('Notes must be 500 characters or less')
  }
}

window.editNotes = editNotes

/**
 * Save notes directly to database
 */
async function saveNotesDirectly(callDbId, notes) {
  try {
    await supabase
      .from('calls')
      .update({ notes: notes })
      .eq('company_id', companyId)
      .eq('id', callDbId)
  } catch (error) {
    console.error('Save notes error:', error)
  }
}

/**
 * View call transcript
 */
function viewTranscript(callId) {
  const call = calls.find(c => (c.callSid || c.id) === callId)
  if (!call || !call.transcript || call.transcript.length === 0) return

  const content = document.getElementById('transcriptContent')
  content.innerHTML = call.transcript.map(t => `
    <div class="transcript-message ${escapeHtml(t.speaker || 'unknown')}">
      <div>${escapeHtml(t.text || '')}</div>
      <div class="transcript-time">${escapeHtml(t.time || '')}</div>
    </div>
  `).join('')

  document.getElementById('transcriptModal').classList.add('active')
}

window.viewTranscript = viewTranscript

/**
 * Close transcript modal
 */
function closeTranscriptModal() {
  document.getElementById('transcriptModal').classList.remove('active')
}

window.closeTranscriptModal = closeTranscriptModal

/**
 * Call back a number
 */
function callBack(phoneNumber) {
  if (!phoneNumber) return
  window.location.href = `call.html?number=${encodeURIComponent(phoneNumber)}`
}

window.callBack = callBack

/**
 * Schedule a callback
 */
function scheduleCallback(callId, phoneNumber) {
  if (!phoneNumber) return
  window.location.href = `callbacks.html?schedule=${encodeURIComponent(phoneNumber)}`
}

window.scheduleCallback = scheduleCallback

// ===========================================
// FILTERS & STATS
// ===========================================

/**
 * Set filter and re-render
 */
function setFilter(filter) {
  currentFilter = filter
  currentPage = 1 // Reset to first page when filter changes
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter)
  })
  renderFeed()
}

window.setFilter = setFilter

/**
 * Update filter count badges
 */
function updateFilterCounts() {
  const counts = {
    all: calls.length,
    untagged: calls.filter(c => isConnectedCall(c.status) && !c.outcome).length,
    booked: calls.filter(c => c.outcome === 'booked').length,
    estimate: calls.filter(c => c.outcome === 'estimate').length,
    missed: calls.filter(c => isMissedCall(c)).length
  }

  document.getElementById('countAll').textContent = counts.all
  document.getElementById('countUntagged').textContent = counts.untagged
  document.getElementById('countBooked').textContent = counts.booked
  document.getElementById('countEstimate').textContent = counts.estimate
  document.getElementById('countMissed').textContent = counts.missed
}

/**
 * Update stats summary
 */
function updateStats() {
  document.getElementById('statTotal').textContent = calls.length
  document.getElementById('statBooked').textContent = calls.filter(c => c.outcome === 'booked').length
  document.getElementById('statEstimate').textContent = calls.filter(c => c.outcome === 'estimate').length
  document.getElementById('statUntagged').textContent = calls.filter(c => isConnectedCall(c.status) && !c.outcome).length
  document.getElementById('statMissed').textContent = calls.filter(c => isMissedCall(c)).length
}

// ===========================================
// FORMATTING HELPERS
// ===========================================

function formatPhoneNumber(number) {
  if (!number) return ''
  const cleaned = number.replace(/\D/g, '')
  if (cleaned.length === 11 && cleaned[0] === '1') {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  }
  return number
}

function formatDuration(seconds) {
  if (!seconds) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function formatRelativeTime(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins} min ago`
  if (diffHours < 24) return `${diffHours} hr ago`
  return date.toLocaleDateString()
}

function formatDateTime(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

function formatStatus(status) {
  const statusMap = {
    'connected': 'Connected',
    'completed': 'Connected',
    'in_progress': 'In Progress',
    'missed': 'Missed',
    'no-answer': 'No Answer',
    'no_answer': 'No Answer'
  }
  return statusMap[status] || status
}

function formatOutcome(outcome) {
  const outcomeMap = {
    'booked': 'Booked',
    'estimate': 'Estimate',
    'question': 'Question',
    'current_customer': 'Current Customer',
    'not_interested': 'Not Interested'
  }
  return outcomeMap[outcome] || outcome
}

function getOutcomeBadgeClass(outcome) {
  const classMap = {
    'booked': 'success',
    'estimate': 'info',
    'question': 'info',
    'current_customer': 'info',
    'not_interested': 'secondary'
  }
  return classMap[outcome] || 'secondary'
}

// ===========================================
// CONNECTION STATUS
// ===========================================

function updateConnectionStatus(connected) {
  const status = document.getElementById('connectionStatus')
  const userStatus = document.getElementById('userStatus')
  const connectionText = document.getElementById('connectionText')

  if (connected) {
    if (status) {
      status.className = 'connection-status connected'
      status.innerHTML = '<span class="connection-dot"></span><span>Connected</span>'
    }
    if (userStatus) userStatus.style.color = 'var(--success)'
    if (connectionText) connectionText.textContent = 'Available'
  } else {
    if (status) {
      status.className = 'connection-status disconnected'
      status.innerHTML = '<span class="connection-dot"></span><span>Disconnected</span>'
    }
    if (userStatus) userStatus.style.color = 'var(--gray-400)'
    if (connectionText) connectionText.textContent = 'Offline'
  }
}

// ===========================================
// DECLINED/MISSED CALL RECORDING
// ===========================================

/**
 * Find or create a contact by phone number
 */
async function findOrCreateContact(phoneNumber) {
  if (!phoneNumber || !companyId) return null

  try {
    // Clean phone number
    const cleanedPhone = phoneNumber.replace(/\D/g, '')

    // Try to find existing contact
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id, first_name, last_name')
      .eq('company_id', companyId)
      .or(`phone.eq.${phoneNumber},phone.eq.${cleanedPhone},phone.eq.+1${cleanedPhone}`)
      .limit(1)
      .single()

    if (existingContact) {
      return existingContact
    }

    // Create new contact
    const { data: newContact, error } = await supabase
      .from('contacts')
      .insert({
        company_id: companyId,
        phone: phoneNumber,
        first_name: 'Unknown',
        last_name: 'Caller',
        source: 'inbound_call'
      })
      .select('id, first_name, last_name')
      .single()

    if (error) {
      console.error('Error creating contact:', error)
      return null
    }

    return newContact
  } catch (error) {
    console.error('findOrCreateContact error:', error)
    return null
  }
}

/**
 * Create a declined call record
 * Called from inline script when user declines an incoming call
 */
async function createDeclinedCallRecord(phoneNumber) {
  console.log('createDeclinedCallRecord: Logging declined call from:', phoneNumber)

  if (!companyId) {
    console.error('Cannot create declined call record: missing company ID')
    return
  }

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    console.error('Cannot create declined call record: no authenticated user')
    return
  }

  try {
    const contact = await findOrCreateContact(phoneNumber)
    const contactId = contact?.id || null

    const insertData = {
      company_id: companyId,
      rep_id: user.id,
      contact_id: contactId,
      phone_number: phoneNumber,
      direction: 'inbound',
      status: 'missed',
      outcome: null,
      started_at: new Date().toISOString(),
      ended_at: new Date().toISOString(),
      duration_seconds: 0
    }

    const { data, error } = await supabase
      .from('calls')
      .insert(insertData)
      .select('id')
      .single()

    if (error) {
      console.error('createDeclinedCallRecord: Failed:', error)
    } else {
      console.log('createDeclinedCallRecord: SUCCESS:', data.id)
      // Reload calls to show the new missed call
      await loadCalls()
    }
  } catch (error) {
    console.error('createDeclinedCallRecord: Exception:', error)
  }
}

// Make available globally for inline script
window.createDeclinedCallRecord = createDeclinedCallRecord
