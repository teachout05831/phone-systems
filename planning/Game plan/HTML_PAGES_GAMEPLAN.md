# Game Plan: Making All 18 HTML Pages Work

**Created:** January 23, 2026
**Updated:** January 23, 2026
**Goal:** Connect all HTML prototype pages to real backend APIs and Supabase database
**Standards:** Follow [CODING_STANDARDS.md](../../development/CODING_STANDARDS.md)

---

## Phase 0: Infrastructure & Deployment (DO THIS FIRST)

### 0.1 Hosting Architecture

| Service | What It Hosts | URL | Cost |
|---------|--------------|-----|------|
| **Vercel** | Next.js app (dashboard, contacts, queue, SMS, etc.) | `your-app.vercel.app` | Free tier |
| **Railway** | Express server (Twilio calls, Deepgram, AI coaching) | `your-app.railway.app` | ~$5/month |
| **Supabase** | PostgreSQL database + Auth | `your-project.supabase.co` | Free tier |

### 0.2 Why This Split?

- **Vercel** = Serverless (functions timeout after 10-60 seconds)
- **Railway** = Persistent server (can handle 30+ minute phone calls)
- **Supabase** = Shared database both services connect to

```
┌─────────────────────────────────────────────────────┐
│                     SUPABASE                        │
│              (PostgreSQL Database)                  │
│   contacts, calls, ai_queue, users, companies...   │
└─────────────────────────────────────────────────────┘
          ▲                           ▲
          │                           │
          │ reads/writes              │ reads/writes
          │                           │
┌─────────────────┐         ┌─────────────────────────┐
│    RAILWAY      │         │        VERCEL           │
│  Express Server │         │    Next.js App          │
│  (live calls)   │         │  (dashboard, contacts)  │
└─────────────────┘         └─────────────────────────┘
          ▲                           ▲
          │                           │
     Twilio calls              User's browser
```

### 0.3 Setup Steps

- [x] **Supabase:** Already set up with migrations
- [x] **Vercel:** Configuration ready (`web/vercel.json` created)
  - Deploy to Vercel and add environment variables (see `DEPLOYMENT.md`)
  - Variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- [x] **Railway:** Configuration ready (`twilio-ai-coach/railway.toml` created)
  - Deploy to Railway and add environment variables (see `DEPLOYMENT.md`)
  - Variables: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `TWILIO_*`, `DEEPGRAM_*`, `ANTHROPIC_*`
  - Health check endpoint added: `/health`
- [x] **Environment templates:** `.env.example` files created for both projects
- [x] **Deployment guide:** See `DEPLOYMENT.md` in project root

### 0.4 What Goes Where (CRITICAL)

| Feature | Build In | Folder | Why |
|---------|----------|--------|-----|
| Live phone calls | Express/Railway | `twilio-ai-coach/` | Needs persistent WebSocket |
| Deepgram transcription | Express/Railway | `twilio-ai-coach/` | Streams audio in real-time |
| AI coaching during calls | Express/Railway | `twilio-ai-coach/` | Real-time suggestions |
| **Everything else** | Next.js/Vercel | `web/` | Follows coding standards |

**Next.js handles:**
- Dashboard & stats
- Contacts (list, create, edit, delete, import)
- Call history
- Callbacks
- AI Queue management
- SMS messaging
- Pipeline
- Activity feed
- Settings
- Supervisor dashboard (non-real-time parts)

### 0.5 Slim Down server.js

**Current server.js does too much.** After implementation:

```javascript
// server.js should ONLY have:
// 1. Twilio voice webhooks (/voice-inbound, /voice-outbound, /voice-status)
// 2. Twilio Media Streams WebSocket
// 3. Deepgram WebSocket connection
// 4. AI coaching logic (Claude API during calls)
// 5. Supabase connection to log calls

// REMOVE from server.js (move to Next.js):
// - /api/contacts (all CRUD)
// - /api/callbacks
// - /api/stats
// - /api/ai-queue (management endpoints)
// - /api/sms
// - /api/activity
// - /api/settings
```

---

## Coding Standards Summary

From `development/CODING_STANDARDS.md`:

### File Structure (for Next.js web folder)
```
src/features/[feature-name]/
├── components/     # UI only (150 lines max)
├── hooks/          # State management (100 lines max)
├── actions/        # Database writes (80 lines max)
├── queries/        # Database reads (80 lines max)
├── types.ts        # Type definitions (150 lines max)
└── index.ts        # Public exports (30 lines max)
```

### Security Rules (MANDATORY)
Every query must:
1. Call `getUser()` first
2. Return error if no user
3. Filter data by `user.id`
4. Only select needed fields (never `select('*')`)
5. Use `.limit()` for lists

Every action must:
1. Call `getUser()` first
2. Return error if no user
3. Validate all inputs before processing
4. Verify ownership before update/delete

### Naming Conventions
| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `UserCard.tsx` |
| Hooks | camelCase with use | `useUsers.ts` |
| Queries | camelCase with get | `getUsers.ts` |
| Actions | camelCase verb | `createUser.ts` |

---

## Architecture Decision: Hybrid Approach (DECIDED)

We are using the **hybrid approach**. This is not a choice - it's the plan.

### The Split

| Where | What | Why |
|-------|------|-----|
| **Express/Railway** | Live calls only | Needs persistent WebSocket for 30+ min calls |
| **Next.js/Vercel** | Everything else | Follows [CODING_STANDARDS.md](../../development/CODING_STANDARDS.md), scales, type-safe |

### HTML Pages = Design Reference

The 18 HTML pages in `twilio-ai-coach/public/` are **prototypes only**. They show the UI design. We rebuild them as React components in Next.js following the coding standards.

### call.html is Special

`call.html` is the only page that needs the Express server for real-time features.

#### Two Call Modes (Build Both)

| Feature | Basic Mode | Advanced Mode |
|---------|-----------|---------------|
| Make/receive calls | ✅ Twilio | ✅ Twilio |
| Call recording | ✅ Twilio | ✅ Twilio |
| Transcription | ✅ Twilio Voice Intelligence (after call) | ✅ Deepgram (live streaming) |
| Save to database | ✅ | ✅ |
| Post-call analysis | ✅ AI reviews transcript after | ✅ AI reviews transcript after |
| Live AI coaching | ❌ | ✅ Real-time suggestions |
| Reliability | Higher (fewer connections) | Medium (more moving parts) |
| Server needed | Minimal Express | Full Express + WebSockets |

