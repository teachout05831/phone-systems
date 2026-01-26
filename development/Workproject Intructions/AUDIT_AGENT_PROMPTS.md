# Audit Agent Prompts

Run these 4 agents in parallel to audit all HTML pages.

**Output file:** `AUDIT_ISSUES.md`

---

## Agent 1: Auth & Settings Pages

```
You are auditing HTML pages for an Outreach System app.

**Your pages:**
- twilio-ai-coach/public/index.html (Login)
- twilio-ai-coach/public/signup.html
- twilio-ai-coach/public/settings.html
- twilio-ai-coach/public/supervisor.html

**IMPORTANT:**
- DO NOT make any changes. Only document issues.
- Read development/CODING_STANDARDS.md first to understand the standards you're checking against.

**Standards to check (from CODING_STANDARDS.md):**

1. **Security Rules**
   - Auth check: Does it call `getCurrentUser()` or `requireAuth()` or `initPage({ requireAuth: true })`?
   - Does it redirect unauthenticated users?
   - Are queries filtered by `user_id` or `company_id`?
   - No `select('*')` - only select needed fields
   - Input validation before processing

2. **Scale Rules**
   - Queries use `.limit()`
   - Filtering done in database, not client-side
   - No database calls inside loops

3. **Validation Pattern (Ralph Wiggum)**
   - All inputs validated
   - Error states handled
   - Loading states shown
   - Success/failure feedback to user

4. **Code Location**
   - All functionality should be INLINE in the HTML
   - External .js files (except shared libs) should NOT be used
   - Shared libs OK: supabase.min.js, supabase-config.js, twilio.min.js, incoming-calls.js

**For each page, document:**
- Security issues
- Missing validation
- Missing error/loading states
- External JS that should be inline
- Any functionality gaps

**Output format:**
Add your findings to development/AUDIT_ISSUES.md under "Agent 1: Auth & Settings Pages"

Use this format for each issue:

#### [A1-001] Short Title
- **Severity:** Critical / High / Medium / Low
- **Category:** Security / Data / UI / Missing Feature / Standards Violation
- **File:** filename.html
- **Line(s):** ~123-145
- **Standard:** Which CODING_STANDARDS.md rule is violated
- **Description:** What's wrong
- **Expected:** What should happen
- **Fix:** Suggested solution

Read development/CODING_STANDARDS.md first, then read each HTML file completely before documenting issues.
```

---

## Agent 2: Dashboard & Activity Pages

```
You are auditing HTML pages for an Outreach System app.

**Your pages:**
- twilio-ai-coach/public/dashboard.html
- twilio-ai-coach/public/activity.html
- twilio-ai-coach/public/newsfeed.html
- twilio-ai-coach/public/pipeline.html

**IMPORTANT:**
- DO NOT make any changes. Only document issues.
- Read development/CODING_STANDARDS.md first to understand the standards you're checking against.

**Standards to check (from CODING_STANDARDS.md):**

1. **Security Rules**
   - Auth check before data access
   - Queries filtered by `company_id`
   - No `select('*')` - only select needed fields
   - Ownership verification for updates/deletes

2. **Scale Rules**
   - All queries use `.limit()`
   - Filtering done in database, not client
   - No loops with database calls inside

3. **Validation Pattern (Ralph Wiggum)**
   - Inputs validated before use
   - Error states handled and displayed
   - Loading states shown during async
   - Empty states for no data

4. **Code Location**
   - All functionality INLINE in HTML
   - No external page-specific .js files
   - Shared libs OK: supabase.min.js, supabase-config.js, twilio.min.js

5. **Data Accuracy**
   - Stats calculations correct?
   - Status values match expected ('connected', 'missed', 'no-answer')?
   - WebSocket reconnection handled?

**Known issue to investigate:**
dashboard.html shows "3 total calls, 0 connected" - verify if status values in code match what's in the database.

**Output format:**
Add your findings to development/AUDIT_ISSUES.md under "Agent 2: Dashboard & Activity Pages"

Use this format for each issue:

#### [A2-001] Short Title
- **Severity:** Critical / High / Medium / Low
- **Category:** Security / Data / UI / Missing Feature / Standards Violation
- **File:** filename.html
- **Line(s):** ~123-145
- **Standard:** Which CODING_STANDARDS.md rule is violated
- **Description:** What's wrong
- **Expected:** What should happen
- **Fix:** Suggested solution

Read development/CODING_STANDARDS.md first, then read each HTML file completely before documenting issues.
```

---

## Agent 3: Contacts Pages

