# Fix Agent Prompts

6 agents working in parallel to fix all 59 audit issues.

**Important:** Each agent works on DIFFERENT files - no overlap.

**Output:** Update AUDIT_ISSUES.md to mark issues as FIXED when complete.

---

## Agent Assignment Summary

| Agent | Files | Issues |
|-------|-------|--------|
| Agent 1 | index.html, signup.html, settings.html | 6 |
| Agent 2 | dashboard.html, pipeline.html | 11 |
| Agent 3 | activity.html, newsfeed.html | 9 |
| Agent 4 | contacts.html, contact-profile.html, contacts-import.html | 12 |
| Agent 5 | callbacks.html, supervisor.html | 9 |
| Agent 6 | call.html, sms.html, history.html, agent-queue.html, agent-monitor.html | 12 |

**Total: 59 issues**

---

## Agent 1: Auth & Settings

```
You are fixing issues in the Outreach System HTML pages.

**Your files (ONLY touch these):**
- twilio-ai-coach/public/index.html
- twilio-ai-coach/public/signup.html
- twilio-ai-coach/public/settings.html

**IMPORTANT RULES:**
1. Read development/CODING_STANDARDS.md first
2. All functionality must be INLINE in HTML files (not in external .js files)
3. If a page references an external .js file, migrate that logic INLINE
4. Follow security rules: auth checks, company_id filtering, input validation
5. Follow scale rules: .limit() on queries, select specific fields (no *)

**Issues to fix:**

### ISSUE-001 (index.html) - Low
Full Name field missing `required` attribute on embedded signup form.
**Fix:** Add `required` attribute to the signup name input field.

### ISSUE-002 (index.html) - Medium
Password reset links to non-existent reset-password.html
**Fix:** Either create reset-password.html OR update the forgot password handler to use Supabase's built-in password reset flow with `supabase.auth.resetPasswordForEmail()`.

### ISSUE-003 (signup.html) - High
No company/membership created on signup. Users have no company until they log in again.
**Fix:** After successful signup with session, call the company creation logic. Add this after signup success:
```javascript
// Create company for new user
if (session && session.user) {
  await createCompanyForUser(session.user)
}
```
Make sure `createCompanyForUser()` from supabase-config.js is available.

### ISSUE-004 (settings.html) - Medium
User settings query uses `.select('*')` instead of specific fields.
**Fix:** Change query to select only needed fields:
`.select('hidden_tabs, landing_page, notifications, sounds, appearance, pipeline_stages, timezone')`

### ISSUE-005 (settings.html) - High (Security)
Call forwarding API calls lack authentication headers. IDOR vulnerability.
**Fix:** Add Authorization header with Supabase session token:
```javascript
const { data: { session } } = await supabase.auth.getSession()
fetch('/api/settings/forwarding', {
  headers: {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json'
  },
  // ... rest of fetch config
})
```

### ISSUE-006 (settings.html) - Low
No loading state during settings save. Uses alert() for feedback.
**Fix:** Add loading state to save button during async operation. Disable button, show spinner, re-enable on complete.

**When done:**
1. Test each fix works
2. Update development/AUDIT_ISSUES.md - add "✅ FIXED" to each issue title
3. Verify no console errors
```

---

## Agent 2: Dashboard & Pipeline