**Implementation:**
```javascript
// Toggle in settings or per-call
const callMode = user.settings.callMode || 'basic' // 'basic' or 'advanced'

if (callMode === 'basic') {
  // Direct Twilio connection
  // Twilio handles recording + transcription
  // Transcript webhook saves to Supabase after call
  // AI analyzes transcript post-call
} else {
  // Full pipeline through Express
  // Media Streams → Deepgram → live transcript
  // Claude provides real-time coaching suggestions
}
```

**Benefits of building both:**
- Basic mode works immediately, is reliable
- Advanced mode can be tested without breaking production
- Users/reps can choose based on their needs
- If Deepgram has issues, fall back to basic
- Basic mode is cheaper (no Deepgram costs)

All other pages are built entirely in Next.js

---

## Overview

There are **18 HTML pages** in `twilio-ai-coach/public/` that serve as UI prototypes.

### Current State
- **Frontend HTML:** Complete prototypes with demo data (twilio-ai-coach/public/)
- **Frontend React:** Partial components exist (web/src/features/)
- **Backend Express:** Real-time server with Twilio/Deepgram (twilio-ai-coach/server.js)
- **Backend Next.js:** API routes partially built (web/src/app/api/)
- **Database:** Supabase schema complete, partially integrated

---

## Complete Page Inventory

| # | Page | API Calls Needed | Backend Status | Priority |
|---|------|-----------------|----------------|----------|
| 1 | **dashboard.html** | `/api/stats`, `/api/calls`, `/api/missed-calls`, `/api/callbacks` | Implemented (in-memory) | HIGH |
| 2 | **call.html** | `/token`, WebSocket, `/api/customer-history`, `/api/call-outcome` | Implemented | HIGH |
| 3 | **contacts.html** | `/api/contacts` (CRUD) | **NOT IMPLEMENTED** | HIGH |
| 4 | **contacts-import.html** | `/api/contacts/import` | **NOT IMPLEMENTED** | MEDIUM |
| 5 | **contact-profile.html** | `/api/contacts/:id`, `/api/contacts/:id/calls` | **NOT IMPLEMENTED** | MEDIUM |
| 6 | **history.html** | `/api/calls` (filtering, pagination) | Implemented | HIGH |
| 7 | **callbacks.html** | `/api/callbacks`, `/api/missed-calls`, `/api/schedule-callback` | Implemented | HIGH |
| 8 | **sms.html** | `/api/sms/conversations`, `/api/sms/send` | **NOT IMPLEMENTED** | MEDIUM |
| 9 | **agent-queue.html** | `/api/ai-queue` (CRUD), `/api/ai-queue/dispatch` | **NOT IMPLEMENTED** | HIGH |
| 10 | **agent-monitor.html** | `/api/ai-calls/active`, WebSocket for live updates | **NOT IMPLEMENTED** | HIGH |
| 11 | **pipeline.html** | `/api/pipeline/stages`, `/api/pipeline/deals` | **NOT IMPLEMENTED** | LOW |
| 12 | **supervisor.html** | `/api/active-calls`, `/api/team-stats`, WebSocket | Partial | MEDIUM |
| 13 | **supervisor-mockup.html** | Same as supervisor | Partial | LOW |
| 14 | **settings.html** | `/api/settings`, `/api/user` | Partial | LOW |
| 15 | **activity.html** | `/api/activity-feed` | **NOT IMPLEMENTED** | LOW |
| 16 | **newsfeed.html** | `/api/newsfeed` | **NOT IMPLEMENTED** | LOW |
| 17 | **index.html** | Redirect only | Done | - |
| 18 | **sidebar-layout-mockup.html** | Layout template | N/A | - |

---

## Phase 1: Connect server.js to Supabase (For Call Logging Only)

The Express server only needs Supabase to log calls. All other data operations happen in Next.js.

### 1.1 Add Supabase to server.js

**File:** `twilio-ai-coach/server.js`

**Add at top:**
```javascript
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
```

### 1.2 What server.js Needs From Supabase

| Operation | When | Table |
|-----------|------|-------|
| Create call record | Call starts | `calls` |
| Update call status | Call ends | `calls` |
| Save transcript | During/after call | `call_transcripts` |
| Log AI suggestions | During call | `ai_coaching_logs` |

### 1.3 Remove In-Memory Arrays

**Delete these from server.js:**
```javascript
// DELETE THIS - move to Next.js
const db = {
  calls: [],
  missedCalls: [],
  callbacks: [],
  stats: {...}
};
```

### 1.4 Keep Only Call-Related Endpoints

**KEEP in server.js:**
- `/voice-inbound` - Twilio webhook
- `/voice-outbound` - Make call
- `/voice-status` - Call status updates
- `/media-stream` - WebSocket for audio
- `/token` - Twilio client token

**REMOVE from server.js (will rebuild in Next.js):**
- `/api/contacts` - All CRUD
- `/api/callbacks` - All CRUD
- `/api/stats` - Dashboard stats
- `/api/calls` - Call history (read-only)
- `/api/ai-queue` - Queue management
- All other `/api/*` endpoints

---

## Phase 2: Core Features in Next.js (Week 1)

All features built in `web/src/features/` following [CODING_STANDARDS.md](../../development/CODING_STANDARDS.md).

### 2.1 Dashboard Feature

**Folder:** `web/src/features/dashboard/`

**Structure:**
```
web/src/features/dashboard/
├── components/
│   ├── DashboardPage.tsx      # Main layout (150 lines max)
│   ├── StatsCards.tsx         # Today's stats display
│   ├── RecentCallsList.tsx    # Recent calls table
│   ├── CallbacksList.tsx      # Upcoming callbacks
│   └── index.ts
├── queries/
│   ├── getDashboardStats.ts   # Get today's call stats (80 lines max)
│   ├── getRecentCalls.ts      # Get last 10 calls
│   └── getUpcomingCallbacks.ts
├── types.ts
└── index.ts
```

**Work Needed:**
- [ ] Create `getDashboardStats.ts` query
- [ ] Create `getRecentCalls.ts` query
- [ ] Create `getUpcomingCallbacks.ts` query
- [ ] Build `DashboardPage.tsx` component (use dashboard.html as design reference)

