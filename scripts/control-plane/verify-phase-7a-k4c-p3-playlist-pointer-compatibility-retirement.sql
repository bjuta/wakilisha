-- HISTORICAL CHECKPOINT VERIFIER ONLY.
-- This script proves the named migration checkpoint, not the current post-kernel end state.
-- For current authority use scripts/control-plane/verify-phase-7a-kernel-closure.sql.
-- Phase 7A K4C-P3 permanent read-only verifier.

do $phase_7a_k4c_p3_verify$
declare
  v_count bigint;
  v_definition text;
begin
  select count(*)
  into v_count
  from information_schema.columns
  where table_schema = 'editorial'
    and table_name = 'playlist_resources'
    and column_name in (
      'current_working_version_id',
      'current_submitted_version_id',
      'current_approved_version_id',
      'current_published_version_id'
    );

  if v_count <> 0 then
    raise exception
      'K4C-P3: Playlist typed pointer columns remain';
  end if;

  if exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid =
            'editorial.playlist_resources'::regclass
      and trigger_row.tgname =
            'playlist_resources_sync_shared_lifecycle'
      and not trigger_row.tgisinternal
  ) then
    raise exception
      'K4C-P3: Playlist typed-to-Resource trigger remains';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid =
            'editorial.audio_publication_resources'::regclass
      and trigger_row.tgname =
            'audio_publication_resources_sync_shared_lifecycle'
      and trigger_row.tgfoid =
            'editorial.sync_resource_lifecycle_from_typed_binding()'::regprocedure
      and not trigger_row.tgisinternal
  ) then
    raise exception
      'K4C-P3: Audio typed-to-Resource compatibility trigger is missing';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid =
            'editorial.resources'::regclass
      and trigger_row.tgname =
            'resources_sync_typed_lifecycle_compatibility'
      and trigger_row.tgfoid =
            'editorial.sync_typed_lifecycle_from_resource()'::regprocedure
      and not trigger_row.tgisinternal
  ) then
    raise exception
      'K4C-P3: shared Resource-to-typed Audio compatibility trigger is missing';
  end if;

  if md5(
    pg_get_functiondef(
      'editorial.sync_resource_lifecycle_from_typed_binding()'::regprocedure
    )
  ) <> '1a9a366b7a26d023aa589767a2024651' then
    raise exception
      'K4C-P3: shared typed-to-Resource Audio helper changed';
  end if;

  if md5(
    pg_get_functiondef(
      'editorial.sync_typed_lifecycle_from_resource()'::regprocedure
    )
  ) <> '619a2bd22f9066594f84dada7a119902' then
    raise exception
      'K4C-P3: Audio-only Resource-to-typed helper definition drifted';
  end if;

  select pg_get_functiondef(
    'editorial.sync_typed_lifecycle_from_resource()'::regprocedure
  )
  into v_definition;

  if v_definition ilike '%editorial.playlist_resources%'
     or v_definition ilike '%resource_kind = ''playlist''%'
     or v_definition not ilike '%editorial.audio_publication_resources%'
     or v_definition not ilike '%''audio_episode''%'
     or v_definition not ilike '%''standalone_audio''%'
  then
    raise exception
      'K4C-P3: Resource-to-typed compatibility is not Audio-only';
  end if;

  select count(*)
  into v_count
  from information_schema.columns
  where table_schema = 'editorial'
    and table_name = 'audio_publication_resources'
    and column_name in (
      'current_working_version_id',
      'current_submitted_version_id',
      'current_approved_version_id',
      'current_published_version_id'
    );

  if v_count <> 4 then
    raise exception
      'K4C-P3: Audio typed pointer columns changed';
  end if;

  select count(*)
  into v_count
  from editorial.audio_publication_resources binding
  join editorial.resources resource
    on resource.id = binding.resource_id
  where (
    binding.current_working_version_id,
    binding.current_submitted_version_id,
    binding.current_approved_version_id,
    binding.current_published_version_id
  ) is distinct from (
    resource.current_working_version_id,
    resource.current_submitted_version_id,
    resource.current_approved_version_id,
    resource.current_published_version_id
  );

  if v_count <> 0 then
    raise exception
      'K4C-P3: Audio pointer parity drift exists';
  end if;

  if exists (
    select 1
    from pg_proc procedure_row
    where procedure_row.prokind in ('f', 'p')
      and pg_get_functiondef(procedure_row.oid)
        ilike '%editorial.playlist_resources%'
      and pg_get_functiondef(procedure_row.oid)
        ~* '\mv_binding\.current_(working|submitted|approved|published)_version_id\M'
  ) then
    raise exception
      'K4C-P3: a v_binding Playlist typed pointer reader remains';
  end if;

  select pg_get_functiondef(
    'public.save_resource_version_editorial_metadata(text,uuid,bigint,uuid[],uuid[],text,text,text[],text,text,uuid)'::regprocedure
  )
  into v_definition;

  if position(
       E'    select resource.current_working_version_id into v_current_working_version_id\n'
       || E'    from editorial.resources resource\n'
       in v_definition
     ) = 0
     or position(
       E'    select binding.current_working_version_id into v_current_working_version_id\n'
       || E'    from editorial.audio_publication_resources binding\n'
       in v_definition
     ) = 0
  then
    raise exception
      'K4C-P3: shared metadata Playlist/Audio authority boundary is incorrect';
  end if;

  if exists (
    with function_definitions as (
      select
        procedure_row.oid,
        pg_get_functiondef(procedure_row.oid) as definition
      from pg_proc procedure_row
      join pg_namespace namespace_row
        on namespace_row.oid = procedure_row.pronamespace
      where procedure_row.prokind in ('f', 'p')
        and namespace_row.nspname not in (
          'pg_catalog',
          'information_schema'
        )
        and procedure_row.oid <>
          'public.save_resource_version_editorial_metadata(text,uuid,bigint,uuid[],uuid[],text,text,text[],text,text,uuid)'::regprocedure
    ),
    playlist_aliases as (
      select
        function_definitions.oid,
        function_definitions.definition,
        lower(alias_match[1]) as alias_name
      from function_definitions
      cross join lateral regexp_matches(
        function_definitions.definition,
        '(?:from|join)[[:space:]]+editorial[.]playlist_resources(?:[[:space:]]+(?:as[[:space:]]+)?)?([a-zA-Z_][a-zA-Z0-9_]*)',
        'gi'
      ) alias_match
    )
    select 1
    from playlist_aliases
    where definition ~* (
      '\m'
      || alias_name
      || '\.current_(working|submitted|approved|published)_version_id\M'
    )
  ) then
    raise exception
      'K4C-P3: direct Playlist typed pointer alias reader remains';
  end if;

  if exists (
    select 1
    from pg_proc procedure_row
    where procedure_row.prokind in ('f', 'p')
      and pg_get_functiondef(procedure_row.oid)
        ~* 'insert[[:space:]]+into[[:space:]]+editorial[.]playlist_(review|lifecycle)_events'
  ) then
    raise exception
      'K4C-P3: typed Playlist event authority regressed';
  end if;

  if to_regclass('video.publication_review_events') is not null
     or to_regclass('video.publication_lifecycle_events') is not null
  then
    raise exception
      'K4C-P3: typed Video event authority regressed';
  end if;
end;
$phase_7a_k4c_p3_verify$;

select
  'PHASE_7A_K4C_P3_PLAYLIST_POINTER_COMPATIBILITY_RETIREMENT_PASS'
    as verification_result,
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'editorial'
      and table_name = 'playlist_resources'
      and column_name in (
        'current_working_version_id',
        'current_submitted_version_id',
        'current_approved_version_id',
        'current_published_version_id'
      )
  ) as playlist_typed_pointer_column_count,
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'editorial'
      and table_name = 'audio_publication_resources'
      and column_name in (
        'current_working_version_id',
        'current_submitted_version_id',
        'current_approved_version_id',
        'current_published_version_id'
      )
  ) as audio_typed_pointer_column_count;
