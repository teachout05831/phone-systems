# Phase 2 Parallel Development Plan - Outreach System

## Overview
Split work across **5 Claude Code sessions** running simultaneously to implement remaining features from HTML mockups.

---

## Code Standards (ALL SESSIONS MUST FOLLOW)

**CRITICAL:** Read `development/CODING_STANDARDS.md` before implementing. Key rules:

### File Limits
| File Type | Purpose | Max Lines |
|-----------|---------|-----------|
| Page | Route entry (fetch + render only) | 50 |
| Component | UI rendering only | 150 |
| Hook | State management and logic | 100 |
| Query | Database reads | 80 |
| Action | Database writes | 80 |

### Feature Structure
```
web/src/features/[feature-name]/
├── components/          # UI components
├── hooks/               # State management
├── actions/             # Server actions (writes)
├── queries/             # Data fetching (reads)
├── types.ts             # Type definitions
└── index.ts             # Public exports
```

### Security Rules (Every query/action must)
1. Call `getUser()` first
2. Return error if no user
3. Filter by `user.id` or `company_id`
4. Only select needed fields (never `select('*')`)
5. Use `.limit()` on all queries
6. Validate inputs before processing

### Naming
- Components: `PascalCase` → `UserCard.tsx`
- Hooks: `useXxx` → `useUsers.ts`
- Queries: `getXxx` → `getUsers.ts`
- Actions: verb → `createUser.ts`
- Folders: `kebab-case`

---

## Session Breakdown

### SESSION 1: AI Agent Queue (`/agent-queue`)
**Focus:** Batch calling system for AI agent
**Reference:** `twilio-ai-coach/public/agent-queue.html`

**Tasks:**
1. **Create Feature Structure**
   - `web/src/features/agent-queue/`
   - components/, actions/, queries/, hooks/, types.ts, index.ts

2. **Queue Management**
   - Add contacts to queue (single or bulk)
   - Priority levels (high/normal)
   - Schedule for later option
   - Remove from queue

3. **Queue UI**
   - Stats cards: Pending, In Progress, Completed, Cost
   - Table with: Contact, Status, Priority, Attempts, Outcome, Added date
   - Bulk actions: Dispatch, Prioritize, Cancel, Remove
   - Search and filters

4. **Actions**
   - `addToQueue.ts` - Add contacts to AI queue
   - `removeFromQueue.ts` - Remove from queue
   - `dispatchNow.ts` - Start AI call immediately
   - `updatePriority.ts` - Change priority

5. **Database Table** (may need migration)
   - `ai_queue` table with: id, contact_id, company_id, status, priority, attempts, outcome, scheduled_at, created_at

**Why Session 1:** Core AI functionality - must work before monitor can show calls.

---

### SESSION 2: AI Agent Monitor (`/agent-monitor`)
**Focus:** Real-time monitoring of active AI calls
**Reference:** `twilio-ai-coach/public/agent-monitor.html`

**Tasks:**
1. **Create Feature Structure**
   - `web/src/features/agent-monitor/`

2. **Live Call Panel**
   - List of active AI calls with status
   - Contact name, phone, duration
   - Status badges: Ringing, Connected, Ended

3. **Call Details Panel**
   - Live transcript display
   - AI analysis: Sentiment, Intent, Confidence
   - AI-generated summary (updating in real-time)

4. **Actions/Controls**
   - Listen button (join call audio)
   - End Call button
   - View Contact link

5. **Real-time Updates**
   - WebSocket or polling for live data
   - Auto-refresh call list
   - Transcript streaming

**Why Session 2:** Complements Agent Queue - supervisor monitoring feature.

---

### SESSION 3: Call Newsfeed (`/newsfeed`)
**Focus:** Real-time call feed with quick tagging
**Reference:** `twilio-ai-coach/public/newsfeed.html`

**Tasks:**
1. **Create Feature Structure**
   - `web/src/features/newsfeed/`

2. **Feed UI**
   - Timeline of calls (newest first)
   - Status icons: Connected, Missed, No Answer
   - Quick stats: Total, Booked, Estimates, Needs Action, Missed

3. **Quick Tagging System**
   - Tag buttons: Booked, Gave Estimate, Question, Current Customer, Not Interested
   - Toggle selection on same call
   - Visual feedback on tagged vs untagged