---

### 2.2 Call Page (Two Modes - Build Both)

`call.html` stays in Express/Railway. Build both basic and advanced modes.

#### Basic Mode (Build First - More Reliable)
```
Browser ←→ Twilio Device (direct)
              ↓
         Twilio records + transcribes
              ↓
         Webhook delivers transcript
              ↓
         Save to Supabase
              ↓
         AI analyzes post-call
```

**Work Needed for Basic Mode:**
- [ ] Twilio Device setup in call.html
- [ ] Enable Twilio Voice Intelligence for transcription
- [ ] Webhook endpoint to receive transcript after call
- [ ] Save transcript to `call_transcripts` table
- [ ] Post-call AI analysis (Claude reviews transcript)
- [ ] Save analysis to `call_analysis` table

#### Advanced Mode (Build Second - More Features)
```
Browser ←→ Express ←→ Twilio Media Streams
                 ←→ Deepgram (live transcription)
                 ←→ Claude (real-time coaching)
```

**Work Needed for Advanced Mode:**
- [ ] Twilio Media Streams WebSocket
- [ ] Deepgram WebSocket connection
- [ ] Claude API for real-time suggestions
- [ ] WebSocket to browser for live updates
- [ ] Reconnection logic for dropped connections
- [ ] Fallback to basic mode if advanced fails

#### Shared (Both Modes)
- [ ] Connect Supabase for call logging
- [ ] Create call record when call starts
- [ ] Update call status when call ends
- [ ] Store transcripts in `call_transcripts` table
- [ ] Toggle switch in settings to choose mode
- [ ] Per-call mode override option

---

### 2.3 Contacts Feature

**Folder:** `web/src/features/contacts/`

**Structure:**
```
web/src/features/contacts/
├── components/
│   ├── ContactsPage.tsx       # Main page layout
│   ├── ContactList.tsx        # Table with search/filter
│   ├── ContactCard.tsx        # Single contact display
│   ├── ContactModal.tsx       # Create/edit modal
│   └── index.ts
├── hooks/
│   └── useContacts.ts         # State management (100 lines max)
├── actions/
│   ├── createContact.ts       # Database write (80 lines max)
│   ├── updateContact.ts
│   └── deleteContact.ts
├── queries/
│   ├── getContacts.ts         # Database read (80 lines max)
│   └── getContactById.ts
├── types.ts
└── index.ts
```

**Work Needed:**
- [ ] Create all query files with auth checks
- [ ] Create all action files with validation
- [ ] Build components (use contacts.html as design reference)
- [ ] Add search, filter, pagination

---

### 2.4 History Feature

**Folder:** `web/src/features/call-history/`

**Structure:**
```
web/src/features/call-history/
├── components/
│   ├── HistoryPage.tsx
│   ├── CallsTable.tsx
│   ├── CallDetailModal.tsx
│   └── index.ts
├── queries/
│   ├── getCalls.ts            # With date range, outcome filters
│   └── getCallById.ts
├── types.ts
└── index.ts
```

**Work Needed:**
- [ ] Create `getCalls.ts` with filtering and pagination
- [ ] Build components (use history.html as design reference)

---

### 2.5 Callbacks Feature

**Folder:** `web/src/features/callbacks/`

**Structure:**
```
web/src/features/callbacks/
├── components/
│   ├── CallbacksPage.tsx
│   ├── CallbackList.tsx
│   ├── ScheduleCallbackModal.tsx
│   └── index.ts
├── hooks/
│   └── useCallbacks.ts
├── actions/
│   ├── scheduleCallback.ts
│   ├── completeCallback.ts
│   └── deleteCallback.ts
├── queries/
│   ├── getCallbacks.ts
│   └── getMissedCalls.ts
├── types.ts
└── index.ts
```

**Work Needed:**
- [ ] Create all queries and actions
- [ ] Build components (use callbacks.html as design reference)

---

## Phase 3: AI Queue System in Next.js (Week 2)

### 3.1 Agent Queue Feature

**Folder:** `web/src/features/agent-queue/`

**Structure:**
```
web/src/features/agent-queue/
├── components/
│   ├── AgentQueuePage.tsx     # Main page layout
│   ├── QueueTable.tsx         # Queue items table
│   ├── QueueStats.tsx         # Stats cards (pending, in progress, etc.)
│   ├── AddToQueueModal.tsx    # Add contact to queue
│   ├── QueueItemActions.tsx   # Dispatch, remove, edit priority
│   └── index.ts
├── hooks/
│   └── useAgentQueue.ts       # State management (100 lines max)
├── actions/
│   ├── addToQueue.ts          # Add contact to queue (80 lines max)
│   ├── dispatchNow.ts         # Start AI call
│   ├── updatePriority.ts      # Change priority
│   └── removeFromQueue.ts     # Remove item
├── queries/
│   ├── getQueueItems.ts       # Get queue with filters (80 lines max)
│   └── getQueueStats.ts       # Get counts by status
├── types.ts
└── index.ts
```

**Work Needed:**
- [ ] Create all query files with auth + company_id filter
- [ ] Create all action files with validation
- [ ] Build components (use agent-queue.html as design reference)
- [ ] Add real-time updates via Supabase subscriptions

---

### 3.2 Agent Monitor Feature

**Folder:** `web/src/features/agent-monitor/`

**Structure:**
```
web/src/features/agent-monitor/
├── components/
│   ├── AgentMonitorPage.tsx   # Main page layout
│   ├── ActiveCallsList.tsx    # Currently active AI calls
│   ├── CallCard.tsx           # Single call with live info
│   └── index.ts
├── hooks/
│   └── useActiveCalls.ts      # Real-time updates
├── queries/
│   └── getActiveCalls.ts      # Get calls WHERE status='in_progress'
├── types.ts
└── index.ts
```

**Work Needed:**
- [ ] Create query for active AI calls
- [ ] Add Supabase real-time subscription for live updates
- [ ] Build components (use agent-monitor.html as design reference)

**Note:** The actual AI call is triggered by `dispatchNow.ts` which calls the Retell API or your AI calling service. The Express server handles the real-time audio/transcription once the call connects.

---

## Phase 4: Communication Features in Next.js (Week 2-3)

### 4.1 SMS Feature

**Folder:** `web/src/features/sms/`

