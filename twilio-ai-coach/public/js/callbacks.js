/**
 * Callbacks Page - Supabase Integration
 *
 * Handles callback management including:
 * - Loading scheduled callbacks
 * - Logging callback attempts
 * - Marking callbacks as completed or exhausted
 *
 * Security: All queries filter by company_id, auth checked on load
 */

// ===========================================
// STATE
// ===========================================
let callbacks = [];
let completedCallbacks = [];
let currentTab = 'needs-callback';
let currentCallbackId = null;
let settings = { requiredAttempts: 3 };
let companyId = null;

// State for Log Attempt modal
let selectedAttemptMethod = 'call';
let selectedAttemptResult = 'no_answer';

// State for Mark Connected modal
let selectedConnectedMethod = 'call';

// ===========================================
// INITIALIZATION
// ===========================================

document.addEventListener('DOMContentLoaded', () => {
  initPage({
    requireAuth: true,
    onReady: async (user) => {
      // Update user display
      if (user) {
        const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
        const userAvatarEl = document.getElementById('userAvatar');
        if (userAvatarEl) userAvatarEl.textContent = name.charAt(0).toUpperCase();
        const connectionTextEl = document.getElementById('connectionText');
        if (connectionTextEl) connectionTextEl.textContent = 'Available';
      }

      // Get company membership
      const membership = await getCompanyMembership();
      if (membership.error || !membership.companyId) {
        showError('#needsCallbackList', 'Unable to load callbacks. Please try again.');
        return;
      }
      companyId = membership.companyId;

      // Load data
      await loadAllData();

      // Set up real-time subscription
      setupRealtimeSubscription();

      // Update connection status
      updateConnectionStatus(true);
    },
    onError: (error) => {
      console.error('Callbacks page init error:', error);
      showError('#needsCallbackList', 'Failed to load callbacks');
    }
  });
});

// ===========================================
// DATA LOADING
// ===========================================

async function loadAllData() {
  if (!companyId) return;

  await Promise.all([
    loadCallbacks(),
    loadCompletedCallbacks()
  ]);
  updateStats();
  updateBadges();
}

async function loadCallbacks() {
  if (!companyId) return;

  try {
    const { data, error } = await supabase
      .from('callbacks')
      .select(`
        id,
        contact_id,
        phone_number,
        scheduled_at,
        status,
        attempt_count,
        max_attempts,
        last_attempt_at,
        attempt_history,
        reason,
        priority,
        created_at,
        contact:contacts(id, first_name, last_name, phone, business_name)
      `)
      .eq('company_id', companyId)
      .in('status', ['scheduled', 'pending', 'in_progress'])
      .order('scheduled_at', { ascending: true })
      .limit(100);

    if (error) throw error;

    callbacks = (data || []).map(cb => ({
      id: cb.id,
      contactId: cb.contact_id,
      phoneNumber: cb.phone_number || cb.contact?.phone || 'Unknown',
      contactName: cb.contact
        ? `${cb.contact.first_name || ''} ${cb.contact.last_name || ''}`.trim() || cb.contact.business_name || 'Unknown'
        : 'Unknown',
      scheduledAt: cb.scheduled_at,
      status: cb.status,
      attemptCount: cb.attempt_count || 0,
      maxAttempts: cb.max_attempts || 3,
      lastAttemptAt: cb.last_attempt_at,
      attemptHistory: cb.attempt_history || [],
      reason: cb.reason,
      priority: cb.priority,
      createdAt: cb.created_at
    }));

    console.log(`Loaded ${callbacks.length} callbacks`);
    renderCallbacks();

  } catch (error) {
    console.error('Failed to load callbacks:', error);
    showError('#needsCallbackList', 'Failed to load callbacks');
  }
}

async function loadCompletedCallbacks() {
  if (!companyId) return;

  const filter = document.getElementById('completedFilter')?.value || 'today';

  // Calculate date range
  const now = new Date();
  let startDate = new Date(now);

  switch (filter) {
    case 'today':
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'week':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(startDate.getMonth() - 1);
      break;
    default:
      startDate.setHours(0, 0, 0, 0);
  }

  try {
    const { data, error } = await supabase
      .from('callbacks')
      .select(`
        id,
        contact_id,
        phone_number,
        status,
        attempt_count,
        completed_at,
        resolution_notes,
        contact:contacts(id, first_name, last_name, phone)
      `)
      .eq('company_id', companyId)
      .in('status', ['completed', 'exhausted', 'cancelled'])
      .gte('completed_at', startDate.toISOString())
      .order('completed_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    completedCallbacks = (data || []).map(cb => ({
      id: cb.id,
      phoneNumber: cb.phone_number || cb.contact?.phone || 'Unknown',
      contactName: cb.contact
        ? `${cb.contact.first_name || ''} ${cb.contact.last_name || ''}`.trim()
        : 'Unknown',
      status: cb.status,
      attemptCount: cb.attempt_count || 0,
      completedAt: cb.completed_at,
      notes: cb.resolution_notes
    }));

    renderCompletedCallbacks();

  } catch (error) {
    console.error('Failed to load completed callbacks:', error);
  }
}

