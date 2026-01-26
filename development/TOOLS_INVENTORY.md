# Tools Inventory

Template for tracking MCP servers, API keys, and accounts needed for each project.

---

## How to Use

1. Copy this file to your project's `Development/` folder
2. Check off items as you set them up
3. Add project-specific tools as needed
4. Reference during agent onboarding

---

## MCP Servers

### Required for QA System

| MCP Server | Purpose | Status |
|------------|---------|--------|
| Supabase MCP | Query/update QA issues directly | [ ] |

**Supabase MCP Config:**
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

### Required for Comet (Browser Testing)

Choose ONE of these options based on your needs:

---

#### Option A: Claude Code + Chrome Extension (Recommended)

**Best for:** Interactive testing, authenticated apps, live debugging

Uses your actual Chrome browser with your logged-in sessions.

**Setup:**
1. Install [Claude in Chrome extension](https://chromewebstore.google.com/detail/claude/fcoeoabgfenejglbffodgkkbkcdhcgfn) (v1.0.36+)
2. Run Claude Code with: `claude --chrome`
3. Verify with `/chrome` command

**Capabilities:**
- Live debugging (reads console errors, fixes code)
- Test authenticated apps (Google Docs, Gmail, Notion, etc.)
- Record GIFs of test sessions
- Works with localhost dev server

**Example Comet prompt:**
```
Go to localhost:3000, test the login form with invalid data,
check console for errors, and report any issues found.
```

**Docs:** https://code.claude.com/docs/en/chrome

---

#### Option B: Clawdbot (Self-Hosted, Chat-Triggered)

**Best for:** Teams, cross-device, long-running tasks

Open source assistant that runs on your hardware, triggered via chat apps.

**Setup:**
- GitHub: https://github.com/clawdbot/clawdbot
- Docs: https://docs.clawd.bot

**Capabilities:**
- Trigger tests from Slack, Discord, WhatsApp, Teams
- Run on server while you work elsewhere
- Cross-device coordination
- Browser automation + email + calendar

**Example workflow:**
```
Slack message: "Run QA tests on staging.myapp.com"
Clawdbot: Runs tests, posts results back to Slack
```

---

#### Option C: Browser Automation MCPs (Headless/CI)

**Best for:** CI/CD pipelines, automated testing, running test flows

These MCPs automate browser actions (click, navigate, fill forms). Choose based on your needs:

---

##### C1: Microsoft Playwright MCP (Recommended)

**Value:** Official Microsoft server, fast, uses accessibility tree instead of screenshots

| Pros | Cons |
|------|------|
| ✅ Official/maintained by Microsoft | ❌ No console access (pair with DevTools MCP) |
| ✅ No vision model needed (text-based) | ❌ Headless only |
| ✅ Multi-browser (Chrome, Firefox, WebKit) | |
| ✅ Device emulation built-in | |
| ✅ Generates TypeScript code | |

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp-server"]
    }
  }
}
```
GitHub: https://github.com/microsoft/playwright-mcp

---

##### C2: ExecuteAutomation Playwright MCP

**Value:** More tools, API testing, Codegen mode

| Pros | Cons |
|------|------|
| ✅ 20+ tools (more than Microsoft's) | ❌ Community maintained |
| ✅ API testing built-in | ❌ Larger footprint |
| ✅ Codegen mode for recording | |
| ✅ Excel/CSV data handling | |

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@executeautomation/playwright-mcp-server"]
    }
  }
}
```
GitHub: https://github.com/executeautomation/mcp-playwright

---

##### C3: Puppeteer MCP

**Value:** Chrome-specific, simpler API, good for basic automation

| Pros | Cons |
|------|------|
| ✅ Simple, lightweight | ❌ Chrome/Chromium only |
| ✅ Official MCP reference server | ❌ Fewer features than Playwright |
| ✅ Good for basic scraping/testing | ❌ No multi-browser support |

```json
{
  "mcpServers": {
    "puppeteer": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-puppeteer"]
    }
  }
}
```

---

##### Browser Automation Comparison

| Feature | Microsoft Playwright | ExecuteAutomation | Puppeteer |
|---------|---------------------|-------------------|-----------|
| Maintainer | Microsoft (official) | Community | Anthropic reference |
| Multi-browser | ✅ Chrome, Firefox, WebKit | ✅ Yes | ❌ Chrome only |
| Accessibility tree | ✅ Yes | ✅ Yes | ❌ No |
| API testing | ❌ No | ✅ Yes | ❌ No |
| Code generation | ✅ TypeScript | ✅ Codegen mode | ❌ No |
| Best for | General automation | Feature-rich testing | Simple tasks |

---

#### Option D: Chrome DevTools MCP (Full Console Access)

**Best for:** Debugging, console monitoring, network inspection, performance analysis

