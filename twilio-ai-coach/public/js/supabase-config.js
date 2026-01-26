/**
 * Supabase Configuration for HTML Pages
 *
 * This file provides:
 * - Supabase client initialization
 * - Authentication helpers
 * - Company membership utilities
 *
 * Usage: Include this script in your HTML pages before any page-specific scripts
 * <script src="js/supabase.min.js"></script>
 * <script src="js/supabase-config.js"></script>
 */

// ===========================================
// CONFIGURATION - Update these values
// ===========================================
const SUPABASE_URL = 'https://emcsnlviqhbtqhjuqtam.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtY3NubHZpcWhidHFoanVxdGFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwNDA1NTYsImV4cCI6MjA4NDYxNjU1Nn0.OHyF-SyCK2oh4xOhtDyhjhA9z6F_S1u6sxGx6TfhDFU'

// Backend server URL for Twilio/calling features
// This should point to your Node.js backend server
const BACKEND_URL = localStorage.getItem('backendUrl') || 'http://localhost:8080'

// Helper to update backend URL (can be called from settings page)
function setBackendUrl(url) {
  localStorage.setItem('backendUrl', url)
  window.BACKEND_URL = url
}

// Make it globally available
window.BACKEND_URL = BACKEND_URL

// ===========================================
// SUPABASE CLIENT
// ===========================================
// The SDK (supabase.min.js) creates global 'supabase' with createClient method
// We create our client and store it for use throughout the app

// Debug: log what we have
console.log('Checking for Supabase SDK...')
console.log('typeof supabase:', typeof supabase)

// Try to create client - supabase should be available from the SDK script
var supabaseClient = null
try {
  if (typeof supabase !== 'undefined' && supabase && typeof supabase.createClient === 'function') {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    console.log('Supabase client initialized successfully!')
  } else {
    console.error('Supabase SDK not available or createClient not found')
    console.error('supabase object:', supabase)
  }
} catch (e) {
  console.error('Error initializing Supabase:', e)
}

// Store client globally for other scripts to use
window.supabaseClient = supabaseClient

// Also make it available as 'supabase' for backward compatibility with existing code
// But we need to be careful not to break anything
if (supabaseClient) {
  // Store the SDK reference
  window.supabaseSDK = supabase
  // Overwrite supabase with the client instance
  supabase = supabaseClient
}

// ===========================================
// AUTHENTICATION HELPERS
// ===========================================

/**
 * Get the current authenticated user
 * @returns {Promise<{user: object|null, error: Error|null}>}
 */
async function getCurrentUser() {
  if (!supabase) return { user: null, error: new Error('Supabase not initialized') }
  const { data: { user }, error } = await supabase.auth.getUser()
  return { user, error }
}

/**
 * Check if user is authenticated, redirect to login if not
 * @param {string} loginUrl - URL to redirect to if not authenticated
 * @returns {Promise<object|null>} - Returns user object or null
 */
async function requireAuth(loginUrl = 'index.html') {
  const { user, error } = await getCurrentUser()

  if (error || !user) {
    window.location.href = loginUrl
    return null
  }

  return user
}

/**
 * Sign out the current user
 * @param {string} redirectUrl - URL to redirect to after sign out
 */
async function signOut(redirectUrl = 'index.html') {
  if (!supabase) return
  await supabase.auth.signOut()
  window.location.href = redirectUrl
}

/**
 * Listen for auth state changes
 * @param {function} callback - Function to call when auth state changes
 * @returns {object} - Subscription object with unsubscribe method
 */
function onAuthStateChange(callback) {
  if (!supabase) return { unsubscribe: () => {} }
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session)
  })
}

// ===========================================
// COMPANY MEMBERSHIP HELPERS
// ===========================================

// Cache for company membership to avoid repeated queries
let _companyCache = null

/**
 * Get the user's company membership
 * @param {boolean} useCache - Whether to use cached value
 * @returns {Promise<{companyId: string|null, role: string|null, error: Error|null}>}
 */