// ===========================================
// RENDERING
// ===========================================

function renderCallbacks() {
  const needsCallbackList = document.getElementById('needsCallbackList');
  const scheduledList = document.getElementById('scheduledList');

  // Get today's date boundaries
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  // Split by date:
  // - Needs Callback: Due today, overdue, or no schedule set
  // - Scheduled: Future dates (tomorrow and beyond)
  const needsCallback = callbacks.filter(cb => {
    if (!cb.scheduledAt) return true; // No schedule = needs callback now
    const scheduledDate = new Date(cb.scheduledAt);
    return scheduledDate <= todayEnd; // Today or overdue
  });

  const scheduled = callbacks.filter(cb => {
    if (!cb.scheduledAt) return false; // No schedule = not in scheduled tab
    const scheduledDate = new Date(cb.scheduledAt);
    return scheduledDate > todayEnd; // Future dates only
  });

  // Render needs callback section (today + overdue)
  if (needsCallbackList) {
    if (needsCallback.length === 0) {
      needsCallbackList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">✅</div>
          <div class="empty-state-title">All caught up for today!</div>
          <div class="empty-state-text">No callbacks due today</div>
        </div>
      `;
    } else {
      // Sort: overdue first, then by scheduled time
      needsCallback.sort((a, b) => {
        const aDate = a.scheduledAt ? new Date(a.scheduledAt) : new Date(0);
        const bDate = b.scheduledAt ? new Date(b.scheduledAt) : new Date(0);
        return aDate - bDate;
      });
      needsCallbackList.innerHTML = needsCallback.map(cb => renderCallbackCard(cb, 'needs')).join('');
    }
  }

  // Render scheduled section (future dates)
  if (scheduledList) {
    if (scheduled.length === 0) {
      scheduledList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📅</div>
          <div class="empty-state-title">No upcoming callbacks</div>
          <div class="empty-state-text">Callbacks scheduled for future dates will appear here</div>
        </div>
      `;
    } else {
      // Sort by scheduled date
      scheduled.sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
      scheduledList.innerHTML = scheduled.map(cb => renderCallbackCard(cb, 'scheduled')).join('');
    }
  }

  // Update tab counts
  const needsCount = document.getElementById('needsCallbackCount');
  const scheduledCount = document.getElementById('scheduledCount');
  if (needsCount) needsCount.textContent = needsCallback.length;
  if (scheduledCount) scheduledCount.textContent = scheduled.length;
}

function renderCallbackCard(cb, type) {
  const safePhone = escapeHtml(formatPhone(cb.phoneNumber));
  const safeName = escapeHtml(cb.contactName);
  const safeReason = cb.reason ? escapeHtml(cb.reason) : '';

  const isOverdue = type === 'scheduled' && new Date(cb.scheduledAt) < new Date();
  const urgentClass = cb.priority === 'high' || isOverdue ? 'urgent' : '';

  // Progress indicator for attempt tracking
  const progressHtml = renderAttemptProgress(cb.attemptCount, cb.maxAttempts);

  // Scheduled time display
  const scheduledDisplay = cb.scheduledAt ? `<div class="callback-scheduled">📅 ${formatScheduledTime(cb.scheduledAt)}</div>` : '';

  // Determine display name - show phone as primary if name is Unknown
  const hasRealName = safeName && safeName !== 'Unknown' && safeName !== 'Unknown Caller';
  const primaryDisplay = hasRealName ? safeName : safePhone;
  const secondaryDisplay = hasRealName ? safePhone : '';

  // Use same card structure for both Today and Upcoming
  return `
    <div class="missed-card ${urgentClass}" data-callback-id="${cb.id}">
      <div class="missed-card-header">
        <div class="missed-phone">${primaryDisplay}</div>
        <div class="missed-time">${timeAgo(cb.createdAt)}</div>
      </div>
      ${secondaryDisplay ? `<div class="missed-phone-secondary">${secondaryDisplay}</div>` : ''}
      ${scheduledDisplay}
      ${safeReason ? `<div class="callback-reason">📝 ${safeReason}</div>` : ''}
      ${progressHtml}
      <div class="callback-actions">
        <button class="btn btn-sm btn-success" onclick="callNow('${cb.id}', '${escapeHtml(cb.phoneNumber)}')">
          📞 Call
        </button>
        <button class="btn btn-sm btn-connected" onclick="openConnectedModal('${cb.id}')">
          ✅ Connected
        </button>
        <button class="btn btn-sm btn-secondary" onclick="logAttempt('${cb.id}')">
          📝 Log Attempt
        </button>
        <button class="btn btn-sm btn-secondary" onclick="editCallback('${cb.id}')">
          ✏️ Edit
        </button>
        ${cb.attemptCount >= cb.maxAttempts ? `
          <button class="btn btn-sm btn-warning" onclick="markExhausted('${cb.id}')">
            ✗ Exhausted
          </button>
        ` : ''}
      </div>
    </div>
  `;
}

