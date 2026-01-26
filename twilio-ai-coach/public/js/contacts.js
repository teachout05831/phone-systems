/**
 * Contacts Page JavaScript
 * Handles: List contacts, search/filter, CRUD operations
 *
 * Security: All queries filter by company_id, validate inputs, use limits
 */

// ===========================================
// STATE
// ===========================================
let contacts = [];
let selectedContacts = new Set();
let currentPage = 1;
let totalContacts = 0;
const PAGE_SIZE = 50;
let currentFilters = {
  search: '',
  status: '',
  source: '',
  dateRange: '',
  tag: ''
};

// Tag management state
let pendingTags = [];
let editingContactId = null;
let currentView = 'table';

// ===========================================
// INITIALIZATION
// ===========================================
async function initContactsPage() {
  initPage({
    requireAuth: true,
    onReady: async (user) => {
      // Update user display
      if (user) {
        const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
        document.getElementById('userName').textContent = name;
        document.getElementById('userAvatar').textContent = name.charAt(0).toUpperCase();
      }

      // Load contacts and tags
      await loadContacts();
      await loadAllTags();

      // Setup event listeners
      setupEventListeners();
    },
    onError: (error) => {
      console.error('Contacts page init error:', error);
      showError('#contactsTableBody', 'Failed to initialize page');
    }
  });
}

// ===========================================
// DATA LOADING
// ===========================================
async function loadContacts() {
  showLoading('#contactsTableBody', 'Loading contacts...');

  try {
    // Get company membership
    const { companyId, error: membershipError } = await getCompanyMembership();
    console.log('Company membership result:', { companyId, membershipError });
    if (membershipError || !companyId) {
      console.error('No company membership:', membershipError);
      showError('#contactsTableBody', 'Unable to load contacts. Please try again.');
      return;
    }

    // Build query with filters
    let query = supabase
      .from('contacts')
      .select('id, first_name, last_name, phone, email, business_name, source, status, tags, created_at', { count: 'exact' })
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    // Apply filters
    if (currentFilters.search) {
      const searchTerm = `%${currentFilters.search}%`;
      query = query.or(`first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},phone.ilike.${searchTerm},email.ilike.${searchTerm}`);
    }

    if (currentFilters.status) {
      query = query.eq('status', currentFilters.status);
    }

    if (currentFilters.source) {
      query = query.eq('source', currentFilters.source);
    }

    if (currentFilters.dateRange) {
      const now = new Date();
      let startDate;

      switch (currentFilters.dateRange) {
        case 'today':
          startDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case 'week':
          startDate = new Date(now.setDate(now.getDate() - 7));
          break;
        case 'month':
          startDate = new Date(now.setMonth(now.getMonth() - 1));
          break;
      }

      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }
    }

    // Apply tag filter
    if (currentFilters.tag) {
      query = query.contains('tags', [currentFilters.tag]);
    }

    // Apply pagination
    const from = (currentPage - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    console.log('Contacts query result:', { data, error, count });

    if (error) {
      console.error('Error loading contacts:', error);
      showError('#contactsTableBody', 'Failed to load contacts');
      return;
    }

    contacts = data || [];
    totalContacts = count || 0;
    console.log('Loaded contacts:', contacts.length, 'Total:', totalContacts);

    // Render the appropriate view
    if (currentView === 'table') {
      renderContactsTable();
    } else {
      renderContactsGrid();
    }

    // Update pagination
    renderPagination();
    const totalContactsEl = document.getElementById('totalContacts');
    if (totalContactsEl) {
      totalContactsEl.textContent = totalContacts;
    }

  } catch (error) {
    console.error('Error loading contacts:', error);
    showError('#contactsTableBody', 'Failed to load contacts');
  }
}

