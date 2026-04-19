-- ============== Enums ==============
create type public.app_role as enum ('user', 'expert', 'admin');
create type public.consult_status as enum ('draft', 'pending_review', 'approved', 'rejected', 'escalated');
create type public.prescription_status as enum ('pending_review', 'approved', 'rejected', 'escalated');
create type public.message_role as enum ('user', 'assistant', 'system');

-- ============== Updated-at helper ==============
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============== profiles ==============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "Profiles: owner can select own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Profiles: owner can update own"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Profiles: owner can insert own"
  on public.profiles for insert
  with check (auth.uid() = id);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at_column();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============== user_roles ==============
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

-- Security definer role check (avoids RLS recursion)
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

create policy "Roles: user can view own roles"
  on public.user_roles for select
  using (auth.uid() = user_id);

create policy "Roles: admins can view all"
  on public.user_roles for select
  using (public.has_role(auth.uid(), 'admin'));

create policy "Roles: admins can insert"
  on public.user_roles for insert
  with check (public.has_role(auth.uid(), 'admin'));

create policy "Roles: admins can update"
  on public.user_roles for update
  using (public.has_role(auth.uid(), 'admin'));

create policy "Roles: admins can delete"
  on public.user_roles for delete
  using (public.has_role(auth.uid(), 'admin'));

-- ============== consults ==============
create table public.consults (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  intake jsonb not null default '{}'::jsonb,
  status public.consult_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.consults enable row level security;

create index consults_user_id_idx on public.consults(user_id);
create index consults_status_idx on public.consults(status);

create trigger consults_updated_at
  before update on public.consults
  for each row execute function public.update_updated_at_column();

-- Anyone (incl. anon) can create a consult
create policy "Consults: anyone can insert"
  on public.consults for insert
  with check (user_id is null or auth.uid() = user_id);

create policy "Consults: owner can select own"
  on public.consults for select
  using (auth.uid() = user_id);

create policy "Consults: owner can update own"
  on public.consults for update
  using (auth.uid() = user_id);

create policy "Consults: experts can select all"
  on public.consults for select
  using (public.has_role(auth.uid(), 'expert') or public.has_role(auth.uid(), 'admin'));

create policy "Consults: experts can update all"
  on public.consults for update
  using (public.has_role(auth.uid(), 'expert') or public.has_role(auth.uid(), 'admin'));

-- ============== consult_messages ==============
create table public.consult_messages (
  id uuid primary key default gen_random_uuid(),
  consult_id uuid not null references public.consults(id) on delete cascade,
  role public.message_role not null,
  content text not null,
  created_at timestamptz not null default now()
);
alter table public.consult_messages enable row level security;

create index consult_messages_consult_id_idx on public.consult_messages(consult_id);

create policy "Messages: owner can select via consult"
  on public.consult_messages for select
  using (
    exists (select 1 from public.consults c where c.id = consult_id and c.user_id = auth.uid())
  );

create policy "Messages: owner can insert via consult"
  on public.consult_messages for insert
  with check (
    exists (
      select 1 from public.consults c
      where c.id = consult_id
        and (c.user_id = auth.uid() or c.user_id is null)
    )
  );

create policy "Messages: experts can select all"
  on public.consult_messages for select
  using (public.has_role(auth.uid(), 'expert') or public.has_role(auth.uid(), 'admin'));

create policy "Messages: experts can insert"
  on public.consult_messages for insert
  with check (public.has_role(auth.uid(), 'expert') or public.has_role(auth.uid(), 'admin'));

-- ============== prescriptions ==============
create table public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  consult_id uuid not null references public.consults(id) on delete cascade,
  draft jsonb not null,
  final jsonb,
  status public.prescription_status not null default 'pending_review',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.prescriptions enable row level security;

create index prescriptions_consult_id_idx on public.prescriptions(consult_id);
create index prescriptions_status_idx on public.prescriptions(status);

create trigger prescriptions_updated_at
  before update on public.prescriptions
  for each row execute function public.update_updated_at_column();

-- Owner can view their prescription only when approved
create policy "Prescriptions: owner sees approved"
  on public.prescriptions for select
  using (
    status = 'approved' and exists (
      select 1 from public.consults c where c.id = consult_id and c.user_id = auth.uid()
    )
  );

create policy "Prescriptions: experts can select all"
  on public.prescriptions for select
  using (public.has_role(auth.uid(), 'expert') or public.has_role(auth.uid(), 'admin'));

create policy "Prescriptions: experts can update all"
  on public.prescriptions for update
  using (public.has_role(auth.uid(), 'expert') or public.has_role(auth.uid(), 'admin'));

create policy "Prescriptions: experts can insert"
  on public.prescriptions for insert
  with check (public.has_role(auth.uid(), 'expert') or public.has_role(auth.uid(), 'admin'));

-- ============== prescription_audit ==============
create table public.prescription_audit (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references public.prescriptions(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  diff jsonb,
  created_at timestamptz not null default now()
);
alter table public.prescription_audit enable row level security;

create index prescription_audit_prescription_id_idx on public.prescription_audit(prescription_id);

create policy "Audit: experts can select"
  on public.prescription_audit for select
  using (public.has_role(auth.uid(), 'expert') or public.has_role(auth.uid(), 'admin'));

create policy "Audit: experts can insert"
  on public.prescription_audit for insert
  with check (public.has_role(auth.uid(), 'expert') or public.has_role(auth.uid(), 'admin'));