function renderAttemptProgress(attempts, maxAttempts) {
  const dots = [];
  for (let i = 0; i < maxAttempts; i++) {
    const filled = i < attempts ? 'filled' : '';
    dots.push(`<span class="attempt-dot ${filled}"></span>`);
  }

  const canExhaust = attempts >= maxAttempts;
  const statusClass = canExhaust ? 'can-exhaust' : 'needs-more';
  const statusText = canExhaust
    ? 'Can mark as exhausted'
    : `${maxAttempts - attempts} more attempt(s) needed`;

  return `
    <div class="attempt-progress">
      ${dots.join('')}
      <span class="attempt-count">${attempts}/${maxAttempts}</span>
      <span class="attempt-status ${statusClass}">${statusText}</span>
    </div>
  `;
}

function renderCompletedCallbacks() {
  const completedList = document.getElementById('completedList');
  if (!completedList) return;

  if (completedCallbacks.length === 0) {
    completedList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <div class="empty-state-title">No completed callbacks</div>
        <div class="empty-state-text">Completed callbacks will appear here</div>
      </div>
    `;
    return;
  }

  completedList.innerHTML = completedCallbacks.map(cb => {
    const safeName = escapeHtml(cb.contactName);
    const safePhone = escapeHtml(formatPhone(cb.phoneNumber));
    const hasRealName = safeName && safeName !== 'Unknown' && safeName !== 'Unknown Caller';
    const primaryDisplay = hasRealName ? safeName : safePhone;
    const secondaryDisplay = hasRealName ? safePhone : '';
    const progressHtml = renderAttemptProgress(cb.attemptCount, cb.attemptCount); // Show all dots filled

    return `
      <div class="missed-card ${cb.status === 'completed' ? '' : 'exhausted-card'}" data-callback-id="${cb.id}">
        <div class="missed-card-header">
          <div class="missed-phone">${primaryDisplay}</div>
          <div class="missed-time">${timeAgo(cb.completedAt)}</div>
        </div>
        ${secondaryDisplay ? `<div class="missed-phone-secondary">${secondaryDisplay}</div>` : ''}
        <div class="callback-status-badge" style="margin: var(--spacing-sm) 0;">
          <span class="badge badge-${cb.status === 'completed' ? 'success' : 'secondary'}">
            ${cb.status === 'completed' ? '✅ Connected' : '✗ Exhausted'}
          </span>
        </div>
        ${cb.notes ? `<div class="callback-reason">📝 ${escapeHtml(cb.notes)}</div>` : ''}
        ${progressHtml}
        <div class="callback-actions">
          <button class="btn btn-sm btn-success" onclick="callNow('${cb.id}', '${escapeHtml(cb.phoneNumber)}')">
            📞 Call Again
          </button>
          <button class="btn btn-sm btn-secondary" onclick="reopenCallback('${cb.id}')">
            🔄 Reopen
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Update completed count
  const completedCount = document.getElementById('completedCount');
  if (completedCount) completedCount.textContent = completedCallbacks.length;
}

// ===========================================
// ACTIONS
// ===========================================

function callNow(callbackId, phoneNumber) {
  if (!phoneNumber) return;
  // Navigate to call page with the number
  window.location.href = `call.html?number=${encodeURIComponent(phoneNumber)}&callbackId=${callbackId}`;
}

window.callNow = callNow;

async function logAttempt(callbackId) {
  currentCallbackId = callbackId;

  // Reset selections to defaults
  selectedAttemptMethod = 'call';
  selectedAttemptResult = 'no_answer';

  // Update UI to show defaults as selected
  updateMethodButtonSelection();
  updateResultButtonSelection();

  // Show log attempt modal
  const modal = document.getElementById('logAttemptModal');
  if (modal) modal.classList.add('active');
}

window.logAttempt = logAttempt;

// Selection functions for Log Attempt modal
function selectMethod(method) {
  selectedAttemptMethod = method;
  updateMethodButtonSelection();
}

window.selectMethod = selectMethod;

function selectResult(result) {
  selectedAttemptResult = result;
  updateResultButtonSelection();
}

window.selectResult = selectResult;

function updateMethodButtonSelection() {
  // Update visual selection for method buttons
  document.querySelectorAll('#logAttemptModal .method-btn').forEach(btn => {
    const btnMethod = btn.dataset.method;
    btn.classList.toggle('selected', btnMethod === selectedAttemptMethod);
  });
}

function updateResultButtonSelection() {
  // Update visual selection for result buttons
  document.querySelectorAll('#logAttemptModal .result-btn').forEach(btn => {
    const btnResult = btn.dataset.result;
    btn.classList.toggle('selected', btnResult === selectedAttemptResult);
  });
}

async function saveAttempt() {
  if (!currentCallbackId || !companyId) return;

  const method = selectedAttemptMethod;
  const result = selectedAttemptResult;
  const notes = document.getElementById('attemptNotes')?.value || '';

  const cb = callbacks.find(c => c.id === currentCallbackId);
  if (!cb) return;

  try {
    // Add to attempt history
    const newAttempt = {
      time: new Date().toISOString(),
      method,
      result,
      notes
    };

    const updatedHistory = [...(cb.attemptHistory || []), newAttempt];
    const newAttemptCount = cb.attemptCount + 1;

    // Update callback
    const { error } = await supabase
      .from('callbacks')
      .update({
        attempt_count: newAttemptCount,
        attempt_history: updatedHistory,
        last_attempt_at: new Date().toISOString(),
        status: 'in_progress'
      })
      .eq('id', currentCallbackId)
      .eq('company_id', companyId);

    if (error) throw error;

    // Save note to contact profile if there are notes
    if (cb.contactId && notes) {
      const resultText = formatResultText(result);
      const methodText = method === 'call' ? 'Phone' : method === 'text' ? 'Text' : 'Email';
      await saveNoteToContact(cb.contactId, `Callback attempt (${methodText}): ${resultText}${notes ? ' - ' + notes : ''}`);
    }

    // Close modal and reload
    closeLogAttemptModal();
    await loadAllData();

  } catch (error) {
    console.error('Failed to save attempt:', error);
    alert('Failed to save attempt');
  }
}

function formatResultText(result) {
  switch (result) {
    case 'no_answer': return 'No Answer';
    case 'voicemail': return 'Left Voicemail';
    case 'busy': return 'Line Busy';
    case 'wrong_number': return 'Wrong Number';
    default: return result;
  }
}

window.saveAttempt = saveAttempt;

function closeLogAttemptModal() {
  const modal = document.getElementById('logAttemptModal');
  if (modal) modal.classList.remove('active');
  currentCallbackId = null;
  // Reset form
  const notes = document.getElementById('attemptNotes');
  if (notes) notes.value = '';
}

window.closeLogAttemptModal = closeLogAttemptModal;

function markExhausted(callbackId) {
  currentCallbackId = callbackId;

  const cb = callbacks.find(c => c.id === callbackId);
  if (cb) {
    const attemptsEl = document.getElementById('exhaustedAttempts');
    if (attemptsEl) attemptsEl.textContent = cb.attemptCount;
  }

  // Clear form
  const reasonEl = document.getElementById('exhaustedReason');
  const notesEl = document.getElementById('exhaustedNotes');
  if (reasonEl) reasonEl.value = '';
  if (notesEl) notesEl.value = '';

  // Show modal
  const modal = document.getElementById('exhaustedModal');
  if (modal) modal.classList.add('active');
}

window.markExhausted = markExhausted;

function closeExhaustedModal() {
  const modal = document.getElementById('exhaustedModal');
  if (modal) modal.classList.remove('active');
  currentCallbackId = null;
}

window.closeExhaustedModal = closeExhaustedModal;

async function confirmExhausted() {
  if (!currentCallbackId || !companyId) return;

  const reason = document.getElementById('exhaustedReason')?.value || '';
  const notes = document.getElementById('exhaustedNotes')?.value || '';
  const cb = callbacks.find(c => c.id === currentCallbackId);

  try {
    const { error } = await supabase
      .from('callbacks')
      .update({
        status: 'exhausted',
        completed_at: new Date().toISOString(),
        resolution_notes: reason ? `${reason}${notes ? ': ' + notes : ''}` : notes
      })
      .eq('id', currentCallbackId)
      .eq('company_id', companyId);

    if (error) throw error;

    // Save note to contact profile
    if (cb && cb.contactId) {
      const noteText = `Callback marked exhausted after ${cb.attemptCount} attempts. ${reason ? 'Reason: ' + reason + '. ' : ''}${notes || ''}`.trim();
      await saveNoteToContact(cb.contactId, noteText);
    }

    closeExhaustedModal();
    await loadAllData();

  } catch (error) {
    console.error('Failed to mark exhausted:', error);
    alert('Failed to update callback');
  }
}

window.confirmExhausted = confirmExhausted;

function openConnectedModal(callbackId) {
  currentCallbackId = callbackId;
  selectedConnectedMethod = 'call';

  // Update connected method button selection
  updateConnectedMethodSelection();

  // Clear notes
  const notesInput = document.getElementById('connectedNotes');
  if (notesInput) notesInput.value = '';

  // Update attempt count display
  const cb = callbacks.find(c => c.id === callbackId);
  if (cb) {
    const attemptsEl = document.getElementById('exhaustedAttempts');
    if (attemptsEl) attemptsEl.textContent = cb.attemptCount;
  }

  // Show modal
  const modal = document.getElementById('connectedModal');
  if (modal) modal.classList.add('active');
}

window.openConnectedModal = openConnectedModal;

function selectConnectedMethod(method) {
  selectedConnectedMethod = method;
  updateConnectedMethodSelection();
}

window.selectConnectedMethod = selectConnectedMethod;

function updateConnectedMethodSelection() {
  document.querySelectorAll('#connectedModal .method-btn').forEach(btn => {
    const btnMethod = btn.dataset.method;
    btn.classList.toggle('selected', btnMethod === selectedConnectedMethod);
  });
}

function closeConnectedModal() {
  const modal = document.getElementById('connectedModal');
  if (modal) modal.classList.remove('active');
  currentCallbackId = null;
}

window.closeConnectedModal = closeConnectedModal;

async function confirmConnected() {
  if (!currentCallbackId || !companyId) return;

  const notes = document.getElementById('connectedNotes')?.value || '';
  const cb = callbacks.find(c => c.id === currentCallbackId);

  try {
    // Update callback as completed
    const { error } = await supabase
      .from('callbacks')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        resolution_notes: notes,
        resolution_method: selectedConnectedMethod
      })
      .eq('id', currentCallbackId)
      .eq('company_id', companyId);

    if (error) throw error;

    // If there's a contact, save a note to their profile
    if (cb && cb.contactId && notes) {
      await saveNoteToContact(cb.contactId, `Callback connected via ${selectedConnectedMethod}: ${notes}`);
    }

    closeConnectedModal();
    await loadAllData();

  } catch (error) {
    console.error('Failed to mark connected:', error);
    alert('Failed to update callback');
  }
}

