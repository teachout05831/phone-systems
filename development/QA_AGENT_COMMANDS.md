# Claude Code Agent Commands for QA System

## Overview

Once the QA overlay is pushing data to Supabase, your Claude Code agents can query and act on issues directly. Here are the commands and workflows.

---

## Setup: Connect Supabase MCP

First, ensure Claude Code has Supabase access. Add to your MCP config:

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": ["-y", "@supabase/mcp-server"],
      "env": {
        "SUPABASE_URL": "your-project-url",
        "SUPABASE_SERVICE_ROLE_KEY": "your-service-role-key"
      }
    }
  }
}
```

---

## Agent Commands

### 1. Get All New Issues

```
Query the qa_issues table for all issues where status = 'new', ordered by severity (critical first) then by created_at descending. Show me page_path, category, severity, issue_type, message, and hint.
```

### 2. Get Issues for a Specific Page

```
Get all new issues from qa_issues where page_path = '/classes'. Include the full message, location, hint, and stack_trace if available.
```

### 3. Get Critical Issues Only

```
Find all issues in qa_issues where severity = 'critical' and status = 'new'. These need immediate attention.
```

### 4. Get Issues by Category

```
Get all new [security/performance/accessibility/error/ux] issues from qa_issues. Show page_path, issue_type, message, and hint.
```

### 5. Get Page Health Overview

```
Query the qa_page_health view to see which pages have the most issues. Show me pages with critical issues first.
```

### 6. Mark Issue as In Progress

```
Update qa_issues set status = 'in_progress', assigned_to = 'agent-1', updated_at = NOW() where id = '[issue-id]'
```

### 7. Mark Issue as Fixed

```
Update qa_issues set status = 'fixed', fixed_at = NOW(), fixed_by = 'agent-1', notes = '[what you fixed]', updated_at = NOW() where id = '[issue-id]'
```

### 8. Get Today's Issues

```
Get all issues from qa_issues where created_at > NOW() - INTERVAL '24 hours' and status = 'new', ordered by severity.
```

### 9. Get Issues From Latest Session

```
First, get the most recent session_id from qa_page_visits ordered by visited_at desc limit 1. Then get all issues from qa_issues with that session_id.
```

### 10. Bulk Mark as Fixed

```
Update qa_issues set status = 'fixed', fixed_at = NOW(), fixed_by = 'agent-batch' where page_path = '/old-page' and status = 'new'
```

---

## Multi-Agent Workflow

### Morning Triage Agent

```
You are the triage agent. Every morning:

1. Query qa_page_health to see overall site health
2. Query qa_issues for all new critical issues
3. Create a summary report:
   - Total new issues
   - Critical issues count
   - Most problematic pages
   - Categories breakdown
4. Assign critical issues to appropriate agents based on category
```

### Error Fix Agent

```
You are the error fixing agent. Your job:

1. Query: SELECT * FROM qa_issues WHERE category = 'error' AND status = 'new' ORDER BY created_at DESC
2. For each error:
   - Read the message and stack_trace
   - Find the relevant file in the codebase
   - Implement the fix
   - Update the issue: status = 'fixed', notes = '[what you fixed]'
3. Report what you fixed
```

### Security Agent

```
You are the security agent. Your job:

1. Query: SELECT * FROM qa_issues WHERE category = 'security' AND status = 'new' ORDER BY severity
2. For each security issue:
   - Analyze the issue type (API key exposure, mixed content, etc.)
   - Find the source in codebase
   - Implement the fix (move to env vars, use HTTPS, etc.)
   - Update the issue status
3. Report findings and fixes
```

### Accessibility Agent

```
You are the accessibility agent. Your job:

1. Query: SELECT * FROM qa_issues WHERE category = 'accessibility' AND status = 'new'
2. For each issue:
   - Missing alt text: Find image, add appropriate alt
   - Missing labels: Find form element, add label
   - Heading hierarchy: Fix heading levels
   - Update issue status when fixed
```

### Performance Agent

```
You are the performance agent. Your job:

1. Query: SELECT * FROM qa_issues WHERE category = 'performance' AND status = 'new'
2. For each issue:
   - Large images: Recommend/implement optimization
   - Slow load: Identify bottlenecks
   - Large DOM: Suggest virtualization
   - Update issue status with recommendations
```

### UX Review Agent

```
You are the UX agent. Your job:

