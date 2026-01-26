/**
 * Settings Page JavaScript
 *
 * Handles:
 * - User profile management
 * - Settings persistence to Supabase
 * - Navigation tab visibility
 * - Notification preferences
 */

// ===========================================
// STATE
// ===========================================
let hasChanges = false;
let currentUser = null;
let userSettings = null;

// ===========================================
// INITIALIZATION
// ===========================================
document.addEventListener('DOMContentLoaded', () => {
  initPage({
    requireAuth: true,
    onReady: async (user) => {
      currentUser = user;

      // Update sidebar user info
      if (user) {
        const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
        const userNameEl = document.getElementById('userName');
        const userAvatarEl = document.getElementById('userAvatar');
        if (userNameEl) userNameEl.textContent = name;
        if (userAvatarEl) userAvatarEl.textContent = name.charAt(0).toUpperCase();
      }

      // Load user profile and settings
      await Promise.all([
        loadUserProfile(),
        loadUserSettings()
      ]);

      // Load backend URL configuration
      loadBackendUrl();

      // Set up event listeners
      setupEventListeners();
    },
    onError: (error) => {
      console.error('Settings init error:', error);
      showError('.settings-container', 'Failed to load settings. Please refresh the page.');
    }
  });
});

// ===========================================
// DATA LOADING
// ===========================================

/**
 * Load user profile from Supabase
 */
async function loadUserProfile() {
  try {
    const { user, error: authError } = await getCurrentUser();
    if (authError || !user) return;

    // Get user profile from users table if exists
    const { data: profile, error } = await supabase
      .from('users')
      .select('id, email, full_name, phone, avatar_url')
      .eq('id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error loading profile:', error);
      return;
    }

    // Populate profile form
    const firstName = document.querySelector('#accountSection input[placeholder="First Name"]');
    const lastName = document.querySelector('#accountSection input[placeholder="Last Name"]');
    const emailInput = document.querySelector('#accountSection input[type="email"]');
    const phoneInput = document.querySelector('#accountSection input[type="tel"]');

    if (profile) {
      const names = (profile.full_name || '').split(' ');
      if (firstName) firstName.value = names[0] || '';
      if (lastName) lastName.value = names.slice(1).join(' ') || '';
      if (phoneInput) phoneInput.value = formatPhone(profile.phone) || '';
    }

    if (emailInput) emailInput.value = user.email || '';

  } catch (error) {
    console.error('Error loading user profile:', error);
  }
}

/**
 * Load user settings from Supabase
 */
async function loadUserSettings() {
  try {
    const { user, error: authError } = await getCurrentUser();
    if (authError || !user) return;

    const { data: settings, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error loading settings:', error);
      return;
    }

    userSettings = settings || {};

    // Apply saved settings to UI
    applySettingsToUI(userSettings);

  } catch (error) {
    console.error('Error loading user settings:', error);
  }
}

/**
 * Apply loaded settings to the UI
 */
function applySettingsToUI(settings) {
  // Navigation tab visibility
  if (settings.hidden_tabs && Array.isArray(settings.hidden_tabs)) {
    settings.hidden_tabs.forEach(tabName => {
      const checkbox = document.querySelector(`input[data-tab="${tabName}"]`);
      if (checkbox) {
        checkbox.checked = false;
        checkbox.closest('.nav-tab-item')?.classList.add('disabled');
      }
    });
  }

  // Default landing page
  if (settings.landing_page) {
    const option = document.querySelector(`.landing-page-option[data-page="${settings.landing_page}"]`);
    if (option) {
      document.querySelectorAll('.landing-page-option').forEach(o => o.classList.remove('selected'));
      option.classList.add('selected');
    }
  }

  // Notification preferences
  if (settings.notifications) {
    const notifs = settings.notifications;
    setCheckboxByLabel('Incoming Calls', notifs.incoming_calls !== false);
    setCheckboxByLabel('Callback Reminders', notifs.callback_reminders !== false);
    setCheckboxByLabel('New Leads', notifs.new_leads !== false);
    setCheckboxByLabel('Deal Updates', notifs.deal_updates !== false);
    setCheckboxByLabel('Daily Summary', notifs.daily_summary === true);
  }

  // Sound settings
  if (settings.sounds !== undefined) {
    setCheckboxByLabel('Enable Sounds', settings.sounds.enabled !== false);
    const volumeSlider = document.querySelector('input[type="range"]');
    if (volumeSlider && settings.sounds.volume !== undefined) {
      volumeSlider.value = settings.sounds.volume;
    }
  }

  // Appearance
  if (settings.appearance) {
    setCheckboxByLabel('Compact Mode', settings.appearance.compact_mode === true);
  }

  // Pipeline stages - apply enabled/disabled state
  if (settings.pipeline_stages) {
    Object.entries(settings.pipeline_stages).forEach(([stageName, isEnabled]) => {
      const checkbox = document.querySelector(`input[data-stage="${stageName}"]`);
      if (checkbox && !checkbox.disabled) {
        checkbox.checked = isEnabled;
        checkbox.closest('.pipeline-stage-item')?.classList.toggle('disabled', !isEnabled);
      }
    });
  }

  // Timezone setting
  if (settings.timezone) {
    const timezoneSelect = document.getElementById('timezoneSelect');
    if (timezoneSelect) {
      timezoneSelect.value = settings.timezone;
      // Store in localStorage for use by other pages
      localStorage.setItem('userTimezone', settings.timezone);
    }
  }
}

