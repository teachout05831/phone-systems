/**
 * AI Agent Monitor JavaScript
 *
 * Handles:
 * - Real-time active AI calls display
 * - Live transcript viewing
 * - AI analysis display
 * - Call control actions
 */

// ===========================================
// STATE
// ===========================================
let activeCalls = new Map();
let selectedCallId = null;
let isListening = false;
let durationInterval = null;
let callSubscription = null;

// ===========================================
// INITIALIZATION
// ===========================================
document.addEventListener('DOMContentLoaded', () => {
  initPage({
    requireAuth: true,
    onReady: async (user) => {
      // Update sidebar user info
      if (user) {
        const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Supervisor';
        const userNameEl = document.querySelector('.sidebar-user-name');
        const userAvatarEl = document.getElementById('userAvatar');
        if (userNameEl) userNameEl.textContent = name;
        if (userAvatarEl) userAvatarEl.textContent = name.charAt(0).toUpperCase();
      }

      // Load active calls
      await loadActiveCalls();

      // Subscribe to real-time updates
      subscribeToCallUpdates();

      // Update durations every second
      setInterval(updateAllDurations, 1000);

      updateConnectionStatus(true);
    },
    onError: (error) => {
      console.error('Agent Monitor init error:', error);
      updateConnectionStatus(false);
    }
  });
});

// ===========================================
// DATA LOADING
// ===========================================

/**
 * Load active AI calls from Supabase
 */
async function loadActiveCalls() {
  try {
    const { companyId, error: membershipError } = await getCompanyMembership();
    if (membershipError || !companyId) {
      console.log('No company membership found');
      renderCallsList();
      return;
    }

    const { data, error } = await supabase
      .from('calls')
      .select(`
        id, call_sid, status, phone_number, started_at,
        direction, ai_agent, transcript,
        contact:contacts(id, first_name, last_name)
      `)
      .eq('company_id', companyId)
      .eq('ai_agent', true)
      .in('status', ['ringing', 'in-progress', 'connected'])
      .order('started_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error loading active calls:', error);
      return;
    }

    activeCalls.clear();
    (data || []).forEach(call => {
      const contactName = call.contact
        ? `${call.contact.first_name || ''} ${call.contact.last_name || ''}`.trim()
        : 'Unknown';

      activeCalls.set(call.call_sid, {
        callId: call.call_sid,
        contactId: call.contact?.id,
        contactName: contactName || 'Unknown',
        phoneNumber: call.phone_number,
        status: mapCallStatus(call.status),
        startTime: new Date(call.started_at).getTime(),
        transcript: parseTranscript(call.transcript),
        sentiment: 'neutral',
        intent: 'Unknown',
        confidence: 0,
        summary: 'Loading...'
      });
    });

    renderCallsList();

  } catch (error) {
    console.error('Error loading active calls:', error);
  }
}

/**
 * Map database status to display status
 */
function mapCallStatus(status) {
  const statusMap = {
    'ringing': 'ringing',
    'in-progress': 'connected',
    'connected': 'connected',
    'completed': 'ended',
    'busy': 'ended',
    'no-answer': 'ended',
    'failed': 'ended'
  };
  return statusMap[status] || status;
}

/**
 * Parse transcript from JSON
 */
function parseTranscript(transcript) {
  if (!transcript) return [];
  if (typeof transcript === 'string') {
    try {
      return JSON.parse(transcript);
    } catch {
      return [];
    }
  }
  return Array.isArray(transcript) ? transcript : [];
}

// ===========================================
// RENDERING
// ===========================================

/**
 * Render the active calls list
 */
