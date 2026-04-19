-- Allow each authenticated user to subscribe to a topic named `ready-<their-uid>`,
-- used by the site header to live-refresh the patient's ready-prescription count.
drop policy if exists "Realtime: user can read own ready topic" on realtime.messages;
create policy "Realtime: user can read own ready topic"
on realtime.messages
for select
to authenticated
using (
  realtime.topic() = 'ready-' || auth.uid()::text
);