/**
 * Helper to set checkbox by label text
 */
function setCheckboxByLabel(labelText, checked) {
  const labels = document.querySelectorAll('.settings-item-label');
  for (const label of labels) {
    if (label.textContent.includes(labelText)) {
      const checkbox = label.closest('.settings-item')?.querySelector('input[type="checkbox"]');
      if (checkbox && !checkbox.disabled) {
        checkbox.checked = checked;
      }
      break;
    }
  }
}

// ===========================================
// SAVE / UPDATE FUNCTIONS
// ===========================================

/**
 * Save all settings to Supabase
 */
async function saveSettings() {
  try {
    const { user, error: authError } = await getCurrentUser();
    if (authError || !user) {
      alert('You must be logged in to save settings');
      return;
    }

    // Collect settings from UI
    const settings = collectSettingsFromUI();

    // Validate settings (Ralph Wiggum pattern)
    const validation = validateSettings(settings);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    // Update user profile
    const profileResult = await updateUserProfile(settings.profile);
    if (profileResult.error) {
      alert('Failed to save profile: ' + profileResult.error);
      return;
    }

    // Upsert user settings
    const { error: settingsError } = await supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        hidden_tabs: settings.hidden_tabs,
        landing_page: settings.landing_page,
        notifications: settings.notifications,
        sounds: settings.sounds,
        appearance: settings.appearance,
        pipeline_stages: settings.pipeline_stages,
        timezone: settings.timezone,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    // Also save timezone to localStorage for immediate use by other pages
    if (settings.timezone) {
      localStorage.setItem('userTimezone', settings.timezone);
    }

    if (settingsError) {
      console.error('Error saving settings:', settingsError);
      alert('Failed to save settings. Please try again.');
      return;
    }

    hasChanges = false;
    document.getElementById('saveBar').classList.remove('active');
    alert('Settings saved successfully!');

  } catch (error) {
    console.error('Error saving settings:', error);
    alert('Failed to save settings. Please try again.');
  }
}

/**
 * Collect all settings from UI elements
 */