**Structure:**
```
web/src/features/sms/
├── components/
│   ├── SmsPage.tsx            # Main page layout (conversation list + chat)
│   ├── ConversationList.tsx   # List of SMS threads
│   ├── ConversationItem.tsx   # Single thread preview
│   ├── ChatWindow.tsx         # Message display + input
│   ├── MessageBubble.tsx      # Single message
│   └── index.ts
├── hooks/
│   └── useSmsConversation.ts  # Manage active conversation
├── actions/
│   ├── sendSms.ts             # Send via Twilio (uses API route)
│   └── markAsRead.ts          # Mark messages read
├── queries/
│   ├── getConversations.ts    # Get all threads
│   └── getMessages.ts         # Get messages in thread
├── types.ts
└── index.ts
```

**Work Needed:**
- [ ] Create queries for conversations and messages
- [ ] Create `sendSms` action that calls Next.js API route
- [ ] Build API route `web/src/app/api/sms/send/route.ts` that calls Twilio
- [ ] Build components (use sms.html as design reference)
- [ ] Add webhook handler for incoming SMS

**Note:** SMS sending goes through a Next.js API route because it needs Twilio credentials on the server.

---

### 4.2 Contact Import Feature

**Add to:** `web/src/features/contacts/`

**Additional Files:**
```
web/src/features/contacts/
├── components/
│   ├── ...existing...
│   ├── ImportPage.tsx         # Import wizard
│   ├── CsvUploader.tsx        # File upload component
│   ├── ImportPreview.tsx      # Preview before import
│   └── ImportResults.tsx      # Success/error summary
├── actions/
│   ├── ...existing...
│   └── importContacts.ts      # Bulk import action
```

**Work Needed:**
- [ ] Create `importContacts.ts` action with validation
- [ ] Build import components (use contacts-import.html as design reference)
- [ ] Add CSV parsing logic
- [ ] Handle duplicate detection

---

## Phase 5: Additional Features in Next.js (Week 3-4)

### 5.1 Supervisor Feature

**Folder:** `web/src/features/supervisor/`

**Structure:**
```
web/src/features/supervisor/
├── components/
│   ├── SupervisorPage.tsx     # Main dashboard
│   ├── TeamStats.tsx          # Team performance metrics
│   ├── RepStatusList.tsx      # List of reps with status
│   ├── ActiveCallsMonitor.tsx # Live calls happening now
│   └── index.ts
├── queries/
│   ├── getTeamStats.ts        # Team metrics
│   ├── getRepStatuses.ts      # Rep online/offline status
│   └── getActiveCalls.ts      # Current live calls
├── types.ts
└── index.ts
```

**Work Needed:**
- [ ] Create team stats query
- [ ] Create rep status query
- [ ] Build components (use supervisor.html as design reference)
- [ ] Add Supabase real-time for live call updates

---

### 5.2 Pipeline Feature

**Folder:** `web/src/features/pipeline/`

**Structure:**
```
web/src/features/pipeline/
├── components/
│   ├── PipelinePage.tsx       # Kanban board layout
│   ├── PipelineColumn.tsx     # Single stage column
│   ├── DealCard.tsx           # Draggable deal card
│   ├── AddDealModal.tsx       # Create new deal
│   └── index.ts
├── hooks/
│   └── usePipeline.ts         # Drag-drop state
├── actions/
│   ├── createDeal.ts
│   ├── updateDealStage.ts     # Move between stages
│   └── deleteDeal.ts
├── queries/
│   ├── getStages.ts
│   └── getDeals.ts
├── types.ts
└── index.ts
```

**Work Needed:**
- [ ] Create stage and deal queries
- [ ] Create actions with validation
- [ ] Build drag-drop Kanban (use pipeline.html as design reference)

---

### 5.3 Activity Feed Feature

**Folder:** `web/src/features/activity/`

**Structure:**
```
web/src/features/activity/
├── components/
│   ├── ActivityPage.tsx       # Activity timeline
│   ├── ActivityList.tsx       # List of events
│   ├── ActivityItem.tsx       # Single event
│   └── index.ts
├── queries/
│   └── getActivityFeed.ts     # Get recent activity
├── types.ts
└── index.ts
```

**Work Needed:**
- [ ] Create activity query with pagination
- [ ] Build components (use activity.html as design reference)
- [ ] Add filters (by type, user, date)

---

### 5.4 Settings Feature

**Folder:** `web/src/features/settings/`

**Structure:**
```
web/src/features/settings/
├── components/
│   ├── SettingsPage.tsx       # Settings layout
│   ├── ProfileSettings.tsx    # User profile
│   ├── NotificationSettings.tsx
│   ├── IntegrationSettings.tsx # Twilio, etc.
│   └── index.ts
├── actions/
│   ├── updateProfile.ts
│   └── updateSettings.ts
├── queries/
│   └── getSettings.ts
├── types.ts
└── index.ts
```

**Work Needed:**
- [ ] Create settings queries and actions
- [ ] Build components (use settings.html as design reference)

---

### 5.5 Contact Profile Feature

**Add to:** `web/src/features/contacts/`

**Additional Files:**
```
web/src/features/contacts/
├── components/
│   ├── ...existing...
│   ├── ContactProfilePage.tsx # Full profile view
│   ├── ContactCallHistory.tsx # Calls with this contact
│   ├── ContactNotes.tsx       # Notes section
│   └── ContactActivity.tsx    # Activity timeline
├── queries/
│   ├── ...existing...
│   ├── getContactCalls.ts     # Calls for this contact
│   └── getContactActivity.ts  # Activity for this contact
```

**Work Needed:**
- [ ] Create contact detail queries
- [ ] Build profile components (use contact-profile.html as design reference)

---

## Implementation Order

### Phase 0: Infrastructure (Do First)
1. [ ] Set up Vercel deployment for `web/` folder
2. [ ] Set up Railway deployment for `twilio-ai-coach/` folder
3. [ ] Configure environment variables on both
4. [ ] Verify Supabase connections work

### Week 1: Foundation (Next.js)
5. [ ] Connect server.js to Supabase (call logging only)
6. [ ] Build Dashboard feature in Next.js
7. [ ] Build Contacts feature in Next.js
8. [ ] Build History feature in Next.js
9. [ ] Build Callbacks feature in Next.js

