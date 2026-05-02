do $$
begin
  alter table public.sites drop constraint if exists sites_external_provider_check;
  alter table public.sites
    add constraint sites_external_provider_check
    check (external_provider is null or external_provider in ('clickup', 'diario_de_obra', 'asana', 'manual', 'import'));

  alter table public.wbs_items drop constraint if exists wbs_items_external_provider_check;
  alter table public.wbs_items
    add constraint wbs_items_external_provider_check
    check (external_provider is null or external_provider in ('clickup', 'diario_de_obra', 'asana', 'manual', 'import'));

  alter table public.daily_reports drop constraint if exists daily_reports_external_provider_check;
  alter table public.daily_reports
    add constraint daily_reports_external_provider_check
    check (external_provider is null or external_provider in ('clickup', 'diario_de_obra', 'asana', 'manual', 'import'));

  alter table public.media drop constraint if exists media_external_provider_check;
  alter table public.media
    add constraint media_external_provider_check
    check (external_provider is null or external_provider in ('clickup', 'diario_de_obra', 'asana', 'manual', 'import'));

  alter table public.external_accounts drop constraint if exists external_accounts_provider_check;
  alter table public.external_accounts
    add constraint external_accounts_provider_check
    check (provider in ('clickup', 'diario_de_obra', 'asana'));

  alter table public.sync_runs drop constraint if exists sync_runs_provider_check;
  alter table public.sync_runs
    add constraint sync_runs_provider_check
    check (provider in ('clickup', 'diario_de_obra', 'asana'));
end;
$$;
