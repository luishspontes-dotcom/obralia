create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  logo_url text,
  brand_color text default '#08789B',
  plan text default 'starter',
  created_at timestamptz default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  avatar_url text,
  default_org_id uuid references public.organizations(id),
  created_at timestamptz default now()
);

create table if not exists public.organization_members (
  organization_id uuid references public.organizations(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'engineer', 'viewer')),
  created_at timestamptz default now(),
  primary key (organization_id, profile_id)
);

create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  name text not null,
  cover_url text,
  status text not null default 'in_progress'
    check (status in ('not_started', 'in_progress', 'paused', 'done')),
  client_name text,
  responsible_id uuid references public.profiles(id),
  address text,
  contract_number text,
  contract_days integer,
  start_date date,
  end_date date,
  created_at timestamptz default now()
);

create table if not exists public.wbs_items (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.sites(id) on delete cascade not null,
  parent_id uuid references public.wbs_items(id) on delete cascade,
  code text not null,
  name text not null,
  weight numeric default 0,
  status text default 'waiting'
    check (status in ('waiting', 'in_progress', 'late', 'paused', 'done')),
  assignee_id uuid references public.profiles(id),
  start_date date,
  due_date date,
  progress_pct numeric default 0 check (progress_pct >= 0 and progress_pct <= 100),
  position integer default 0,
  created_at timestamptz default now()
);

create table if not exists public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.sites(id) on delete cascade not null,
  number integer not null,
  date date not null,
  status text default 'draft' check (status in ('draft', 'review', 'approved')),
  weather_morning text,
  weather_afternoon text,
  condition_morning text,
  condition_afternoon text,
  general_notes text,
  created_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz default now(),
  unique (site_id, number)
);

create table if not exists public.report_activities (
  id uuid primary key default gen_random_uuid(),
  daily_report_id uuid references public.daily_reports(id) on delete cascade not null,
  wbs_item_id uuid references public.wbs_items(id),
  description text not null,
  progress_pct numeric default 0 check (progress_pct >= 0 and progress_pct <= 100),
  notes text
);

create table if not exists public.report_workforce (
  id uuid primary key default gen_random_uuid(),
  daily_report_id uuid references public.daily_reports(id) on delete cascade not null,
  role text not null,
  count integer not null check (count >= 0)
);

create table if not exists public.report_equipment (
  id uuid primary key default gen_random_uuid(),
  daily_report_id uuid references public.daily_reports(id) on delete cascade not null,
  name text not null,
  hours numeric default 0 check (hours >= 0)
);

create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.sites(id) on delete cascade not null,
  daily_report_id uuid references public.daily_reports(id) on delete set null,
  wbs_item_id uuid references public.wbs_items(id) on delete set null,
  kind text not null check (kind in ('photo', 'video', 'audio', 'file')),
  storage_path text not null,
  thumbnail_path text,
  caption text,
  taken_at timestamptz,
  taken_by uuid references public.profiles(id),
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  width integer check (width is null or width >= 0),
  height integer check (height is null or height >= 0),
  gps_lat numeric,
  gps_lng numeric,
  created_at timestamptz default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references public.profiles(id) on delete cascade not null,
  organization_id uuid references public.organizations(id) on delete cascade not null,
  kind text not null,
  title text not null,
  body text,
  link text,
  related_table text,
  related_id uuid,
  read_at timestamptz,
  snoozed_until timestamptz,
  archived_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  author_id uuid references public.profiles(id) not null,
  target_table text not null,
  target_id uuid not null,
  body text not null,
  mentions uuid[] default array[]::uuid[],
  created_at timestamptz default now()
);

create index if not exists sites_organization_status_idx
  on public.sites (organization_id, status);
create index if not exists wbs_items_site_parent_position_idx
  on public.wbs_items (site_id, parent_id, position);
create index if not exists daily_reports_site_date_idx
  on public.daily_reports (site_id, date desc);
create index if not exists report_activities_daily_report_idx
  on public.report_activities (daily_report_id);
create index if not exists report_workforce_daily_report_idx
  on public.report_workforce (daily_report_id);
