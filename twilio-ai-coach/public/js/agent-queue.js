/**
 * AI Agent Queue JavaScript
 *
 * Handles:
 * - Queue item management
 * - Stats display
 * - Add to queue
 * - Dispatch, prioritize, remove actions
 * - Bulk operations
 */

// ===========================================
// STATE
// ===========================================
let queueItems = [];
let contacts = [];
let selectedItems = new Set();
let selectedContactsToAdd = new Set();
let currentModalItem = null;
let currentPage = 1;
let totalItems = 0;
const PAGE_SIZE = 10;

// Filter state
let filters = {
  search: '',
  status: '',
  priority: '',
  outcome: ''
};

// ===========================================
// INITIALIZATION
// ===========================================
document.addEventListener('DOMContentLoaded', () => {
  initPage({
    requireAuth: true,
    onReady: async (user) => {
      // Update sidebar user info
      if (user) {
        const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
        const userNameEl = document.getElementById('userName');
        const userAvatarEl = document.getElementById('userAvatar');
        if (userNameEl) userNameEl.textContent = name;
        if (userAvatarEl) userAvatarEl.textContent = name.charAt(0).toUpperCase();
      }

      // Load data
      await Promise.all([
        loadQueueItems(),
        loadQueueStats(),
        loadContacts()
      ]);

      // Set up event listeners
      setupEventListeners();

      // Subscribe to real-time updates
      subscribeToQueueUpdates();
    },
    onError: (error) => {
      console.error('Agent Queue init error:', error);
    }
  });
});

// ===========================================
// DATA LOADING
// ===========================================

/**
 * Load queue items from Supabase
 */
async function loadQueueItems() {
  try {
    const { companyId, error: membershipError } = await getCompanyMembership();
    if (membershipError || !companyId) {
      console.log('No company membership found');
      renderQueueTable([]);
      return;
    }

    // Build query
    let query = supabase
      .from('ai_queue')
      .select(`
        id, contact_id, priority, status, outcome, attempts,
        notes, scheduled_at, created_at,
        contact:contacts(id, first_name, last_name, phone)
      `, { count: 'exact' })
      .eq('company_id', companyId)
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true });

    // Apply filters
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.priority) {
      query = query.eq('priority', parseInt(filters.priority, 10));
    }
    if (filters.outcome) {
      query = query.eq('outcome', filters.outcome);
    }
    if (filters.search) {
      // Search in contacts - need to handle differently
      query = query.or(`notes.ilike.%${filters.search}%`);
    }

    // Pagination
    const from = (currentPage - 1) * PAGE_SIZE;
    query = query.range(from, from + PAGE_SIZE - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error loading queue items:', error);
      return;
    }

    queueItems = (data || []).map(item => ({
      queueId: item.id,
      contactId: item.contact_id,
      contactName: item.contact
        ? `${item.contact.first_name || ''} ${item.contact.last_name || ''}`.trim() || 'Unknown'
        : 'Unknown',
      phoneNumber: item.contact?.phone || '',
      status: item.status,
      priority: item.priority,
      attempts: item.attempts || 0,
      outcome: item.outcome,
      notes: item.notes,
      addedAt: item.created_at,
      scheduledAt: item.scheduled_at
    }));

    totalItems = count || 0;

    renderQueueTable(queueItems);
    updatePagination();

  } catch (error) {
    console.error('Error loading queue items:', error);
  }
}

/**
 * Load queue stats
 */
async function loadQueueStats() {
  try {
    const { companyId, error: membershipError } = await getCompanyMembership();
    if (membershipError || !companyId) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();

    // Get counts for each status
    const [pendingResult, activeResult, completedResult] = await Promise.all([
      supabase
        .from('ai_queue')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('status', 'pending'),
      supabase
        .from('ai_queue')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('status', 'in_progress'),
      supabase
        .from('ai_queue')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('status', 'completed')
        .gte('updated_at', todayIso)
    ]);

    const pending = pendingResult.count || 0;
    const active = activeResult.count || 0;
    const completed = completedResult.count || 0;

    // Estimate cost (3 min avg @ $0.07/min)
    const totalMinutes = completed * 3;
    const cost = (totalMinutes * 0.07).toFixed(2);

    // Update UI
    document.getElementById('statPending').textContent = pending;
    document.getElementById('statActive').textContent = active;
    document.getElementById('statCompleted').textContent = completed;
    document.getElementById('statCost').textContent = `$${cost}`;

    // Update sidebar badge
    updateQueueBadge(pending + active);

  } catch (error) {
    console.error('Error loading queue stats:', error);
  }
}

