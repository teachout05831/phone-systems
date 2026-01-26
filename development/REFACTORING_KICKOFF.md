# Refactoring Kickoff

**Read this first when refactoring existing code.** This document orients you to systematically clean up, secure, and restructure a large codebase with parallel agents.

---

## Available Resources

### Documentation (Development/ folder)

| Document | Purpose | When to Use |
|----------|---------|-------------|
| **CODING_STANDARDS.md** | Security patterns, file structure, Ralph Wiggum | Always - the target standard |
| **REFACTORING_KICKOFF.md** | This file - starting refactoring | Lead agent reads first |
| **LEGACY_MIGRATION.md** | 6-phase migration process | High-level planning |
| **QA_AGENT_COMMANDS.md** | Query/fix issues via MCP | Finding existing issues |
| **TOOLS_INVENTORY.md** | MCP servers, API keys | Setting up tools |

### Key Patterns to Apply

| Pattern | What to Look For | What to Fix |
|---------|------------------|-------------|
| **Ralph Wiggum** | Unvalidated inputs, trusted data | Add validation at every boundary |
| **Auth First** | Data access without getUser() | Add auth checks before all queries |
| **File Limits** | Files over 150-300 lines | Split into smaller files |
| **No select(*)** | Queries selecting all fields | Specify only needed fields |
| **Add .limit()** | Queries without limits | Add limits to all list queries |
| **Filter in DB** | Client-side filtering | Move filters to database queries |

---

## Refactoring Priority Order

Always fix in this order:

```
1. SECURITY (Critical)
   └── Auth checks, input validation, secrets exposure

2. ERRORS (High)
   └── Console errors, type errors, runtime crashes

3. PERFORMANCE (Medium)
   └── select *, no limits, client filtering, N+1 queries

4. STRUCTURE (Lower)
   └── File organization, naming, code splitting
```

**Rule:** Never do structure refactoring until security and errors are fixed.

---

## Step 1: Codebase Assessment

### Quick Scan Prompt

Give this to an assessment agent:

```markdown
# Codebase Assessment

Analyze this codebase and report:

## 1. File Inventory
- Total files by type (.tsx, .ts, .js, .css)
- Files over 300 lines (list them)
- Folder structure overview

## 2. Security Quick Scan
For each file that accesses data, check:
- [ ] Is there a getUser() call before data access?
- [ ] Are inputs validated before use?
- [ ] Any select('*') or select * queries?
- [ ] Any hardcoded secrets or API keys?
- [ ] Any .env values exposed to client?

## 3. Code Quality
- Files with console.log statements
- Files with TODO/FIXME comments
- Files with any type usage
- Files with eslint-disable comments

## 4. Output
Create a prioritized list:
- CRITICAL: Security issues (list files + line numbers)
- HIGH: Errors and type issues (list files)
- MEDIUM: Performance issues (list files)
- LOW: Structure issues (list files)

Estimate total issues per category.
```

### Assessment Output Template

```markdown
# Assessment: [Project Name]
Date: ___________
Total Files: ___
Total Lines: ~___

## Critical (Security) - Fix Immediately
| File | Line | Issue |
|------|------|-------|
| | | |

## High (Errors) - Fix This Sprint
| File | Issue |
|------|-------|
| | |

## Medium (Performance)
| File | Issue |
|------|-------|
| | |

## Low (Structure)
| File | Issue |
|------|-------|
| | |

## Agent Assignment Recommendation
Based on file groupings:
- Agent 1: [files/folders]
- Agent 2: [files/folders]
- ...
```

---

## Step 2: Security Audit

### Security Scan Prompt

```markdown
# Security Audit

**Read first:** Development/CODING_STANDARDS.md (security templates section)

Scan every file that handles data for these issues:

## Authentication Checks
For each query/action file:
- Does it call getUser() before accessing data?
- Does it return early if no user?
- Does it filter data by user.id?
- Does it verify ownership before update/delete?

## Input Validation
For each file accepting input:
- Are form inputs validated?
- Are URL parameters validated?
- Are request bodies validated?
- Is there type checking?
- Are lengths checked (min/max)?

## Data Exposure
Check for:
- select('*') or select * (should list specific fields)
- Queries without .limit()
- Sensitive data in console.log
- API keys in client code
- .env NEXT_PUBLIC_ exposing secrets

## Scale Problems (from CODING_STANDARDS.md)
Check for:
- Database calls inside loops (N+1 queries)
- Client-side filtering of data (should filter in DB)
- Fetching all records without pagination
- Missing .limit() on list queries

## Output Format
For each issue:
```
File: [path]
Line: [number]
Issue: [description]
Severity: CRITICAL | HIGH | MEDIUM
Current Code:
[snippet]

Fix:
[what to change]
```
```

