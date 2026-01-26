# Legacy Project Migration

Guide for bringing existing codebases up to standard using multi-agent refactoring.

---

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    MIGRATION PIPELINE                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Phase 1: Assessment ──────→ Understand what exists             │
│      ↓                                                          │
│  Phase 2: QA Integration ──→ Add monitoring first               │
│      ↓                                                          │
│  Phase 3: Security Audit ──→ Fix critical issues                │
│      ↓                                                          │
│  Phase 4: Structure Audit ─→ Map to target architecture         │
│      ↓                                                          │
│  Phase 5: Incremental Fix ─→ Multi-agent refactoring            │
│      ↓                                                          │
│  Phase 6: Verification ────→ Full testing cycle                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Key Principle:** Don't rewrite everything at once. Fix incrementally, test continuously.

---

## Phase 1: Assessment

**Goal:** Understand what you're working with

### Codebase Audit Prompt

```
Analyze this codebase and create an assessment report:

1. **File Count & Structure**
   - Total files by type (.tsx, .ts, .js, .css, etc.)
   - Folder structure overview
   - Identify main entry points

2. **Architecture Patterns**
   - What frameworks are used?
   - Where is business logic? (pages vs separate files)
   - How is state managed?
   - How is data fetched?

3. **Security Quick Scan**
   - Are there auth checks before data access?
   - Any obvious `select *` queries?
   - Any hardcoded secrets visible?
   - API routes without validation?

4. **Technical Debt Indicators**
   - Files over 300 lines
   - Deeply nested folders
   - Duplicate code patterns
   - Inconsistent naming

5. **Dependencies**
   - List main packages
   - Any outdated or vulnerable?
   - Any unused?

Output a summary with:
- Overall health score (1-10)
- Top 5 risks
- Top 5 quick wins
- Estimated refactoring scope (small/medium/large)
```

### Assessment Output Template

```markdown
# Codebase Assessment: [Project Name]
Date: _______________

## Summary
- Total Files: ___
- Lines of Code: ~___
- Health Score: _/10

## Architecture
- Framework: ___
- State Management: ___
- Data Fetching: ___
- Auth: ___

## Critical Issues (Fix Immediately)
1. _______________
2. _______________
3. _______________

## High Priority (This Sprint)
1. _______________
2. _______________
3. _______________

## Medium Priority (Next Sprint)
1. _______________
2. _______________

## Low Priority (Backlog)
1. _______________
2. _______________

## Quick Wins (< 1 hour each)
1. _______________
2. _______________
3. _______________

## Refactoring Scope
[ ] Small - Few files need changes
[ ] Medium - Multiple features need restructuring
[ ] Large - Major architectural changes needed
```

---

## Phase 2: QA Integration (Do First)

**Goal:** Add visibility before making changes

### Why First?

Before changing anything, add the QA system so you can:
- See what breaks as you refactor
- Track issues systematically
- Measure improvement over time

### Integration Steps

1. **Copy QA files** (see `INTEGRATION.md`)
   - `src/components/dev/DevQAOverlay.tsx`
   - `src/app/api/qa-report/route.ts`
   - `src/lib/supabase.ts` (if needed)

2. **Add environment variables**
   ```env
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   NEXT_PUBLIC_SHOW_QA_OVERLAY=true
   ```

3. **Run Supabase schema**
   - Copy SQL from `QA_SYSTEM_SETUP.md`

4. **Add overlay to layout**
   ```tsx
   import { DevQAOverlay } from '@/components/dev'
   // Add <DevQAOverlay /> before closing </body>
   ```

5. **Verify working**
   - Start dev server
   - Visit pages
   - Check Supabase for data

---

## Phase 3: Security Audit

**Goal:** Fix security issues before anything else

### Security Scan Prompt

