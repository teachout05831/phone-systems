# QA System Setup Guide

Complete setup guide for the automated QA overlay system with Supabase integration.

---

## Quick Start

1. Create a Supabase project
2. Run the schema SQL (below)
3. Add env vars to `.env.local`
4. Add overlay to your layout
5. Configure Claude Code MCP

---

## 1. Environment Variables

Add to `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# QA Overlay Settings
NEXT_PUBLIC_SHOW_QA_OVERLAY=true
```

**Where to find these:**
- Go to your Supabase project dashboard
- Settings > API
- `NEXT_PUBLIC_SUPABASE_URL` = Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon/public key (under "Project API keys")
- `SUPABASE_SERVICE_ROLE_KEY` = service_role key (under "Project API keys")

---

## 2. Supabase Schema

Run this SQL in your Supabase SQL Editor (SQL Editor > New Query):

```sql
-- =====================================================
-- QA OVERLAY SUPABASE SCHEMA
-- =====================================================

-- 1. Page Visits Table
-- Records every page visit during QA sessions
CREATE TABLE IF NOT EXISTS qa_page_visits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  page_url TEXT NOT NULL,
  page_path TEXT NOT NULL,
  page_title TEXT,
  viewport_width INTEGER,
  viewport_height INTEGER,
  user_agent TEXT,
  dom_elements INTEGER,
  load_time_ms INTEGER,
  issue_count INTEGER DEFAULT 0,
  visited_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_qa_page_visits_session ON qa_page_visits(session_id);
CREATE INDEX IF NOT EXISTS idx_qa_page_visits_path ON qa_page_visits(page_path);
CREATE INDEX IF NOT EXISTS idx_qa_page_visits_visited ON qa_page_visits(visited_at DESC);

-- 2. Issues Table
-- Stores all individual issues found
CREATE TABLE IF NOT EXISTS qa_issues (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  page_visit_id UUID REFERENCES qa_page_visits(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  page_url TEXT NOT NULL,
  page_path TEXT NOT NULL,

  -- Issue classification
  category TEXT NOT NULL, -- 'error', 'security', 'performance', 'accessibility', 'ux'
  severity TEXT NOT NULL, -- 'critical', 'error', 'warning', 'info'
  issue_type TEXT NOT NULL, -- e.g., 'Missing Alt Text', 'API Key in URL', etc.

  -- Issue details
  message TEXT NOT NULL,
  location TEXT, -- file, element, or URL path
  hint TEXT, -- suggested fix
  stack_trace TEXT, -- for errors
  raw_data JSONB, -- full issue object for debugging

  -- Workflow status
  status TEXT DEFAULT 'new', -- 'new', 'in_progress', 'fixed', 'wont_fix', 'duplicate'
  assigned_to TEXT, -- agent or person
  notes TEXT, -- review notes
  fixed_at TIMESTAMPTZ,
  fixed_by TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_qa_issues_session ON qa_issues(session_id);
CREATE INDEX IF NOT EXISTS idx_qa_issues_path ON qa_issues(page_path);
CREATE INDEX IF NOT EXISTS idx_qa_issues_category ON qa_issues(category);
CREATE INDEX IF NOT EXISTS idx_qa_issues_severity ON qa_issues(severity);
CREATE INDEX IF NOT EXISTS idx_qa_issues_status ON qa_issues(status);
CREATE INDEX IF NOT EXISTS idx_qa_issues_created ON qa_issues(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qa_issues_type ON qa_issues(issue_type);

-- 3. Summary View
-- Easy view for dashboards and quick queries
CREATE OR REPLACE VIEW qa_issues_summary AS
SELECT
  page_path,
  category,
  severity,
  issue_type,
  COUNT(*) as count,
  MAX(created_at) as latest_occurrence,
  MIN(created_at) as first_occurrence
FROM qa_issues
WHERE status = 'new'
GROUP BY page_path, category, severity, issue_type
ORDER BY count DESC;

-- 4. Page Health View
-- Quick health check per page
CREATE OR REPLACE VIEW qa_page_health AS
SELECT
  page_path,
  COUNT(DISTINCT session_id) as sessions_tested,
  COUNT(*) FILTER (WHERE category = 'error') as errors,
  COUNT(*) FILTER (WHERE category = 'security') as security_issues,
  COUNT(*) FILTER (WHERE category = 'performance') as performance_issues,
  COUNT(*) FILTER (WHERE category = 'accessibility') as accessibility_issues,
  COUNT(*) FILTER (WHERE category = 'ux') as ux_issues,
  COUNT(*) FILTER (WHERE severity = 'critical') as critical_count,
  COUNT(*) as total_issues,
  MAX(created_at) as last_tested
FROM qa_issues
WHERE status = 'new'
GROUP BY page_path
ORDER BY critical_count DESC, total_issues DESC;

-- 5. Recent Sessions View
CREATE OR REPLACE VIEW qa_recent_sessions AS
SELECT
  session_id,
  COUNT(DISTINCT page_path) as pages_visited,
  COUNT(*) as total_issues,
  MIN(visited_at) as session_start,
  MAX(visited_at) as session_end,
  ARRAY_AGG(DISTINCT page_path) as pages
FROM qa_page_visits pv
LEFT JOIN qa_issues i ON pv.session_id = i.session_id
GROUP BY pv.session_id
ORDER BY session_start DESC
LIMIT 50;
```

