# Pre-Flight Diagnostics

Quick checks to run BEFORE diving into troubleshooting. Catches 80% of issues in 2 minutes.

---

## Quick Check Commands

Run these before troubleshooting to eliminate common causes:

### 1. Is the Dev Server Running?

**Next.js (web/):**
```bash
# Check if running
netstat -ano | findstr :3000

# If not running, start it
cd web && npm run dev
```

**Express (twilio-ai-coach/):**
```bash
# Check if running
netstat -ano | findstr :3001

# If not running, start it
cd twilio-ai-coach && npm start
```

### 2. Are There Port Conflicts?

```bash
# See what's using common ports
netstat -ano | findstr :3000
netstat -ano | findstr :3001
netstat -ano | findstr :3002

# Kill a stuck process (replace PID)
taskkill /F /PID [PID_NUMBER]
```

### 3. Is Node Working?

```bash
node --version
npm --version
```

### 4. Are Dependencies Installed?

```bash
# In web/
cd web && npm ls --depth=0

# In twilio-ai-coach/
cd twilio-ai-coach && npm ls --depth=0

# If issues, reinstall
npm install
```

### 5. Is Supabase Reachable?

```bash
# Quick connectivity test
curl -I https://your-project.supabase.co/rest/v1/
```

### 6. Are Environment Variables Set?

Check `.env.local` exists and has required values:

**web/.env.local:**
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

**twilio-ai-coach/.env:**
```
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
SUPABASE_URL=
SUPABASE_ANON_KEY=
```

---

## MCP Server Checks

### Is Playwright MCP Working?

Ask Claude:
```
Use Playwright to navigate to https://example.com and take a screenshot
```

If it fails:
```bash
# Manually install browsers
npx playwright install
```

### Is Chrome DevTools MCP Working?

Ask Claude:
```
Use Chrome DevTools to list any console messages on the current page
```

---

## Common Issues Quick Fixes

### "EADDRINUSE" (Port in Use)

```bash
# Find what's using the port
netstat -ano | findstr :3000

# Kill it
taskkill /F /PID [PID]
```

### ".next folder locked" (Next.js)

```bash
# Delete .next folder
rd /s /q web\.next

# Restart dev server
cd web && npm run dev
```

### "Module not found"

```bash
# Clear and reinstall
rd /s /q node_modules
del package-lock.json
npm install
```

### "Cannot connect to Supabase"

1. Check internet connection
2. Verify URL in .env.local is correct
3. Check Supabase dashboard - is project paused?
4. Verify API keys haven't been rotated

### "Twilio Error"

1. Check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN
2. Verify ngrok is running if testing locally
3. Check Twilio console for error logs

---

## Pre-Flight Checklist

Before starting any troubleshooting session:

- [ ] Dev server(s) running without errors
- [ ] No port conflicts
- [ ] Environment variables present
- [ ] Can reach external services (Supabase, Twilio)
- [ ] MCP servers responding
- [ ] Browser console is open (for live debugging)

---

## Diagnostic Prompts for Claude

### Full Environment Check

```
Run a full environment diagnostic:
1. Check if web/ dev server is accessible at localhost:3000
2. Check if twilio-ai-coach is accessible at localhost:3001
3. Use Playwright to navigate to localhost:3000 and report any errors
4. List any console messages using Chrome DevTools
```

### Database Connectivity Check

```
Verify Supabase connectivity:
1. Query the qa_issues table (or any table) to confirm connection
2. Report any connection errors
3. List table names if connected
```

### Service Health Check

```
Check all service health:
1. Navigate to localhost:3000 - does it load?
2. Navigate to localhost:3001 - does it load?
3. Check for any console errors on each
4. Report status of each service
```

---

## When Pre-Flight Fails

If any of these checks fail, fix them BEFORE troubleshooting the actual issue. Common pre-flight failures mask real issues:

| Pre-Flight Failure | Do This First |
|-------------------|---------------|
| Server not running | Start the server |
| Port conflict | Kill conflicting process |
| Missing env vars | Add them to .env.local |
| Dependencies broken | `npm install` |
| Service unreachable | Check internet, service status |
| MCP not responding | Restart Claude Code |

---

## Quick Reference Card

```
PRE-FLIGHT (run before any debugging):

1. Server running?     → netstat -ano | findstr :3000
2. Port conflicts?     → taskkill /F /PID [PID]
3. Node working?       → node --version
4. Deps installed?     → npm ls --depth=0
5. Env vars set?       → check .env.local
6. Services reachable? → curl -I [URL]

All green? → Proceed to TROUBLESHOOTING_WORKFLOW.md
Something red? → Fix it first
```
