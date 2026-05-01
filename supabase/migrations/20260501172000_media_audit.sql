create or replace function public.audit_media_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  site_record record;
  action_name text;
  summary_text text;
begin
  select name, organization_id
  into site_record
  from public.sites
  where id = new.site_id;

  if site_record.organization_id is null then
    return new;
  end if;

  action_name := case new.kind
    when 'photo' then 'media.photo_created'
    when 'video' then 'media.video_created'
    when 'audio' then 'media.audio_created'
    else 'media.file_created'
  end;

  summary_text := case new.kind
    when 'photo' then 'Foto adicionada em ' || site_record.name
    when 'video' then 'Vídeo adicionado em ' || site_record.name
    when 'audio' then 'Áudio adicionado em ' || site_record.name
    else 'Arquivo adicionado em ' || site_record.name
  end;

  perform public.audit_log_event(
    site_record.organization_id,
    coalesce(new.taken_by, auth.uid()),
    action_name,
    'media',
    new.id,
    summary_text,
    jsonb_build_object(
      'site_id', new.site_id,
      'daily_report_id', new.daily_report_id,
      'kind', new.kind,
      'caption', new.caption,
      'size_bytes', new.size_bytes,
      'storage_path', new.storage_path
    )
  );

  return new;
end;
$$;

drop trigger if exists on_media_audit on public.media;
create trigger on_media_audit
  after insert on public.media
  for each row execute function public.audit_media_created();
