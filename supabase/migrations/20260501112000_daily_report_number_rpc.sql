create or replace function public.create_daily_report(
  target_site_id uuid,
  report_date date,
  p_weather_morning text default null,
  p_weather_afternoon text default null,
  p_condition_morning text default null,
  p_condition_afternoon text default null,
  p_general_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  next_number integer;
  inserted_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if public.can_write_site(target_site_id) is not true then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  perform 1
  from public.sites
  where id = target_site_id
  for update;

  select coalesce(max(number), 0) + 1
  into next_number
  from public.daily_reports
  where site_id = target_site_id;

  insert into public.daily_reports (
    site_id,
    number,
    date,
    status,
    weather_morning,
    weather_afternoon,
    condition_morning,
    condition_afternoon,
    general_notes,
    created_by
  )
  values (
    target_site_id,
    next_number,
    report_date,
    'draft',
    nullif(p_weather_morning, ''),
    nullif(p_weather_afternoon, ''),
    nullif(p_condition_morning, ''),
    nullif(p_condition_afternoon, ''),
    nullif(p_general_notes, ''),
    auth.uid()
  )
  returning id into inserted_id;

  return inserted_id;
end;
$$;

grant execute on function public.create_daily_report(
  uuid,
  date,
  text,
  text,
  text,
  text,
  text
) to authenticated;
