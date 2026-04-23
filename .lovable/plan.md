

## Premium "KonMari Decision Coach" — Phased Plan

A new Premium mode where users photograph individual items (or a pile) and AI tells them what to do with each one — keep, donate, recycle, sell, or toss — with a Marie Kondo–style rationale. Decisions captured become a feedback loop that personalizes future suggestions.

### What's feasible right now

Everything in **Phase 1** is buildable today using infrastructure you already have: Lovable AI Gateway (multimodal Gemini), Supabase storage, edge functions, and your existing rate-limiting + RLS patterns. The KonMari analyzer is essentially a sibling of `analyze-room` with a different prompt and output schema.

**Payments / paywall** is feasible but requires enabling Lovable Payments (Stripe) — that's a separate one-click setup, not custom code.

**Personalization "learning"** is feasible in two stages: simple aggregated preferences (Phase 2), then prompt-conditioned recommendations (Phase 3). True ML fine-tuning is out of scope for now.

---

### Phase 1 — Core Decision Coach (MVP)

**User flow**
1. From homepage, tap new card "Help me decide" (Premium-gated; in Phase 1 we can soft-launch free to validate).
2. Capture screen variant: "Photograph the items you're stuck on" (single item OR a pile).
3. AI returns a list of detected items, each with: suggested action (Keep / Donate / Sell / Recycle / Toss), one-line rationale (KonMari "does it spark joy / serve a purpose"), and confidence.
4. User swipes/taps each item: ✅ Did it · ✏️ Different action · ⏭️ Skip.
5. Completion screen: count of decisions made, points earned, encouragement.

**New edge function**: `analyze-items`
- Multimodal call to `google/gemini-2.5-flash` with structured tool-calling output (no JSON parsing fragility).
- System prompt grounded in KonMari principles: ask "does this spark joy or serve a clear purpose?", be decisive but kind, never shame the user, max 8 items per photo.
- Returns: `{ items: [{ name, visual_description, suggested_action, rationale, category, confidence }] }`.
- Same auth + rate-limit pattern as `analyze-room` (30/hr authed, 10/hr guest).

**New tables**
- `decision_sessions` — `id, user_id, image_url, created_at, item_count, decisions_completed`
- `decision_items` — `id, session_id, user_id, name, visual_description, ai_suggested_action, ai_rationale, category, user_action, user_action_at, status (pending|done|skipped)`

Both with RLS `auth.uid() = user_id`. Actions enum stored as text: `keep | donate | sell | recycle | toss`.

**Points integration**
- Each completed decision = 5 points; using AI suggestion = +2 bonus. Server-side RPC `complete_decision_add_points` mirroring `complete_challenge_add_points`.

**New pages / components**
- `src/pages/DecisionCapture.tsx` — photo upload + intent ("just one item" / "a pile")
- `src/pages/DecisionSession.tsx` — swipeable item cards with action buttons
- New homepage card "Help me decide" alongside the existing "Capture a space" CTA.

---

### Phase 2 — Premium gating + payments

- Enable **Lovable Payments (Stripe)** — recommended path, no account setup needed.
- One product: "TidyMate Premium" (monthly + yearly).
- New table `subscriptions` (or use Lovable Payments' built-in customer state).
- Free tier: 3 decision sessions ever. Premium: unlimited.
- Gate enforced in `analyze-items` edge function (server-side, never client).
- `SaveProgressModal` pattern reused for the upgrade prompt at the limit.

---

### Phase 3 — Feedback loop / personalization

- After each user override of an AI suggestion, store the delta in a new `user_preferences` table (aggregated counters per category × action: e.g. "books → keep: 12, donate: 1").
- The `analyze-items` function fetches the user's top patterns and injects them into the system prompt: *"This user tends to keep books and donate clothing — weight suggestions accordingly."*
- Lightweight, no model training, immediate effect, fully reversible. Can iterate from there toward embeddings or a recommender if the data justifies it.

---

### Out of scope (for now)

- True ML fine-tuning on user data
- Marketplace integrations (eBay, Poshmark) — link out instead
- Local donation-center lookup — possible Phase 4 with a maps API
- Item-level photo storage at scale (we'll keep one composite photo per session, not per item, to keep storage cheap)

---

### Technical notes

- Use Gemini's tool-calling for structured output (already documented in your AI gateway context) — more reliable than the regex JSON parsing currently in `analyze-room`.
- KonMari prompt must be carefully tuned: decisive but never dismissive, culturally aware (some users keep heirlooms regardless of "joy").
- Keep the same image compression pipeline (1024px / 0.82 JPEG) from `Capture.tsx`.
- New i18n keys for English + Chinese in `LanguageContext.tsx`.
- Analytics events: `decision_session_started`, `decision_made`, `ai_suggestion_accepted`, `ai_suggestion_overridden`.

---

### What I'd build first if you approve

Phase 1 only — ship it free to a small set of users, validate that the suggestions feel useful, *then* add the paywall (Phase 2) and personalization (Phase 3). This keeps the first release small, lets us tune the prompt against real photos, and avoids charging before the product proves itself.

Two questions before I start:
1. **Single item vs. pile per photo** — support both in v1, or start with single-item only (simpler UI, sharper AI accuracy)?
2. **Free trial size** — 3 free sessions before paywall, or unlimited free in v1 and add paywall in Phase 2?