```
You are fixing issues in the Outreach System HTML pages.

**Your files (ONLY touch these):**
- twilio-ai-coach/public/dashboard.html
- twilio-ai-coach/public/pipeline.html

**IMPORTANT RULES:**
1. Read development/CODING_STANDARDS.md first
2. All functionality must be INLINE in HTML files
3. Follow security rules: auth checks, company_id filtering, input validation
4. Follow scale rules: .limit() on queries, select specific fields

**Issues to fix:**

### ISSUE-201 (dashboard.html) - High
Status value mismatch causing "0 connected" calls. Code checks for 'connected' but Twilio uses 'completed'.
**Fix:** Update status filters to match actual Twilio status values:
- 'completed' for connected/answered calls
- 'busy', 'no-answer', 'failed', 'canceled' for unsuccessful
Check the actual values in your calls table and update the filter logic accordingly.

### ISSUE-202 (dashboard.html) - Low
No loading state during initial data fetch. Stats show "0" while loading.
**Fix:** Add loading indicator to stat cards. Show spinner/skeleton until loadDashboardData() completes.

### ISSUE-203 (dashboard.html) - Medium
Demo data shown on error instead of error message. Misleading.
**Fix:** Remove hardcoded demo data from error handler. Show "Unable to load data. Please try again." message instead.

### ISSUE-204 (dashboard.html) - Low
WebSocket reconnect uses fixed 3-second delay. No exponential backoff.
**Fix:** Implement exponential backoff:
```javascript
let reconnectAttempts = 0
const maxDelay = 30000
function reconnect() {
  const delay = Math.min(3000 * Math.pow(2, reconnectAttempts), maxDelay)
  reconnectAttempts++
  setTimeout(connectWebSocket, delay)
}
// Reset on successful connection:
// reconnectAttempts = 0
```

### ISSUE-205 (dashboard.html) - High
No error handling if getCompanyMembership() fails.
**Fix:** Add try/catch and user-friendly error message:
```javascript
try {
  const { companyId, error } = await getCompanyMembership()
  if (error || !companyId) {
    showError('Unable to load your company data. Please log in again.')
    return
  }
  // continue loading...
} catch (err) {
  showError('Connection error. Please refresh the page.')
}
```

### ISSUE-215 (pipeline.html) - Critical (Security)
Missing authentication check. No auth verification.
**Fix:** Add auth check at start of inline script:
```javascript
initPage({
  requireAuth: true,
  onReady: async (user) => {
    // Move all initialization code here
  }
})
```

### ISSUE-216 (pipeline.html) - High
All pipeline data is hardcoded static demo data. No real data.
**Fix:** Replace static HTML with dynamic data loading from Supabase:
```javascript
async function loadPipelineData() {
  const { companyId } = await getCompanyMembership()
  const { data: stages } = await supabase
    .from('pipeline_stages')
    .select('id, name, position')
    .eq('company_id', companyId)
    .order('position')
    .limit(20)

  const { data: leads } = await supabase
    .from('leads')
    .select('id, name, company, value, stage_id, created_at')
    .eq('company_id', companyId)
    .limit(100)

  renderPipeline(stages, leads)
}
```

### ISSUE-217 (pipeline.html) - Medium
No loading state - static demo data shown immediately.
**Fix:** Add loading indicator, hide static content until real data loads.

### ISSUE-218 (pipeline.html) - Medium
External JS files required for functionality. Cannot audit.
**Fix:** Migrate all critical logic from pipeline.js INLINE into pipeline.html.

### ISSUE-219 (pipeline.html) - Low
Twilio SDK loaded after pipeline.js - may cause errors.
**Fix:** Reorder script tags: load twilio.min.js BEFORE any scripts that use it.

### ISSUE-220 (pipeline.html) - Medium
Modal functions not implemented inline.
**Fix:** Implement or migrate these functions inline: openAddLeadModal(), exportPipeline(), callLead(), addToQueue(), scheduleCallback(), deleteLead()

**When done:**
1. Test each fix works
2. Update development/AUDIT_ISSUES.md - add "✅ FIXED" to each issue title
3. Verify no console errors
```

---

## Agent 3: Activity & Newsfeed

```
You are fixing issues in the Outreach System HTML pages.

**Your files (ONLY touch these):**
- twilio-ai-coach/public/activity.html
- twilio-ai-coach/public/newsfeed.html

**IMPORTANT RULES:**
1. Read development/CODING_STANDARDS.md first
2. All functionality must be INLINE in HTML files
3. Follow security rules: auth checks, company_id filtering
4. Follow scale rules: .limit() on queries, select specific fields

**Issues to fix:**

### ISSUE-206 (activity.html) - Critical (Security)
Missing authentication check. Page can be accessed without login.
**Fix:** Add auth check:
```javascript
initPage({
  requireAuth: true,
  onReady: async (user) => {
    await loadActivities()
    initializeTwilio()
  }
})
```

### ISSUE-207 (activity.html) - Medium
Filter chip counts are hardcoded ("All (24)", "Calls (8)", etc.)
**Fix:** Update counts dynamically after loading data:
```javascript
function updateFilterCounts(activities) {
  const counts = {
    all: activities.length,
    calls: activities.filter(a => a.type === 'call').length,
    sms: activities.filter(a => a.type === 'sms').length,
    status: activities.filter(a => a.type === 'status_change').length
  }
  document.querySelector('[data-filter="all"] .count').textContent = `(${counts.all})`
  // ... update other counts
}
```

### ISSUE-208 (activity.html) - Medium
Core functionality in external activity.js. Not auditable inline.
**Fix:** Migrate all Supabase queries and data loading logic from activity.js INLINE into activity.html.

### ISSUE-209 (activity.html) - Medium
"Live" indicator shown but no WebSocket for real-time updates.
**Fix:** Either:
A) Add WebSocket connection for real-time updates, OR
B) Remove "Live" indicator and add "Last updated: X" with refresh button

### ISSUE-210 (newsfeed.html) - Critical (Security)
Missing authentication check.
**Fix:** Add auth check same as ISSUE-206.

### ISSUE-211 (newsfeed.html) - Low
Duplicate incoming call modal (lines ~620 AND ~1033).
**Fix:** Remove the second duplicate modal definition.

### ISSUE-212 (newsfeed.html) - Medium
Connection status hardcoded to "Disconnected".
**Fix:** Update connection status dynamically based on WebSocket state:
```javascript
function updateConnectionStatus(connected) {
  const el = document.getElementById('connection-status')
  el.textContent = connected ? 'Connected' : 'Disconnected'
  el.className = connected ? 'status-connected' : 'status-disconnected'
}
```

### ISSUE-213 (newsfeed.html) - Medium
"Live" indicator without real-time connection.
**Fix:** Same as ISSUE-209 - add real-time or remove misleading indicator.

### ISSUE-214 (newsfeed.html) - Medium
Core functionality in external newsfeed.js.
**Fix:** Migrate all Supabase queries from newsfeed.js INLINE into newsfeed.html.

**When done:**
1. Test each fix works
2. Update development/AUDIT_ISSUES.md - add "✅ FIXED" to each issue title
3. Verify no console errors
```

