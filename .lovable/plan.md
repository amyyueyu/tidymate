
## Logo Update Plan

The user has provided 3 logo assets:
- `App_logo_2.png` — rounded square app icon (leaf + sparkles), for use as the favicon
- `Favicon_logo_3.png` — just the leaf+sparkles icon without background, for use as the in-app icon (replacing `<Leaf>` in headers/loading states)
- `landing_page_logo.png` — full horizontal lockup (leaf icon + "TidyMate" wordmark), for the auth landing page

### Where logos currently appear (using `<Leaf>` icon):

| Location | File | Usage |
|---|---|---|
| Browser favicon | `index.html` | `public/favicon.ico` |
| Auth page hero | `Auth.tsx` | 64px icon + "TidyMate" text |
| Home header | `Index.tsx` | 24px icon + "TidyMate" text |
| Home loading | `Index.tsx` | 48px bouncing icon |
| Challenge loading | `Challenge.tsx` | 48px bouncing icon |
| Capture header | `Capture.tsx` | 20px icon |
| Stats header | `Stats.tsx` | 20px icon |
| Demo page | `Demo.tsx` | 32px icon + header icons |

### Plan

**1. Copy assets to project**
- `user-uploads://App_logo_2.png` → `public/favicon.png` (browser tab favicon)
- `user-uploads://Favicon_logo_3.png` → `src/assets/logo-icon.png` (in-app icon, replaces `<Leaf>`)
- `user-uploads://landing_page_logo.png` → `src/assets/logo-full.png` (auth page hero)

**2. Update `index.html`**
- Replace `<link rel="icon" href="/favicon.ico">` (currently missing — add it) with the new `App_logo_2.png` favicon

**3. Update `Auth.tsx`**
- Replace the `<Leaf>` icon + "TidyMate" text block in the hero with `<img src={logoFull}>` using the full lockup (`landing_page_logo.png`)
- The full logo already includes the wordmark so the `<h1>TidyMate</h1>` text below it needs to be removed (or kept as subtitle)

**4. Update `Index.tsx`**
- Header: Replace `<Leaf>` + "TidyMate" text with `<img src={logoFull} className="h-7">` (full lockup)
- Loading spinner: Replace `<Leaf>` with `<img src={logoIcon} className="w-12 h-12">` (icon only)

**5. Update `Challenge.tsx`, `Capture.tsx`, `Stats.tsx`, `Demo.tsx`**
- Replace all `<Leaf>` instances with `<img src={logoIcon}>` at appropriate sizes
- Loading states: use the icon-only version

### Visual result

```text
Favicon tab:    [App_logo_2.png — rounded square icon]
Auth hero:      [landing_page_logo.png — leaf + TidyMate wordmark, centered]
App headers:    [landing_page_logo.png — compact h-7 horizontal lockup]
Loading states: [logo-icon.png — leaf icon only, animated bounce]
Nav icons:      [logo-icon.png — leaf icon only, ~20px]
```