create index if not exists report_equipment_daily_report_idx
  on public.report_equipment (daily_report_id);
create index if not exists media_site_taken_at_idx
  on public.media (site_id, taken_at desc);
create index if not exists notifications_recipient_idx
  on public.notifications (recipient_id, archived_at, read_at, created_at desc);
create index if not exists comments_organization_target_idx
  on public.comments (organization_id, target_table, target_id, created_at desc);

create or replace function public.current_user_orgs()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id
  from public.organization_members
  where profile_id = auth.uid()
$$;

create or replace function public.current_user_writer_orgs()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id
  from public.organization_members
  where profile_id = auth.uid()
    and role in ('owner', 'admin', 'engineer')
$$;

create or replace function public.current_user_admin_orgs()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id
  from public.organization_members
  where profile_id = auth.uid()
    and role in ('owner', 'admin')
$$;

create or replace function public.can_access_profile(target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() = target_profile_id
    or exists (
      select 1
      from public.organization_members current_member
      join public.organization_members target_member
        on target_member.organization_id = current_member.organization_id
      where current_member.profile_id = auth.uid()
        and target_member.profile_id = target_profile_id
    )
$$;

create or replace function public.can_access_site(target_site_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.sites
    where id = target_site_id
      and organization_id in (select public.current_user_orgs())
  )
$$;

create or replace function public.can_write_site(target_site_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.sites
    where id = target_site_id
      and organization_id in (select public.current_user_writer_orgs())
  )
$$;

create or replace function public.can_access_daily_report(target_daily_report_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.daily_reports dr
    join public.sites s on s.id = dr.site_id
    where dr.id = target_daily_report_id
      and s.organization_id in (select public.current_user_orgs())
  )
$$;

create or replace function public.can_write_daily_report(target_daily_report_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.daily_reports dr
    join public.sites s on s.id = dr.site_id
    where dr.id = target_daily_report_id
      and s.organization_id in (select public.current_user_writer_orgs())
  )
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      split_part(new.email, '@', 1),
      'Usuário'
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;
alter table public.sites enable row level security;
alter table public.wbs_items enable row level security;
alter table public.daily_reports enable row level security;
alter table public.report_activities enable row level security;
alter table public.report_workforce enable row level security;
alter table public.report_equipment enable row level security;
alter table public.media enable row level security;
alter table public.notifications enable row level security;
alter table public.comments enable row level security;

drop policy if exists "members read organizations" on public.organizations;
create policy "members read organizations" on public.organizations
  for select using (id in (select public.current_user_orgs()));

drop policy if exists "admins manage organizations" on public.organizations;
create policy "admins manage organizations" on public.organizations
  for all using (id in (select public.current_user_admin_orgs()))
  with check (id in (select public.current_user_admin_orgs()));

drop policy if exists "members read visible profiles" on public.profiles;
create policy "members read visible profiles" on public.profiles
  for select using (public.can_access_profile(id));

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "members read organization memberships" on public.organization_members;
create policy "members read organization memberships" on public.organization_members
  for select using (organization_id in (select public.current_user_orgs()));

drop policy if exists "admins manage organization memberships" on public.organization_members;
create policy "admins manage organization memberships" on public.organization_members
  for all using (organization_id in (select public.current_user_admin_orgs()))
  with check (organization_id in (select public.current_user_admin_orgs()));

drop policy if exists "members read sites" on public.sites;
create policy "members read sites" on public.sites
  for select using (organization_id in (select public.current_user_orgs()));

drop policy if exists "writers manage sites" on public.sites;
create policy "writers manage sites" on public.sites
  for all using (organization_id in (select public.current_user_writer_orgs()))
  with check (organization_id in (select public.current_user_writer_orgs()));

drop policy if exists "members read wbs items" on public.wbs_items;
create policy "members read wbs items" on public.wbs_items
  for select using (public.can_access_site(site_id));

drop policy if exists "writers manage wbs items" on public.wbs_items;
create policy "writers manage wbs items" on public.wbs_items
  for all using (public.can_write_site(site_id))
  with check (public.can_write_site(site_id));

drop policy if exists "members read daily reports" on public.daily_reports;
create policy "members read daily reports" on public.daily_reports
  for select using (public.can_access_site(site_id));

drop policy if exists "writers manage daily reports" on public.daily_reports;
create policy "writers manage daily reports" on public.daily_reports
  for all using (public.can_write_site(site_id))
  with check (public.can_write_site(site_id));

drop policy if exists "members read report activities" on public.report_activities;
create policy "members read report activities" on public.report_activities
  for select using (public.can_access_daily_report(daily_report_id));

drop policy if exists "writers manage report activities" on public.report_activities;
create policy "writers manage report activities" on public.report_activities
  for all using (public.can_write_daily_report(daily_report_id))
  with check (public.can_write_daily_report(daily_report_id));

drop policy if exists "members read report workforce" on public.report_workforce;
create policy "members read report workforce" on public.report_workforce
  for select using (public.can_access_daily_report(daily_report_id));

drop policy if exists "writers manage report workforce" on public.report_workforce;
create policy "writers manage report workforce" on public.report_workforce
  for all using (public.can_write_daily_report(daily_report_id))
  with check (public.can_write_daily_report(daily_report_id));

drop policy if exists "members read report equipment" on public.report_equipment;
create policy "members read report equipment" on public.report_equipment
  for select using (public.can_access_daily_report(daily_report_id));

drop policy if exists "writers manage report equipment" on public.report_equipment;
create policy "writers manage report equipment" on public.report_equipment
  for all using (public.can_write_daily_report(daily_report_id))
  with check (public.can_write_daily_report(daily_report_id));

drop policy if exists "members read media" on public.media;
create policy "members read media" on public.media
  for select using (public.can_access_site(site_id));

drop policy if exists "writers manage media" on public.media;
create policy "writers manage media" on public.media
  for all using (public.can_write_site(site_id))
  with check (public.can_write_site(site_id));

drop policy if exists "recipients read notifications" on public.notifications;
create policy "recipients read notifications" on public.notifications
  for select using (
    recipient_id = auth.uid()
    and organization_id in (select public.current_user_orgs())
  );

drop policy if exists "members update own notifications" on public.notifications;
create policy "members update own notifications" on public.notifications
  for update using (
    recipient_id = auth.uid()
    and organization_id in (select public.current_user_orgs())
  )
  with check (
    recipient_id = auth.uid()
    and organization_id in (select public.current_user_orgs())
  );

drop policy if exists "members read comments" on public.comments;
create policy "members read comments" on public.comments
  for select using (organization_id in (select public.current_user_orgs()));

drop policy if exists "members create comments" on public.comments;
create policy "members create comments" on public.comments
  for insert with check (
    author_id = auth.uid()
    and organization_id in (select public.current_user_orgs())
  );

drop policy if exists "authors update comments" on public.comments;
create policy "authors update comments" on public.comments
  for update using (author_id = auth.uid())
  with check (author_id = auth.uid());

insert into storage.buckets (id, name, public)
values
  ('media', 'media', false),
  ('avatars', 'avatars', false),
  ('exports', 'exports', false)
on conflict (id) do nothing;

drop policy if exists "members read media objects" on storage.objects;
create policy "members read media objects" on storage.objects
  for select using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] in (
      select org_id::text from public.current_user_orgs() as org_id
    )
  );

drop policy if exists "writers manage media objects" on storage.objects;
create policy "writers manage media objects" on storage.objects
  for all using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] in (
      select org_id::text from public.current_user_writer_orgs() as org_id
    )
  )
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] in (
      select org_id::text from public.current_user_writer_orgs() as org_id
    )
  );

drop policy if exists "users read own avatar objects" on storage.objects;
create policy "users read own avatar objects" on storage.objects
  for select using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "users manage own avatar objects" on storage.objects;
create policy "users manage own avatar objects" on storage.objects
  for all using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "admins read export objects" on storage.objects;
create policy "admins read export objects" on storage.objects
  for select using (
    bucket_id = 'exports'
    and (storage.foldername(name))[1] in (
      select org_id::text from public.current_user_admin_orgs() as org_id
    )
  );
