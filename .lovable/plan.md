# Fix: Vision image generation fails with "Vision generation didn't complete"

## What's happening

Looking at the screenshot + edge function logs for `generate-vision`:

```
16:21:29  Generating vision for user ...
16:21:36  Rate limited. Retrying in 3000ms (attempt 1)...
16:21:45  Rate limited. Retrying in 7000ms (attempt 2)...
```

The Lovable AI gateway is returning **429 (rate limited)** for `google/gemini-3.1-flash-image-preview`. The current edge function only retries twice (3s + 7s backoff). If the third call also returns 429, the function bubbles up an error and the UI shows the "Vision generation didn't complete — Try again" card the user screenshotted.

Compounding issues:
1. `analyze-room` and `generate-vision` fire back-to-back against the same AI gateway, increasing 429 odds.
2. Retry budget is too small (max 2 retries, ~10s of waiting).
3. Client timeout of 45s sometimes triggers before the function finishes its retries on slow paths.
4. The "Try again" button in the UI retries instantly — same 429 window, same failure.
5. Even when generation eventually succeeds, the client may have already given up.

## Fix plan

### 1. `supabase/functions/generate-vision/index.ts`
- Increase retry budget on 429 from 2 → 4 attempts with stronger exponential backoff + jitter (e.g. 3s, 6s, 12s, 20s + random 0–1s). Total worst-case wait ~41s of backoff.
- Also retry on **5xx** transient errors (502/503/504) with the same backoff curve, up to 2 attempts. The gateway occasionally bubbles upstream hiccups as 5xx.
- On final failure, return a clear `retryable: true` flag in the JSON body alongside the `error` message so the client knows it's worth retrying.

### 2. Spread the load: small delay before vision call
- In `src/pages/Capture.tsx`, wait ~800ms after `analyze-room` succeeds before calling `generate-vision`. This avoids two simultaneous bursts to the same image model and noticeably reduces 429 rates.

### 3. Increase client timeout
- Bump `VISION_TIMEOUT_MS` from 45000 → 75000 in `src/pages/Capture.tsx`. With the new server-side retries, the worst-case successful run is ~50–60s; 75s gives margin. Keep the 25s "this is taking longer than usual" hint and skip button — that already gives the user an out.

### 4. Smarter "Try again" UX
- In the retry card (`src/pages/Capture.tsx`), add a 3-second cooldown after a failed attempt before "Try again" becomes clickable, and auto-retry once in the background after 5s if the failure was a 429/busy. Show a small countdown in the button label ("Try again in 3s…").
- When auto-retry succeeds, the existing success toast + image swap fires normally.
- Cap auto-retries at 1 per session so we don't loop forever; after that the manual button stays available.

### 5. Better error surfacing
- If the final failure is a 429, the toast becomes: *"Vision is busy — we'll try once more for you in a moment."* Then the auto-retry kicks in.
- If it's a non-retryable error (4xx other than 429, malformed response), show: *"Couldn't generate vision this time — your challenges are ready!"* and don't auto-retry.

## What does NOT change
- `analyze-room` flow, prompt, or model.
- Vision prompt content or model selection (`google/gemini-3.1-flash-image-preview`).
- Storage bucket logic — generated images keep uploading to `room-images` and returning a CDN URL.
- DB schema, RLS, rate-limit RPC, PostHog events, points/streaks, premium gating.
- Guest mode flow.

## Files touched
- `supabase/functions/generate-vision/index.ts` — beefier retry/backoff, retryable flag in error responses.
- `src/pages/Capture.tsx` — 800ms pre-vision delay, 75s timeout, smarter "Try again" card with cooldown + one auto-retry on 429.
