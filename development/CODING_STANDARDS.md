# Development Guidelines

## Overview

This document defines the structure, security practices, and coding standards for building scalable, maintainable applications. Follow these guidelines when building new features, refactoring existing code, or reviewing pull requests.

---

## File Structure

```
src/
├── app/                              # Next.js pages only
│   ├── (auth)/
│   ├── (dashboard)/
│   └── api/
│
├── features/                         # All business logic
│   └── [feature-name]/
│       ├── components/
│       ├── hooks/
│       ├── actions/
│       ├── queries/
│       ├── types.ts
│       └── index.ts
│
├── components/                       # Shared UI only (used by 3+ features)
│   ├── ui/
│   ├── forms/
│   └── layouts/
│
├── lib/                              # Shared utilities
│   ├── supabase/
│   └── utils/
│
└── types/                            # Global types
```

---

## File Purposes and Limits

| File Type | Purpose | Max Lines |
|-----------|---------|-----------|
| Page | Route entry point, imports and renders | 50 |
| Component | UI rendering only | 150 |
| Hook | State management and logic | 100 |
| Query | Database reads | 80 |
| Action | Database writes | 80 |
| types.ts | Type definitions | 150 |
| index.ts | Public exports | 30 |

**Rule:** If a file exceeds its limit, split it.

---

## What Goes Where

### Pages (50 lines max)

Only does three things:
1. Fetch initial data
2. Handle metadata
3. Render main component

```tsx
// app/(dashboard)/example/page.tsx

import { getData } from '@/features/example/queries'
import { ExampleDashboard } from '@/features/example'

export default async function ExamplePage() {
  const data = await getData()
  return <ExampleDashboard initialData={data} />
}
```

---

### Queries (reading data)

Only fetches data. Never changes anything.

```tsx
// features/example/queries/getData.ts

import { createClient } from '@/lib/supabase/server'

export async function getData() {
  const supabase = await createClient()
  
  // SECURITY: Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // SECURITY: Filter by user
  const { data, error } = await supabase
    .from('items')
    .select('id, title, status, created_at')  // Only needed fields
    .eq('user_id', user.id)
    .limit(50)

  if (error) throw error
  return data
}
```

---

### Actions (writing data)

Only changes data. Always validates first.

```tsx
// features/example/actions/createItem.ts

'use server'

import { createClient } from '@/lib/supabase/server'
import type { CreateItemInput } from '../types'

export async function createItem(input: CreateItemInput) {
  const supabase = await createClient()

  // SECURITY: Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // VALIDATION: Required fields
  if (!input.title || input.title.length < 3) {
    return { error: 'Title must be at least 3 characters' }
  }

  // SECURITY: Attach to current user
  const { data, error } = await supabase
    .from('items')
    .insert({ ...input, user_id: user.id })
    .select()
    .single()

  if (error) return { error: 'Failed to create' }
  return { success: true, data }
}
```

---

### Hooks (state and logic)

Manages state, coordinates queries and actions.

```tsx
// features/example/hooks/useItems.ts

'use client'

import { useState, useCallback } from 'react'
import { getData } from '../queries/getData'
import { deleteItem } from '../actions/deleteItem'
import type { Item } from '../types'

export function useItems(initialItems: Item[]) {
  const [items, setItems] = useState(initialItems)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const fresh = await getData()
      setItems(fresh)
    } catch (e) {
      setError('Failed to load items')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    const result = await deleteItem(id)
    if (result.success) await refresh()
    return result
  }, [refresh])

  return { items, isLoading, error, refresh, handleDelete }
}
```

---

### Components (UI only)

Only renders. Gets data and functions from hooks.

```tsx
// features/example/components/ItemList.tsx

'use client'

import { useItems } from '../hooks/useItems'
import { ItemCard } from './ItemCard'
import { Loading } from '@/components/ui/loading'
import type { Item } from '../types'

interface Props {
  initialItems: Item[]
}

export function ItemList({ initialItems }: Props) {
  const { items, isLoading, handleDelete } = useItems(initialItems)

  if (isLoading) return <Loading />

  return (
    <div className="space-y-4">
      {items.map(item => (
        <ItemCard 
          key={item.id} 
          item={item} 
          onDelete={() => handleDelete(item.id)} 
        />
      ))}
    </div>
  )
}
```

---

### Types

Define all data shapes for the feature.

```tsx
// features/example/types.ts

export interface Item {
  id: string
  title: string
  description: string
  status: 'active' | 'archived'
  userId: string
  createdAt: Date
  updatedAt: Date
}

export interface CreateItemInput {
  title: string
  description?: string
}

export interface UpdateItemInput {
  title?: string
  description?: string
  status?: 'active' | 'archived'
}
```

---

### Index (public exports)

Only export what other features need.

```tsx
// features/example/index.ts

// Components
export { ExampleDashboard } from './components/ExampleDashboard'
export { ItemList } from './components/ItemList'

// Hooks
export { useItems } from './hooks/useItems'

// Types
export type { Item, CreateItemInput } from './types'
```

