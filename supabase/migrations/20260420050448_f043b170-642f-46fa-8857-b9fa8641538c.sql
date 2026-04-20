-- Audit log for role grants/revokes (defence-in-depth + accountability)
create table if not exists public.role_audit_log (
  id uuid primary key default gen_random_uuid(),
  action text not null check (action in ('grant','revoke')),
  target_user_id uuid not null,
  role public.app_role not null,
  actor_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists role_audit_log_created_at_idx
  on public.role_audit_log (created_at desc);

alter table public.role_audit_log enable row level security;

-- Only admins can read the log
create policy "Role audit: admins can select"
  on public.role_audit_log for select
  using (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Nobody can write/edit/delete from the client — only the trigger (SECURITY DEFINER) writes
-- (No INSERT/UPDATE/DELETE policies = all client writes blocked)

-- Trigger function: log grants and revokes
create or replace function public.log_user_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.role_audit_log (action, target_user_id, role, actor_id)
    values ('grant', new.user_id, new.role, auth.uid());
    return new;
  elsif (tg_op = 'DELETE') then
    insert into public.role_audit_log (action, target_user_id, role, actor_id)
    values ('revoke', old.user_id, old.role, auth.uid());
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_log_user_role_change on public.user_roles;
create trigger trg_log_user_role_change
  after insert or delete on public.user_roles
  for each row execute function public.log_user_role_change();