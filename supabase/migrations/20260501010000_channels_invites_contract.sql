alter table public.profiles
  add column if not exists is_platform_admin boolean;

update public.profiles
set is_platform_admin = false
where is_platform_admin is null;

alter table public.profiles
  alter column is_platform_admin set default false,
  alter column is_platform_admin set not null;

create table if not exists public.channels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  slug text not null,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create unique index if not exists channels_organization_slug_key
  on public.channels (organization_id, slug);

create table if not exists public.pending_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  email text not null,
  role text not null check (role in ('admin', 'engineer', 'viewer')),
  full_name text,
  invited_by uuid references public.profiles(id),
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists pending_invites_email_organization_id_key
  on public.pending_invites (email, organization_id);

create index if not exists pending_invites_active_email_idx
  on public.pending_invites (lower(email))
  where consumed_at is null;

alter table public.channels enable row level security;
alter table public.pending_invites enable row level security;

grant select, insert, update, delete on public.channels to authenticated;
grant select, insert, update, delete on public.pending_invites to authenticated;

create or replace function public.consume_pending_invites_for_user(
  target_user_id uuid,
  target_email text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text := lower(trim(coalesce(target_email, '')));
  invite record;
begin
  if target_user_id is null or normalized_email = '' then
    return;
  end if;

  insert into public.profiles (id, full_name)
  values (target_user_id, split_part(normalized_email, '@', 1))
  on conflict (id) do nothing;

  for invite in
    select id, organization_id, role, full_name
    from public.pending_invites
    where lower(email) = normalized_email
      and consumed_at is null
    for update skip locked
  loop
    insert into public.organization_members (organization_id, profile_id, role)
    values (invite.organization_id, target_user_id, invite.role)
    on conflict (organization_id, profile_id) do update
      set role = case
        when public.organization_members.role in ('owner', 'admin')
          then public.organization_members.role
        else excluded.role
      end;

    update public.profiles
    set
      default_org_id = coalesce(default_org_id, invite.organization_id),
      full_name = case
        when invite.full_name is not null
          and (
            full_name = split_part(normalized_email, '@', 1)
            or full_name = 'Usuário'
          )
          then invite.full_name
        else full_name
      end
    where id = target_user_id;

    update public.pending_invites
    set consumed_at = now()
    where id = invite.id
      and consumed_at is null;
  end loop;
end;
$$;

revoke all on function public.consume_pending_invites_for_user(uuid, text)
  from public, anon, authenticated;

create or replace function public.consume_pending_invites()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.consume_pending_invites_for_user(
    auth.uid(),
    auth.jwt() ->> 'email'
  );
end;
$$;

grant execute on function public.consume_pending_invites() to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text := lower(trim(coalesce(new.email, '')));
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(split_part(normalized_email, '@', 1), ''),
      'Usuário'
    )
  )
  on conflict (id) do nothing;

  perform public.consume_pending_invites_for_user(new.id, normalized_email);

  return new;
end;
$$;

drop policy if exists "members read channels" on public.channels;
create policy "members read channels" on public.channels
  for select using (organization_id in (select public.current_user_orgs()));

drop policy if exists "admins manage channels" on public.channels;
create policy "admins manage channels" on public.channels
  for all using (organization_id in (select public.current_user_admin_orgs()))
  with check (organization_id in (select public.current_user_admin_orgs()));

drop policy if exists "admins manage pending invites" on public.pending_invites;
create policy "admins manage pending invites" on public.pending_invites
  for all using (organization_id in (select public.current_user_admin_orgs()))
  with check (
    organization_id in (select public.current_user_admin_orgs())
    and (invited_by is null or invited_by = auth.uid())
  );