---

## Step 3: Agent Assignment for Parallel Work

### Assignment Rules (Critical)

1. **No file overlap** - Each agent owns specific files/folders
2. **No dependency chains** - Don't assign files that import from each other to different agents
3. **Complete features** - Keep related files together
4. **Clear boundaries** - Use folder paths, not file patterns

### Assignment by Folder (Recommended)

```markdown
## Agent Assignments

### Agent 1: Authentication & Users
**Owns:**
- src/features/auth/*
- src/features/users/*
- src/app/(auth)/*
- src/lib/auth/*

**DO NOT TOUCH:**
- Anything outside these folders

### Agent 2: Dashboard & Analytics
**Owns:**
- src/features/dashboard/*
- src/features/analytics/*
- src/app/dashboard/*

**DO NOT TOUCH:**
- Anything outside these folders

### Agent 3: Forms & Data Entry
**Owns:**
- src/features/forms/*
- src/features/entries/*
- src/components/forms/*

### Agent 4: API Routes
**Owns:**
- src/app/api/*

### Agent 5: Shared Components
**Owns:**
- src/components/ui/*
- src/components/layouts/*
- src/lib/utils/*

### Agent 6: Shared by All (Run Last)
**Owns:**
- src/lib/supabase/*
- src/types/*
- Configuration files

**IMPORTANT:** This agent runs AFTER others complete
```

### Dependency Check

Before assigning, verify no cross-dependencies:

```
If Agent 1 owns: src/features/auth/
And Agent 2 owns: src/features/dashboard/

Check: Does dashboard/ import from auth/?
If yes: Either same agent, or Agent 2 waits for Agent 1
```

---

## Step 4: Refactoring Agent Prompts

### Security Fix Agent Prompt

```markdown
# Agent [N]: Security Fixes for [AREA]

## Your Assignment
You are fixing security issues in these files ONLY:
- [list specific paths]

## DO NOT modify files outside your assignment

## Read First (REQUIRED)
- Development/CODING_STANDARDS.md (security patterns, validation templates, scale rules)

## Your Tasks

### 1. Add Auth Checks
Every query/action must start with:
```typescript
const { data: { user } } = await supabase.auth.getUser()
if (!user) return { error: 'Not authenticated' }
```

### 2. Add Input Validation
Every function accepting input must validate:
```typescript
if (!input.title || typeof input.title !== 'string') {
  return { error: 'Title is required' }
}
if (input.title.length < 3 || input.title.length > 200) {
  return { error: 'Title must be 3-200 characters' }
}
```

### 3. Fix Queries
Change:
```typescript
// BAD
.select('*')
// GOOD
.select('id, title, created_at')

// BAD
.from('items')
// GOOD
.from('items').eq('user_id', user.id).limit(50)
```

### 4. Remove Exposed Secrets
- Move any hardcoded keys to .env
- Check NEXT_PUBLIC_ vars don't expose secrets
- Remove console.log with sensitive data

## Checklist (After Each File)
- [ ] Auth check at start
- [ ] Inputs validated
- [ ] Specific fields selected (no *)
- [ ] Filtered by user_id where needed
- [ ] .limit() on list queries
- [ ] No secrets exposed

## Output
For each file fixed:
- What was changed
- Any remaining concerns
```

### Structure Refactor Agent Prompt

```markdown
# Agent [N]: Structure Refactor for [AREA]

## Your Assignment
You are restructuring these files ONLY:
- [list specific paths]

## DO NOT modify files outside your assignment

## Read First (REQUIRED)
- Development/CODING_STANDARDS.md (file structure, limits, naming conventions, refactoring rules)

## Target Structure
```
src/features/[name]/
├── components/    # UI only (150 lines max)
├── hooks/         # State logic (100 lines max)
├── actions/       # Database writes (80 lines max)
├── queries/       # Database reads (80 lines max)
├── types.ts       # Type definitions
└── index.ts       # Public exports
```

## Your Tasks

### 1. Split Large Files
Files over 150 lines → split by responsibility:
- UI code → components/
- useState/useEffect → hooks/
- Database reads → queries/
- Database writes → actions/

### 2. Extract Types
Move interfaces/types to types.ts:
```typescript
// types.ts
export interface User {
  id: string
  name: string
  email: string
}
```

### 3. Create Exports
index.ts exports public API:
```typescript
export { UserCard } from './components/UserCard'
export { useUsers } from './hooks/useUsers'
export type { User } from './types'
```

### 4. Fix Naming
- Components: PascalCase (UserCard.tsx)
- Hooks: camelCase with use (useUsers.ts)
- Queries: camelCase with get (getUsers.ts)
- Actions: camelCase verb (createUser.ts)

## Checklist (After Each File)
- [ ] Under line limit
- [ ] In correct folder
- [ ] Types extracted
- [ ] Exports updated
- [ ] Imports updated in dependent files

## Output
For each file:
- Original location
- New location(s)
- What was extracted
```

