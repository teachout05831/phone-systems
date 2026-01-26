/**
 * History Page - Supabase Integration
 *
 * Handles call history including:
 * - Loading and filtering calls
 * - Viewing call details and transcripts
 * - Editing call notes
 * - Export functionality
 * - Pagination
 *
 * Security: All queries filter by company_id, auth checked on load
 */

// ===========================================
// STATE
// ===========================================
let calls = [];
let currentPage = 1;
let totalPages = 1;
const pageSize = 20;
let currentCallId = null;
let companyId = null;

// ===========================================
// INITIALIZATION
// ===========================================

async function initHistoryPage() {
  try {
    console.log('initHistoryPage: Starting initialization...');

    // Auth check - redirect if not authenticated
    const { companyId: cid, error } = await getCompanyMembership();
    console.log('initHistoryPage: getCompanyMembership result:', { cid, error });

    if (error || !cid) {
      console.error('No company membership found');
      window.location.href = 'index.html';
      return;
    }
    companyId = cid;
    console.log('initHistoryPage: Using companyId:', companyId);

    // DEBUG removed for security - was exposing all companies' data
    // All queries must filter by company_id

    // Check URL params for direct call view
    checkUrlParams();

    // Load initial data
    await loadCalls();

    // Set up event listeners
    setupEventListeners();

    // Set up real-time subscription
    setupRealtimeSubscription();

  } catch (error) {
    console.error('Failed to initialize history page:', error);
    showError('#callsList', 'Failed to load call history. Please refresh.');
  }
}

// ===========================================
// EVENT LISTENERS
// ===========================================

function setupEventListeners() {
  // Enter key to search
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        applyFilters();
      }
    });
  }

  // Sort change
  const sortSelect = document.getElementById('sortBy');
  if (sortSelect) {
    sortSelect.addEventListener('change', () => applyFilters());
  }
}

// ===========================================
// DATA LOADING
// ===========================================

async function loadCalls() {
  // Validate we have auth
  if (!companyId) {
    console.error('loadCalls: No companyId available');
    return;
  }

  console.log('loadCalls: Loading calls for companyId:', companyId);

  const filters = getFilters();
  console.log('loadCalls: Filters:', filters);
  showLoading('#callsList');

  try {
    // Build base query
    let query = supabase
      .from('calls')
      .select(`
        id,
        external_call_id,
        phone_number,
        contact_id,
        direction,
        status,
        outcome,
        duration_seconds,
        started_at,
        ended_at,
        recording_url,
        ai_summary,
        contact:contacts(id, first_name, last_name, phone)
      `, { count: 'exact' })
      .eq('company_id', companyId);

    // Apply date filter
    if (filters.date && filters.date !== 'all') {
      const now = new Date();
      let startDate;

      switch (filters.date) {
        case 'today':
          startDate = new Date(now);
          startDate.setHours(0, 0, 0, 0);
          query = query.gte('started_at', startDate.toISOString());
          break;
        case 'yesterday':
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 1);
          startDate.setHours(0, 0, 0, 0);
          const endYesterday = new Date(startDate);
          endYesterday.setDate(endYesterday.getDate() + 1);
          query = query.gte('started_at', startDate.toISOString())
                       .lt('started_at', endYesterday.toISOString());
          break;
        case 'week':
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 7);
          query = query.gte('started_at', startDate.toISOString());
          break;
        case 'month':
          startDate = new Date(now);
          startDate.setMonth(startDate.getMonth() - 1);
          query = query.gte('started_at', startDate.toISOString());
          break;
      }
    }

    // Apply status filter
    if (filters.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }

    // Apply outcome filter
    if (filters.outcome && filters.outcome !== 'all') {
      if (filters.outcome === 'none') {
        query = query.is('outcome', null);
      } else {
        query = query.eq('outcome', filters.outcome);
      }
    }

    // Apply search filter
    if (filters.search && filters.search.trim()) {
      const searchTerm = filters.search.trim();
      // Search in phone number only (notes column doesn't exist)
      query = query.ilike('phone_number', `%${searchTerm}%`);
    }

    // Apply sorting
    const sortField = filters.sort === 'oldest' ? { column: 'started_at', ascending: true } :
                      filters.sort === 'longest' ? { column: 'duration_seconds', ascending: false } :
                      filters.sort === 'shortest' ? { column: 'duration_seconds', ascending: true } :
                      { column: 'started_at', ascending: false }; // newest (default)

    query = query.order(sortField.column, { ascending: sortField.ascending });

    // Apply pagination
    const from = (currentPage - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    console.log('loadCalls: Query result - count:', count, 'data length:', data?.length, 'error:', error);
    if (data && data.length > 0) {
      console.log('loadCalls: First call:', data[0]);
    }

    if (error) throw error;

    // Transform data for rendering
    calls = (data || []).map(call => ({
      callSid: call.external_call_id || call.id,
      callId: call.id,
      phoneNumber: call.phone_number,
      contactName: call.contact
        ? `${call.contact.first_name || ''} ${call.contact.last_name || ''}`.trim()
        : null,
      direction: call.direction,
      status: call.status,
      outcome: call.outcome,
      duration: call.duration_seconds,
      startTime: call.started_at,
      endTime: call.ended_at,
      notes: null, // Notes stored in separate table or ai_summary
      hasRecording: !!call.recording_url,
      recordingUrl: call.recording_url,
      hasTranscript: !!call.ai_summary,
      transcript: null, // Transcript stored in call_transcripts table
      aiSummary: call.ai_summary
    }));

    // Calculate total pages
    totalPages = count ? Math.ceil(count / pageSize) : 1;

    renderCalls();
    renderPagination();

  } catch (error) {
    console.error('Failed to load calls:', error);
    showError('#callsList', 'Failed to load call history');
  }
}

