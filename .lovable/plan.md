## Diagnosis

The "Edge Function returned a non-2xx status code" toast on `/expert/consult/9f15a1e7…` is the `generate-prescription` function returning **HTTP 401 Unauthorized** (confirmed in edge logs: `POST | 401 | …/generate-prescription`, 886 ms).

The function is not crashing — it is correctly rejecting the request based on its current auth rules:

```ts
// supabase/functions/generate-prescription/index.ts (lines 163–182)
let authorized = false;
if (Bearer token user.id === consult.user_id) authorized = true;            // patient owner
if (anonToken hash === consult.anon_token_hash) authorized = true;          // anonymous patient
if (!authorized) return 401;
```

There is **no branch that allows an expert or admin** to invoke this function. So when you (logged in as expert) click **Generate Prescription** on the expert consult page (which belongs to another user, or is anonymous), you get 401.

The expert UI at `src/routes/_authenticated/_expert/expert_.consult.$consultId.tsx:78` calls `supabase.functions.invoke("generate-prescription", …)` with only the user's expert JWT — no `anonToken` and no role check on the server.

## Fix

Add a third authorization branch to `generate-prescription/index.ts`: if the authenticated caller has the `expert` or `admin` role (via the existing `has_role()` security-definer Postgres function), allow the call.

### Change

In `supabase/functions/generate-prescription/index.ts`, after the existing owner/anon checks and before the `if (!authorized)` reject:

```ts
// Allow staff (experts/admins) to draft on behalf of the patient.
if (!authorized && authHeader.startsWith("Bearer ")) {
  const token = authHeader.slice("Bearer ".length);
  const { data: userData } = await supabase.auth.getUser(token);
  const uid = userData?.user?.id;
  if (uid) {
    const [{ data: isExpert }, { data: isAdmin }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: uid, _role: "expert" }),
      supabase.rpc("has_role", { _user_id: uid, _role: "admin" }),
    ]);
    if (isExpert === true || isAdmin === true) authorized = true;
  }
}
```

(We can also refactor to call `getUser` once and reuse, but the above keeps the diff tight.)

No DB migration required — `has_role(uuid, app_role)` already exists and is used throughout RLS policies (`CLAUDE.md` → "Authorization").

### Why not loosen RLS or change the client

- The function uses the service-role key for DB access, so RLS is not the gate here — the in-function check is. Fix belongs in the function.
- Sending the patient's `anonToken` from the expert UI would require leaking it to expert sessions, which we explicitly don't want.

## Verification

1. As an `expert`, open `/expert/consult/<anon consult id>` and click **Generate Prescription** → returns 200 with `{ prescriptionId, status }` and inserts a row in `prescriptions`.
2. As an `expert`, click again → still returns 200 (idempotency short-circuit on existing pending/approved draft).
3. As a logged-out random user calling the function directly → still 401.
4. As a signed-in `user` (not expert) on someone else's consult → still 401.
5. As the consult's owner (patient) → still 200 (existing path unchanged).

## Files touched

- `supabase/functions/generate-prescription/index.ts` — add staff role auth branch (~10 lines).

No other files, no schema changes.