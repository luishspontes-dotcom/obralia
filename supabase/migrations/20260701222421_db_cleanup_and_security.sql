-- Limpeza: indices duplicados (mantem o canonico de cada par), tabelas de backup orfas.
-- Seguranca: revoga EXECUTE do anon em SECURITY DEFINER, move pg_net pra fora do public.
-- Aplicada em producao via MCP em 2026-07-01 (version 20260701222421).

-- Indices duplicados (9)
drop index if exists public.channels_organization_slug_key; -- twin da constraint channels_organization_id_slug_key
drop index if exists public.idx_rdo_site_date;              -- twin de daily_reports_site_date_idx
drop index if exists public.idx_media_site_taken;           -- twin de media_site_taken_at_idx
drop index if exists public.idx_notif_recipient_status;     -- twin de notifications_recipient_idx (e sem uso)
drop index if exists public.idx_report_activities_rdo;      -- twin de report_activities_daily_report_idx
drop index if exists public.idx_report_equipment_rdo;       -- twin de report_equipment_daily_report_idx (e sem uso)
drop index if exists public.idx_report_workforce_rdo;       -- twin de report_workforce_daily_report_idx
drop index if exists public.idx_sites_org_status;           -- twin de sites_organization_status_idx
drop index if exists public.idx_wbs_site_parent;            -- twin de wbs_items_site_parent_position_idx

-- Tabelas de backup orfas (sem PK, sem policy, flagadas pelos advisors)
drop table if exists public.backup_pending_invites_20260630;
drop table if exists public.backup_sites_status_20260630;
drop table if exists public.backup_wbs_status_20260613;

-- SECURITY DEFINER exposto ao anon via PostgREST
revoke execute on function public.current_user_can_access_site(uuid, uuid) from anon;

-- pg_net fora do schema public (nenhuma funcao/trigger do app usa net.*)
create schema if not exists extensions;
drop extension if exists pg_net;
create extension pg_net with schema extensions;
