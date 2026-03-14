
## Plan: Refine ShareCard Visual Design + Copy Fields

### What's changing

**3 files need edits:**
1. `src/components/ShareCard.tsx` — canvas redesign + new props
2. `supabase/functions/analyze-progress/index.ts` — add 2 new response fields + updated system prompt + fallback
3. `src/pages/Challenge.tsx` — `praiseData` type + `handlePraiseReceived` signature + both `<ShareCard>` render calls
4. `src/components/ProgressPhotoUpload.tsx` — `onPraiseReceived` callback signature to pass the 2 new fields

---

### ShareCard.tsx changes (canvas redesign)

**New props added:**
```
shareReactionPill: string
shareSub: string
```

**New state:** `fontsLoaded: boolean`

**Font preloading useEffect** (runs once on mount):  
Loads Nunito 900 + 700 from Google Fonts via `FontFace` API → sets `fontsLoaded = true`

**Canvas draw useEffect** now depends on `[beforeImageUrl, wipImageUrl, shareTagline, shareReactionPill, shareSub, fontsLoaded]` and only runs when `fontsLoaded` is true.

**Visual changes inside `draw()`:**

1. **Divider line** between photos: white, 3px → `ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 3`

2. **BEFORE label**: `#1A1A1A` background, 13px Nunito 700, 6px radius, positioned 12px from bottom/left of photo half

3. **AFTER label**: `#0D9C6B` background, white text, same style

4. **Wavy edge** after drawing photos, before green section:
   - Green section starts at `SPLIT_Y + 20` (was `SPLIT_Y`)
   - Draw white wave path from `(0, SPLIT_Y)` using `quadraticCurveTo` across 6 segments with 16px amplitude, filling down to `SPLIT_Y + 36`
   - This creates a soft boundary between photo area and brand area

5. **Remove `drawLeaf()` function** — replaced by SVG logo

6. **Logo**: serialize `logoSVG` string → `Blob` → `createObjectURL` → `loadImageCors` → `drawImage` at `x=CANVAS_W/2 - 110, y=brandStart + 28, w=220, h=44`

7. **Green section layout** (top-to-bottom):
   ```
   [logo row]         y = brandStart + 28..72
   [reaction pill]    y = brandStart + 96
   [main tagline]     y = brandStart + 160 (with word wrap)
   [sub line]         y = taglineEnd + 28
   [bottom row]       y = CANVAS_H - 80
     "try it free" label (left-ish)
     "tidymate.app" wordmark (centered)
     QR code (right, keep existing logic centered but shift right)
   ```

8. **Reaction pill**:
   - `rgba(255,255,255,0.18)` rounded rect, 28px tall, auto-width
   - Small filled circle `#B5F5D8`, 8px diameter, 16px from left edge of pill
   - Text: `shareReactionPill.toUpperCase()`, white, `700 13px Nunito`, letter-spacing `0.06em`
   - Pill drawn centered horizontally

9. **Main tagline** (`shareTagline`):
   - Font: `900 38px Nunito`
   - Word-wrap to `CANVAS_W - 120`, max 2 lines
   - Highlight words 3–5 (or first quoted phrase if found): draw `rgba(255,255,255,0.2)` rounded rect behind those specific words

10. **Sub line** (`shareSub`):
    - `600 24px Nunito Sans`, `rgba(255,255,255,0.72)`

11. **Bottom row** (y ≈ `CANVAS_H - 80`):
    - "TRY IT FREE" in `rgba(255,255,255,0.55)`, 12px, uppercase, tracked
    - "tidymate.app" in white Nunito 800 28px, centered
    - QR code: keep existing size (130px), shift to right side (`x = CANVAS_W - 170`)

---

### analyze-progress/index.ts changes

**Fallback** gains 2 new fields:
```ts
shareReactionPill: "ADHD win unlocked"
shareSub: "Something shifted today. Might clean again next year."
```

**System prompt** updated to include 2 new JSON fields in the spec:
- `shareReactionPill`: 2–5 punchy words (ADHD-relatable context)
- `shareSub`: max 12 words, self-aware/funny, first person, never corporate

---

### Challenge.tsx changes

`praiseData` state type gains:
```ts
shareReactionPill: string;
shareSub: string;
```

`handlePraiseReceived` gains 2 new params: `shareReactionPill, shareSub`  
→ `setPraiseData` call includes them

Both `<ShareCard>` render sites pass:
```tsx
shareReactionPill={praiseData.shareReactionPill}
shareSub={praiseData.shareSub}
```

---

### ProgressPhotoUpload.tsx changes

`onPraiseReceived` callback type extended to pass `shareReactionPill` and `shareSub` as two additional string arguments (6 total).

`onPraiseReceived(result.praise, result.bonusPoints, result.progressLabel, result.shareTagline, result.shareReactionPill, result.shareSub, storageUrl)` call updated (or reorder to match new signature — `wipImageUrl` stays last or near last).

---

### No changes to:
- Download / Share button logic
- Canvas dimensions (1080×1080)
- `drawCoverImage()` function
- `generateQRDataUrl()` function  
- `loadImageCors()` function
- Any timer, challenge completion, or points logic
