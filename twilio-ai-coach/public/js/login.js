/**
 * Login Page JavaScript
 *
 * Handles:
 * - User authentication with Supabase
 * - Login form submission
 * - Signup form submission
 * - Password reset requests
 * - Redirect if already authenticated
 */

// ===========================================
// INITIALIZATION
// ===========================================

document.addEventListener('DOMContentLoaded', async () => {
  // Check if user is already logged in
  await checkExistingAuth()

  // Set up event listeners
  setupEventListeners()
})

/**
 * Check if user is already authenticated and redirect to dashboard
 */
async function checkExistingAuth() {
  try {
    const { user, error } = await getCurrentUser()

    if (user && !error) {
      // User is already logged in, redirect to dashboard
      window.location.href = 'dashboard.html'
    }
  } catch (err) {
    // Not logged in, stay on login page
    console.log('No existing session')
  }
}

// ===========================================
// EVENT LISTENERS
// ===========================================

function setupEventListeners() {
  // Login form
  const loginForm = document.getElementById('login-form')
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin)
  }

  // Signup form
  const signupForm = document.getElementById('signup-form')
  if (signupForm) {
    signupForm.addEventListener('submit', handleSignup)
  }

  // Toggle between login and signup
  const showSignupLink = document.getElementById('show-signup')
  if (showSignupLink) {
    showSignupLink.addEventListener('click', (e) => {
      e.preventDefault()
      toggleForms('signup')
    })
  }

  const showLoginLink = document.getElementById('show-login')
  if (showLoginLink) {
    showLoginLink.addEventListener('click', (e) => {
      e.preventDefault()
      toggleForms('login')
    })
  }

  // Forgot password link
  const forgotPasswordLink = document.getElementById('forgot-password')
  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', (e) => {
      e.preventDefault()
      handleForgotPassword()
    })
  }
}

// ===========================================
// AUTHENTICATION HANDLERS
// ===========================================

/**
 * Handle login form submission
 */
async function handleLogin(e) {
  e.preventDefault()

  const form = e.target
  const submitBtn = form.querySelector('button[type="submit"]')
  const email = document.getElementById('login-email').value.trim()
  const password = document.getElementById('login-password').value

  // Clear previous errors
  clearError('login-error')

  // Validate inputs
  if (!email) {
    showFormError('login-error', 'Please enter your email address')
    return
  }

  if (!password) {
    showFormError('login-error', 'Please enter your password')
    return
  }

  // Disable form during submission
  setFormLoading(form, submitBtn, true, 'Signing in...')

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      showFormError('login-error', getAuthErrorMessage(error))
      setFormLoading(form, submitBtn, false, 'Sign In')
      return
    }

    // Check if user has company membership, create if not
    if (data.user) {
      await ensureCompanyMembership(data.user)
    }

    // Success - redirect to dashboard
    window.location.href = 'dashboard.html'

  } catch (err) {
    console.error('Login error:', err)
    showFormError('login-error', 'An unexpected error occurred. Please try again.')
    setFormLoading(form, submitBtn, false, 'Sign In')
  }
}

/**
 * Ensure user has a company membership, create one if not
 */
async function ensureCompanyMembership(user) {
  try {
    // Check if user already has a company membership
    const { data: membership, error } = await supabase
      .from('company_members')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    // If membership exists, we're good
    if (membership) {
      return
    }

    // No membership - create company for user
    const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'
    await createCompanyForNewUser(user, userName)

  } catch (err) {
    console.error('Error checking company membership:', err)
  }
}

/**
 * Handle signup form submission
 */
async function handleSignup(e) {
  e.preventDefault()

  const form = e.target
  const submitBtn = form.querySelector('button[type="submit"]')
  const fullName = document.getElementById('signup-name')?.value.trim() || ''
  const email = document.getElementById('signup-email').value.trim()
  const password = document.getElementById('signup-password').value
  const confirmPassword = document.getElementById('signup-confirm-password')?.value || password

  // Clear previous errors
  clearError('signup-error')

  // Validate inputs
  if (!email) {
    showFormError('signup-error', 'Please enter your email address')
    return
  }

  if (!password) {
    showFormError('signup-error', 'Please enter a password')
    return
  }

  if (password.length < 6) {
    showFormError('signup-error', 'Password must be at least 6 characters')
    return
  }

  if (confirmPassword && password !== confirmPassword) {
    showFormError('signup-error', 'Passwords do not match')
    return
  }

  // Disable form during submission
  setFormLoading(form, submitBtn, true, 'Creating account...')

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName
        }
      }
    })

    if (error) {
      showFormError('signup-error', getAuthErrorMessage(error))
      setFormLoading(form, submitBtn, false, 'Create Account')
      return
    }

    // Check if email confirmation is required
    if (data.user && !data.session) {
      // Email confirmation required
      showFormSuccess('signup-error', 'Please check your email to confirm your account.')
      setFormLoading(form, submitBtn, false, 'Create Account')
    } else if (data.user && data.session) {
      // Direct signup (no confirmation needed) - create company and membership
      await createCompanyForNewUser(data.user, fullName || email.split('@')[0])
      window.location.href = 'dashboard.html'
    }

  } catch (err) {
    console.error('Signup error:', err)
    showFormError('signup-error', 'An unexpected error occurred. Please try again.')
    setFormLoading(form, submitBtn, false, 'Create Account')
  }
}

