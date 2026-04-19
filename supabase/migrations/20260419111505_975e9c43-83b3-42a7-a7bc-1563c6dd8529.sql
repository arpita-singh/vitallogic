-- One-time backfill: link orphaned (anonymous) consults to the user whose
-- email matches the intake contactEmail. Only attaches to a single matching
-- user and only when user_id is currently null. Safe and idempotent.
UPDATE public.consults c
SET user_id = u.id
FROM auth.users u
WHERE c.user_id IS NULL
  AND lower(c.intake->>'contactEmail') = lower(u.email);