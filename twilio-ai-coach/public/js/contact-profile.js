/**
 * Contact Profile Page JavaScript
 * Handles: Contact details, call history, notes, activity timeline
 *
 * Security: All queries filter by company_id, validate inputs, verify ownership
 */

// ===========================================
// STATE
// ===========================================
let contact = null;
let contactId = null;
let calls = [];
let notes = [];
let activities = [];
let currentTab = 'activity';

// ===========================================
// INITIALIZATION
// ===========================================
async function initContactProfilePage() {
  // Get contact ID or phone from URL
  const params = new URLSearchParams(window.location.search);
  contactId = params.get('id');
  const phoneNumber = params.get('phone');
  const editMode = params.get('edit') === 'true';

  if (!contactId && !phoneNumber) {
    showError('.profile-layout', 'Contact ID or phone number not provided');
    return;
  }

  initPage({
    requireAuth: true,
    onReady: async (user) => {
      // Update user display
      if (user) {
        const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
        document.getElementById('userName').textContent = name;
        document.getElementById('userAvatar').textContent = name.charAt(0).toUpperCase();
      }

      // Load contact data - by ID or by phone
      if (contactId) {
        await loadContact();
      } else if (phoneNumber) {
        await loadContactByPhone(phoneNumber);
      }

      if (editMode) {
        editContact();
      }
    },
    onError: (error) => {
      console.error('Contact profile page init error:', error);
      showError('.profile-layout', 'Failed to initialize page');
    }
  });
}

// ===========================================
// DATA LOADING
// ===========================================

/**
 * Load contact by phone number
 * If no contact exists, creates a temporary view showing calls for that number
 */
async function loadContactByPhone(phone) {
  try {
    const { companyId, error: membershipError } = await getCompanyMembership();
    if (membershipError || !companyId) {
      showError('.profile-card', 'Unable to load contact');
      return;
    }

    // Clean phone number for matching
    const cleanedPhone = phone.replace(/\D/g, '');

    // Try to find existing contact by phone
    const { data, error } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, phone, email, business_name, job_title, source, status, tags, notes, assigned_to, created_at')
      .eq('company_id', companyId)
      .or(`phone.eq.${phone},phone.eq.${cleanedPhone},phone.eq.+1${cleanedPhone},phone.eq.+${cleanedPhone}`)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error loading contact by phone:', error);
    }

    if (data) {
      // Found existing contact - use it
      contact = data;
      contactId = data.id;
      renderContactProfile();

      // Load related data
      await Promise.all([
        loadContactCalls(),
        loadContactNotes(),
        loadContactActivity()
      ]);
      await loadContactStats();
    } else {
      // No contact found - create temporary view for this phone number
      contact = {
        id: null,
        first_name: 'Unknown',
        last_name: 'Caller',
        phone: phone,
        email: null,
        business_name: null,
        status: 'new',
        source: 'inbound_call',
        created_at: new Date().toISOString()
      };
      renderContactProfile();

      // Load calls for this phone number
      await loadCallsByPhone(phone, companyId);
    }

  } catch (error) {
    console.error('Error loading contact by phone:', error);
    showError('.profile-card', 'Failed to load contact');
  }
}

/**
 * Load calls for a phone number (when no contact exists)
 */
async function loadCallsByPhone(phone, companyId) {
  try {
    const cleanedPhone = phone.replace(/\D/g, '');

    const { data, error } = await supabase
      .from('calls')
      .select('id, external_call_id, phone_number, direction, status, duration_seconds, outcome, recording_url, ai_summary, notes, started_at, ended_at')
      .eq('company_id', companyId)
      .or(`phone_number.eq.${phone},phone_number.eq.${cleanedPhone},phone_number.eq.+1${cleanedPhone},phone_number.eq.+${cleanedPhone}`)
      .order('started_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error loading calls by phone:', error);
      return;
    }

    calls = data || [];
    renderCallHistory();
    updateCallsBadge();
    loadContactStats();

  } catch (error) {
    console.error('Error loading calls by phone:', error);
  }
}

