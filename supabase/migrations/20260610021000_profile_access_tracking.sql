-- Contagem de acessos por usuário (estilo Nexus):
-- profiles.access_count incrementa a cada login real (auth.users.last_sign_in_at).
-- Aplicada no projeto remoto em 2026-06-10 via MCP (apply_migration: profile_access_tracking).

alter table public.profiles
  add column if not exists access_count integer not null default 0,
  add column if not exists last_access_at timestamptz;

create or replace function public.handle_auth_user_sign_in()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set access_count = access_count + 1,
      last_access_at = new.last_sign_in_at
  where id = new.id;
  return new;
end;
$$;

revoke all on function public.handle_auth_user_sign_in() from public, anon, authenticated;

drop trigger if exists on_auth_user_sign_in on auth.users;
create trigger on_auth_user_sign_in
  after update of last_sign_in_at on auth.users
  for each row
  when (old.last_sign_in_at is distinct from new.last_sign_in_at)
  execute function public.handle_auth_user_sign_in();

-- Backfill: quem já logou alguma vez começa com 1 acesso e a data do último login.
update public.profiles p
set last_access_at = u.last_sign_in_at,
    access_count = greatest(p.access_count, 1)
from auth.users u
where u.id = p.id
  and u.last_sign_in_at is not null;