function getFilters() {
  return {
    date: document.getElementById('dateFilter')?.value || 'all',
    status: document.getElementById('statusFilter')?.value || 'all',
    outcome: document.getElementById('outcomeFilter')?.value || 'all',
    search: document.getElementById('searchInput')?.value || '',
    sort: document.getElementById('sortBy')?.value || 'newest'
  };
}

function applyFilters() {
  currentPage = 1;
  loadCalls();
}

function clearFilters() {
  const dateFilter = document.getElementById('dateFilter');
  const statusFilter = document.getElementById('statusFilter');
  const outcomeFilter = document.getElementById('outcomeFilter');
  const searchInput = document.getElementById('searchInput');

  if (dateFilter) dateFilter.value = 'all';
  if (statusFilter) statusFilter.value = 'all';
  if (outcomeFilter) outcomeFilter.value = 'all';
  if (searchInput) searchInput.value = '';

  applyFilters();
}

// ===========================================
// REAL-TIME SUBSCRIPTION
// ===========================================

function setupRealtimeSubscription() {
  if (!companyId) return;

  supabase
    .channel('calls-changes')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'calls',
      filter: `company_id=eq.${companyId}`
    }, () => {
      // Reload first page when new call comes in
      if (currentPage === 1) {
        loadCalls();
      }
    })
    .subscribe();
}

// ===========================================
// CALL ACTIONS
// ===========================================

async function updateCallNotes(callId, notes) {
  // Ralph Wiggum: Validate inputs
  if (!callId) return { error: 'Missing call ID' };

  // Notes can be empty, but sanitize
  const sanitizedNotes = notes ? notes.trim().slice(0, 5000) : null;

  try {
    const { error } = await supabase
      .from('calls')
      .update({
        notes: sanitizedNotes,
        updated_at: new Date().toISOString()
      })
      .eq('id', callId)
      .eq('company_id', companyId); // Security: ensure company match

    if (error) throw error;
    return { success: true };

  } catch (error) {
    console.error('Failed to update notes:', error);
    return { error: 'Failed to save notes' };
  }
}

