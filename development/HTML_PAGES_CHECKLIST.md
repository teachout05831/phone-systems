# HTML Pages Testing Checklist

Complete testing and functionality checklist for all pages in `twilio-ai-coach/public/`.

---

## IMPORTANT: Code Location

**All functionality should be INLINE in the HTML files.**

The `.js` files in `js/` folder are **NOT being worked in** (sandbox/deprecated).

**Shared libraries (keep these):**
- `js/supabase.min.js` - Supabase SDK
- `js/supabase-config.js` - Auth helpers, company membership
- `js/twilio.min.js` - Twilio Voice SDK
- `js/incoming-calls.js` - Shared incoming call handler

**Page-specific .js files (NOT USED - functionality goes inline):**
- ~~js/login.js~~ → inline in index.html
- ~~js/signup.js~~ → inline in signup.html
- ~~js/contacts.js~~ → inline in contacts.html
- ~~js/sms.js~~ → inline in sms.html
- etc.

---

## Overview

| Page | JS Location | Supabase Tables | Priority | Status |
|------|-------------|-----------------|----------|--------|
| index.html | INLINE | auth | P1 | [ ] |
| signup.html | INLINE | auth, companies, company_members | P1 | [ ] |
| dashboard.html | INLINE | calls, callbacks, company_members | P1 | [ ] |
| contacts.html | INLINE | contacts | P1 | [ ] |
| contact-profile.html | INLINE | contacts, calls, activities | P2 | [ ] |
| contacts-import.html | INLINE | contacts | P2 | [ ] |
| call.html | INLINE | calls, contacts | P1 | [ ] |
| sms.html | INLINE | messages, contacts | P1 | [ ] |
| history.html | INLINE | calls | P2 | [ ] |
| callbacks.html | INLINE | callbacks, contacts | P2 | [ ] |
| activity.html | INLINE | activities, calls, messages | P2 | [ ] |
| newsfeed.html | INLINE | activities, calls | P2 | [ ] |
| pipeline.html | INLINE | pipeline_stages, deals | P3 | [ ] |
| settings.html | INLINE | companies, company_members | P3 | [ ] |
| supervisor.html | INLINE | calls (live), company_members | P3 | [ ] |
| agent-queue.html | INLINE | call_queue, contacts | P3 | [ ] |
| agent-monitor.html | INLINE | calls (live) | P3 | [ ] |

---

## Phase 1: Core Pages (Must Work)

### 1. Login Page (index.html)
**File:** `index.html` (inline JS)

**Functionality Checklist:**
- [ ] Email/password login works
- [ ] Error messages display for invalid credentials
- [ ] Redirect to dashboard after successful login
- [ ] "Remember me" functionality (if exists)
- [ ] Link to signup page works
- [ ] Password visibility toggle (if exists)

**Data Flow:**
- Supabase Auth → `supabase.auth.signInWithPassword()`

---

### 2. Signup Page (signup.html)
**File:** `signup.html` (inline JS)

**Functionality Checklist:**
- [ ] Email/password signup works
- [ ] Email validation
- [ ] Password requirements shown
- [ ] Company created automatically on signup
- [ ] User added to company_members
- [ ] Redirect to dashboard after signup
- [ ] Error handling for existing email

**Data Flow:**
1. `supabase.auth.signUp()`
2. `createCompanyForUser()` → inserts into `companies`
3. Insert into `company_members`

---

### 3. Dashboard (dashboard.html)
**File:** `dashboard.html` (inline JS)

**Stats Cards Checklist:**
- [ ] Total Calls - pulls from `calls` table count
- [ ] Connected - filters `status = 'connected'`
- [ ] Missed - filters `status IN ('missed', 'no-answer')`
- [ ] Avg Duration - calculates from `duration_seconds`
- [ ] Trend comparison vs yesterday works

**Sections Checklist:**
- [ ] Quick Dial input formats phone number
- [ ] Quick Dial button initiates call
- [ ] Recent Numbers shows last 3 unique numbers
- [ ] Callbacks Due Today loads from `callbacks` table
- [ ] Missed Calls list loads correctly
- [ ] Recent Calls list shows last 5 calls
- [ ] Incoming call modal appears for inbound calls
- [ ] Answer/Decline buttons work

**Data Sources:**
- `calls` - all call stats and history
- `callbacks` - scheduled callbacks
- `company_members` - user's company_id

**Known Issues:**
- [ ] Stats showing 0 when data exists - check status values match
- [ ] WebSocket connection status

---

### 4. Contacts (contacts.html)
**File:** `contacts.html` (inline JS)

**Functionality Checklist:**
- [ ] Contact list loads from Supabase
- [ ] Search/filter works
- [ ] Pagination works
- [ ] Click contact goes to profile
- [ ] Add new contact button works
- [ ] Delete contact works
- [ ] Call button initiates call
- [ ] SMS button goes to SMS page

**Data Flow:**
- `contacts` table filtered by `company_id`

---

### 5. Make Call (call.html)
**File:** `call.html` (inline JS)

