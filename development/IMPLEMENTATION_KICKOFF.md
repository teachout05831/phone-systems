# Implementation Kickoff

**Read this first when starting feature implementation.** This document orients you to the system and shows you how to coordinate multi-agent development.

---

## Available Resources

### Documentation (Development/ folder)

| Document | Purpose | When to Use |
|----------|---------|-------------|
| **CODING_STANDARDS.md** | Security patterns, file structure, Ralph Wiggum | Always - share with all agents |
| **WORKFLOW.md** | 6-phase process, Comet testing | Planning agent assignments |
| **STORY_WORKFLOW.md** | Working through PRD stories one at a time | During Phase 5 feature development |
| **IMPLEMENTATION_KICKOFF.md** | This file - starting new feature implementation | Lead agent reads first |
| **REFACTORING_KICKOFF.md** | Refactoring existing code, security fixes | Cleaning up existing projects |
| **QA_SYSTEM_SETUP.md** | Supabase schema, env vars | Setting up new projects |
| **QA_AGENT_COMMANDS.md** | Query/fix issues via MCP | Agents fixing QA issues |
| **TOOLS_INVENTORY.md** | MCP servers, API keys | Setting up tools |
| **INTEGRATION.md** | Adding QA to existing projects | Existing projects |
| **PROJECT_CHECKLIST.md** | Audit what's missing | Auditing projects |
| **LEGACY_MIGRATION.md** | High-level migration phases | Large existing projects |

### MCP Servers Available

| MCP Server | What It Does | When to Use |
|------------|--------------|-------------|
| **Supabase MCP** | Query/update database directly | QA issue management, data queries |
| **Playwright MCP** | Headless browser automation | CI/CD testing, automated QA |
| **GitHub MCP** | PR creation, issue tracking | Git workflow automation |

### Browser Testing Options

| Tool | What It Does | Best For |
|------|--------------|----------|
| **Claude Code + Chrome** | Control your Chrome from terminal | Interactive testing, authenticated apps |
| **Clawdbot** | Chat-triggered testing (Slack/Discord) | Team workflows, async testing |
| **Playwright MCP** | Headless browser | CI/CD, automated pipelines |

### QA System Components

| Component | Location | Purpose |
|-----------|----------|---------|
| DevQAOverlay | src/components/dev/ | Auto-captures issues in browser |
| QA Dashboard | src/app/dashboard/qa/ | Review and manage issues |
| QA API Route | src/app/api/qa-report/ | Syncs issues to Supabase |

### Key Patterns

| Pattern | What It Means | Where Documented |
|---------|---------------|------------------|
| **Ralph Wiggum** | Validate everything, trust nothing | CODING_STANDARDS.md |
| **File Limits** | Components 150 lines, Hooks 100 lines | CODING_STANDARDS.md |
| **Auth First** | getUser() before any data access | CODING_STANDARDS.md |
| **Comet Loop** | Build → Self-test → External test → Fix | WORKFLOW.md |

---

## Before You Start

### Prerequisites Checklist

Before implementation, these should be complete:

- [ ] Phase 1: Game Plan done (requirements defined)
- [ ] Phase 2: Design selected (style guide exists)
- [ ] Phase 3: Page Planning done (page list with components)
- [ ] Phase 4: HTML Build done (page structures exist)
- [ ] Dev server runs without errors
- [ ] QA system integrated (overlay + Supabase)

If any are missing, complete them first.

---

## Step 1: Read These Documents

**Required reading before planning implementation:**

| Document | What You'll Learn | Time |
|----------|-------------------|------|
| [CODING_STANDARDS.md](CODING_STANDARDS.md) | Security patterns, file structure, Ralph Wiggum validation | 5 min |
| [WORKFLOW.md](WORKFLOW.md) | Development phases, agent deployment numbers, Comet triggers | 5 min |

**Key concepts to internalize:**
- Ralph Wiggum: Validate everything, trust nothing
- File limits: Components 150 lines, Hooks 100 lines, etc.
- Security: Auth check → Validate input → Filter by user → Limit results
- Agent boundaries: Each agent owns specific files, no overlap

---

## Step 2: Assess the Work

### List All Features to Implement

```
Features:
1. [Feature name] - [Brief description]
2. [Feature name] - [Brief description]
3. [Feature name] - [Brief description]
...
```

### Map Features to Files

For each feature, identify:
- Which pages it touches
- What components it needs
- What API routes/actions it needs
- What database tables it uses

```
Feature: User Authentication
├── Pages: /login, /signup, /forgot-password
├── Components: LoginForm, SignupForm, PasswordResetForm
├── Actions: login, signup, resetPassword, logout
├── Queries: getUser, getSession
└── Tables: users, sessions
```

### Determine Agent Count

| Features | Recommended Agents |
|----------|-------------------|
| 1-3 | 2-3 (sequential or parallel) |
| 4-8 | 5-6 (parallel by feature) |
| 9+ | 6-10 (batched parallel) |

---

## Step 3: Create Agent Assignments

### Assignment Rules

1. **One agent = one feature area** (no overlapping files)
2. **Shared components**: One agent owns, others wait or consume
3. **API routes**: Can be separate agent or bundled with feature
4. **Database**: Usually one agent owns schema, others just use it

### Assignment Template

```
## Agent Assignments

### Agent 1: [Feature Name]
**Files owned:**
- src/features/[name]/components/*
- src/features/[name]/hooks/*
- src/features/[name]/actions/*
- src/features/[name]/queries/*

**Dependencies:** None (or: Waits for Agent X to complete Y)

### Agent 2: [Feature Name]
**Files owned:**
- src/features/[name]/components/*
- ...

**Dependencies:** Uses AuthContext from Agent 1

### Agent 3: Shared Components
**Files owned:**
- src/components/ui/*
- src/components/forms/*

**Dependencies:** None - others depend on this
```

