/**
 * SMS Messaging - Real-time SMS conversation management
 *
 * Features:
 * - Load and display conversations
 * - Real-time message updates via Supabase
 * - Send messages
 * - Start new conversations
 * - Mark messages as read
 *
 * Database tables:
 * - sms_conversations
 * - sms_messages
 * - contacts
 */

// ===========================================
// STATE
// ===========================================
const smsState = {
  conversations: [],
  messages: [],
  currentConversationId: null,
  currentContact: null,
  companyId: null,
  subscription: null,
  conversationsSubscription: null
}

// Rate limiting for message send to prevent billing abuse
let lastSendTime = 0
const SEND_COOLDOWN = 1000 // 1 second between messages

// ===========================================
// INITIALIZATION
// ===========================================

document.addEventListener('DOMContentLoaded', () => {
  initPage({
    requireAuth: true,
    onReady: async (user) => {
      // Update user display
      if (user) {
        const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'
        const userNameEl = document.getElementById('userName')
        const userAvatarEl = document.getElementById('userAvatar')
        if (userNameEl) userNameEl.textContent = name
        if (userAvatarEl) userAvatarEl.textContent = name.charAt(0).toUpperCase()
      }

      // Get company membership
      const { companyId, error } = await getCompanyMembership()
      if (error || !companyId) {
        showError('#conversationsList', 'Unable to load conversations')
        console.error('No company membership:', error)
        return
      }

      smsState.companyId = companyId

      // Load conversations
      await loadConversations(companyId)

      // Set up event listeners
      setupEventListeners()

      // Subscribe to conversation updates
      subscribeToConversations(companyId)
    },
    onError: (error) => {
      console.error('SMS page init error:', error)
      showError('#conversationsList', 'Failed to initialize')
    }
  })
})

// ===========================================
// DATA LOADING
// ===========================================

/**
 * Load all conversations for the company
 * @param {string} companyId
 */
async function loadConversations(companyId) {
  showLoading('#conversationsList', 'Loading conversations...')

  const { data, error } = await supabase
    .from('sms_conversations')
    .select(`
      id,
      phone_number,
      status,
      unread_count,
      last_message_at,
      last_message_preview,
      contact:contacts(id, first_name, last_name, phone, email, business_name)
    `)
    .eq('company_id', companyId)
    .order('last_message_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('Error loading conversations:', error)
    showError('#conversationsList', 'Failed to load conversations')
    return
  }

  smsState.conversations = data || []
  renderConversationList(smsState.conversations)

  // Update sidebar badge
  updateUnreadBadge()

  // Select first conversation if none selected
  if (smsState.conversations.length > 0 && !smsState.currentConversationId) {
    await handleSelectConversation(smsState.conversations[0].id)
  } else if (smsState.conversations.length === 0) {
    showEmpty('#messagesContainer', 'No conversations yet', '💬')
  }
}

/**
 * Load messages for a specific conversation
 * @param {string} conversationId
 */
