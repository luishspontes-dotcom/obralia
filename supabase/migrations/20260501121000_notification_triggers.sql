create or replace function public.notify_daily_report_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  site_record record;
begin
  select id, name, organization_id
  into site_record
  from public.sites
  where id = new.site_id;

  if site_record.organization_id is null then
    return new;
  end if;

  insert into public.notifications (
    recipient_id,
    organization_id,
    kind,
    title,
    body,
    link,
    related_table,
    related_id
  )
  select
    member.profile_id,
    site_record.organization_id,
    'daily_report.created',
    'Novo RDO #' || new.number,
    site_record.name || ' · ' || to_char(new.date, 'DD/MM/YYYY'),
    '/obras/' || new.site_id || '/rdos/' || new.id,
    'daily_reports',
    new.id
  from public.organization_members member
  where member.organization_id = site_record.organization_id
    and member.role in ('owner', 'admin')
    and member.profile_id is distinct from new.created_by;

  return new;
end;
$$;

drop trigger if exists on_daily_report_created_notify on public.daily_reports;
create trigger on_daily_report_created_notify
  after insert on public.daily_reports
  for each row execute function public.notify_daily_report_created();

create or replace function public.notify_comment_mentions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.mentions is null or array_length(new.mentions, 1) is null then
    return new;
  end if;

  insert into public.notifications (
    recipient_id,
    organization_id,
    kind,
    title,
    body,
    link,
    related_table,
    related_id
  )
  select
    mentioned_profile_id,
    new.organization_id,
    'comment.mention',
    'Você foi mencionado',
    left(new.body, 180),
    case
      when new.target_table = 'channel' then '/canal/' || coalesce(channel.slug, 'geral')
      else '/comentarios'
    end,
    'comments',
    new.id
  from unnest(new.mentions) as mentioned_profile_id
  left join public.channels channel
    on channel.id = new.target_id
   and channel.organization_id = new.organization_id
  where mentioned_profile_id is distinct from new.author_id
    and exists (
      select 1
      from public.organization_members member
      where member.organization_id = new.organization_id
        and member.profile_id = mentioned_profile_id
    );

  return new;
end;
$$;

drop trigger if exists on_comment_mentions_notify on public.comments;
create trigger on_comment_mentions_notify
  after insert on public.comments
  for each row execute function public.notify_comment_mentions();
