# Development Workflow

Systematic process for building applications with multi-agent development and automated QA.

---

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    DEVELOPMENT PIPELINE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Phase 1: Game Plan / Research                                  │
│      ↓                                                          │
│  Phase 2: Design Selection                                      │
│      ↓                                                          │
│  Phase 3: Page Planning                                         │
│      ↓                                                          │
│  Phase 4: HTML Build ──────→ [5-6 Agents] ──→ Comet Test       │
│      ↓                            ↑                             │
│  Phase 5: Feature Dev ─────→ [5-10 Agents] ──→ Comet Test      │
│      ↓                            ↑                             │
│  Phase 6: Test & Fix Loop ←─────────────────────────────────   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Key Principle:** Every agent applies Ralph Wiggum validation (self-test as you build), then Comet does external testing.

---

## Phase 1: Game Plan / Research

**Goal:** Define what we're building

**Activities:**
- Define project scope
- Identify features needed
- Research technical requirements
- Document decisions

**Output:** Project brief / requirements doc

**Agents:** 1 (planning agent)

---

## Phase 2: Design Selection

**Goal:** Choose visual design direction

**Activities:**
- Review design options
- Select design system / components
- Define color scheme, typography
- Create style guide reference

**Output:** Design reference / style guide

**Agents:** 1 (can be manual)

---

## Phase 3: Page Planning

**Goal:** Define all pages and their structure

**Activities:**
- List all pages needed
- Define page hierarchy / navigation
- Sketch component structure per page
- Identify shared components

**Output:** Page list with component breakdown

**Agents:** 1 (planning agent)

**Sample Output:**
```
Pages:
1. Home - Hero, Features, CTA
2. Dashboard - Sidebar, Stats, Table
3. Settings - Form, Tabs
4. Profile - Avatar, Form, Activity
...
```

---

## Phase 4: HTML Build

**Goal:** Build all page structures in HTML/JSX

### Agent Deployment

| Pages | Agents | Strategy |
|-------|--------|----------|
| 1-3 | 1-2 | Sequential |
| 4-6 | 3-4 | Parallel |
| 7-10 | 5-6 | Parallel |
| 10+ | 6 | Batched parallel |

### Agent Prompt Template

```
You are building the HTML/JSX structure for [PAGE NAME].

## Your Task
Build the page structure based on this spec:
- Components needed: [LIST]
- Layout: [DESCRIPTION]
- Design reference: [LINK/DESCRIPTION]

## Ralph Wiggum Validation (DO THIS AS YOU BUILD)
After completing each component, verify:
1. [ ] Component renders without errors
2. [ ] Responsive breakpoints work (mobile, tablet, desktop)
3. [ ] Semantic HTML used (proper headings, landmarks)
4. [ ] Accessibility basics (alt text, labels, contrast)
5. [ ] No console errors/warnings

## Output
- The completed page file
- List of any issues found during self-validation
- List of components that may need shared extraction
```

### After HTML Build → Trigger Comet

**Comet Testing Prompt (Phase 4):**
```
Test all pages that were just built in Phase 4 (HTML Build).

For each page:
1. Navigate to the page
2. Check visual rendering at mobile, tablet, desktop
3. Check for console errors
4. Check basic accessibility (run axe or similar)
5. Check all links/buttons are present (even if not functional yet)
6. Take screenshots of any issues

Log all issues to the QA system with:
- Category: 'ux' or 'accessibility'
- Page path
- Description of issue
- Screenshot if visual
```

---

## Phase 5: Feature Development

**Goal:** Implement all functionality

**Story-by-story execution:** See `STORY_WORKFLOW.md` for working through PRD stories one at a time.

### Agent Deployment

| Features | Agents | Strategy |
|----------|--------|----------|
| 1-3 | 2-3 | Sequential or parallel |
| 4-8 | 5-6 | Parallel by feature |
| 9+ | 6-10 | Batched parallel |

### Agent Prompt Template

```
You are implementing [FEATURE NAME].

## Your Task
Implement this feature:
- Description: [WHAT IT DOES]
- Files involved: [LIST]
- API endpoints needed: [LIST]
- Database tables: [LIST]

## Ralph Wiggum Validation (DO THIS AS YOU BUILD)
After each step, verify:

1. **Auth Check**
   - [ ] getUser() called before data access
   - [ ] Unauthorized users handled

2. **Input Validation**
   - [ ] All inputs validated before processing
   - [ ] Type checking in place
   - [ ] Edge cases handled (empty, null, too long)

3. **Database Operations**
   - [ ] Using .limit() on queries
   - [ ] Filtering by user_id where needed
   - [ ] Only selecting needed fields (no select *)
   - [ ] Error handling on all operations

4. **Frontend**
   - [ ] Loading states shown
   - [ ] Error states handled
   - [ ] Success feedback given
   - [ ] No console errors

5. **Security**
   - [ ] No secrets in client code
   - [ ] Server actions for sensitive operations
   - [ ] Ownership verified before update/delete

## Output
- The completed feature code
- List of any issues found during self-validation
- Any concerns or edge cases to note
```