async function getCallTranscript(callId) {
  if (!callId) return { error: 'Missing call ID' };

  try {
    // Get call details with recording URL
    const { data: callData, error: callError } = await supabase
      .from('calls')
      .select(`
        id,
        ai_summary,
        recording_url,
        duration_seconds
      `)
      .eq('id', callId)
      .eq('company_id', companyId)
      .single();

    if (callError) throw callError;

    // Get transcript from call_transcripts table
    const { data: transcriptData, error: transcriptError } = await supabase
      .from('call_transcripts')
      .select('segments, full_text')
      .eq('call_id', callId)
      .maybeSingle();

    // Get AI analysis from call_analysis table
    const { data: analysisData, error: analysisError } = await supabase
      .from('call_analysis')
      .select('summary, sentiment, key_points, action_items, predicted_outcome')
      .eq('call_id', callId)
      .maybeSingle();

    // Parse ai_summary if it's a string
    let summary = null;
    if (analysisData) {
      summary = {
        overview: analysisData.summary,
        sentiment: analysisData.sentiment,
        outcome: analysisData.predicted_outcome,
        actionItems: analysisData.action_items || []
      };
    } else if (callData.ai_summary) {
      summary = typeof callData.ai_summary === 'string'
        ? JSON.parse(callData.ai_summary)
        : callData.ai_summary;
    }

    return {
      success: true,
      data: {
        transcript: transcriptData?.segments || null,
        summary: summary,
        recordingUrl: callData.recording_url,
        duration: callData.duration_seconds
      }
    };

  } catch (error) {
    console.error('Failed to get transcript:', error);
    return { error: 'Failed to load transcript' };
  }
}

// ===========================================
// RENDERING
// ===========================================