```
You are auditing HTML pages for an Outreach System app.

**Your pages:**
- twilio-ai-coach/public/contacts.html
- twilio-ai-coach/public/contact-profile.html
- twilio-ai-coach/public/contacts-import.html
- twilio-ai-coach/public/callbacks.html

**IMPORTANT:**
- DO NOT make any changes. Only document issues.
- Read development/CODING_STANDARDS.md first to understand the standards you're checking against.

**Standards to check (from CODING_STANDARDS.md):**

1. **Security Rules**
   - Auth check: `getCurrentUser()` or `initPage({ requireAuth: true })`
   - All queries filtered by `company_id`
   - No `select('*')` - select specific fields only
   - Ownership check before update/delete
   - Input validation before database writes

2. **Scale Rules**
   - Queries use `.limit()`
   - Pagination for large lists
   - No client-side filtering of large datasets

3. **Validation Pattern (Ralph Wiggum)**
   - Required field validation
   - Phone number format validation
   - Email format validation
   - Error messages shown to user
   - Loading states during operations
   - Success/failure feedback

4. **CRUD Operations**
   - Create: Validates before insert
   - Read: Filtered by company, limited results
   - Update: Ownership verified first
   - Delete: Confirmation + ownership check

5. **Import (contacts-import.html)**
   - CSV parsing validates data
   - Column mapping works
   - Preview before commit
   - Error handling for bad rows

6. **Code Location**
   - All functionality INLINE in HTML
   - No external page-specific .js files

**Output format:**
Add your findings to development/AUDIT_ISSUES.md under "Agent 3: Contacts Pages"

Use this format for each issue:

#### [A3-001] Short Title
- **Severity:** Critical / High / Medium / Low
- **Category:** Security / Data / UI / Missing Feature / Standards Violation
- **File:** filename.html
- **Line(s):** ~123-145
- **Standard:** Which CODING_STANDARDS.md rule is violated
- **Description:** What's wrong
- **Expected:** What should happen
- **Fix:** Suggested solution

Read development/CODING_STANDARDS.md first, then read each HTML file completely before documenting issues.
```

---

## Agent 4: Communication Pages

```
You are auditing HTML pages for an Outreach System app.

**Your pages:**
- twilio-ai-coach/public/call.html
- twilio-ai-coach/public/sms.html
- twilio-ai-coach/public/history.html
- twilio-ai-coach/public/agent-queue.html
- twilio-ai-coach/public/agent-monitor.html

**IMPORTANT:**
- DO NOT make any changes. Only document issues.
- Read development/CODING_STANDARDS.md first to understand the standards you're checking against.

**Standards to check (from CODING_STANDARDS.md):**

1. **Security Rules**
   - Auth check before any data access
   - Queries filtered by `company_id`
   - No `select('*')` - select specific fields
   - Input validation (phone numbers, messages)

2. **Scale Rules**
   - All queries use `.limit()`
   - History pagination
   - No unbounded data fetches

3. **Validation Pattern (Ralph Wiggum)**
   - Phone number validation before calling
   - Message content validation before sending
   - Error handling for failed calls/messages
   - Loading/connecting states shown
   - Retry logic for failures

4. **Twilio Integration (call.html)**
   - Device initialization error handling
   - Call state management (connecting, connected, ended)
   - Mute/hold functionality
   - Call data saved to database after completion
   - Incoming call handling

5. **SMS (sms.html)**
   - Conversation loading with limits
   - Send validation
   - Real-time receive handling
   - Error states

6. **Real-time Features**
   - WebSocket connection handling
   - Reconnection logic
   - State sync after reconnect

7. **Code Location**
   - All functionality INLINE in HTML
   - No external page-specific .js files

**Output format:**
Add your findings to development/AUDIT_ISSUES.md under "Agent 4: Communication Pages"

Use this format for each issue:

#### [A4-001] Short Title
- **Severity:** Critical / High / Medium / Low
- **Category:** Security / Data / UI / Missing Feature / Standards Violation
- **File:** filename.html
- **Line(s):** ~123-145
- **Standard:** Which CODING_STANDARDS.md rule is violated
- **Description:** What's wrong
- **Expected:** What should happen
- **Fix:** Suggested solution

Read development/CODING_STANDARDS.md first, then read each HTML file completely before documenting issues.
```

---

## Quick Reference: Files to Read

Each agent should read these files in order:

1. `development/CODING_STANDARDS.md` - The rules to check against
2. `development/HTML_PAGES_CHECKLIST.md` - Context on page purposes
3. Their assigned HTML pages in `twilio-ai-coach/public/`

---

## After All Agents Complete

1. Review `AUDIT_ISSUES.md` for all findings
2. Update the Summary counts at the top
3. Prioritize the "Priority Fixes" section
4. Create fix tasks from the issues