/**
 * Load contacts for add modal
 */
async function loadContacts() {
  try {
    const { companyId, error: membershipError } = await getCompanyMembership();
    if (membershipError || !companyId) return;

    const { data, error } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, phone')
      .eq('company_id', companyId)
      .order('first_name', { ascending: true })
      .limit(100);

    if (error) {
      console.error('Error loading contacts:', error);
      return;
    }

    contacts = (data || []).map(c => ({
      id: c.id,
      name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unknown',
      phone: c.phone
    }));

  } catch (error) {
    console.error('Error loading contacts:', error);
  }
}

// ===========================================
// RENDERING
// ===========================================

/**
 * Render the queue table
 */
function renderQueueTable(items) {
  const tbody = document.getElementById('queueTableBody');
  if (!tbody) return;

  if (items.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 40px; color: var(--gray-500);">
          <div style="font-size: 2rem; margin-bottom: 10px;">📋</div>
          <div>No queue items found</div>
          <div style="font-size: 0.875rem; margin-top: 5px;">Add contacts to the queue to get started</div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = items.map(item => `
    <tr data-id="${escapeHtml(item.queueId)}">
      <td class="checkbox-cell">
        <input type="checkbox" onchange="toggleSelect('${escapeHtml(item.queueId)}')" ${selectedItems.has(item.queueId) ? 'checked' : ''}>
      </td>
      <td>
        <div class="queue-contact-name">${escapeHtml(item.contactName)}</div>
        <div class="queue-contact-phone">${escapeHtml(formatPhone(item.phoneNumber))}</div>
      </td>
      <td>
        <span class="queue-status ${escapeHtml(item.status)}">
          <span class="dot"></span>
          ${escapeHtml(formatStatus(item.status))}
        </span>
      </td>
      <td>
        <span class="queue-priority ${item.priority === 1 ? 'high' : 'normal'}">
          <span class="priority-dot"></span>
          ${item.priority === 1 ? 'High' : 'Normal'}
        </span>
      </td>
      <td>${item.attempts}</td>
      <td>${item.outcome ? `<span class="queue-outcome ${escapeHtml(item.outcome)}">${escapeHtml(formatOutcome(item.outcome))}</span>` : '-'}</td>
      <td>${escapeHtml(timeAgo(item.addedAt))}</td>
      <td>
        <div class="queue-actions-cell">
          <button class="btn btn-sm btn-secondary" onclick="viewQueueItem('${escapeHtml(item.queueId)}')" title="View">View</button>
          ${item.status === 'pending' ? `<button class="btn btn-sm btn-success" onclick="dispatchItem('${escapeHtml(item.queueId)}')" title="Dispatch">Dispatch</button>` : ''}
          ${['pending', 'retry_scheduled'].includes(item.status) ? `<button class="btn btn-sm btn-danger" onclick="removeItem('${escapeHtml(item.queueId)}')" title="Remove">Remove</button>` : ''}
        </div>
      </td>
    </tr>
  `).join('');

  document.getElementById('totalQueue').textContent = totalItems;
}

/**
 * Update pagination controls
 */
function updatePagination() {
  const totalPages = Math.ceil(totalItems / PAGE_SIZE);
  const info = document.querySelector('.pagination-info');
  const controls = document.querySelector('.pagination-controls');

  if (info) {
    const from = (currentPage - 1) * PAGE_SIZE + 1;
    const to = Math.min(currentPage * PAGE_SIZE, totalItems);
    info.innerHTML = `Showing <strong>${from}-${to}</strong> of <strong>${totalItems}</strong> items`;
  }

  if (controls) {
    let html = `<button class="pagination-btn" onclick="changePage(${currentPage - 1})" ${currentPage <= 1 ? 'disabled' : ''}>Prev</button>`;

    for (let i = 1; i <= Math.min(totalPages, 5); i++) {
      html += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
    }

    html += `<button class="pagination-btn" onclick="changePage(${currentPage + 1})" ${currentPage >= totalPages ? 'disabled' : ''}>Next</button>`;

    controls.innerHTML = html;
  }
}

/**
 * Update queue badge in sidebar
 */
function updateQueueBadge(count) {
  const badge = document.getElementById('queueBadge');
  if (badge) badge.textContent = count;
}

// ===========================================
// QUEUE ACTIONS
// ===========================================

/**
 * Add contacts to queue
 */
async function addSelectedToQueue() {
  if (selectedContactsToAdd.size === 0) {
    alert('Please select at least one contact');
    return;
  }

  try {
    const { companyId, error: membershipError } = await getCompanyMembership();
    if (membershipError || !companyId) {
      alert('Unable to determine company');
      return;
    }

    const priority = parseInt(document.getElementById('addPriority').value, 10) || 2;
    const scheduledFor = document.getElementById('addSchedule').value || null;
    const notes = document.getElementById('addNotes').value?.trim() || null;

    // Validate priority
    if (priority !== 1 && priority !== 2) {
      alert('Invalid priority value');
      return;
    }

    // Validate notes length
    if (notes && notes.length > 500) {
      alert('Notes are too long (max 500 characters)');
      return;
    }

    // Create queue items
    const queueItemsToInsert = Array.from(selectedContactsToAdd).map(contactId => ({
      company_id: companyId,
      contact_id: contactId,
      priority: priority,
      status: 'pending',
      scheduled_at: scheduledFor,
      notes: notes,
      attempts: 0
    }));

    const { error } = await supabase
      .from('ai_queue')
      .insert(queueItemsToInsert);

    if (error) {
      console.error('Error adding to queue:', error);
      alert('Failed to add contacts to queue');
      return;
    }

    alert(`Added ${selectedContactsToAdd.size} contacts to queue`);
    closeAddToQueueModal();

    // Refresh data
    await Promise.all([loadQueueItems(), loadQueueStats()]);

  } catch (error) {
    console.error('Error adding to queue:', error);
    alert('Failed to add contacts to queue');
  }
}

/**
 * Dispatch a queue item (trigger AI call)
 */
async function dispatchItem(queueId) {
  const item = queueItems.find(q => q.queueId === queueId);
  if (!item) return;

  if (!confirm(`Dispatch AI agent to call ${item.contactName}?`)) return;

  try {
    // Security: Get company_id to verify ownership
    const { companyId, error: membershipError } = await getCompanyMembership();
    if (membershipError || !companyId) {
      alert('Unable to verify company membership');
      return;
    }

    // Security: Filter by both id AND company_id to prevent unauthorized updates
    const { error } = await supabase
      .from('ai_queue')
      .update({
        status: 'in_progress',
        updated_at: new Date().toISOString()
      })
      .eq('id', queueId)
      .eq('company_id', companyId);

    if (error) {
      console.error('Error dispatching:', error);
      alert('Failed to dispatch call');
      return;
    }

    alert(`AI agent dispatching to call ${item.contactName}...`);

    // Refresh data
    await Promise.all([loadQueueItems(), loadQueueStats()]);

  } catch (error) {
    console.error('Error dispatching:', error);
    alert('Failed to dispatch call');
  }
}

/**
 * Remove item from queue
 */
async function removeItem(queueId) {
  if (!confirm('Are you sure you want to remove this item from the queue?')) return;

  try {
    // Security: Get company_id to verify ownership
    const { companyId, error: membershipError } = await getCompanyMembership();
    if (membershipError || !companyId) {
      alert('Unable to verify company membership');
      return;
    }

    // Security: Filter by both id AND company_id to prevent IDOR
    const { error } = await supabase
      .from('ai_queue')
      .delete()
      .eq('id', queueId)
      .eq('company_id', companyId);

    if (error) {
      console.error('Error removing item:', error);
      alert('Failed to remove item');
      return;
    }

    // Refresh data
    await Promise.all([loadQueueItems(), loadQueueStats()]);

  } catch (error) {
    console.error('Error removing item:', error);
    alert('Failed to remove item');
  }
}

/**
 * View queue item details
 */
function viewQueueItem(queueId) {
  const item = queueItems.find(q => q.queueId === queueId);
  if (!item) return;

  currentModalItem = item;

  document.getElementById('modalContactName').textContent = item.contactName;
  document.getElementById('modalPhone').textContent = formatPhone(item.phoneNumber);
  document.getElementById('modalStatus').innerHTML = `<span class="queue-status ${item.status}"><span class="dot"></span>${formatStatus(item.status)}</span>`;
  document.getElementById('modalPriority').textContent = item.priority === 1 ? 'High' : 'Normal';
  document.getElementById('modalAttempts').textContent = item.attempts;
  document.getElementById('modalAdded').textContent = formatDate(item.addedAt);
  document.getElementById('modalOutcome').innerHTML = item.outcome ? `<span class="queue-outcome ${item.outcome}">${formatOutcome(item.outcome)}</span>` : '-';
  document.getElementById('modalNotes').textContent = item.notes || '-';

  // Show/hide transcript section (AI summary not yet implemented)
  const transcriptSection = document.getElementById('modalTranscriptSection');
  if (transcriptSection) {
    transcriptSection.style.display = 'none';
  }

  // Show/hide dispatch button
  const dispatchBtn = document.getElementById('modalDispatchBtn');
  dispatchBtn.style.display = item.status === 'pending' ? 'inline-flex' : 'none';

  document.getElementById('queueItemModal').classList.add('active');
}

// ===========================================
// BULK ACTIONS
// ===========================================

function toggleSelect(id) {
  if (selectedItems.has(id)) {
    selectedItems.delete(id);
  } else {
    selectedItems.add(id);
  }
  updateBulkActionsBar();
  renderQueueTable(queueItems);
}

function toggleSelectAll() {
  const selectAll = document.getElementById('selectAll');
  if (selectAll.checked) {
    queueItems.forEach(q => selectedItems.add(q.queueId));
  } else {
    selectedItems.clear();
  }
  renderQueueTable(queueItems);
  updateBulkActionsBar();
}

function clearSelection() {
  selectedItems.clear();
  const selectAll = document.getElementById('selectAll');
  if (selectAll) selectAll.checked = false;
  renderQueueTable(queueItems);
  updateBulkActionsBar();
}

function updateBulkActionsBar() {
  const bar = document.getElementById('bulkActionsBar');
  const count = document.getElementById('selectedCount');
  if (count) count.textContent = selectedItems.size;
  if (bar) bar.classList.toggle('active', selectedItems.size > 0);
}

async function bulkDispatch() {
  const pendingSelected = Array.from(selectedItems).filter(id => {
    const item = queueItems.find(q => q.queueId === id);
    return item && item.status === 'pending';
  });

  if (pendingSelected.length === 0) {
    alert('No pending items selected');
    return;
  }

  if (!confirm(`Dispatch ${pendingSelected.length} items?`)) return;

  try {
    // Security: Get company_id to verify ownership
    const { companyId, error: membershipError } = await getCompanyMembership();
    if (membershipError || !companyId) {
      alert('Unable to verify company membership');
      return;
    }

    // Security: Filter by company_id to prevent unauthorized bulk updates
    const { error } = await supabase
      .from('ai_queue')
      .update({ status: 'in_progress', updated_at: new Date().toISOString() })
      .in('id', pendingSelected)
      .eq('company_id', companyId);

    if (error) {
      console.error('Error bulk dispatching:', error);
      alert('Failed to dispatch items');
      return;
    }

    clearSelection();
    await Promise.all([loadQueueItems(), loadQueueStats()]);

  } catch (error) {
    console.error('Error bulk dispatching:', error);
  }
}

async function bulkPrioritize() {
  if (selectedItems.size === 0) return;

  try {
    // Security: Get company_id to verify ownership
    const { companyId, error: membershipError } = await getCompanyMembership();
    if (membershipError || !companyId) {
      alert('Unable to verify company membership');
      return;
    }

    // Security: Filter by company_id to prevent unauthorized bulk updates
    const { error } = await supabase
      .from('ai_queue')
      .update({ priority: 1, updated_at: new Date().toISOString() })
      .in('id', Array.from(selectedItems))
      .eq('company_id', companyId);

    if (error) {
      console.error('Error prioritizing:', error);
      alert('Failed to prioritize items');
      return;
    }

    clearSelection();
    await loadQueueItems();

  } catch (error) {
    console.error('Error prioritizing:', error);
  }
}

async function bulkCancel() {
  if (selectedItems.size === 0) return;

  try {
    // Security: Get company_id to verify ownership
    const { companyId, error: membershipError } = await getCompanyMembership();
    if (membershipError || !companyId) {
      alert('Unable to verify company membership');
      return;
    }

    // Security: Filter by company_id to prevent unauthorized bulk updates
    const { error } = await supabase
      .from('ai_queue')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .in('id', Array.from(selectedItems))
      .eq('company_id', companyId);

    if (error) {
      console.error('Error cancelling:', error);
      return;
    }

    clearSelection();
    await Promise.all([loadQueueItems(), loadQueueStats()]);

  } catch (error) {
    console.error('Error cancelling:', error);
  }
}

async function bulkRemove() {
  if (!confirm(`Remove ${selectedItems.size} items from the queue?`)) return;

  try {
    // Security: Get company_id to verify ownership
    const { companyId, error: membershipError } = await getCompanyMembership();
    if (membershipError || !companyId) {
      alert('Unable to verify company membership');
      return;
    }

    // Security: Filter by company_id to prevent unauthorized bulk deletes
    const { error } = await supabase
      .from('ai_queue')
      .delete()
      .in('id', Array.from(selectedItems))
      .eq('company_id', companyId);

    if (error) {
      console.error('Error removing:', error);
      alert('Failed to remove items');
      return;
    }

    clearSelection();
    await Promise.all([loadQueueItems(), loadQueueStats()]);

  } catch (error) {
    console.error('Error removing:', error);
  }
}

// ===========================================
// MODALS
// ===========================================

function openAddToQueueModal() {
  selectedContactsToAdd.clear();
  renderContactSelectList();
  document.getElementById('addToQueueModal').classList.add('active');
}

function closeAddToQueueModal() {
  document.getElementById('addToQueueModal').classList.remove('active');
  selectedContactsToAdd.clear();
  // Clear form
  document.getElementById('addPriority').value = '2';
  document.getElementById('addSchedule').value = '';
  document.getElementById('addNotes').value = '';
}

function renderContactSelectList() {
  const list = document.getElementById('contactSelectList');
  const searchTerm = document.getElementById('contactSearchInput')?.value?.toLowerCase() || '';

  const filteredContacts = contacts.filter(c =>
    c.name.toLowerCase().includes(searchTerm) ||
    c.phone.includes(searchTerm)
  );

  if (filteredContacts.length === 0) {
    list.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--gray-500);">No contacts found</div>';
    return;
  }

  list.innerHTML = filteredContacts.map(c => `
    <div class="contact-select-item ${selectedContactsToAdd.has(c.id) ? 'selected' : ''}" onclick="toggleContactSelect('${escapeHtml(c.id)}')">
      <input type="checkbox" ${selectedContactsToAdd.has(c.id) ? 'checked' : ''} onclick="event.stopPropagation()">
      <div>
        <div style="font-weight: 500;">${escapeHtml(c.name)}</div>
        <div style="font-size: 0.875rem; color: var(--gray-500);">${escapeHtml(formatPhone(c.phone))}</div>
      </div>
    </div>
  `).join('');
}

