# Fix Log

Issues we've fixed before. **Search here first before debugging.**

---

## How to Use

**SEARCHING (before you debug):**
1. Ctrl+F and search for keywords from your error
2. Found it? Apply the fix
3. Not found? Use `TROUBLESHOOTING_WORKFLOW.md`, then come back and add your fix

**ADDING A FIX (after you solve something):**
```
### Issue: [What went wrong - keep it short]

**Error:** [Exact error message or symptom]

**Fix:** [What you did to fix it]

**Files:** [What files you changed]
```

That's it. Keep entries simple. Copy an existing entry as a template.

---

## Quick Search

Common error terms and where to find fixes:

| Keyword | Jump To |
|---------|---------|
| EADDRINUSE, port in use | [Port Conflicts](#port-conflicts) |
| 401, unauthorized, auth | [Authentication Issues](#authentication-issues) |
| RLS, policy, permission denied | [Supabase/RLS Issues](#supabaserls-issues) |
| hydration, mismatch | [Next.js/React Issues](#nextjsreact-issues) |
| undefined, null, cannot read | [Data/Props Issues](#dataprops-issues) |
| CORS, origin | [CORS Issues](#cors-issues) |
| ngrok, webhook, tunnel | [Ngrok/Webhook Issues](#ngrokwebhook-issues) |
| Twilio, call, SMS | [Twilio Issues](#twilio-issues) |
| WebSocket, connection | [WebSocket Issues](#websocket-issues) |

---

## Port Conflicts

### Issue: EADDRINUSE - Port 3000/3001/3002 Already in Use

**Symptoms:**
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Root Cause:** Previous server process didn't shut down cleanly.

**Fix:**
```bash
# Find what's using the port
netstat -ano | findstr :3000

# Kill it (replace PID with actual number)
taskkill /F /PID [PID]

# Or kill all node processes
taskkill /F /IM node.exe
```

**Prevention:** Use Ctrl+C to stop servers, not just closing the terminal.

---

### Issue: .next Folder Locked

**Symptoms:**
```
EPERM: operation not permitted
Error: EBUSY: resource busy or locked
```

**Root Cause:** Next.js dev server didn't release file handles.

**Fix:**
```bash
# Delete .next folder
rd /s /q web\.next

# Restart dev server
cd web && npm run dev
```

---

## Authentication Issues

### Issue: 401 Unauthorized on API Calls

**Symptoms:**
- API returns 401
- User appears logged in on frontend
- Works sometimes, fails other times

**Root Cause:** Session token expired or not being sent.

**Fix:**
1. Check if `createClient()` is being called correctly
2. Verify cookies are being passed in server components
3. Check if session refresh is working

**Files:** `lib/supabase/server.ts`, `lib/supabase/middleware.ts`

---

### Issue: User Logged Out After Refresh

**Symptoms:**
- Login works
- Page refresh logs user out
- No errors in console

**Root Cause:** Session not being persisted or middleware not configured.

**Fix:**
1. Check `middleware.ts` is updating session
2. Verify Supabase auth callback route exists
3. Check cookie settings in Supabase config

**Files:** `src/middleware.ts`, `src/app/api/auth/callback/route.ts`

---

## Supabase/RLS Issues

### Issue: Empty Array Returned from Query

**Symptoms:**
- Query executes without error
- Returns empty array `[]`
- Data exists in Supabase dashboard

**Root Cause:** Row Level Security (RLS) policy blocking access.

**Fix:**
1. Check RLS policies in Supabase dashboard
2. Verify `user_id` filter is correct
3. Ensure user has the right role

**Debug Query:**
```sql
-- Check if RLS is the issue (run in Supabase SQL editor)
SELECT * FROM table_name WHERE user_id = 'user-uuid';
```

---

### Issue: "new row violates row-level security policy"

**Symptoms:**
```
PostgresError: new row violates row-level security policy for table "x"
```

**Root Cause:** Insert/update doesn't match RLS policy requirements.

**Fix:**
1. Ensure `user_id` is being set on insert
2. Check if INSERT policy requires specific conditions
3. For admin operations, use service role key

**Files:** Check the action file doing the insert

---

## Next.js/React Issues

### Issue: Hydration Mismatch

**Symptoms:**
```
Hydration failed because the initial UI does not match what was rendered on the server
```

**Root Cause:** Server and client render different content. Common causes:
- Using `Date.now()` or `Math.random()` during render
- Accessing `window` or `localStorage` during SSR
- Conditional rendering based on client-only state

**Fix:**
```tsx
// Use useEffect for client-only code
const [mounted, setMounted] = useState(false)
useEffect(() => setMounted(true), [])
if (!mounted) return null // or skeleton
```

---

### Issue: "Cannot read properties of undefined"

**Symptoms:**
```
TypeError: Cannot read properties of undefined (reading 'x')
```

**Root Cause:** Trying to access property on null/undefined value.

**Fix:**
```tsx
// Add optional chaining
const value = data?.items?.[0]?.name

// Or null check
if (!data || !data.items) return <Loading />
```

---

## Data/Props Issues

### Issue: Component Shows Stale Data

**Symptoms:**
- Data updates in database
- UI doesn't reflect changes
- Refresh fixes it

**Root Cause:** React state not updating or cache not invalidated.

**Fix:**
1. Check if using `useState` with initial data - may need `useEffect` to update
2. Add `router.refresh()` after mutations
3. Check if using React Query - may need to invalidate

---

### Issue: Props Undefined in Component

**Symptoms:**
- Component receives `undefined` props
- Parent component has the data
- TypeScript doesn't catch it

**Root Cause:** Prop name mismatch or async data not loaded.

**Fix:**
1. Check prop names match exactly (case-sensitive)
2. Add loading state for async data
3. Verify parent is actually passing the prop

---

## CORS Issues

### Issue: CORS Error in Browser

**Symptoms:**
```
Access to fetch at 'x' from origin 'y' has been blocked by CORS policy
```

**Root Cause:** Server not sending correct CORS headers.

**Fix (Express):**
```js
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});
```

**Fix (Next.js API Route):**
```ts
return NextResponse.json(data, {
  headers: {
    'Access-Control-Allow-Origin': '*',
  }
})
```

---

## Ngrok/Webhook Issues

### Issue: Ngrok Tunnel Not Working

**Symptoms:**
- Webhooks not received
- Twilio shows 502/503 errors
- ngrok shows "Tunnel not found"

**Root Cause:** Ngrok session expired or wrong port.

**Fix:**
```bash
# Kill existing ngrok
taskkill /F /IM ngrok.exe

# Start fresh tunnel
ngrok http 3001
```

**Then:** Update Twilio webhook URLs with new ngrok URL.

---

### Issue: Webhook Returns 404

**Symptoms:**
- Ngrok is running
- Twilio shows 404 response
- Endpoint works in browser

**Root Cause:** Route path mismatch or POST vs GET.

**Fix:**
1. Verify exact route path matches Twilio config
2. Check if route handles POST (webhooks are POST)
3. Check for trailing slash differences

---

## Twilio Issues

### Issue: Calls Not Connecting

**Symptoms:**
- Outbound calls fail immediately
- No error in console
- Twilio dashboard shows attempts

**Root Cause:** TwiML App not configured or wrong webhook URL.

**Fix:**
1. Check `TWILIO_TWIML_APP_SID` is set
2. Verify TwiML App has correct Voice URL
3. Ensure ngrok is running (for local dev)

---

### Issue: No Audio on Calls

**Symptoms:**
- Call connects
- No audio heard
- WebSocket connection shows data

**Root Cause:** Media stream not connecting or codec issue.

**Fix:**
1. Check WebSocket is receiving audio data
2. Verify Deepgram is processing
3. Check browser audio permissions

---

## WebSocket Issues

### Issue: WebSocket Connection Drops

**Symptoms:**
- Real-time features stop working
- Browser shows "WebSocket is closed"
- Works initially then fails

**Root Cause:** Server restarted, timeout, or network issue.

**Fix:**
1. Add reconnection logic to client
2. Check server logs for errors
3. Increase ping/pong timeout if needed

---

## Import Issues

### Issue: Import fails with "Could not find the 'title' column"

**Error:** `PGRST204: Could not find the 'title' column of 'contacts' in the schema cache`

**Fix:** Added `custom_fields` JSONB column. Run: `ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}';`

**Files:** `contacts-import.html`, `00016_custom_fields.sql`

---

### Issue: Import shows errors but "Error loading recent imports" in console

**Error:** 404 on Supabase query for import_history table

**Fix:** Create the `import_history` table - run migration `00015_import_history.sql`

**Files:** `00015_import_history.sql`

---

## Add New Fixes Here

When you fix something new, add it to the appropriate section above.

Use this format:
```
### Issue: [What went wrong]

**Error:** [The error message]

**Fix:** [What you did]

**Files:** [What you changed]
```