function collectSettingsFromUI() {
  // Hidden navigation tabs
  const hiddenTabs = [];
  document.querySelectorAll('input[data-tab]').forEach(checkbox => {
    if (!checkbox.checked && !checkbox.disabled) {
      hiddenTabs.push(checkbox.dataset.tab);
    }
  });

  // Landing page
  const selectedLanding = document.querySelector('.landing-page-option.selected');
  const landingPage = selectedLanding?.dataset.page || 'dashboard';

  // Notification preferences
  const notifications = {
    incoming_calls: getCheckboxByLabel('Incoming Calls'),
    callback_reminders: getCheckboxByLabel('Callback Reminders'),
    new_leads: getCheckboxByLabel('New Leads'),
    deal_updates: getCheckboxByLabel('Deal Updates'),
    daily_summary: getCheckboxByLabel('Daily Summary')
  };

  // Sound settings
  const volumeSlider = document.querySelector('input[type="range"]');
  const sounds = {
    enabled: getCheckboxByLabel('Enable Sounds'),
    volume: volumeSlider ? parseInt(volumeSlider.value, 10) : 75
  };

  // Appearance
  const appearance = {
    compact_mode: getCheckboxByLabel('Compact Mode')
  };

  // Pipeline stages - collect enabled/disabled state for each stage
  const pipelineStages = {};
  document.querySelectorAll('input[data-stage]').forEach(checkbox => {
    pipelineStages[checkbox.dataset.stage] = checkbox.checked;
  });

  // Profile
  const firstName = document.querySelector('#accountSection input[placeholder="First Name"]')?.value?.trim() || '';
  const lastName = document.querySelector('#accountSection input[placeholder="Last Name"]')?.value?.trim() || '';
  const phone = document.querySelector('#accountSection input[type="tel"]')?.value?.replace(/\D/g, '') || '';

  // Timezone
  const timezoneSelect = document.getElementById('timezoneSelect');
  const timezone = timezoneSelect?.value || 'America/New_York';

  return {
    hidden_tabs: hiddenTabs,
    landing_page: landingPage,
    notifications,
    sounds,
    appearance,
    pipeline_stages: pipelineStages,
    timezone,
    profile: {
      full_name: `${firstName} ${lastName}`.trim(),
      phone: phone ? `+1${phone.slice(-10)}` : null
    }
  };
}

/**
 * Helper to get checkbox state by label text
 */
function getCheckboxByLabel(labelText) {
  const labels = document.querySelectorAll('.settings-item-label');
  for (const label of labels) {
    if (label.textContent.includes(labelText)) {
      const checkbox = label.closest('.settings-item')?.querySelector('input[type="checkbox"]');
      return checkbox ? checkbox.checked : false;
    }
  }
  return false;
}

/**
 * Validate settings (Ralph Wiggum pattern)
 */
function validateSettings(settings) {
  // Validate profile name
  if (settings.profile.full_name && settings.profile.full_name.length > 100) {
    return { valid: false, error: 'Name is too long (max 100 characters)' };
  }

  // Validate phone
  if (settings.profile.phone) {
    const phoneDigits = settings.profile.phone.replace(/\D/g, '');
    if (phoneDigits.length !== 11) {
      return { valid: false, error: 'Please enter a valid 10-digit phone number' };
    }
  }

  // Validate landing page
  const validPages = ['dashboard', 'call', 'contacts', 'pipeline'];
  if (!validPages.includes(settings.landing_page)) {
    return { valid: false, error: 'Invalid landing page selected' };
  }

  return { valid: true };
}

/**
 * Update user profile in Supabase
 */