### Week 2: AI Queue + Communication (Next.js)
10. [ ] Build Agent Queue feature in Next.js
11. [ ] Build Agent Monitor feature in Next.js
12. [ ] Build SMS feature in Next.js
13. [ ] Add Twilio SMS webhook handler

### Week 3: Remaining Features (Next.js)
14. [ ] Build Contact Import feature
15. [ ] Build Supervisor feature
16. [ ] Build Pipeline feature
17. [ ] Build Activity Feed feature

### Week 4: Polish & Testing
18. [ ] Build Settings feature
19. [ ] Build Contact Profile feature
20. [ ] End-to-end testing
21. [ ] Error handling improvements
22. [ ] Deploy to production

---

## Files to Create/Modify

### Next.js App (`web/`)

| Feature | Folder | Files to Create |
|---------|--------|-----------------|
| Dashboard | `src/features/dashboard/` | queries, components, types |
| Contacts | `src/features/contacts/` | queries, actions, hooks, components, types |
| History | `src/features/call-history/` | queries, components, types |
| Callbacks | `src/features/callbacks/` | queries, actions, hooks, components, types |
| AI Queue | `src/features/agent-queue/` | queries, actions, hooks, components, types |
| Agent Monitor | `src/features/agent-monitor/` | queries, hooks, components, types |
| SMS | `src/features/sms/` | queries, actions, hooks, components, types |
| Supervisor | `src/features/supervisor/` | queries, components, types |
| Pipeline | `src/features/pipeline/` | queries, actions, hooks, components, types |
| Activity | `src/features/activity/` | queries, components, types |
| Settings | `src/features/settings/` | queries, actions, components, types |

### Express Server (`twilio-ai-coach/`)

**Modify:** `server.js`
- Add Supabase connection
- Keep only Twilio/Deepgram/AI coaching endpoints
- Remove all `/api/*` endpoints (move to Next.js)

### Database

- Already created: `web/supabase/migrations/00007_ai_queue.sql`
- May need: `sms_conversations`, `sms_messages`, `pipeline_stages`, `deals`, `activity_log` tables

### Pages (`web/src/app/`)

| Route | Page File |
|-------|-----------|
| `/dashboard` | `(dashboard)/page.tsx` |
| `/contacts` | `(dashboard)/contacts/page.tsx` |
| `/contacts/[id]` | `(dashboard)/contacts/[id]/page.tsx` |
| `/contacts/import` | `(dashboard)/contacts/import/page.tsx` |
| `/history` | `(dashboard)/history/page.tsx` |
| `/callbacks` | `(dashboard)/callbacks/page.tsx` |
| `/queue` | `(dashboard)/queue/page.tsx` |
| `/monitor` | `(dashboard)/monitor/page.tsx` |
| `/sms` | `(dashboard)/sms/page.tsx` |
| `/pipeline` | `(dashboard)/pipeline/page.tsx` |
| `/activity` | `(dashboard)/activity/page.tsx` |
| `/supervisor` | `(dashboard)/supervisor/page.tsx` |
| `/settings` | `(dashboard)/settings/page.tsx` |

---

## Testing Checklist

For each feature:
- [ ] Auth check works (redirects if not logged in)
- [ ] Data loads correctly
- [ ] Company filter applied (multi-tenant)
- [ ] Create/Update/Delete operations work
- [ ] Validation errors display
- [ ] Pagination works
- [ ] Filters work
- [ ] Real-time updates work (where applicable)
- [ ] Mobile responsive

---

## Parallel Development Opportunities

These can be worked on independently by different agents/developers:

| Stream | Feature | Next.js Folder | HTML Reference |
|--------|---------|----------------|----------------|
| **Stream 1** | Contacts | `src/features/contacts/` | contacts.html, contacts-import.html, contact-profile.html |
| **Stream 2** | AI Queue | `src/features/agent-queue/` + `agent-monitor/` | agent-queue.html, agent-monitor.html |
| **Stream 3** | SMS | `src/features/sms/` | sms.html |
| **Stream 4** | Reporting | `src/features/call-history/` + `activity/` + `pipeline/` | history.html, activity.html, pipeline.html |
| **Stream 5** | Admin | `src/features/supervisor/` + `settings/` | supervisor.html, settings.html |

Each stream:
- Creates files in its own folder (no conflicts)
- Uses its own database tables
- Can be developed and tested independently
- Uses HTML pages as UI design reference only

---

## Code Examples Following CODING_STANDARDS.md

### Example: Contacts Feature (Next.js)

Following the coding standards, here's how the contacts feature should be structured:

#### File Structure
```
web/src/features/contacts/
├── components/
│   ├── ContactList.tsx        # UI only (150 lines max)
│   ├── ContactCard.tsx
│   ├── ContactModal.tsx
│   └── index.ts
├── hooks/
│   └── useContacts.ts         # State management (100 lines max)
├── actions/
│   ├── createContact.ts       # Database writes (80 lines max)
│   ├── updateContact.ts
│   └── deleteContact.ts
├── queries/
│   ├── getContacts.ts         # Database reads (80 lines max)
│   └── getContactById.ts
├── types.ts                   # Type definitions
└── index.ts                   # Public exports
```

#### Query Example (getContacts.ts)
```typescript
// web/src/features/contacts/queries/getContacts.ts

import { createClient } from '@/lib/supabase/server'

interface ContactFilters {
  search?: string
  status?: string
  source?: string
  limit?: number
}

export async function getContacts(filters?: ContactFilters) {
  const supabase = await createClient()

  // SECURITY: Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Build query with user filter
  let query = supabase
    .from('contacts')
    .select('id, first_name, last_name, phone, email, status, source, created_at')
    .eq('company_id', user.user_metadata.company_id)  // Multi-tenant filter
    .limit(filters?.limit || 50)

  // Apply filters
  if (filters?.search) {
    query = query.or(`first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%`)
  }
  if (filters?.status) query = query.eq('status', filters.status)
  if (filters?.source) query = query.eq('source', filters.source)

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) throw error
  return data
}
```