/**
 * Create a company and membership for a new user
 */
async function createCompanyForNewUser(user, userName) {
  try {
    // Create a new company for the user
    const companyName = `${userName}'s Company`

    const { data: company, error: companyError } = await supabase
      .from('companies')
      .insert({
        name: companyName,
        created_by: user.id
      })
      .select()
      .single()

    if (companyError) {
      console.error('Error creating company:', companyError)
      // Continue anyway - user can set up company later
      return
    }

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
    }

  } catch (err) {
    console.error('Error setting up company:', err)
    // Don't block signup - user can set up company later
  }
}

/**
 * Handle forgot password request
 */
async function handleForgotPassword() {
  const email = document.getElementById('login-email')?.value.trim()

  if (!email) {
    showFormError('login-error', 'Please enter your email address first')
    return
  }

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password.html`
    })

    if (error) {
      showFormError('login-error', getAuthErrorMessage(error))
      return
    }

    showFormSuccess('login-error', 'Password reset email sent. Please check your inbox.')

  } catch (err) {
    console.error('Password reset error:', err)
    showFormError('login-error', 'Failed to send reset email. Please try again.')
  }
}

// ===========================================
// UI HELPERS
// ===========================================

/**
 * Toggle between login and signup forms
 */
function toggleForms(showForm) {
  const loginFormContainer = document.getElementById('login-form-container')
  const signupFormContainer = document.getElementById('signup-form-container')

  if (showForm === 'signup') {
    if (loginFormContainer) loginFormContainer.style.display = 'none'
    if (signupFormContainer) signupFormContainer.style.display = 'block'
  } else {
    if (loginFormContainer) loginFormContainer.style.display = 'block'
    if (signupFormContainer) signupFormContainer.style.display = 'none'
  }

  // Clear any errors when switching forms
  clearError('login-error')
  clearError('signup-error')
}

/**
 * Show error message in form
 */
function showFormError(elementId, message) {
  const errorEl = document.getElementById(elementId)
  if (errorEl) {
    errorEl.textContent = message
    errorEl.className = 'form-message error'
    errorEl.style.display = 'block'
  }
}

/**
 * Show success message in form
 */
function showFormSuccess(elementId, message) {
  const errorEl = document.getElementById(elementId)
  if (errorEl) {
    errorEl.textContent = message
    errorEl.className = 'form-message success'
    errorEl.style.display = 'block'
  }
}

/**
 * Clear error message
 */
function clearError(elementId) {
  const errorEl = document.getElementById(elementId)
  if (errorEl) {
    errorEl.textContent = ''
    errorEl.style.display = 'none'
  }
}

/**
 * Set form loading state
 */
function setFormLoading(form, submitBtn, isLoading, buttonText) {
  const inputs = form.querySelectorAll('input, button')
  inputs.forEach(input => {
    input.disabled = isLoading
  })

  if (submitBtn) {
    submitBtn.textContent = buttonText
  }
}

/**
 * Get user-friendly error message from Supabase auth error
 */
function getAuthErrorMessage(error) {
  const errorMessages = {
    'Invalid login credentials': 'Invalid email or password. Please try again.',
    'Email not confirmed': 'Please confirm your email address before signing in.',
    'User already registered': 'An account with this email already exists.',
    'Password should be at least 6 characters': 'Password must be at least 6 characters.',
    'Unable to validate email address: invalid format': 'Please enter a valid email address.',
    'Signup requires a valid password': 'Please enter a valid password.',
    'Email rate limit exceeded': 'Too many attempts. Please try again later.',
    'For security purposes, you can only request this once every 60 seconds': 'Please wait before requesting another reset email.'
  }

  // Check for known error messages
  for (const [key, value] of Object.entries(errorMessages)) {
    if (error.message?.includes(key)) {
      return value
    }
  }

  // Return the original message or a generic one
  return error.message || 'An error occurred. Please try again.'
}