4. **Per-Call Features**
   - AI summary display
   - Inline notes input
   - Call Back button
   - Schedule Callback button (for missed)
   - View Transcript button

5. **Filters**
   - All, Needs Action (untagged), Booked, Estimates, Missed

6. **Real-time Updates**
   - New calls appear at top with animation
   - WebSocket for live feed

**Why Session 3:** Productivity feature - reps can quickly process calls.

---

### SESSION 4: Call History Enhanced (`/calls` or `/history`)
**Focus:** Enhanced call history with recordings and transcripts
**Reference:** `twilio-ai-coach/public/history.html`

**Tasks:**
1. **Update/Create Feature**
   - Check existing `/calls` implementation
   - `web/src/features/call-history/` or update `calls`

2. **Call List Enhancements**
   - Filters: Date, Status, Outcome, Search
   - Sort: Newest, Oldest, Longest, Shortest
   - Pagination

3. **Call Detail Modal**
   - Recording player section
     - Audio player with controls
     - Duration display
     - Download button
   - AI Summary section
     - Overview text
     - Sentiment (Positive/Neutral/Negative)
     - Call Outcome
     - Action Items list
   - Full Transcript section
     - Timestamped entries
     - Speaker labels (Rep/Customer)
     - Scrollable view

4. **Audio Player Component**
   - Play/Pause
   - Seek bar
   - Current time / Duration
   - Playback speed (0.5x, 1x, 1.5x, 2x)
   - Volume control

5. **Export**
   - Export to CSV button
   - Download transcript

**Why Session 4:** Training and quality assurance feature.

---

### SESSION 5: Callbacks Enhancement
**Focus:** Complete the callbacks feature with full CRUD
**Reference:** Existing `/callbacks` + enhancements

**Tasks:**
1. **New Actions**
   - `rescheduleCallback.ts` - Change scheduled time
   - `cancelCallback.ts` - Mark as cancelled with reason
   - `completeCallback.ts` - Mark as completed with notes

2. **UI Updates**
   - Add "Reschedule" button to each callback card
   - Add "Cancel" button with confirmation
   - Add "Mark Complete" button with notes

3. **RescheduleCallbackModal Component**
   - Similar to ScheduleCallbackModal
   - Pre-filled with current date/time
   - Reason for rescheduling

4. **Callback History**
   - Show history of status changes
   - Notes/activity log per callback

**Why Session 5:** Quick win - callbacks partially built, just needs completion.

---

## Dependency Map

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        All 5 Sessions Can Run in Parallel                    │
├──────────────────┬──────────────────┬──────────────────┬────────────────────┤
│   Agent Queue    │  Agent Monitor   │   Call Newsfeed  │  Call History      │
│   (Session 1)    │   (Session 2)    │   (Session 3)    │  Enhanced (4)      │
│                  │                  │                  │                    │
│  /agent-queue    │  /agent-monitor  │   /newsfeed      │  /calls or         │
│                  │                  │                  │  /history          │
├──────────────────┴──────────────────┴──────────────────┴────────────────────┤
│                           Callbacks Enhancement (Session 5)                  │
│                                  /callbacks                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Files Each Session Will Touch

**Session 1 (Agent Queue):**
- `web/src/features/agent-queue/` (new folder)
  - components/ (QueuePage, QueueTable, QueueStats, AddToQueueModal)
  - actions/ (addToQueue.ts, removeFromQueue.ts, dispatchNow.ts, updatePriority.ts)
  - queries/ (getQueueItems.ts, getQueueStats.ts)
  - hooks/ (useAgentQueue.ts)
  - types.ts, index.ts
- `web/src/app/(dashboard)/agent-queue/page.tsx`
- `web/src/app/(dashboard)/layout.tsx` (add nav link)
- `web/supabase/migrations/YYYYMMDDHHMMSS_create_ai_queue.sql` (if needed)

**Session 2 (Agent Monitor):**
- `web/src/features/agent-monitor/` (new folder)
  - components/ (MonitorPage, ActiveCallsList, CallDetailsPanel, LiveTranscript)
  - queries/ (getActiveCalls.ts)
  - hooks/ (useAgentMonitor.ts, useLiveTranscript.ts)
  - types.ts, index.ts
- `web/src/app/(dashboard)/agent-monitor/page.tsx`
- `web/src/app/(dashboard)/layout.tsx` (add nav link)

