create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  actor_id uuid references public.profiles(id),
  action text not null,
  target_table text not null,
  target_id uuid,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_organization_created_idx
  on public.audit_events (organization_id, created_at desc);

create index if not exists audit_events_actor_created_idx
  on public.audit_events (actor_id, created_at desc)
  where actor_id is not null;

alter table public.audit_events enable row level security;

grant select on public.audit_events to authenticated;

drop policy if exists "admins read audit events" on public.audit_events;
create policy "admins read audit events" on public.audit_events
  for select using (organization_id in (select public.current_user_admin_orgs()));

create or replace function public.audit_log_event(
  p_organization_id uuid,
  p_actor_id uuid,
  p_action text,
  p_target_table text,
  p_target_id uuid,
  p_summary text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_organization_id is null or p_action is null or p_target_table is null then
    return;
  end if;

  insert into public.audit_events (
    organization_id,
    actor_id,
    action,
    target_table,
    target_id,
    summary,
    metadata
  )
  values (
    p_organization_id,
    p_actor_id,
    p_action,
    p_target_table,
    p_target_id,
    coalesce(nullif(p_summary, ''), p_action),
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.audit_log_event(
  uuid,
  uuid,
  text,
  text,
  uuid,
  text,
  jsonb
) from public, anon, authenticated;

create or replace function public.audit_site_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.audit_log_event(
      new.organization_id,
      auth.uid(),
      'site.created',
      'sites',
      new.id,
      'Obra criada: ' || new.name,
      jsonb_build_object('name', new.name, 'status', new.status)
    );
    return new;
  end if;

  if old.status is distinct from new.status then
    perform public.audit_log_event(
      new.organization_id,
      auth.uid(),
      'site.status_changed',
      'sites',
      new.id,
      'Status da obra alterado: ' || new.name,
      jsonb_build_object('from', old.status, 'to', new.status)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists on_sites_audit on public.sites;
create trigger on_sites_audit
  after insert or update of status on public.sites
  for each row execute function public.audit_site_changes();

create or replace function public.audit_daily_report_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  site_record record;
  audit_action text;
  audit_summary text;
begin
  select name, organization_id
  into site_record
  from public.sites
  where id = new.site_id;

  if site_record.organization_id is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    perform public.audit_log_event(
      site_record.organization_id,
      new.created_by,
      'daily_report.created',
      'daily_reports',
      new.id,
      'RDO #' || new.number || ' criado em ' || site_record.name,
      jsonb_build_object('site_id', new.site_id, 'date', new.date, 'status', new.status)
    );
    return new;
  end if;

  if old.status is distinct from new.status then
    audit_action := case new.status
      when 'review' then 'daily_report.submitted'
      when 'approved' then 'daily_report.approved'
      else 'daily_report.status_changed'
    end;

    audit_summary := case new.status
      when 'review' then 'RDO #' || new.number || ' enviado para revisão'
      when 'approved' then 'RDO #' || new.number || ' aprovado'
      else 'Status do RDO #' || new.number || ' alterado'
    end;

    perform public.audit_log_event(
      site_record.organization_id,
      coalesce(auth.uid(), new.approved_by, new.created_by),
      audit_action,
      'daily_reports',
      new.id,
      audit_summary,
      jsonb_build_object(
        'site_id', new.site_id,
        'from', old.status,
        'to', new.status,
        'approved_by', new.approved_by,
        'approved_at', new.approved_at
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists on_daily_reports_audit on public.daily_reports;
create trigger on_daily_reports_audit
  after insert or update of status on public.daily_reports
  for each row execute function public.audit_daily_report_changes();

create or replace function public.audit_pending_invite_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.audit_log_event(
      new.organization_id,
      new.invited_by,
      'invite.created',
      'pending_invites',
      new.id,
      'Convite criado para ' || new.email,
      jsonb_build_object('email', new.email, 'role', new.role)
    );
    return new;
  end if;

  if old.consumed_at is null and new.consumed_at is not null then
    perform public.audit_log_event(
      new.organization_id,
      new.invited_by,
      'invite.consumed',
      'pending_invites',
      new.id,
      'Convite aceito por ' || new.email,
      jsonb_build_object('email', new.email, 'role', new.role)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists on_pending_invites_audit on public.pending_invites;
create trigger on_pending_invites_audit
  after insert or update of consumed_at on public.pending_invites
  for each row execute function public.audit_pending_invite_changes();