function toggleContactSelect(contactId) {
  if (selectedContactsToAdd.has(contactId)) {
    selectedContactsToAdd.delete(contactId);
  } else {
    selectedContactsToAdd.add(contactId);
  }
  renderContactSelectList();
}

function closeQueueItemModal() {
  document.getElementById('queueItemModal').classList.remove('active');
  currentModalItem = null;
}

function dispatchFromModal() {
  if (currentModalItem) {
    dispatchItem(currentModalItem.queueId);
    closeQueueItemModal();
  }
}

function openSettingsModal() {
  alert('AI Agent settings - coming soon');
}

// ===========================================
// REAL-TIME SUBSCRIPTION
// ===========================================

function subscribeToQueueUpdates() {
  getCompanyMembership().then(({ companyId }) => {
    if (!companyId) return;

    supabase
      .channel('ai-queue-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'ai_queue',
        filter: `company_id=eq.${companyId}`
      }, () => {
        // Refresh data on any change
        loadQueueItems();
        loadQueueStats();
      })
      .subscribe();
  });
}

// ===========================================
// FILTERS & PAGINATION
// ===========================================

function changePage(page) {
  if (page < 1) return;
  currentPage = page;
  loadQueueItems();
}

function applyFilters() {
  filters.status = document.getElementById('filterStatus')?.value || '';
  filters.priority = document.getElementById('filterPriority')?.value || '';
  filters.outcome = document.getElementById('filterOutcome')?.value || '';
  currentPage = 1;
  loadQueueItems();
}

// ===========================================
// EVENT LISTENERS
// ===========================================

function setupEventListeners() {
  // Search input
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', debounce(function(e) {
      filters.search = e.target.value;
      currentPage = 1;
      loadQueueItems();
    }, 300));
  }

  // Filter dropdowns
  ['filterStatus', 'filterPriority', 'filterOutcome'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', applyFilters);
  });

  // Contact search in modal
  const contactSearchInput = document.getElementById('contactSearchInput');
  if (contactSearchInput) {
    contactSearchInput.addEventListener('input', debounce(renderContactSelectList, 200));
  }
}

// ===========================================
// UTILITY FUNCTIONS
// ===========================================

function formatStatus(status) {
  const statusMap = {
    'pending': 'Pending',
    'in_progress': 'In Progress',
    'completed': 'Completed',
    'failed': 'Failed',
    'retry_scheduled': 'Retry Scheduled',
    'cancelled': 'Cancelled'
  };
  return statusMap[status] || status;
}

function formatOutcome(outcome) {
  const outcomeMap = {
    'booked': 'Booked',
    'callback': 'Callback',
    'not_interested': 'Not Interested',
    'no_answer': 'No Answer'
  };
  return outcomeMap[outcome] || outcome;
}

function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
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
