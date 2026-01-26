/**
 * Supervisor Dashboard JavaScript
 *
 * Handles:
 * - Real-time active calls monitoring
 * - Live transcript viewing
 * - AI coaching suggestions
 * - Listen/Whisper/Barge functionality
 */

// ===========================================
// STATE
// ===========================================
let activeCalls = new Map();
let selectedCallSid = null;
let isListening = false;
let durationInterval = null;
let callSubscription = null;
let ws = null;

// ===========================================
// INITIALIZATION
// ===========================================
document.addEventListener('DOMContentLoaded', () => {
  initPage({
    requireAuth: true,
    onReady: async (user) => {
      // Check supervisor role
      const isAuthorized = await hasRole(['supervisor', 'manager', 'admin']);
      if (!isAuthorized) {
        alert('You do not have permission to access this page');
        window.location.href = 'dashboard.html';
        return;
      }

      // Update sidebar user info
      if (user) {
        const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Supervisor';
        const userNameEl = document.querySelector('.sidebar-user-name');
        const userAvatarEl = document.getElementById('userAvatar');
        if (userNameEl) userNameEl.textContent = name;
        if (userAvatarEl) userAvatarEl.textContent = name.charAt(0).toUpperCase();
      }

      // Connect WebSocket for real-time updates
      connectWebSocket();

      // Load initial data
      await loadActiveCalls();

      // Subscribe to database changes
      subscribeToCallUpdates();

      // Update durations every second
      setInterval(updateAllDurations, 1000);

      // Set up event listeners
      setupEventListeners();
    },
    onError: (error) => {
      console.error('Supervisor init error:', error);
      updateConnectionStatus(false);
    }
  });
});

// ===========================================
// WEBSOCKET CONNECTION
// ===========================================

function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${window.location.host}/browser?role=supervisor&identity=supervisor-${Date.now()}`);

  ws.onopen = () => {
    console.log('WebSocket connected');
    updateConnectionStatus(true);
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handleWebSocketMessage(data);
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  };

  ws.onclose = () => {
    console.log('WebSocket disconnected');
    updateConnectionStatus(false);
    // Reconnect after 3 seconds
    setTimeout(connectWebSocket, 3000);
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
}

/**
 * Handle incoming WebSocket messages
 */
function handleWebSocketMessage(data) {
  switch (data.type) {
    case 'call_started':
      activeCalls.set(data.callSid, {
        callSid: data.callSid,
        repIdentity: data.repIdentity || 'Unknown Rep',
        customerNumber: data.customerNumber || 'Unknown',
        startTime: data.startTime || Date.now(),
        status: 'connected'
      });
      renderCallsList();
      break;

    case 'call_ended':
      activeCalls.delete(data.callSid);
      if (selectedCallSid === data.callSid) {
        deselectCall();
      }
      renderCallsList();
      break;

    case 'transcript':
      if (data.callSid === selectedCallSid && isListening) {
        addTranscript(data);
      }
      // Update call's transcript cache
      const call = activeCalls.get(data.callSid);
      if (call) {
        if (!call.transcript) call.transcript = [];
        call.transcript.push(data);
      }
      break;

    case 'full_transcript':
      if (data.callSid === selectedCallSid) {
        const transcriptBox = document.getElementById('transcriptBox');
        transcriptBox.innerHTML = '';
        data.transcript.forEach(t => addTranscript({ ...t, isFinal: true }));
      }
      break;

    case 'ai_coaching':
      if (data.callSid === selectedCallSid) {
        addAISuggestion(data);
      }
      break;
  }
}

// ===========================================
// DATA LOADING
// ===========================================

/**
 * Load active calls from Supabase
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
        user_id, transcript,
        user:users(id, full_name)
      `)
      .eq('company_id', companyId)
      .eq('ai_agent', false)
      .in('status', ['ringing', 'in-progress', 'connected'])
      .order('started_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error loading active calls:', error);
      return;
    }

    activeCalls.clear();
    (data || []).forEach(call => {
      activeCalls.set(call.call_sid, {
        callSid: call.call_sid,
        repIdentity: call.user?.full_name || 'Unknown Rep',
        customerNumber: call.phone_number,
        startTime: new Date(call.started_at).getTime(),
        status: mapCallStatus(call.status),
        transcript: parseTranscript(call.transcript)
      });
    });

    renderCallsList();

  } catch (error) {
    console.error('Error loading active calls:', error);
  }
}

/**
 * Fetch active calls from API (fallback)
 */
