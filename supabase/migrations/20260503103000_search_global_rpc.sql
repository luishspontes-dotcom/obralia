create or replace function public.search_global(q text, max_per_kind integer default 10)
returns table (
  kind text,
  id text,
  title text,
  subtitle text,
  link text,
  match_rank numeric
)
language sql
stable
set search_path = public
as $$
  with params as (
    select
      trim(q) as query,
      greatest(1, least(coalesce(max_per_kind, 10), 50)) as limit_count
  )
  select * from (
    select
      'obra'::text as kind,
      s.id::text as id,
      s.name as title,
      concat_ws(' · ', nullif(s.client_name, ''), nullif(s.address, ''), s.status) as subtitle,
      '/obras/' || s.id::text as link,
      case
        when lower(s.name) = lower(p.query) then 100
        when s.name ilike p.query || '%' then 90
        else 70
      end::numeric as match_rank
    from public.sites s
    cross join params p
    where length(p.query) >= 2
      and s.organization_id = any(public.current_user_orgs())
      and (
        s.name ilike '%' || p.query || '%'
        or coalesce(s.client_name, '') ilike '%' || p.query || '%'
        or coalesce(s.address, '') ilike '%' || p.query || '%'
        or coalesce(s.status, '') ilike '%' || p.query || '%'
      )
    order by match_rank desc, s.name
    limit (select limit_count from params)
  ) obras

  union all

  select * from (
    select
      'tarefa'::text as kind,
      w.id::text as id,
      w.name as title,
      concat_ws(' · ', s.name, nullif(w.code, ''), nullif(w.status, '')) as subtitle,
      '/obras/' || w.site_id::text as link,
      case
        when lower(w.name) = lower(p.query) then 95
        when w.name ilike p.query || '%' then 85
        else 65
      end::numeric as match_rank
    from public.wbs_items w
    join public.sites s on s.id = w.site_id
    cross join params p
    where length(p.query) >= 2
      and s.organization_id = any(public.current_user_orgs())
      and (
        w.name ilike '%' || p.query || '%'
        or coalesce(w.code, '') ilike '%' || p.query || '%'
        or coalesce(w.status, '') ilike '%' || p.query || '%'
        or s.name ilike '%' || p.query || '%'
      )
    order by match_rank desc, w.name
    limit (select limit_count from params)
  ) tarefas

  union all

  select * from (
    select
      'rdo'::text as kind,
      dr.id::text as id,
      'RDO #' || dr.number::text || ' · ' || s.name as title,
      concat_ws(' · ', dr.date::text, nullif(dr.status, ''), nullif(dr.general_notes, '')) as subtitle,
      '/obras/' || dr.site_id::text || '/rdos/' || dr.id::text as link,
      case
        when dr.number::text = p.query then 90
        when s.name ilike p.query || '%' then 80
        else 60
      end::numeric as match_rank
    from public.daily_reports dr
    join public.sites s on s.id = dr.site_id
    cross join params p
    where length(p.query) >= 2
      and s.organization_id = any(public.current_user_orgs())
      and (
        dr.number::text ilike '%' || p.query || '%'
        or dr.date::text ilike '%' || p.query || '%'
        or coalesce(dr.status, '') ilike '%' || p.query || '%'
        or coalesce(dr.general_notes, '') ilike '%' || p.query || '%'
        or s.name ilike '%' || p.query || '%'
      )
    order by match_rank desc, dr.date desc, dr.number desc
    limit (select limit_count from params)
  ) rdos

  union all

  select * from (
    select
      'comentario'::text as kind,
      c.id::text as id,
      left(c.body, 90) as title,
      concat_ws(' · ', c.target_table, c.created_at::date::text) as subtitle,
      '/comentarios' as link,
      50::numeric as match_rank
    from public.comments c
    cross join params p
    where length(p.query) >= 2
      and c.organization_id = any(public.current_user_orgs())
      and c.body ilike '%' || p.query || '%'
    order by c.created_at desc
    limit (select limit_count from params)
  ) comentarios;
$$;

grant execute on function public.search_global(text, integer) to authenticated;
