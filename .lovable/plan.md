

## Plan — Vital Logic v2.0 (Pillars 3 & 4)

Building the marketplace foundation + premium education unlock. Four steps, sequenced so backend exists before UI consumes it.

---

### Step 1 — Database (migration)

Two new tables with RLS using existing `has_role()` + `user_roles` pattern.

**`certified_materia_medica`** (marketplace inventory)
- `id` uuid PK, `product_name` text, `category` text (free-form for now — Ayurveda / Naturopathy / Indigenous / etc.), `aust_l_number` text, `price` numeric(10,2), `stock_status` boolean default true, `vendor_name` text, `description` text (small extra — needed for product cards), `created_at`, `updated_at`.
- RLS: SELECT for everyone (public catalog); INSERT/UPDATE/DELETE only for `admin` or `expert` (so experts can manage their own catalog if needed; admins always).
- Seed ~6 demo products covering all three categories so the UI has something to show immediately.

**`user_purchases`** (payment ledger placeholder)
- `id` uuid PK, `user_id` uuid not null, `consult_id` uuid (nullable — education unlock can be per-consult or account-wide), `has_unlocked_education` boolean default false, `purchased_medications` jsonb default `'[]'`, `created_at`, `updated_at`.
- RLS: owner-only SELECT/INSERT/UPDATE (`auth.uid() = user_id`); experts/admins can SELECT for support.

**Schema-level addition to `prescriptions`:** add `attached_products` jsonb column (default `'[]'`) on the existing `prescriptions` table to hold the array of selected marketplace products `{product_id, product_name, dosage_notes}`. This is the cleanest way to attach products without disturbing the existing `draft`/`final` JSON shape.

---

### Step 2 — Expert UI: product attachment

File: `src/routes/_authenticated/_expert/expert_.$prescriptionId.tsx` (note the `_` suffix — the renamed file from earlier this session).

- Add a new "Attach marketplace products" panel inside the editor card, above the existing approve/reject buttons.
- New component `src/components/expert/product-picker.tsx`:
  - shadcn `Command` + `Popover` combobox, pulls from `certified_materia_medica` where `stock_status = true`.
  - Searchable by `product_name`, grouped by `category` (CommandGroup per category).
  - Each result shows: product name, AUST-L number badge, price, vendor (small/muted).
  - Selected products render as chip rows below with: name, optional dosage-notes input, remove button.
- On approve, the chosen products are written to `prescriptions.attached_products` AND a new audit row is inserted into `prescription_audit` with `action: "attach_products"` and `diff: { added: [...], removed: [...] }` so the existing audit trail captures the change. The existing approve flow is preserved verbatim — products are an additive sidecar.
- `audit-trail.tsx` already renders unknown actions generically; no change needed there.

---

### Step 3 — Patient result UI

File: `src/routes/consult_.$consultId.result.tsx`.

Two new sections rendered only when `rx.status === "approved"`:

**Section 1 — Medication cards** (above the existing rationale list, or directly under the "Approved" header — leaning under the summary so the prescribed products feel like the primary deliverable).
- New component `src/components/consult/product-card.tsx`.
- Grid: 1 col mobile, 2 col `md:`. Each card uses our surface tokens (`bg-surface`, `border-border`, gold accent on category badge).
- Card content: category chip, product name (display font), AUST-L line (`text-xs text-muted-foreground`), vendor, price in gold, expert's dosage notes if present, primary "Purchase medication" button (placeholder — `onClick` shows a `sonner` toast "Checkout coming soon").
- If `attached_products` is empty, the section is omitted.

**Section 2 — "Unlock Your Owner's Manual"** (below the rationale + safety + citations block).
- Full-width premium card. Background: subtle gold→violet gradient (`bg-gradient-to-br from-gold/10 via-background to-violet/10`), thicker gold border (`border-gold/40`), large display headline.
- Copy: "Unlock your Owner's Manual" + subtitle "A custom preventative-care guide built from your consult — your unique constitution, mind-body patterns, and the daily habits that keep you in flow."
- Visual flourish: small lotus mark + 3 micro-bullets ("Your unique design", "Mind-body connection", "Preventative habits").
- Primary CTA: "Unlock now — $X" (placeholder price). On click: insert/upsert into `user_purchases` with `has_unlocked_education = true` (placeholder for real Stripe), then navigate to `/owner-manual`. Show a toast confirmation.
- If the user already has `has_unlocked_education = true`, swap CTA to "Open your Owner's Manual" linking to `/owner-manual`.

---

### Step 4 — Owner's Manual route

New file: `src/routes/_authenticated/owner-manual.tsx` (sits under existing `_authenticated` guard so unauth users bounce to login).

- On mount, query `user_purchases` for current user, find max `has_unlocked_education`.
- **Locked state**: centered card with a faded lotus icon, copy "Your Owner's Manual is locked. Complete a consult and unlock to receive your personalised preventative-care guide.", primary button → `/consult`, secondary → back home.
- **Unlocked state**: hero with user's display_name from profile ("Your Owner's Manual, {name}"), then 3 sections rendered as styled cards in a single column with generous spacing:
  1. **Your Unique Design** — placeholder paragraphs about constitutional type.
  2. **Mind-Body Connection** — placeholder paragraphs about stress/sleep/digestion patterns.
  3. **Preventative Habits** — placeholder daily/weekly/seasonal practice list.
- Each section: gold uppercase eyebrow, display-font heading, body copy in `text-foreground/90`, divider between sections.
- Add the route to the header user menu (small addition to `site-header.tsx`'s authenticated dropdown if there is one — otherwise skip; will check during implementation).

---

### Cross-cutting

- All new tables get `update_updated_at_column()` trigger using the existing function.
- Realtime is NOT enabled on the new tables (not needed — patient page already reloads on prescription updates, which now include `attached_products`).
- Toasts via existing `sonner` setup.
- No new npm dependencies; combobox uses already-installed shadcn `Command` + `Popover`.
- Visual language stays "Sunny Goth": violet `#7C3AED`, gold `#F4C151`, surface tokens already in `styles.css`.
- Audit trail integrity: every approve that includes products writes BOTH the existing approval audit row AND a new `attach_products` row, in a single transaction client-side (sequential inserts; if the second fails the approval still stands but a console error surfaces — acceptable for placeholder phase).

### Files touched
**New:**
- migration SQL (2 tables + `prescriptions.attached_products` column + RLS + seed)
- `src/components/expert/product-picker.tsx`
- `src/components/consult/product-card.tsx`
- `src/routes/_authenticated/owner-manual.tsx`

**Modified:**
- `src/routes/_authenticated/_expert/expert_.$prescriptionId.tsx`
- `src/routes/consult_.$consultId.result.tsx`
- `src/components/site-header.tsx` (only if an auth menu exists — small link addition)

### Out of scope (explicit)
- Real Stripe checkout — placeholder buttons + toasts only.
- Actual AI-generated owner's-manual content — placeholders only.
- Inventory management UI for admins — not requested.
- Email notifications on purchase — not requested.

