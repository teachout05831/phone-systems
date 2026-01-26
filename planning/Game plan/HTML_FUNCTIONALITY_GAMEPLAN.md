# Game Plan: Wire Up HTML Pages with Supabase

**Created:** January 23, 2026
**Goal:** Add JavaScript functionality to all 18 HTML pages to connect them to Supabase
**Approach:** Direct Supabase client in browser (no separate API layer needed)

---

## Overview

The HTML pages already have complete UI. We need to add JavaScript that:
1. Initializes Supabase client
2. Handles authentication
3. Fetches and renders data
4. Handles user interactions (clicks, forms)
5. Performs CRUD operations

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                     SUPABASE                        │
│              (PostgreSQL Database)                  │
│   contacts, calls, callbacks, deals, users...      │
└─────────────────────────────────────────────────────┘
                        ▲
                        │
              Direct connection via
              @supabase/supabase-js
                        │
┌─────────────────────────────────────────────────────┐
│              HTML PAGES (Browser)                   │
│  contacts.html, dashboard.html, pipeline.html...   │
│                                                     │
│  Each page includes:                               │
│  - supabase-config.js (shared auth/init)           │
│  - page-specific.js (fetch, render, handlers)     │
└─────────────────────────────────────────────────────┘
```

**Why this works:**
- Supabase JS client works directly in browser
- Row Level Security (RLS) handles authorization
- No need for separate API endpoints
- Simpler architecture, faster to implement

---

## Phase 0: Shared Infrastructure

### 0.1 Create Shared Supabase Config

Create a shared JavaScript file that all pages will include:

**File:** `twilio-ai-coach/public/js/supabase-config.js`

```javascript
// Supabase Configuration
const SUPABASE_URL = 'YOUR_SUPABASE_URL'
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Auth helper functions
async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    window.location.href = '/login.html'
    return null
  }
  return user
}

async function getUserProfile() {
  const user = await getCurrentUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('id, email, full_name, role, company_id')
    .eq('id', user.id)
    .single()

  return profile
}

async function signOut() {
  await supabase.auth.signOut()
  window.location.href = '/login.html'
}

// UI helper functions
function showLoading(elementId) {
  const el = document.getElementById(elementId)
  if (el) el.innerHTML = '<div class="loading">Loading...</div>'
}

function showError(elementId, message) {
  const el = document.getElementById(elementId)
  if (el) el.innerHTML = `<div class="error">${message}</div>`
}

function formatDate(dateString) {
  if (!dateString) return ''
  return new Date(dateString).toLocaleDateString()
}

function formatDateTime(dateString) {
  if (!dateString) return ''
  return new Date(dateString).toLocaleString()
}

function formatPhone(phone) {
  if (!phone) return ''
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0,3)}) ${cleaned.slice(3,6)}-${cleaned.slice(6)}`
  }
  return phone
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount || 0)
}
```

### 0.2 Create Login Page

**File:** `twilio-ai-coach/public/login.html` (update existing or create)

```javascript
// In login.html <script>
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault()

  const email = document.getElementById('email').value
  const password = document.getElementById('password').value

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (error) {
    document.getElementById('error-message').textContent = error.message
    return
  }

  window.location.href = '/dashboard.html'
})
```

### 0.3 HTML Template for Including Scripts

Every HTML page should include these scripts before closing `</body>`:

```html
<!-- Supabase JS SDK -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

<!-- Shared config and helpers -->
<script src="/js/supabase-config.js"></script>

<!-- Page-specific functionality -->
<script src="/js/contacts.js"></script>  <!-- Change per page -->
```

---

## Phase 1: Page-by-Page Implementation

### Page Structure Pattern

Each page's JavaScript file follows this pattern:

```javascript
// 1. Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
  // 2. Check auth
  const user = await getCurrentUser()
  if (!user) return

  const profile = await getUserProfile()

  // 3. Load initial data
  await loadData(profile.company_id)

  // 4. Set up event listeners
  setupEventListeners()
})

// 5. Data loading function
async function loadData(companyId) {
  showLoading('data-container')

  const { data, error } = await supabase
    .from('table_name')
    .select('columns')
    .eq('company_id', companyId)
    .limit(50)

  if (error) {
    showError('data-container', 'Failed to load data')
    return
  }

  renderData(data)
}

// 6. Render function
function renderData(items) {
  const container = document.getElementById('data-container')
  container.innerHTML = items.map(item => `
    <div class="item" data-id="${item.id}">
      ${item.name}
    </div>
  `).join('')
}

// 7. Event listeners
function setupEventListeners() {
  // Form submissions
  document.getElementById('create-form')?.addEventListener('submit', handleCreate)

  // Button clicks (use event delegation)
  document.addEventListener('click', (e) => {
    if (e.target.matches('.edit-btn')) handleEdit(e)
    if (e.target.matches('.delete-btn')) handleDelete(e)
  })
}

// 8. CRUD handlers
async function handleCreate(e) {
  e.preventDefault()
  // Get form values, validate, insert
}

async function handleEdit(e) {
  const id = e.target.closest('[data-id]').dataset.id
  // Open modal, populate, update on save
}

async function handleDelete(e) {
  const id = e.target.closest('[data-id]').dataset.id
  if (!confirm('Delete this item?')) return

  await supabase.from('table_name').delete().eq('id', id)
  await loadData()
}
```

---

## Pages to Implement

| Page | JS File | Complexity | Database Tables |
|------|---------|------------|-----------------|
| login.html | login.js | Simple | auth |
| dashboard.html | dashboard.js | Medium | calls, callbacks, stats |
| contacts.html | contacts.js | Medium | contacts |
| contact-profile.html | contact-profile.js | Medium | contacts, calls, notes |
| contacts-import.html | contacts-import.js | Medium | contacts |
| callbacks.html | callbacks.js | Medium | callbacks, contacts |
| history.html | history.js | Medium | calls |
| pipeline.html | pipeline.js | Complex | pipeline_stages, deals |
| activity.html | activity.js | Simple | activity_log |
| sms.html | sms.js | Complex | sms_conversations, sms_messages |
| settings.html | settings.js | Medium | users, settings |
| agent-queue.html | agent-queue.js | Medium | ai_queue |
| agent-monitor.html | agent-monitor.js | Medium | calls (real-time) |
| supervisor.html | supervisor.js | Medium | users, calls |
| newsfeed.html | newsfeed.js | Simple | news, activity |
| messages.html | messages.js | Medium | messages |
| onboarding.html | onboarding.js | Medium | users |
| call.html | (already has JS) | Complex | calls, transcripts |

---

## Detailed Page Specifications

### 1. contacts.js

**Features:**
- List contacts with search/filter
- Create new contact (modal)
- Edit contact (modal)
- Delete contact
- Click to view profile

**Database:** `contacts` table

```javascript
// Key functions needed:
async function loadContacts(companyId, filters = {})
function renderContactsList(contacts)
async function handleCreateContact(formData)
async function handleUpdateContact(id, formData)
async function handleDeleteContact(id)
function setupContactSearch()
```

### 2. contact-profile.js

**Features:**
- Show contact details
- Edit contact info
- List call history for contact
- Add/edit notes
- Show activity timeline

**Database:** `contacts`, `calls`, `contact_notes`, `activity_log`

### 3. contacts-import.js

**Features:**
- CSV file upload
- Preview imported data
- Map columns to fields
- Batch insert contacts
- Show import results

**Database:** `contacts`

### 4. dashboard.js

**Features:**
- Show stats cards (total calls, callbacks due, etc.)
- List recent calls
- List upcoming callbacks
- Quick dial widget

**Database:** `calls`, `callbacks`, `contacts`

### 5. callbacks.js

**Features:**
- List callbacks (filter by status, date)
- Schedule new callback
- Complete callback
- Reschedule callback
- Delete callback

**Database:** `callbacks`, `contacts`

### 6. history.js

**Features:**
- List calls with filters (date range, direction, outcome)
- Search by contact name/phone
- View call details (modal)
- Play recording (if available)
- Pagination

**Database:** `calls`, `contacts`

### 7. pipeline.js

**Features:**
- Kanban board with stages
- Drag and drop deals between stages
- Create new deal
- Edit deal details
- Delete deal

**Database:** `pipeline_stages`, `deals`, `contacts`