---

## Step 5: Launch Parallel Agents

### tmux Setup for 6 Agents

```bash
# Create session
tmux new -s refactor

# Create 6 panes
# Ctrl+b % (split vertical)
# Ctrl+b " (split horizontal)
# Repeat until 6 panes

# In each pane:
cd /path/to/project
claude

# Give each agent their prompt
# Switch panes: Ctrl+b [arrow]
# See all panes: Ctrl+b w
```

### Monitoring

Watch for:
- Agent modifying wrong files → Stop immediately
- Agent stuck → Help debug
- Agent asking questions → Answer and let continue
- Agent done → Mark complete, check work

### Coordination Commands

```bash
# See what's been modified
git status

# See changes
git diff

# Checkpoint before risky changes
git add -A && git commit -m "checkpoint: agent [N] progress"
```

---

## Step 6: Verify and Test

### After Each Agent Completes

1. **Review changes:** `git diff`
2. **Check for errors:** `npm run build`
3. **Run if exists:** `npm test`
4. **Manual smoke test:** Does the app still work?

### Verification Checklist (from CODING_STANDARDS.md)

**Security:**
- [ ] Auth check (`getUser()`) in every query and action
- [ ] Ownership check before update/delete
- [ ] Only selecting needed fields (no `select('*')`)
- [ ] Inputs validated before processing
- [ ] No sensitive data exposed in responses

**Structure:**
- [ ] Files under line limits (Component 150, Hook 100, Query/Action 80)
- [ ] Code in correct folder (query/action/hook/component)
- [ ] Types defined in `types.ts`
- [ ] Public exports in `index.ts`

**Scale:**
- [ ] Queries have `.limit()`
- [ ] Filtering done in database, not client
- [ ] No database calls inside loops
- [ ] Large lists paginated

### After All Agents Complete

Run Comet full regression:

```
Run claude --chrome, then:

Perform a full regression test:

1. Navigate to every main page
2. Test core user flows (login, main features)
3. Check console for errors on each page
4. Report any broken functionality

This codebase was just refactored. Look for:
- Broken imports
- Missing components
- Data not loading
- Auth issues
```

---

## Quick Reference

### Fix Priority
```
1. Security (auth, validation, secrets)
2. Errors (console, type, runtime)
3. Performance (queries, limits)
4. Structure (files, naming)
```

### Agent Rules
```
- Each agent owns specific folders
- No file overlap between agents
- Check dependencies before assigning
- Run shared code agent LAST
```

### Common Security Fixes
```typescript
// Add to start of every data function
const { data: { user } } = await supabase.auth.getUser()
if (!user) return { error: 'Not authenticated' }

// Every query
.select('id, name, email')  // Not *
.eq('user_id', user.id)     // Filter by user
.limit(50)                   // Always limit

// Every input
if (!input || typeof input !== 'object') {
  return { error: 'Invalid input' }
}
```

### File Limits
```
Page:      50 lines
Component: 150 lines
Hook:      100 lines
Query:     80 lines
Action:    80 lines
```

### If Something Breaks
```
git checkout -- [file]     # Undo single file
git checkout -- .          # Undo all changes
git reset --soft HEAD~1    # Undo last commit
```

---

## Example: 157k Line Refactor

```markdown
## Phase 1: Assessment (Day 1)
- Run assessment agent
- Get file inventory
- Identify security issues
- Map folder structure

## Phase 2: Agent Assignment
Agent 1: src/features/auth/, src/features/users/
Agent 2: src/features/courses/, src/features/lessons/
Agent 3: src/features/assignments/, src/features/grades/
Agent 4: src/features/dashboard/, src/features/reports/
Agent 5: src/app/api/*, src/lib/
Agent 6: src/components/*, src/types/ (runs last)

## Phase 3: Security Fixes (Days 2-3)
All agents focus ONLY on security:
- Add auth checks
- Add validation
- Fix queries
- Remove exposed secrets

## Phase 4: Error Fixes (Day 4)
Fix type errors, console errors

## Phase 5: Performance (Day 5)
Fix select *, add limits, move filtering to DB

## Phase 6: Structure (Days 6-7)
Split large files, reorganize folders
Agent 6 runs last for shared code

## Phase 7: Testing (Day 8)
Full Comet regression
Fix anything broken
```

---

## Checklist Before Starting

- [ ] Assessment complete
- [ ] Security issues identified
- [ ] Agent folders assigned (no overlap)
- [ ] Dependencies checked
- [ ] Prompts written for each agent
- [ ] Git checkpoint created
- [ ] tmux/terminals ready