---

## Step 4: Create Agent Prompts

### Prompt Template

Use this template for each sub-agent:

```markdown
# Agent [N]: [Feature Name]

## Context
You are implementing the [FEATURE] feature for [PROJECT].

**Read these first:**
- Development/CODING_STANDARDS.md (security patterns, file structure)
- Development/WORKFLOW.md (development process)

## Your Assignment

### Files You Own (ONLY modify these)
- src/features/[name]/components/*
- src/features/[name]/hooks/*
- src/features/[name]/actions/*
- src/features/[name]/queries/*
- src/features/[name]/types.ts

### DO NOT modify files outside your assignment

## Requirements

[Describe what this feature should do]

1. [Requirement 1]
2. [Requirement 2]
3. [Requirement 3]

## Technical Spec

### Components Needed
- [ComponentName]: [What it does]
- [ComponentName]: [What it does]

### Actions Needed
- [actionName]: [What it does]

### Queries Needed
- [queryName]: [What it does]

## Ralph Wiggum Checklist (Do After Each File)

- [ ] Auth check before data access (getUser())
- [ ] All inputs validated before processing
- [ ] Error states handled
- [ ] Loading states shown
- [ ] No console errors
- [ ] File under line limit

## Dependencies

- **Waiting for:** [Nothing / Agent X to complete Y]
- **Others waiting for you:** [Nothing / Agents X, Y need your Z]

## Output

When done, report:
1. Files created/modified
2. Any issues found during self-validation
3. Any blockers or questions
4. Ready for Comet testing? (yes/no)
```

---

## Step 5: Launch Agents

### Option A: Sequential (2-3 agents)

Run one at a time in same terminal:
```
1. Give Agent 1 prompt → Wait for completion
2. Give Agent 2 prompt → Wait for completion
3. Give Agent 3 prompt → Wait for completion
4. Run Comet tests
```

### Option B: Parallel with tmux (5-6 agents)

```bash
# Create tmux session
tmux new -s dev

# Split into panes (Ctrl+b % for vertical, Ctrl+b " for horizontal)
# In each pane:
claude

# Give each agent their prompt
# Monitor progress, switch panes with Ctrl+b [arrow]
```

### Option C: Background agents with Claude Code

```bash
# In Claude Code, launch background tasks
# Agent 1
claude --background "$(cat prompts/agent1.md)"

# Agent 2
claude --background "$(cat prompts/agent2.md)"

# Check status
claude --status
```

---

## Step 6: Monitor Progress

### What to Watch For

- **File conflicts**: Two agents editing same file
- **Dependency blocks**: Agent waiting for another
- **Errors**: Console errors, type errors
- **Scope creep**: Agent doing more than assigned

### Intervention Points

| Signal | Action |
|--------|--------|
| Agent stuck on error | Help debug, don't take over |
| Agent modifying wrong files | Stop and redirect |
| Agent scope creeping | Stop and refocus |
| Agent asking questions | Answer, then let them continue |

---

## Step 7: Trigger Comet Testing

After agents complete their work:

### Quick Test Prompt (Chrome Integration)

```
Run claude --chrome, then:

Go to localhost:3000 and test these features that were just implemented:
- [Feature 1]: Test [specific flow]
- [Feature 2]: Test [specific flow]
- [Feature 3]: Test [specific flow]

For each:
1. Test the happy path
2. Test with invalid input
3. Check console for errors
4. Report any issues found
```

### Full Comet Prompt

See WORKFLOW.md → Phase 5 → Comet Testing Prompt

---

## Quick Reference

### Documents to Share with Agents

| Always | Sometimes |
|--------|-----------|
| CODING_STANDARDS.md | WORKFLOW.md (if coordinating) |
| Their specific prompt | QA_AGENT_COMMANDS.md (if fixing issues) |

### Agent Count Quick Guide

```
Small feature (1 page, 1 form): 1 agent
Medium feature (3-5 pages): 2-3 agents
Large feature (full module): 4-6 agents
Full app build: 6-10 agents
```

### Coordination Commands

```bash
# Check what files each agent has modified
git status

# See changes by agent (if using branches)
git log --oneline --all

# Quick diff
git diff
```

### If Something Breaks

See CODING_STANDARDS.md → Error Recovery

---

## Example: Starting a 5-Feature Implementation

```
## Assessment

Features to implement:
1. User Authentication (login, signup, logout)
2. Dashboard (stats, charts)
3. Settings (profile, preferences)
4. Data Tables (list, filter, pagination)
5. Forms (create, edit workflows)

## Agent Assignments

Agent 1: Authentication
- src/features/auth/*
- src/app/(auth)/*

Agent 2: Dashboard
- src/features/dashboard/*
- Depends on: Auth context from Agent 1

Agent 3: Settings
- src/features/settings/*
- Depends on: Auth context from Agent 1

Agent 4: Data Tables
- src/features/tables/*
- src/components/ui/Table.tsx (owns this shared component)

Agent 5: Forms
- src/features/forms/*
- Depends on: Table component from Agent 4

## Launch Order

1. Agent 1 (Auth) - Start immediately
2. Agent 4 (Tables) - Start immediately (no deps)
3. Wait for Agent 1 to complete AuthContext
4. Agents 2, 3 - Start after Auth done
5. Agent 5 - Start after Tables done
6. Comet testing after all complete
```

---

## Checklist Before Launching Agents

- [ ] Features listed and scoped
- [ ] Files mapped to each feature
- [ ] Agent count determined
- [ ] Assignments created (no file overlaps)
- [ ] Prompts written for each agent
- [ ] Dependencies identified
- [ ] Launch order determined
- [ ] tmux/terminal setup ready
