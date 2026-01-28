# Quick Fix Playbook

Fast, practical guide for diagnosing and fixing UI glitches. For complex issues, see `TROUBLESHOOTING_WORKFLOW.md`.

---

## The 5-Minute Fix Process

```
┌─────────────────────────────────────────────────────────────┐
│  1. UNDERSTAND → What's broken? Get screenshot/URL          │
│        ↓                                                    │
│  2. SEARCH → Find the code (Grep for function/text)         │
│        ↓                                                    │
│  3. READ → Understand the code flow                         │
│        ↓                                                    │
│  4. FIX → Minimal change only                               │
│        ↓                                                    │
│  5. VERIFY → Test with Playwright or browser                │
└─────────────────────────────────────────────────────────────┘
```

---

## Tool Reference Card

### Code Tools (Claude Code)

| Tool | Use For | Example |
|------|---------|---------|
| **Grep** | Search for text/functions | `Search for "openEditModal"` |
| **Glob** | Find files by pattern | `Find all *.html in public/` |
| **Read** | Examine code | `Read settings.html` |
| **Edit** | Make changes | `Change line X to Y` |

### MCP Diagnostic Tools

| Tool | Shows | Best For |
|------|-------|----------|
| **Playwright MCP** | Blue box around browser | Reproducing UI issues, verifying fixes visually, click automation |
| **Chrome DevTools MCP** | No blue box - uses existing browser | Checking JS errors, seeing console.log output, live debugging |
| **Supabase MCP** | Direct DB access | Data issues, checking what's in the database |

### When to Use Which MCP Tool

```
What are you debugging?
│
├── UI not rendering/showing?
│   └── Use Playwright MCP (screenshot, click tests)
│
├── JS error / function not working?
│   └── Use Chrome DevTools MCP (console logs, errors)
│
├── Data missing or wrong?
│   └── Use Supabase MCP (query tables directly)
│
└── Need to see real-time behavior?
    └── Use Chrome DevTools MCP (live console)
```

**Key Difference:**
- **Playwright** = Controls browser (shows blue box), good for automation
- **Chrome DevTools** = Observes browser (no blue box), good for debugging

---

## Common Issue Patterns

### Modal not showing
**Symptoms:** Click button, nothing happens, no console error
**Cause:** CSS conflict (visibility/display fighting)
**Search:** Grep for modal ID and `visibility`, `display`
**Fix:** Check CSS specificity, override with `!important` if needed

### Button not working
**Symptoms:** Click does nothing, no console error
**Cause:** Event handler not attached or wrong selector
**Search:** Grep for onclick handler or addEventListener
**Fix:** Check selector matches actual element ID

### Data not loading
**Symptoms:** Blank content, spinner forever
**Cause:** API/fetch issue, auth problem, or RLS
**Search:** Grep for fetch call or Supabase query
**Fix:** Check console for errors, verify auth token

### Styles broken
**Symptoms:** Element looks wrong, CSS not applied
**Cause:** CSS specificity issue or class name mismatch
**Search:** Grep for the class name in CSS and HTML
**Fix:** Increase specificity or fix class name

### Form not submitting
**Symptoms:** Click submit, nothing happens
**Cause:** Validation failing silently or missing handler
**Search:** Grep for form ID and submit handler
**Fix:** Add console.log in handler, check validation

---

## Debug Techniques

### Add Console Logging

```javascript
// At start of function
console.log('[FunctionName] called with:', arguments);

// Before problematic line
console.log('[FunctionName] about to do X, value is:', value);

// In event handlers
document.getElementById('myBtn').onclick = function() {
    console.log('[myBtn] clicked');
    // rest of handler
};
```

### Check Element State

```javascript
// In browser console or via DevTools MCP
const el = document.getElementById('myModal');
console.log('Display:', getComputedStyle(el).display);
console.log('Visibility:', getComputedStyle(el).visibility);
console.log('Opacity:', getComputedStyle(el).opacity);
console.log('Z-index:', getComputedStyle(el).zIndex);
```

### Quick CSS Debug

```css
/* Add temporarily to see if element exists */
#myElement {
    border: 3px solid red !important;
    background: yellow !important;
}
```

---

## Real Example: KB Edit Modal Fix

**Issue:** Knowledge Base edit pencil button wasn't opening the modal

**Workflow:**
1. **Search** → Grep for "knowledge base" and "edit" → Found in settings.html and settings.js
2. **Read** → Examined modal HTML and openEditKBModal function
3. **Identify** → CSS conflict: global `.modal { visibility: hidden }` fighting with inline styles
4. **Fix** → Added specific CSS rule: `#kbEditModal.active { visibility: visible !important; }`
5. **Debug** → Added console.log to openEditKBModal for future diagnosis
6. **Verify** → Tested with Playwright - modal now opens

**Files Changed:** `settings.html` (CSS), `settings.js` (debug logging)

**Time:** ~10 minutes

---

## Quick Fixes by File Type

### HTML Pages (twilio-ai-coach/public/)

```
settings.html → Settings page, knowledge bases, scripts
contacts.html → Contact management
call.html → Call UI and controls
dashboard.html → Main dashboard
```

**Pattern:** All JS is inline in `<script>` tags at bottom of file.

### CSS Issues

1. Check specificity (ID > class > element)
2. Check for `!important` overrides
3. Check computed styles in DevTools
4. Look for conflicting rules in global styles

### JavaScript Issues

1. Check browser console for errors first
2. Add console.log at function entry
3. Verify element selectors match HTML IDs
4. Check for typos in function names

---

## Verification Checklist

After fixing:

- [ ] Issue no longer reproduces
- [ ] No new console errors
- [ ] Related features still work
- [ ] Tested in Playwright or real browser

---

## After Fixing

1. **Remove debug logging** (or leave with `[Debug]` prefix if useful)
2. **Add to FIX_LOG.md** so we don't solve it again:

```markdown
### Issue: [Short description]

**Error:** [What user saw or console error]

**Fix:** [What you changed]

**Files:** [files modified]
```

---

## See Also

- `TROUBLESHOOTING_WORKFLOW.md` - Full debugging process for complex issues
- `FIX_LOG.md` - Search here first before debugging
- `CODING_STANDARDS.md` - How to write the fix properly