function renderCallsList() {
  const callsList = document.getElementById('callsList');
  const callCount = document.getElementById('callCount');

  if (callCount) callCount.textContent = activeCalls.size;

  if (activeCalls.size === 0) {
    callsList.innerHTML = `
      <div class="empty-calls">
        <div class="icon">Robot</div>
        <p>No active AI calls</p>
        <p style="font-size: 0.85rem; margin-top: 5px;">AI calls will appear here when agents start calling</p>
      </div>
    `;
    return;
  }

  callsList.innerHTML = '';
  activeCalls.forEach((call, callId) => {
    const duration = formatDuration(Math.floor((Date.now() - call.startTime) / 1000));
    const isSelected = callId === selectedCallId;

    const card = document.createElement('div');
    card.className = `ai-call-card ${isSelected ? 'selected' : ''}`;
    card.onclick = () => selectCall(callId);
    card.innerHTML = `
      <div class="contact-name">
        ${escapeHtml(call.contactName)}
        <span class="ai-badge">AI</span>
      </div>
      <div class="phone-number">${escapeHtml(formatPhone(call.phoneNumber))}</div>
      <div class="call-meta">
        <span class="duration">${duration}</span>
        <span class="call-status-badge ${call.status}">${capitalizeFirst(call.status)}</span>
      </div>
    `;
    callsList.appendChild(card);
  });
}

/**
 * Select a call to monitor
 */
function selectCall(callId) {
  selectedCallId = callId;
  const call = activeCalls.get(callId);

  if (!call) return;

  // Update UI
  document.getElementById('noCallSelected').style.display = 'none';
  document.getElementById('callDetailsContent').style.display = 'flex';

  document.getElementById('selectedContactName').textContent = call.contactName;
  document.getElementById('selectedPhoneNumber').textContent = `Customer: ${formatPhone(call.phoneNumber)}`;

  // Reset listening state
  isListening = false;
  const listenBtn = document.getElementById('listenBtn');
  const listenBtnText = document.getElementById('listenBtnText');
  const liveIndicator = document.getElementById('liveIndicator');

  if (listenBtn) listenBtn.classList.remove('active');
  if (listenBtnText) listenBtnText.textContent = 'Listen';
  if (liveIndicator) liveIndicator.style.display = 'none';

  document.getElementById('transcriptBox').innerHTML =
    '<div class="empty-state" style="text-align: center; color: var(--gray-500); padding: var(--spacing-xl);">Click "Listen" to view live transcript</div>';

  // Update AI analysis
  updateAiAnalysis(call);

  // Update duration
  if (durationInterval) clearInterval(durationInterval);
  updateDuration(call.startTime);
  durationInterval = setInterval(() => updateDuration(call.startTime), 1000);

  renderCallsList();
}

/**
 * Update AI analysis display
 */
function updateAiAnalysis(call) {
  const aiSentiment = document.getElementById('aiSentiment');
  const aiIntent = document.getElementById('aiIntent');
  const aiConfidence = document.getElementById('aiConfidence');
  const aiSummary = document.getElementById('aiSummary');

  if (aiSentiment) {
    aiSentiment.textContent = capitalizeFirst(call.sentiment);
    aiSentiment.className = 'value ' + call.sentiment;
  }
  if (aiIntent) aiIntent.textContent = call.intent;
  if (aiConfidence) aiConfidence.textContent = call.confidence + '%';
  if (aiSummary) aiSummary.textContent = call.summary;
}

/**
 * Update duration display for selected call
 */
function updateDuration(startTime) {
  const seconds = Math.floor((Date.now() - startTime) / 1000);
  const durationEl = document.getElementById('selectedDuration');
  const costEl = document.getElementById('selectedCost');

  if (durationEl) durationEl.textContent = `Duration: ${formatDuration(seconds)}`;

  // Update cost estimate ($0.07/min)
  if (costEl) {
    const minutes = seconds / 60;
    const cost = (minutes * 0.07).toFixed(2);
    costEl.textContent = `Est. Cost: $${cost}`;
  }
}

/**
 * Update all call durations in the list
 */
function updateAllDurations() {
  renderCallsList();
  if (selectedCallId) {
    const call = activeCalls.get(selectedCallId);
    if (call) updateDuration(call.startTime);
  }
}

// ===========================================
// CALL ACTIONS
// ===========================================

/**
 * Toggle listening to call
 */