### After Feature Cycle → Trigger Comet

**Comet Testing Prompt (Phase 5):**
```
Test the features that were just implemented in this cycle.

Features to test: [LIST FROM CYCLE]

For each feature:
1. Test the happy path (normal usage)
2. Test error cases (bad input, unauthorized)
3. Test edge cases (empty data, large data)
4. Check for console errors during all tests
5. Verify loading and error states display
6. Check data persists correctly

Log all issues to the QA system with:
- Category: 'error', 'security', 'ux', or 'performance'
- Severity: 'critical', 'warning', or 'info'
- Steps to reproduce
- Screenshot if applicable
```

---

## Phase 6: Test & Fix Loop

**Goal:** Iterate until quality threshold met

### The Loop

```
┌────────────────────────────────────────┐
│                                        │
│   Comet Tests → Issues Created         │
│        ↓                               │
│   Review Issues in QA Dashboard        │
│        ↓                               │
│   Assign to Agents by Category         │
│        ↓                               │
│   Agents Fix (with Ralph Wiggum)       │
│        ↓                               │
│   Mark Issues as Fixed                 │
│        ↓                               │
│   Comet Re-tests ──────────────────────┘
│        ↓
│   Quality Threshold Met? → Deploy
│
└────────────────────────────────────────┘
```

### Agent Fix Prompt Template

```
You are fixing issues from QA testing.

## Issues Assigned to You
[PASTE ISSUES FROM QA DASHBOARD]

## For Each Issue
1. Read the issue details and reproduction steps
2. Find the root cause
3. Implement the fix
4. Apply Ralph Wiggum validation:
   - [ ] Fix addresses the root cause, not just symptoms
   - [ ] Fix doesn't break other functionality
   - [ ] Fix follows coding standards
   - [ ] No new console errors introduced
5. Update the issue status to 'fixed' with notes

## Output
- List of fixes made
- Any issues that need clarification
- Any related issues discovered
```

### Comet Re-test Prompt

```
Re-test the issues that were marked as fixed.

Issues to verify: [LIST FROM QA DASHBOARD]

For each issue:
1. Follow the original reproduction steps
2. Verify the issue is resolved
3. Check for regression (did fix break anything else?)
4. If fixed: confirm in QA system
5. If not fixed: add notes and keep open

Also do a general smoke test:
- Navigate through main user flows
- Check for any new issues
- Log anything found
```

---

## Quality Thresholds

### Ready for Next Phase

| Metric | Threshold |
|--------|-----------|
| Critical issues | 0 |
| Error issues | 0 |
| Warning issues | < 5 |
| Info issues | No limit |

### Ready for Deploy

| Metric | Threshold |
|--------|-----------|
| Critical issues | 0 |
| Error issues | 0 |
| Security issues | 0 |
| Warning issues | < 3 (documented exceptions) |

---

## Agent Coordination

### Parallel Agent Rules

1. **Assign by boundary** - Each agent owns specific files/features
2. **No overlapping files** - Avoid merge conflicts
3. **Shared components** - One agent owns, others consume
4. **Communication** - Document dependencies between agents

### Sample 6-Agent Split (Feature Dev)

```
Agent 1: Authentication (login, signup, password reset)
Agent 2: Dashboard (stats, charts, overview)
Agent 3: User Management (profile, settings, preferences)
Agent 4: Data Tables (list views, pagination, filters)
Agent 5: Forms (create/edit flows, validation)
Agent 6: API Routes (all backend endpoints)
```

---

## Comet Integration Points

| After | Trigger Comet With |
|-------|-------------------|
| Phase 4 complete | HTML/visual testing prompt |
| Each Phase 5 cycle | Feature testing prompt |
| Each fix batch | Re-test prompt |
| Before deploy | Full regression prompt |

### Full Regression Prompt (Pre-Deploy)

```
Perform a full regression test of the application.

Test all of the following:

1. **Authentication**
   - Login with valid credentials
   - Login with invalid credentials
   - Signup flow
   - Password reset flow
   - Logout

2. **All Pages**
   - Navigate to every page
   - Check rendering at all breakpoints
   - Check for console errors

3. **All Features**
   - Test each feature's happy path
   - Test key error cases

4. **Performance**
   - Note any slow-loading pages
   - Check for large images
   - Check for excessive network requests

5. **Accessibility**
   - Keyboard navigation
   - Screen reader basics
   - Color contrast

Log everything to QA system. This is the final gate before deploy.
```

