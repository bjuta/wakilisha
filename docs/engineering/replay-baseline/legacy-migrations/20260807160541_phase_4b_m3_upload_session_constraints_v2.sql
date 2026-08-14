begin;

do $phase_4b_m3_upload_session_constraint_preflight$
declare
  v_size text;
  v_parts text;
  v_extension text;
  v_mime text;
  v_path text;
begin
  select pg_get_constraintdef(c.oid)
  into v_size
  from pg_constraint c
  join pg_class t
    on t.oid = c.conrelid
  join pg_namespace n
    on n.oid = t.relnamespace
  where n.nspname = 'media'
    and t.relname = 'upload_sessions'
    and c.conname =
      'upload_sessions_size_check';

  select pg_get_constraintdef(c.oid)
  into v_parts
  from pg_constraint c
  join pg_class t
    on t.oid = c.conrelid
  join pg_namespace n
    on n.oid = t.relnamespace
  where n.nspname = 'media'
    and t.relname = 'upload_sessions'
    and c.conname =
      'upload_sessions_total_parts_check';

  select pg_get_constraintdef(c.oid)
  into v_extension
  from pg_constraint c
  join pg_class t
    on t.oid = c.conrelid
  join pg_namespace n
    on n.oid = t.relnamespace
  where n.nspname = 'media'
    and t.relname = 'upload_sessions'
    and c.conname =
      'upload_sessions_extension_check';

  select pg_get_constraintdef(c.oid)
  into v_mime
  from pg_constraint c
  join pg_class t
    on t.oid = c.conrelid
  join pg_namespace n
    on n.oid = t.relnamespace
  where n.nspname = 'media'
    and t.relname = 'upload_sessions'
    and c.conname =
      'upload_sessions_mime_check';

  select pg_get_constraintdef(c.oid)
  into v_path
  from pg_constraint c
  join pg_class t
    on t.oid = c.conrelid
  join pg_namespace n
    on n.oid = t.relnamespace
  where n.nspname = 'media'
    and t.relname = 'upload_sessions'
    and c.conname =
      'upload_sessions_path_check';

  if v_size is null
     or position(
       'expected_byte_size > 26214400'
       in v_size
     ) = 0
  then
    raise exception
      'STOP: upload_sessions_size_check changed before migration 204';
  end if;

  if v_parts is null
     or position(
       'total_parts >= 2'
       in v_parts
     ) = 0
  then
    raise exception
      'STOP: upload_sessions_total_parts_check changed before migration 204';
  end if;

  if v_extension is null
     or position(
       'wav'
       in v_extension
     ) = 0
     or position(
       'mp4'
       in v_extension
     ) > 0
  then
    raise exception
      'STOP: upload_sessions_extension_check changed before migration 204';
  end if;

  if v_mime is null
     or position(
       'audio/%'
       in v_mime
     ) = 0
     or position(
       'video/%'
       in v_mime
     ) > 0
  then
    raise exception
      'STOP: upload_sessions_mime_check changed before migration 204';
  end if;

  if v_path is null
     or position(
       'masters/audio/'
       in v_path
     ) = 0
     or position(
       'masters/video/'
       in v_path
     ) > 0
  then
    raise exception
      'STOP: upload_sessions_path_check changed before migration 204';
  end if;

  if to_regprocedure(
       'public.create_media_upload_session_v1(text,text,text,bigint,text,integer,uuid)'
     ) is null
     or to_regprocedure(
       'public.create_media_upload_session_v2(text,text,text,bigint,text,integer,uuid)'
     ) is null
  then
    raise exception
      'STOP: M1/M3 upload-session commands are not both present';
  end if;
end;
$phase_4b_m3_upload_session_constraint_preflight$;


alter table media.upload_sessions
  drop constraint
    upload_sessions_size_check,
  drop constraint
    upload_sessions_total_parts_check,
  drop constraint
    upload_sessions_extension_check,
  drop constraint
    upload_sessions_mime_check,
  drop constraint
    upload_sessions_path_check;


alter table media.upload_sessions
  add constraint
    upload_sessions_size_check
  check (
    expected_byte_size > 0
    and expected_byte_size <= 2147483648
  ),
  add constraint
    upload_sessions_total_parts_check
  check (
    total_parts >= 1
  ),
  add constraint
    upload_sessions_extension_check
  check (
    file_extension = any (
      array[
        'mp3'::text,
        'm4a'::text,
        'aac'::text,
        'wav'::text,
        'flac'::text,
        'ogg'::text,
        'oga'::text,
        'mp4'::text,
        'mov'::text,
        'm4v'::text,
        'webm'::text,
        'mkv'::text
      ]
    )
  ),
  add constraint
    upload_sessions_mime_check
  check (
    mime_type = lower(mime_type)
    and (
      mime_type like 'audio/%'
      or mime_type like 'video/%'
    )
  ),
  add constraint
    upload_sessions_path_check
  check (
    storage_path ~
      '^masters/(audio|video)/[0-9]{4}/[0-9]{2}/[0-9a-f-]{36}\.[a-z0-9]{2,5}$'
  );


do $phase_4b_m3_upload_session_constraint_postcheck$
begin
  if exists (
    select 1
    from media.upload_sessions
    where expected_byte_size <= 0
       or expected_byte_size > 2147483648
       or total_parts < 1
       or file_extension not in (
         'mp3',
         'm4a',
         'aac',
         'wav',
         'flac',
         'ogg',
         'oga',
         'mp4',
         'mov',
         'm4v',
         'webm',
         'mkv'
       )
       or not (
         mime_type like 'audio/%'
         or mime_type like 'video/%'
       )
       or storage_path !~
         '^masters/(audio|video)/[0-9]{4}/[0-9]{2}/[0-9a-f-]{36}\.[a-z0-9]{2,5}$'
  ) then
    raise exception
      'STOP: Existing upload sessions violate the M3 v2 table contract';
  end if;
end;
$phase_4b_m3_upload_session_constraint_postcheck$;


commit;
