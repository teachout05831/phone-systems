# Project Audit Checklist

Use this checklist to audit any project and identify what QA system components are missing.

---

## How to Use

**Manual:** Go through each section and check what exists in your project.

**With Claude Code:** Copy this prompt:
```
Look at my project and compare it against the checklist in Development/PROJECT_CHECKLIST.md.
Tell me what's missing and what's already there.
```

---

## 1. QA Overlay Component

| Check | File | Status |
|-------|------|--------|
| [ ] | `src/components/dev/DevQAOverlay.tsx` | |
| [ ] | `src/components/dev/index.ts` | |

**If missing:** Copy from Starter Kit `src/components/dev/`

---

## 2. QA API Route

| Check | File | Status |
|-------|------|--------|
| [ ] | `src/app/api/qa-report/route.ts` | |

**If missing:** Copy from Starter Kit `src/app/api/qa-report/`

**Dependency:** Requires `@supabase/supabase-js` package

---

## 3. QA Dashboard

| Check | File | Status |
|-------|------|--------|
| [ ] | `src/app/dashboard/qa/page.tsx` | |

**If missing:** Copy from Starter Kit `src/app/dashboard/qa/`

**Dependencies:** Requires `src/lib/supabase.ts` and `src/lib/utils.ts`

---

## 4. Library Files

| Check | File | Status |
|-------|------|--------|
| [ ] | `src/lib/supabase.ts` | |
| [ ] | `src/lib/utils.ts` | |

**If missing:** Copy from Starter Kit `src/lib/`

**Note:** If you have existing lib files, merge the functions instead of replacing.

---

## 5. Environment Variables

Check `.env.local` for:

| Check | Variable | Status |
|-------|----------|--------|
| [ ] | `NEXT_PUBLIC_SUPABASE_URL` | |
| [ ] | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | |
| [ ] | `SUPABASE_SERVICE_ROLE_KEY` | |
| [ ] | `NEXT_PUBLIC_SHOW_QA_OVERLAY` | |

**If missing:** Copy from Starter Kit `.env.example`

---

## 6. Layout Integration

Check `src/app/layout.tsx` for:

| Check | What to Look For | Status |
|-------|------------------|--------|
| [ ] | Import: `import { DevQAOverlay } from '@/components/dev'` | |
| [ ] | Component: `<DevQAOverlay />` in body | |

**If missing:** Add these lines to your root layout.

---

## 7. Supabase Database

| Check | Table/View | Status |
|-------|------------|--------|
| [ ] | `qa_page_visits` table | |
| [ ] | `qa_issues` table | |
| [ ] | `qa_issues_summary` view | |
| [ ] | `qa_page_health` view | |
| [ ] | `qa_recent_sessions` view | |
| [ ] | `screenshot_url` column on qa_issues | |
| [ ] | `qa-assets` storage bucket | |

**If missing:** Run SQL from `QA_SYSTEM_SETUP.md`

---

## 8. Documentation

| Check | File | Status |
|-------|------|--------|
| [ ] | `Development/CODING_STANDARDS.md` | |
| [ ] | `Development/WORKFLOW.md` | |
| [ ] | `Development/STORY_WORKFLOW.md` | |
| [ ] | `Development/IMPLEMENTATION_KICKOFF.md` | |
| [ ] | `Development/REFACTORING_KICKOFF.md` | |
| [ ] | `Development/QA_SYSTEM_SETUP.md` | |
| [ ] | `Development/QA_AGENT_COMMANDS.md` | |
| [ ] | `Development/INTEGRATION.md` | |
| [ ] | `Development/PROJECT_CHECKLIST.md` | |
| [ ] | `Development/TOOLS_INVENTORY.md` | |
| [ ] | `Development/LEGACY_MIGRATION.md` | |

**If missing:** Copy `Development/` folder from Starter Kit

---

## 9. Package Dependencies

Run this to check:
```bash
npm list @supabase/supabase-js
```

| Check | Package | Status |
|-------|---------|--------|
| [ ] | `@supabase/supabase-js` | |

**If missing:**
```bash
npm install @supabase/supabase-js
```

---

## Quick Audit Summary

After checking, fill this out:

```
Project: _______________
Date: _______________

Core Components:
- [ ] QA Overlay
- [ ] QA API Route
- [ ] QA Dashboard
- [ ] Lib files

Configuration:
- [ ] Environment variables
- [ ] Layout integration
- [ ] Supabase schema

Documentation:
- [ ] Development folder

Missing Items:
1. _______________
2. _______________
3. _______________

Action Plan:
1. _______________
2. _______________
3. _______________
```

---

## Claude Code Audit Prompt

Copy and paste this to have Claude Code audit your project:

```
Please audit this project against the QA system checklist:

1. Check if these files exist:
   - src/components/dev/DevQAOverlay.tsx
   - src/components/dev/index.ts
   - src/app/api/qa-report/route.ts
   - src/app/dashboard/qa/page.tsx
   - src/lib/supabase.ts
   - src/lib/utils.ts
   - Development/ folder

2. Check .env.local for:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY

3. Check src/app/layout.tsx for DevQAOverlay import and usage

4. Check package.json for @supabase/supabase-js

Give me a summary of what's present vs missing, and what I need to copy from the Starter Kit.
```