window.confirmConnected = confirmConnected;

async function markConnected(callbackId) {
  // Open the connected modal instead of directly marking
  openConnectedModal(callbackId);
}

window.markConnected = markConnected;

// Save a note to the contact's profile
async function saveNoteToContact(contactId, noteText) {
  if (!contactId) return;

  try {
    const { data: user } = await supabase.auth.getUser();
    const userId = user?.user?.id;

    const { error } = await supabase
      .from('contact_notes')
      .insert({
        contact_id: contactId,
        created_by: userId,
        content: noteText
      });

    if (error) {
      // Table might not exist, log but don't fail
      console.warn('Could not save note to contact:', error);
    }
  } catch (err) {
    console.warn('Error saving note to contact:', err);
  }
}

function rescheduleCallback(callbackId) {
  // Use the reschedule modal instead of a prompt
  openRescheduleModal(callbackId);
}

window.rescheduleCallback = rescheduleCallback;

async function editCallback(callbackId) {
  const cb = callbacks.find(c => c.id === callbackId);
  if (!cb) {
    alert('Callback not found');
    return;
  }

  // Create and show edit modal
  let modal = document.getElementById('editCallbackModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'editCallbackModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3>Edit Callback</h3>
          <button class="modal-close" onclick="closeEditModal()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Phone Number</label>
            <input type="text" class="input" id="editPhoneNumber">
          </div>
          <div class="form-group">
            <label class="form-label">Scheduled Date</label>
            <input type="date" class="input" id="editScheduledDate">
          </div>
          <div class="form-group">
            <label class="form-label">Scheduled Time</label>
            <input type="time" class="input" id="editScheduledTime">
          </div>
          <div class="form-group">
            <label class="form-label">Reason / Notes</label>
            <textarea class="input" id="editReason" rows="3" placeholder="Why should you call back?"></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Priority</label>
            <select class="input" id="editPriority">
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </div>
          <div class="form-group" style="margin-top: var(--spacing-lg); padding-top: var(--spacing-md); border-top: 1px solid var(--gray-200);">
            <label class="form-label">Quick Actions</label>
            <div style="display: flex; gap: var(--spacing-sm); flex-wrap: wrap;">
              <button class="btn btn-sm btn-connected" onclick="markCompleteFromEdit()" style="background: linear-gradient(135deg, #10b981, #059669); color: white;">
                ✅ Mark Complete
              </button>
              <button class="btn btn-sm btn-warning" onclick="markExhaustedFromEdit()">
                ✗ Mark Exhausted
              </button>
            </div>
            <p class="text-sm text-muted" style="margin-top: var(--spacing-xs);">Mark as complete when you've successfully reached the customer.</p>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeEditModal()">Cancel</button>
          <button class="btn btn-danger" onclick="deleteCallback()">Delete</button>
          <button class="btn btn-primary" onclick="saveEditCallback()">Save Changes</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  // Populate form with current values
  document.getElementById('editPhoneNumber').value = cb.phoneNumber || '';
  document.getElementById('editReason').value = cb.reason || '';
  document.getElementById('editPriority').value = cb.priority || 'normal';

  // Parse scheduled date/time
  if (cb.scheduledAt) {
    const scheduled = new Date(cb.scheduledAt);
    document.getElementById('editScheduledDate').value = scheduled.toISOString().split('T')[0];
    document.getElementById('editScheduledTime').value = scheduled.toTimeString().slice(0, 5);
  } else {
    // Default to tomorrow at 2pm
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('editScheduledDate').value = tomorrow.toISOString().split('T')[0];
    document.getElementById('editScheduledTime').value = '14:00';
  }

  // Store callback ID for saving
  modal.dataset.callbackId = callbackId;

  // Show modal
  modal.classList.add('active');
}

window.editCallback = editCallback;

function closeEditModal() {
  const modal = document.getElementById('editCallbackModal');
  if (modal) modal.classList.remove('active');
}

window.closeEditModal = closeEditModal;

async function saveEditCallback() {
  const modal = document.getElementById('editCallbackModal');
  const callbackId = modal?.dataset.callbackId;
  if (!callbackId || !companyId) return;

  const phoneNumber = document.getElementById('editPhoneNumber').value;
  const scheduledDate = document.getElementById('editScheduledDate').value;
  const scheduledTime = document.getElementById('editScheduledTime').value;
  const reason = document.getElementById('editReason').value;
  const priority = document.getElementById('editPriority').value;

  // Build scheduled datetime
  let scheduledAt = null;
  if (scheduledDate && scheduledTime) {
    scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
  }

  try {
    const { error } = await supabase
      .from('callbacks')
      .update({
        phone_number: phoneNumber,
        scheduled_at: scheduledAt,
        reason: reason,
        priority: priority,
        status: scheduledAt ? 'scheduled' : 'pending'
      })
      .eq('id', callbackId)
      .eq('company_id', companyId);

    if (error) throw error;

    closeEditModal();
    await loadAllData();

  } catch (error) {
    console.error('Failed to save callback:', error);
    alert('Failed to save callback');
  }
}

window.saveEditCallback = saveEditCallback;

async function deleteCallback() {
  const modal = document.getElementById('editCallbackModal');
  const callbackId = modal?.dataset.callbackId;
  if (!callbackId || !companyId) return;

  if (!confirm('Are you sure you want to delete this callback?')) return;

  try {
    const { error } = await supabase
      .from('callbacks')
      .delete()
      .eq('id', callbackId)
      .eq('company_id', companyId);

    if (error) throw error;

    closeEditModal();
    await loadAllData();

  } catch (error) {
    console.error('Failed to delete callback:', error);
    alert('Failed to delete callback');
  }
}

window.deleteCallback = deleteCallback;

/**
 * Mark callback as complete from the edit modal
 */
async function markCompleteFromEdit() {
  const modal = document.getElementById('editCallbackModal');
  const callbackId = modal?.dataset.callbackId;
  if (!callbackId || !companyId) return;

  const cb = callbacks.find(c => c.id === callbackId);
  const notes = document.getElementById('editReason')?.value || '';

  try {
    const { error } = await supabase
      .from('callbacks')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        resolution_notes: notes || 'Marked complete from edit'
      })
      .eq('id', callbackId)
      .eq('company_id', companyId);

    if (error) throw error;

    // Save note to contact profile
    if (cb && cb.contactId) {
      await saveNoteToContact(cb.contactId, `Callback completed: ${notes || 'Successfully reached customer'}`);
    }

    closeEditModal();
    await loadAllData();

  } catch (error) {
    console.error('Failed to mark complete:', error);
    alert('Failed to mark as complete');
  }
}