```
Perform a security audit of this codebase:

## Check Each File For:

### Authentication
- [ ] Does it access user data without checking auth?
- [ ] Does it modify data without checking auth?
- [ ] Are there admin routes without role checks?

### Data Access
- [ ] Any `select *` or `select('*')` queries?
- [ ] Any queries without `.limit()`?
- [ ] Any queries without user filtering?
- [ ] Data fetched then filtered client-side?

### Input Validation
- [ ] API routes accepting unvalidated input?
- [ ] Form submissions without validation?
- [ ] URL parameters used directly in queries?

### Secrets
- [ ] Any API keys in client code?
- [ ] Any hardcoded credentials?
- [ ] Secrets in URL parameters?

### Output
For each issue found:
- File path
- Line number(s)
- Issue type
- Severity (critical/high/medium/low)
- Suggested fix

Prioritize by severity.
```

### Security Fix Priority

| Priority | Fix Within | Examples |
|----------|------------|----------|
| Critical | Immediately | Auth bypass, exposed secrets |
| High | Same day | Missing auth checks, SQL injection risk |
| Medium | This week | Missing validation, select * |
| Low | This sprint | Missing limits, client filtering |

### Security Fix Template

For each security issue:

```
File: [path]
Issue: [description]
Current Code:
```[code]```

Fixed Code:
```[code]```

Verification:
- [ ] Auth check added
- [ ] Input validated
- [ ] Query limited
- [ ] Tested manually
```

---

## Phase 4: Structure Audit

**Goal:** Map current code to target architecture

### Target Structure (from CODING_STANDARDS.md)

```
src/
├── app/                    # Routes only
├── features/               # Business logic by feature
│   └── [feature]/
│       ├── components/
│       ├── hooks/
│       ├── actions/
│       ├── queries/
│       └── types.ts
├── components/             # Shared UI (used 3+ places)
└── lib/                    # Utilities
```

### Structure Mapping Prompt

```
Map this codebase to our target structure:

1. **Identify Features**
   List distinct features (auth, dashboard, settings, etc.)

2. **For Each Feature, Find:**
   - UI components (where are they now?)
   - Data fetching (where does it happen?)
   - Data mutations (where do writes happen?)
   - State management (where is state?)
   - Types (are they defined?)

3. **Identify Shared Components**
   Components used in 3+ places

4. **Create Migration Map**
   ```
   Current Location → Target Location
   pages/dashboard.tsx → features/dashboard/components/DashboardPage.tsx
   lib/api/users.ts → features/users/queries/getUsers.ts
   ```

5. **Identify Dependencies**
   Which migrations depend on others?
   What order should we do this?
```

### Migration Map Template

```markdown
# Structure Migration Map

## Feature: [Name]

### Current State
- Components: [locations]
- Data fetching: [locations]
- Mutations: [locations]
- State: [locations]

### Target State
- features/[name]/components/
- features/[name]/queries/
- features/[name]/actions/
- features/[name]/hooks/
- features/[name]/types.ts

### Files to Move/Refactor
| Current | Target | Dependencies |
|---------|--------|--------------|
| | | |

### Migration Order
1. ___
2. ___
3. ___
```

---

## Phase 5: Incremental Refactoring

**Goal:** Fix code systematically with multiple agents

### Agent Assignment Strategy

**For Large Codebases (100k+ lines):**

```
Agent 1: Authentication feature
Agent 2: Dashboard feature
Agent 3: User management feature
Agent 4: [Feature 4]
Agent 5: [Feature 5]
Agent 6: Shared components + utilities
```

**Rules:**
- Each agent owns specific folders/files
- No overlapping file edits
- Shared components: one agent owns, others wait
- Create checkpoint commits before major changes

### Refactoring Agent Prompt Template

