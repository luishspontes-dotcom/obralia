revoke all on function public.create_daily_report(
  uuid,
  date,
  text,
  text,
  text,
  text,
  text
) from public, anon;

grant execute on function public.create_daily_report(
  uuid,
  date,
  text,
  text,
  text,
  text,
  text
) to authenticated;
