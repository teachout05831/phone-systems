# Troubleshooting Workflow

Standardized process for diagnosing and fixing bugs, glitches, and broken functionality.

---

## Before You Start

```
┌─────────────────────────────────────────────────────────────┐
│  STEP 0: Check FIX_LOG.md                                   │
│  ─────────────────────────                                  │
│  Ctrl+F search for your error message.                      │
│  Found it? → Apply the fix. Done.                           │
│  Not found? → Continue below.                               │
│                                                             │
│  After fixing → Add your solution to FIX_LOG.md             │
└─────────────────────────────────────────────────────────────┘
```

### Pre-Flight Check

Before debugging, verify basics work. See `PREFLIGHT_DIAGNOSTICS.md`

```
1. Server running?     → netstat -ano | findstr :3000
2. Port conflicts?     → taskkill /F /PID [PID]
3. Env vars set?       → check .env.local
4. MCP working?        → test Playwright/DevTools

All good? → Continue to Phase 1
Something wrong? → Fix it first
```

---

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                 TROUBLESHOOTING PIPELINE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. REPRODUCE ──→ Confirm the issue exists                      │
│        ↓                                                        │
│  2. CLASSIFY ──→ What type of problem is it?                    │
│        ↓                                                        │
│  3. LOCATE ────→ Find the source code responsible               │
│        ↓                                                        │
│  4. DIAGNOSE ──→ Understand root cause                          │
│        ↓                                                        │
│  5. FIX ───────→ Implement the solution                         │
│        ↓                                                        │
│  6. VERIFY ────→ Confirm fix works + no regressions             │
│        ↓                                                        │
│  7. DOCUMENT ──→ Update issue status, note what changed         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Quick Reference Card

**When something breaks:**

```
0. CHECK FIX_LOG.md  ← Search for your error. Already solved?
   ↓
1. PRE-FLIGHT        ← Server running? Env vars set?
   ↓
2. REPRODUCE         ← See it fail (browser/console/MCP)
   ↓
3. CLASSIFY          ← UI | Data | Auth | API | Config
   ↓
4. LOCATE            ← Find the file(s)
   ↓
5. DIAGNOSE          ← Read code, understand why
   ↓
6. FIX               ← Minimal change, follow standards
   ↓
7. VERIFY            ← Test fix + check side effects
   ↓
8. ADD TO FIX_LOG.md ← So we don't solve it again
```

---

## Phase 1: Reproduce

**Goal:** Confirm the issue exists and understand exactly what's happening.

### Using MCP Tools

**Option A: Playwright MCP (Configured)**
```
Navigate to [URL] and:
1. Perform [steps to reproduce]
2. Take a screenshot
3. Report what you observe
```

**Option B: Chrome Extension (If Available)**
```bash
claude --chrome
```
Then test directly with your logged-in browser session.

### What to Capture

| Information | How to Get It |
|-------------|---------------|
| Error message | Console, UI, or network tab |
| Steps to reproduce | Manual walkthrough |
| Expected behavior | Story acceptance criteria or user report |
| Actual behavior | What you observed |
| Console errors | Browser DevTools or Chrome DevTools MCP |
| Network failures | Network tab or DevTools MCP |

### Reproduction Template

```
## Issue Reproduction

**URL:**
**Steps:**
1.
2.
3.

**Expected:**
**Actual:**
**Console errors:**
**Screenshot:** [if applicable]
```

---

## Phase 2: Classify

**Goal:** Determine the type of issue to know where to look.

### Issue Categories

| Category | Symptoms | Primary File Location |
|----------|----------|----------------------|
| **UI/Visual** | Layout broken, styles wrong, not rendering | `/components`, CSS files |
| **Data Not Loading** | Blank content, spinners stuck, "undefined" | `/queries`, API routes |
| **Data Not Saving** | Form submits but nothing happens | `/actions`, API routes |
| **Auth/Permission** | 401/403 errors, "not authorized" | `/queries` or `/actions` auth checks |
| **API/Integration** | External service errors, timeouts | API routes, external service config |
| **Type Errors** | TypeScript compilation failures | `types.ts`, component props |
| **State Issues** | UI not updating, stale data | `/hooks`, state management |
| **Configuration** | Environment vars, missing setup | `.env.local`, config files |

### Quick Diagnosis Flow

```
Is there a console error?
├─ Yes → Read the stack trace, it points to the file
└─ No → Continue...

Is data showing?
├─ No data at all → Check query (is it fetching?)
├─ Wrong data → Check query filters
└─ Data exists → Continue...

Does the action work?
├─ No response → Check if action is called (add console.log)
├─ Error response → Check action validation/auth
└─ Success but UI doesn't update → Check hook/state
```

---

## Phase 3: Locate

**Goal:** Find the exact file(s) responsible for the issue.