function toggleListening() {
  if (!selectedCallId) return;

  isListening = !isListening;
  const call = activeCalls.get(selectedCallId);

  const listenBtn = document.getElementById('listenBtn');
  const listenBtnText = document.getElementById('listenBtnText');
  const liveIndicator = document.getElementById('liveIndicator');
  const transcriptBox = document.getElementById('transcriptBox');

  if (isListening) {
    listenBtn.classList.add('active');
    listenBtnText.textContent = 'Stop';
    liveIndicator.style.display = 'inline-flex';

    // Show transcript
    if (call && call.transcript.length > 0) {
      transcriptBox.innerHTML = '';
      call.transcript.forEach(t => addTranscriptLine(t));
    } else {
      transcriptBox.innerHTML = '<div class="empty-state" style="text-align: center; color: var(--gray-500); padding: var(--spacing-xl);">Waiting for conversation...</div>';
    }

    // Subscribe to transcript updates
    subscribeToTranscript(selectedCallId);
  } else {
    listenBtn.classList.remove('active');
    listenBtnText.textContent = 'Listen';
    liveIndicator.style.display = 'none';
  }

  renderCallsList();
}

/**
 * Add a transcript line to the display
 */
function addTranscriptLine(data) {
  const transcriptBox = document.getElementById('transcriptBox');

  // Remove empty state if present
  const emptyState = transcriptBox.querySelector('.empty-state');
  if (emptyState) emptyState.remove();

  const line = document.createElement('div');
  line.className = `transcript-line ${data.speaker || 'agent'}`;

  const time = data.timestamp
    ? new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  line.innerHTML = `
    <span class="timestamp">${time}</span>
    <div class="speaker">${data.speaker === 'agent' ? 'AI Agent' : 'Customer'}</div>
    <div>${escapeHtml(data.text)}</div>
  `;

  transcriptBox.appendChild(line);
  transcriptBox.scrollTop = transcriptBox.scrollHeight;
}

/**
 * End the selected call
 */
async function endCall() {
  if (!selectedCallId) return;

  const call = activeCalls.get(selectedCallId);
  if (!call) return;

  if (!confirm(`Are you sure you want to end the call with ${call.contactName}?`)) return;

  try {
    // Security: Get company_id to verify ownership
    const { companyId, error: membershipError } = await getCompanyMembership();
    if (membershipError || !companyId) {
      alert('Unable to verify company membership');
      return;
    }

    // Security: Filter by both call_sid AND company_id to prevent ending other companies' calls
    const { error } = await supabase
      .from('calls')
      .update({
        status: 'completed',
        ended_at: new Date().toISOString()
      })
      .eq('call_sid', selectedCallId)
      .eq('company_id', companyId);

    if (error) {
      console.error('Error ending call:', error);
      alert('Failed to end call');
      return;
    }

    alert('Call ended');

    // Remove from active calls
    activeCalls.delete(selectedCallId);
    deselectCall();
    renderCallsList();

  } catch (error) {
    console.error('Error ending call:', error);
    alert('Failed to end call');
  }
}

/**
 * View contact profile
 */
function viewContact() {
  const call = activeCalls.get(selectedCallId);
  if (call && call.contactId) {
    window.location.href = `contact-profile.html?id=${call.contactId}`;
  } else {
    alert('Contact not found');
  }
}

/**
 * Deselect current call
 */
function deselectCall() {
  selectedCallId = null;
  isListening = false;
  document.getElementById('noCallSelected').style.display = 'flex';
  document.getElementById('callDetailsContent').style.display = 'none';
  if (durationInterval) clearInterval(durationInterval);
  renderCallsList();
}

// ===========================================
// REAL-TIME SUBSCRIPTIONS
// ===========================================

/**
 * Subscribe to call updates
 */
function subscribeToCallUpdates() {
  getCompanyMembership().then(({ companyId }) => {
    if (!companyId) return;

    callSubscription = supabase
      .channel('ai-calls-monitor')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'calls',
        filter: `company_id=eq.${companyId}`
      }, (payload) => {
        handleCallUpdate(payload);
      })
      .subscribe();
  });
}

