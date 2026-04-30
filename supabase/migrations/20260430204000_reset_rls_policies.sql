do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'organizations',
        'profiles',
        'organization_members',
        'sites',
        'wbs_items',
        'daily_reports',
        'report_activities',
        'report_workforce',
        'report_equipment',
        'media',
        'notifications',
        'comments'
      )
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;

  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname in (
        'members read media objects',
        'writers manage media objects',
        'users read own avatar objects',
        'users manage own avatar objects',
        'admins read export objects'
      )
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end $$;

create policy "members read organizations" on public.organizations
  for select using (id in (select public.current_user_orgs()));

create policy "admins manage organizations" on public.organizations
  for all using (id in (select public.current_user_admin_orgs()))
  with check (id in (select public.current_user_admin_orgs()));

create policy "members read visible profiles" on public.profiles
  for select using (public.can_access_profile(id));

create policy "users update own profile" on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

create policy "members read organization memberships" on public.organization_members
  for select using (organization_id in (select public.current_user_orgs()));

create policy "admins manage organization memberships" on public.organization_members
  for all using (organization_id in (select public.current_user_admin_orgs()))
  with check (organization_id in (select public.current_user_admin_orgs()));

create policy "members read sites" on public.sites
  for select using (organization_id in (select public.current_user_orgs()));

create policy "writers manage sites" on public.sites
  for all using (organization_id in (select public.current_user_writer_orgs()))
  with check (organization_id in (select public.current_user_writer_orgs()));

create policy "members read wbs items" on public.wbs_items
  for select using (public.can_access_site(site_id));

create policy "writers manage wbs items" on public.wbs_items
  for all using (public.can_write_site(site_id))
  with check (public.can_write_site(site_id));

create policy "members read daily reports" on public.daily_reports
  for select using (public.can_access_site(site_id));

create policy "writers manage daily reports" on public.daily_reports
  for all using (public.can_write_site(site_id))
  with check (public.can_write_site(site_id));

create policy "members read report activities" on public.report_activities
  for select using (public.can_access_daily_report(daily_report_id));

create policy "writers manage report activities" on public.report_activities
  for all using (public.can_write_daily_report(daily_report_id))
  with check (public.can_write_daily_report(daily_report_id));

create policy "members read report workforce" on public.report_workforce
  for select using (public.can_access_daily_report(daily_report_id));

create policy "writers manage report workforce" on public.report_workforce
  for all using (public.can_write_daily_report(daily_report_id))
  with check (public.can_write_daily_report(daily_report_id));

create policy "members read report equipment" on public.report_equipment
  for select using (public.can_access_daily_report(daily_report_id));

create policy "writers manage report equipment" on public.report_equipment
  for all using (public.can_write_daily_report(daily_report_id))
  with check (public.can_write_daily_report(daily_report_id));

create policy "members read media" on public.media
  for select using (public.can_access_site(site_id));

create policy "writers manage media" on public.media
  for all using (public.can_write_site(site_id))
  with check (public.can_write_site(site_id));

create policy "recipients read notifications" on public.notifications
  for select using (
    recipient_id = auth.uid()
    and organization_id in (select public.current_user_orgs())
  );

create policy "members update own notifications" on public.notifications
  for update using (
    recipient_id = auth.uid()
    and organization_id in (select public.current_user_orgs())
  )
  with check (
    recipient_id = auth.uid()
    and organization_id in (select public.current_user_orgs())
  );

create policy "members read comments" on public.comments
  for select using (organization_id in (select public.current_user_orgs()));

create policy "members create comments" on public.comments
  for insert with check (
    author_id = auth.uid()
    and organization_id in (select public.current_user_orgs())
  );

create policy "authors update comments" on public.comments
  for update using (author_id = auth.uid())
  with check (author_id = auth.uid());

create policy "members read media objects" on storage.objects
  for select using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] in (
      select org_id::text from public.current_user_orgs() as org_id
    )
  );

create policy "writers manage media objects" on storage.objects
  for all using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] in (
      select org_id::text from public.current_user_writer_orgs() as org_id
    )
  )
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] in (
      select org_id::text from public.current_user_writer_orgs() as org_id
    )
  );

create policy "users read own avatar objects" on storage.objects
  for select using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users manage own avatar objects" on storage.objects
  for all using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "admins read export objects" on storage.objects
  for select using (
    bucket_id = 'exports'
    and (storage.foldername(name))[1] in (
      select org_id::text from public.current_user_admin_orgs() as org_id
    )
  );