```javascript
// Special: Drag and drop
function setupDragAndDrop() {
  const cards = document.querySelectorAll('.deal-card')
  const columns = document.querySelectorAll('.pipeline-column')

  cards.forEach(card => {
    card.draggable = true
    card.addEventListener('dragstart', handleDragStart)
    card.addEventListener('dragend', handleDragEnd)
  })

  columns.forEach(column => {
    column.addEventListener('dragover', handleDragOver)
    column.addEventListener('drop', handleDrop)
  })
}

async function handleDrop(e) {
  const dealId = e.dataTransfer.getData('text/plain')
  const newStageId = e.target.closest('.pipeline-column').dataset.stageId

  await supabase
    .from('deals')
    .update({ stage_id: newStageId })
    .eq('id', dealId)
}
```

### 8. activity.js

**Features:**
- List activity feed
- Filter by type
- Infinite scroll / pagination

**Database:** `activity_log`

### 9. sms.js

**Features:**
- List conversations
- Select conversation to view messages
- Send new message
- Real-time updates for incoming messages
- Start new conversation

**Database:** `sms_conversations`, `sms_messages`

```javascript
// Special: Real-time subscription
function subscribeToMessages(conversationId) {
  supabase
    .channel('sms-messages')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'sms_messages',
      filter: `conversation_id=eq.${conversationId}`
    }, (payload) => {
      appendMessage(payload.new)
    })
    .subscribe()
}
```

### 10. settings.js

**Features:**
- Edit profile (name, email, photo)
- Change password
- Notification preferences
- Integration settings (Twilio, etc.)

**Database:** `users`, `user_settings`

### 11. agent-queue.js

**Features:**
- List queue items
- Add contact to queue
- Dispatch now (trigger call)
- Change priority
- Remove from queue
- Stats (total, pending, in-progress)

**Database:** `ai_queue`, `contacts`

### 12. agent-monitor.js

**Features:**
- List active calls (real-time)
- Show call status, duration
- Live transcript feed (if connected)

**Database:** `calls` (real-time subscription)

### 13. supervisor.js

**Features:**
- Team stats overview
- Rep status list (available, on call, away)
- Active calls monitor
- Performance metrics

**Database:** `users`, `calls`, `user_status`

---

## Security Checklist

Each page must:
- [ ] Check auth on load (`getCurrentUser()`)
- [ ] Filter queries by `company_id`
- [ ] Validate form inputs before insert/update
- [ ] Use `.limit()` on all list queries
- [ ] Handle errors gracefully
- [ ] Confirm before delete actions

---

## Agent Prompts

Use these prompts to dispatch parallel agents. Each prompt is self-contained.

**Add this header to every prompt:**

```
BEFORE YOU START:
1. Read this game plan: planning/Game plan/HTML_FUNCTIONALITY_GAMEPLAN.md
2. Read the shared config pattern in Phase 0
3. Look at the HTML file to understand the existing DOM structure
4. Follow the page structure pattern exactly

Working directory: c:\Users\teach\OneDrive\Desktop\Outreach System WebSite
```

---

### Prompt: Phase 0 - Shared Infrastructure

```
TASK: Create shared Supabase configuration for HTML pages

READ THESE FILES FIRST:
1. planning/Game plan/HTML_FUNCTIONALITY_GAMEPLAN.md - Phase 0
2. twilio-ai-coach/public/dashboard.html (to see existing structure)

CREATE THESE FILES:
1. twilio-ai-coach/public/js/supabase-config.js
   - Supabase client initialization
   - getCurrentUser() function
   - getUserProfile() function
   - signOut() function
   - UI helpers (showLoading, showError, formatDate, formatPhone, formatCurrency)

2. Update twilio-ai-coach/public/login.html
   - Add Supabase auth login form handling
   - Redirect to dashboard on success
   - Show error on failure

3. Create twilio-ai-coach/public/signup.html (if not exists)
   - Supabase auth signup
   - Redirect to onboarding on success

IMPORTANT:
- Use environment variables pattern (will be replaced at deploy time)
- Test that auth flow works
```

---

### Prompt: Stream 1 - Contacts Pages