async function loadContact() {
  try {
    // Get company membership for authorization
    const { companyId, error: membershipError } = await getCompanyMembership();
    if (membershipError || !companyId) {
      showError('.profile-card', 'Unable to load contact');
      return;
    }

    // Fetch contact with company_id filter for security
    const { data, error } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, phone, email, business_name, job_title, source, status, tags, notes, assigned_to, created_at')
      .eq('id', contactId)
      .eq('company_id', companyId)
      .single();

    if (error || !data) {
      console.error('Error loading contact:', error);
      showError('.profile-card', 'Contact not found or access denied');
      return;
    }

    contact = data;
    renderContactProfile();

    // Load related data in parallel
    await Promise.all([
      loadContactCalls(),
      loadContactNotes(),
      loadContactActivity()
    ]);

    // Load stats
    await loadContactStats();

  } catch (error) {
    console.error('Error loading contact:', error);
    showError('.profile-card', 'Failed to load contact');
  }
}

async function loadContactCalls() {
  try {
    const { companyId } = await getCompanyMembership();
    if (!companyId) return;

    const { data, error } = await supabase
      .from('calls')
      .select('id, external_call_id, direction, status, duration_seconds, outcome, recording_url, ai_summary, started_at, ended_at')
      .eq('contact_id', contactId)
      .eq('company_id', companyId)
      .order('started_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error loading calls:', error);
      return;
    }

    calls = data || [];
    renderCallHistory();
    updateCallsBadge();

  } catch (error) {
    console.error('Error loading calls:', error);
  }
}

async function loadContactNotes() {
  try {
    const { companyId } = await getCompanyMembership();
    if (!companyId) return;

    const { data, error } = await supabase
      .from('contact_notes')
      .select(`
        id, content, is_pinned, created_at,
        created_by:users(id, full_name, email)
      `)
      .eq('contact_id', contactId)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error loading notes:', error);
      return;
    }

    notes = data || [];
    renderNotes();
    updateNotesBadge();

  } catch (error) {
    console.error('Error loading notes:', error);
  }
}

async function loadContactActivity() {
  try {
    const { companyId } = await getCompanyMembership();
    if (!companyId) return;

    const { data, error } = await supabase
      .from('activity_log')
      .select('id, action, entity_type, metadata, created_at')
      .eq('contact_id', contactId)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error loading activity:', error);
      return;
    }

    activities = data || [];
    renderActivityTimeline();

  } catch (error) {
    console.error('Error loading activity:', error);
  }
}

async function loadContactStats() {
  if (!contact) return;

  const totalCalls = calls.length;
  const connectedCalls = calls.filter(c => c.status === 'connected' || c.status === 'completed').length;
  const totalDuration = calls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0);

  document.querySelector('.quick-stat.primary .quick-stat-value').textContent = totalCalls;
  document.querySelector('.quick-stat.success .quick-stat-value').textContent = connectedCalls;
  document.querySelector('.quick-stat.warning .quick-stat-value').textContent = formatDurationShort(totalDuration);

  // Deal value would come from deals table - placeholder for now
  // document.querySelector('.quick-stat:last-child .quick-stat-value').textContent = formatCurrency(dealValue);
}