---

## Agent 4: Contacts Suite

```
You are fixing issues in the Outreach System HTML pages.

**Your files (ONLY touch these):**
- twilio-ai-coach/public/contacts.html
- twilio-ai-coach/public/contact-profile.html
- twilio-ai-coach/public/contacts-import.html

**IMPORTANT RULES:**
1. Read development/CODING_STANDARDS.md first
2. All functionality must be INLINE in HTML files
3. Follow security rules: auth checks, company_id filtering, ownership verification
4. Follow scale rules: .limit() on queries, select specific fields

**Issues to fix:**

### ISSUE-301 (contacts.html) - Medium
loadAllTags() query has no .limit() clause.
**Fix:** Add limit: `.limit(500)` to the contact_tags query.

### ISSUE-302 (contacts.html) - Low
Uses alert() for all user feedback.
**Fix:** Replace alert() calls with toast notifications:
```javascript
function showToast(message, type = 'info') {
  const toast = document.createElement('div')
  toast.className = `toast toast-${type}`
  toast.textContent = message
  document.body.appendChild(toast)
  setTimeout(() => toast.remove(), 3000)
}
// Usage: showToast('Contact saved!', 'success')
```

### ISSUE-303 (contacts.html) - Low
No loading indicator during single contact operations.
**Fix:** Add loading state to modal save buttons during async operations.

### ISSUE-304 (contact-profile.html) - High
Edit contact not implemented - just shows "coming soon" alert.
**Fix:** Implement editContact() with modal form and Supabase update:
```javascript
async function editContact(contactId) {
  // Show edit modal with current data
  // On save:
  const { error } = await supabase
    .from('contacts')
    .update({ name, phone, email, ... })
    .eq('id', contactId)
    .eq('company_id', companyId) // Security: verify ownership
  if (!error) {
    showToast('Contact updated!')
    loadContactData()
  }
}
```

### ISSUE-305 (contact-profile.html) - High (Security)
contact_notes query missing company_id filter. Can see other companies' notes.
**Fix:** Add company_id filter to notes query:
```javascript
const { data: notes } = await supabase
  .from('contact_notes')
  .select('id, content, created_at, created_by')
  .eq('contact_id', contactId)
  .eq('company_id', companyId)  // ADD THIS
  .order('created_at', { ascending: false })
  .limit(50)
```

### ISSUE-306 (contact-profile.html) - Medium
Uses prompt() for note editing. Poor UX.
**Fix:** Create proper edit modal with textarea instead of browser prompt().

### ISSUE-307 (contact-profile.html) - Medium
Static demo data in HTML may show if JS fails.
**Fix:** Remove static demo content. Show loading spinner initially, populate with real data.

### ISSUE-308 (contact-profile.html) - Low
No loading states during note CRUD operations.
**Fix:** Add loading spinners to note action buttons during async operations.

### ISSUE-309 (contacts-import.html) - Medium
Excel file support advertised but not implemented.
**Fix:** Either:
A) Add SheetJS library and implement Excel parsing, OR
B) Remove .xlsx from the accepted file types in UI

### ISSUE-310 (contacts-import.html) - Medium
No duplicate detection during import. Creates duplicates.
**Fix:** Before insert, check for existing contacts:
```javascript
async function checkDuplicates(contacts) {
  const phones = contacts.map(c => c.phone).filter(Boolean)
  const { data: existing } = await supabase
    .from('contacts')
    .select('phone')
    .eq('company_id', companyId)
    .in('phone', phones)
  return existing.map(e => e.phone)
}
// Show user which will be skipped/merged
```

### ISSUE-311 (contacts-import.html) - Low
No cancel option during import.
**Fix:** Add cancellation flag and check in batch loop:
```javascript
let importCancelled = false
function cancelImport() { importCancelled = true }
// In loop: if (importCancelled) break
```

### ISSUE-312 (contacts-import.html) - Low
import_history query uses .select('*').
**Fix:** Change to `.select('id, filename, status, total_records, successful, failed, created_at')`

**When done:**
1. Test each fix works
2. Update development/AUDIT_ISSUES.md - add "✅ FIXED" to each issue title
3. Verify no console errors
```