```
TASK: Wire up contacts.html, contact-profile.html, contacts-import.html

READ THESE FILES FIRST:
1. planning/Game plan/HTML_FUNCTIONALITY_GAMEPLAN.md
2. twilio-ai-coach/public/contacts.html
3. twilio-ai-coach/public/contact-profile.html
4. twilio-ai-coach/public/contacts-import.html
5. twilio-ai-coach/public/js/supabase-config.js (shared helpers)

CREATE THESE FILES:

1. twilio-ai-coach/public/js/contacts.js
   - loadContacts(companyId, filters)
   - renderContactsList(contacts)
   - handleCreateContact(formData)
   - handleUpdateContact(id, formData)
   - handleDeleteContact(id)
   - setupContactSearch()
   - setupEventListeners()

2. twilio-ai-coach/public/js/contact-profile.js
   - loadContact(contactId)
   - loadContactCalls(contactId)
   - loadContactNotes(contactId)
   - renderContactDetails(contact)
   - handleUpdateContact(id, formData)
   - handleAddNote(contactId, note)

3. twilio-ai-coach/public/js/contacts-import.js
   - handleFileUpload(file)
   - parseCSV(content)
   - renderPreview(rows)
   - handleImport(mappedData)
   - showImportResults(results)

UPDATE the HTML files to include the script tags.

DATABASE TABLES:
- contacts (id, company_id, first_name, last_name, phone, email, business_name, tags, created_at)
- contact_notes (id, contact_id, content, created_by, created_at)
- calls (for call history on profile)

SECURITY:
- Filter by company_id
- Validate phone format
- Limit queries to 50 results
```

---

### Prompt: Stream 2 - Dashboard & Callbacks

```
TASK: Wire up dashboard.html and callbacks.html

READ THESE FILES FIRST:
1. planning/Game plan/HTML_FUNCTIONALITY_GAMEPLAN.md
2. twilio-ai-coach/public/dashboard.html
3. twilio-ai-coach/public/callbacks.html
4. twilio-ai-coach/public/js/supabase-config.js

CREATE THESE FILES:

1. twilio-ai-coach/public/js/dashboard.js
   - loadDashboardStats(companyId)
   - loadRecentCalls(companyId)
   - loadUpcomingCallbacks(companyId)
   - renderStats(stats)
   - renderRecentCalls(calls)
   - renderCallbacks(callbacks)
   - setupQuickDial()

2. twilio-ai-coach/public/js/callbacks.js
   - loadCallbacks(companyId, filters)
   - renderCallbacksList(callbacks)
   - handleScheduleCallback(formData)
   - handleCompleteCallback(id)
   - handleRescheduleCallback(id, newTime)
   - handleDeleteCallback(id)
   - setupFilters()

UPDATE the HTML files to include the script tags.

DATABASE TABLES:
- calls (for recent calls, stats)
- callbacks (id, company_id, contact_id, scheduled_for, status, notes, created_by)
- contacts (for callback contact info)

SECURITY:
- Filter by company_id
- Only show callbacks for current user or team
```

---

### Prompt: Stream 3 - History & Activity

```
TASK: Wire up history.html and activity.html

READ THESE FILES FIRST:
1. planning/Game plan/HTML_FUNCTIONALITY_GAMEPLAN.md
2. twilio-ai-coach/public/history.html
3. twilio-ai-coach/public/activity.html
4. twilio-ai-coach/public/js/supabase-config.js

CREATE THESE FILES:

1. twilio-ai-coach/public/js/history.js
   - loadCalls(companyId, filters)
   - renderCallsTable(calls)
   - handleViewDetails(callId)
   - setupFilters() // date range, direction, outcome
   - setupSearch()
   - setupPagination()

2. twilio-ai-coach/public/js/activity.js
   - loadActivity(companyId, filters)
   - renderActivityFeed(activities)
   - setupFilters() // by type
   - setupInfiniteScroll()

UPDATE the HTML files to include the script tags.

DATABASE TABLES:
- calls (id, company_id, contact_id, direction, status, outcome, duration, recording_url, created_at)
- activity_log (id, company_id, user_id, action, entity_type, entity_id, metadata, created_at)

SECURITY:
- Filter by company_id
- Limit to 50 per page
- Paginate with offset
```

---

### Prompt: Stream 4 - Pipeline

