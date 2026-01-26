# Outreach System

A full-stack system for tracking outreach campaigns, managing leads, and measuring rep performance.

---

## AI Context (Read This First)

**Tech Stack:** Next.js, Supabase (PostgreSQL), TypeScript, Tailwind CSS

**Current State:** Brand new project - planning phase. Documentation structure set up, no application code yet.

**What to read for context:**
1. `planning/remaining.md` - Current priorities and what to work on next
2. `planning/gameplan.html` - Full specs and system design (open in browser)
3. `development/prd.json` - PRD stories with acceptance criteria

**Key conventions:**
- PRD stories use IDs like `[MODULE]-001` (e.g., AUTH-001, SETUP-001)
- Planning docs in `planning/`, development workflow in `development/`
- App code will live in a separate folder (e.g., `app/` or `outreach-app/`)
- Use the Ralph workflow for story execution (see `development/ralph-prompt.md`)

---

## Folder Structure

```
Outreach System WebSite/
│
├── README.md                           ← You are here
│
├── planning/                           ← Strategic planning (what & why)
│   ├── README.md                       ← How to use the planning folder
│   ├── gameplan.html                   ← Visual implementation plan with status
│   ├── remaining.md                    ← Priority queue (what to work on next)
│   ├── backlog.md                      ← Ideas not yet committed
│   ├── decisions-log.md                ← Why we chose what we chose
│   └── research/                       ← Analysis before decisions
│       ├── tools-research.md
│       ├── telephony-research.md
│       ├── compliance-research.md
│       ├── outreach-best-practices.md
│       └── target-audience-website-builder.md
│
├── development/                        ← Active development (how & now)
│   ├── prd.json                        ← PRD stories with acceptance criteria
│   └── ralph-prompt.md                 ← Development methodology/workflow
│
└── [app-folder]/                       ← Application code (created when building)
```

---

## Quick Reference

| What You Need | Where to Look |
|---------------|---------------|
| What's being built | `planning/gameplan.html` |
| What to work on next | `planning/remaining.md` |
| PRD stories & criteria | `development/prd.json` |
| How to work through stories | `development/ralph-prompt.md` |
| Why we chose something | `planning/decisions-log.md` |
| Future ideas | `planning/backlog.md` |
| Tool/strategy research | `planning/research/` |

---

## Workflows

### Starting a New AI Session
1. Read this README (especially AI Context)
2. Check `planning/remaining.md` for current priorities
3. Open `development/prd.json` for active story details
4. Reference `planning/gameplan.html` for architecture/specs

### Daily Development
1. Check `planning/remaining.md` → What's next?
2. Open story in `development/prd.json` → Get acceptance criteria
3. Reference `planning/gameplan.html` → Get specs/context
4. Implement using Ralph workflow
5. Verify all acceptance criteria pass
6. Mark `passes: true` in prd.json
7. Update `remaining.md` (move to completed)
8. Update `gameplan.html` status badge

### Adding a New Feature
1. Capture idea → Add to `planning/backlog.md`
2. Research needed? → Create `planning/research/[topic].md`
3. Decision made → Log in `planning/decisions-log.md`
4. Ready to build → Add specs to `planning/gameplan.html`
5. Prioritize → Add to `planning/remaining.md`
6. Create stories → Add to `development/prd.json`
7. Build → Work through stories with Ralph workflow

---

## Current Status

**Phase:** Planning & Setup

**Next up:** See `planning/remaining.md` for the prioritized work queue.

---

*Last updated: January 2026*