Official Google-maintained MCP server with full Chrome DevTools Protocol access.

**Chrome DevTools MCP:**
```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest"]
    }
  }
}
```

Or via CLI:
```bash
claude mcp add chrome-devtools --scope user npx chrome-devtools-mcp@latest
```

GitHub: https://github.com/ChromeDevTools/chrome-devtools-mcp

**Capabilities (26+ tools):**
- **Debugging:** `list_console_messages`, `evaluate_script`, `take_screenshot`, `take_snapshot`
- **Network:** Inspect requests, retrieve response data
- **Performance:** Start/stop traces, analyze insights
- **Input:** Click, fill forms, handle dialogs, upload files
- **Navigation:** Open/close pages, wait for conditions

**When to use with other options:**
- Pair with Chrome Extension for authenticated debugging
- Use standalone for deep console/network inspection
- Great for tracking down runtime errors and performance issues

---

#### Which to Choose?

| Scenario | Best Option |
|----------|-------------|
| Testing localhost with your logins | Chrome Extension |
| Team wants chat-based triggers | Clawdbot |
| CI/CD automated testing | Playwright MCP |
| Testing authenticated third-party apps | Chrome Extension |
| Running tests on remote server | Clawdbot or Playwright MCP |
| Debugging console errors/logs | Chrome DevTools MCP |
| Network request inspection | Chrome DevTools MCP |
| Performance profiling | Chrome DevTools MCP |

### Optional MCP Servers

| MCP Server | Purpose | When Needed |
|------------|---------|-------------|
| GitHub MCP | PR creation, issue tracking | If using GitHub |
| Google Drive MCP | Read Docs, Sheets, Drive files | If specs/docs in Google |
| Filesystem MCP | Enhanced file operations | Large codebases |
| Memory MCP | Persistent context | Long sessions |

---

#### Google Drive MCP Setup

**Best for:** Reading project specs, requirements docs, or data from Google Sheets