```
TASK: Wire up pipeline.html with Kanban functionality

READ THESE FILES FIRST:
1. planning/Game plan/HTML_FUNCTIONALITY_GAMEPLAN.md
2. twilio-ai-coach/public/pipeline.html
3. twilio-ai-coach/public/js/supabase-config.js

CREATE THIS FILE:

twilio-ai-coach/public/js/pipeline.js
- loadStages(companyId)
- loadDeals(companyId)
- renderPipelineBoard(stages, deals)
- setupDragAndDrop()
- handleDragStart(e)
- handleDragOver(e)
- handleDrop(e) // Update deal stage
- handleCreateDeal(formData)
- handleUpdateDeal(id, formData)
- handleDeleteDeal(id)
- calculateStageStats(deals)

UPDATE pipeline.html to include the script tag.

DATABASE TABLES:
- pipeline_stages (id, company_id, name, slug, color, position, is_closed_won, is_closed_lost)
- deals (id, company_id, stage_id, contact_id, title, value, priority, expected_close_date, notes)
- contacts (for deal contact info)

DRAG AND DROP:
- Make deal cards draggable
- Update stage_id on drop
- Animate card movement
- Update stage totals

SECURITY:
- Filter by company_id
- Validate stage exists before update
```

---

### Prompt: Stream 5 - SMS Messaging

```
TASK: Wire up sms.html with real-time messaging

READ THESE FILES FIRST:
1. planning/Game plan/HTML_FUNCTIONALITY_GAMEPLAN.md
2. twilio-ai-coach/public/sms.html
3. twilio-ai-coach/public/js/supabase-config.js

CREATE THIS FILE:

twilio-ai-coach/public/js/sms.js
- loadConversations(companyId)
- loadMessages(conversationId)
- renderConversationList(conversations)
- renderMessages(messages)
- handleSelectConversation(conversationId)
- handleSendMessage(conversationId, message)
- handleStartNewConversation(phone, message)
- subscribeToMessages(conversationId) // Real-time
- unsubscribeFromMessages()
- scrollToBottom()

UPDATE sms.html to include the script tag.

DATABASE TABLES:
- sms_conversations (id, company_id, contact_id, phone_number, status, last_message_at)
- sms_messages (id, conversation_id, direction, body, status, created_at)
- contacts (for conversation contact info)

REAL-TIME:
- Subscribe to new messages in selected conversation
- Auto-scroll on new message
- Update conversation list when new message arrives
- Mark messages as read

SECURITY:
- Filter by company_id
- Validate phone number format
```

---

### Prompt: Stream 6 - Agent Queue & Monitor

```
TASK: Wire up agent-queue.html and agent-monitor.html

READ THESE FILES FIRST:
1. planning/Game plan/HTML_FUNCTIONALITY_GAMEPLAN.md
2. twilio-ai-coach/public/agent-queue.html
3. twilio-ai-coach/public/agent-monitor.html
4. twilio-ai-coach/public/js/supabase-config.js

CREATE THESE FILES:

1. twilio-ai-coach/public/js/agent-queue.js
   - loadQueueItems(companyId, filters)
   - loadQueueStats(companyId)
   - renderQueueTable(items)
   - renderQueueStats(stats)
   - handleAddToQueue(contactId, priority)
   - handleDispatchNow(queueItemId)
   - handleChangePriority(id, priority)
   - handleRemoveFromQueue(id)
   - setupFilters()

2. twilio-ai-coach/public/js/agent-monitor.js
   - loadActiveCalls(companyId)
   - renderActiveCallsList(calls)
   - subscribeToCallUpdates(companyId) // Real-time
   - handleCallStatusChange(callId, status)
   - updateCallDuration(callId)

UPDATE the HTML files to include the script tags.

DATABASE TABLES:
- ai_queue (id, company_id, contact_id, priority, status, scheduled_for, attempts, created_at)
- calls (for active calls monitoring)
- contacts (for queue item contact info)

REAL-TIME:
- Subscribe to call status changes
- Update call duration every second for active calls
- Show new calls as they start

SECURITY:
- Filter by company_id
- Validate queue item status before dispatch
```

---

### Prompt: Stream 7 - Settings & Supervisor