---

## 2b. Storage Setup (for Screenshots)

Run this SQL AFTER the main schema to enable screenshot uploads:

```sql
-- Create the storage bucket for QA assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('qa-assets', 'qa-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to QA assets
CREATE POLICY "Public read access for qa-assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'qa-assets');

-- Allow uploads to QA assets
CREATE POLICY "Allow uploads to qa-assets"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'qa-assets');

-- Allow updates (for replacing screenshots)
CREATE POLICY "Allow updates to qa-assets"
ON storage.objects FOR UPDATE
USING (bucket_id = 'qa-assets');

-- Allow deletes
CREATE POLICY "Allow deletes from qa-assets"
ON storage.objects FOR DELETE
USING (bucket_id = 'qa-assets');

-- Add screenshot_url column to qa_issues
ALTER TABLE qa_issues
ADD COLUMN IF NOT EXISTS screenshot_url TEXT;
```

---

## 3. Add Overlay to Layout

In your root layout file (`src/app/layout.tsx`):

```tsx
import { DevQAOverlay } from '@/components/dev'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
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

The overlay only shows in development mode by default. To enable in production, add:

```env
NEXT_PUBLIC_SHOW_QA_OVERLAY=true
```

---

## 4. Claude Code MCP Configuration

Add to your MCP config (`.claude/mcp.json` or global config):

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": ["-y", "@supabase/mcp-server"],
      "env": {
        "SUPABASE_URL": "https://your-project.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "your-service-role-key"
      }
    }
  }
}
```

This allows Claude Code agents to query and update issues directly.

---

## 5. Verification Checklist

- [ ] Supabase project created
- [ ] Schema SQL executed successfully
- [ ] Environment variables added to `.env.local`
- [ ] Overlay added to layout
- [ ] Run `npm run dev`
- [ ] Visit a page in browser
- [ ] Overlay appears on right side (toggle button visible)
- [ ] After 5 seconds, check Supabase tables for data
- [ ] Test GET endpoint: `curl http://localhost:3000/api/qa-report?status=new`

---

## Troubleshooting

### Overlay not appearing
- Check browser console for errors
- Verify `NODE_ENV` is not `production` (or set `NEXT_PUBLIC_SHOW_QA_OVERLAY=true`)

### Sync failing
- Check network tab for `/api/qa-report` requests
- Verify Supabase credentials are correct
- Check Supabase dashboard for RLS policies (should be disabled or allow service role)

### No data in Supabase
- Ensure schema tables were created
- Check API route logs for errors
- Verify service role key has write permissions

---

## API Endpoints

### POST /api/qa-report
Receives issues from overlay.

### GET /api/qa-report
Query issues. Parameters:
- `page_path` - Filter by page
- `category` - Filter by category (error, security, performance, accessibility, ux)
- `severity` - Filter by severity (critical, error, warning, info)
- `status` - Filter by status (new, in_progress, fixed, wont_fix)
- `limit` - Max results (default 100)
- `since` - ISO timestamp, issues after this time

### PATCH /api/qa-report
Update issue status. Body:
```json
{
  "issue_id": "uuid",
  "status": "fixed",
  "notes": "Fixed by adding...",
  "assigned_to": "agent-1"
}
```

---

## Useful Queries

See `QA_AGENT_COMMANDS.md` for Claude Code agent commands and SQL snippets.
