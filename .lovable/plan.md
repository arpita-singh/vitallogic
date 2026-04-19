

## What the finding really says

Two RLS policies on `consults` are wide open for anonymous rows (`user_id IS NULL`):

- **`Consults: anyone can select anonymous`** — anyone with the consult table can read every anonymous intake, which contains health symptoms, meds, allergies, pregnancy status, contact email, etc.
- **`Consults: anyone can update anonymous`** — anyone can also overwrite any anonymous consult's intake.

Combined with `Messages: anyone can select for anonymous consults` and `owner can insert via consult`, the entire anonymous flow is essentially public — any visitor who knows or guesses a consult id can read and modify other people's intake and chat.

This is a real vulnerability because intake data is sensitive health information.

## Fix approach: bind anonymous consults to a per-browser secret

The cleanest fix that keeps the "start a consult before signing up" UX is to give each anonymous consult an unguessable secret token, store it only in the browser that created it, and require that token on every server-side read/update. RLS then drops the public policies entirely.

### Database changes (migration)
1. Add `anon_token_hash text` column to `consults` (stores SHA-256 of the secret, not the raw token).
2. Add `anon_token_hash text` column to `consult_messages` (denormalized for RLS), populated when the message is inserted.
3. Drop the four overly-permissive policies:
   - `Consults: anyone can select anonymous`
   - `Consults: anyone can update anonymous`
   - `Messages: anyone can select for anonymous consults`
   - `Messages: owner can insert via consult` (the anonymous half)
4. Keep `Consults: anyone can insert` but tighten it so the inserted row must include a non-null `anon_token_hash` whenever `user_id` is null.
5. All anonymous reads/updates now go through server functions that verify the token server-side using the service role key — RLS no longer needs a public anonymous-read path.

### Server-side changes
- `src/lib/consult-server.ts`
  - `startConsult`: generate a random 32-byte token, return it to the browser, store its SHA-256 hash on the consult row. Use the service-role client for inserts so RLS doesn't need a public path.
  - Add `getConsult({ consultId, anonToken? })`: returns intake + messages + prescription status. Verifies either signed-in ownership OR matching `anon_token_hash`.
  - `saveConsultContact`: require and verify `anonToken` for anonymous updates.
  - `claimConsult` / auto-claim: also accept `anonToken` so a freshly signed-in user can claim only consults they actually own.
- `supabase/functions/consult-chat/index.ts`: require `anonToken` (or a valid bearer JWT whose `auth.uid()` owns the consult) before persisting messages. Reject otherwise.

### Client changes
- `src/lib/claim-consult.ts`: store `{ consultId, anonToken }` together in `sessionStorage` (and mirror in `localStorage` for cross-tab recovery). Pass the token on claim.
- `src/routes/consult_.$consultId.index.tsx`: stop reading `consults` / `consult_messages` / `prescriptions` directly via the anon Supabase client. Instead call the new `getConsult` server function with the stored token, and send the token in the chat fetch and `generate-prescription` invoke.
- `src/components/consult/contact-capture.tsx`: pass the stored token through `saveConsultContact`.
- `src/routes/consult_.$consultId.result.tsx`: same — fetch via server function with token (or via signed-in RLS for owners).

### What this gives us
- Anonymous intake is no longer publicly readable: knowing a consult id is not enough; the secret token is required.
- Anonymous intake can no longer be modified by anyone other than the original browser session (or, after claim, the owning user).
- The expert/admin paths are unaffected (they go through `has_role` policies).
- Signed-in patients are unaffected (they go through `auth.uid() = user_id`).

### Files to change
- New migration in `supabase/migrations/`
- `src/lib/consult-server.ts`
- `src/lib/claim-consult.ts`
- `src/routes/consult_.$consultId.index.tsx`
- `src/routes/consult_.$consultId.result.tsx`
- `src/components/consult/contact-capture.tsx`
- `src/routes/consult.tsx` (capture token returned by `startConsult`)
- `supabase/functions/consult-chat/index.ts`
- `supabase/functions/generate-prescription/index.ts` (verify token if no JWT)

### Out of scope (separate findings)
- The other three findings shown in the security view (realtime broadcast, has_role enumeration, message insert binding) are related but distinct — happy to address them next in their own pass.

### Expected result
- Security scan no longer reports `consults_anonymous_public_readable`.
- Existing UX is preserved: visitors can still start an anonymous consult, chat, and later claim it after sign-in.
- A new browser opening a copied consult URL will not be able to read the intake unless they sign in as the owner.

