

# Test plan — manual two-window expert flow

## What I'll do (once approved)

1. **Wait for your email.** You sign up at `/signup` in the preview, then tell me the email you used. (I can't grant a role to an account that doesn't exist yet.)
2. **Grant expert role** via a one-line migration:
   ```sql
   insert into public.user_roles (user_id, role)
   select id, 'expert'::app_role from auth.users where email = '<your-email>';
   ```
3. **Verify** with a `read_query` showing your account now has `expert` in `user_roles`, and confirm "Expert" link appears in the header on refresh.

## What you'll do (manual two-window test)

**Window A — anonymous user** (incognito / private window so no session):
1. Go to `/consult` → complete the 5-step intake → "Begin consult"
2. Send 3+ messages in the chat → click "Generate my recommendation"
3. Land on `/consult/$id/result` showing the pulsing lotus "Awaiting human review" card. **Leave this tab open and visible.**

**Window B — expert** (your normal logged-in window):
1. Go to `/expert` → see the new pending item appear in the queue (realtime)
2. Open it → click **Claim for review** → edit nothing or tweak a field → **Approve**
3. **Switch back to Window A** without refreshing.

## Pass criteria

- ✅ Window A transitions from "Awaiting review" → green "Approved by a practitioner" view automatically (realtime channel on `prescriptions` filtered by `consult_id`).
- ✅ Audit trail panel on the expert detail page shows two rows: `Claimed for review` then `Approved`, both attributed to your account.
- ✅ `prescription_audit` table contains both rows (I'll verify with a SQL read after you confirm).

## If it doesn't auto-update

Likely cause: realtime publication doesn't include `prescriptions`. The Phase 4 migration enabled it, but I'll re-check `pg_publication_tables` and re-add if missing. No code change expected.

## Reply with

Just your signup email. I'll handle the role grant and verification, then you run the two-window test.