window.markCompleteFromEdit = markCompleteFromEdit;

/**
 * Mark callback as exhausted from the edit modal
 */
async function markExhaustedFromEdit() {
  const modal = document.getElementById('editCallbackModal');
  const callbackId = modal?.dataset.callbackId;
  if (!callbackId) return;

  // Close edit modal and open exhausted modal
  closeEditModal();
  markExhausted(callbackId);
}

window.markExhaustedFromEdit = markExhaustedFromEdit;

/**
 * Reopen a completed/exhausted callback
 */
async function reopenCallback(callbackId) {
  if (!callbackId || !companyId) return;

  if (!confirm('Reopen this callback and move it back to Today?')) return;

  try {
    const { error } = await supabase
      .from('callbacks')
      .update({
        status: 'pending',
        completed_at: null,
        resolution_notes: null
      })
      .eq('id', callbackId)
      .eq('company_id', companyId);

    if (error) throw error;

    await loadAllData();

  } catch (error) {
    console.error('Failed to reopen callback:', error);
    alert('Failed to reopen callback');
  }
}

window.reopenCallback = reopenCallback;

// ===========================================
// STATS & UI
// ===========================================

function updateStats() {
  const pending = callbacks.filter(cb => cb.status === 'pending' && cb.attemptCount === 0).length;
  const inProgress = callbacks.filter(cb => cb.attemptCount > 0 && cb.attemptCount < cb.maxAttempts).length;
  const connected = completedCallbacks.filter(cb => cb.status === 'completed').length;
  const exhausted = completedCallbacks.filter(cb => cb.status === 'exhausted').length;

  const statPending = document.getElementById('statPending');
  const statInProgress = document.getElementById('statInProgress');
  const statConnected = document.getElementById('statConnected');
  const statExhausted = document.getElementById('statExhausted');

  if (statPending) statPending.textContent = pending;
  if (statInProgress) statInProgress.textContent = inProgress;
  if (statConnected) statConnected.textContent = connected;
  if (statExhausted) statExhausted.textContent = exhausted;
}