#### Action Example (createContact.ts)
```typescript
// web/src/features/contacts/actions/createContact.ts

'use server'

import { createClient } from '@/lib/supabase/server'
import type { CreateContactInput } from '../types'

export async function createContact(input: CreateContactInput) {
  const supabase = await createClient()

  // SECURITY: Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // VALIDATION: Required fields
  if (!input.firstName || input.firstName.length < 2) {
    return { error: 'First name must be at least 2 characters' }
  }
  if (!input.phone || !/^\+?[\d\s\-()]+$/.test(input.phone)) {
    return { error: 'Valid phone number is required' }
  }

  // SECURITY: Attach to current user's company
  const { data, error } = await supabase
    .from('contacts')
    .insert({
      first_name: input.firstName,
      last_name: input.lastName || null,
      phone: input.phone,
      email: input.email || null,
      source: input.source || 'manual',
      status: 'new',
      company_id: user.user_metadata.company_id,
      created_by: user.id
    })
    .select('id, first_name, last_name, phone, email, status')
    .single()

  if (error) return { error: 'Failed to create contact' }
  return { success: true, data }
}
```

#### Hook Example (useContacts.ts)
```typescript
// web/src/features/contacts/hooks/useContacts.ts

'use client'

import { useState, useCallback } from 'react'
import { getContacts } from '../queries/getContacts'
import { deleteContact } from '../actions/deleteContact'
import type { Contact, ContactFilters } from '../types'

export function useContacts(initialContacts: Contact[]) {
  const [contacts, setContacts] = useState(initialContacts)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async (filters?: ContactFilters) => {
    setIsLoading(true)
    setError(null)
    try {
      const fresh = await getContacts(filters)
      setContacts(fresh)
    } catch (e) {
      setError('Failed to load contacts')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    const result = await deleteContact(id)
    if (result.success) await refresh()
    return result
  }, [refresh])

  return { contacts, isLoading, error, refresh, handleDelete }
}
```

#### Types Example (types.ts)
```typescript
// web/src/features/contacts/types.ts

export interface Contact {
  id: string
  firstName: string
  lastName: string | null
  phone: string
  email: string | null
  status: 'new' | 'contacted' | 'qualified' | 'unqualified'
  source: 'manual' | 'facebook' | 'google' | 'website' | 'referral'
  companyId: string
  createdAt: Date
}

export interface CreateContactInput {
  firstName: string
  lastName?: string
  phone: string
  email?: string
  source?: Contact['source']
}

export interface ContactFilters {
  search?: string
  status?: Contact['status']
  source?: Contact['source']
  limit?: number
}
```

---

### Example: AI Queue Feature (Next.js)

#### File Structure
```
web/src/features/agent-queue/
├── components/
│   ├── AgentQueuePage.tsx
│   ├── QueueTable.tsx
│   ├── QueueStats.tsx
│   ├── AddToQueueModal.tsx
│   └── index.ts
├── hooks/
│   └── useAgentQueue.ts
├── actions/
│   ├── addToQueue.ts
│   ├── dispatchNow.ts
│   ├── updatePriority.ts
│   └── removeFromQueue.ts
├── queries/
│   ├── getQueueItems.ts
│   └── getQueueStats.ts
├── types.ts
└── index.ts
```

#### Query Example (getQueueItems.ts)
```typescript
// web/src/features/agent-queue/queries/getQueueItems.ts

import { createClient } from '@/lib/supabase/server'

export async function getQueueItems(status?: string) {
  const supabase = await createClient()

  // SECURITY: Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  let query = supabase
    .from('ai_queue')
    .select(`
      id, status, priority, attempts, max_attempts,
      outcome, notes, scheduled_at, created_at,
      contacts (id, first_name, last_name, phone)
    `)
    .eq('company_id', user.user_metadata.company_id)
    .limit(100)

  if (status) query = query.eq('status', status)

  const { data, error } = await query
    .order('priority')
    .order('created_at')

  if (error) throw error
  return data
}
```

#### Action Example (dispatchNow.ts)
```typescript
// web/src/features/agent-queue/actions/dispatchNow.ts

'use server'

import { createClient } from '@/lib/supabase/server'

export async function dispatchNow(queueId: string) {
  const supabase = await createClient()

  // SECURITY: Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // VALIDATION
  if (!queueId) return { error: 'Queue ID is required' }

  // SECURITY: Ownership check
  const { data: existing } = await supabase
    .from('ai_queue')
    .select('id, company_id, status')
    .eq('id', queueId)
    .single()

  if (!existing) return { error: 'Queue item not found' }
  if (existing.company_id !== user.user_metadata.company_id) {
    return { error: 'Not authorized' }
  }
  if (existing.status !== 'pending') {
    return { error: 'Item is not in pending status' }
  }

  // Update status
  const { data, error } = await supabase
    .from('ai_queue')
    .update({
      status: 'in_progress',
      last_attempt_at: new Date().toISOString(),
      attempts: existing.attempts + 1
    })
    .eq('id', queueId)
    .select()
    .single()

  if (error) return { error: 'Failed to dispatch' }

  // TODO: Trigger actual AI call via Retell API here

  return { success: true, data }
}
```

---

## Security Checklist (from CODING_STANDARDS.md)

Before submitting any code:

- [ ] Auth check (`getUser()`) in every query and action
- [ ] Ownership check before update/delete
- [ ] Only selecting needed fields (no `select('*')`)
- [ ] Inputs validated before processing
- [ ] No sensitive data exposed in responses
- [ ] Role check for admin features
- [ ] Files under line limits
- [ ] Queries have `.limit()`
- [ ] No database calls inside loops

---

## Agent Prompts (Copy & Paste)

Use these prompts to dispatch work to parallel agents. Each prompt is self-contained.

**Add this to the start of ANY prompt you give an agent:**
```
BEFORE YOU START:
1. Read the game plan file thoroughly - it contains architecture decisions, code examples, and security requirements
2. Read the coding standards file - all code must follow these patterns
3. Look at the HTML files listed - they show exactly how the UI should look
4. Do NOT skip reading these files - they have everything you need

Working directory: c:\Users\teach\OneDrive\Desktop\Outreach System WebSite
```

---

### Prompt: Phase 0 - Infrastructure Setup

