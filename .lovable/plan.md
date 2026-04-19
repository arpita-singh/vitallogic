

# Phase 3 — AI Consult (Hybrid Intake → Chat → Draft Rx)

## 1. Edge functions (2)

**`supabase/functions/consult-chat/index.ts`** — streaming SSE chat
- Public function (`verify_jwt = false`) — anonymous consults allowed.
- Body: `{ consultId, messages }`. System prompt embedded server-side: Vital Logic philosophy (four pillars, "from medication to education"), modality awareness (Ayurveda / Western Naturopathy / Indigenous / Plant medicine), red-flag rules (chest pain, suicidal ideation, severe bleeding, pregnancy + contraindicated herbs → emergency referral), no-diagnosis disclaimer, encourages 3–5 follow-ups before suggesting prescription.
- Calls Lovable AI Gateway with `google/gemini-3-flash-preview`, `stream: true`. Streams SSE back unchanged.
- Persists user + assistant messages to `consult_messages` via service-role client AFTER stream completes (read body twice via tee, or buffer assistant text while streaming).
- Handles 429 / 402 with friendly JSON errors.

**`supabase/functions/generate-prescription/index.ts`** — tool-calling draft Rx
- Body: `{ consultId }`. Pulls intake + full message history.
- Calls gateway with `tool_choice` forcing a `submit_prescription` function whose JSON schema is:
  ```
  { recommendations: [{
      title, modality: "ayurveda"|"western_naturopathy"|"indigenous"|"plant_medicine"|"lifestyle",
      rationale, suggested_products: [{name, form, dosage, notes}],
      safety_notes, citations: [string]
    }] (1–2 items),
    summary, red_flags: [string], escalate: boolean }
  ```
- Inserts into `prescriptions` (status `escalated` if `escalate=true` or any red_flags, else `pending_review`). Updates parent consult status accordingly.
- Returns `{ prescriptionId, status }`.

## 2. Intake stepper (`src/routes/consult.tsx` — replace placeholder)

Mobile-first card stepper, 5 steps, progress bar at top, sticky bottom CTA:

1. **Symptoms** — chip multi-select (Headache, Fatigue, Sleep, Stress, Digestion, Pain, Mood, Skin, Hormonal, Other) + free-text textarea.
2. **Duration & severity** — radio (Acute <2w / Subacute 2–8w / Chronic >8w) + severity slider 1–10.
3. **Lifestyle** — sleep hours (slider), stress (1–5), diet (chips: omnivore/vegetarian/vegan/keto/other), activity level (1–5).
4. **Safety** — current meds (textarea), allergies (textarea), pregnancy (yes/no/n-a), under 18 toggle.
5. **Goals** — chip multi-select (Symptom relief / Prevention / Energy / Sleep / Education / Long-term wellness).

On final "Begin consult":
- Server fn `startConsult({ intake })` inserts into `consults` (user_id from auth or null), inserts a system "intake summary" message, returns `consultId`. Navigate to `/consult/$consultId`.

## 3. Chat route (`src/routes/consult.$consultId.tsx`)

- Loads consult + messages via server fn.
- Renders intake summary card at top (collapsible), then message list with `react-markdown`.
- Token-by-token SSE streaming using the pattern from the AI Gateway docs (line-by-line parse, update last assistant message in place).
- Composer at bottom (mobile-safe, `pb-[env(safe-area-inset-bottom)]`).
- "Generate my recommendation" button appears after ≥3 user turns. Calls `generate-prescription` (non-stream `supabase.functions.invoke`). On success → navigate to `/consult/$consultId/result`.
- Toasts for 429 ("Slow down — try again in a moment") and 402 ("AI credits exhausted — please add credits").

## 4. Result route (`src/routes/consult.$consultId.result.tsx`)

- Pulls latest prescription for the consult.
- If `pending_review` / `escalated`: shows the "Awaiting human review" card (lotus + pulsing gold ring, estimated wait, prompt to sign up if anonymous so result can be sent to account).
- If `approved`: renders the `final` recommendations (or `draft` fallback) with modality badges, rationale, products, safety notes, citations, and footer disclaimer.
- If `rejected`: gentle message advising professional clinician.

## 5. Account → My consults (`src/routes/_authenticated/account.tsx`)

- Add a "Your consults" section listing the user's consults (status badge, created date, link to `/consult/$id/result`).

## 6. Anonymous → account claim

- If user signs up while having an anonymous `consultId` in `localStorage` (`vl_consult_id`), a server fn `claimConsult({ consultId })` sets `consults.user_id = auth.uid()` (allowed because owner-update policy permits null→self via a small RLS update — we'll add an `update` policy `Consults: claim anonymous` allowing update when current `user_id IS NULL` and `auth.uid()` is being set).

## 7. Migration (small)

- New RLS policy on `consults` to allow anonymous → owner claim (`USING user_id IS NULL` + `WITH CHECK auth.uid() = user_id`).
- `supabase/config.toml`: add blocks for both functions with `verify_jwt = false`.

## 8. Files

**New**
- `supabase/functions/consult-chat/index.ts`
- `supabase/functions/generate-prescription/index.ts`
- `src/routes/consult.$consultId.tsx`
- `src/routes/consult.$consultId.result.tsx`
- `src/lib/consult-server.ts` (`createServerFn` wrappers: `startConsult`, `getConsult`, `claimConsult`, `listMyConsults`)
- `src/components/consult/intake-stepper.tsx`
- `src/components/consult/chat-message.tsx`
- `src/components/consult/modality-badge.tsx`
- One migration file (claim policy + config blocks via config.toml edit)

**Edit**
- `src/routes/consult.tsx` (replace stub with stepper)
- `src/routes/_authenticated/account.tsx` (add consults list)
- `supabase/config.toml` (function blocks)

## 9. Out of scope (Phase 4)
Expert review actions (claim/approve/reject/escalate UI), audit writes from expert dashboard, realtime queue updates, email notifications.