function updateBadges() {
  const needsCount = callbacks.filter(cb => cb.status === 'pending' || cb.status === 'in_progress').length;
  const scheduledCount = callbacks.filter(cb => cb.status === 'scheduled').length;

  const needsBadge = document.getElementById('needsCallbackCount');
  const scheduledBadge = document.getElementById('scheduledCount');
  const completedBadge = document.getElementById('completedCount');

  if (needsBadge) needsBadge.textContent = needsCount;
  if (scheduledBadge) scheduledBadge.textContent = scheduledCount;
  if (completedBadge) completedBadge.textContent = completedCallbacks.length;
}

function switchTab(tabName) {
  currentTab = tabName;

  // Update tab buttons (support both .tab and .tab-btn classes)
  document.querySelectorAll('.tab, .tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  // Update tab content - show selected, hide others
  document.querySelectorAll('.tab-content').forEach(content => {
    const isActive = content.id === `${tabName}-content`;
    content.classList.toggle('active', isActive);
    content.classList.toggle('hidden', !isActive);
  });

  // Load completed callbacks when switching to completed tab
  if (tabName === 'completed') {
    loadCompletedCallbacks();
  }
}

window.switchTab = switchTab;

function toggleSettings() {
  const content = document.getElementById('settingsContent');
  const toggle = document.getElementById('settingsToggle');
  if (content.style.display === 'none') {
    content.style.display = 'block';
    toggle.textContent = 'Hide';
  } else {
    content.style.display = 'none';
    toggle.textContent = 'Show';
  }
}

window.toggleSettings = toggleSettings;

async function saveSettings() {
  const input = document.getElementById('requiredAttempts');
  if (!input) return;

  const requiredAttempts = parseInt(input.value);
  if (isNaN(requiredAttempts) || requiredAttempts < 1 || requiredAttempts > 10) {
    alert('Required attempts must be between 1 and 10');
    return;
  }

  settings.requiredAttempts = requiredAttempts;
  alert('Settings saved!');
  renderCallbacks();
}

window.saveSettings = saveSettings;

// ===========================================
// REAL-TIME
// ===========================================

function setupRealtimeSubscription() {
  if (!companyId) return;

  supabase
    .channel('callbacks-page')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'callbacks',
      filter: `company_id=eq.${companyId}`
    }, () => {
      loadAllData();
    })
    .subscribe();
}