```
TASK: Set up deployment infrastructure

READ THESE FILES FIRST:
1. planning/Game plan/HTML_PAGES_GAMEPLAN.md - Section "Phase 0: Infrastructure & Deployment"
2. development/CODING_STANDARDS.md

WHAT TO DO:
1. Set up Vercel deployment for the `web/` folder
2. Set up Railway deployment for the `twilio-ai-coach/` folder
3. Configure environment variables on both platforms
4. Verify Supabase connections work from both

ENVIRONMENT VARIABLES NEEDED:
- Vercel: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
- Railway: SUPABASE_URL, SUPABASE_SERVICE_KEY, TWILIO_*, DEEPGRAM_*, ANTHROPIC_*

DO NOT write code for features yet. This is infrastructure only.
```

---

### Prompt: Phase 1 - Server.js Supabase Connection

```
TASK: Connect Express server to Supabase for call logging

READ THESE FILES FIRST:
1. planning/Game plan/HTML_PAGES_GAMEPLAN.md - Section "Phase 1: Connect server.js to Supabase"
2. development/CODING_STANDARDS.md
3. twilio-ai-coach/server.js (current implementation)

WHAT TO DO:
1. Add Supabase client to server.js
2. Replace in-memory arrays with Supabase calls for:
   - Creating call records when calls start
   - Updating call status when calls end
   - Saving transcripts to call_transcripts table
3. KEEP only these endpoints: /voice-inbound, /voice-outbound, /voice-status, /media-stream, /token
4. REMOVE all /api/* endpoints (they move to Next.js)

IMPORTANT: Server.js handles ONLY live call functionality. Everything else goes to Next.js.
```

---

### Prompt: Stream 1 - Contacts Feature

```
TASK: Build the Contacts feature in Next.js

READ THESE FILES FIRST:
1. planning/Game plan/HTML_PAGES_GAMEPLAN.md - Sections 2.3 and 5.5
2. development/CODING_STANDARDS.md
3. twilio-ai-coach/public/contacts.html (design reference)
4. twilio-ai-coach/public/contacts-import.html (design reference)
5. twilio-ai-coach/public/contact-profile.html (design reference)

BUILD IN: web/src/features/contacts/

CREATE THESE FILES:
- queries/getContacts.ts, getContactById.ts, getContactCalls.ts, getContactActivity.ts
- actions/createContact.ts, updateContact.ts, deleteContact.ts, importContacts.ts
- hooks/useContacts.ts
- components/ContactsPage.tsx, ContactList.tsx, ContactCard.tsx, ContactModal.tsx
- components/ContactProfilePage.tsx, ContactCallHistory.tsx, ContactNotes.tsx
- components/ImportPage.tsx, CsvUploader.tsx, ImportPreview.tsx, ImportResults.tsx
- types.ts, index.ts

CREATE THESE PAGES:
- web/src/app/(dashboard)/contacts/page.tsx
- web/src/app/(dashboard)/contacts/[id]/page.tsx
- web/src/app/(dashboard)/contacts/import/page.tsx

SECURITY REQUIREMENTS:
- Auth check (getUser()) in every query and action
- Filter by company_id for multi-tenant
- Validate all inputs before processing
- Use .limit() on queries, never select('*')

Use the HTML files as design reference for the UI layout.
```

---

### Prompt: Stream 2 - AI Queue Feature

```
TASK: Build the AI Queue and Agent Monitor features in Next.js

READ THESE FILES FIRST:
1. planning/Game plan/HTML_PAGES_GAMEPLAN.md - Sections 3.1 and 3.2
2. development/CODING_STANDARDS.md
3. twilio-ai-coach/public/agent-queue.html (design reference)
4. twilio-ai-coach/public/agent-monitor.html (design reference)
5. web/supabase/migrations/00007_ai_queue.sql (database schema)

BUILD IN:
- web/src/features/agent-queue/
- web/src/features/agent-monitor/

CREATE FOR AGENT QUEUE:
- queries/getQueueItems.ts, getQueueStats.ts
- actions/addToQueue.ts, dispatchNow.ts, updatePriority.ts, removeFromQueue.ts
- hooks/useAgentQueue.ts
- components/AgentQueuePage.tsx, QueueTable.tsx, QueueStats.tsx, AddToQueueModal.tsx, QueueItemActions.tsx
- types.ts, index.ts

CREATE FOR AGENT MONITOR:
- queries/getActiveCalls.ts
- hooks/useActiveCalls.ts (with Supabase real-time subscription)
- components/AgentMonitorPage.tsx, ActiveCallsList.tsx, CallCard.tsx
- types.ts, index.ts

CREATE THESE PAGES:
- web/src/app/(dashboard)/queue/page.tsx
- web/src/app/(dashboard)/monitor/page.tsx

SECURITY REQUIREMENTS:
- Auth check (getUser()) in every query and action
- Filter by company_id for multi-tenant
- Ownership check before dispatch/update/delete
- Validate queue item exists and is in correct status before dispatch

Use the HTML files as design reference for the UI layout.
```

---

### Prompt: Stream 3 - SMS Feature

```
TASK: Build the SMS messaging feature in Next.js

READ THESE FILES FIRST:
1. planning/Game plan/HTML_PAGES_GAMEPLAN.md - Section 4.1
2. development/CODING_STANDARDS.md
3. twilio-ai-coach/public/sms.html (design reference)

BUILD IN: web/src/features/sms/

CREATE THESE FILES:
- queries/getConversations.ts, getMessages.ts
- actions/sendSms.ts, markAsRead.ts
- hooks/useSmsConversation.ts
- components/SmsPage.tsx, ConversationList.tsx, ConversationItem.tsx, ChatWindow.tsx, MessageBubble.tsx
- types.ts, index.ts

CREATE API ROUTE:
- web/src/app/api/sms/send/route.ts (calls Twilio to send SMS)
- web/src/app/api/sms/webhook/route.ts (receives incoming SMS from Twilio)

CREATE PAGE:
- web/src/app/(dashboard)/sms/page.tsx

DATABASE: You may need to create migration for sms_conversations and sms_messages tables if not exists.

SECURITY REQUIREMENTS:
- Auth check (getUser()) in every query and action
- Filter conversations by company_id
- Validate phone numbers before sending
- Use .limit() on message queries

Use the HTML file as design reference for the UI layout.
```

---

### Prompt: Stream 4 - Reporting Features

