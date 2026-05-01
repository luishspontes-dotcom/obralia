alter table public.sites
  add column if not exists external_provider text,
  add column if not exists external_id text,
  add column if not exists external_url text,
  add column if not exists last_synced_at timestamptz,
  add column if not exists sync_metadata jsonb not null default '{}'::jsonb;

alter table public.wbs_items
  add column if not exists external_provider text,
  add column if not exists external_id text,
  add column if not exists external_url text,
  add column if not exists last_synced_at timestamptz,
  add column if not exists sync_metadata jsonb not null default '{}'::jsonb;

alter table public.daily_reports
  add column if not exists external_provider text,
  add column if not exists external_id text,
  add column if not exists external_url text,
  add column if not exists last_synced_at timestamptz,
  add column if not exists sync_metadata jsonb not null default '{}'::jsonb;

alter table public.media
  add column if not exists external_provider text,
  add column if not exists external_id text,
  add column if not exists external_url text,
  add column if not exists last_synced_at timestamptz,
  add column if not exists sync_metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sites_external_provider_check') then
    alter table public.sites
      add constraint sites_external_provider_check
      check (external_provider is null or external_provider in ('clickup', 'diario_de_obra', 'manual', 'import'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'wbs_items_external_provider_check') then
    alter table public.wbs_items
      add constraint wbs_items_external_provider_check
      check (external_provider is null or external_provider in ('clickup', 'diario_de_obra', 'manual', 'import'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'daily_reports_external_provider_check') then
    alter table public.daily_reports
      add constraint daily_reports_external_provider_check
      check (external_provider is null or external_provider in ('clickup', 'diario_de_obra', 'manual', 'import'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'media_external_provider_check') then
    alter table public.media
      add constraint media_external_provider_check
      check (external_provider is null or external_provider in ('clickup', 'diario_de_obra', 'manual', 'import'));
  end if;
end;
$$;

create unique index if not exists sites_external_provider_id_key
  on public.sites (organization_id, external_provider, external_id)
  where external_provider is not null and external_id is not null;

create unique index if not exists wbs_items_external_provider_id_key
  on public.wbs_items (site_id, external_provider, external_id)
  where external_provider is not null and external_id is not null;

create unique index if not exists daily_reports_external_provider_id_key
  on public.daily_reports (site_id, external_provider, external_id)
  where external_provider is not null and external_id is not null;

create unique index if not exists media_external_provider_id_key
  on public.media (site_id, external_provider, external_id)
  where external_provider is not null and external_id is not null;

create table if not exists public.external_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  provider text not null check (provider in ('clickup', 'diario_de_obra')),
  label text not null,
  external_account_id text,
  status text not null default 'not_configured'
    check (status in ('not_configured', 'connected', 'needs_auth', 'syncing', 'error', 'disabled')),
  last_sync_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists external_accounts_organization_provider_label_key
  on public.external_accounts (organization_id, provider, lower(label));

create index if not exists external_accounts_organization_status_idx
  on public.external_accounts (organization_id, provider, status);

create table if not exists public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  external_account_id uuid references public.external_accounts(id) on delete set null,
  provider text not null check (provider in ('clickup', 'diario_de_obra')),
  scope text not null default 'manual'
    check (scope in ('manual', 'scheduled', 'backfill', 'import', 'audit')),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'success', 'partial', 'failed', 'cancelled')),
  started_at timestamptz,
  finished_at timestamptz,
  requested_by uuid references public.profiles(id),
  stats jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists sync_runs_organization_created_idx
  on public.sync_runs (organization_id, created_at desc);

create index if not exists sync_runs_external_account_created_idx
  on public.sync_runs (external_account_id, created_at desc);

alter table public.external_accounts enable row level security;
alter table public.sync_runs enable row level security;

grant select, insert, update, delete on public.external_accounts to authenticated;
grant select, insert, update, delete on public.sync_runs to authenticated;

drop policy if exists "admins read external accounts" on public.external_accounts;
create policy "admins read external accounts" on public.external_accounts
  for select using (organization_id in (select public.current_user_admin_orgs()));

drop policy if exists "admins manage external accounts" on public.external_accounts;
create policy "admins manage external accounts" on public.external_accounts
  for all using (organization_id in (select public.current_user_admin_orgs()))
  with check (
    organization_id in (select public.current_user_admin_orgs())
    and (created_by is null or created_by = auth.uid())
  );

drop policy if exists "admins read sync runs" on public.sync_runs;
create policy "admins read sync runs" on public.sync_runs
  for select using (organization_id in (select public.current_user_admin_orgs()));

drop policy if exists "admins manage sync runs" on public.sync_runs;
create policy "admins manage sync runs" on public.sync_runs
  for all using (organization_id in (select public.current_user_admin_orgs()))
  with check (
    organization_id in (select public.current_user_admin_orgs())
    and (requested_by is null or requested_by = auth.uid())
  );

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_external_accounts_touch_updated_at on public.external_accounts;
create trigger on_external_accounts_touch_updated_at
  before update on public.external_accounts
  for each row execute function public.touch_updated_at();

create or replace function public.audit_external_account_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_org uuid;
  target_id uuid;
  target_provider text;
  target_status text;
begin
  if tg_op = 'DELETE' then
    target_org := old.organization_id;
    target_id := old.id;
    target_provider := old.provider;
    target_status := old.status;
  else
    target_org := new.organization_id;
    target_id := new.id;
    target_provider := new.provider;
    target_status := new.status;
  end if;

  perform public.audit_log_event(
    target_org,
    auth.uid(),
    'external_account.' || lower(tg_op),
    'external_accounts',
    target_id,
    'Integracao ' || target_provider || ' alterada',
    jsonb_build_object('provider', target_provider, 'status', target_status)
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists on_external_accounts_audit on public.external_accounts;
create trigger on_external_accounts_audit
  after insert or update or delete on public.external_accounts
  for each row execute function public.audit_external_account_changes();

create or replace function public.audit_sync_run_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.status = old.status then
    return new;
  end if;

  perform public.audit_log_event(
    new.organization_id,
    auth.uid(),
    'sync_run.' || new.status,
    'sync_runs',
    new.id,
    'Sincronizacao ' || new.provider || ' ' || new.status,
    jsonb_build_object('provider', new.provider, 'scope', new.scope, 'stats', new.stats)
  );

  return new;
end;
$$;

drop trigger if exists on_sync_runs_audit on public.sync_runs;
create trigger on_sync_runs_audit
  after insert or update of status on public.sync_runs
  for each row execute function public.audit_sync_run_changes();