**Session 3 (Call Newsfeed):**
- `web/src/features/newsfeed/` (new folder)
  - components/ (NewsfeedPage, FeedItem, QuickTagButtons, FeedStats)
  - actions/ (tagCall.ts, saveCallNotes.ts)
  - queries/ (getTodaysCalls.ts)
  - hooks/ (useNewsfeed.ts)
  - types.ts, index.ts
- `web/src/app/(dashboard)/newsfeed/page.tsx`
- `web/src/app/(dashboard)/layout.tsx` (add nav link)

**Session 4 (Call History Enhanced):**
- `web/src/features/call-history/` (new or update existing)
  - components/ (HistoryPage, CallCard, CallDetailModal, AudioPlayer, TranscriptView, AISummary)
  - queries/ (getCallHistory.ts, getCallTranscript.ts, getCallRecording.ts)
  - hooks/ (useCallHistory.ts, useAudioPlayer.ts)
  - types.ts, index.ts
- `web/src/app/(dashboard)/calls/page.tsx` or `/history/page.tsx`

**Session 5 (Callbacks Enhancement):**
- `web/src/features/callbacks/` (existing folder)
  - actions/ (add rescheduleCallback.ts, cancelCallback.ts, completeCallback.ts)
  - components/ (add RescheduleCallbackModal.tsx, update CallbackCard)
  - types.ts (add new types if needed)
- `web/src/app/(dashboard)/callbacks/page.tsx` (update)

---

## COPY-PASTE PROMPTS

### For Session 1: AI Agent Queue

```
I'm building an Outreach System (Next.js + Supabase + Twilio). I need you to build the AI AGENT QUEUE feature.

IMPORTANT:
1. Read development/CODING_STANDARDS.md first - follow these strictly
2. Enter plan mode to explore and create a plan before implementing
3. Reference the HTML mockup at: twilio-ai-coach/public/agent-queue.html

CODEBASE CONTEXT:
- Next.js 16 with App Router in web/src/app/
- Supabase for DB and auth
- Existing features: dashboard, contacts, calls, callbacks, messages, pipeline, supervisor, settings, activity
- Dashboard layout: web/src/app/(dashboard)/layout.tsx
- Existing DB tables: contacts, calls, sms_messages

BUILD THE AI AGENT QUEUE:

1. Create feature at web/src/features/agent-queue/ with:
   - components/ (QueuePage, QueueTable, QueueStats, AddToQueueModal, QueueItemRow)
   - actions/ (addToQueue.ts, removeFromQueue.ts, dispatchNow.ts, updatePriority.ts)
   - queries/ (getQueueItems.ts, getQueueStats.ts)
   - hooks/ (useAgentQueue.ts)
   - types.ts, index.ts

2. Create /agent-queue page at web/src/app/(dashboard)/agent-queue/page.tsx (max 50 lines)

3. May need database migration for ai_queue table:
   - id, contact_id, company_id, status (pending/in_progress/completed/failed/retry_scheduled)
   - priority (1=high, 2=normal), attempts, max_attempts, outcome
   - scheduled_at, created_at, updated_at

4. Features to implement:
   - Stats cards: Pending, In Progress, Completed Today, Cost Today
   - Queue table with columns: Contact, Status, Priority, Attempts, Outcome, Added, Actions
   - Add to Queue modal: Select contacts, set priority, optional schedule
   - Bulk actions: Dispatch Now, Prioritize, Cancel, Remove
   - Search and filter by status/priority/outcome

5. Add "AI Queue" link to dashboard navigation under "AI Agent" section

Follow all security rules from CODING_STANDARDS.md (auth check, company filter, .limit(), validate inputs).

Enter plan mode, explore, plan, then implement after approval.
```

---

### For Session 2: AI Agent Monitor

