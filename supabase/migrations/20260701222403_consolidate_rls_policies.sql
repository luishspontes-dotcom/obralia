-- Consolida policies RLS: substitui policies FOR ALL (que duplicavam o SELECT
-- com as policies "members read") por policies separadas INSERT/UPDATE/DELETE.
-- Resolve 188 lints multiple_permissive_policies + 2 auth_rls_initplan.
-- Aplicada em producao via MCP em 2026-07-01 (version 20260701222403).

-- ============ Padrao writer orgs ============
drop policy "writers manage ai estimate files" on public.ai_estimate_files;
create policy "writers insert ai estimate files" on public.ai_estimate_files for insert with check (organization_id in (select current_user_writer_orgs()));
create policy "writers update ai estimate files" on public.ai_estimate_files for update using (organization_id in (select current_user_writer_orgs())) with check (organization_id in (select current_user_writer_orgs()));
create policy "writers delete ai estimate files" on public.ai_estimate_files for delete using (organization_id in (select current_user_writer_orgs()));

drop policy "writers manage ai estimate items" on public.ai_estimate_items;
create policy "writers insert ai estimate items" on public.ai_estimate_items for insert with check (organization_id in (select current_user_writer_orgs()));
create policy "writers update ai estimate items" on public.ai_estimate_items for update using (organization_id in (select current_user_writer_orgs())) with check (organization_id in (select current_user_writer_orgs()));
create policy "writers delete ai estimate items" on public.ai_estimate_items for delete using (organization_id in (select current_user_writer_orgs()));

drop policy "writers manage ai estimates" on public.ai_estimates;
create policy "writers insert ai estimates" on public.ai_estimates for insert with check (organization_id in (select current_user_writer_orgs()));
create policy "writers update ai estimates" on public.ai_estimates for update using (organization_id in (select current_user_writer_orgs())) with check (organization_id in (select current_user_writer_orgs()));
create policy "writers delete ai estimates" on public.ai_estimates for delete using (organization_id in (select current_user_writer_orgs()));

drop policy "writers manage ai extracted facts" on public.ai_extracted_facts;
create policy "writers insert ai extracted facts" on public.ai_extracted_facts for insert with check (organization_id in (select current_user_writer_orgs()));
create policy "writers update ai extracted facts" on public.ai_extracted_facts for update using (organization_id in (select current_user_writer_orgs())) with check (organization_id in (select current_user_writer_orgs()));
create policy "writers delete ai extracted facts" on public.ai_extracted_facts for delete using (organization_id in (select current_user_writer_orgs()));

drop policy "writers manage budget rates" on public.budget_rates;
create policy "writers insert budget rates" on public.budget_rates for insert with check (organization_id in (select current_user_writer_orgs()));
create policy "writers update budget rates" on public.budget_rates for update using (organization_id in (select current_user_writer_orgs())) with check (organization_id in (select current_user_writer_orgs()));
create policy "writers delete budget rates" on public.budget_rates for delete using (organization_id in (select current_user_writer_orgs()));

drop policy "writers manage medicoes" on public.medicoes;
create policy "writers insert medicoes" on public.medicoes for insert with check (organization_id in (select current_user_writer_orgs()));
create policy "writers update medicoes" on public.medicoes for update using (organization_id in (select current_user_writer_orgs())) with check (organization_id in (select current_user_writer_orgs()));
create policy "writers delete medicoes" on public.medicoes for delete using (organization_id in (select current_user_writer_orgs()));

drop policy "writers manage sites" on public.sites;
create policy "writers insert sites" on public.sites for insert with check (organization_id in (select current_user_writer_orgs()));
create policy "writers update sites" on public.sites for update using (organization_id in (select current_user_writer_orgs())) with check (organization_id in (select current_user_writer_orgs()));
create policy "writers delete sites" on public.sites for delete using (organization_id in (select current_user_writer_orgs()));

