

# Vital Logic — v1 MVP Plan

A mobile-first marketing site + AI symptom consult, with a real expert review queue behind auth. Visual language matches the deck: deep indigo/black, glowing gold + violet accents, lotus/circuit motifs, serif display + clean sans body.

## 1. Brand & design system
- Colors (dark theme default): near-black indigo background `#0B0A1A`, surface `#15122B`, gold `#E8B85C`, violet `#7B5BD9`, soft cream text.
- Typography: serif display (Cormorant Garamond / Fraunces) for headings, Inter for body.
- Motifs: lotus + circuit-board imagery (use the deck's hero art as the homepage hero), subtle radial glows behind CTAs, thin gold dividers.
- Mobile-first: bottom-anchored CTAs, sticky chat launcher, touch-friendly tap targets, hamburger nav.

## 2. Marketing site (separate routes for SSR/SEO)
- `/` — Home: hero (lotus/circuit, "The Amazon of Health"), mission, "From Medication to Education" section, four pillars teaser, CTA → Start free consult.
- `/philosophy` — Mission, core promise, pill-for-an-ill → systemic empowerment story.
- `/pillars` — The four pillars (Consult, Prescribe, Medicate, Educate) with icons.
- `/journey` — Customer journey: AI Intake → DB Match → Human Audit → Empowerment.
- `/integrity` — Playwright SRE layer: AUST L/ARTG checks, 99.9% uptime promise, integrity guardrails.
- `/origins` — Global wisdom origins (Ayurveda, Western Naturopathy, Indigenous, Psychedelic).
- `/consult` — entry point for the AI consult flow.
- Per-route `head()` metadata (title, description, og:title, og:description) for each.
- Shared header (logo + nav + "Start consult" CTA) and footer (links + disclaimer that this is not medical advice).

## 3. AI Consult — Hybrid intake
A multi-step guided intake, then opens into free chat for follow-ups, then produces a draft prescription queued for expert review.

**Step A — Structured intake (mobile-friendly card stepper):**
1. Primary symptom(s) — chips + free text
2. Duration & severity — slider
3. Lifestyle snapshot — sleep, stress, diet, activity
4. Existing meds / allergies / pregnancy flag (safety gates)
5. Goals — relief, prevention, education

**Step B — Open chat:** free-form follow-ups with the AI (Lovable AI Gateway, default `google/gemini-3-flash-preview`, streaming, markdown rendered). System prompt encodes the Vital Logic philosophy + safety rules (always recommend seeing a doctor for red-flag symptoms, no diagnosis claims).

**Step C — Draft prescription:** AI uses tool-calling to output a structured `DraftPrescription` (1–2 specific recommendations, each with rationale, suggested products, modality tags: Ayurveda / Western / Indigenous / Plant medicine, safety notes, citations). Saved to DB with status `pending_review`.

**Step D — Confirmation screen:** "Your recommendation is being reviewed by a human expert. We'll notify you when it's ready." Shows estimated wait, lets user create an account (if not yet) to receive it.

## 4. Accounts & roles
- Email/password auth (Lovable Cloud).
- Roles via separate `user_roles` table + `has_role()` security-definer function: `user`, `expert`, `admin`. (No roles on profiles table — prevents privilege escalation.)
- `profiles` table for display name, avatar, optional health profile fields.
- Public routes: marketing pages + `/consult` (anonymous consults allowed; account required to see reviewed result).
- Protected: `/account`, `/account/consults`, `/expert/*`, `/admin/*`.

## 5. Expert review dashboard (`/expert`)
- Queue list: pending consults sorted oldest-first, with intake summary preview, AI draft, safety flags highlighted.
- Detail view: full intake transcript + chat history + AI draft prescription. Expert can:
  - Edit recommendation text, swap products, adjust safety notes
  - Approve → status `approved`, becomes visible to user
  - Reject with reason → user sees gentle "we couldn't safely recommend, please consult a clinician" message
  - Escalate (flag for senior expert)
- All edits audited (who, when, what changed).
- Realtime updates so a queue item disappears when another expert claims it (claim/lock pattern to prevent double-review).

## 6. Data model (Lovable Cloud / Supabase)
- `profiles` (id, display_name, avatar_url, created_at)
- `user_roles` (id, user_id, role enum: 'user'|'expert'|'admin')
- `consults` (id, user_id nullable for anonymous, intake_jsonb, status enum: 'draft'|'pending_review'|'approved'|'rejected'|'escalated', created_at)
- `consult_messages` (id, consult_id, role: 'user'|'assistant'|'system', content, created_at) — full chat history
- `prescriptions` (id, consult_id, draft_jsonb, final_jsonb nullable, reviewed_by, reviewed_at, review_notes, status)
- `prescription_audit` (id, prescription_id, actor_id, action, diff_jsonb, created_at)
- RLS: users see only their own consults/prescriptions; experts see all `pending_review`/`escalated` via `has_role(auth.uid(), 'expert')`; admins everything.

## 7. Server-side
- `createServerFn` for: starting a consult, sending a chat message (streams from Lovable AI Gateway), submitting intake → generating draft prescription via tool-call, expert claim/approve/reject actions.
- AI calls go through an edge function (`/functions/v1/consult-chat`) using `LOVABLE_API_KEY`; system prompt lives server-side and references the Vital Logic philosophy + safety rails.
- Structured prescription output via tool-calling schema (so we never parse free-form JSON).

## 8. Safety & legal
- Persistent footer disclaimer: "Vital Logic is not a substitute for professional medical care."
- Red-flag detector in system prompt (chest pain, suicidal ideation, pregnancy + certain herbs, etc.) → AI immediately recommends emergency/professional care and flags consult as `escalated`.
- Pregnancy/medication interaction gates in intake.

## 9. What's intentionally NOT in v1
- Marketplace / product catalog / checkout (Pillar 3)
- Personalized Education package generation (Pillar 4)
- Playwright TGA scraping bots (Pillar SRE layer — marketing page only for now)
- Notifications (email/SMS when prescription approved) — shown as "coming soon"; user just refreshes `/account/consults`

## 10. Build order
1. Design tokens + dark theme + typography + shared header/footer
2. Marketing routes with deck content + per-route SEO
3. Auth (email/password) + profiles + user_roles + role-based guards
4. Consult schema + intake stepper UI
5. AI chat edge function (streaming) + chat UI with markdown
6. Tool-calling draft prescription generator + confirmation screen
7. Expert dashboard (queue, detail, claim/approve/reject, audit)
8. Polish: animations, glow effects, mobile QA at 380px