async function loadMessages(conversationId) {
  // Validate input
  if (!conversationId || !smsState.companyId) return

  // Security: Verify conversation belongs to this company
  const conversation = smsState.conversations.find(c => c.id === conversationId)
  if (!conversation) {
    showError('#messagesContainer', 'Conversation not found')
    return
  }

  showLoading('#messagesContainer', 'Loading messages...')

  const { data, error } = await supabase
    .from('sms_messages')
    .select('id, direction, body, status, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(100)

  if (error) {
    console.error('Error loading messages:', error)
    showError('#messagesContainer', 'Failed to load messages')
    return
  }

  smsState.messages = data || []
  renderMessages(smsState.messages)

  // Mark messages as read
  await markMessagesAsRead(conversationId)

  // Subscribe to new messages
  subscribeToMessages(conversationId)
}

// ===========================================
// RENDERING
// ===========================================

/**
 * Render the conversation list
 * @param {Array} conversations
 */
function renderConversationList(conversations) {
  const container = document.getElementById('conversationsList')
  if (!container) return

  if (!conversations || conversations.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 2rem; text-align: center;">
        <div style="font-size: 2rem; margin-bottom: 0.5rem;">💬</div>
        <div style="color: var(--gray-500);">No conversations yet</div>
        <button class="btn btn-primary btn-sm" style="margin-top: 1rem;" onclick="newMessage()">
          Start a conversation
        </button>
      </div>
    `
    return
  }

  container.innerHTML = conversations.map(conv => {
    const contact = Array.isArray(conv.contact) ? conv.contact[0] : conv.contact
    const name = contact
      ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || contact.business_name || 'Unknown'
      : formatPhone(conv.phone_number)
    const initials = getInitials(name)
    const isActive = conv.id === smsState.currentConversationId
    const hasUnread = conv.unread_count > 0

    return `
      <div class="conversation-item ${isActive ? 'active' : ''} ${hasUnread ? 'unread' : ''}"
           onclick="handleSelectConversation('${conv.id}')"
           data-conversation-id="${conv.id}">
        <div class="conversation-avatar">
          ${escapeHtml(initials)}
          ${hasUnread ? '<div class="unread-dot"></div>' : ''}
        </div>
        <div class="conversation-content">
          <div class="conversation-name">${escapeHtml(name)}</div>
          <div class="conversation-preview">${escapeHtml(conv.last_message_preview || 'No messages')}</div>
        </div>
        <div class="conversation-meta">
          <div class="conversation-time">${timeAgo(conv.last_message_at)}</div>
          ${hasUnread ? `<div class="conversation-badge">${conv.unread_count}</div>` : ''}
        </div>
      </div>
    `
  }).join('')
}

/**
 * Render messages in the chat view
 * @param {Array} messages
 */
function renderMessages(messages) {
  const container = document.getElementById('messagesContainer')
  if (!container) return

  if (!messages || messages.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 2rem; text-align: center; margin: auto;">
        <div style="font-size: 2rem; margin-bottom: 0.5rem;">💬</div>
        <div style="color: var(--gray-500);">No messages yet</div>
        <div style="color: var(--gray-400); font-size: 0.875rem;">Send a message to start the conversation</div>
      </div>
    `
    return
  }

  // Group messages by date
  const groupedMessages = groupMessagesByDate(messages)

  let html = ''
  for (const [date, msgs] of Object.entries(groupedMessages)) {
    html += `<div class="message-date">${date}</div>`
    html += msgs.map(msg => {
      const direction = msg.direction === 'outbound' ? 'outbound' : 'inbound'
      const time = formatMessageTime(msg.created_at)
      const statusHtml = direction === 'outbound' && msg.status
        ? `<div class="message-status">${escapeHtml(capitalizeFirst(msg.status))}</div>`
        : ''

      return `
        <div class="message ${direction}" data-message-id="${msg.id}">
          ${escapeHtml(msg.body)}
          <div class="message-time">${time}</div>
          ${statusHtml}
        </div>
      `
    }).join('')
  }

  container.innerHTML = html
  scrollToBottom()
}

/**
 * Update the chat header with contact info
 * @param {object} conversation
 */
function updateChatHeader(conversation) {
  const contact = Array.isArray(conversation.contact) ? conversation.contact[0] : conversation.contact
  const name = contact
    ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || contact.business_name || 'Unknown'
    : formatPhone(conversation.phone_number)
  const initials = getInitials(name)
  const phone = formatPhone(conversation.phone_number)

  // Chat header
  const chatAvatar = document.getElementById('chatAvatar')
  const chatName = document.getElementById('chatName')
  const chatPhone = document.getElementById('chatPhone')

  if (chatAvatar) chatAvatar.textContent = initials
  if (chatName) chatName.textContent = name
  if (chatPhone) chatPhone.textContent = phone

  // Contact panel
  const contactAvatar = document.getElementById('contactAvatar')
  const contactName = document.getElementById('contactName')
  const contactPhone = document.getElementById('contactPhone')
  const contactCompany = document.getElementById('contactCompany')
  const contactEmail = document.getElementById('contactEmail')
  const contactSource = document.getElementById('contactSource')
  const contactStatus = document.getElementById('contactStatus')

  if (contactAvatar) contactAvatar.textContent = initials
  if (contactName) contactName.textContent = name
  if (contactPhone) contactPhone.textContent = phone
  if (contact) {
    if (contactCompany) contactCompany.textContent = contact.business_name || '-'
    if (contactEmail) contactEmail.textContent = contact.email || '-'
    if (contactSource) contactSource.textContent = '-'
    if (contactStatus) contactStatus.textContent = '-'
  }

  // Update call and profile links
  const callLink = document.querySelector('.chat-actions a[href*="call.html"]')
  const profileLink = document.querySelector('.chat-actions a[href*="contact-profile.html"]')

  if (callLink) {
    callLink.href = `call.html?number=${encodeURIComponent(conversation.phone_number)}`
  }
  if (profileLink && contact) {
    profileLink.href = `contact-profile.html?id=${contact.id}`
  }

  smsState.currentContact = contact
}

// ===========================================
// EVENT HANDLERS
// ===========================================

/**
 * Set up event listeners
 */
function setupEventListeners() {
  // Message input
  const messageInput = document.getElementById('messageInput')
  if (messageInput) {
    messageInput.addEventListener('keydown', handleKeyDown)
    messageInput.addEventListener('input', handleInputChange)
  }

  // Send button
  const sendBtn = document.getElementById('sendBtn')
  if (sendBtn) {
    sendBtn.addEventListener('click', handleSendMessage)
  }

  // Search input
  const searchInput = document.querySelector('.search-input')
  if (searchInput) {
    searchInput.addEventListener('input', debounce(handleSearch, 300))
  }

  // New message button
  const newMsgBtn = document.querySelector('.new-message-btn')
  if (newMsgBtn) {
    newMsgBtn.addEventListener('click', newMessage)
  }
}

/**
 * Handle conversation selection
 * @param {string} conversationId
 */
async function handleSelectConversation(conversationId) {
  // Validate input (Ralph Wiggum pattern)
  if (!conversationId || typeof conversationId !== 'string') return
  if (conversationId === smsState.currentConversationId) return

  // Security: Verify conversation exists in our loaded list (which is company-filtered)
  const conversation = smsState.conversations.find(c => c.id === conversationId)
  if (!conversation) {
    console.error('Conversation not found:', conversationId)
    return
  }

  // Unsubscribe from previous conversation
  unsubscribeFromMessages()

  smsState.currentConversationId = conversationId

  // Update header with conversation data
  updateChatHeader(conversation)

  // Update active state in list
  document.querySelectorAll('.conversation-item').forEach(el => {
    el.classList.toggle('active', el.dataset.conversationId === conversationId)
  })

  // Load messages
  await loadMessages(conversationId)

  // Hide list on mobile
  const smsLayout = document.getElementById('smsLayout')
  if (smsLayout) {
    smsLayout.classList.remove('show-list')
  }
}

/**
 * Handle sending a message
 */
async function handleSendMessage() {
  const input = document.getElementById('messageInput')
  const text = input?.value?.trim()

  // Validate required state
  if (!text || !smsState.currentConversationId || !smsState.companyId) return

  // Rate limiting to prevent billing abuse
  const now = Date.now()
  if (now - lastSendTime < SEND_COOLDOWN) {
    alert('Please wait before sending another message')
    return
  }
  lastSendTime = now

  // Validate message length (SMS limit)
  if (text.length > 1600) {
    alert('Message is too long. Maximum 1600 characters.')
    return
  }

  // Security: Verify conversation belongs to this company
  const conversation = smsState.conversations.find(c => c.id === smsState.currentConversationId)
  if (!conversation) {
    alert('Conversation not found. Please refresh the page.')
    return
  }

  // Disable send button
  const sendBtn = document.getElementById('sendBtn')
  if (sendBtn) sendBtn.disabled = true

  // Clear input immediately for better UX
  input.value = ''

  // Optimistic update - add message to UI
  const tempId = 'temp-' + Date.now()
  const tempMessage = {
    id: tempId,
    direction: 'outbound',
    body: text,
    status: 'sending',
    created_at: new Date().toISOString()
  }
  smsState.messages.push(tempMessage)
  renderMessages(smsState.messages)

  try {
    // First send via Twilio API to get the from_number
    const response = await fetch(BACKEND_URL + '/api/sms/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: conversation.phone_number,
        body: text,
        conversationId: smsState.currentConversationId
      })
    })

    const result = await response.json()

    if (!result.success) {
      throw new Error(result.error || 'Failed to send SMS')
    }

    // Now save to database
    const { data: dbMessage, error: dbError } = await supabase
      .from('sms_messages')
      .insert({
        conversation_id: smsState.currentConversationId,
        company_id: smsState.companyId,
        direction: 'outbound',
        from_number: result.fromNumber,
        to_number: conversation.phone_number,
        body: text,
        status: result.status || 'sent',
        twilio_sid: result.messageSid,
        sent_at: new Date().toISOString()
      })
      .select()
      .single()

    if (dbError) {
      console.error('Failed to save message to database:', dbError)
      alert('Message sent but failed to save: ' + dbError.message)
    }

    // Replace temp message with real one
    const tempIndex = smsState.messages.findIndex(m => m.id === tempId)
    if (tempIndex >= 0) {
      smsState.messages[tempIndex] = {
        id: dbMessage?.id || tempId,
        direction: 'outbound',
        body: text,
        status: result.status || 'sent',
        created_at: new Date().toISOString()
      }
      renderMessages(smsState.messages)
    }

    // Update conversation preview
    updateConversationPreview(smsState.currentConversationId, text)

  } catch (error) {
    console.error('Error sending message:', error)
    // Remove temp message and show error
    smsState.messages = smsState.messages.filter(m => m.id !== tempId)
    renderMessages(smsState.messages)
    alert('Failed to send message. Please try again.')
    input.value = text // Restore message
  }

  // Re-enable send button
  if (sendBtn) sendBtn.disabled = false
}