**Functionality Checklist:**
- [ ] Twilio Device initializes
- [ ] Outbound call connects
- [ ] Call timer works
- [ ] Mute/unmute works
- [ ] Hold (if exists) works
- [ ] End call works
- [ ] Call data saves to `calls` table
- [ ] Live transcription displays (Deepgram)
- [ ] AI coaching suggestions appear

**Integrations:**
- Twilio Voice SDK
- Deepgram WebSocket
- Anthropic AI (coaching)

---

### 6. SMS (sms.html)
**File:** `sms.html` (inline JS)

**Functionality Checklist:**
- [ ] Conversation list loads
- [ ] Select conversation shows messages
- [ ] Send message works
- [ ] Receive message (real-time) works
- [ ] New conversation works
- [ ] Contact picker works
- [ ] Message status indicators

**Data Flow:**
- `messages` table
- Twilio SMS webhooks

---

## Phase 2: Supporting Pages

### 7. Contact Profile (contact-profile.html)
**Functionality Checklist:**
- [ ] Contact details load
- [ ] Edit contact works
- [ ] Call history for contact shows
- [ ] Activity timeline shows
- [ ] Notes/tags (if exists)
- [ ] Quick call button works
- [ ] Quick SMS button works

---

### 8. Contact Import (contacts-import.html)
**Functionality Checklist:**
- [ ] CSV file upload works
- [ ] Column mapping UI works
- [ ] Preview data before import
- [ ] Import creates contacts
- [ ] Duplicate handling
- [ ] Error reporting

---

### 9. Call History (history.html)
**Functionality Checklist:**
- [ ] History list loads
- [ ] Filter by date range
- [ ] Filter by status
- [ ] Search by phone number
- [ ] View call details
- [ ] View transcript (if recorded)
- [ ] Playback recording (if exists)

---

### 10. Callbacks (callbacks.html)
**Functionality Checklist:**
- [ ] Callback list loads
- [ ] Filter by status (pending/completed)
- [ ] Schedule new callback
- [ ] Edit callback
- [ ] Mark complete
- [ ] Call now button works
- [ ] Reschedule works

---

### 11. Activity Feed (activity.html)
**Functionality Checklist:**
- [ ] Activities load
- [ ] Filter by type (calls, SMS, etc.)
- [ ] Pagination/infinite scroll
- [ ] Click activity shows details
- [ ] Real-time updates (WebSocket)

---

### 12. Newsfeed (newsfeed.html)
**Functionality Checklist:**
- [ ] Feed items load
- [ ] Real-time updates
- [ ] Different item types display correctly
- [ ] Interaction buttons work

---

## Phase 3: Advanced Features

### 13. Pipeline (pipeline.html)
**Functionality Checklist:**
- [ ] Pipeline stages load
- [ ] Deals in each stage
- [ ] Drag-drop between stages
- [ ] Add new deal
- [ ] Edit deal
- [ ] Deal value totals

---

### 14. Settings (settings.html)
**Functionality Checklist:**
- [ ] Profile info loads
- [ ] Update profile works
- [ ] Company settings (if owner)
- [ ] Team members list
- [ ] Invite team member
- [ ] Notification preferences
- [ ] Logout button works

---

### 15. Supervisor (supervisor.html)
**Functionality Checklist:**
- [ ] Active calls list (real-time)
- [ ] Listen to call
- [ ] View live transcript
- [ ] AI analysis panel
- [ ] Rep performance stats

---

### 16. Agent Queue (agent-queue.html)
**Functionality Checklist:**
- [ ] Queue items load
- [ ] Add to queue
- [ ] Remove from queue
- [ ] Reorder queue
- [ ] Start calling queue

---

### 17. Agent Monitor (agent-monitor.html)
**Functionality Checklist:**
- [ ] Active calls display
- [ ] Live transcript stream
- [ ] AI suggestions visible
- [ ] Call metrics

---

## Database Tables Required

Ensure these tables exist in Supabase:

| Table | Purpose | RLS Policy |
|-------|---------|------------|
| companies | Company records | By owner |
| company_members | User-company link | By user_id |
| contacts | Contact records | By company_id |
| calls | Call logs | By company_id |
| messages | SMS messages | By company_id |
| callbacks | Scheduled callbacks | By company_id |
| activities | Activity feed | By company_id |
| pipeline_stages | Sales stages | By company_id |
| deals | Pipeline deals | By company_id |
| call_queue | Agent queue items | By company_id |

---

## Testing Order

**Week 1: Auth & Core**
1. Login/Signup flow
2. Dashboard data loading
3. Contacts CRUD
4. Make call functionality

**Week 2: Communication**
5. SMS send/receive
6. Call history
7. Callbacks management
8. Activity feed

**Week 3: Advanced**
9. Pipeline
10. Settings
11. Supervisor/monitoring
12. Agent features

---

## Status Legend

- [ ] Not tested
- [~] Partially working
- [x] Fully working
- [!] Broken - needs fix

---

## Notes

_Add notes here as you test each page_

**Dashboard (1/25):**
- Stats showing "3 total calls, 0 connected"
- Need to verify: call status values in database match expected ('connected', 'missed', 'no-answer')
- Need to verify: company_id linking is correct

