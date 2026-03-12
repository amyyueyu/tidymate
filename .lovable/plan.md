
## Root Cause (confirmed)

The challenge page is permanently stuck on "Loading challenges..." due to three compounding bugs in `Challenge.tsx`:

**Bug 1 — Auth timing / `fetchRoomData` never called:**
The `useEffect` dependency array is `[roomId, user, isGuest, guestRoom]`. On initial mount, `user` is `null` and `authLoading` is `true`, so the condition `!isGuest && roomId && user` is false — `fetchRoomData` is skipped. `loading` stays `true`. When `user` resolves, the effect re-runs. But there's a window where this fails silently if `authLoading` and `loading` are both true simultaneously.

**Bug 2 — `.single()` triggers a hard redirect:**
If the DB query returns no row (e.g. the row was *just* written and there's a brief propagation gap, or the `before_image_url` is a huge base64 blob that causes a timeout), `.single()` returns an error → `navigate("/")` fires → user is sent home. This explains why after uploading, the user ends up back at the start.

**Bug 3 — No `finally` / no safety net:**
If `fetchRoomData` throws at any point before `setLoading(false)`, the spinner stays forever. There's no timeout or recovery mechanism.

---

## Fix Plan

### Changes to `src/pages/Challenge.tsx` only

**1. Replace `.single()` with `.maybeSingle()`**
Prevents hard error when row isn't found yet. Instead, retry up to 3 times with a 600ms delay before giving up and showing a proper error message.

**2. Add retry logic for room not found**
```text
fetchRoomData:
  for attempt in [1, 2, 3]:
    query room with .maybeSingle()
    if found → fetch challenges → setLoading(false) → return
    if not found and more attempts remain → wait 600ms → retry
  after all retries fail → toast.error("Room not found") → navigate("/")
```

**3. Always call `setLoading(false)` via `finally`**
Wrap the entire `fetchRoomData` body in a try/finally so loading never gets permanently stuck.

**4. Add a safety timeout**
Add a `useEffect` with a 12-second timeout: if `loading` is still true after 12 seconds, force `setLoading(false)` and show an error. This is a last-resort safety net.

**5. Fix the auth-timing gap**
Start `loading` as `false` and only set it to `true` when `fetchRoomData` is actually invoked. This ensures `authLoading` being `true` doesn't compound the stuck-spinner problem — the loading spinner only shows when a real fetch is in progress.

---

## Summary of changes

| File | Change |
|---|---|
| `src/pages/Challenge.tsx` | `.single()` → `.maybeSingle()`, retry loop, try/finally, safety timeout, loading state init fix |

No backend changes needed — all fixes are frontend logic only.
