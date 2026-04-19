-- Enable Realtime Authorization: gate channel subscriptions via RLS on realtime.messages.
-- The prescriptions and consults tables broadcast row changes; without these policies,
-- any authenticated user could subscribe to any topic and receive row-change events.

-- Enable RLS on realtime.messages (idempotent).
alter table realtime.messages enable row level security;

-- Allow experts/admins to subscribe to / receive any realtime topic.
-- They legitimately need queue + consult monitoring across all rows.
drop policy if exists "Realtime: experts and admins full access" on realtime.messages;
create policy "Realtime: experts and admins full access"
on realtime.messages
for select
to authenticated
using (
  public.has_role(auth.uid(), 'expert'::public.app_role)
  or public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Allow consult owners to subscribe to topics related to their own consults.
-- Our client uses topic names like `rx-<consultId>` for the patient result page.
drop policy if exists "Realtime: consult owner can read own rx topic" on realtime.messages;
create policy "Realtime: consult owner can read own rx topic"
on realtime.messages
for select
to authenticated
using (
  exists (
    select 1
    from public.consults c
    where c.user_id = auth.uid()
      and realtime.topic() = 'rx-' || c.id::text
  )
);