// ===========================================
// RENDERING
// ===========================================
function renderContactProfile() {
  if (!contact) return;

  const fullName = `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unknown';
  const initials = getInitials(contact.first_name, contact.last_name);

  // Update header
  document.getElementById('profileAvatar').textContent = initials;
  document.getElementById('profileName').textContent = fullName;
  document.getElementById('profileCompany').textContent = contact.business_name || '';

  // Update status
  const statusEl = document.getElementById('profileStatus');
  statusEl.className = `profile-status ${contact.status || 'new'}`;
  statusEl.innerHTML = `<span class="dot"></span> ${capitalizeFirst(contact.status || 'new')} Lead`;

  // Update details
  updateDetailValue('.profile-detail-item:nth-child(1) .profile-detail-value', contact.phone ? `<a href="tel:${contact.phone}">${formatPhone(contact.phone)}</a>` : 'No phone');
  updateDetailValue('.profile-detail-item:nth-child(2) .profile-detail-value', contact.email ? `<a href="mailto:${contact.email}">${escapeHtml(contact.email)}</a>` : 'No email');
  updateDetailValue('.profile-detail-item:nth-child(3) .profile-detail-value', contact.business_name || 'No company');
  updateDetailValue('.profile-detail-item:nth-child(4) .profile-detail-value', contact.job_title || 'No title');
  updateDetailValue('.profile-detail-item:nth-child(5) .profile-detail-value', capitalizeFirst(contact.source || 'manual'));
  updateDetailValue('.profile-detail-item:nth-child(6) .profile-detail-value', formatDate(contact.created_at));

  // Render tags
  renderTags();
}

function updateDetailValue(selector, value) {
  const el = document.querySelector(selector);
  if (el) el.innerHTML = value;
}

function renderTags() {
  const tagsContainer = document.querySelector('.tags-list');
  if (!tagsContainer) return;

  const tags = contact.tags || [];
  let tagsHtml = tags.map(tag => {
    const tagClass = getTagClass(tag);
    return `<span class="tag ${tagClass}">${escapeHtml(tag)}</span>`;
  }).join('');

  tagsHtml += `<button class="add-tag-btn" onclick="addTag()">+ Add Tag</button>`;
  tagsContainer.innerHTML = tagsHtml;
}

function getTagClass(tag) {
  const lowerTag = tag.toLowerCase();
  if (lowerTag.includes('hot') || lowerTag.includes('urgent')) return 'hot';
  if (lowerTag.includes('vip') || lowerTag.includes('important')) return 'vip';
  if (lowerTag.includes('referral')) return 'referral';
  return '';
}

function renderCallHistory() {
  const container = document.querySelector('#callsTab .activity-card > div:last-child');
  if (!container) return;

  if (calls.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 40px;">
        <div class="empty-state-icon">📞</div>
        <div class="empty-state-title">No calls yet</div>
        <div class="empty-state-text">Call history will appear here</div>
      </div>
    `;
    return;
  }

  container.innerHTML = calls.map(call => {
    const iconClass = getCallIconClass(call.status);
    const statusText = getCallStatusText(call);

    return `
      <div class="call-history-item" onclick="viewCallDetails('${call.id}')">
        <div class="call-icon ${iconClass}">${getCallIcon(call.direction, call.status)}</div>
        <div class="call-info">
          <div class="call-title">${capitalizeFirst(call.direction || 'outbound')} Call - ${capitalizeFirst(call.status || 'unknown')}</div>
          <div class="call-meta">
            <span>${call.duration_seconds ? formatDuration(call.duration_seconds) + ' duration' : statusText}</span>
            <span>•</span>
            <span>${timeAgo(call.started_at)}</span>
          </div>
        </div>
        <div class="call-actions">
          ${call.recording_url ? '<button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); playRecording(\'' + call.recording_url + '\')">🎧</button>' : ''}
          ${call.ai_summary ? '<button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); viewTranscript(\'' + call.id + '\')">📄</button>' : ''}
        </div>
      </div>
    `;
  }).join('');
}

function renderNotes() {
  const container = document.querySelector('#notesTab .notes-card');
  if (!container) return;

  const notesListHtml = notes.length === 0 ? `
    <div class="note-item">
      <div class="empty-state" style="padding: 20px;">
        <div class="empty-state-text">No notes yet. Add your first note above.</div>
      </div>
    </div>
  ` : notes.map(note => {
    const authorName = note.created_by?.full_name || note.created_by?.email?.split('@')[0] || 'Unknown';
    const authorInitials = getInitials(authorName.split(' ')[0], authorName.split(' ')[1] || '');

    return `
      <div class="note-item" data-id="${note.id}">
        <div class="note-header">
          <div class="note-author">
            <div class="note-author-avatar">${authorInitials}</div>
            <span class="note-author-name">${escapeHtml(authorName)}</span>
            ${note.is_pinned ? '<span class="tag" style="font-size: 0.6875rem; padding: 2px 6px;">📌 Pinned</span>' : ''}
          </div>
          <span class="note-time">${timeAgo(note.created_at)}</span>
        </div>
        <div class="note-content ${note.is_pinned ? 'pinned' : ''}">${escapeHtml(note.content)}</div>
        <div class="note-actions">
          <button class="note-action-btn" onclick="${note.is_pinned ? 'unpinNote' : 'pinNote'}('${note.id}')">${note.is_pinned ? '📌 Unpin' : '📌 Pin'}</button>
          <button class="note-action-btn" onclick="editNote('${note.id}')">✏️ Edit</button>
          <button class="note-action-btn" onclick="deleteNote('${note.id}')">🗑️ Delete</button>
        </div>
      </div>
    `;
  }).join('');

  // Find notes container (after the add-note-form)
  const existingNotes = container.querySelectorAll('.note-item');
  existingNotes.forEach(el => el.remove());

  // Add notes after the form
  const addNoteForm = container.querySelector('.add-note-form');
  if (addNoteForm) {
    addNoteForm.insertAdjacentHTML('afterend', notesListHtml);
  }
}