async function updateUserProfile(profileData) {
  try {
    const { user, error: authError } = await getCurrentUser();
    if (authError || !user) {
      return { error: 'Not authenticated' };
    }

    // Update auth metadata
    const { error: metaError } = await supabase.auth.updateUser({
      data: { full_name: profileData.full_name }
    });

    if (metaError) {
      console.error('Error updating auth metadata:', metaError);
    }

    // Update users table
    const { error } = await supabase
      .from('users')
      .upsert({
        id: user.id,
        email: user.email,
        full_name: profileData.full_name,
        phone: profileData.phone,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

    if (error) {
      return { error: error.message };
    }

    // Update sidebar display
    if (profileData.full_name) {
      const userNameEl = document.getElementById('userName');
      const userAvatarEl = document.getElementById('userAvatar');
      if (userNameEl) userNameEl.textContent = profileData.full_name;
      if (userAvatarEl) userAvatarEl.textContent = profileData.full_name.charAt(0).toUpperCase();
    }

    return { success: true };

  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Handle password change
 */
async function handleChangePassword() {
  const currentPassword = prompt('Enter your current password:');
  if (!currentPassword) return;

  const newPassword = prompt('Enter your new password (min 8 characters):');
  if (!newPassword) return;

  // Validate password length
  if (newPassword.length < 8) {
    alert('Password must be at least 8 characters long');
    return;
  }

  const confirmPassword = prompt('Confirm your new password:');
  if (newPassword !== confirmPassword) {
    alert('Passwords do not match');
    return;
  }

  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) {
      alert('Failed to change password: ' + error.message);
      return;
    }

    alert('Password changed successfully!');

  } catch (error) {
    alert('Failed to change password. Please try again.');
  }
}

// ===========================================
// UI HANDLERS
// ===========================================

/**
 * Toggle navigation tab visibility
 */
function toggleNavTab(checkbox) {
  const tabName = checkbox.dataset.tab;
  const listItem = checkbox.closest('.nav-tab-item');
  listItem.classList.toggle('disabled', !checkbox.checked);
  markAsChanged();
}

/**
 * Select landing page
 */
function selectLandingPage(element) {
  document.querySelectorAll('.landing-page-option').forEach(opt => opt.classList.remove('selected'));
  element.classList.add('selected');
  markAsChanged();
}

/**
 * Toggle pipeline stage visibility
 */
function togglePipelineStage(checkbox) {
  const stageName = checkbox.dataset.stage;
  const listItem = checkbox.closest('.pipeline-stage-item');
  listItem.classList.toggle('disabled', !checkbox.checked);
  markAsChanged();
}

/**
 * Add pipeline stage (placeholder)
 */
function addPipelineStage() {
  const stageName = prompt('Enter the name for the new stage:');
  if (!stageName) return;

  if (stageName.length > 50) {
    alert('Stage name is too long (max 50 characters)');
    return;
  }

  alert(`Stage "${escapeHtml(stageName)}" would be added. (Functionality coming soon)`);
  markAsChanged();
}

/**
 * Reset all settings
 */
async function resetSettings() {
  if (!confirm('Are you sure you want to reset all settings to default? This cannot be undone.')) {
    return;
  }

  try {
    const { user, error: authError } = await getCurrentUser();
    if (authError || !user) return;

    // Delete user settings
    await supabase
      .from('user_settings')
      .delete()
      .eq('user_id', user.id);

    alert('Settings have been reset to default values.');
    location.reload();

  } catch (error) {
    console.error('Error resetting settings:', error);
    alert('Failed to reset settings. Please try again.');
  }
}

/**
 * Mark settings as changed
 */
function markAsChanged() {
  hasChanges = true;
  document.getElementById('saveBar').classList.add('active');
}

// Alias for HTML onclick handlers
function markSettingsChanged() {
  markAsChanged();
}

/**
 * Discard changes
 */
function discardChanges() {
  if (confirm('Discard all unsaved changes?')) {
    hasChanges = false;
    document.getElementById('saveBar').classList.remove('active');
    location.reload();
  }
}

// ===========================================
// EVENT LISTENERS
// ===========================================

function setupEventListeners() {
  // Tab switching
  document.querySelectorAll('.settings-tab').forEach(tab => {
    tab.addEventListener('click', function() {
      const tabId = this.dataset.tab;

      // Update tab buttons
      document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
      this.classList.add('active');

      // Update sections
      document.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));
      const section = document.getElementById(tabId + 'Section');
      if (section) section.classList.add('active');
    });
  });

  // Track changes on all inputs
  document.querySelectorAll('input, select, textarea').forEach(input => {
    input.addEventListener('change', markAsChanged);
  });

  // Warn before leaving with unsaved changes
  window.addEventListener('beforeunload', function(e) {
    if (hasChanges) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  // Save bar buttons
  const saveBar = document.getElementById('saveBar');
  if (saveBar) {
    const discardBtn = saveBar.querySelector('.btn-secondary');
    const saveBtn = saveBar.querySelector('.btn-primary');
    if (discardBtn) discardBtn.addEventListener('click', discardChanges);
    if (saveBtn) saveBtn.addEventListener('click', saveSettings);
  }
}

// ===========================================
// BACKEND URL CONFIGURATION
// ===========================================

/**
 * Load backend URL from localStorage and update UI
 */
function loadBackendUrl() {
  const backendUrlInput = document.getElementById('backendUrlInput');
  if (backendUrlInput) {
    const savedUrl = localStorage.getItem('backendUrl') || 'http://localhost:8080';
    backendUrlInput.value = savedUrl;
  }
}

/**
 * Save backend URL to localStorage
 */
function saveBackendUrl() {
  const backendUrlInput = document.getElementById('backendUrlInput');
  const statusEl = document.getElementById('connectionStatus');

  if (!backendUrlInput) return;

  let url = backendUrlInput.value.trim();

  // Validate URL
  if (!url) {
    showConnectionStatus('error', 'Please enter a URL');
    return;
  }

  // Remove trailing slash
  url = url.replace(/\/$/, '');

  // Basic URL validation
  try {
    new URL(url);
  } catch (e) {
    showConnectionStatus('error', 'Please enter a valid URL (e.g., http://localhost:3002)');
    return;
  }

  // Save to localStorage
  localStorage.setItem('backendUrl', url);

  // Update global variable
  if (window.OutreachApp) {
    window.OutreachApp.setBackendUrl(url);
  } else {
    window.BACKEND_URL = url;
  }

  showConnectionStatus('success', 'Backend URL saved successfully!');
}

/**
 * Test connection to backend server
 */
async function testBackendConnection() {
  const backendUrlInput = document.getElementById('backendUrlInput');
  if (!backendUrlInput) return;

  const url = backendUrlInput.value.trim().replace(/\/$/, '');

  if (!url) {
    showConnectionStatus('error', 'Please enter a URL first');
    return;
  }

  showConnectionStatus('info', 'Testing connection...');

  try {
    // Try to reach the health endpoint or root
    const response = await fetch(`${url}/health`, {
      method: 'GET',
      mode: 'cors',
      headers: {
        'Accept': 'application/json'
      }
    }).catch(() => fetch(url, { method: 'GET', mode: 'cors' }));

    if (response.ok) {
      showConnectionStatus('success', 'Connection successful! Backend server is reachable.');
      updateTwilioStatus(true);
    } else {
      showConnectionStatus('warning', `Server responded with status ${response.status}. It may still work.`);
      updateTwilioStatus(false);
    }
  } catch (error) {
    console.error('Connection test failed:', error);
    showConnectionStatus('error', 'Connection failed. Make sure the backend server is running and CORS is configured.');
    updateTwilioStatus(false);
  }
}

/**
 * Show connection status message
 */
function showConnectionStatus(type, message) {
  const statusEl = document.getElementById('connectionStatus');
  if (!statusEl) return;

  statusEl.style.display = 'block';
  statusEl.style.padding = 'var(--spacing-md)';
  statusEl.style.borderRadius = 'var(--radius-md)';
  statusEl.style.fontSize = '0.875rem';

  switch (type) {
    case 'success':
      statusEl.style.background = 'var(--success-light, #dcfce7)';
      statusEl.style.color = 'var(--success, #16a34a)';
      statusEl.innerHTML = '&#10003; ' + message;
      break;
    case 'error':
      statusEl.style.background = 'var(--danger-light, #fee2e2)';
      statusEl.style.color = 'var(--danger, #dc2626)';
      statusEl.innerHTML = '&#10007; ' + message;
      break;
    case 'warning':
      statusEl.style.background = 'var(--warning-light, #fef3c7)';
      statusEl.style.color = 'var(--warning, #d97706)';
      statusEl.innerHTML = '&#9888; ' + message;
      break;
    case 'info':
    default:
      statusEl.style.background = 'var(--gray-100)';
      statusEl.style.color = 'var(--gray-700)';
      statusEl.innerHTML = message;
      break;
  }
}

/**
 * Update Twilio integration status badges
 */
function updateTwilioStatus(connected) {
  const callingBadge = document.getElementById('callingStatusBadge');
  const smsBadge = document.getElementById('smsStatusBadge');
  const callingStatus = document.getElementById('callingStatus');
  const smsStatus = document.getElementById('smsStatus');

  if (connected) {
    if (callingBadge) {
      callingBadge.textContent = 'Connected';
      callingBadge.style.background = 'var(--success-light, #dcfce7)';
      callingBadge.style.color = 'var(--success, #16a34a)';
    }
    if (smsBadge) {
      smsBadge.textContent = 'Connected';
      smsBadge.style.background = 'var(--success-light, #dcfce7)';
      smsBadge.style.color = 'var(--success, #16a34a)';
    }
    if (callingStatus) callingStatus.textContent = 'Backend server connected';
    if (smsStatus) smsStatus.textContent = 'Backend server connected';
  } else {
    if (callingBadge) {
      callingBadge.textContent = 'Not Connected';
      callingBadge.style.background = 'var(--gray-200)';
      callingBadge.style.color = 'var(--gray-600)';
    }
    if (smsBadge) {
      smsBadge.textContent = 'Not Connected';
      smsBadge.style.background = 'var(--gray-200)';
      smsBadge.style.color = 'var(--gray-600)';
    }
    if (callingStatus) callingStatus.textContent = 'Requires backend server connection';
    if (smsStatus) smsStatus.textContent = 'Requires backend server connection';
  }
}

// ===========================================
// SIDEBAR FUNCTIONS (maintain existing behavior)
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

// ===========================================
// CALL FORWARDING
// ===========================================

/**
 * Load the current call forwarding number from the server
 */
async function loadForwardingNumber() {
  try {
    const response = await fetch('/api/settings/forwarding');
    const data = await response.json();

    const input = document.getElementById('forwardingNumber');
    const status = document.getElementById('forwardingStatus');

    if (input && data.forwardingNumber) {
      input.value = formatPhoneNumber(data.forwardingNumber);
      if (status) {
        status.textContent = 'Forwarding is enabled';
        status.style.color = 'var(--success)';
      }
    } else if (status) {
      status.textContent = 'Forwarding is disabled';
      status.style.color = 'var(--gray-500)';
    }
  } catch (error) {
    console.error('Failed to load forwarding number:', error);
  }
}

/**
 * Save the call forwarding number to the server
 */
async function saveForwardingNumber() {
  const input = document.getElementById('forwardingNumber');
  const status = document.getElementById('forwardingStatus');

  if (!input) return;

  // Clean the phone number (remove formatting)
  let phoneNumber = input.value.replace(/\D/g, '');

  // Add + prefix if it looks like a full number
  if (phoneNumber.length >= 10) {
    if (!phoneNumber.startsWith('1') && phoneNumber.length === 10) {
      phoneNumber = '1' + phoneNumber;
    }
    phoneNumber = '+' + phoneNumber;
  } else if (phoneNumber.length === 0) {
    phoneNumber = null; // Disable forwarding
  } else {
    if (status) {
      status.textContent = 'Please enter a valid phone number';
      status.style.color = 'var(--danger)';
    }
    return;
  }

  try {
    const response = await fetch('/api/settings/forwarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ forwardingNumber: phoneNumber })
    });

    const data = await response.json();

    if (data.success) {
      if (status) {
        if (data.forwardingNumber) {
          status.textContent = 'Forwarding saved and enabled';
          status.style.color = 'var(--success)';
          input.value = formatPhoneNumber(data.forwardingNumber);
        } else {
          status.textContent = 'Forwarding disabled';
          status.style.color = 'var(--gray-500)';
          input.value = '';
        }
      }
    } else {
      if (status) {
        status.textContent = 'Failed to save forwarding number';
        status.style.color = 'var(--danger)';
      }
    }
  } catch (error) {
    console.error('Failed to save forwarding number:', error);
    if (status) {
      status.textContent = 'Error saving forwarding number';
      status.style.color = 'var(--danger)';
    }
  }
}

/**
 * Format phone number for display
 */
function formatPhoneNumber(number) {
  if (!number) return '';
  const cleaned = number.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned[0] === '1') {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return number;
}

// Load forwarding number when page loads
document.addEventListener('DOMContentLoaded', () => {
  // Wait a bit for the main init to complete, then load forwarding number
  setTimeout(loadForwardingNumber, 500);
  // Also load time tracking settings
  setTimeout(loadTimeTrackingSettings, 600);
});

// ===========================================
// TIME TRACKING SETTINGS
// ===========================================

/**
 * Load time tracking settings from company_settings table
 */
async function loadTimeTrackingSettings() {
  try {
    const { user, error: authError } = await getCurrentUser();
    if (authError || !user) return;

    // Get user's company_id from company_members
    const { data: memberData, error: memberError } = await supabase
      .from('company_members')
      .select('company_id, role')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (memberError || !memberData?.company_id) {
      console.log('No company found for user');
      return;
    }

    const companyId = memberData.company_id;
    const userRole = memberData.role;

    // Store for later use
    window.timeTrackingCompanyId = companyId;
    window.timeTrackingUserRole = userRole;

    // Check if user is manager/admin (can edit settings)
    const canEdit = ['owner', 'manager', 'admin'].includes(userRole);
    if (!canEdit) {
      // Disable the inputs for non-managers
      disableTimeTrackingInputs();
    }

    // Load company settings
    const { data: settings, error: settingsError } = await supabase
      .from('company_settings')
      .select('time_tracking_enabled, break_detection_enabled, break_detection_minutes, daily_report_time')
      .eq('company_id', companyId)
      .limit(1)
      .maybeSingle();

    if (settingsError && settingsError.code !== 'PGRST116') {
      console.error('Error loading time tracking settings:', settingsError);
      return;
    }

    // Apply settings to UI
    if (settings) {
      const timeTrackingEnabled = document.getElementById('timeTrackingEnabled');
      const breakDetectionEnabled = document.getElementById('breakDetectionEnabled');
      const breakDetectionMinutes = document.getElementById('breakDetectionMinutes');
      const dailyReportTime = document.getElementById('dailyReportTime');

      if (timeTrackingEnabled) {
        timeTrackingEnabled.checked = settings.time_tracking_enabled !== false;
      }
      if (breakDetectionEnabled) {
        breakDetectionEnabled.checked = settings.break_detection_enabled === true;
      }
      if (breakDetectionMinutes && settings.break_detection_minutes) {
        breakDetectionMinutes.value = settings.break_detection_minutes.toString();
      }
      if (dailyReportTime && settings.daily_report_time) {
        dailyReportTime.value = settings.daily_report_time;
      }
    }

  } catch (error) {
    console.error('Error loading time tracking settings:', error);
  }
}

/**
 * Save time tracking settings to company_settings table
 */
async function saveTimeTrackingSettings() {
  try {
    const { user, error: authError } = await getCurrentUser();
    if (authError || !user) {
      console.error('Not authenticated');
      return { error: 'Not authenticated' };
    }

    const companyId = window.timeTrackingCompanyId;
    const userRole = window.timeTrackingUserRole;

    if (!companyId) {
      console.error('No company ID found');
      return { error: 'No company found' };
    }

    // Check permissions
    const canEdit = ['owner', 'manager', 'admin'].includes(userRole);
    if (!canEdit) {
      console.error('User does not have permission to edit company settings');
      return { error: 'Permission denied' };
    }

    // Collect values from UI
    const timeTrackingEnabled = document.getElementById('timeTrackingEnabled')?.checked ?? true;
    const breakDetectionEnabled = document.getElementById('breakDetectionEnabled')?.checked ?? false;
    const breakDetectionMinutes = parseInt(document.getElementById('breakDetectionMinutes')?.value || '5', 10);
    const dailyReportTime = document.getElementById('dailyReportTime')?.value || '23:59';

    // Validate values
    if (breakDetectionMinutes < 1 || breakDetectionMinutes > 60) {
      return { error: 'Break detection minutes must be between 1 and 60' };
    }

    // Upsert company settings
    const { error } = await supabase
      .from('company_settings')
      .upsert({
        company_id: companyId,
        time_tracking_enabled: timeTrackingEnabled,
        break_detection_enabled: breakDetectionEnabled,
        break_detection_minutes: breakDetectionMinutes,
        daily_report_time: dailyReportTime,
        updated_at: new Date().toISOString()
      }, { onConflict: 'company_id' });

    if (error) {
      console.error('Error saving time tracking settings:', error);
      return { error: error.message };
    }

    console.log('Time tracking settings saved successfully');
    return { success: true };

  } catch (error) {
    console.error('Error saving time tracking settings:', error);
    return { error: error.message };
  }
}

/**
 * Disable time tracking inputs for non-managers
 */
function disableTimeTrackingInputs() {
  const inputs = [
    'timeTrackingEnabled',
    'breakDetectionEnabled',
    'breakDetectionMinutes',
    'dailyReportTime'
  ];

  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.disabled = true;
      // Update toggle switch style
      const toggleSwitch = el.closest('.toggle-switch');
      if (toggleSwitch) {
        toggleSwitch.style.opacity = '0.5';
        toggleSwitch.style.cursor = 'not-allowed';
      }
    }
  });
}

// Override saveSettings to also save time tracking settings
const originalSaveSettingsFunc = saveSettings;
saveSettings = async function() {
  // Save time tracking settings first (if user has permission)
  if (window.timeTrackingCompanyId && ['owner', 'manager', 'admin'].includes(window.timeTrackingUserRole)) {
    const timeResult = await saveTimeTrackingSettings();
    if (timeResult.error) {
      console.error('Warning: Could not save time tracking settings:', timeResult.error);
    }
  }

  // Then save other settings
  await originalSaveSettingsFunc();
};
