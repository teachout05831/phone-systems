# Story Workflow

A systematic approach for working through PRD stories. One story at a time, full completion before moving on.

---

## Core Concept

Work through stories **one at a time**, **sequentially**, with **full completion** before moving on.

---

## The Workflow

### 1. Pick the Story
```
Open development/prd.json
Find the story with highest priority that hasn't passed
That's your story
```

### 2. Understand It
- Read the story title and ID
- Read ALL acceptance criteria
- Reference `planning/gameplan.html` for context if needed
- Ask questions if anything is unclear

### 3. Plan the Approach
- Break into smaller tasks if needed
- Identify files to create/modify
- Note any dependencies

### 4. Implement
- Write the code
- Apply Ralph Wiggum validation as you go (see CODING_STANDARDS.md)
- Keep it simple - only what the acceptance criteria require

### 5. Verify Each Criterion
Go through each acceptance criterion:
- [ ] Criterion 1 - test it, confirm it works
- [ ] Criterion 2 - test it, confirm it works
- [ ] Criterion 3 - test it, confirm it works

**All must pass. No partial credit.**

### 6. Mark Complete
When ALL criteria pass:
```json
{
  "id": "AUTH-001",
  "passes": true
}
```

Update module status if all stories complete:
```json
{
  "name": "Authentication",
  "status": "completed"
}
```

### 7. Update Planning Docs
- Update `planning/remaining.md` (move to completed)
- Update `planning/gameplan.html` status badge if applicable

### 8. Next Story
Repeat from step 1.

---

## Key Principles

### One Story at a Time
Don't start a new story until the current one passes. Focus.

### Acceptance Criteria Are the Contract
- They define "done"
- Don't add features not in the criteria
- Don't skip criteria because "it's close enough"

### Small, Focused Stories
If a story feels too big:
- Break it into multiple stories
- Each should be completable in one session
- Update prd.json with the new stories

### Priority Order
- Higher priority number = do first
- 100 is highest, work down from there
- Don't skip ahead to "easier" stories

### Passes = All Criteria Met
`"passes": true` means:
- Every single acceptance criterion works
- Tested and verified
- Not "mostly works" or "should work"

---

## Example Session

```
1. Open prd.json
   → SETUP-001 has priority 100 and passes: false
   → This is my story

2. Read it:
   "Initialize Next.js project"
   Criteria:
   - Next.js project created with TypeScript
   - Tailwind CSS configured
   - ESLint and Prettier configured
   - Project runs locally without errors

3. Implement:
   npx create-next-app@latest myapp --typescript
   npm install -D tailwindcss postcss autoprefixer
   npx tailwindcss init -p
   [configure files]

4. Verify:
   ✓ TypeScript? Yes, tsconfig.json exists
   ✓ Tailwind? Yes, can use utility classes
   ✓ ESLint? Yes, npm run lint works
   ✓ Runs locally? Yes, npm run dev shows page

5. Mark complete:
   Change passes: false → passes: true

6. Update remaining.md

7. Next story: SETUP-002
```

---

## When You're Stuck

1. Re-read the acceptance criteria
2. Check gameplan.html for context
3. Check decisions-log.md for relevant decisions
4. Ask for clarification if needed
5. Don't hack around unclear requirements

---

## Planning Files

These files are created during Phase 1 (Game Plan) of your project:

| File | Purpose | When Created |
|------|---------|--------------|
| `development/prd.json` | Story details and acceptance criteria | Phase 1 |
| `planning/gameplan.html` | Architecture, specs, context | Phase 1 |
| `planning/remaining.md` | Track what's left to do | Phase 1, updated ongoing |
| `planning/decisions-log.md` | Record architectural decisions | Ongoing |

### prd.json Structure

```json
{
  "modules": [
    {
      "name": "Authentication",
      "status": "in-progress",
      "stories": [
        {
          "id": "AUTH-001",
          "title": "User can sign up",
          "priority": 100,
          "passes": false,
          "acceptance_criteria": [
            "User can enter email and password",
            "Validation shows errors for invalid input",
            "Success redirects to dashboard",
            "User record created in database"
          ]
        }
      ]
    }
  ]
}
```

---

## Integration with Multi-Agent Workflow

When using multiple agents (see IMPLEMENTATION_KICKOFF.md):

1. **Lead agent** picks the story and breaks it into tasks
2. **Sub-agents** each get specific files/tasks
3. **All agents** apply Ralph Wiggum validation
4. **Lead agent** verifies all acceptance criteria
5. **Lead agent** marks story complete

The story isn't complete until the lead verifies ALL criteria pass.

---

## Quick Reference

```
1. Pick story (highest priority, not passed)
2. Understand (read all criteria)
3. Plan (break into tasks)
4. Implement (with Ralph Wiggum validation)
5. Verify (each criterion individually)
6. Mark complete (only when ALL pass)
7. Update docs
8. Next story
```

---

*"Me fail English? That's unpossible!" - Ralph Wiggum*

*Translation: If acceptance criteria are unclear, that's a planning problem, not a coding problem. Fix the criteria first.*
