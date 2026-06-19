-- Paridade Obralia x Diario (Fase A) — TUDO ADITIVO. Nao altera RLS de tabelas
-- existentes, nao apaga nada. Reune o que falta de schema para a paridade:
--   * Usuarios: matriz de permissoes, cargo, rotulo de perfil, acesso por obra.
--   * Criar obra: responsavel (texto), tipo de contrato, grupo da obra.
--   * RDO: clima da Noite e indice pluviometrico (mm).
-- Aplicar uma vez. Tudo IF NOT EXISTS — pode rodar de novo sem problema.

-- ===== CRIAR OBRA (sites) =====
alter table public.sites
  add column if not exists responsible_name text;
alter table public.sites
  add column if not exists contract_type text;
alter table public.sites
  add column if not exists site_group text;

-- ===== RDO (daily_reports): clima da Noite + indice pluviometrico =====
alter table public.daily_reports
  add column if not exists weather_night text;
alter table public.daily_reports
  add column if not exists condition_night text;
alter table public.daily_reports
  add column if not exists rain_mm numeric;

-- ===== USUARIOS (organization_members + member_site_access) =====
-- 1) Matriz de permissoes por membro (dominio x acao), como JSONB.

-- 1) Matriz de permissoes por membro (dominio x acao), como JSONB.
--    Ex.: {"cadastros":{"ver":true,"editar":false,"excluir":false}, "obras":{...}, ...}
alter table public.organization_members
  add column if not exists permissions jsonb not null default '{}'::jsonb;

-- 2) Cargo (o Diario tem "Cargo", ex.: Engenheiro).
alter table public.organization_members
  add column if not exists job_title text;

-- 3) Rotulo do perfil de acesso do Diario (Administrador / Personalizado / Cliente Obra).
alter table public.organization_members
  add column if not exists profile_label text;

-- 4) Acesso por obra: quais obras cada usuario pode acessar ("Obras que pode acessar").
create table if not exists public.member_site_access (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (organization_id, profile_id, site_id)
);

create index if not exists member_site_access_profile_idx on public.member_site_access (profile_id);
create index if not exists member_site_access_site_idx on public.member_site_access (site_id);

-- RLS apenas na tabela NOVA (nao toca nas demais). Espelha as policies de
-- organization_members: membros da org leem; owner/admin gerenciam.
alter table public.member_site_access enable row level security;

drop policy if exists "members read site access" on public.member_site_access;
create policy "members read site access" on public.member_site_access
  for select using (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = member_site_access.organization_id
        and m.profile_id = auth.uid()
    )
  );

drop policy if exists "admins manage site access" on public.member_site_access;
create policy "admins manage site access" on public.member_site_access
  for all using (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = member_site_access.organization_id
        and m.profile_id = auth.uid()
        and m.role in ('owner','admin')
    )
  ) with check (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = member_site_access.organization_id
        and m.profile_id = auth.uid()
        and m.role in ('owner','admin')
    )
  );