async function fetchActiveCalls() {
  try {
    const response = await fetch(BACKEND_URL + '/api/active-calls');
    if (!response.ok) throw new Error('API error');

    const data = await response.json();
    activeCalls.clear();
    (data.calls || []).forEach(call => {
      activeCalls.set(call.callSid, call);
    });
    renderCallsList();
  } catch (error) {
    console.error('Error fetching active calls:', error);
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
    'completed': 'ended'
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
  const callCount = document.getElementById('callCount');
  const callsList = document.getElementById('callsList');

  if (callCount) callCount.textContent = activeCalls.size;

  if (activeCalls.size === 0) {
    callsList.innerHTML = `
      <div class="empty-calls">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
        </svg>
        <p>No active calls</p>
        <p style="font-size: 0.85rem; margin-top: 5px;">Calls will appear here when reps start calling</p>
      </div>
    `;
    return;
  }

  callsList.innerHTML = '';
  activeCalls.forEach((call, callSid) => {
    const duration = formatDuration(Math.floor((Date.now() - call.startTime) / 1000));
    const isSelected = callSid === selectedCallSid;

    const card = document.createElement('div');
    card.className = `call-card ${isSelected ? 'selected' : ''}`;
    card.onclick = () => selectCall(callSid);
    card.innerHTML = `
      <div class="rep-name">${escapeHtml(call.repIdentity)}</div>
      <div class="customer-number">${escapeHtml(formatPhone(call.customerNumber))}</div>
      <div class="call-meta">
        <span class="duration">${duration}</span>
        ${isSelected && isListening ? '<span class="listen-badge">Listening</span>' : ''}
      </div>
    `;
    callsList.appendChild(card);
  });
}

/**
 * Select a call to monitor
 */
function selectCall(callSid) {
  selectedCallSid = callSid;
  const call = activeCalls.get(callSid);

  if (!call) return;

  // Update UI
  document.getElementById('noCallSelected').style.display = 'none';
  document.getElementById('callDetailsContent').style.display = 'flex';

  document.getElementById('selectedRepName').textContent = call.repIdentity;
  document.getElementById('selectedCustomerNumber').textContent = `Customer: ${formatPhone(call.customerNumber)}`;

  // Reset listening state
  isListening = false;
  const listenBtn = document.getElementById('listenBtn');
  const listenBtnText = document.getElementById('listenBtnText');
  const liveIndicator = document.getElementById('liveIndicator');
  const transcriptBox = document.getElementById('transcriptBox');
  const aiSuggestions = document.getElementById('aiSuggestions');

  if (listenBtn) listenBtn.classList.remove('active');
  if (listenBtnText) listenBtnText.textContent = 'Listen';
  if (liveIndicator) liveIndicator.style.display = 'none';

  transcriptBox.innerHTML = '<div class="empty-state" style="text-align: center; color: #64748b; padding: 20px;">Click "Listen" to view live transcript</div>';
  aiSuggestions.innerHTML = '<div style="color: #64748b; font-size: 0.9rem;">AI suggestions will appear as the call progresses</div>';

  // Update duration
  if (durationInterval) clearInterval(durationInterval);
  updateDuration(call.startTime);
  durationInterval = setInterval(() => updateDuration(call.startTime), 1000);

  renderCallsList();
}

/**
 * Deselect current call
 */
function deselectCall() {
  selectedCallSid = null;
  isListening = false;
  document.getElementById('noCallSelected').style.display = 'flex';
  document.getElementById('callDetailsContent').style.display = 'none';
  if (durationInterval) clearInterval(durationInterval);
  renderCallsList();
}

/**
 * Update duration display
 */
function updateDuration(startTime) {
  const seconds = Math.floor((Date.now() - startTime) / 1000);
  const selectedDuration = document.getElementById('selectedDuration');
  if (selectedDuration) {
    selectedDuration.textContent = `Duration: ${formatDuration(seconds)}`;
  }
}

/**
 * Update all durations
 */
function updateAllDurations() {
  renderCallsList();
  if (selectedCallSid) {
    const call = activeCalls.get(selectedCallSid);
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
  if (!selectedCallSid) return;

  isListening = !isListening;

  const listenBtn = document.getElementById('listenBtn');
  const listenBtnText = document.getElementById('listenBtnText');
  const liveIndicator = document.getElementById('liveIndicator');
  const transcriptBox = document.getElementById('transcriptBox');

  if (isListening) {
    // Start listening
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'listen_to_call',
        callSid: selectedCallSid
      }));
    }
    listenBtn.classList.add('active');
    listenBtnText.textContent = 'Stop';
    liveIndicator.style.display = 'inline-flex';

    // Show existing transcript
    const call = activeCalls.get(selectedCallSid);
    if (call && call.transcript && call.transcript.length > 0) {
      transcriptBox.innerHTML = '';
      call.transcript.forEach(t => addTranscript({ ...t, isFinal: true }));
    } else {
      transcriptBox.innerHTML = '';
    }

  } else {
    // Stop listening
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'stop_listening'
      }));
    }
    listenBtn.classList.remove('active');
    listenBtnText.textContent = 'Listen';
    liveIndicator.style.display = 'none';
  }

  renderCallsList();
}

/**
 * Add transcript line
 */
