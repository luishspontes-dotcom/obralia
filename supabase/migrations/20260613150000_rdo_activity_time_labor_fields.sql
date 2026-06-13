-- F2 v2: campos por atividade do RDO (hora início/fim e mão de obra).
-- Aditivo e reversível. Já aplicado no banco via MCP em 2026-06-13.
alter table public.report_activities
  add column if not exists start_time text,
  add column if not exists end_time text,
  add column if not exists labor text;