---

## Comet Trigger Mechanism

### Browser Testing Options

See `TOOLS_INVENTORY.md` for full setup details. Quick summary:

| Option | Best For | Setup |
|--------|----------|-------|
| Claude Code + Chrome | Interactive, authenticated apps | `claude --chrome` |
| Clawdbot | Teams, chat-triggered | Self-hosted |
| Playwright MCP | CI/CD, headless | MCP config |

### Option A: Claude Code + Chrome (Recommended)

**Setup:**
1. Install [Claude in Chrome extension](https://chromewebstore.google.com/detail/claude/fcoeoabgfenejglbffodgkkbkcdhcgfn)
2. Start Claude Code: `claude --chrome`
3. Verify: `/chrome`

**Run Comet test:**
```bash
claude --chrome
```
Then paste the Comet prompt from below.

**Capabilities:**
- Reads console errors directly
- Tests authenticated apps (your Chrome logins)
- Records GIFs of test sessions
- Works with localhost:3000

### Option B: Clawdbot (Chat-Triggered)

For teams who want to trigger tests from Slack/Discord:

```
Slack: "Run QA tests on staging.myapp.com"
Clawdbot: Runs tests → Posts results back
```

See: https://github.com/clawdbot/clawdbot

### Option C: Playwright MCP (CI/CD)

For automated pipelines without GUI:

```bash
# In GitHub Actions or CI
claude --prompt "$(cat .github/comet-prompts/phase4.md)"
```

### Comet Prompt Files (Optional)

For automation, save prompts as files:

```
Development/
└── comet-prompts/
    ├── phase4-html.md      # HTML build testing
    ├── phase5-features.md  # Feature testing
    ├── retest.md           # Re-test fixed issues
    └── regression.md       # Full regression
```

### Comet Requirements

| Requirement | Chrome Extension | Clawdbot | Playwright MCP |
|-------------|------------------|----------|----------------|
| Browser access | Chrome + Extension | Self-hosted | MCP config |
| QA API endpoint | Yes | Yes | Yes |
| Screenshots | Yes (GIF recording) | Yes | Yes |
| Dev server running | Yes | Yes | Yes |
| Authenticated apps | Yes (your logins) | Requires setup | No |

### Comet Session Handoff

When triggering Comet, include context:

```
## Context from Previous Phase
- Pages built: [LIST]
- Features implemented: [LIST]
- Known issues to skip: [LIST]
- Focus areas: [LIST]

## Your Task
[COMET PROMPT FROM APPROPRIATE PHASE]
```

---

## Quick Reference

### Phase → Agents → Comet

| Phase | Agents | Comet Trigger |
|-------|--------|---------------|
| 1. Game Plan | 1 | None |
| 2. Design | 1 | None |
| 3. Page Planning | 1 | None |
| 4. HTML Build | 5-6 | After complete |
| 5. Feature Dev | 5-10 | After each cycle |
| 6. Test & Fix | As needed | After each fix batch |
| Deploy | - | Full regression |

### Ralph Wiggum Checklist (Every Agent, Every Task)

```
[ ] Auth check before data access
[ ] Inputs validated
[ ] Errors handled
[ ] No console errors
[ ] Security considered
[ ] Code follows standards
[ ] Self-tested before marking done
```

---

## HTML Pages Reference

**See: `HTML_PAGES_CHECKLIST.md`** for the complete page-by-page testing checklist.

### Project Structure

**Location:** `twilio-ai-coach/public/`

**Code Rule:** All functionality is **INLINE in HTML files**. The separate `.js` files are NOT used.

### Pages by Priority

**P1 - Core (Must Work First):**
- `index.html` - Login
- `signup.html` - Sign up
- `dashboard.html` - Main dashboard with stats
- `contacts.html` - Contact management
- `call.html` - Make/receive calls
- `sms.html` - SMS messaging

**P2 - Supporting:**
- `contact-profile.html` - Contact details
- `contacts-import.html` - CSV import
- `history.html` - Call history
- `callbacks.html` - Scheduled callbacks
- `activity.html` - Activity feed
- `newsfeed.html` - News/updates feed

**P3 - Advanced:**
- `pipeline.html` - Sales pipeline
- `settings.html` - User/company settings
- `supervisor.html` - Supervisor dashboard
- `agent-queue.html` - Call queue
- `agent-monitor.html` - Live monitoring

### Data Layer

All pages connect to **Supabase** via:
- `js/supabase.min.js` - SDK
- `js/supabase-config.js` - Config + helpers

Key tables: `companies`, `company_members`, `contacts`, `calls`, `messages`, `callbacks`, `activities`