---

## Security Rules

### Every query must:

1. Call `getUser()` first
2. Return error if no user
3. Filter data by `user.id`
4. Only select needed fields (never `select('*')`)
5. Use `.limit()` for lists

### Every action must:

1. Call `getUser()` first
2. Return error if no user
3. Validate all inputs before processing
4. Verify ownership before update/delete
5. Check role for admin features

### Security template for actions:

```tsx
export async function secureAction(id: string, input: UpdateInput) {
  const supabase = await createClient()

  // 1. Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // 2. Input validation
  if (!id) return { error: 'ID is required' }
  if (input.title && input.title.length < 3) {
    return { error: 'Title must be at least 3 characters' }
  }

  // 3. Ownership check (for update/delete)
  const { data: existing } = await supabase
    .from('items')
    .select('user_id')
    .eq('id', id)
    .single()

  if (!existing) return { error: 'Item not found' }
  if (existing.user_id !== user.id) return { error: 'Not authorized' }

  // 4. Now safe to proceed
  const { data, error } = await supabase
    .from('items')
    .update(input)
    .eq('id', id)
    .select()
    .single()

  if (error) return { error: 'Failed to update' }
  return { success: true, data }
}
```

### Security template for queries:

```tsx
export async function secureQuery(filters?: QueryFilters) {
  const supabase = await createClient()

  // 1. Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // 2. Build query with user filter
  let query = supabase
    .from('items')
    .select('id, title, status, created_at')  // Only needed fields
    .eq('user_id', user.id)  // Always filter by user
    .limit(50)  // Always limit results

  // 3. Apply additional filters
  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  const { data, error } = await query

  if (error) throw error
  return data
}
```

---

## Validation Pattern (Ralph Wiggum Loop)

**"I validate everything, even my own code!"**