// ===========================================
// RENDERING
// ===========================================
function renderContactsTable() {
  const tbody = document.getElementById('contactsTableBody');

  if (contacts.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 40px;">
          <div class="empty-state">
            <div class="empty-state-icon">👥</div>
            <div class="empty-state-title">No contacts found</div>
            <div class="empty-state-text">Add contacts or adjust your filters</div>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = contacts.map(contact => {
    const fullName = `${escapeHtml(contact.first_name || '')} ${escapeHtml(contact.last_name || '')}`.trim() || 'Unknown';
    const initials = getInitials(contact.first_name, contact.last_name);

    const tagsHtml = (contact.tags && contact.tags.length > 0)
      ? contact.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')
      : '<span class="no-tags">-</span>';

    return `
      <tr data-id="${contact.id}" style="cursor: pointer;" onclick="goToProfile('${contact.id}', event)">
        <td class="checkbox-cell" onclick="event.stopPropagation()">
          <input type="checkbox" onchange="toggleSelect('${contact.id}')" ${selectedContacts.has(contact.id) ? 'checked' : ''}>
        </td>
        <td>
          <div class="contact-name" style="color: var(--primary);">${fullName}</div>
          <div class="contact-email">${escapeHtml(contact.email || '')}</div>
        </td>
        <td class="contact-phone">${formatPhone(contact.phone)}</td>
        <td onclick="event.stopPropagation()">
          <div class="contact-tags" onclick="openManageTagsModal('${contact.id}')" style="cursor: pointer;" title="Click to manage tags">
            ${tagsHtml}
          </div>
        </td>
        <td><span class="contact-source ${contact.source || 'manual'}">${capitalizeFirst(contact.source || 'manual')}</span></td>
        <td>
          <span class="contact-status ${contact.status || 'new'}">
            <span class="dot"></span>
            ${capitalizeFirst(contact.status || 'new')}
          </span>
        </td>
        <td>${formatDate(contact.created_at)}</td>
        <td onclick="event.stopPropagation()">
          <div class="contact-actions">
            <button class="btn btn-sm btn-secondary" onclick="viewContact('${contact.id}')" title="View">👁️</button>
            <button class="btn btn-sm btn-success" onclick="callContact('${contact.id}')" title="Call">📞</button>
            <button class="btn btn-sm btn-primary" onclick="addToQueue('${contact.id}')" title="Add to Queue">+</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderContactsGrid() {
  const grid = document.getElementById('gridView');

  if (contacts.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon">👥</div>
        <div class="empty-state-title">No contacts found</div>
        <div class="empty-state-text">Add contacts or adjust your filters</div>
      </div>
    `;
    return;
  }

  grid.innerHTML = contacts.map(contact => {
    const fullName = `${escapeHtml(contact.first_name || '')} ${escapeHtml(contact.last_name || '')}`.trim() || 'Unknown';
    const initials = getInitials(contact.first_name, contact.last_name);
    const tagsHtml = (contact.tags && contact.tags.length > 0)
      ? contact.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')
      : '';

    return `
      <div class="contact-card" data-id="${contact.id}" style="cursor: pointer;" onclick="goToProfile('${contact.id}', event)">
        <div class="contact-card-header">
          <div class="contact-card-avatar">${initials}</div>
          <div class="contact-card-info">
            <div class="contact-card-name" style="color: var(--primary);">${fullName}</div>
            <div class="contact-card-company">${escapeHtml(contact.business_name || '')}</div>
          </div>
          <span class="contact-source ${contact.source || 'manual'}">${capitalizeFirst(contact.source || 'manual')}</span>
        </div>
        <div class="contact-card-details">
          <span>📞 ${formatPhone(contact.phone)}</span>
          <span>✉️ ${escapeHtml(contact.email || '')}</span>
        </div>
        ${tagsHtml ? `<div class="contact-tags" onclick="event.stopPropagation(); openManageTagsModal('${contact.id}')" style="cursor: pointer; margin-top: 8px;">${tagsHtml}</div>` : ''}
        <div class="contact-card-footer">
          <span class="contact-status ${contact.status || 'new'}">
            <span class="dot"></span>
            ${capitalizeFirst(contact.status || 'new')}
          </span>
          <div class="contact-actions" onclick="event.stopPropagation()">
            <button class="btn btn-sm btn-success" onclick="callContact('${contact.id}')">📞</button>
            <button class="btn btn-sm btn-primary" onclick="addToQueue('${contact.id}')">+ Queue</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderPagination() {
  const totalPages = Math.ceil(totalContacts / PAGE_SIZE);
  const paginationInfo = document.querySelector('.pagination-info');
  const paginationControls = document.querySelector('.pagination-controls');

  const from = Math.min((currentPage - 1) * PAGE_SIZE + 1, totalContacts);
  const to = Math.min(currentPage * PAGE_SIZE, totalContacts);

  paginationInfo.innerHTML = `Showing <strong>${from}-${to}</strong> of <strong>${totalContacts}</strong> contacts`;

  let paginationHtml = `
    <button class="pagination-btn" onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>← Prev</button>
  `;

  // Show up to 5 page buttons
  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, startPage + 4);

  for (let i = startPage; i <= endPage; i++) {
    paginationHtml += `
      <button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>
    `;
  }

  paginationHtml += `
    <button class="pagination-btn" onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>Next →</button>
  `;

  paginationControls.innerHTML = paginationHtml;
}

// ===========================================
// CONTACT CRUD OPERATIONS
// ===========================================
async function handleCreateContact(e) {
  e.preventDefault();

  const form = document.getElementById('addContactForm');
  const formData = new FormData(form);

  // Ralph Wiggum Validation - validate at every step
  const firstName = formData.get('firstName')?.toString().trim();
  const lastName = formData.get('lastName')?.toString().trim();
  const phone = formData.get('phone')?.toString().trim();
  const email = formData.get('email')?.toString().trim();
  const company = formData.get('company')?.toString().trim();
  const source = formData.get('source')?.toString().trim();
  const notes = formData.get('notes')?.toString().trim();

  // Validate required fields
  if (!firstName || firstName.length < 1) {
    alert('First name is required');
    return;
  }
  if (firstName.length > 100) {
    alert('First name must be less than 100 characters');
    return;
  }

  if (!lastName || lastName.length < 1) {
    alert('Last name is required');
    return;
  }
  if (lastName.length > 100) {
    alert('Last name must be less than 100 characters');
    return;
  }

  if (!phone) {
    alert('Phone number is required');
    return;
  }

  // Validate phone format (basic validation)
  const cleanedPhone = phone.replace(/\D/g, '');
  if (cleanedPhone.length < 10 || cleanedPhone.length > 15) {
    alert('Please enter a valid phone number');
    return;
  }

  // Validate email if provided
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    alert('Please enter a valid email address');
    return;
  }

  try {
    // Get company membership
    const { companyId, error: membershipError } = await getCompanyMembership();
    console.log('Create contact - company membership:', { companyId, membershipError });
    if (membershipError || !companyId) {
      console.error('No company membership for create:', membershipError);
      alert('Unable to create contact. Please try again.');
      return;
    }

    // Format phone number for storage
    const formattedPhone = cleanedPhone.length === 10 ? `+1${cleanedPhone}` : `+${cleanedPhone}`;

    console.log('Inserting contact:', { companyId, firstName, lastName, formattedPhone });
    const { data, error } = await supabase
      .from('contacts')
      .insert({
        company_id: companyId,
        first_name: firstName,
        last_name: lastName,
        phone: formattedPhone,
        email: email || null,
        business_name: company || null,
        source: source || 'manual',
        notes: notes || null,
        status: 'new'
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating contact:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      alert('Failed to create contact: ' + (error.message || 'Unknown error'));
      return;
    }

    // Close modal and reload
    closeAddContactModal();
    await loadContacts();
    alert('Contact created successfully!');

  } catch (error) {
    console.error('Error creating contact:', error);
    alert('Failed to create contact. Please try again.');
  }
}

async function handleUpdateContact(contactId, updates) {
  // Validate contactId
  if (!contactId || typeof contactId !== 'string') {
    alert('Invalid contact ID');
    return { error: 'Invalid contact ID' };
  }

  try {
    // Get company membership for ownership verification
    const { companyId, error: membershipError } = await getCompanyMembership();
    if (membershipError || !companyId) {
      return { error: 'Not authorized' };
    }

    // Verify ownership before update
    const { data: existing } = await supabase
      .from('contacts')
      .select('company_id')
      .eq('id', contactId)
      .single();

    if (!existing) {
      return { error: 'Contact not found' };
    }

    if (existing.company_id !== companyId) {
      return { error: 'Not authorized to update this contact' };
    }

    // Perform update
    const { data, error } = await supabase
      .from('contacts')
      .update(updates)
      .eq('id', contactId)
      .select()
      .single();

    if (error) {
      console.error('Error updating contact:', error);
      return { error: 'Failed to update contact' };
    }

    return { success: true, data };

  } catch (error) {
    console.error('Error updating contact:', error);
    return { error: 'Failed to update contact' };
  }
}

async function handleDeleteContact(contactId) {
  if (!contactId) return;

  if (!confirm('Are you sure you want to delete this contact? This action cannot be undone.')) {
    return;
  }

  try {
    // Get company membership for ownership verification
    const { companyId, error: membershipError } = await getCompanyMembership();
    if (membershipError || !companyId) {
      alert('Not authorized');
      return;
    }

    // Verify ownership before delete
    const { data: existing } = await supabase
      .from('contacts')
      .select('company_id')
      .eq('id', contactId)
      .single();

    if (!existing || existing.company_id !== companyId) {
      alert('Not authorized to delete this contact');
      return;
    }

    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', contactId);

    if (error) {
      console.error('Error deleting contact:', error);
      alert('Failed to delete contact');
      return;
    }

    await loadContacts();
    alert('Contact deleted successfully');

  } catch (error) {
    console.error('Error deleting contact:', error);
    alert('Failed to delete contact');
  }
}

// ===========================================
// BULK OPERATIONS
// ===========================================

// Show queue type selection modal
function bulkAddToQueue() {
  if (selectedContacts.size === 0) return;
  document.getElementById('queueContactCount').textContent =
    `Adding ${selectedContacts.size} contact${selectedContacts.size > 1 ? 's' : ''} to:`;
  document.getElementById('queueTypeModal').style.display = 'flex';
}

function closeQueueTypeModal() {
  document.getElementById('queueTypeModal').style.display = 'none';
}

// Add selected contacts to AI Queue (Supabase ai_queue table)
async function addToAIQueue() {
  closeQueueTypeModal();

  try {
    const { companyId, error: membershipError } = await getCompanyMembership();
    if (membershipError || !companyId) {
      alert('Unable to add to queue');
      return;
    }

    // Check which contacts are already in queue
    const { data: existing } = await supabase
      .from('ai_queue')
      .select('contact_id')
      .in('contact_id', Array.from(selectedContacts))
      .in('status', ['pending', 'in_progress', 'retry_scheduled']);

    const existingIds = new Set(existing?.map(e => e.contact_id) || []);
    const newContactIds = Array.from(selectedContacts).filter(id => !existingIds.has(id));

    if (newContactIds.length === 0) {
      alert('All selected contacts are already in the AI queue');
      return;
    }

    const queueItems = newContactIds.map(contactId => ({
      company_id: companyId,
      contact_id: contactId,
      status: 'pending',
      priority: 2  // 1 = high, 2 = normal (must be integer)
    }));

    const { error } = await supabase
      .from('ai_queue')
      .insert(queueItems);

    if (error) {
      console.error('Error adding to AI queue:', error);
      alert('Failed to add contacts to AI queue: ' + error.message);
      return;
    }

    const skipped = selectedContacts.size - newContactIds.length;
    if (skipped > 0) {
      alert(`Added ${newContactIds.length} contacts to AI queue (${skipped} already in queue)`);
    } else {
      alert(`Added ${newContactIds.length} contacts to AI queue`);
    }
    clearSelection();

  } catch (error) {
    console.error('Error adding to AI queue:', error);
    alert('Failed to add contacts to AI queue');
  }
}

// Add selected contacts to Auto-Dialer Queue (redirect to call.html with contacts)
function addToAutoDialer() {
  closeQueueTypeModal();

  const contactIds = Array.from(selectedContacts);
  const contactData = contactIds.map(id => {
    const contact = contacts.find(c => c.id === id);
    if (!contact) return null;
    const name = `${contact.first_name || ''} ${contact.last_name || ''}`.trim();
    return `${contact.phone}|${name}`;
  }).filter(Boolean);

  if (contactData.length === 0) {
    alert('No valid contacts to add');
    return;
  }

  // Navigate to call page with contacts as URL param
  const encoded = encodeURIComponent(contactData.join(','));
  window.location.href = `/call.html?import=${encoded}`;
}

// Bulk add tag to selected contacts
async function bulkAddTag() {
  if (selectedContacts.size === 0) {
    alert('No contacts selected');
    return;
  }

  const tag = prompt('Enter tag to add to selected contacts:');
  if (!tag || !tag.trim()) return;

  const tagLower = tag.trim().toLowerCase();

  try {
    const { companyId, error: membershipError } = await getCompanyMembership();
    if (membershipError || !companyId) {
      alert('Unable to add tags');
      return;
    }

    const contactIds = Array.from(selectedContacts);
    let updated = 0;

    for (const id of contactIds) {
      const contact = contacts.find(c => c.id === id);
      const currentTags = contact?.tags || [];

      if (!currentTags.includes(tagLower)) {
        const { error } = await supabase
          .from('contacts')
          .update({ tags: [...currentTags, tagLower] })
          .eq('id', id)
          .eq('company_id', companyId);

        if (!error) {
          updated++;
          // Update local state
          if (contact) contact.tags = [...currentTags, tagLower];
        }
      }
    }

    if (updated > 0) {
      alert(`Added tag "${tagLower}" to ${updated} contacts`);
      // Re-render to show updated tags
      if (currentView === 'table') {
        renderContactsTable();
      } else {
        renderContactsGrid();
      }
      await loadAllTags(); // Refresh tag filter options
    } else {
      alert('All selected contacts already have this tag');
    }

    clearSelection();

  } catch (error) {
    console.error('Error adding tags:', error);
    alert('Failed to add tags');
  }
}

async function bulkDelete() {
  if (selectedContacts.size === 0) return;

  if (!confirm(`Are you sure you want to delete ${selectedContacts.size} contacts? This cannot be undone.`)) {
    return;
  }

  try {
    const { companyId, error: membershipError } = await getCompanyMembership();
    if (membershipError || !companyId) {
      alert('Not authorized');
      return;
    }

    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('company_id', companyId)
      .in('id', Array.from(selectedContacts));

    if (error) {
      console.error('Error deleting contacts:', error);
      alert('Failed to delete contacts');
      return;
    }

    alert(`Deleted ${selectedContacts.size} contacts`);
    clearSelection();
    await loadContacts();

  } catch (error) {
    console.error('Error deleting contacts:', error);
    alert('Failed to delete contacts');
  }
}

function bulkExport() {
  // Export selected contacts as CSV
  const selectedData = contacts.filter(c => selectedContacts.has(c.id));

  if (selectedData.length === 0) {
    alert('No contacts selected');
    return;
  }

  const headers = ['First Name', 'Last Name', 'Phone', 'Email', 'Company', 'Source', 'Status'];
  const rows = selectedData.map(c => [
    c.first_name || '',
    c.last_name || '',
    c.phone || '',
    c.email || '',
    c.business_name || '',
    c.source || '',
    c.status || ''
  ]);

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `contacts_export_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
}

// ===========================================
// SELECTION
// ===========================================
function toggleSelect(id) {
  if (selectedContacts.has(id)) {
    selectedContacts.delete(id);
  } else {
    selectedContacts.add(id);
  }
  updateBulkActionsBar();
}

function toggleSelectAll() {
  const selectAll = document.getElementById('selectAll');
  if (selectAll.checked) {
    contacts.forEach(c => selectedContacts.add(c.id));
  } else {
    selectedContacts.clear();
  }

  if (currentView === 'table') {
    renderContactsTable();
  }
  updateBulkActionsBar();
}

function clearSelection() {
  selectedContacts.clear();
  const selectAll = document.getElementById('selectAll');
  if (selectAll) selectAll.checked = false;

  if (currentView === 'table') {
    renderContactsTable();
  }
  updateBulkActionsBar();
}

function updateBulkActionsBar() {
  const bar = document.getElementById('bulkActionsBar');
  const count = document.getElementById('selectedCount');
  count.textContent = selectedContacts.size;
  bar.classList.toggle('active', selectedContacts.size > 0);
}

// ===========================================
// VIEW & NAVIGATION
// ===========================================
function setView(view) {
  currentView = view;
  document.getElementById('tableView').style.display = view === 'table' ? 'block' : 'none';
  document.getElementById('gridView').style.display = view === 'grid' ? 'grid' : 'none';
  document.getElementById('tableViewBtn').classList.toggle('active', view === 'table');
  document.getElementById('gridViewBtn').classList.toggle('active', view === 'grid');

  if (view === 'table') {
    renderContactsTable();
  } else {
    renderContactsGrid();
  }
}

function goToPage(page) {
  const totalPages = Math.ceil(totalContacts / PAGE_SIZE);
  if (page < 1 || page > totalPages) return;
  currentPage = page;
  loadContacts();
}

function goToProfile(contactId, event) {
  if (event && (event.target.type === 'checkbox' || event.target.closest('.contact-actions'))) {
    return;
  }
  window.location.href = `contact-profile.html?id=${contactId}`;
}

// ===========================================
// CONTACT ACTIONS
// ===========================================
function viewContact(id) {
  const contact = contacts.find(c => c.id === id);
  if (!contact) return;

  const fullName = `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unknown';
  const initials = getInitials(contact.first_name, contact.last_name);

  document.getElementById('modalAvatar').textContent = initials;
  document.getElementById('modalName').textContent = fullName;
  document.getElementById('modalStatus').className = `contact-status ${contact.status || 'new'}`;
  document.getElementById('modalStatus').innerHTML = `<span class="dot"></span> ${capitalizeFirst(contact.status || 'new')}`;
  document.getElementById('modalPhone').textContent = formatPhone(contact.phone);
  document.getElementById('modalEmail').textContent = contact.email || 'No email';
  document.getElementById('modalCompany').textContent = contact.business_name || 'No company';
  document.getElementById('modalSource').textContent = capitalizeFirst(contact.source || 'manual');
  document.getElementById('modalAdded').textContent = formatDate(contact.created_at);
  document.getElementById('modalLastContact').textContent = 'Never';
  document.getElementById('modalNotes').textContent = contact.notes || 'No notes';

  // Store contact ID for actions
  document.getElementById('contactModal').dataset.contactId = id;
  document.getElementById('contactModal').classList.add('active');
}

function closeContactModal() {
  document.getElementById('contactModal').classList.remove('active');
}

function callContact(id) {
  const contact = contacts.find(c => c.id === id);
  if (contact && contact.phone) {
    window.location.href = `call.html?number=${encodeURIComponent(contact.phone)}`;
  }
}

async function addToQueue(id) {
  try {
    const { companyId } = await getCompanyMembership();
    if (!companyId) {
      alert('Unable to add to queue');
      return;
    }

    // Check if already in queue
    const { data: existing } = await supabase
      .from('ai_queue')
      .select('id, status')
      .eq('contact_id', id)
      .in('status', ['pending', 'in_progress', 'retry_scheduled'])
      .maybeSingle();

    if (existing) {
      alert('This contact is already in the queue');
      return;
    }

    const { error } = await supabase
      .from('ai_queue')
      .insert({
        company_id: companyId,
        contact_id: id,
        status: 'pending',
        priority: 2  // 1 = high, 2 = normal
      });

    if (error) {
      console.error('Error adding to queue:', error);
      alert('Failed to add to queue: ' + error.message);
      return;
    }

    const contact = contacts.find(c => c.id === id);
    const name = contact ? `${contact.first_name} ${contact.last_name}` : 'Contact';
    alert(`${name} added to call queue`);

  } catch (error) {
    console.error('Error adding to queue:', error);
    alert('Failed to add to queue');
  }
}

// ===========================================
// MODALS
// ===========================================
function openAddContactModal() {
  document.getElementById('addContactModal').classList.add('active');
}

function closeAddContactModal() {
  document.getElementById('addContactModal').classList.remove('active');
  document.getElementById('addContactForm').reset();
}

function saveNewContact() {
  const form = document.getElementById('addContactForm');
  if (form.checkValidity()) {
    handleCreateContact({ preventDefault: () => {}, target: form });
  } else {
    form.reportValidity();
  }
}

function editContact() {
  const contactId = document.getElementById('contactModal').dataset.contactId;
  if (contactId) {
    window.location.href = `contact-profile.html?id=${contactId}&edit=true`;
  }
  closeContactModal();
}

// ===========================================
// TAG MANAGEMENT
// ===========================================
function openManageTagsModal(contactId) {
  editingContactId = contactId;
  const contact = contacts.find(c => c.id === contactId);
  pendingTags = [...(contact?.tags || [])];
  renderCurrentTags();
  document.getElementById('newTagInput').value = '';
  document.getElementById('manageTagsModal').style.display = 'flex';
}

function closeManageTagsModal() {
  document.getElementById('manageTagsModal').style.display = 'none';
  editingContactId = null;
  pendingTags = [];
}

function addNewTag() {
  const input = document.getElementById('newTagInput');
  const tag = input.value.trim().toLowerCase();
  if (tag && !pendingTags.includes(tag)) {
    pendingTags.push(tag);
    renderCurrentTags();
  }
  input.value = '';
  input.focus();
}

function removeTagFromPending(tag) {
  pendingTags = pendingTags.filter(t => t !== tag);
  renderCurrentTags();
}

function renderCurrentTags() {
  const container = document.getElementById('currentTags');
  if (pendingTags.length === 0) {
    container.innerHTML = '<span style="color: var(--gray-500);">No tags yet. Add one above.</span>';
    return;
  }
  container.innerHTML = pendingTags.map(tag =>
    `<span class="tag editable">${escapeHtml(tag)} <button onclick="removeTagFromPending('${escapeHtml(tag)}')">&times;</button></span>`
  ).join('');
}

async function saveContactTags() {
  if (!editingContactId) return;

  try {
    const { companyId, error: membershipError } = await getCompanyMembership();
    if (membershipError || !companyId) {
      alert('Unable to save tags');
      return;
    }

    const { error } = await supabase
      .from('contacts')
      .update({ tags: pendingTags })
      .eq('id', editingContactId)
      .eq('company_id', companyId);

    if (error) {
      console.error('Error saving tags:', error);
      alert('Failed to save tags');
      return;
    }

    // Update local state
    const contact = contacts.find(c => c.id === editingContactId);
    if (contact) contact.tags = [...pendingTags];

    closeManageTagsModal();

    // Re-render to show updated tags
    if (currentView === 'table') {
      renderContactsTable();
    } else {
      renderContactsGrid();
    }

    await loadAllTags(); // Refresh tag filter options

  } catch (error) {
    console.error('Error saving tags:', error);
    alert('Failed to save tags');
  }
}

// Load unique tags for filter dropdown
async function loadAllTags() {
  try {
    const { companyId, error: membershipError } = await getCompanyMembership();
    if (membershipError || !companyId) return;

    const { data, error } = await supabase
      .from('contacts')
      .select('tags')
      .eq('company_id', companyId);

    if (error) {
      console.error('Error loading tags:', error);
      return;
    }

    const allTags = new Set();
    data?.forEach(c => c.tags?.forEach(t => allTags.add(t)));

    const select = document.getElementById('filterTags');
    if (select) {
      select.innerHTML = '<option value="">All Tags</option>' +
        Array.from(allTags).sort().map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
    }

  } catch (error) {
    console.error('Error loading tags:', error);
  }
}

// ===========================================
// SEARCH & FILTERS
// ===========================================
function setupEventListeners() {
  // Search input
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', debounce((e) => {
      currentFilters.search = e.target.value;
      currentPage = 1;
      loadContacts();
    }, 300));
  }

  // Filter selects
  const filterStatus = document.getElementById('filterStatus');
  if (filterStatus) {
    filterStatus.addEventListener('change', (e) => {
      currentFilters.status = e.target.value;
      currentPage = 1;
      loadContacts();
      updateActiveFilters();
    });
  }

  const filterSource = document.getElementById('filterSource');
  if (filterSource) {
    filterSource.addEventListener('change', (e) => {
      currentFilters.source = e.target.value;
      currentPage = 1;
      loadContacts();
      updateActiveFilters();
    });
  }

  const filterDate = document.getElementById('filterDate');
  if (filterDate) {
    filterDate.addEventListener('change', (e) => {
      currentFilters.dateRange = e.target.value;
      currentPage = 1;
      loadContacts();
      updateActiveFilters();
    });
  }

  const filterTags = document.getElementById('filterTags');
  if (filterTags) {
    filterTags.addEventListener('change', (e) => {
      currentFilters.tag = e.target.value;
      currentPage = 1;
      loadContacts();
      updateActiveFilters();
    });
  }

  // Form submission
  const addContactForm = document.getElementById('addContactForm');
  if (addContactForm) {
    addContactForm.addEventListener('submit', handleCreateContact);
  }
}

function updateActiveFilters() {
  const filters = [];

  if (currentFilters.status) {
    filters.push({ type: 'Status', value: currentFilters.status, label: capitalizeFirst(currentFilters.status) });
  }
  if (currentFilters.source) {
    filters.push({ type: 'Source', value: currentFilters.source, label: capitalizeFirst(currentFilters.source) });
  }
  if (currentFilters.dateRange) {
    filters.push({ type: 'Date', value: currentFilters.dateRange, label: capitalizeFirst(currentFilters.dateRange.replace('-', ' ')) });
  }
  if (currentFilters.tag) {
    filters.push({ type: 'Tag', value: currentFilters.tag, label: `Tag: ${currentFilters.tag}` });
  }

  const container = document.getElementById('activeFilters');
  if (filters.length > 0) {
    container.style.display = 'flex';
    container.innerHTML = filters.map(f => `
      <div class="filter-chip">
        ${escapeHtml(f.label)}
        <span class="remove" onclick="clearFilter('${f.type}')">×</span>
      </div>
    `).join('') + `<button class="btn btn-sm btn-secondary" onclick="clearAllFilters()">Clear All</button>`;
  } else {
    container.style.display = 'none';
  }
}

function clearFilter(type) {
  switch (type) {
    case 'Status':
      currentFilters.status = '';
      document.getElementById('filterStatus').value = '';
      break;
    case 'Source':
      currentFilters.source = '';
      document.getElementById('filterSource').value = '';
      break;
    case 'Date':
      currentFilters.dateRange = '';
      document.getElementById('filterDate').value = '';
      break;
    case 'Tag':
      currentFilters.tag = '';
      document.getElementById('filterTags').value = '';
      break;
  }
  currentPage = 1;
  loadContacts();
  updateActiveFilters();
}

function clearAllFilters() {
  currentFilters = { search: '', status: '', source: '', dateRange: '', tag: '' };
  document.getElementById('filterStatus').value = '';
  document.getElementById('filterSource').value = '';
  document.getElementById('filterDate').value = '';
  document.getElementById('filterTags').value = '';
  document.getElementById('searchInput').value = '';
  currentPage = 1;
  loadContacts();
  updateActiveFilters();
}

// ===========================================
// UTILITIES
// ===========================================
function getInitials(firstName, lastName) {
  const first = (firstName || '').charAt(0).toUpperCase();
  const last = (lastName || '').charAt(0).toUpperCase();
  return first + last || '??';
}

function capitalizeFirst(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// ===========================================
// SIDEBAR (from template)
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

// ===========================================
// INITIALIZE
// ===========================================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // Restore sidebar state
    const savedCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    if (savedCollapsed && window.innerWidth > 1024) {
      document.getElementById('sidebar').classList.add('collapsed');
    }
    initContactsPage();
  });
} else {
  const savedCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
  if (savedCollapsed && window.innerWidth > 1024) {
    document.getElementById('sidebar').classList.add('collapsed');
  }
  initContactsPage();
}