drop policy "writers manage rdo templates" on public.rdo_templates;
create policy "writers insert rdo templates" on public.rdo_templates for insert to authenticated with check (organization_id in (select current_user_writer_orgs()));
create policy "writers update rdo templates" on public.rdo_templates for update to authenticated using (organization_id in (select current_user_writer_orgs())) with check (organization_id in (select current_user_writer_orgs()));
create policy "writers delete rdo templates" on public.rdo_templates for delete to authenticated using (organization_id in (select current_user_writer_orgs()));

-- ============ Padrao can_write_* ============
drop policy "writers manage budget items" on public.budget_items;
create policy "writers insert budget items" on public.budget_items for insert with check (can_write_budget(budget_id));
create policy "writers update budget items" on public.budget_items for update using (can_write_budget(budget_id)) with check (can_write_budget(budget_id));
create policy "writers delete budget items" on public.budget_items for delete using (can_write_budget(budget_id));

drop policy "writers manage budgets" on public.budgets;
create policy "writers insert budgets" on public.budgets for insert with check (can_write_site(site_id));
create policy "writers update budgets" on public.budgets for update using (can_write_site(site_id)) with check (can_write_site(site_id));
create policy "writers delete budgets" on public.budgets for delete using (can_write_site(site_id));

drop policy "writers manage daily reports" on public.daily_reports;
create policy "writers insert daily reports" on public.daily_reports for insert with check (can_write_site(site_id));
create policy "writers update daily reports" on public.daily_reports for update using (can_write_site(site_id)) with check (can_write_site(site_id));
create policy "writers delete daily reports" on public.daily_reports for delete using (can_write_site(site_id));

drop policy "writers manage media" on public.media;
create policy "writers insert media" on public.media for insert with check (can_write_site(site_id));
create policy "writers update media" on public.media for update using (can_write_site(site_id)) with check (can_write_site(site_id));
create policy "writers delete media" on public.media for delete using (can_write_site(site_id));

drop policy "writers manage wbs items" on public.wbs_items;
create policy "writers insert wbs items" on public.wbs_items for insert with check (can_write_site(site_id));
create policy "writers update wbs items" on public.wbs_items for update using (can_write_site(site_id)) with check (can_write_site(site_id));
create policy "writers delete wbs items" on public.wbs_items for delete using (can_write_site(site_id));

drop policy "writers manage report activities" on public.report_activities;
create policy "writers insert report activities" on public.report_activities for insert with check (can_write_daily_report(daily_report_id));
create policy "writers update report activities" on public.report_activities for update using (can_write_daily_report(daily_report_id)) with check (can_write_daily_report(daily_report_id));
create policy "writers delete report activities" on public.report_activities for delete using (can_write_daily_report(daily_report_id));

drop policy "writers manage report equipment" on public.report_equipment;
create policy "writers insert report equipment" on public.report_equipment for insert with check (can_write_daily_report(daily_report_id));
create policy "writers update report equipment" on public.report_equipment for update using (can_write_daily_report(daily_report_id)) with check (can_write_daily_report(daily_report_id));
create policy "writers delete report equipment" on public.report_equipment for delete using (can_write_daily_report(daily_report_id));

drop policy "writers manage report workforce" on public.report_workforce;
create policy "writers insert report workforce" on public.report_workforce for insert with check (can_write_daily_report(daily_report_id));
create policy "writers update report workforce" on public.report_workforce for update using (can_write_daily_report(daily_report_id)) with check (can_write_daily_report(daily_report_id));
create policy "writers delete report workforce" on public.report_workforce for delete using (can_write_daily_report(daily_report_id));

drop policy "writers manage report materials" on public.report_materials;
create policy "writers insert report materials" on public.report_materials for insert to authenticated with check (exists (select 1 from daily_reports dr join sites s on s.id = dr.site_id where dr.id = report_materials.daily_report_id and s.organization_id in (select current_user_writer_orgs())));
create policy "writers update report materials" on public.report_materials for update to authenticated using (exists (select 1 from daily_reports dr join sites s on s.id = dr.site_id where dr.id = report_materials.daily_report_id and s.organization_id in (select current_user_writer_orgs()))) with check (exists (select 1 from daily_reports dr join sites s on s.id = dr.site_id where dr.id = report_materials.daily_report_id and s.organization_id in (select current_user_writer_orgs())));
create policy "writers delete report materials" on public.report_materials for delete to authenticated using (exists (select 1 from daily_reports dr join sites s on s.id = dr.site_id where dr.id = report_materials.daily_report_id and s.organization_id in (select current_user_writer_orgs())));