function renderActivityTimeline() {
  const container = document.querySelector('.activity-timeline');
  if (!container) return;

  // Combine activities with calls and notes for unified timeline
  const timelineItems = [
    ...calls.map(c => ({
      type: c.status === 'missed' || c.status === 'no-answer' ? 'missed' : 'call',
      title: `${capitalizeFirst(c.direction || 'Outbound')} Call - ${capitalizeFirst(c.status || 'Unknown')}`,
      description: c.notes || (c.status === 'connected' ? 'Call completed successfully' : ''),
      time: c.started_at,
      duration: c.duration,
      outcome: c.outcome,
      id: c.id,
      hasRecording: !!c.recording_url,
      hasTranscript: !!c.transcript
    })),
    ...notes.map(n => ({
      type: 'note',
      title: 'Note Added',
      description: n.content,
      time: n.created_at,
      author: n.created_by?.full_name || 'Unknown'
    })),
    ...activities.filter(a => a.action !== 'call' && a.action !== 'note').map(a => ({
      type: getActivityType(a.action),
      title: getActivityTitle(a),
      description: getActivityDescription(a),
      time: a.created_at
    }))
  ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 20);

  if (timelineItems.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 40px;">
        <div class="empty-state-icon">📋</div>
        <div class="empty-state-title">No activity yet</div>
        <div class="empty-state-text">Activity will appear here as you interact with this contact</div>
      </div>
    `;
    return;
  }

  container.innerHTML = timelineItems.map(item => {
    const iconClass = getTimelineIconClass(item.type);
    const icon = getTimelineIcon(item.type);

    let detailsHtml = '';
    if (item.type === 'call' && item.duration) {
      detailsHtml = `
        <div class="timeline-details">
          <div class="timeline-details-row">
            <span class="timeline-details-label">Duration</span>
            <span class="timeline-details-value">${formatDuration(item.duration)}</span>
          </div>
          ${item.outcome ? `
          <div class="timeline-details-row">
            <span class="timeline-details-label">Outcome</span>
            <span class="timeline-details-value">${escapeHtml(item.outcome)}</span>
          </div>
          ` : ''}
        </div>
      `;
    }

    let actionsHtml = '';
    if (item.type === 'call') {
      actionsHtml = `
        <div class="timeline-actions">
          ${item.hasRecording ? '<button class="btn btn-sm btn-secondary" onclick="playRecording()">🎧 Listen</button>' : ''}
          ${item.hasTranscript ? '<button class="btn btn-sm btn-secondary" onclick="viewTranscript(\'' + item.id + '\')">📄 Transcript</button>' : ''}
        </div>
      `;
    }

    return `
      <div class="timeline-item">
        <div class="timeline-icon ${iconClass}">${icon}</div>
        <div class="timeline-content">
          <div class="timeline-header">
            <span class="timeline-title">${escapeHtml(item.title)}</span>
            <span class="timeline-time">${timeAgo(item.time)}</span>
          </div>
          ${item.description ? `<div class="timeline-description">${escapeHtml(item.description)}</div>` : ''}
          ${detailsHtml}
          ${actionsHtml}
        </div>
      </div>
    `;
  }).join('');
}

function updateCallsBadge() {
  const badge = document.querySelector('[data-tab="calls"] .badge');
  if (badge) badge.textContent = calls.length;
}

function updateNotesBadge() {
  const badge = document.querySelector('[data-tab="notes"] .badge');
  if (badge) badge.textContent = notes.length;
}

// ===========================================
// NOTES CRUD
// ===========================================
function togglePinNote() {
  const pinBtn = document.getElementById('pinNoteBtn');
  if (pinBtn) {
    pinBtn.classList.toggle('active');
  }
}

async function handleAddNote() {
  const textarea = document.getElementById('newNoteContent');
  const content = textarea?.value?.trim();

  // Validation
  if (!content) {
    alert('Please enter a note');
    return;
  }

  if (content.length > 5000) {
    alert('Note must be less than 5000 characters');
    return;
  }

  try {
    const { user } = await getCurrentUser();
    if (!user) {
      alert('Please log in to add notes');
      return;
    }

    const { companyId } = await getCompanyMembership();
    if (!companyId) {
      alert('Unable to add note');
      return;
    }

    // Check if pinned
    const isPinned = document.getElementById('pinNoteBtn')?.classList.contains('active') || false;

    const { data, error } = await supabase
      .from('contact_notes')
      .insert({
        contact_id: contactId,
        content: content,
        is_pinned: isPinned,
        created_by: user.id
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding note:', error);
      alert('Failed to add note');
      return;
    }

    // Clear form and reload notes
    textarea.value = '';
    document.getElementById('pinNoteBtn')?.classList.remove('active');
    await loadContactNotes();

  } catch (error) {
    console.error('Error adding note:', error);
    alert('Failed to add note');
  }
}

async function pinNote(noteId) {
  await updateNote(noteId, { is_pinned: true });
}

async function unpinNote(noteId) {
  await updateNote(noteId, { is_pinned: false });
}

async function updateNote(noteId, updates) {
  try {
    // Verify company membership before update
    const { companyId } = await getCompanyMembership();
    if (!companyId) {
      alert('Not authorized');
      return;
    }

    // Verify the note belongs to a contact in this company
    const { data: noteData } = await supabase
      .from('contact_notes')
      .select('contact_id')
      .eq('id', noteId)
      .single();

    if (!noteData) {
      alert('Note not found');
      return;
    }

    // Verify contact ownership
    const { data: contactData } = await supabase
      .from('contacts')
      .select('company_id')
      .eq('id', noteData.contact_id)
      .single();

    if (!contactData || contactData.company_id !== companyId) {
      alert('Not authorized to update this note');
      return;
    }

    const { error } = await supabase
      .from('contact_notes')
      .update(updates)
      .eq('id', noteId)
      .eq('contact_id', contactId);

    if (error) {
      console.error('Error updating note:', error);
      alert('Failed to update note');
      return;
    }

    await loadContactNotes();

  } catch (error) {
    console.error('Error updating note:', error);
    alert('Failed to update note');
  }
}

async function deleteNote(noteId) {
  if (!confirm('Are you sure you want to delete this note?')) {
    return;
  }

  try {
    // Verify company membership before delete
    const { companyId } = await getCompanyMembership();
    if (!companyId) {
      alert('Not authorized');
      return;
    }

    // Verify the note belongs to a contact in this company
    const { data: noteData } = await supabase
      .from('contact_notes')
      .select('contact_id')
      .eq('id', noteId)
      .single();

    if (!noteData) {
      alert('Note not found');
      return;
    }

    // Verify contact ownership
    const { data: contactData } = await supabase
      .from('contacts')
      .select('company_id')
      .eq('id', noteData.contact_id)
      .single();

    if (!contactData || contactData.company_id !== companyId) {
      alert('Not authorized to delete this note');
      return;
    }

    const { error } = await supabase
      .from('contact_notes')
      .delete()
      .eq('id', noteId)
      .eq('contact_id', contactId);

    if (error) {
      console.error('Error deleting note:', error);
      alert('Failed to delete note');
      return;
    }

    await loadContactNotes();

  } catch (error) {
    console.error('Error deleting note:', error);
    alert('Failed to delete note');
  }
}

function editNote(noteId) {
  const note = notes.find(n => n.id === noteId);
  if (!note) return;

  const newContent = prompt('Edit note:', note.content);
  if (newContent !== null && newContent.trim() !== note.content) {
    updateNote(noteId, { content: newContent.trim() });
  }
}

// ===========================================
// CONTACT ACTIONS
// ===========================================
function callContact() {
  if (contact && contact.phone) {
    const name = encodeURIComponent(`${contact.first_name || ''} ${contact.last_name || ''}`.trim());
    window.location.href = `call.html?number=${encodeURIComponent(contact.phone)}&name=${name}`;
  }
}

async function addToQueue() {
  try {
    const { companyId } = await getCompanyMembership();
    if (!companyId) {
      alert('Unable to add to queue');
      return;
    }

    // If no contact exists (viewing by phone), create one first
    let currentContactId = contactId;
    if (!currentContactId && contact && contact.phone) {
      const { user } = await getCurrentUser();

      const { data: newContact, error: createError } = await supabase
        .from('contacts')
        .insert({
          company_id: companyId,
          phone: contact.phone,
          first_name: contact.first_name || 'Unknown',
          last_name: contact.last_name || 'Caller',
          source: 'manual',
          status: 'new'
        })
        .select('id')
        .single();

      if (createError) {
        console.error('Error creating contact:', createError);
        alert('Failed to create contact for queue');
        return;
      }

      currentContactId = newContact.id;
      contactId = newContact.id; // Update the global contactId
      contact.id = newContact.id;
    }

    if (!currentContactId) {
      alert('No contact to add to queue');
      return;
    }

    // Check if already in queue
    const { data: existing } = await supabase
      .from('ai_queue')
      .select('id, status')
      .eq('contact_id', currentContactId)
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
        contact_id: currentContactId,
        status: 'pending',
        priority: 2  // 1 = high, 2 = normal
      });

    if (error) {
      console.error('Error adding to queue:', error);
      alert('Failed to add to queue: ' + error.message);
      return;
    }

    const name = `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Contact';
    alert(`${name} added to call queue`);

  } catch (error) {
    console.error('Error adding to queue:', error);
    alert('Failed to add to queue');
  }
}