function updateConnectionStatus(connected) {
  const statusEl = document.getElementById('connectionStatus');
  const userStatusEl = document.getElementById('userStatus');
  const connectionTextEl = document.getElementById('connectionText');

  if (connected) {
    if (statusEl) {
      statusEl.className = 'connection-status connected';
      statusEl.innerHTML = '<span class="connection-dot"></span><span class="desktop-only">Connected</span>';
    }
    if (userStatusEl) userStatusEl.style.color = 'var(--success)';
    if (connectionTextEl) connectionTextEl.textContent = 'Available';
  } else {
    if (statusEl) {
      statusEl.className = 'connection-status disconnected';
      statusEl.innerHTML = '<span class="connection-dot"></span><span class="desktop-only">Disconnected</span>';
    }
    if (userStatusEl) userStatusEl.style.color = 'var(--gray-400)';
    if (connectionTextEl) connectionTextEl.textContent = 'Offline';
  }
}

// ===========================================
// HELPERS
// ===========================================

function formatPhone(phone) {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  } else if (cleaned.length === 11 && cleaned[0] === '1') {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
}

function formatScheduledTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const isToday = date.toDateString() === now.toDateString();
  const isTomorrow = date.toDateString() === tomorrow.toDateString();

  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  if (isToday) return `Today at ${timeStr}`;
  if (isTomorrow) return `Tomorrow at ${timeStr}`;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function parseSimpleTime(input) {
  const now = new Date();
  const lower = input.toLowerCase().trim();

  // Handle "tomorrow"
  if (lower.includes('tomorrow')) {
    now.setDate(now.getDate() + 1);
  }

  // Extract time
  const timeMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2] || '0');
    const meridian = timeMatch[3];

    if (meridian) {
      if (meridian.toLowerCase() === 'pm' && hours !== 12) hours += 12;
      if (meridian.toLowerCase() === 'am' && hours === 12) hours = 0;
    }

    now.setHours(hours, minutes, 0, 0);
    return now;
  }

  return null;
}

// Load completed when filter changes
function onCompletedFilterChange() {
  loadCompletedCallbacks();
}

window.onCompletedFilterChange = onCompletedFilterChange;

// Helper function to escape HTML
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Helper function to format time ago
function timeAgo(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
}