/**
 * Handle real-time call updates
 */
function handleCallUpdate(payload) {
  const { eventType, new: newData, old: oldData } = payload;

  // Only handle AI agent calls
  if (newData && !newData.ai_agent) return;

  if (eventType === 'INSERT' || eventType === 'UPDATE') {
    const status = mapCallStatus(newData.status);

    if (['ringing', 'connected'].includes(status)) {
      // Add or update active call
      activeCalls.set(newData.call_sid, {
        callId: newData.call_sid,
        contactId: newData.contact_id,
        contactName: 'Loading...',
        phoneNumber: newData.phone_number,
        status: status,
        startTime: new Date(newData.started_at).getTime(),
        transcript: parseTranscript(newData.transcript),
        sentiment: 'neutral',
        intent: 'Unknown',
        confidence: 0,
        summary: 'Processing...'
      });

      // Load contact name
      loadContactName(newData.call_sid, newData.contact_id);

    } else if (status === 'ended') {
      // Remove from active calls
      activeCalls.delete(newData.call_sid);
      if (selectedCallId === newData.call_sid) {
        deselectCall();
      }
    }

    renderCallsList();
  }

  if (eventType === 'DELETE' && oldData) {
    activeCalls.delete(oldData.call_sid);
    if (selectedCallId === oldData.call_sid) {
      deselectCall();
    }
    renderCallsList();
  }
}

/**
 * Load contact name for a call
 */
async function loadContactName(callSid, contactId) {
  if (!contactId) return;

  try {
    // Security: Get company_id to verify ownership
    const { companyId, error: membershipError } = await getCompanyMembership();
    if (membershipError || !companyId) return;

    // Security: Filter by both id AND company_id to prevent data leakage
    const { data, error } = await supabase
      .from('contacts')
      .select('first_name, last_name')
      .eq('id', contactId)
      .eq('company_id', companyId)
      .single();

    if (!error && data) {
      const call = activeCalls.get(callSid);
      if (call) {
        call.contactName = `${data.first_name || ''} ${data.last_name || ''}`.trim() || 'Unknown';
        renderCallsList();
      }
    }
  } catch (error) {
    console.error('Error loading contact name:', error);
  }
}

/**
 * Subscribe to transcript updates for a specific call
 */
function subscribeToTranscript(callSid) {
  // In a real implementation, this would connect to a WebSocket
  // for real-time transcript streaming
  console.log('Subscribed to transcript for call:', callSid);
}

// ===========================================
// CONNECTION STATUS
// ===========================================

function updateConnectionStatus(connected) {
  const statusEl = document.getElementById('connectionStatus');
  const statusText = document.getElementById('statusText');
  const connectionText = document.getElementById('connectionText');

  if (connected) {
    if (statusEl) {
      statusEl.className = 'connection-status connected';
      statusEl.innerHTML = '<span class="connection-dot"></span><span class="desktop-only">Connected</span>';
    }
    if (statusText) statusText.textContent = 'Connected';
    if (connectionText) connectionText.textContent = 'Online';
  } else {
    if (statusEl) {
      statusEl.className = 'connection-status disconnected';
      statusEl.innerHTML = '<span class="connection-dot"></span><span class="desktop-only">Disconnected</span>';
    }
    if (statusText) statusText.textContent = 'Disconnected';
    if (connectionText) connectionText.textContent = 'Offline';
  }
}

// ===========================================
// UTILITY FUNCTIONS
// ===========================================

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function capitalizeFirst(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ===========================================
// SIDEBAR FUNCTIONS
// ===========================================

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('collapsed');
  localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
}

function openSidebar() {
  document.getElementById('sidebar').classList.add('mobile-open');
  document.getElementById('sidebarOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('mobile-open');
  document.getElementById('sidebarOverlay').classList.remove('active');
  document.body.style.overflow = '';
}

// Restore sidebar state
(function initSidebar() {
  const savedCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
  if (savedCollapsed && window.innerWidth > 1024) {
    document.getElementById('sidebar')?.classList.add('collapsed');
  }
})();