Two meanings:
1. **Input validation** - Never trust incoming data
2. **Self-testing** - Validate your own work as you build (don't wait for external testing)

Validate at every step. Never trust incoming data.

```tsx
export async function processData(input: unknown) {
  // Step 1: Auth
  const user = await getUser()
  if (!user) return { error: 'Not authenticated' }

  // Step 2: Validate shape exists
  if (!input || typeof input !== 'object') {
    return { error: 'Invalid input' }
  }

  // Step 3: Validate required fields
  const { title, description } = input as Record<string, unknown>
  if (!title || typeof title !== 'string') {
    return { error: 'Title is required' }
  }

  // Step 4: Validate values
  if (title.length < 3) {
    return { error: 'Title must be at least 3 characters' }
  }
  if (title.length > 200) {
    return { error: 'Title must be less than 200 characters' }
  }

  // Step 5: Business rules
  const duplicate = await checkForDuplicate(title, user.id)
  if (duplicate) {
    return { error: 'An item with this title already exists' }
  }

  // Step 6: Do the thing
  const result = await saveToDatabase({
    title,
    description: description || null,
    user_id: user.id
  })

  // Step 7: Validate output
  if (!result) {
    return { error: 'Save failed' }
  }

  return { success: true, data: result }
}
```

---

## Refactoring Rules

### When to refactor:

- File exceeds line limits
- Same logic exists in multiple places
- Hard to find things
- Adding features takes too long

### How to refactor:

1. Pull database reads → `/queries`
2. Pull database writes → `/actions`
3. Pull useState/useEffect logic → `/hooks`
4. Break large UI into smaller components
5. Define types in `types.ts`
6. Export public API in `index.ts`

### Component splitting:

When components folder exceeds 10 files, group by page section:

```
components/
├── MainContainer.tsx
│
├── header/
│   ├── Header.tsx
│   ├── Navigation.tsx
│   ├── UserMenu.tsx
│   └── index.ts
│
├── sidebar/
│   ├── Sidebar.tsx
│   ├── SidebarItem.tsx
│   ├── SidebarGroup.tsx
│   └── index.ts
│
├── content/
│   ├── ContentArea.tsx
│   ├── ContentCard.tsx
│   ├── ContentList.tsx
│   └── index.ts
│
└── index.ts
```

Each subfolder gets an index.ts:

```tsx
// components/header/index.ts
export { Header } from './Header'
export { Navigation } from './Navigation'
export { UserMenu } from './UserMenu'
```

---

## Debugging Guide

| Problem | Check | File Location |
|---------|-------|---------------|
| UI looks wrong | Component | `/components` |
| Button does nothing | Hook (is function wired up?) | `/hooks` |
| Data doesn't save | Action | `/actions` |
| Data doesn't load | Query | `/queries` |
| TypeScript errors | Types | `types.ts` |
| Wrong data shape | Types + Query formatting | `types.ts` + `/queries` |
| Auth errors | Query or Action auth check | `/queries` or `/actions` |
| Permission denied | Ownership check in action | `/actions` |

---

## Scale Rules

1. Always use `.limit()` on queries
2. Filter in database, not client-side
3. Never fetch inside loops
4. Paginate lists over 20 items
5. Only select fields you need

### Bad (doesn't scale):

```tsx
// Fetching all, filtering client-side
const allItems = await supabase.from('items').select('*')
const userItems = allItems.filter(item => item.user_id === user.id)

// Fetching inside a loop
for (const id of ids) {
  const item = await supabase.from('items').select('*').eq('id', id)
}

// No limit
const items = await supabase.from('items').select('*')
```

### Good (scales):

```tsx
// Filter in database
const { data } = await supabase
  .from('items')
  .select('id, title, status')
  .eq('user_id', user.id)
  .limit(50)

// Batch fetch
const { data } = await supabase
  .from('items')
  .select('id, title, status')
  .in('id', ids)

// Paginated
const { data } = await supabase
  .from('items')
  .select('id, title, status')
  .eq('user_id', user.id)
  .range(0, 19)  // First 20 items
```

---

## Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `UserCard.tsx` |
| Hooks | camelCase with use | `useUsers.ts` |
| Queries | camelCase with get | `getUsers.ts` |
| Actions | camelCase verb | `createUser.ts`, `deleteUser.ts` |
| Types | PascalCase | `User`, `CreateUserInput` |
| Interfaces | PascalCase | `UserProfile` |
| Files | Match export name | `UserCard.tsx` exports `UserCard` |
| Folders | kebab-case | `user-profile/` |

---

## Before Submitting Code

### Security checklist:

- [ ] Auth check (`getUser()`) in every query and action
- [ ] Ownership check before update/delete
- [ ] Only selecting needed fields (no `select('*')`)
- [ ] Inputs validated before processing
- [ ] No sensitive data exposed in responses
- [ ] Role check for admin features

### Structure checklist:

- [ ] Files under line limits
- [ ] Code in correct folder (query/action/hook/component)
- [ ] Types defined in `types.ts`
- [ ] Public exports in `index.ts`
- [ ] No duplicate logic across files

### Scale checklist:

- [ ] Queries have `.limit()`
- [ ] Filtering done in database, not client
- [ ] No database calls inside loops
- [ ] Large lists paginated

---

## Error Recovery

### When an Agent Breaks Something

1. **Don't panic** - Git is your friend
2. **Assess the damage** - What files were changed?
3. **Decide on recovery method**

### Recovery Options

| Situation | Recovery Method |
|-----------|-----------------|
| Single file broken | `git checkout HEAD -- path/to/file` |
| Multiple files broken | `git checkout HEAD -- .` (reverts all) |
| Need to see what changed | `git diff` |
| Committed but shouldn't have | `git reset --soft HEAD~1` |
| Feature branch completely wrong | `git checkout main && git branch -D broken-branch` |

### Before Making Changes

Always create a restore point:

```bash
# Quick checkpoint
git add -A && git commit -m "checkpoint: before [feature name]"

# Or create a branch
git checkout -b backup/before-feature
git checkout -  # Go back to original branch
```

### Recovery Commands Quick Reference

```bash
# See what changed
git status
git diff

# Undo unstaged changes to one file
git checkout -- path/to/file.tsx

# Undo all unstaged changes
git checkout -- .

# Unstage files (keep changes)
git reset HEAD path/to/file.tsx

# Undo last commit (keep changes staged)
git reset --soft HEAD~1

# Undo last commit (discard changes) - DESTRUCTIVE
git reset --hard HEAD~1

# Recover deleted file
git checkout HEAD -- path/to/deleted/file.tsx
```

### Multi-Agent Recovery

When multiple agents are working in parallel:

1. Each agent should work on separate files
2. If conflict detected:
   - Stop all agents
   - Identify which changes to keep
   - Manually merge or discard
   - Resume agents one at a time

### Database Recovery

If agent corrupts data:

```sql
-- Most tables have created_at, find recent bad data
SELECT * FROM table_name
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- Delete bad records
DELETE FROM table_name WHERE id = 'bad-id';

-- Or if using soft delete
UPDATE table_name SET deleted_at = NOW() WHERE id = 'bad-id';
```

### Prevention

1. **Small commits** - Commit working code frequently
2. **Feature branches** - Never work directly on main
3. **File boundaries** - One agent = one set of files
4. **Test before commit** - Ralph Wiggum validation

---

## Quick Reference

### File purposes:

```
Page       → Entry point only (fetch + render)
Query      → Read from database
Action     → Write to database
Hook       → Manage state and logic
Component  → Render UI
Types      → Define data shapes
Index      → Export public API
```

### Security at a glance:

```
Query:  getUser() → filter by user.id → select specific fields → limit results
Action: getUser() → validate input → verify ownership → perform action
```

### When something breaks:

```
UI wrong       → Component
No response    → Hook
Won't save     → Action
Won't load     → Query
Type errors    → types.ts
```