drop policy "writers manage medicao items" on public.medicao_items;
create policy "writers insert medicao items" on public.medicao_items for insert with check (medicao_id in (select id from medicoes where organization_id in (select current_user_writer_orgs())));
create policy "writers update medicao items" on public.medicao_items for update using (medicao_id in (select id from medicoes where organization_id in (select current_user_writer_orgs()))) with check (medicao_id in (select id from medicoes where organization_id in (select current_user_writer_orgs())));
create policy "writers delete medicao items" on public.medicao_items for delete using (medicao_id in (select id from medicoes where organization_id in (select current_user_writer_orgs())));

-- ============ Padrao admin orgs ============
drop policy "admins manage budget template items" on public.budget_template_items;
create policy "admins insert budget template items" on public.budget_template_items for insert with check (exists (select 1 from budget_templates t where t.id = budget_template_items.template_id and t.organization_id in (select current_user_admin_orgs())));
create policy "admins update budget template items" on public.budget_template_items for update using (exists (select 1 from budget_templates t where t.id = budget_template_items.template_id and t.organization_id in (select current_user_admin_orgs()))) with check (exists (select 1 from budget_templates t where t.id = budget_template_items.template_id and t.organization_id in (select current_user_admin_orgs())));
create policy "admins delete budget template items" on public.budget_template_items for delete using (exists (select 1 from budget_templates t where t.id = budget_template_items.template_id and t.organization_id in (select current_user_admin_orgs())));

drop policy "admins manage budget templates" on public.budget_templates;
create policy "admins insert budget templates" on public.budget_templates for insert with check (organization_id in (select current_user_admin_orgs()));
create policy "admins update budget templates" on public.budget_templates for update using (organization_id in (select current_user_admin_orgs())) with check (organization_id in (select current_user_admin_orgs()));
create policy "admins delete budget templates" on public.budget_templates for delete using (organization_id in (select current_user_admin_orgs()));

drop policy "admins manage contacts" on public.contacts;
create policy "admins insert contacts" on public.contacts for insert with check (organization_id in (select current_user_admin_orgs()));
create policy "admins update contacts" on public.contacts for update using (organization_id in (select current_user_admin_orgs())) with check (organization_id in (select current_user_admin_orgs()));
create policy "admins delete contacts" on public.contacts for delete using (organization_id in (select current_user_admin_orgs()));

drop policy "admins manage organization memberships" on public.organization_members;
create policy "admins insert organization memberships" on public.organization_members for insert with check (organization_id in (select current_user_admin_orgs()));
create policy "admins update organization memberships" on public.organization_members for update using (organization_id in (select current_user_admin_orgs())) with check (organization_id in (select current_user_admin_orgs()));
create policy "admins delete organization memberships" on public.organization_members for delete using (organization_id in (select current_user_admin_orgs()));

drop policy "admins manage organizations" on public.organizations;
create policy "admins insert organizations" on public.organizations for insert with check (id in (select current_user_admin_orgs()));
create policy "admins update organizations" on public.organizations for update using (id in (select current_user_admin_orgs())) with check (id in (select current_user_admin_orgs()));
create policy "admins delete organizations" on public.organizations for delete using (id in (select current_user_admin_orgs()));

drop policy "admins manage wa senders" on public.whatsapp_senders;
create policy "admins insert wa senders" on public.whatsapp_senders for insert with check (organization_id in (select current_user_admin_orgs()));
create policy "admins update wa senders" on public.whatsapp_senders for update using (organization_id in (select current_user_admin_orgs())) with check (organization_id in (select current_user_admin_orgs()));
create policy "admins delete wa senders" on public.whatsapp_senders for delete using (organization_id in (select current_user_admin_orgs()));