/**
 * Handle starting a new conversation
 * @param {string} phone
 * @param {string} message
 */
async function handleStartNewConversation(phone, message) {
  // Validate phone number (Ralph Wiggum validation)
  if (!phone || typeof phone !== 'string') {
    alert('Please enter a phone number')
    return
  }

  const cleanedPhone = phone.replace(/\D/g, '')
  if (cleanedPhone.length < 10 || cleanedPhone.length > 15) {
    alert('Please enter a valid phone number')
    return
  }

  // Format phone with country code
  const formattedPhone = cleanedPhone.length === 10
    ? '+1' + cleanedPhone
    : '+' + cleanedPhone

  // Check if conversation exists
  const existing = smsState.conversations.find(c =>
    c.phone_number.replace(/\D/g, '') === cleanedPhone
  )

  if (existing) {
    await handleSelectConversation(existing.id)
    if (message) {
      document.getElementById('messageInput').value = message
    }
    return
  }

  // Create new conversation
  const { data, error } = await supabase
    .from('sms_conversations')
    .insert({
      company_id: smsState.companyId,
      phone_number: formattedPhone,
      status: 'active'
    })
    .select(`
      id,
      phone_number,
      status,
      unread_count,
      last_message_at,
      last_message_preview,
      contact:contacts(id, first_name, last_name, phone, email, business_name)
    `)
    .single()

  if (error) {
    console.error('Error creating conversation:', error)
    alert('Failed to create conversation')
    return
  }

  // Add to list and select
  smsState.conversations.unshift(data)
  renderConversationList(smsState.conversations)
  await handleSelectConversation(data.id)

  // Send initial message if provided
  if (message) {
    document.getElementById('messageInput').value = message
    await handleSendMessage()
  }
}