```
TASK: Wire up settings.html and supervisor.html

READ THESE FILES FIRST:
1. planning/Game plan/HTML_FUNCTIONALITY_GAMEPLAN.md
2. twilio-ai-coach/public/settings.html
3. twilio-ai-coach/public/supervisor.html
4. twilio-ai-coach/public/js/supabase-config.js

CREATE THESE FILES:

1. twilio-ai-coach/public/js/settings.js
   - loadUserProfile()
   - loadUserSettings()
   - renderProfileForm(profile)
   - renderSettingsForm(settings)
   - handleUpdateProfile(formData)
   - handleChangePassword(currentPassword, newPassword)
   - handleUpdateSettings(settings)
   - handleUploadAvatar(file)

2. twilio-ai-coach/public/js/supervisor.js
   - loadTeamStats(companyId)
   - loadRepStatuses(companyId)
   - loadActiveCalls(companyId)
   - renderTeamStats(stats)
   - renderRepList(reps)
   - renderActiveCalls(calls)
   - subscribeToRepStatuses(companyId)
   - subscribeToActiveCalls(companyId)

UPDATE the HTML files to include the script tags.

DATABASE TABLES:
- users (profile info)
- user_settings (notification preferences, etc.)
- calls (for supervisor active calls)

SECURITY:
- Settings: only own profile
- Supervisor: check role is 'manager' or 'admin'
- Filter team data by company_id
```

---

### Prompt: Stream 8 - Remaining Pages

```
TASK: Wire up newsfeed.html, messages.html, onboarding.html

READ THESE FILES FIRST:
1. planning/Game plan/HTML_FUNCTIONALITY_GAMEPLAN.md
2. twilio-ai-coach/public/newsfeed.html
3. twilio-ai-coach/public/messages.html
4. twilio-ai-coach/public/onboarding.html
5. twilio-ai-coach/public/js/supabase-config.js

CREATE THESE FILES:

1. twilio-ai-coach/public/js/newsfeed.js
   - loadNewsFeed(companyId)
   - renderNewsFeed(items)
   - setupInfiniteScroll()

2. twilio-ai-coach/public/js/messages.js
   - loadInternalMessages(userId)
   - renderMessagesList(messages)
   - handleSendMessage(recipientId, message)
   - subscribeToMessages(userId)

3. twilio-ai-coach/public/js/onboarding.js
   - loadOnboardingProgress()
   - renderCurrentStep(step)
   - handleCompleteStep(stepId)
   - handleSkipStep(stepId)
   - navigateToStep(stepNumber)

UPDATE the HTML files to include the script tags.

DATABASE TABLES:
- news_feed or activity_log (for newsfeed)
- internal_messages (for team messaging)
- onboarding_progress (user_id, step, completed_at)

SECURITY:
- Filter by company_id or user_id as appropriate
```

---

## Testing Checklist

Before marking a page complete:

- [ ] Page loads without errors
- [ ] Auth redirect works (not logged in → login page)
- [ ] Data loads and renders correctly
- [ ] Create/Add functionality works
- [ ] Edit/Update functionality works
- [ ] Delete functionality works (with confirmation)
- [ ] Search/filter works (if applicable)
- [ ] Error states display properly
- [ ] Loading states display properly
- [ ] Mobile responsive (if applicable)

---

## Deployment

1. **Environment Variables:**
   - Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `supabase-config.js`
   - Or use a build step to inject them

2. **Express Server:**
   - Server already serves `/public` folder
   - No changes needed to server.js for static files

3. **Supabase RLS:**
   - Ensure Row Level Security policies are set up
   - Users can only access their company's data

---

## File Summary

After implementation, the js/ folder will contain:

```
twilio-ai-coach/public/js/
├── supabase-config.js    # Shared config and helpers
├── login.js              # Auth login
├── signup.js             # Auth signup
├── dashboard.js          # Dashboard page
├── contacts.js           # Contacts list
├── contact-profile.js    # Single contact view
├── contacts-import.js    # CSV import
├── callbacks.js          # Callbacks management
├── history.js            # Call history
├── activity.js           # Activity feed
├── pipeline.js           # Kanban pipeline
├── sms.js                # SMS messaging
├── settings.js           # User settings
├── agent-queue.js        # AI queue
├── agent-monitor.js      # Active calls monitor
├── supervisor.js         # Supervisor dashboard
├── newsfeed.js           # News feed
├── messages.js           # Internal messages
└── onboarding.js         # Onboarding wizard
```

Total: 19 JavaScript files