---

## Agent 5: Callbacks & Supervisor

```
You are fixing issues in the Outreach System HTML pages.

**Your files (ONLY touch these):**
- twilio-ai-coach/public/callbacks.html
- twilio-ai-coach/public/supervisor.html

**IMPORTANT RULES:**
1. Read development/CODING_STANDARDS.md first
2. All functionality must be INLINE in HTML files
3. Follow security rules: auth checks, company_id filtering, role verification
4. Follow scale rules: .limit() on queries, select specific fields

**Issues to fix:**

### ISSUE-313 (callbacks.html) - Critical
saveNoteToContact() uses wrong column names. Will fail or corrupt data.
- Code uses: `user_id`, `note`
- Schema uses: `created_by`, `content`
**Fix:** Update insert object:
```javascript
const { error } = await supabase
  .from('contact_notes')
  .insert({
    contact_id: contactId,
    company_id: companyId,
    created_by: userId,  // Was: user_id
    content: noteText    // Was: note
  })
```

### ISSUE-314 (callbacks.html) - Medium
Callback settings not persisted to database. Lost on refresh.
**Fix:** Save settings to user_settings or company_settings table:
```javascript
async function saveCallbackSettings(settings) {
  await supabase
    .from('user_settings')
    .upsert({
      user_id: userId,
      callback_settings: settings
    })
}
// Load on page init
```

### ISSUE-315 (callbacks.html) - Low
No loading indicator during callback operations.
**Fix:** Add loading states to callback action buttons during async operations.

### ISSUE-316 (callbacks.html) - Low
~650 lines of inline JS duplicates logic in callbacks.js.
**Fix:** Consolidate - keep all logic inline, remove external file reference, eliminate duplication.

### ISSUE-317 (callbacks.html) - High
contact_notes table schema mismatch. company_id column may not exist.
**Fix:** Verify actual schema in Supabase, ensure all files use correct columns consistently.

### ISSUE-007 (supervisor.html) - High (Security)
WebSocket role is self-declared by client. Server doesn't verify.
**Fix:** Pass auth token to WebSocket, verify role server-side:
```javascript
const { data: { session } } = await supabase.auth.getSession()
const wsUrl = `${BACKEND_URL.replace('http', 'ws')}/supervisor?token=${session.access_token}`
```

### ISSUE-008 (supervisor.html) - Medium
Realtime subscription may fetch unlimited records.
**Fix:** Add debouncing or payload limits to handleCallDatabaseUpdate.

### ISSUE-009 (supervisor.html) - Low
Empty state shows immediately instead of loading spinner.
**Fix:** Add initial loading state that shows while loadActiveCalls() runs.

### ISSUE-010 (supervisor.html) - Medium (Security)
WebSocket connects before role check completes.
**Fix:** Move connectWebSocket() INSIDE the role check success callback:
```javascript
const isAuthorized = await hasRole(['owner', 'admin', 'supervisor'])
if (!isAuthorized) {
  window.location.href = 'dashboard.html'
  return
}
// Only connect AFTER role verified
connectWebSocket()
```

**When done:**
1. Test each fix works
2. Update development/AUDIT_ISSUES.md - add "✅ FIXED" to each issue title
3. Verify no console errors
```

---

## Agent 6: Communication & Monitoring