/**
 * Handle keyboard input
 * @param {KeyboardEvent} event
 */
function handleKeyDown(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    handleSendMessage()
  }
}

/**
 * Handle input change (for send button state)
 */
function handleInputChange() {
  const input = document.getElementById('messageInput')
  const sendBtn = document.getElementById('sendBtn')
  if (input && sendBtn) {
    sendBtn.disabled = !input.value.trim()
  }
}

/**
 * Handle search input
 * @param {Event} event
 */
function handleSearch(event) {
  const query = event.target.value.toLowerCase().trim()

  if (!query) {
    renderConversationList(smsState.conversations)
    return
  }

  const filtered = smsState.conversations.filter(conv => {
    const contact = Array.isArray(conv.contact) ? conv.contact[0] : conv.contact
    const name = contact
      ? `${contact.first_name || ''} ${contact.last_name || ''}`.toLowerCase()
      : ''
    const phone = conv.phone_number.replace(/\D/g, '')
    const preview = (conv.last_message_preview || '').toLowerCase()

    return name.includes(query) || phone.includes(query) || preview.includes(query)
  })

  renderConversationList(filtered)
}

// ===========================================
// REAL-TIME SUBSCRIPTIONS
// ===========================================

/**
 * Subscribe to new messages in current conversation
 * @param {string} conversationId
 */