function renderCalls() {
  const container = document.getElementById('callsList');
  const resultsCount = document.getElementById('resultsCount');

  if (resultsCount) resultsCount.textContent = calls.length;

  if (calls.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">&#128222;</div>
        <div class="empty-state-title">No calls found</div>
        <div class="empty-state-text">Try adjusting your filters</div>
      </div>
    `;
    return;
  }

  container.innerHTML = calls.map(call => `
    <div class="call-card">
      <div class="call-card-header">
        <div>
          <div class="call-card-phone">&#128222; ${formatPhone(call.phoneNumber)}</div>
          ${call.contactName ? `<div class="text-sm text-muted">${escapeHtml(call.contactName)}</div>` : ''}
        </div>
        <div class="call-card-date">${formatDateTime(call.startTime)}</div>
      </div>

      <div class="call-card-meta">
        <span>
          <span class="badge badge-${getStatusBadgeClass(call.status)}">${formatStatus(call.status)}</span>
        </span>
        ${call.direction ? `<span>${call.direction === 'inbound' ? '&#8594;' : '&#8592;'} ${call.direction}</span>` : ''}
        ${call.duration ? `<span>&#9201; ${formatDuration(call.duration)}</span>` : ''}
        ${call.outcome ? `<span>&#128203; ${formatOutcome(call.outcome)}</span>` : ''}
      </div>

      ${call.notes ? `
        <div class="call-card-notes">
          &#128221; ${escapeHtml(call.notes)}
        </div>
      ` : ''}

      <div class="call-card-actions">
        ${call.hasTranscript ? `
          <button class="btn btn-sm btn-secondary" onclick="viewTranscript('${call.callId}')">
            &#128196; View Transcript
          </button>
        ` : ''}
        ${call.hasRecording ? `
          <button class="btn btn-sm btn-secondary" onclick="viewTranscript('${call.callId}')">
            &#127908; Play Recording
          </button>
        ` : ''}
        <button class="btn btn-sm btn-success" onclick="callNumber('${call.phoneNumber}')">
          &#128222; Call Again
        </button>
        <button class="btn btn-sm btn-secondary" onclick="editNotes('${call.callId}', '${escapeQuotes(call.notes || '')}')">
          &#128221; Edit Notes
        </button>
      </div>
    </div>
  `).join('');
}

function renderPagination() {
  const container = document.getElementById('pagination');

  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = '';

  // Previous button
  html += `<button class="pagination-btn" onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>&larr; Prev</button>`;

  // Page numbers
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
      html += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
    } else if (i === currentPage - 2 || i === currentPage + 2) {
      html += `<span class="pagination-btn" style="border: none;">...</span>`;
    }
  }

  // Next button
  html += `<button class="pagination-btn" onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>Next &rarr;</button>`;

  container.innerHTML = html;
}

// ===========================================
// TRANSCRIPT MODAL
// ===========================================

async function viewTranscript(callId) {
  currentCallId = callId;
  const call = calls.find(c => c.callId === callId);

  // Update modal header
  const modalTitle = document.getElementById('modalTitle');
  const modalSubtitle = document.getElementById('modalSubtitle');

  if (modalTitle) {
    modalTitle.textContent = `Call Details: ${formatPhone(call?.phoneNumber || '')}`;
  }
  if (modalSubtitle) {
    modalSubtitle.textContent = `${formatDateTime(call?.startTime)} - Duration: ${formatDuration(call?.duration || 0)}`;
  }

  // Show modal
  document.getElementById('transcriptModal')?.classList.add('active');

  // Load transcript data
  const result = await getCallTranscript(callId);

  if (result.error) {
    renderTranscriptError(result.error);
    return;
  }

  renderTranscriptData(result.data, call);
}

function renderTranscriptData(data, call) {
  // Recording section
  const audioPlayer = document.getElementById('audioPlayer');
  const noRecording = document.getElementById('noRecording');
  const recordingDuration = document.getElementById('recordingDuration');

  if (data.recordingUrl) {
    if (audioPlayer) {
      audioPlayer.src = data.recordingUrl;
      audioPlayer.style.display = 'block';
    }
    if (noRecording) noRecording.style.display = 'none';
    if (recordingDuration) recordingDuration.textContent = formatDuration(data.duration || 0);
  } else {
    if (audioPlayer) audioPlayer.style.display = 'none';
    if (noRecording) noRecording.style.display = 'block';
  }

  // AI Summary section
  const summaryOverview = document.getElementById('summaryOverview');
  const summarySentiment = document.getElementById('summarySentiment');
  const summaryOutcome = document.getElementById('summaryOutcome');
  const actionItems = document.getElementById('actionItems');

  if (data.summary) {
    if (summaryOverview) {
      summaryOverview.textContent = data.summary.overview || 'No summary available.';
    }

    if (summarySentiment) {
      const sentiment = data.summary.sentiment || 'neutral';
      const sentimentText = sentiment.charAt(0).toUpperCase() + sentiment.slice(1);
      summarySentiment.innerHTML = `<span class="sentiment-${sentiment}">${sentimentText}</span>`;
    }

    if (summaryOutcome) {
      summaryOutcome.textContent = data.summary.outcome || call?.outcome || 'Not determined';
    }

    if (actionItems) {
      if (data.summary.actionItems && data.summary.actionItems.length > 0) {
        actionItems.innerHTML = data.summary.actionItems.map(item =>
          `<li>${escapeHtml(item)}</li>`
        ).join('');
      } else {
        actionItems.innerHTML = '<li>No action items</li>';
      }
    }
  } else {
    if (summaryOverview) summaryOverview.textContent = 'No AI summary available for this call.';
    if (summarySentiment) summarySentiment.innerHTML = '<span class="sentiment-neutral">Unknown</span>';
    if (summaryOutcome) summaryOutcome.textContent = call?.outcome || 'Not determined';
    if (actionItems) actionItems.innerHTML = '<li>No action items</li>';
  }

  // Transcript section
  const transcriptContent = document.getElementById('transcriptContent');
  const transcriptCount = document.getElementById('transcriptCount');

  if (!data.transcript || data.transcript.length === 0) {
    if (transcriptContent) {
      transcriptContent.innerHTML = '<div class="text-muted" style="padding: 20px; text-align: center;">No transcript available for this call.</div>';
    }
    if (transcriptCount) transcriptCount.textContent = '0 messages';
    return;
  }

  if (transcriptCount) {
    transcriptCount.textContent = `${data.transcript.length} messages`;
  }

  if (transcriptContent) {
    transcriptContent.innerHTML = data.transcript.map(entry => `
      <div class="transcript-entry">
        <div class="transcript-entry-time">${entry.time || formatTimeFromTimestamp(entry.timestamp)}</div>
        <div class="transcript-entry-speaker ${entry.speaker}">${entry.speaker === 'rep' ? 'REP' : 'CUSTOMER'}</div>
        <div class="transcript-entry-text">${escapeHtml(entry.text)}</div>
      </div>
    `).join('');
  }
}

function renderTranscriptError(errorMessage) {
  const summaryOverview = document.getElementById('summaryOverview');
  if (summaryOverview) {
    summaryOverview.textContent = errorMessage;
  }

  const transcriptContent = document.getElementById('transcriptContent');
  if (transcriptContent) {
    transcriptContent.innerHTML = `<div class="text-muted" style="padding: 20px; text-align: center;">${escapeHtml(errorMessage)}</div>`;
  }
}

function closeModal() {
  document.getElementById('transcriptModal')?.classList.remove('active');
}

function downloadTranscript() {
  const transcriptContent = document.getElementById('transcriptContent');
  const summaryOverview = document.getElementById('summaryOverview');

  const content = transcriptContent?.innerText || '';
  const summary = summaryOverview?.innerText || '';
  const fullText = `Summary:\n${summary}\n\nTranscript:\n${content}`;

  const blob = new Blob([fullText], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `transcript-${currentCallId}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

function copyTranscript() {
  const transcriptContent = document.getElementById('transcriptContent');
  const content = transcriptContent?.innerText || '';

  navigator.clipboard.writeText(content).then(() => {
    alert('Transcript copied to clipboard!');
  }).catch(() => {
    alert('Failed to copy transcript');
  });
}

// ===========================================
// NOTES MODAL
// ===========================================

function editNotes(callId, notes) {
  currentCallId = callId;

  const notesText = document.getElementById('editNotesText');
  if (notesText) {
    notesText.value = notes || '';
  }

  document.getElementById('notesModal')?.classList.add('active');
}

function closeNotesModal() {
  document.getElementById('notesModal')?.classList.remove('active');
}

async function saveNotes() {
  const notesText = document.getElementById('editNotesText');
  const notes = notesText?.value || '';

  const result = await updateCallNotes(currentCallId, notes);

  if (result.error) {
    alert(result.error);
    return;
  }

  // Update local state
  const call = calls.find(c => c.callId === currentCallId);
  if (call) {
    call.notes = notes;
  }

  renderCalls();
  closeNotesModal();
}

// ===========================================
// ACTIONS
// ===========================================

function callNumber(number) {
  window.location.href = `call.html?number=${encodeURIComponent(number)}`;
}

function exportHistory() {
  // Build export with current filters
  const filters = getFilters();

  // For now, export current view as CSV
  const headers = ['Phone', 'Contact', 'Status', 'Outcome', 'Duration', 'Date', 'Notes'];
  const rows = calls.map(call => [
    call.phoneNumber,
    call.contactName || '',
    call.status,
    call.outcome || '',
    call.duration ? formatDuration(call.duration) : '',
    call.startTime ? new Date(call.startTime).toISOString() : '',
    call.notes || ''
  ]);

  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `call-history-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ===========================================
// URL PARAMS
// ===========================================

function checkUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const callId = params.get('call');

  if (callId) {
    // Auto-open transcript modal after data loads
    setTimeout(() => viewTranscript(callId), 500);
  }
}

// ===========================================
// HELPER FUNCTIONS
// ===========================================

function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatTimeFromTimestamp(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
}

function formatStatus(status) {
  const statusMap = {
    connected: 'Connected',
    missed: 'Missed',
    no_answer: 'No Answer',
    busy: 'Busy',
    failed: 'Failed'
  };
  return statusMap[status] || status || 'Unknown';
}

function formatOutcome(outcome) {
  const outcomeMap = {
    booked: 'Booked',
    callback: 'Callback',
    not_interested: 'Not Interested',
    wrong_number: 'Wrong Number',
    voicemail: 'Voicemail'
  };
  return outcomeMap[outcome] || outcome || '';
}

function getStatusBadgeClass(status) {
  switch (status) {
    case 'connected': return 'success';
    case 'missed': return 'danger';
    case 'no_answer': return 'warning';
    case 'busy': return 'warning';
    case 'failed': return 'danger';
    default: return 'info';
  }
}

function escapeQuotes(str) {
  if (!str) return '';
  return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
}

function goToPage(page) {
  if (page < 1 || page > totalPages) return;
  currentPage = page;
  loadCalls();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ===========================================
// EXPOSE FUNCTIONS TO GLOBAL SCOPE
// ===========================================

window.applyFilters = applyFilters;
window.clearFilters = clearFilters;
window.viewTranscript = viewTranscript;
window.closeModal = closeModal;
window.downloadTranscript = downloadTranscript;
window.copyTranscript = copyTranscript;
window.editNotes = editNotes;
window.closeNotesModal = closeNotesModal;
window.saveNotes = saveNotes;
window.callNumber = callNumber;
window.exportHistory = exportHistory;
window.goToPage = goToPage;

// ===========================================
// PAGE INITIALIZATION
// ===========================================

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHistoryPage);
} else {
  initHistoryPage();
}