async function getCompanyMembership(useCache = true) {
  if (useCache && _companyCache) {
    console.log('getCompanyMembership: returning cached value', _companyCache)
    return _companyCache
  }

  const { user, error: authError } = await getCurrentUser()
  console.log('getCompanyMembership: user result', { userId: user?.id, authError })
  if (authError || !user) {
    console.error('getCompanyMembership: not authenticated', authError)
    return { companyId: null, role: null, error: authError || new Error('Not authenticated') }
  }

  console.log('getCompanyMembership: querying company_members for user_id', user.id)
  const { data, error } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  console.log('getCompanyMembership: query result', { data, error })

  // If no membership found, try to create a company for this user
  if (!data && !error) {
    console.log('getCompanyMembership: no membership found, creating company...')
    const created = await createCompanyForUser(user)
    if (created) {
      _companyCache = { companyId: created.companyId, role: 'owner', error: null }
      return _companyCache
    }
    return { companyId: null, role: null, error: new Error('Could not create company') }
  }

  if (error) {
    console.error('getCompanyMembership: query error', error)
    return { companyId: null, role: null, error }
  }

  _companyCache = { companyId: data.company_id, role: data.role, error: null }
  return _companyCache
}

/**
 * Create a company and membership for a user who doesn't have one
 * @param {object} user - The user object
 * @returns {Promise<{companyId: string}|null>}
 */
async function createCompanyForUser(user) {
  try {
    const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'
    const companyName = `${userName}'s Company`
    // Generate a URL-friendly slug from the company name + random suffix for uniqueness
    const slug = companyName.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') + '-' + Math.random().toString(36).substring(2, 8)

    console.log('Creating company:', companyName, 'with slug:', slug)
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .insert({
        name: companyName,
        slug: slug
      })
      .select()
      .single()

    if (companyError) {
      console.error('Error creating company:', companyError)
      return null
    }

    console.log('Company created:', company.id)

    // Add user as company owner
    const { error: memberError } = await supabase
      .from('company_members')
      .insert({
        company_id: company.id,
        user_id: user.id,
        role: 'owner'
      })

    if (memberError) {
      console.error('Error creating company membership:', memberError)
      return null
    }

    console.log('Company membership created successfully')
    return { companyId: company.id }

  } catch (err) {
    console.error('Error in createCompanyForUser:', err)
    return null
  }
}

/**
 * Clear the company membership cache
 */
function clearCompanyCache() {
  _companyCache = null
}

/**
 * Check if user has required role
 * @param {string|string[]} requiredRoles - Role(s) that are allowed
 * @returns {Promise<boolean>}
 */
async function hasRole(requiredRoles) {
  const { role, error } = await getCompanyMembership()
  if (error || !role) return false

  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles]
  return roles.includes(role)
}

// ===========================================
// UI HELPERS
// ===========================================

/**
 * Show loading state in an element
 * @param {string|HTMLElement} selector - CSS selector or element
 * @param {string} message - Loading message to display
 */
function showLoading(selector, message = 'Loading...') {
  const el = typeof selector === 'string' ? document.querySelector(selector) : selector
  if (el) {
    el.innerHTML = `<div class="loading-spinner">${message}</div>`
  }
}

/**
 * Show error state in an element
 * @param {string|HTMLElement} selector - CSS selector or element
 * @param {string} message - Error message to display
 */
function showError(selector, message) {
  const el = typeof selector === 'string' ? document.querySelector(selector) : selector
  if (el) {
    el.innerHTML = `<div class="error-message">${escapeHtml(message)}</div>`
  }
}

/**
 * Show empty state in an element
 * @param {string|HTMLElement} selector - CSS selector or element
 * @param {string} message - Empty state message
 * @param {string} icon - Optional icon/emoji
 */