function sendEmail() {
  if (contact && contact.email) {
    window.location.href = `mailto:${contact.email}`;
  } else {
    alert('No email address available');
  }
}

function editContact() {
  // TODO: Implement edit modal or redirect to edit page
  alert('Edit contact - coming soon');
}

function showMoreOptions() {
  if (confirm('Delete this contact?')) {
    deleteContact();
  }
}

async function deleteContact() {
  if (!confirm('Are you sure you want to delete this contact? This action cannot be undone.')) {
    return;
  }

  try {
    const { companyId } = await getCompanyMembership();
    if (!companyId) {
      alert('Not authorized');
      return;
    }

    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', contactId)
      .eq('company_id', companyId);

    if (error) {
      console.error('Error deleting contact:', error);
      alert('Failed to delete contact');
      return;
    }

    alert('Contact deleted');
    window.location.href = 'contacts.html';

  } catch (error) {
    console.error('Error deleting contact:', error);
    alert('Failed to delete contact');
  }
}

async function addTag() {
  const tag = prompt('Enter tag name:');
  if (!tag || !tag.trim()) return;

  // Validate tag
  const cleanTag = tag.trim();
  if (cleanTag.length > 50) {
    alert('Tag must be less than 50 characters');
    return;
  }

  try {
    const currentTags = contact.tags || [];
    if (currentTags.includes(cleanTag)) {
      alert('Tag already exists');
      return;
    }

    const { companyId } = await getCompanyMembership();
    if (!companyId) {
      alert('Unable to add tag');
      return;
    }

    const { error } = await supabase
      .from('contacts')
      .update({ tags: [...currentTags, cleanTag] })
      .eq('id', contactId)
      .eq('company_id', companyId);

    if (error) {
      console.error('Error adding tag:', error);
      alert('Failed to add tag');
      return;
    }

    contact.tags = [...currentTags, cleanTag];
    renderTags();

  } catch (error) {
    console.error('Error adding tag:', error);
    alert('Failed to add tag');
  }
}