```
TASK: Build Call History, Activity Feed, and Pipeline features in Next.js

READ THESE FILES FIRST:
1. planning/Game plan/HTML_PAGES_GAMEPLAN.md - Sections 2.4, 5.2, and 5.3
2. development/CODING_STANDARDS.md
3. twilio-ai-coach/public/history.html (design reference)
4. twilio-ai-coach/public/activity.html (design reference)
5. twilio-ai-coach/public/pipeline.html (design reference)

BUILD IN:
- web/src/features/call-history/
- web/src/features/activity/
- web/src/features/pipeline/

CREATE FOR CALL HISTORY:
- queries/getCalls.ts (with date range, outcome, direction filters), getCallById.ts
- components/HistoryPage.tsx, CallsTable.tsx, CallDetailModal.tsx
- types.ts, index.ts

CREATE FOR ACTIVITY FEED:
- queries/getActivityFeed.ts (with pagination and filters)
- components/ActivityPage.tsx, ActivityList.tsx, ActivityItem.tsx
- types.ts, index.ts

CREATE FOR PIPELINE:
- queries/getStages.ts, getDeals.ts
- actions/createDeal.ts, updateDealStage.ts, deleteDeal.ts
- hooks/usePipeline.ts (for drag-drop state)
- components/PipelinePage.tsx, PipelineColumn.tsx, DealCard.tsx, AddDealModal.tsx
- types.ts, index.ts

CREATE THESE PAGES:
- web/src/app/(dashboard)/history/page.tsx
- web/src/app/(dashboard)/activity/page.tsx
- web/src/app/(dashboard)/pipeline/page.tsx

DATABASE: You may need to create migrations for pipeline_stages, deals, activity_log tables if not exists.

SECURITY REQUIREMENTS:
- Auth check (getUser()) in every query and action
- Filter by company_id for multi-tenant
- Use .limit() and pagination on all list queries

Use the HTML files as design reference for the UI layout.
```

---

### Prompt: Stream 5 - Admin Features

```
TASK: Build Dashboard, Callbacks, Supervisor, and Settings features in Next.js

READ THESE FILES FIRST:
1. planning/Game plan/HTML_PAGES_GAMEPLAN.md - Sections 2.1, 2.5, 5.1, and 5.4
2. development/CODING_STANDARDS.md
3. twilio-ai-coach/public/dashboard.html (design reference)
4. twilio-ai-coach/public/callbacks.html (design reference)
5. twilio-ai-coach/public/supervisor.html (design reference)
6. twilio-ai-coach/public/settings.html (design reference)

BUILD IN:
- web/src/features/dashboard/
- web/src/features/callbacks/
- web/src/features/supervisor/
- web/src/features/settings/

CREATE FOR DASHBOARD:
- queries/getDashboardStats.ts, getRecentCalls.ts, getUpcomingCallbacks.ts
- components/DashboardPage.tsx, StatsCards.tsx, RecentCallsList.tsx, CallbacksList.tsx
- types.ts, index.ts

CREATE FOR CALLBACKS:
- queries/getCallbacks.ts, getMissedCalls.ts
- actions/scheduleCallback.ts, completeCallback.ts, deleteCallback.ts
- hooks/useCallbacks.ts
- components/CallbacksPage.tsx, CallbackList.tsx, ScheduleCallbackModal.tsx
- types.ts, index.ts

CREATE FOR SUPERVISOR:
- queries/getTeamStats.ts, getRepStatuses.ts, getActiveCalls.ts
- components/SupervisorPage.tsx, TeamStats.tsx, RepStatusList.tsx, ActiveCallsMonitor.tsx
- types.ts, index.ts

CREATE FOR SETTINGS:
- queries/getSettings.ts
- actions/updateProfile.ts, updateSettings.ts
- components/SettingsPage.tsx, ProfileSettings.tsx, NotificationSettings.tsx, IntegrationSettings.tsx
- types.ts, index.ts

CREATE THESE PAGES:
- web/src/app/(dashboard)/page.tsx (dashboard)
- web/src/app/(dashboard)/callbacks/page.tsx
- web/src/app/(dashboard)/supervisor/page.tsx
- web/src/app/(dashboard)/settings/page.tsx

SECURITY REQUIREMENTS:
- Auth check (getUser()) in every query and action
- Filter by company_id for multi-tenant
- Supervisor features need role check (only managers/admins)
- Use .limit() on all list queries

Use the HTML files as design reference for the UI layout.
```

---

### Prompt: Call Page - Basic Mode

```
TASK: Implement Basic Call Mode in call.html

READ THESE FILES FIRST:
1. planning/Game plan/HTML_PAGES_GAMEPLAN.md - Section 2.2 "Basic Mode"
2. twilio-ai-coach/public/call.html (current implementation)
3. twilio-ai-coach/server.js (current server)

WHAT TO DO:
1. Set up Twilio Device connection in call.html
2. Enable Twilio Voice Intelligence for automatic transcription
3. Create webhook endpoint in server.js to receive transcripts after call ends
4. Save transcripts to Supabase `call_transcripts` table
5. After call ends, send transcript to Claude for analysis
6. Save analysis to Supabase `call_analysis` table

BASIC MODE FLOW:
Browser ←→ Twilio Device (direct connection)
Twilio automatically records and transcribes
Webhook delivers transcript to server.js
Server saves to Supabase and triggers AI analysis

DO NOT implement Deepgram or real-time AI coaching - that's Advanced Mode.
```

---

### Prompt: Call Page - Advanced Mode

```
TASK: Implement Advanced Call Mode with live AI coaching

READ THESE FILES FIRST:
1. planning/Game plan/HTML_PAGES_GAMEPLAN.md - Section 2.2 "Advanced Mode"
2. twilio-ai-coach/public/call.html (current implementation)
3. twilio-ai-coach/server.js (current server)

WHAT TO DO:
1. Set up Twilio Media Streams WebSocket in server.js
2. Connect Deepgram WebSocket for live transcription
3. Send transcript chunks to Claude API for real-time coaching suggestions
4. WebSocket connection to browser to show live transcript and AI suggestions
5. Implement reconnection logic if WebSocket drops
6. Add fallback to Basic Mode if Deepgram/Claude fails

ADVANCED MODE FLOW:
Browser ←→ Express ←→ Twilio Media Streams (audio)
Express ←→ Deepgram (live transcription)
Express ←→ Claude (real-time coaching)
Express ←→ Browser WebSocket (live updates)

IMPORTANT: This builds ON TOP of Basic Mode. Basic Mode should work first.
```