function subscribeToMessages(conversationId) {
  // Unsubscribe from previous
  unsubscribeFromMessages()

  smsState.subscription = supabase
    .channel(`sms-messages-${conversationId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'sms_messages',
      filter: `conversation_id=eq.${conversationId}`
    }, (payload) => {
      handleNewMessage(payload.new)
    })
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'sms_messages',
      filter: `conversation_id=eq.${conversationId}`
    }, (payload) => {
      handleMessageUpdate(payload.new)
    })
    .subscribe()
}

/**
 * Unsubscribe from message updates
 */
function unsubscribeFromMessages() {
  if (smsState.subscription) {
    supabase.removeChannel(smsState.subscription)
    smsState.subscription = null
  }
}

/**
 * Subscribe to conversation list updates
 * @param {string} companyId
 */
function subscribeToConversations(companyId) {
  smsState.conversationsSubscription = supabase
    .channel(`sms-conversations-${companyId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'sms_conversations',
      filter: `company_id=eq.${companyId}`
    }, async () => {
      // Reload conversations list
      await loadConversations(companyId)
    })
    .subscribe()
}

/**
 * Handle new message from real-time subscription
 * @param {object} message
 */
function handleNewMessage(message) {
  // Avoid duplicates
  if (smsState.messages.some(m => m.id === message.id)) return

  // Only add to messages if it's for the currently selected conversation
  if (message.conversation_id === smsState.currentConversationId) {
    // Add to messages
    smsState.messages.push(message)
    renderMessages(smsState.messages)

    // Mark as read if inbound (since we're viewing this conversation)
    if (message.direction === 'inbound') {
      markMessagesAsRead(smsState.currentConversationId)
    }
  } else {
    // Message is for a different conversation - update unread count
    const conv = smsState.conversations.find(c => c.id === message.conversation_id)
    if (conv && message.direction === 'inbound') {
      conv.unread_count = (conv.unread_count || 0) + 1
      updateUnreadBadge()
    }
  }

  // Update conversation preview
  updateConversationPreview(message.conversation_id, message.body)
}

/**
 * Handle message update (e.g., status change)
 * @param {object} message
 */
function handleMessageUpdate(message) {
  const index = smsState.messages.findIndex(m => m.id === message.id)
  if (index >= 0) {
    smsState.messages[index] = message
    renderMessages(smsState.messages)
  }
}

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Mark messages as read in a conversation
 * @param {string} conversationId
 */
async function markMessagesAsRead(conversationId) {
  if (!conversationId || !smsState.companyId) return

  // Security: Filter by company_id to ensure ownership
  // Update unread count in conversation
  await supabase
    .from('sms_conversations')
    .update({ unread_count: 0 })
    .eq('id', conversationId)
    .eq('company_id', smsState.companyId)

  // Note: read_at column may not exist in all setups
  // The unread_count on conversations is the primary tracking mechanism

  // Update local state
  const conv = smsState.conversations.find(c => c.id === conversationId)
  if (conv) {
    conv.unread_count = 0
    renderConversationList(smsState.conversations)
    updateUnreadBadge()
  }
}

/**
 * Update conversation preview after sending/receiving message
 * @param {string} conversationId
 * @param {string} preview
 */
function updateConversationPreview(conversationId, preview) {
  const conv = smsState.conversations.find(c => c.id === conversationId)
  if (conv) {
    conv.last_message_preview = preview?.substring(0, 100)
    conv.last_message_at = new Date().toISOString()

    // Move to top
    smsState.conversations = [
      conv,
      ...smsState.conversations.filter(c => c.id !== conversationId)
    ]
    renderConversationList(smsState.conversations)
  }
}

/**
 * Update sidebar unread badge
 */
function updateUnreadBadge() {
  const total = smsState.conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0)
  const badge = document.getElementById('smsBadge')
  if (badge) {
    if (total > 0) {
      badge.textContent = total > 99 ? '99+' : total
      badge.style.display = 'inline'
    } else {
      badge.style.display = 'none'
    }
  }
}