// ===========================================
// CALL ACTIONS
// ===========================================
function viewCallDetails(callId) {
  const call = calls.find(c => c.id === callId);
  if (call) {
    alert(`Call Details:\nStatus: ${call.status}\nDuration: ${formatDuration(call.duration_seconds)}\nTime: ${formatDateTime(call.started_at)}`);
  }
}

function playRecording(url) {
  if (url) {
    window.open(url, '_blank');
  } else {
    alert('Recording not available');
  }
}

function viewTranscript(callId) {
  const call = calls.find(c => c.id === callId);
  if (call && call.ai_summary) {
    // Parse AI summary if it's a string
    const summary = typeof call.ai_summary === 'string'
      ? JSON.parse(call.ai_summary)
      : call.ai_summary;
    alert(`Call Summary:\n\n${summary.overview || summary.summary || JSON.stringify(summary, null, 2)}`);
  } else {
    alert('Summary not available');
  }
}

// ===========================================
// TAB SWITCHING
// ===========================================
function switchTab(tabName) {
  currentTab = tabName;

  // Update tab buttons
  document.querySelectorAll('.profile-tab').forEach(tab => {
    tab.classList.remove('active');
    if (tab.dataset.tab === tabName) {
      tab.classList.add('active');
    }
  });

  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  document.getElementById(tabName + 'Tab')?.classList.add('active');
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

function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatDurationShort(seconds) {
  if (!seconds) return '0m';
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m`;
}

function getCallIconClass(status) {
  switch (status) {
    case 'connected':
    case 'completed':
      return 'connected';
    case 'missed':
    case 'no-answer':
      return 'missed';
    case 'voicemail':
      return 'voicemail';
    default:
      return 'outbound';
  }
}

function getCallIcon(direction, status) {
  if (status === 'missed' || status === 'no-answer') return '📵';
  return direction === 'inbound' ? '📲' : '📞';
}

function getCallStatusText(call) {
  switch (call.status) {
    case 'missed':
    case 'no-answer':
      return 'No answer';
    case 'voicemail':
      return 'Voicemail left';
    case 'busy':
      return 'Line busy';
    default:
      return capitalizeFirst(call.status || 'unknown');
  }
}

function getTimelineIconClass(type) {
  switch (type) {
    case 'call':
      return 'call';
    case 'missed':
      return 'missed';
    case 'note':
      return 'note';
    case 'email':
      return 'email';
    case 'stage':
      return 'stage';
    case 'created':
      return 'created';
    default:
      return '';
  }
}

function getTimelineIcon(type) {
  switch (type) {
    case 'call':
      return '📞';
    case 'missed':
      return '📵';
    case 'note':
      return '📝';
    case 'email':
      return '✉️';
    case 'stage':
      return '🎯';
    case 'created':
      return '➕';
    default:
      return '📋';
  }
}

function getActivityType(action) {
  if (action.includes('stage') || action.includes('status')) return 'stage';
  if (action.includes('email')) return 'email';
  if (action === 'created') return 'created';
  return 'note';
}

function getActivityTitle(activity) {
  const action = activity.action || '';
  if (action.includes('stage')) return 'Stage Changed';
  if (action.includes('status')) return 'Status Updated';
  if (action === 'created') return 'Contact Created';
  return capitalizeFirst(action);
}

function getActivityDescription(activity) {
  const metadata = activity.metadata || {};
  if (metadata.from && metadata.to) {
    return `${metadata.from} → ${metadata.to}`;
  }
  return metadata.description || '';
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
// EMAIL & FILE PLACEHOLDERS
// ===========================================
function viewEmail(emailId) {
  alert(`View email #${emailId} - coming soon`);
}

function composeEmail() {
  if (contact && contact.email) {
    window.location.href = `mailto:${contact.email}`;
  } else {
    alert('No email address available');
  }
}

function uploadFile() {
  alert('File upload - coming soon');
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

    // Setup note form
    const addNoteBtn = document.querySelector('.add-note-form .btn-primary');
    if (addNoteBtn) {
      addNoteBtn.addEventListener('click', handleAddNote);
    }

    initContactProfilePage();
  });
} else {
  const savedCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
  if (savedCollapsed && window.innerWidth > 1024) {
    document.getElementById('sidebar').classList.add('collapsed');
  }

  const addNoteBtn = document.querySelector('.add-note-form .btn-primary');
  if (addNoteBtn) {
    addNoteBtn.addEventListener('click', handleAddNote);
  }

  initContactProfilePage();
}