```
You are fixing issues in the Outreach System HTML pages.

**Your files (ONLY touch these):**
- twilio-ai-coach/public/call.html
- twilio-ai-coach/public/sms.html
- twilio-ai-coach/public/history.html
- twilio-ai-coach/public/agent-queue.html
- twilio-ai-coach/public/agent-monitor.html

**IMPORTANT RULES:**
1. Read development/CODING_STANDARDS.md first
2. All functionality must be INLINE in HTML files
3. Follow security rules: auth checks, company_id filtering on ALL operations
4. Follow scale rules: .limit() on queries, select specific fields

**Issues to fix:**

### ISSUE-401 (call.html) - High (Security)
WebSocket for transcription lacks authentication token.
**Fix:** Add auth token to WebSocket connection:
```javascript
const { data: { session } } = await supabase.auth.getSession()
const ws = new WebSocket(`${wsUrl}?token=${session.access_token}&callSid=${callSid}`)
```

### ISSUE-402 (call.html) - Medium (Security)
Recording toggle doesn't verify call ownership.
**Fix:** Include company_id in request, verify server-side:
```javascript
fetch('/api/call/recording', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ callSid, recording: enabled, company_id: companyId })
})
```

### ISSUE-403 (sms.html) - Medium (Security)
No rate limiting on message send. Could cause billing abuse.
**Fix:** Add debounce/rate limit:
```javascript
let lastSendTime = 0
const SEND_COOLDOWN = 1000 // 1 second

async function sendMessage() {
  const now = Date.now()
  if (now - lastSendTime < SEND_COOLDOWN) {
    showToast('Please wait before sending another message')
    return
  }
  lastSendTime = now
  // ... send logic
}
```

### ISSUE-404 (sms.html) - Low
Real-time subscription updates all conversations, not just selected.
**Fix:** Check conversation_id before updating unread counts:
```javascript
if (newMessage.conversation_id !== currentConversationId) {
  incrementUnreadCount(newMessage.conversation_id)
}
```

### ISSUE-405 (history.html) - Critical (Security)
DEBUG query exposes ALL companies' call data!
**Fix:** REMOVE the debug query entirely, or add company_id filter:
```javascript
// DELETE THIS DEBUG BLOCK or add:
.eq('company_id', companyId)
```

### ISSUE-406 (history.html) - Medium
loadCallDetails() uses .select('*').
**Fix:** Select specific fields:
`.select('id, phone_number, status, direction, duration, started_at, ended_at, recording_url, transcription, ai_summary, contact_id')`

### ISSUE-407 (agent-queue.html) - High (Security)
removeItem() deletes by ID only without company verification. IDOR vulnerability.
**Fix:** Add company_id filter:
```javascript
await supabase
  .from('call_queue')
  .delete()
  .eq('id', queueId)
  .eq('company_id', companyId)  // ADD THIS
```

### ISSUE-408 (agent-queue.html) - High (Security)
updateQueueItem() lacks company verification.
**Fix:** Add `.eq('company_id', companyId)` to ALL update queries.

### ISSUE-409 (agent-queue.html) - High (Security)
Bulk actions lack company verification.
**Fix:** Add company_id filter to ALL bulk update/delete operations.

### ISSUE-410 (agent-monitor.html) - High (Security)
endCall() updates by call_sid only. Can end other companies' calls.
**Fix:** Add company_id filter:
```javascript
await supabase
  .from('calls')
  .update({ status: 'ended' })
  .eq('call_sid', callSid)
  .eq('company_id', companyId)  // ADD THIS
```

### ISSUE-411 (agent-monitor.html) - Medium (Security)
loadContactName() fetches contact without company filter. Leaks data.
**Fix:** Add company_id filter to contacts query.

### ISSUE-412 (agent-monitor.html) - Medium (Security)
Transfer call API lacks auth context.
**Fix:** Add Authorization header with Supabase session token to the fetch call.

**When done:**
1. Test each fix works
2. Update development/AUDIT_ISSUES.md - add "✅ FIXED" to each issue title
3. Verify no console errors
```

---

## Post-Fix Checklist

After all agents complete:

1. [ ] All 59 issues marked as FIXED in AUDIT_ISSUES.md
2. [ ] No console errors on any page
3. [ ] All pages have auth checks
4. [ ] All queries filtered by company_id
5. [ ] All queries use .limit()
6. [ ] No .select('*') anywhere
7. [ ] All functionality is INLINE (no external .js dependencies)

---

## File Ownership (No Conflicts)

| File | Assigned To |
|------|-------------|
| index.html | Agent 1 |
| signup.html | Agent 1 |
| settings.html | Agent 1 |
| dashboard.html | Agent 2 |
| pipeline.html | Agent 2 |
| activity.html | Agent 3 |
| newsfeed.html | Agent 3 |
| contacts.html | Agent 4 |
| contact-profile.html | Agent 4 |
| contacts-import.html | Agent 4 |
| callbacks.html | Agent 5 |
| supervisor.html | Agent 5 |
| call.html | Agent 6 |
| sms.html | Agent 6 |
| history.html | Agent 6 |
| agent-queue.html | Agent 6 |
| agent-monitor.html | Agent 6 |