1. Query: SELECT * FROM qa_issues WHERE category = 'ux' AND status = 'new'
2. For each issue:
   - CTA placement: Recommend layout changes
   - Missing titles: Add appropriate titles
   - Placeholder content: Flag for content team
   - Update status with recommendations (may need human review)
```

---

## Example Agent Session

```
Agent: I'll start by checking today's critical issues.

[Queries Supabase]

Found 3 critical issues:

1. **API Key in URL** on /api/checkout
   - Message: "API Key detected in request URL"
   - Hint: "Move sensitive data to headers"
   
   Let me fix this...
   
   [Reads /app/api/checkout/route.js]
   [Finds: fetch(`https://api.stripe.com?key=${process.env.STRIPE_KEY}`)]
   [Fixes to use headers instead]
   
   Fixed. Updating issue status...
   
   [Updates qa_issues set status = 'fixed', notes = 'Moved API key from URL to Authorization header']

2. **Missing Alt Text** on /classes (5 images)
   
   [Reads /app/classes/page.jsx]
   [Adds alt text to all Image components]
   
   Fixed 5 images. Updating...

3. **Unhandled Promise Rejection** on /dashboard
   - Stack trace points to /components/UserData.jsx line 23
   
   [Reads file, finds missing try/catch]
   [Adds error handling]
   
   Fixed. Updating...

Session complete. Fixed 3 critical issues.
```

---

## Useful SQL Snippets

### Issues by Page (for focused fixing)
```sql
SELECT page_path, 
       COUNT(*) as total,
       COUNT(*) FILTER (WHERE severity = 'critical') as critical
FROM qa_issues 
WHERE status = 'new'
GROUP BY page_path
ORDER BY critical DESC, total DESC;
```

### Most Common Issue Types
```sql
SELECT issue_type, category, COUNT(*) as occurrences
FROM qa_issues
WHERE status = 'new'
GROUP BY issue_type, category
ORDER BY occurrences DESC
LIMIT 20;
```

### Issues Fixed Today
```sql
SELECT page_path, issue_type, fixed_by, notes
FROM qa_issues
WHERE status = 'fixed' 
AND fixed_at > NOW() - INTERVAL '24 hours'
ORDER BY fixed_at DESC;
```

### Agent Performance
```sql
SELECT fixed_by as agent, COUNT(*) as issues_fixed
FROM qa_issues
WHERE status = 'fixed'
AND fixed_at > NOW() - INTERVAL '7 days'
GROUP BY fixed_by
ORDER BY issues_fixed DESC;
```

---

## API Endpoints (Alternative to Direct SQL)

If you prefer HTTP over direct Supabase queries:

### Get new issues
```
GET /api/qa-report?status=new&limit=50
```

### Get issues for a page
```
GET /api/qa-report?page_path=/classes&status=new
```

### Get issues by category
```
GET /api/qa-report?category=security&status=new
```

### Update issue status
```
PATCH /api/qa-report
{
  "issue_id": "uuid-here",
  "status": "fixed",
  "notes": "Fixed by adding try/catch"
}
```

---

## Integration with Your Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                      AUTOMATED QA FLOW                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. You or Comet visits pages                               │
│                    ↓                                        │
│  2. Overlay auto-pushes issues to Supabase                  │
│                    ↓                                        │
│  3. Triage Agent queries for new issues (hourly/daily)      │
│                    ↓                                        │
│  4. Triage assigns to specialized agents by category        │
│                    ↓                                        │
│  ┌─────────┬─────────┬─────────┬─────────┬─────────┐       │
│  │ Error   │Security │ Perf    │ A11y    │   UX    │       │
│  │ Agent   │ Agent   │ Agent   │ Agent   │ Agent   │       │
│  └────┬────┴────┬────┴────┬────┴────┬────┴────┬────┘       │
│       ↓         ↓         ↓         ↓         ↓            │
│  5. Each agent queries their category                       │
│  6. Fixes issues in codebase                                │
│  7. Updates issue status in Supabase                        │
│                    ↓                                        │
│  8. You review fixes, merge PRs                             │
│                    ↓                                        │
│  9. Deploy → Repeat                                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

This gives you a fully automated QA pipeline where:
- Issues are captured automatically
- Agents can work independently on their category  
- Everything is tracked in one place
- You maintain control with the review step