function showEmpty(selector, message, icon = '📭') {
  const el = typeof selector === 'string' ? document.querySelector(selector) : selector
  if (el) {
    el.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">${icon}</span>
        <p>${escapeHtml(message)}</p>
      </div>
    `
  }
}

/**
 * Escape HTML to prevent XSS
 * @param {string} str - String to escape
 * @returns {string}
 */
function escapeHtml(str) {
  if (!str) return ''
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

/**
 * Format a date for display
 * @param {string|Date} date - Date to format
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string}
 */
function formatDate(date, options = {}) {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...options
  })
}

/**
 * Format a date/time for display
 * @param {string|Date} date - Date to format
 * @returns {string}
 */
function formatDateTime(date) {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

/**
 * Format currency
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code
 * @returns {string}
 */
function formatCurrency(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount || 0)
}

/**
 * Format phone number for display
 * @param {string} phone - Phone number
 * @returns {string}
 */
function formatPhone(phone) {
  if (!phone) return ''
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  } else if (cleaned.length === 11 && cleaned[0] === '1') {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`
  }
  return phone
}

/**
 * Get relative time string (e.g., "2 hours ago")
 * @param {string|Date} date - Date to compare
 * @returns {string}
 */
function timeAgo(date) {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const seconds = Math.floor((now - d) / 1000)

  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`

  return formatDate(d)
}

// ===========================================
// FORM HELPERS
// ===========================================

/**
 * Get form data as an object
 * @param {HTMLFormElement} form - Form element
 * @returns {object}
 */
function getFormData(form) {
  const formData = new FormData(form)
  const data = {}
  for (const [key, value] of formData.entries()) {
    data[key] = value
  }
  return data
}

/**
 * Disable/enable form during submission
 * @param {HTMLFormElement} form - Form element
 * @param {boolean} disabled - Whether to disable
 */
function setFormDisabled(form, disabled) {
  const elements = form.querySelectorAll('input, button, select, textarea')
  elements.forEach(el => {
    el.disabled = disabled
  })
}

// ===========================================
// INITIALIZATION
// ===========================================

/**
 * Initialize page with auth check and data loading
 * @param {object} options - Configuration options
 * @param {boolean} options.requireAuth - Whether auth is required
 * @param {function} options.onReady - Callback when ready
 * @param {function} options.onError - Callback on error
 */
async function initPage(options = {}) {
  const {
    requireAuth: needsAuth = true,
    onReady = null,
    onError = null
  } = options

  try {
    let user = null

    if (needsAuth) {
      user = await requireAuth()
      if (!user) return // Will redirect
    } else {
      const result = await getCurrentUser()
      user = result.user
    }

    // Update UI with user info if available
    if (user) {
      updateUserUI(user)
    }

    if (onReady) {
      await onReady(user)
    }
  } catch (error) {
    console.error('Page initialization error:', error)
    if (onError) {
      onError(error)
    }
  }
}

/**
 * Update UI elements with user information
 * @param {object} user - User object
 */
function updateUserUI(user) {
  // Update user name displays
  const userNameEls = document.querySelectorAll('[data-user-name]')
  userNameEls.forEach(el => {
    el.textContent = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'
  })

  // Update user email displays
  const userEmailEls = document.querySelectorAll('[data-user-email]')
  userEmailEls.forEach(el => {
    el.textContent = user.email || ''
  })

  // Update user avatar displays
  const userAvatarEls = document.querySelectorAll('[data-user-avatar]')
  userAvatarEls.forEach(el => {
    const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'U'
    el.textContent = name.charAt(0).toUpperCase()
  })
}

// ===========================================
// EXPORT FOR MODULE USAGE (if needed)
// ===========================================
window.OutreachApp = {
  supabase,
  BACKEND_URL,
  setBackendUrl,
  getCurrentUser,
  requireAuth,
  signOut,
  onAuthStateChange,
  getCompanyMembership,
  createCompanyForUser,
  clearCompanyCache,
  hasRole,
  showLoading,
  showError,
  showEmpty,
  escapeHtml,
  formatDate,
  formatDateTime,
  formatCurrency,
  formatPhone,
  timeAgo,
  getFormData,
  setFormDisabled,
  initPage,
  updateUserUI
}
