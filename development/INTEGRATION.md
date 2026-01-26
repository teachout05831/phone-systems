# Integration Guide

How to add the QA system to existing projects or update projects with new versions.

---

## Quick Reference: What to Copy

| What | From (Starter Kit) | To (Your Project) | Notes |
|------|-------------------|-------------------|-------|
| QA Overlay | `src/components/dev/` | `src/components/dev/` | The overlay component |
| QA Dashboard | `src/app/dashboard/qa/` | `src/app/dashboard/qa/` | Issue management UI |
| API Route | `src/app/api/qa-report/` | `src/app/api/qa-report/` | Supabase sync endpoint |
| Utilities | `src/lib/utils.ts` | `src/lib/utils.ts` | Helper functions |
| Supabase Client | `src/lib/supabase.ts` | `src/lib/supabase.ts` | DB client |
| Documentation | `Development/` | `Development/` | Setup guides, standards |
| Env Template | `.env.example` | `.env.example` | Environment variables |

---

## Scenario 1: Adding QA System to Existing Project

### Step 1: Copy Source Files

```bash
# From Starter Kit to your project:

# 1. QA Overlay component
cp -r "Starter Kit/src/components/dev" "your-project/src/components/"

# 2. QA Dashboard
cp -r "Starter Kit/src/app/dashboard/qa" "your-project/src/app/dashboard/"

# 3. API Route
cp -r "Starter Kit/src/app/api/qa-report" "your-project/src/app/api/"

# 4. Lib files (merge if you have existing)
cp "Starter Kit/src/lib/utils.ts" "your-project/src/lib/"
cp "Starter Kit/src/lib/supabase.ts" "your-project/src/lib/"
```

### Step 2: Add Environment Variables

Copy these to your `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SHOW_QA_OVERLAY=true
```

### Step 3: Run Supabase Schema

Copy SQL from `Development/QA_SYSTEM_SETUP.md` and run in Supabase SQL Editor.

### Step 4: Add Overlay to Layout

In your `src/app/layout.tsx`:

```tsx
import { DevQAOverlay } from '@/components/dev'

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <DevQAOverlay />
      </body>
    </html>
  )
}
```

### Step 5: Install Dependencies (if missing)

```bash
npm install @supabase/supabase-js
```

---

## Scenario 2: Updating QA System in Existing Project

When the starter kit gets updated, here's how to sync:

### Option A: Full Replace (Clean Update)

Delete and re-copy these folders:
- `src/components/dev/`
- `src/app/dashboard/qa/`
- `src/app/api/qa-report/`

### Option B: Selective Update

Only update specific files that changed:

```bash
# Example: Just update the overlay
cp "Starter Kit/src/components/dev/DevQAOverlay.tsx" "your-project/src/components/dev/"

# Example: Just update the dashboard
cp "Starter Kit/src/app/dashboard/qa/page.tsx" "your-project/src/app/dashboard/qa/"
```

### Database Migrations

If schema changes, run the migration SQL from `QA_SYSTEM_SETUP.md`. Most changes are additive (new columns/indexes) and won't break existing data.

---

## Scenario 3: Just Want Documentation

Copy the `Development/` folder to get:
- `CODING_STANDARDS.md` - Coding patterns
- `QA_SYSTEM_SETUP.md` - Setup guide + SQL schema
- `QA_AGENT_COMMANDS.md` - Claude Code commands
- `INTEGRATION.md` - This file

```bash
cp -r "Starter Kit/Development" "your-project/"
```

---

## Module Dependencies

```
DevQAOverlay.tsx
  └── (standalone - no dependencies)

dashboard/qa/page.tsx
  ├── lib/supabase.ts
  └── lib/utils.ts

api/qa-report/route.ts
  └── @supabase/supabase-js (npm package)
```

---

## File Structure After Integration

```
your-project/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── qa-report/
│   │   │       └── route.ts        # API endpoint
│   │   ├── dashboard/
│   │   │   └── qa/
│   │   │       └── page.tsx        # QA Dashboard
│   │   └── layout.tsx              # Add <DevQAOverlay /> here
│   │
│   ├── components/
│   │   └── dev/
│   │       ├── DevQAOverlay.tsx
│   │       └── index.ts
│   │
│   └── lib/
│       ├── supabase.ts
│       └── utils.ts
│
├── Development/                     # Documentation
│   ├── CODING_STANDARDS.md
│   ├── QA_SYSTEM_SETUP.md
│   ├── QA_AGENT_COMMANDS.md
│   └── INTEGRATION.md
│
└── .env.local                       # Your environment variables
```

---

## Conflict Resolution

### If you already have `lib/utils.ts`

Merge the QA utility functions into your existing file:
- `formatTimestamp`
- `getSeverityColor`
- `getCategoryIcon`
- `getStatusColor`
- `truncate`

### If you already have `lib/supabase.ts`

The QA system needs both client and admin exports:
```ts
export const supabase = createClient(url, anonKey)      // For dashboard
export const supabaseAdmin = createClient(url, serviceKey)  // For API route
```

### If you have a different folder structure

Adjust imports in the copied files. Key imports to update:
- `@/lib/supabase`
- `@/lib/utils`
- `@/components/dev`

---

## Version Tracking

Add this to track which version of the QA system you're using:

```ts
// In DevQAOverlay.tsx or a constants file
export const QA_SYSTEM_VERSION = '1.0.0'
```

When updating from Starter Kit, check the version and review changelog in `Development/` folder.
