\set ON_ERROR_STOP on

do $verify$
declare
  v_bad integer;
  v_track_threads integer;
  v_bound integer;
  v_legacy integer;
  v_duplicate_bound integer;
  v_non_track_duplicate_slug integer;
  v_read_def text;
  v_write_def text;
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid =
      'public.community_threads'::regclass
      and conname =
        'community_threads_entity_type_entity_slug_key'
  ) then
    raise exception
      'Global community thread slug uniqueness still exists';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'community_threads'
      and indexname =
        'community_threads_non_track_entity_slug_key'
      and indexdef ilike
        '%unique%where ((entity_type <> ''track''::text) and (entity_slug is not null))%'
  ) then
    raise exception
      'Non-Track partial slug uniqueness is missing';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid =
      'public.community_threads'::regclass
      and conname =
        'community_threads_entity_type_entity_id_key'
  ) then
    raise exception
      'Canonical community entity ID uniqueness is missing';
  end if;

  select pg_get_functiondef(p.oid)
  into v_read_def
  from pg_proc p
  join pg_namespace n
    on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname =
      'community_get_thread_by_entity'
    and pg_get_function_identity_arguments(p.oid) =
      'p_entity_type text, p_entity_id text, p_entity_slug text';

  if v_read_def is null
     or position(
       'registry_tracks' in
       v_read_def
     ) = 0
     or position(
       'thread.entity_id = v_track_id::text' in
       v_read_def
     ) = 0 then
    raise exception
      'Track thread read authority is not Registry-ID-first';
  end if;

  select pg_get_functiondef(p.oid)
  into v_write_def
  from pg_proc p
  join pg_namespace n
    on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname =
      'community_get_or_create_thread'
    and pg_get_function_identity_arguments(p.oid) =
      'p_entity_type text, p_entity_id text, p_entity_slug text, p_entity_url text, p_title text';

  if v_write_def is null
     or position(
       'v_canonical_track_id' in
       v_write_def
     ) = 0
     or position(
       'registry_track_artists' in
       v_write_def
     ) = 0
     or position(
       'thread.entity_id = v_canonical_track_id::text' in
       regexp_replace(
         v_write_def,
         '[[:space:]]+',
         ' ',
         'g'
       )
     ) = 0 then
    raise exception
      'Track thread create authority is not Registry-ID-first';
  end if;

  if has_function_privilege(
    'anon',
    'public.community_get_or_create_thread(text,text,text,text,text)',
    'EXECUTE'
  ) then
    raise exception
      'Anonymous users can execute community_get_or_create_thread';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.community_get_or_create_thread(text,text,text,text,text)',
    'EXECUTE'
  ) then
    raise exception
      'Authenticated users lost community_get_or_create_thread';
  end if;

  if not has_function_privilege(
    'anon',
    'public.community_get_thread_by_entity(text,text,text)',
    'EXECUTE'
  ) then
    raise exception
      'Anonymous users lost community_get_thread_by_entity';
  end if;

  select count(*)
  into v_non_track_duplicate_slug
  from (
    select entity_type, entity_slug
    from public.community_threads
    where entity_type <> 'track'
      and entity_slug is not null
    group by entity_type, entity_slug
    having count(*) > 1
  ) duplicate;

  if v_non_track_duplicate_slug <> 0 then
    raise exception
      'Non-Track community slug uniqueness drifted';
  end if;

  select
    count(*) filter (
      where thread.entity_type = 'track'
    ),
    count(*) filter (
      where thread.entity_type = 'track'
        and track.id is not null
    ),
    count(*) filter (
      where thread.entity_type = 'track'
        and track.id is null
    )
  into
    v_track_threads,
    v_bound,
    v_legacy
  from public.community_threads thread
  left join public.registry_tracks track
    on track.id::text = thread.entity_id;

  select count(*)
  into v_duplicate_bound
  from (
    select thread.entity_id
    from public.community_threads thread
    join public.registry_tracks track
      on track.id::text = thread.entity_id
    where thread.entity_type = 'track'
    group by thread.entity_id
    having count(*) > 1
  ) duplicate;

  if v_duplicate_bound <> 0 then
    raise exception
      'More than one Track thread is bound to the same Registry Track ID';
  end if;

  raise notice
    'Community Track identity sealed: total %, Registry-bound %, legacy-unbound %',
    v_track_threads,
    v_bound,
    v_legacy;
end;
$verify$;

select
  'community_track_registry_identity_pass' as verification,
  count(*) filter (
    where thread.entity_type = 'track'
  )::integer as track_threads,
  count(*) filter (
    where thread.entity_type = 'track'
      and track.id is not null
  )::integer as registry_bound_track_threads,
  count(*) filter (
    where thread.entity_type = 'track'
      and track.id is null
  )::integer as legacy_unbound_track_threads
from public.community_threads thread
left join public.registry_tracks track
  on track.id::text = thread.entity_id;