```
I'm building an Outreach System (Next.js + Supabase + Twilio). I need you to build the AI AGENT MONITOR feature.

IMPORTANT:
1. Read development/CODING_STANDARDS.md first - follow these strictly
2. Enter plan mode to explore and create a plan before implementing
3. Reference the HTML mockup at: twilio-ai-coach/public/agent-monitor.html

CODEBASE CONTEXT:
- Next.js 16 with App Router in web/src/app/
- Supabase for DB and auth
- Twilio integration for calls (may have WebSocket for live updates)
- Existing features: supervisor dashboard at /supervisor
- Dashboard layout: web/src/app/(dashboard)/layout.tsx

BUILD THE AI AGENT MONITOR:

1. Create feature at web/src/features/agent-monitor/ with:
   - components/ (MonitorPage, ActiveCallsList, CallCard, CallDetailsPanel, LiveTranscript, AIAnalysis)
   - queries/ (getActiveCalls.ts)
   - hooks/ (useAgentMonitor.ts, useLiveTranscript.ts)
   - types.ts, index.ts

2. Create /agent-monitor page at web/src/app/(dashboard)/agent-monitor/page.tsx (max 50 lines)

3. Features to implement:
   - Left panel: List of active AI calls
     - Contact name, phone number, duration
     - Status badges: Ringing, Connected, Ended
     - Click to select call
   - Right panel: Selected call details
     - Contact info, duration, estimated cost
     - Action buttons: Listen, End Call, View Contact
     - Live transcript (scrolling, timestamped)
     - AI Analysis: Sentiment, Intent, Confidence, Summary

4. Real-time updates:
   - Use polling (setInterval) or WebSocket if available
   - Auto-refresh active calls list
   - Update transcript as new lines come in

5. Add "AI Monitor" link to dashboard navigation under "AI Agent" section

6. Access control: Check user role = admin/manager (supervisor-level access)

Follow all security rules from CODING_STANDARDS.md.

Enter plan mode, explore existing supervisor code for patterns, plan, then implement after approval.
```

---

### For Session 3: Call Newsfeed

```
I'm building an Outreach System (Next.js + Supabase + Twilio). I need you to build the CALL NEWSFEED feature.

IMPORTANT:
1. Read development/CODING_STANDARDS.md first - follow these strictly
2. Enter plan mode to explore and create a plan before implementing
3. Reference the HTML mockup at: twilio-ai-coach/public/newsfeed.html

CODEBASE CONTEXT:
- Next.js 16 with App Router in web/src/app/
- Supabase for DB and auth
- Existing DB tables: calls (has outcome field), contacts
- Dashboard layout: web/src/app/(dashboard)/layout.tsx

BUILD THE CALL NEWSFEED:

1. Create feature at web/src/features/newsfeed/ with:
   - components/ (NewsfeedPage, FeedItem, QuickTagButtons, FeedStats, FeedFilters)
   - actions/ (tagCall.ts, saveCallNotes.ts)
   - queries/ (getTodaysCalls.ts)
   - hooks/ (useNewsfeed.ts)
   - types.ts, index.ts

2. Create /newsfeed page at web/src/app/(dashboard)/newsfeed/page.tsx (max 50 lines)

3. Features to implement:
   - Stats row: Total Calls, Booked, Estimates, Needs Action, Missed
   - Filter buttons: All, Needs Action, Booked, Estimates, Missed
   - Feed items showing:
     - Phone number, status (Connected/Missed/No Answer), time
     - Quick tag buttons: Booked, Gave Estimate, Question, Current Customer, Not Interested
     - AI summary (if available)
     - Notes input field
     - Actions: Call Back, View Transcript, Schedule Callback

4. Quick tagging:
   - One-click to tag call with outcome
   - Toggle off if clicked again
   - Update calls table outcome field
   - Highlight untagged calls ("Needs Action")

5. Real-time updates:
   - Use polling to refresh feed
   - New calls appear at top with slide animation

6. Add "Newsfeed" link to dashboard navigation (main section, near Dashboard)

Follow all security rules from CODING_STANDARDS.md.

Enter plan mode, explore, plan, then implement after approval.
```

---

### For Session 4: Call History Enhanced

