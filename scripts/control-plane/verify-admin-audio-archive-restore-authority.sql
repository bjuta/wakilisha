do $verify$
begin
  if to_regclass('audio.publication_lifecycle_events') is null then
    raise exception 'missing audio publication lifecycle events';
  end if;
  if to_regprocedure('public.archive_audio_publication(uuid,bigint,text,text,uuid)') is null then
    raise exception 'missing archive_audio_publication';
  end if;
  if to_regprocedure('public.restore_audio_publication_from_archive(uuid,bigint,text,text,uuid)') is null then
    raise exception 'missing restore_audio_publication_from_archive';
  end if;
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'audio.publication_lifecycle_events'::regclass
      and tgname = 'audio_publication_lifecycle_events_append_only'
      and not tgisinternal
  ) then
    raise exception 'audio lifecycle append-only trigger missing';
  end if;
  if has_table_privilege('anon', 'audio.publication_lifecycle_events', 'select') then
    raise exception 'anon may select audio lifecycle events directly';
  end if;
  if has_function_privilege('anon', 'public.archive_audio_publication(uuid,bigint,text,text,uuid)', 'execute') then
    raise exception 'anon can archive Audio';
  end if;
  if has_function_privilege('anon', 'public.restore_audio_publication_from_archive(uuid,bigint,text,text,uuid)', 'execute') then
    raise exception 'anon can restore Audio';
  end if;
end;
$verify$;

select 'ADMIN_AUDIO_ARCHIVE_RESTORE_AUTHORITY_PASS' as verifier;