### Location Guide (Per Coding Standards)

| Problem | Check | File Location |
|---------|-------|---------------|
| UI looks wrong | Component | `/features/[name]/components/` |
| Button does nothing | Hook (is function wired?) | `/features/[name]/hooks/` |
| Data doesn't save | Action | `/features/[name]/actions/` |
| Data doesn't load | Query | `/features/[name]/queries/` |
| TypeScript errors | Types | `/features/[name]/types.ts` |
| Wrong data shape | Types + Query | `types.ts` + `/queries` |
| Auth errors | Auth check | `/queries` or `/actions` |
| Permission denied | Ownership check | `/actions` |

### For HTML Pages (twilio-ai-coach/public/)

All functionality is **inline in HTML files**. Check the `<script>` tags at the bottom of the relevant page:

| Page | Primary Responsibility |
|------|----------------------|
| `index.html` | Login flow |
| `signup.html` | Registration |
| `dashboard.html` | Stats, overview |
| `contacts.html` | Contact CRUD |
| `call.html` | Call functionality |
| `sms.html` | Messaging |

### Search Commands

**Find where something is defined:**
```
Search for "functionName" or "ComponentName" in the codebase
```

**Find where something is used:**
```
Search for references to the function/component
```

---

## Phase 4: Diagnose

**Goal:** Understand why it's failing.

### Diagnosis Checklist

**For Queries (data not loading):**
- [ ] Is `getUser()` called first?
- [ ] Is the user filter applied (`.eq('user_id', user.id)`)?
- [ ] Are the correct fields selected?
- [ ] Is there a `.limit()` on the query?
- [ ] Is error handling in place?
- [ ] Check Supabase logs for query errors

**For Actions (data not saving):**
- [ ] Is `getUser()` called first?
- [ ] Are inputs validated?
- [ ] Is ownership verified (for updates/deletes)?
- [ ] Does the response include an error message?
- [ ] Check Supabase logs for write errors

**For UI (not rendering/updating):**
- [ ] Is the component receiving props correctly?
- [ ] Is state being set?
- [ ] Are there conditional renders that hide content?
- [ ] Is there a loading/error state blocking render?
- [ ] Check for React/Next.js warnings

**For Auth (permission errors):**
- [ ] Is the user logged in?
- [ ] Is the session valid?
- [ ] Is RLS (Row Level Security) configured correctly?
- [ ] Are roles/permissions set correctly?

### Add Debugging

If the cause isn't obvious, add logging:

```tsx
// In queries
console.log('[Query] User:', user?.id)
console.log('[Query] Result:', data)
console.log('[Query] Error:', error)

// In actions
console.log('[Action] Input:', input)
console.log('[Action] User:', user?.id)
console.log('[Action] Result:', result)

// In components
console.log('[Component] Props:', props)
console.log('[Component] State:', state)
```

**Remove logging after fix is verified.**

---

## Phase 5: Fix

**Goal:** Implement the minimal correct solution.

### Fix Principles

1. **Minimal change** - Only fix what's broken
2. **Follow standards** - Apply coding standards (see `CODING_STANDARDS.md`)
3. **Don't over-engineer** - Fix the issue, don't refactor the world
4. **Security first** - Don't introduce vulnerabilities

### Fix Template

Before writing code, document:

```
## Fix Plan

**Root cause:** [What's actually wrong]
**Solution:** [What change will fix it]
**Files to modify:** [List of files]
**Risk:** [What could break]
```

### Common Fix Patterns

**Missing auth check:**
```tsx
// Add at the start of query/action
const { data: { user } } = await supabase.auth.getUser()
if (!user) throw new Error('Not authenticated')
```

**Missing error handling:**
```tsx
// Wrap risky operations
try {
  const result = await riskyOperation()
  return { success: true, data: result }
} catch (error) {
  console.error('[Operation] Failed:', error)
  return { error: 'Operation failed' }
}
```

**Missing null check:**
```tsx
// Before accessing properties
if (!data || !data.items) {
  return <EmptyState />
}
```

**Missing loading state:**
```tsx
// In components
if (isLoading) return <Loading />
if (error) return <Error message={error} />
```

---

## Phase 6: Verify

**Goal:** Confirm the fix works and didn't break anything else.

### Verification Checklist

- [ ] Original issue is resolved
- [ ] No new console errors
- [ ] Related functionality still works
- [ ] Edge cases handled (empty, null, large data)
- [ ] Works at all viewport sizes (if UI change)

### Using MCP Tools for Verification

**Playwright MCP:**
```
Navigate to [URL] and:
1. Perform the original reproduction steps
2. Verify the issue no longer occurs
3. Test related functionality: [list]
4. Take a screenshot of working state
5. Report results
```

### Ralph Wiggum Validation (Self-Test)