```
I'm building an Outreach System (Next.js + Supabase + Twilio). I need you to build ENHANCED CALL HISTORY with recordings and transcripts.

IMPORTANT:
1. Read development/CODING_STANDARDS.md first - follow these strictly
2. Enter plan mode to explore and create a plan before implementing
3. Reference the HTML mockup at: twilio-ai-coach/public/history.html

CODEBASE CONTEXT:
- Next.js 16 with App Router in web/src/app/
- Supabase for DB and auth
- Twilio integration (recordings may have recording_url or recording_sid)
- Check existing /calls implementation
- DB table: calls (has duration_seconds, outcome, status, recording_url maybe)

BUILD ENHANCED CALL HISTORY:

1. Create/update feature at web/src/features/call-history/ with:
   - components/ (HistoryPage, CallCard, CallDetailModal, AudioPlayer, TranscriptView, AISummary)
   - queries/ (getCallHistory.ts, getCallTranscript.ts, getCallRecording.ts)
   - hooks/ (useCallHistory.ts, useAudioPlayer.ts)
   - types.ts, index.ts

2. Create /history page or update /calls page (max 50 lines)

3. Call List Features:
   - Filters: Date (Today, Yesterday, Week, Month, All), Status, Outcome
   - Search by phone number or notes
   - Sort: Newest, Oldest, Longest, Shortest
   - Pagination

4. Call Detail Modal Features:
   - Recording Section:
     - Audio player component with play/pause, seek, speed control, volume
     - Show "Recording not available" gracefully
   - AI Summary Section:
     - Overview text
     - Sentiment (Positive/Neutral/Negative with color)
     - Call Outcome
     - Action Items list
   - Transcript Section:
     - Timestamped entries
     - Speaker labels (Rep/Customer) with colors
     - Scrollable container

5. Audio Player Component (reusable):
   - Play/Pause button
   - Seek bar
   - Time display (current/total)
   - Playback speed selector (0.5x, 1x, 1.5x, 2x)
   - Volume control

6. Export buttons: Export to CSV, Download Transcript

Follow all security rules from CODING_STANDARDS.md.

Enter plan mode, explore existing calls code, plan, then implement after approval.
```

---

### For Session 5: Callbacks Enhancement

```
I'm building an Outreach System (Next.js + Supabase + Twilio). I need you to ENHANCE the existing CALLBACKS feature with full CRUD operations.

IMPORTANT:
1. Read development/CODING_STANDARDS.md first - follow these strictly
2. Enter plan mode to explore and create a plan before implementing

CODEBASE CONTEXT:
- Next.js 16 with App Router in web/src/app/
- Supabase for DB and auth
- Existing callbacks feature at web/src/features/callbacks/
- Existing: scheduleCallback action, ScheduleCallbackModal component
- Callbacks page at web/src/app/(dashboard)/callbacks/page.tsx
- DB table: callbacks (has id, contact_id, company_id, scheduled_at, status, priority, reason, attempt_count, assigned_to)

ENHANCE THE CALLBACKS FEATURE:

1. Add new actions to web/src/features/callbacks/actions/:
   - rescheduleCallback.ts - Update scheduled_at, increment attempt_count, set status to 'rescheduled'
   - cancelCallback.ts - Set status to 'cancelled', add cancellation reason
   - completeCallback.ts - Set status to 'completed', add completion notes

2. Update the callbacks page UI:
   - Add "Reschedule" button to each callback card (opens modal to pick new date/time)
   - Add "Cancel" button with confirmation dialog
   - Add "Mark Complete" button with optional notes input
   - Show callback history/activity log if available

3. Create RescheduleCallbackModal component (similar to ScheduleCallbackModal)

4. Update types.ts with any new types needed

5. Security: All actions must have auth check, company verification, validate callback belongs to user's company

Follow all security rules from CODING_STANDARDS.md.

Enter plan mode, explore existing callbacks code first, plan, then implement after approval.
```

---

## How to Start Parallel Sessions

1. **Open new VSCode window** or terminal
2. **Run `claude`** to start new Claude Code session
3. **Copy-paste one of the prompts above**

---

## Priority Order (if doing sequentially)

| Priority | Session | Reason |
|----------|---------|--------|
| 1 | Agent Queue (1) | Core AI functionality |
| 2 | Call Newsfeed (3) | High productivity value |
| 3 | Call History Enhanced (4) | Training/QA value |
| 4 | Callbacks Enhancement (5) | Quick win, almost done |
| 5 | Agent Monitor (2) | Needs Agent Queue first |

---

## Verification Checklist

After all sessions complete:
- [ ] Run `npm run build` - no errors
- [ ] Test /agent-queue page - add contacts, dispatch
- [ ] Test /agent-monitor page - shows active calls
- [ ] Test /newsfeed page - quick tagging works
- [ ] Test /history page - audio player works, transcripts show
- [ ] Test /callbacks page - reschedule/cancel/complete work
- [ ] Verify all new nav links work
- [ ] Check mobile responsiveness
- [ ] Verify security (can't access other company's data)