```
You are refactoring the [FEATURE NAME] feature.

## Your Files
You own these files/folders:
- [list specific paths]

DO NOT modify files outside your assignment.

## Current State
[Paste assessment for this feature]

## Target State
Follow the structure in CODING_STANDARDS.md:
- Components in features/[name]/components/
- Queries in features/[name]/queries/
- Actions in features/[name]/actions/
- Hooks in features/[name]/hooks/
- Types in features/[name]/types.ts

## Tasks
1. Create the target folder structure
2. Move/refactor files one at a time
3. Apply Ralph Wiggum validation to each file:
   - [ ] Auth check before data access
   - [ ] Input validation
   - [ ] Error handling
   - [ ] No console errors
4. Update imports in dependent files
5. Test after each file change
6. Commit working changes frequently

## Constraints
- Don't break existing functionality
- Keep the app running at all times
- If unsure, ask before changing
- Create checkpoints before risky changes

## Output
After each file:
- What was changed
- What still needs to change
- Any blockers or questions
```

### Incremental Fix Order

```
1. Security fixes (Phase 3) - MUST be first
   ↓
2. Extract types (low risk, high value)
   ↓
3. Extract queries (isolate data fetching)
   ↓
4. Extract actions (isolate mutations)
   ↓
5. Extract hooks (isolate state logic)
   ↓
6. Reorganize components (riskiest, do last)
```

### Checkpoint Strategy

Before any risky change:

```bash
# Create checkpoint
git add -A && git commit -m "checkpoint: before [description]"

# Or create branch
git checkout -b refactor/[feature-name]
```

After successful change:

```bash
git add -A && git commit -m "refactor([feature]): [what changed]"
```

---

## Phase 6: Verification

**Goal:** Confirm everything works

### Post-Migration Testing

1. **Smoke Test**
   - Can you log in?
   - Do main pages load?
   - Do forms submit?

2. **Feature Test**
   - Test each refactored feature
   - Check happy path
   - Check error cases

3. **Comet Full Regression**
   ```
   Run full regression test on the application.

   Test all features that were refactored:
   [LIST FEATURES]

   For each:
   - Test main user flow
   - Test error handling
   - Check for console errors
   - Verify data persists

   Log all issues to QA system.
   ```

4. **Performance Check**
   - Are pages still fast?
   - Any new network requests?
   - Bundle size changed?

---

## Migration Checklist

### Before Starting

- [ ] Codebase assessment complete
- [ ] QA system integrated
- [ ] Security audit complete
- [ ] Critical security issues fixed
- [ ] Structure migration map created
- [ ] Agent assignments defined
- [ ] Git checkpoint created

### During Migration

- [ ] One feature at a time
- [ ] Checkpoints after each feature
- [ ] Testing after each change
- [ ] No breaking changes to main
- [ ] Security patterns applied

### After Migration

- [ ] All features refactored
- [ ] Full regression test passed
- [ ] No critical/high issues open
- [ ] Documentation updated
- [ ] Team briefed on new structure

---

## Quick Reference

### Priority Order
```
1. Security (auth, validation, secrets)
2. Types (define data shapes)
3. Queries (isolate reads)
4. Actions (isolate writes)
5. Hooks (isolate state)
6. Components (reorganize UI)
```

### File Size Triggers
```
> 300 lines → Must split
> 200 lines → Should split
> 150 lines → Consider splitting
```

### Ralph Wiggum for Legacy Code
```
Every file you touch:
[ ] Add auth check if accessing data
[ ] Add input validation if accepting input
[ ] Add error handling if can fail
[ ] Remove select *
[ ] Add .limit() to queries
[ ] Filter in database, not client
```

### Recovery
```
Something broke? See Error Recovery in CODING_STANDARDS.md
```

---

## Example: 170k Line Codebase

For a large existing project:

**Week 1:**
- Day 1-2: Assessment
- Day 3: QA integration
- Day 4-5: Security audit + critical fixes

**Week 2:**
- Security fixes (high priority)
- Extract types across codebase
- Create feature folder structure

**Week 3-4:**
- Agent 1: Auth feature
- Agent 2: Dashboard feature
- Agent 3: User feature
- Agent 4-5: Other features
- Agent 6: Shared components

**Week 5:**
- Integration testing
- Comet regression
- Fix remaining issues
- Documentation

**Ongoing:**
- Apply standards to new code
- Gradually refactor remaining legacy
- Track technical debt in QA system
