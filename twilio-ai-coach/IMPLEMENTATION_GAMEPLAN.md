# Implementation Game Plan - Twilio AI Coach

## Overview

This document outlines the phased implementation plan to complete the Outreach System with multi-company support using Supabase.

---

## Phase 1: Foundation (Supabase + Multi-Company Schema)

### 1.1 Supabase Database Setup
**Goal:** Create the data model that supports multi-tenancy from day one.

**Tables to Create:**

```sql
-- Companies (tenants)
companies
├── id (uuid, primary key)
├── name (text)
├── slug (text, unique) -- for URLs like /company/acme
├── twilio_account_sid (text, nullable) -- company-specific Twilio
├── twilio_auth_token (text, nullable)
├── twilio_phone_number (text, nullable)
├── settings (jsonb) -- company-specific settings
├── created_at (timestamp)
└── updated_at (timestamp)

-- Users (with company membership)
users
├── id (uuid, primary key, links to Supabase Auth)
├── email (text)
├── full_name (text)
├── role (enum: 'admin', 'supervisor', 'rep')
├── created_at (timestamp)
└── updated_at (timestamp)

-- User-Company relationships (many-to-many)
company_members
├── id (uuid, primary key)
├── company_id (uuid, FK → companies)
├── user_id (uuid, FK → users)
├── role (enum: 'owner', 'admin', 'supervisor', 'rep')
├── is_active (boolean)
├── created_at (timestamp)
└── updated_at (timestamp)

-- Contacts (per company)
contacts
├── id (uuid, primary key)
├── company_id (uuid, FK → companies)
├── phone_number (text)
├── first_name (text)
├── last_name (text)
├── email (text, nullable)
├── tags (text[])
├── custom_fields (jsonb)
├── created_by (uuid, FK → users)
├── created_at (timestamp)
└── updated_at (timestamp)

-- Calls (per company)
calls
├── id (uuid, primary key)
├── company_id (uuid, FK → companies)
├── contact_id (uuid, FK → contacts, nullable)
├── user_id (uuid, FK → users) -- rep who handled
├── twilio_call_sid (text, unique)
├── phone_number (text)
├── direction (enum: 'inbound', 'outbound')
├── status (enum: 'completed', 'missed', 'no-answer', 'busy', 'failed')
├── outcome (text, nullable)
├── duration_seconds (integer)
├── recording_url (text, nullable)
├── transcript (jsonb) -- array of {speaker, text, timestamp}
├── ai_summary (text, nullable)
├── notes (text, nullable)
├── started_at (timestamp)
├── ended_at (timestamp)
└── created_at (timestamp)

-- Callbacks (per company)
callbacks
├── id (uuid, primary key)
├── company_id (uuid, FK → companies)
├── contact_id (uuid, FK → contacts, nullable)
├── call_id (uuid, FK → calls, nullable) -- original missed call
├── assigned_to (uuid, FK → users)
├── phone_number (text)
├── scheduled_at (timestamp)
├── status (enum: 'pending', 'in_progress', 'completed', 'cancelled', 'exhausted')
├── attempt_count (integer, default 0)
├── attempt_history (jsonb) -- array of attempts
├── notes (text, nullable)
├── created_at (timestamp)
└── updated_at (timestamp)

-- SMS Messages (per company)
sms_messages
├── id (uuid, primary key)
├── company_id (uuid, FK → companies)
├── contact_id (uuid, FK → contacts, nullable)
├── user_id (uuid, FK → users)
├── twilio_message_sid (text)
├── phone_number (text)
├── direction (enum: 'inbound', 'outbound')
├── body (text)
├── status (text)
├── created_at (timestamp)
└── updated_at (timestamp)
```

**Row Level Security (RLS):**
- All tables filtered by `company_id`
- Users can only see data from companies they belong to
- Admins see all company data, reps see only their assigned items

### 1.2 Authentication Setup
- Use Supabase Auth (email/password or magic link)
- Create auth flow pages: login.html, signup.html, forgot-password.html
- Add company selection after login (for users in multiple companies)
- Store session token, refresh automatically

### 1.3 API Layer Updates
- Create `/lib/supabase.js` server-side client
- Update all API endpoints to:
  - Validate user session
  - Filter by company_id
  - Use proper Supabase queries instead of in-memory

---

## Phase 2: Core Features Completion

### 2.1 Contacts Management
**Files:** `contacts.html`, `contact-profile.html`, `contacts-import.html`

**Features to Implement:**
- [ ] List contacts with search/filter
- [ ] Add new contact form
- [ ] Edit contact inline or in modal
- [ ] Delete contact (soft delete)
- [ ] View contact profile with call history
- [ ] Bulk import from CSV
- [ ] Tags/categorization
- [ ] Quick dial from contact

**API Endpoints:**
```
GET    /api/contacts              - List with pagination/filters
POST   /api/contacts              - Create contact
GET    /api/contacts/:id          - Get single contact
PUT    /api/contacts/:id          - Update contact
DELETE /api/contacts/:id          - Delete contact
POST   /api/contacts/import       - Bulk import from CSV
GET    /api/contacts/:id/history  - Call history for contact
```

### 2.2 Call History Enhancement
**File:** `history.html`

**Features to Implement:**
- [ ] Wire up existing UI to `/api/calls` endpoint
- [ ] Transcript viewer modal (already styled)
- [ ] Recording playback
- [ ] Filter by date range, outcome, rep
- [ ] Search by phone number or contact name
- [ ] Export to CSV
- [ ] Link calls to contacts

### 2.3 Callbacks System
**File:** `callbacks.html`