// Helper function to show error in a container
function showError(selector, message) {
  const container = document.querySelector(selector);
  if (container) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <div class="empty-state-title">Error</div>
        <div class="empty-state-text">${escapeHtml(message)}</div>
      </div>
    `;
  }
}

// Add loadCompleted as alias for filter change
function loadCompleted() {
  loadCompletedCallbacks();
}

window.loadCompleted = loadCompleted;

// ===========================================
// SCHEDULE MODAL FUNCTIONS
// ===========================================

function closeScheduleModal() {
  const modal = document.getElementById('scheduleModal');
  if (modal) modal.classList.remove('active');
}

window.closeScheduleModal = closeScheduleModal;

async function saveSchedule() {
  const phone = document.getElementById('schedulePhone')?.value;
  const date = document.getElementById('scheduleDate')?.value;
  const time = document.getElementById('scheduleTime')?.value;
  const reason = document.getElementById('scheduleReason')?.value;

  if (!phone || !date || !time) {
    alert('Please fill in all required fields');
    return;
  }

  const scheduledAt = new Date(`${date}T${time}`).toISOString();

  try {
    const { data: user } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('callbacks')
      .insert({
        company_id: companyId,
        assigned_to: user?.user?.id,
        phone_number: phone,
        scheduled_at: scheduledAt,
        reason: reason,
        status: 'scheduled',
        priority: 'normal',
        attempt_count: 0,
        max_attempts: settings.requiredAttempts
      });

    if (error) throw error;

    closeScheduleModal();
    await loadAllData();

  } catch (error) {
    console.error('Failed to schedule callback:', error);
    alert('Failed to schedule callback');
  }
}

window.saveSchedule = saveSchedule;

// ===========================================
// RESCHEDULE MODAL FUNCTIONS
// ===========================================

function closeRescheduleModal() {
  const modal = document.getElementById('rescheduleModal');
  if (modal) modal.classList.remove('active');
}

window.closeRescheduleModal = closeRescheduleModal;

function openRescheduleModal(callbackId) {
  currentCallbackId = callbackId;
  const cb = callbacks.find(c => c.id === callbackId);
  if (!cb) return;

  // Populate form
  document.getElementById('reschedulePhone').value = cb.phoneNumber || '';
  document.getElementById('rescheduleReason').value = cb.reason || '';

  // Default to tomorrow at current scheduled time or 2pm
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  document.getElementById('rescheduleDate').value = tomorrow.toISOString().split('T')[0];

  if (cb.scheduledAt) {
    const scheduled = new Date(cb.scheduledAt);
    document.getElementById('rescheduleTime').value = scheduled.toTimeString().slice(0, 5);
  } else {
    document.getElementById('rescheduleTime').value = '14:00';
  }

  // Show modal
  const modal = document.getElementById('rescheduleModal');
  if (modal) modal.classList.add('active');
}

window.openRescheduleModal = openRescheduleModal;

async function saveReschedule() {
  if (!currentCallbackId || !companyId) return;

  const date = document.getElementById('rescheduleDate')?.value;
  const time = document.getElementById('rescheduleTime')?.value;
  const reason = document.getElementById('rescheduleReason')?.value;

  if (!date || !time) {
    alert('Please select a date and time');
    return;
  }

  const scheduledAt = new Date(`${date}T${time}`).toISOString();

  try {
    const { error } = await supabase
      .from('callbacks')
      .update({
        scheduled_at: scheduledAt,
        reason: reason,
        status: 'scheduled'
      })
      .eq('id', currentCallbackId)
      .eq('company_id', companyId);

    if (error) throw error;

    closeRescheduleModal();
    await loadAllData();

  } catch (error) {
    console.error('Failed to reschedule callback:', error);
    alert('Failed to reschedule callback');
  }
}

window.saveReschedule = saveReschedule;

// ===========================================
// DECLINED/MISSED CALL RECORDING
// ===========================================

/**
 * Find or create a contact by phone number
 */
async function findOrCreateContactForCall(phoneNumber) {
  if (!phoneNumber || !companyId) return null;

  try {
    // Clean phone number
    const cleanedPhone = phoneNumber.replace(/\D/g, '');

    // Try to find existing contact
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id, first_name, last_name')
      .eq('company_id', companyId)
      .or(`phone.eq.${phoneNumber},phone.eq.${cleanedPhone},phone.eq.+1${cleanedPhone}`)
      .limit(1)
      .single();

    if (existingContact) {
      return existingContact;
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
      .single();

    if (error) {
      console.error('Error creating contact:', error);
      return null;
    }

    return newContact;
  } catch (error) {
    console.error('findOrCreateContactForCall error:', error);
    return null;
  }
}

/**
 * Create a declined/missed call record
 * Called from inline script when user declines an incoming call or caller hangs up
 */
async function createDeclinedCallRecord(phoneNumber) {
  console.log('createDeclinedCallRecord: Logging declined call from:', phoneNumber);

  if (!companyId) {
    console.error('Cannot create declined call record: missing company ID');
    return;
  }

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.error('Cannot create declined call record: no authenticated user');
    return;
  }

  try {
    const contact = await findOrCreateContactForCall(phoneNumber);
    const contactId = contact?.id || null;

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
    };

    const { data, error } = await supabase
      .from('calls')
      .insert(insertData)
      .select('id')
      .single();

    if (error) {
      console.error('createDeclinedCallRecord: Failed:', error);
    } else {
      console.log('createDeclinedCallRecord: SUCCESS:', data.id);
    }
  } catch (error) {
    console.error('createDeclinedCallRecord: Exception:', error);
  }
}

// Make available globally for inline script
window.createDeclinedCallRecord = createDeclinedCallRecord;