/**
 * Scroll messages container to bottom
 */
function scrollToBottom() {
  const container = document.getElementById('messagesContainer')
  if (container) {
    container.scrollTop = container.scrollHeight
  }
}

/**
 * Group messages by date
 * @param {Array} messages
 * @returns {object}
 */
function groupMessagesByDate(messages) {
  const groups = {}
  const today = new Date().toDateString()
  const yesterday = new Date(Date.now() - 86400000).toDateString()

  messages.forEach(msg => {
    const date = new Date(msg.created_at).toDateString()
    let label = formatDate(msg.created_at)

    if (date === today) label = 'Today'
    else if (date === yesterday) label = 'Yesterday'

    if (!groups[label]) groups[label] = []
    groups[label].push(msg)
  })

  return groups
}

/**
 * Format message time
 * @param {string} dateStr
 * @returns {string}
 */
function formatMessageTime(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

/**
 * Get initials from name
 * @param {string} name
 * @returns {string}
 */
function getInitials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}

/**
 * Capitalize first letter
 * @param {string} str
 * @returns {string}
 */
function capitalizeFirst(str) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

/**
 * Debounce function
 * @param {Function} func
 * @param {number} wait
 * @returns {Function}
 */
function debounce(func, wait) {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

// ===========================================
// TEMPLATE FUNCTIONS
// ===========================================

const messageTemplates = {
  'follow-up': 'Hi! Just following up on our previous conversation. Do you have any questions I can help with?',
  'meeting': 'Great chatting with you! Just confirming our meeting scheduled for [DATE/TIME]. Looking forward to it!',
  'thanks': 'Thank you so much! Please let me know if you need anything else.',
  'pricing': "I'd be happy to share our pricing information. Our packages start at $X/month. Would you like me to send over a detailed breakdown?"
}

/**
 * Insert a message template
 * @param {string} templateKey
 */
function useTemplate(templateKey) {
  const template = messageTemplates[templateKey]
  if (template) {
    const input = document.getElementById('messageInput')
    if (input) {
      input.value = template
      input.focus()
      handleInputChange()
    }
  }
}

/**
 * Show templates modal (placeholder)
 */
function showTemplates() {
  alert('Template library - coming soon!')
}

// ===========================================
// NEW MESSAGE MODAL
// ===========================================

// Modal state
let modalState = {
  selectedContact: null,
  contacts: [],
  searchTimeout: null
}

/**
 * Open new message modal
 */
function newMessage() {
  const modal = document.getElementById('newMessageModal')
  if (modal) {
    modal.style.display = 'flex'
    // Reset state
    modalState.selectedContact = null
    document.getElementById('newMessageSearch').value = ''
    document.getElementById('newPhoneNumber').value = ''
    document.getElementById('contactSearchResults').style.display = 'none'
    document.getElementById('selectedContactDisplay').style.display = 'none'
    document.getElementById('startConversationBtn').disabled = true
    // Focus search input
    setTimeout(() => document.getElementById('newMessageSearch').focus(), 100)
    // Load contacts if not loaded
    if (modalState.contacts.length === 0) {
      loadContactsForSearch()
    }
  }
}

/**
 * Close new message modal
 */
function closeNewMessageModal() {
  const modal = document.getElementById('newMessageModal')
  if (modal) {
    modal.style.display = 'none'
  }
}

/**
 * Load contacts for search
 */
async function loadContactsForSearch() {
  if (!smsState.companyId) return

  const { data, error } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, phone, email, business_name')
    .eq('company_id', smsState.companyId)
    .not('phone', 'is', null)
    .order('first_name', { ascending: true })
    .limit(500)

  if (!error && data) {
    modalState.contacts = data
  }
}

/**
 * Handle search input in new message modal
 */
function handleNewMessageSearch(event) {
  const query = event.target.value.toLowerCase().trim()
  const resultsContainer = document.getElementById('contactSearchResults')

  // Clear previous timeout
  if (modalState.searchTimeout) {
    clearTimeout(modalState.searchTimeout)
  }

  if (!query || query.length < 2) {
    resultsContainer.style.display = 'none'
    return
  }

  // Debounce search
  modalState.searchTimeout = setTimeout(() => {
    const filtered = modalState.contacts.filter(contact => {
      const name = `${contact.first_name || ''} ${contact.last_name || ''}`.toLowerCase()
      const phone = (contact.phone || '').replace(/\D/g, '')
      const business = (contact.business_name || '').toLowerCase()
      const queryDigits = query.replace(/\D/g, '')

      return name.includes(query) ||
             phone.includes(queryDigits) ||
             business.includes(query)
    }).slice(0, 8)

    if (filtered.length === 0) {
      resultsContainer.innerHTML = `
        <div class="contact-search-empty">
          No contacts found. Enter a phone number below.
        </div>
      `
    } else {
      resultsContainer.innerHTML = filtered.map(contact => {
        const name = `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unknown'
        const initials = getInitials(name)
        const phone = formatPhone(contact.phone)

        return `
          <div class="contact-search-item" onclick="selectContactFromSearch('${contact.id}')">
            <div class="avatar">${escapeHtml(initials)}</div>
            <div class="info">
              <div class="name">${escapeHtml(name)}</div>
              <div class="phone">${escapeHtml(phone)}</div>
              ${contact.business_name ? `<div class="company">${escapeHtml(contact.business_name)}</div>` : ''}
            </div>
          </div>
        `
      }).join('')
    }

    resultsContainer.style.display = 'block'
  }, 200)
}

/**
 * Select a contact from search results
 */
function selectContactFromSearch(contactId) {
  const contact = modalState.contacts.find(c => c.id === contactId)
  if (!contact) return

  modalState.selectedContact = contact

  // Update UI
  const name = `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unknown'
  document.getElementById('selectedContactAvatar').textContent = getInitials(name)
  document.getElementById('selectedContactName').textContent = name
  document.getElementById('selectedContactPhone').textContent = formatPhone(contact.phone)
  document.getElementById('selectedContactDisplay').style.display = 'block'
  document.getElementById('contactSearchResults').style.display = 'none'
  document.getElementById('newMessageSearch').value = ''
  document.getElementById('newPhoneNumber').value = ''
  document.getElementById('startConversationBtn').disabled = false
}

/**
 * Clear selected contact
 */
function clearSelectedContact() {
  modalState.selectedContact = null
  document.getElementById('selectedContactDisplay').style.display = 'none'
  document.getElementById('startConversationBtn').disabled = true
  document.getElementById('newMessageSearch').focus()
}

/**
 * Format phone input as user types
 */
function formatPhoneInput(input) {
  let value = input.value.replace(/\D/g, '')
  if (value.length > 10) value = value.slice(0, 10)

  let formatted = ''
  if (value.length > 0) {
    formatted = '(' + value.slice(0, 3)
  }
  if (value.length > 3) {
    formatted += ') ' + value.slice(3, 6)
  }
  if (value.length > 6) {
    formatted += '-' + value.slice(6, 10)
  }

  input.value = formatted

  // Enable button if valid phone
  const btn = document.getElementById('startConversationBtn')
  btn.disabled = value.length !== 10 && !modalState.selectedContact
}

/**
 * Start conversation from modal
 */
async function startConversationFromModal() {
  let phone = ''

  if (modalState.selectedContact) {
    phone = modalState.selectedContact.phone
  } else {
    phone = document.getElementById('newPhoneNumber').value.replace(/\D/g, '')
  }

  if (!phone || phone.length < 10) {
    alert('Please select a contact or enter a valid phone number')
    return
  }

  closeNewMessageModal()
  await handleStartNewConversation(phone)
}

// Close modal when clicking outside
document.addEventListener('click', (e) => {
  const modal = document.getElementById('newMessageModal')
  if (e.target === modal) {
    closeNewMessageModal()
  }
})

// Close modal on escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeNewMessageModal()
  }
})

// ===========================================
// MOBILE HELPERS
// ===========================================

/**
 * Show conversations list (mobile)
 */
function showConversationsList() {
  const smsLayout = document.getElementById('smsLayout')
  if (smsLayout) {
    smsLayout.classList.add('show-list')
  }
}

// ===========================================
// CLEANUP ON PAGE UNLOAD
// ===========================================

window.addEventListener('beforeunload', () => {
  unsubscribeFromMessages()
  if (smsState.conversationsSubscription) {
    supabase.removeChannel(smsState.conversationsSubscription)
  }
})
