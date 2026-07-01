-- current_user_can_access_site: usada apenas na policy "members read sites".
-- Rota publica /p/[token] usa service role (bypassa RLS); anon nunca a executa.
-- Revoga do PUBLIC (grant default) e do anon; mantem authenticated + service_role.
-- Aplicada em producao via MCP em 2026-07-01.
revoke execute on function public.current_user_can_access_site(uuid, uuid) from public;
revoke execute on function public.current_user_can_access_site(uuid, uuid) from anon;
grant execute on function public.current_user_can_access_site(uuid, uuid) to authenticated;
grant execute on function public.current_user_can_access_site(uuid, uuid) to service_role;