function addTranscript(data) {
  const transcriptBox = document.getElementById('transcriptBox');

  // Remove empty state
  const emptyState = transcriptBox.querySelector('.empty-state');
  if (emptyState) emptyState.remove();

  if (data.isFinal) {
    const line = document.createElement('div');
    line.className = 'transcript-line';
    const time = new Date(data.timestamp || Date.now()).toLocaleTimeString();
    line.innerHTML = `
      <div class="timestamp">${time}</div>
      <div>${escapeHtml(data.text)}</div>
    `;
    transcriptBox.appendChild(line);
  } else {
    // Interim result - update or create
    let interimLine = transcriptBox.querySelector('.transcript-line.interim');
    if (!interimLine) {
      interimLine = document.createElement('div');
      interimLine.className = 'transcript-line interim';
      transcriptBox.appendChild(interimLine);
    }
    const time = new Date(data.timestamp || Date.now()).toLocaleTimeString();
    interimLine.innerHTML = `
      <div class="timestamp">${time}</div>
      <div>${escapeHtml(data.text)}</div>
    `;
  }

  transcriptBox.scrollTop = transcriptBox.scrollHeight;
}

/**
 * Add AI suggestion
 */
function addAISuggestion(data) {
  const aiSuggestions = document.getElementById('aiSuggestions');

  // Remove placeholder
  const placeholder = aiSuggestions.querySelector('div[style*="color: #64748b"]');
  if (placeholder) placeholder.remove();

  const item = document.createElement('div');
  item.className = 'suggestion-item';
  const time = new Date(data.timestamp || Date.now()).toLocaleTimeString();
  item.innerHTML = `
    ${escapeHtml(data.suggestion)}
    <div class="time">${time}</div>
  `;
  aiSuggestions.insertBefore(item, aiSuggestions.firstChild);
}

// ===========================================
// REAL-TIME SUBSCRIPTIONS
// ===========================================

/**
 * Subscribe to call updates from database
 */
function subscribeToCallUpdates() {
  getCompanyMembership().then(({ companyId }) => {
    if (!companyId) return;

    callSubscription = supabase
      .channel('supervisor-calls')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'calls',
        filter: `company_id=eq.${companyId}`
      }, (payload) => {
        handleCallDatabaseUpdate(payload);
      })
      .subscribe();
  });
}

/**
 * Handle database call updates
 */
function handleCallDatabaseUpdate(payload) {
  const { eventType, new: newData, old: oldData } = payload;

  // Skip AI agent calls (those are handled by agent-monitor)
  if (newData && newData.ai_agent) return;

  if (eventType === 'INSERT' || eventType === 'UPDATE') {
    const status = mapCallStatus(newData.status);

    if (['ringing', 'connected'].includes(status)) {
      activeCalls.set(newData.call_sid, {
        callSid: newData.call_sid,
        repIdentity: 'Loading...',
        customerNumber: newData.phone_number,
        startTime: new Date(newData.started_at).getTime(),
        status: status,
        transcript: parseTranscript(newData.transcript)
      });

      // Load rep name
      if (newData.user_id) {
        loadRepName(newData.call_sid, newData.user_id);
      }

    } else if (status === 'ended' || newData.status === 'completed') {
      activeCalls.delete(newData.call_sid);
      if (selectedCallSid === newData.call_sid) {
        deselectCall();
      }
    }

    renderCallsList();
  }

  if (eventType === 'DELETE' && oldData) {
    activeCalls.delete(oldData.call_sid);
    if (selectedCallSid === oldData.call_sid) {
      deselectCall();
    }
    renderCallsList();
  }
}

/**
 * Load rep name for a call
 */
async function loadRepName(callSid, userId) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', userId)
      .single();

    if (!error && data) {
      const call = activeCalls.get(callSid);
      if (call) {
        call.repIdentity = data.full_name || 'Unknown Rep';
        renderCallsList();
      }
    }
  } catch (error) {
    console.error('Error loading rep name:', error);
  }
}

// ===========================================
// CONNECTION STATUS
// ===========================================

function updateConnectionStatus(connected) {
  const statusEl = document.getElementById('connectionStatus');
  const statusText = document.getElementById('statusText');
  const connectionText = document.getElementById('connectionText');
  const userStatus = document.getElementById('userStatus');

  if (connected) {
    if (statusEl) {
      statusEl.className = 'connection-status connected';
      statusEl.innerHTML = '<span class="connection-dot"></span><span class="desktop-only">Connected</span>';
    }
    if (statusText) statusText.textContent = 'Connected';
    if (connectionText) connectionText.textContent = 'Online';
    if (userStatus) userStatus.style.color = 'var(--success)';
  } else {
    if (statusEl) {
      statusEl.className = 'connection-status disconnected';
      statusEl.innerHTML = '<span class="connection-dot"></span><span class="desktop-only">Disconnected</span>';
    }
    if (statusText) statusText.textContent = 'Disconnected';
    if (connectionText) connectionText.textContent = 'Offline';
    if (userStatus) userStatus.style.color = 'var(--gray-400)';
  }
}

// ===========================================
// EVENT LISTENERS
// ===========================================

function setupEventListeners() {
  const listenBtn = document.getElementById('listenBtn');
  if (listenBtn) {
    listenBtn.addEventListener('click', toggleListening);
  }

  // Refresh active calls periodically
  setInterval(() => {
    if (ws && ws.readyState !== WebSocket.OPEN) {
      loadActiveCalls();
    }
  }, 10000);
}

// ===========================================
// UTILITY FUNCTIONS
// ===========================================

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
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