-- channels: tinha DUAS policies ALL de admin (redundantes) + read
drop policy "admins write channels" on public.channels;
drop policy "admins manage channels" on public.channels;
create policy "admins insert channels" on public.channels for insert with check (organization_id in (select current_user_admin_orgs()));
create policy "admins update channels" on public.channels for update using (organization_id in (select current_user_admin_orgs())) with check (organization_id in (select current_user_admin_orgs()));
create policy "admins delete channels" on public.channels for delete using (organization_id in (select current_user_admin_orgs()));

-- ============ Admin orgs com with_check estendido (autoria) ============
drop policy "admins manage external accounts" on public.external_accounts;
create policy "admins insert external accounts" on public.external_accounts for insert with check ((organization_id in (select current_user_admin_orgs())) and (created_by is null or created_by = (select auth.uid())));
create policy "admins update external accounts" on public.external_accounts for update using (organization_id in (select current_user_admin_orgs())) with check ((organization_id in (select current_user_admin_orgs())) and (created_by is null or created_by = (select auth.uid())));
create policy "admins delete external accounts" on public.external_accounts for delete using (organization_id in (select current_user_admin_orgs()));

drop policy "admins manage pending invites" on public.pending_invites;
create policy "admins insert pending invites" on public.pending_invites for insert with check ((organization_id in (select current_user_admin_orgs())) and (invited_by is null or invited_by = (select auth.uid())));
create policy "admins update pending invites" on public.pending_invites for update using (organization_id in (select current_user_admin_orgs())) with check ((organization_id in (select current_user_admin_orgs())) and (invited_by is null or invited_by = (select auth.uid())));
create policy "admins delete pending invites" on public.pending_invites for delete using (organization_id in (select current_user_admin_orgs()));

drop policy "admins manage share links" on public.share_links;
create policy "admins insert share links" on public.share_links for insert with check ((organization_id in (select current_user_admin_orgs())) and (created_by is null or created_by = (select auth.uid())));
create policy "admins update share links" on public.share_links for update using (organization_id in (select current_user_admin_orgs())) with check ((organization_id in (select current_user_admin_orgs())) and (created_by is null or created_by = (select auth.uid())));
create policy "admins delete share links" on public.share_links for delete using (organization_id in (select current_user_admin_orgs()));

drop policy "admins manage sync runs" on public.sync_runs;
create policy "admins insert sync runs" on public.sync_runs for insert with check ((organization_id in (select current_user_admin_orgs())) and (requested_by is null or requested_by = (select auth.uid())));
create policy "admins update sync runs" on public.sync_runs for update using (organization_id in (select current_user_admin_orgs())) with check ((organization_id in (select current_user_admin_orgs())) and (requested_by is null or requested_by = (select auth.uid())));
create policy "admins delete sync runs" on public.sync_runs for delete using (organization_id in (select current_user_admin_orgs()));

-- ============ member_site_access: split + fix auth_rls_initplan ============
drop policy "admins manage site access" on public.member_site_access;
drop policy "members read site access" on public.member_site_access;
create policy "members read site access" on public.member_site_access for select using (exists (select 1 from organization_members m where m.organization_id = member_site_access.organization_id and m.profile_id = (select auth.uid())));
create policy "admins insert site access" on public.member_site_access for insert with check (exists (select 1 from organization_members m where m.organization_id = member_site_access.organization_id and m.profile_id = (select auth.uid()) and m.role in ('owner','admin')));
create policy "admins update site access" on public.member_site_access for update using (exists (select 1 from organization_members m where m.organization_id = member_site_access.organization_id and m.profile_id = (select auth.uid()) and m.role in ('owner','admin'))) with check (exists (select 1 from organization_members m where m.organization_id = member_site_access.organization_id and m.profile_id = (select auth.uid()) and m.role in ('owner','admin')));
create policy "admins delete site access" on public.member_site_access for delete using (exists (select 1 from organization_members m where m.organization_id = member_site_access.organization_id and m.profile_id = (select auth.uid()) and m.role in ('owner','admin')));