Apply immediately after making changes:

- [ ] Fix addresses root cause, not symptoms
- [ ] Fix follows coding standards
- [ ] No new console errors introduced
- [ ] Related features still work
- [ ] Security not compromised

---

## Phase 7: Document

**Goal:** Track what was done so we don't repeat the work.

### Add to Fix Log

Open `FIX_LOG.md` and add your fix:

```
### Issue: [What went wrong]

**Error:** [The error message]

**Fix:** [What you did]

**Files:** [What you changed]
```

Keep it simple. Future you will thank you.

### If Using QA System

Update the issue in Supabase:

```sql
UPDATE qa_issues
SET
  status = 'fixed',
  fixed_at = NOW(),
  fixed_by = 'agent-name',
  notes = 'Description of what was fixed',
  updated_at = NOW()
WHERE id = 'issue-id';
```

Or via the API:
```
PATCH /api/qa-report
{
  "issue_id": "uuid",
  "status": "fixed",
  "notes": "Fixed by [description]"
}
```

### Fix Documentation Template

```
## Fix Summary

**Issue:** [Brief description]
**Root cause:** [What was wrong]
**Solution:** [What you changed]
**Files modified:**
- file1.tsx (line X-Y)
- file2.ts (line Z)
**Verified:** [How you tested]
**Date:** [YYYY-MM-DD]
```

---

## Agent Prompt Templates

### Generic Bug Fix Prompt

```
You are fixing a bug/issue. Follow the troubleshooting workflow:

## The Issue
[Paste issue description, error messages, reproduction steps]

## Your Task
1. REPRODUCE: Verify the issue using Playwright MCP or by reading the code
2. CLASSIFY: Determine issue type (UI/Data/Auth/API/Config)
3. LOCATE: Find the responsible file(s) using the location guide
4. DIAGNOSE: Understand the root cause
5. FIX: Implement minimal solution following coding standards
6. VERIFY: Test the fix and check for regressions
7. DOCUMENT: Report what you changed

## Constraints
- Follow CODING_STANDARDS.md
- Apply Ralph Wiggum validation
- Don't over-engineer
- Security first
```

### Specific Category Prompts

**UI/Visual Issue:**
```
Fix this UI issue:
[Description]

Check /features/[feature]/components/ for the relevant component.
Verify at mobile, tablet, and desktop breakpoints.
```

**Data Not Loading:**
```
Fix this data loading issue:
[Description]

Check /features/[feature]/queries/ for the query.
Verify: auth check, user filter, field selection, limit, error handling.
```

**Data Not Saving:**
```
Fix this data saving issue:
[Description]

Check /features/[feature]/actions/ for the action.
Verify: auth check, input validation, ownership check, error handling.
```

**Auth/Permission Issue:**
```
Fix this authentication/permission issue:
[Description]

Check:
1. Is getUser() called?
2. Is the user filter applied?
3. Are roles checked if needed?
4. Is RLS configured correctly in Supabase?
```

---

## Escalation

### When to Escalate

- Issue persists after following this workflow
- Root cause is unclear after diagnosis
- Fix requires architectural changes
- Issue involves external services you can't access
- Security vulnerability discovered

### Escalation Template

```
## Escalation Request

**Issue:** [Description]
**Steps Taken:**
1. [What you tried]
2. [What you found]
3. [Why it's stuck]

**Hypothesis:** [Best guess at cause]
**Needed:** [What would unblock this]
```

---

## Common Patterns Reference

### Supabase Query Issues

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| Empty array returned | RLS blocking or wrong filter | Check user_id filter, RLS policies |
| 401 Unauthorized | Session expired or missing | Check auth flow, token refresh |
| Specific fields missing | Not in select() | Add fields to select() |
| Timeout | Large query without limit | Add .limit() |

### Next.js/React Issues

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| Hydration mismatch | Server/client render difference | Check for Date, random, window access |
| "Cannot read property of undefined" | Missing null check | Add optional chaining (?.) |
| Infinite re-renders | Missing useCallback/useMemo deps | Fix dependency array |
| State not updating | Stale closure | Use functional update or fix deps |

### API Route Issues

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| 500 Internal Server Error | Unhandled exception | Add try/catch, check logs |
| 404 Not Found | Route file missing or wrong path | Check file location and export |
| CORS errors | Missing headers | Add CORS configuration |
| Timeout | Slow external API | Add timeout handling |

---

## Checklist Summary

Before marking any fix complete:

- [ ] Issue reproduced and understood
- [ ] Root cause identified (not just symptoms)
- [ ] Fix is minimal and follows standards
- [ ] No new errors introduced
- [ ] Related functionality tested
- [ ] Security not compromised
- [ ] Fix documented (QA system or notes)
- [ ] Logging removed if added for debugging
