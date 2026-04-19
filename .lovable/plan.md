

## Scope check

`src/lib/consult-server.ts` is NOT fully unused — it still exports things that are actively imported:

| Export | Used by |
|---|---|
| `startConsult` (server fn) | `src/routes/consult.tsx` (creates every new consult) |
| `Intake` type | `src/routes/consult.tsx`, `src/components/consult/intake-stepper.tsx`, `src/routes/_authenticated/_expert/expert_.$prescriptionId.tsx` |
| `getConsult`, `saveConsultContact`, `claimConsult`, `unlockEducation` | nothing — already replaced by `consult-access` edge function |

`src/lib/consult-schema.ts` is only imported by `consult-server.ts` itself — once `startConsult` migrates, it can also go.

So "delete the file" actually means: **finish the edge-function migration for `start` first, then delete both files cleanly.**

## Plan

1. **Add `start` action to the `consult-access` edge function**
   - Accept `{ action: "start", intake }`.
   - Validate `intake` server-side using the same shape as the old zod schema (mirrored in Deno, like the other edge functions already do).
   - If the caller has a verified JWT → set `user_id`, no anon token.
   - Otherwise → mint a 32-byte base64url anon token, store SHA-256 hash, return raw token to caller exactly once.
   - Insert the consult row + seed system message with the intake summary (port `intakeSummary` helper).
   - Return `{ consultId, anonToken? }`.

2. **Add `startConsultRequest` to `src/lib/consult-access.ts`**
   - Thin wrapper around `supabase.functions.invoke("consult-access", { body: { action: "start", intake } })`.
   - Returns `{ consultId, anonToken? }`.

3. **Move the `Intake` type to a client-safe module**
   - Create `src/lib/consult-types.ts` exporting just the `Intake` type (no zod, no server imports).
   - Update the three importers:
     - `src/routes/consult.tsx`
     - `src/components/consult/intake-stepper.tsx`
     - `src/routes/_authenticated/_expert/expert_.$prescriptionId.tsx`

4. **Switch `src/routes/consult.tsx` to the edge function**
   - Replace `startConsult({ data: { intake, userId } })` with `startConsultRequest(intake)`.
   - Drop the `userId` argument (the edge function derives it from the JWT — never trust client-supplied user ids, same rule as everywhere else).

5. **Delete the now-orphan files**
   - `src/lib/consult-server.ts`
   - `src/lib/consult-schema.ts` (only consumer was consult-server)
   - Leave `supabase/functions/consult-chat/index.ts`'s "Keep these in sync" comment intact — the caps still mirror what's now defined in the edge function.

## Verification

- Start a fresh consult while signed out → consult created, anon token persisted via `rememberPendingConsult`, redirect to `/consult/$consultId` works.
- Start a fresh consult while signed in → consult created, attributed to user, no anon token returned.
- Existing consult result page still loads (uses `readConsult`, unchanged).
- TypeScript build passes (no dangling imports of `@/lib/consult-server` or `@/lib/consult-schema`).

## Files

- Edit: `supabase/functions/consult-access/index.ts` (add `start` action + intake validator + system-message seeding)
- Edit: `src/lib/consult-access.ts` (add `startConsultRequest`)
- Create: `src/lib/consult-types.ts` (`Intake` type only)
- Edit: `src/routes/consult.tsx` (swap import + call)
- Edit: `src/components/consult/intake-stepper.tsx` (swap `Intake` import)
- Edit: `src/routes/_authenticated/_expert/expert_.$prescriptionId.tsx` (swap `Intake` import)
- Delete: `src/lib/consult-server.ts`
- Delete: `src/lib/consult-schema.ts`

