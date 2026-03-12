
## Root Cause

The network logs confirm the exact problem: the `rooms` table still has old rows where `before_image_url` contains a **full multi-megabyte base64 JPEG string**. The previous fix (uploading to storage) only applies to *new* rooms — existing ones still have the base64 blob stored directly in the DB column.

When `Challenge.tsx` calls `select("*")` and `Index.tsx` also calls `select("*")`, the response payload includes these massive base64 strings. Downloading 3–5MB of base64 just to show the room name and list of tasks is what causes the "Loading challenges..." to hang indefinitely.

## Two-part fix

**1. Selective column fetching — never load image bytes until needed**

- `Challenge.tsx` → change initial room fetch to `select("id, name, intent, total_challenges, completed_challenges, status, after_image_url")` — deliberately exclude `before_image_url`. The page can load instantly since no image data is pulled.
- `Index.tsx` → change rooms fetch to `select("id, name, status, total_challenges, completed_challenges, created_at")` — the home screen only shows the room name and progress, it never needs images.
- Add a separate lazy fetch for `before_image_url` in `Challenge.tsx` — only triggered when the user clicks "See Your Vision". This keeps the vision comparison working without blocking initial load.

**2. Room interface update**

- Update the `Room` interface in `Challenge.tsx` to make `before_image_url` optional (`string | null`) so TypeScript doesn't complain when it's not included in the initial fetch.
- Pass `beforeImageUrl` as a separate piece of state to `VisionComparison`.

```text
Current (broken):
  fetchRoomData → select("*") → downloads 5MB base64 → hangs

Fixed:
  fetchRoomData → select("id, name, ...") → loads instantly (small payload)
  User clicks "See Your Vision" → lazy fetch before_image_url → shows comparison
```

## Files to change

- `src/pages/Challenge.tsx` — selective column select + lazy image fetch
- `src/pages/Index.tsx` — selective column select (no images needed on home)
