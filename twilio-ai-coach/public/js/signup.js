/**
 * Signup Page JavaScript
 *
 * Handles:
 * - User registration with Supabase
 * - Form validation (email format, password match)
 * - Success/error message display
 * - Redirect to dashboard on success
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
    // Not logged in, stay on signup page
    console.log('No existing session')
  }
}

// ===========================================
// EVENT LISTENERS
// ===========================================

function setupEventListeners() {
  // Signup form
  const signupForm = document.getElementById('signup-form')
  if (signupForm) {
    signupForm.addEventListener('submit', handleSignup)
  }

  // Real-time validation
  const emailInput = document.getElementById('signup-email')
  if (emailInput) {
    emailInput.addEventListener('blur', validateEmailField)
  }

  const passwordInput = document.getElementById('signup-password')
  if (passwordInput) {
    passwordInput.addEventListener('blur', validatePasswordField)
  }

  const confirmPasswordInput = document.getElementById('signup-confirm-password')
  if (confirmPasswordInput) {
    confirmPasswordInput.addEventListener('blur', validateConfirmPasswordField)
  }
}

// ===========================================
// VALIDATION
// ===========================================

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean}
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Validate email field on blur
 */
function validateEmailField() {
  const email = document.getElementById('signup-email').value.trim()
  const errorEl = document.getElementById('email-error')
  const inputEl = document.getElementById('signup-email')

  if (!email) {
    showFieldError(inputEl, errorEl, 'Email is required')
    return false
  }

  if (!isValidEmail(email)) {
    showFieldError(inputEl, errorEl, 'Please enter a valid email address')
    return false
  }

  clearFieldError(inputEl, errorEl)
  return true
}

/**
 * Validate password field on blur
 */
function validatePasswordField() {
  const password = document.getElementById('signup-password').value
  const errorEl = document.getElementById('password-error')
  const inputEl = document.getElementById('signup-password')

  if (!password) {
    showFieldError(inputEl, errorEl, 'Password is required')
    return false
  }

  if (password.length < 6) {
    showFieldError(inputEl, errorEl, 'Password must be at least 6 characters')
    return false
  }

  clearFieldError(inputEl, errorEl)

  // Also validate confirm password if it has a value
  const confirmPassword = document.getElementById('signup-confirm-password').value
  if (confirmPassword) {
    validateConfirmPasswordField()
  }

  return true
}

/**
 * Validate confirm password field on blur
 */
function validateConfirmPasswordField() {
  const password = document.getElementById('signup-password').value
  const confirmPassword = document.getElementById('signup-confirm-password').value
  const errorEl = document.getElementById('confirm-password-error')
  const inputEl = document.getElementById('signup-confirm-password')

  if (!confirmPassword) {
    showFieldError(inputEl, errorEl, 'Please confirm your password')
    return false
  }

  if (password !== confirmPassword) {
    showFieldError(inputEl, errorEl, 'Passwords do not match')
    return false
  }

  clearFieldError(inputEl, errorEl)
  return true
}

/**
 * Validate all form fields
 * @returns {boolean}
 */
function validateForm() {
  const emailValid = validateEmailField()
  const passwordValid = validatePasswordField()
  const confirmPasswordValid = validateConfirmPasswordField()

  return emailValid && passwordValid && confirmPasswordValid
}

// ===========================================
// SIGNUP HANDLER
// ===========================================

/**
 * Handle signup form submission
 */
async function handleSignup(e) {
  e.preventDefault()

  const form = e.target
  const submitBtn = document.getElementById('submit-btn')
  const fullName = document.getElementById('signup-name').value.trim()
  const email = document.getElementById('signup-email').value.trim()
  const password = document.getElementById('signup-password').value

  // Clear previous messages
  clearMessage()

  // Validate all fields
  if (!validateForm()) {
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
      showMessage(getAuthErrorMessage(error), 'error')
      setFormLoading(form, submitBtn, false, 'Create Account')
      return
    }

    // Check if email confirmation is required
    if (data.user && !data.session) {
      // Email confirmation required
      showMessage('Account created! Please check your email to confirm your account.', 'success')
      setFormLoading(form, submitBtn, false, 'Create Account')
    } else {
      // Direct signup (no confirmation needed) - redirect to dashboard
      showMessage('Account created successfully! Redirecting...', 'success')
      setTimeout(() => {
        window.location.href = 'dashboard.html'
      }, 1000)
    }

  } catch (err) {
    console.error('Signup error:', err)
    console.error('Error details:', JSON.stringify(err, null, 2))
    showMessage(`Error: ${err.message || err}`, 'error')
    setFormLoading(form, submitBtn, false, 'Create Account')
  }
}

// ===========================================
// UI HELPERS
// ===========================================

/**
 * Show field-level error
 */
function showFieldError(inputEl, errorEl, message) {
  if (inputEl) {
    inputEl.classList.add('error')
  }
  if (errorEl) {
    errorEl.textContent = message
    errorEl.style.display = 'block'
  }
}

/**
 * Clear field-level error
 */
function clearFieldError(inputEl, errorEl) {
  if (inputEl) {
    inputEl.classList.remove('error')
  }
  if (errorEl) {
    errorEl.textContent = ''
    errorEl.style.display = 'none'
  }
}

/**
 * Show form message (error or success)
 */
function showMessage(message, type) {
  const messageEl = document.getElementById('signup-message')
  if (messageEl) {
    messageEl.textContent = message
    messageEl.className = `form-message ${type}`
    messageEl.style.display = 'block'
  }
}

/**
 * Clear form message
 */
function clearMessage() {
  const messageEl = document.getElementById('signup-message')
  if (messageEl) {
    messageEl.textContent = ''
    messageEl.style.display = 'none'
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
    'User already registered': 'An account with this email already exists. Please sign in instead.',
    'Password should be at least 6 characters': 'Password must be at least 6 characters.',
    'Unable to validate email address: invalid format': 'Please enter a valid email address.',
    'Signup requires a valid password': 'Please enter a valid password.',
    'Email rate limit exceeded': 'Too many attempts. Please try again later.',
    'Signups not allowed for this instance': 'Signups are currently disabled. Please contact support.'
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