**Features to Implement:**
- [ ] Wire up to `/api/callbacks` and `/api/missed-calls`
- [ ] Schedule callback modal
- [ ] Attempt logging
- [ ] Status updates (mark complete, exhausted, etc.)
- [ ] Callback reminders/notifications
- [ ] Auto-assign to available reps

### 2.4 Dashboard Enhancements
**File:** `dashboard.html`

**Features to Implement:**
- [ ] Real stats from Supabase (not mock data)
- [ ] Date range selector for stats
- [ ] Rep leaderboard
- [ ] Recent activity feed
- [ ] Upcoming callbacks widget
- [ ] Quick actions (dial, add contact, etc.)

---

## Phase 3: Advanced Features

### 3.1 SMS Integration
**File:** `sms.html`

**Features to Implement:**
- [ ] Send SMS from UI
- [ ] Receive SMS via Twilio webhook
- [ ] Conversation view (threaded by contact)
- [ ] SMS templates
- [ ] Quick SMS from contact profile or call screen

**API Endpoints:**
```
GET    /api/sms/conversations     - List SMS threads
GET    /api/sms/conversation/:id  - Get messages for contact
POST   /api/sms/send              - Send SMS
POST   /webhook/sms               - Twilio incoming SMS webhook
```

### 3.2 Supervisor Dashboard
**File:** `supervisor.html`

**Features to Implement:**
- [ ] Live call monitoring (who's on calls)
- [ ] Listen to live calls (already partially wired)
- [ ] Whisper to rep (Twilio conference)
- [ ] Barge in to call
- [ ] Rep performance stats
- [ ] Queue management

### 3.3 AI Agent Queue
**Files:** `agent-queue.html`, `agent-monitor.html`

**Features to Implement:**
- [ ] Upload contact list for auto-dial
- [ ] Configure AI agent persona/script
- [ ] Start/stop/pause queue
- [ ] Monitor live AI calls
- [ ] Escalate to human rep
- [ ] Results tracking

---

## Phase 4: Multi-Company Features

### 4.1 Company Management
**New File:** `company-settings.html`

**Features:**
- [ ] Company profile editing
- [ ] Twilio credentials per company
- [ ] Invite team members
- [ ] Manage member roles
- [ ] Company-specific settings (callback attempts, etc.)

### 4.2 Company Switching
**UI Updates:**
- [ ] Company selector in header/sidebar
- [ ] Switch company without logout
- [ ] Default company preference
- [ ] Company-specific branding (logo, colors)

### 4.3 Super Admin Panel
**New File:** `admin.html` (for platform admins)

**Features:**
- [ ] View all companies
- [ ] Create new company
- [ ] Manage company subscriptions
- [ ] Platform-wide analytics
- [ ] User management across companies

---

## Phase 5: Polish & Production

### 5.1 UI/UX Improvements
- [ ] Loading states for all async operations
- [ ] Error handling with user-friendly messages
- [ ] Toast notifications for actions
- [ ] Keyboard shortcuts
- [ ] Accessibility audit

### 5.2 Performance
- [ ] Pagination everywhere
- [ ] Lazy loading for large lists
- [ ] Optimistic updates
- [ ] Caching strategy

### 5.3 Security
- [ ] Input validation on all forms
- [ ] CSRF protection
- [ ] Rate limiting
- [ ] Audit logging
- [ ] Secure credential storage

### 5.4 Deployment
- [ ] Environment configuration
- [ ] CI/CD pipeline
- [ ] Monitoring/alerting
- [ ] Backup strategy

---

## Implementation Order (Recommended)

### Week 1-2: Foundation
1. Set up Supabase tables with RLS
2. Create auth pages (login/signup)
3. Update server.js with Supabase client
4. Migrate calls to persist in Supabase

### Week 3-4: Core Features
5. Complete contacts management
6. Wire up call history page
7. Complete callbacks system
8. Enhance dashboard with real data

### Week 5-6: Advanced
9. SMS integration
10. Supervisor features
11. Company management
12. Multi-company switching

### Week 7-8: Polish
13. UI/UX improvements
14. Testing
15. Security hardening
16. Deployment

---

## Files to Create

```
/lib/
  supabase.js          -- Supabase client initialization
  auth.js              -- Auth helper functions
  middleware.js        -- Express middleware for auth

/public/
  login.html           -- Login page
  signup.html          -- Registration page
  company-settings.html -- Company management
  admin.html           -- Super admin panel (optional)

/migrations/
  001_initial_schema.sql -- Database schema
  002_seed_data.sql      -- Sample data
```

---

## Current File Status

| File | Action Needed |
|------|---------------|
| `dashboard.html` | Wire to Supabase, add real stats |
| `call.html` | Update to save calls to Supabase |
| `history.html` | Connect to /api/calls, add filters |
| `callbacks.html` | Full integration with API |
| `contacts.html` | Implement CRUD operations |
| `contacts-import.html` | Implement CSV parser + bulk insert |
| `contact-profile.html` | Wire up profile data + history |
| `sms.html` | Full Twilio SMS integration |
| `supervisor.html` | Live monitoring features |
| `agent-queue.html` | AI agent queue management |
| `agent-monitor.html` | AI call monitoring |
| `settings.html` | Company settings integration |
| `activity.html` | Real-time activity feed |
| `newsfeed.html` | Team updates/notifications |
| `pipeline.html` | Sales pipeline (future) |
| `server.js` | Major refactor for Supabase |

---

## Next Immediate Steps

1. **Create Supabase tables** - Run the schema in Supabase dashboard
2. **Add Supabase client** - Create `/lib/supabase.js`
3. **Create login page** - Basic auth flow
4. **Update server.js** - Replace in-memory with Supabase queries
5. **Test call persistence** - Make a call, verify it saves

Ready to start? Let me know which phase you'd like to begin with!