**Step 1: Google Cloud Setup**
1. Go to [OAuth Consent Screen](https://console.cloud.google.com/apis/credentials/consent)
   - Choose "External"
   - Add your email as a test user
2. Enable APIs:
   - [Google Drive API](https://console.cloud.google.com/apis/library/drive.googleapis.com)
   - [Google Sheets API](https://console.cloud.google.com/apis/library/sheets.googleapis.com)
   - [Google Docs API](https://console.cloud.google.com/apis/library/docs.googleapis.com)
3. Go to [Credentials](https://console.cloud.google.com/apis/credentials)
   - Click "Create Credentials" → "OAuth client ID"
   - Application type: "Desktop app"
   - Download the JSON file

**Step 2: Store credentials securely**

Create a secure folder for MCP credentials (NOT in your project folder):

| OS | Recommended Location |
|----|---------------------|
| Windows | `C:\Users\YourName\.config\mcp\` |
| Mac/Linux | `~/.config/mcp/` |

Save your downloaded JSON as `gdrive-credentials.json` in that folder.

**Do NOT:**
- ❌ Put credentials in project folders (could commit to git)
- ❌ Put in `.env.local` (that's for app secrets)
- ❌ Share the JSON file

**Step 3: Choose an implementation**

##### Option 1: Official Anthropic Server

**Windows:**
```json
{
  "mcpServers": {
    "gdrive": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-gdrive"],
      "env": {
        "GDRIVE_CREDENTIALS_PATH": "C:\\Users\\YourName\\.config\\mcp\\gdrive-credentials.json"
      }
    }
  }
}
```

**Mac/Linux:**
```json
{
  "mcpServers": {
    "gdrive": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-gdrive"],
      "env": {
        "GDRIVE_CREDENTIALS_PATH": "~/.config/mcp/gdrive-credentials.json"
      }
    }
  }
}
```

##### Option 2: Enhanced Server (Sheets read/write)

Open the downloaded JSON to find your `client_id` and `client_secret` values.

**Windows:**
```json
{
  "mcpServers": {
    "gdrive": {
      "command": "npx",
      "args": ["-y", "@isaacphi/mcp-gdrive"],
      "env": {
        "CLIENT_ID": "your-client-id-from-json",
        "CLIENT_SECRET": "your-client-secret-from-json",
        "GDRIVE_CREDS_DIR": "C:\\Users\\YourName\\.config\\mcp"
      }
    }
  }
}
```

**Mac/Linux:**
```json
{
  "mcpServers": {
    "gdrive": {
      "command": "npx",
      "args": ["-y", "@isaacphi/mcp-gdrive"],
      "env": {
        "CLIENT_ID": "your-client-id-from-json",
        "CLIENT_SECRET": "your-client-secret-from-json",
        "GDRIVE_CREDS_DIR": "~/.config/mcp"
      }
    }
  }
}
```
GitHub: https://github.com/isaacphi/mcp-gdrive

**Capabilities:**
- Read Google Docs (converted to markdown)
- Read Google Sheets (converted to CSV)
- Search Drive files
- List folder contents
- Write to Sheets (Option 2 only)

**File Format Conversion:**
| Google Format | Converted To |
|---------------|--------------|
| Google Docs | Markdown (preserves headings, lists, bold) |
| Google Sheets | CSV |
| Google Slides | Plain text |

---

## API Keys & Environment Variables

### Required (QA System)

| Variable | Purpose | Where to Get | Status |
|----------|---------|--------------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Supabase Dashboard > Settings > API | [ ] |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public client key | Supabase Dashboard > Settings > API | [ ] |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin operations | Supabase Dashboard > Settings > API | [ ] |
| `NEXT_PUBLIC_SHOW_QA_OVERLAY` | Show overlay in production | Set to `true` | [ ] |

### Common Project Keys

| Variable | Purpose | When Needed | Status |
|----------|---------|-------------|--------|
| `STRIPE_SECRET_KEY` | Payment processing | If using Stripe | [ ] |
| `STRIPE_PUBLISHABLE_KEY` | Client-side Stripe | If using Stripe | [ ] |
| `OPENAI_API_KEY` | AI features | If using OpenAI | [ ] |
| `ANTHROPIC_API_KEY` | AI features | If using Claude API | [ ] |
| `RESEND_API_KEY` | Email sending | If using Resend | [ ] |
| `UPSTASH_REDIS_URL` | Rate limiting, caching | If using Redis | [ ] |

### Add Your Project-Specific Keys

| Variable | Purpose | Where to Get | Status |
|----------|---------|--------------|--------|
| | | | [ ] |
| | | | [ ] |
| | | | [ ] |

---

## Accounts to Create

### Required

| Account | Purpose | URL | Status |
|---------|---------|-----|--------|
| Supabase | Database + Auth | https://supabase.com | [ ] |
| Vercel | Deployment | https://vercel.com | [ ] |

### Common Optional

| Account | Purpose | URL | Status |
|---------|---------|-----|--------|
| Stripe | Payments | https://stripe.com | [ ] |
| Resend | Transactional email | https://resend.com | [ ] |
| Upstash | Redis/rate limiting | https://upstash.com | [ ] |
| Sentry | Error tracking | https://sentry.io | [ ] |

### Add Your Project-Specific Accounts

| Account | Purpose | URL | Status |
|---------|---------|-----|--------|
| | | | [ ] |
| | | | [ ] |

---

## Database Setup

### Supabase Tables

| Table | Purpose | SQL Location | Status |
|-------|---------|--------------|--------|
| `qa_page_visits` | QA tracking | `QA_SYSTEM_SETUP.md` | [ ] |
| `qa_issues` | QA issues | `QA_SYSTEM_SETUP.md` | [ ] |
| `qa-assets` bucket | Screenshots | `QA_SYSTEM_SETUP.md` | [ ] |

### Add Your Project Tables

| Table | Purpose | Migration File | Status |
|-------|---------|----------------|--------|
| | | | [ ] |
| | | | [ ] |

---

## MCP Config File Location

**Claude Code:** `~/.claude/mcp.json` (global) or `.claude/mcp.json` (project)

**Combined Config Example:**
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
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp-server"]
    }
  }
}
```

---

## Verification Checklist

Before starting development:

- [ ] All required MCP servers configured
- [ ] MCP servers tested (can Claude access them?)
- [ ] All required API keys in `.env.local`
- [ ] All required accounts created
- [ ] Database tables created
- [ ] Dev server runs without errors

Before Comet testing:

- [ ] Playwright MCP installed and working
- [ ] Dev server running (`npm run dev`)
- [ ] QA API endpoint accessible
- [ ] Supabase tables accepting data

---

## Troubleshooting

### MCP Server Not Connecting

1. Check config file location and syntax
2. Restart Claude Code after config changes
3. Try running the npx command manually to see errors
4. Check if required env vars are set

### Browser MCP Issues

```bash
# Manually install Playwright browsers
npx playwright install

# Test Playwright works
npx playwright open https://example.com
```

### Supabase MCP Issues

1. Verify service role key (not anon key)
2. Check project URL is correct
3. Ensure no RLS blocking service role

---

## Quick Setup Checklist

New project quick start:

```
1. [ ] Create Supabase project
2. [ ] Run QA schema SQL
3. [ ] Add env vars to .env.local
4. [ ] Add Supabase MCP to config
5. [ ] Add Playwright MCP to config
6. [ ] Test: npm run dev
7. [ ] Test: Visit page, check QA overlay
8. [ ] Test: Ask Claude to query qa_issues table
```
