begin;
set local transaction read only;
set local statement_timeout = '60s';

do $phase_7a_k4c_p2_verify$
declare
  v_definition text;
  v_count bigint;
begin
  if to_regprocedure(
       'public.snapshot_playlist_working_version(uuid,bigint,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.save_resource_version_editorial_metadata(text,uuid,bigint,uuid[],uuid[],text,text,text[],text,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.publish_playlist_version(uuid,bigint,uuid,text,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.publish_due_playlist_publications(integer)'
     ) is null
     or to_regprocedure(
       'public.unschedule_playlist_publication(uuid,bigint,text,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.unpublish_playlist(uuid,bigint,text,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.archive_playlist(uuid,bigint,text,text,uuid)'
     ) is null
  then
    raise exception
      'PHASE_7A_K4C_P2_FAIL: one or more governed Playlist pointer writers are missing';
  end if;

  select count(*)
  into v_count
  from pg_proc procedure_row
  where procedure_row.prokind in ('f','p')
    and pg_get_functiondef(procedure_row.oid)
      ~* 'update[[:space:]]+editorial[.]playlist_resources'
    and pg_get_functiondef(procedure_row.oid)
      ~* 'current_(working|submitted|approved|published)_version_id'
    and procedure_row.oid
      <> 'editorial.sync_typed_lifecycle_from_resource()'::regprocedure;

  if v_count <> 0 then
    raise exception
      'PHASE_7A_K4C_P2_FAIL: % direct Playlist typed-pointer writer(s) remain',
      v_count;
  end if;

  select pg_get_functiondef(
    'public.snapshot_playlist_working_version(uuid,bigint,text,uuid)'::regprocedure
  )
  into v_definition;

  if v_definition not ilike '%update editorial.resources resource_update%'
     or v_definition not ilike '%set current_working_version_id =%'
     or v_definition ilike '%update editorial.playlist_resources%current_working_version_id%'
  then
    raise exception
      'PHASE_7A_K4C_P2_FAIL: working snapshot is not a canonical Resource pointer writer';
  end if;

  select pg_get_functiondef(
    'public.save_resource_version_editorial_metadata(text,uuid,bigint,uuid[],uuid[],text,text,text[],text,text,uuid)'::regprocedure
  )
  into v_definition;

  if v_definition not ilike '%if p_target_version_type = ''playlist_version'' then%update editorial.resources resource_update%current_working_version_id%'
     or v_definition ilike '%if p_target_version_type = ''playlist_version'' then%update editorial.playlist_resources%'
     or v_definition not ilike '%update editorial.audio_publication_resources binding%current_working_version_id%'
  then
    raise exception
      'PHASE_7A_K4C_P2_FAIL: shared editorial metadata did not converge Playlist only';
  end if;

  select pg_get_functiondef(
    'public.publish_playlist_version(uuid,bigint,uuid,text,text,uuid)'::regprocedure
  )
  into v_definition;

  if v_definition not ilike '%update editorial.resources resource_pointer%current_published_version_id%'
     or v_definition ilike '%update editorial.playlist_resources%current_published_version_id%'
  then
    raise exception
      'PHASE_7A_K4C_P2_FAIL: direct Playlist publish still writes typed published position';
  end if;

  select pg_get_functiondef(
    'public.publish_due_playlist_publications(integer)'::regprocedure
  )
  into v_definition;

  if v_definition not ilike '%update editorial.resources resource_pointer%current_published_version_id%'
     or v_definition ilike '%update editorial.playlist_resources%current_published_version_id%'
  then
    raise exception
      'PHASE_7A_K4C_P2_FAIL: due Playlist publisher still writes typed published position';
  end if;

  select pg_get_functiondef(
    'public.unschedule_playlist_publication(uuid,bigint,text,text,uuid)'::regprocedure
  )
  into v_definition;

  if v_definition not ilike '%update editorial.resources resource_pointer%current_approved_version_id = null%'
     or v_definition ilike '%update editorial.playlist_resources%current_approved_version_id%'
  then
    raise exception
      'PHASE_7A_K4C_P2_FAIL: Playlist unschedule still writes typed approved position';
  end if;

  select pg_get_functiondef(
    'public.unpublish_playlist(uuid,bigint,text,text,uuid)'::regprocedure
  )
  into v_definition;

  if v_definition not ilike '%update editorial.resources resource_pointer%current_approved_version_id = null%'
     or v_definition not ilike '%update editorial.resources resource_pointer%current_published_version_id = null%'
     or v_definition ilike '%update editorial.playlist_resources%current_(approved|published)_version_id%'
  then
    raise exception
      'PHASE_7A_K4C_P2_FAIL: Playlist unpublish still writes typed lifecycle position';
  end if;

  select pg_get_functiondef(
    'public.archive_playlist(uuid,bigint,text,text,uuid)'::regprocedure
  )
  into v_definition;

  if v_definition not ilike '%update editorial.resources resource_pointer%current_published_version_id = null%'
     or v_definition ilike '%update editorial.playlist_resources%current_published_version_id%'
  then
    raise exception
      'PHASE_7A_K4C_P2_FAIL: Playlist archive still writes typed published position';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid = 'editorial.playlist_resources'::regclass
      and trigger_row.tgname = 'playlist_resources_sync_shared_lifecycle'
      and not trigger_row.tgisinternal
  ) or not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid = 'editorial.resources'::regclass
      and trigger_row.tgname = 'resources_sync_typed_lifecycle_compatibility'
      and not trigger_row.tgisinternal
  ) then
    raise exception
      'PHASE_7A_K4C_P2_FAIL: K1 pointer compatibility triggers are missing';
  end if;

  select pg_get_functiondef(
    'editorial.sync_typed_lifecycle_from_resource()'::regprocedure
  )
  into v_definition;

  if v_definition not ilike '%update editorial.playlist_resources%'
     or v_definition not ilike '%audio_publication_resources%'
  then
    raise exception
      'PHASE_7A_K4C_P2_FAIL: shared K1 Resource-to-typed compatibility was narrowed prematurely';
  end if;

  select count(*)
  into v_count
  from editorial.playlist_resources binding
  join editorial.resources resource_row
    on resource_row.id = binding.resource_id
  where (
    binding.current_working_version_id,
    binding.current_submitted_version_id,
    binding.current_approved_version_id,
    binding.current_published_version_id
  ) is distinct from (
    resource_row.current_working_version_id,
    resource_row.current_submitted_version_id,
    resource_row.current_approved_version_id,
    resource_row.current_published_version_id
  );

  if v_count <> 0 then
    raise exception
      'PHASE_7A_K4C_P2_FAIL: % Playlist pointer mirror divergence(s) exist',
      v_count;
  end if;

  if exists (
    select 1
    from pg_proc procedure_row
    where procedure_row.prokind in ('f','p')
      and pg_get_functiondef(procedure_row.oid)
        ~* 'insert[[:space:]]+into[[:space:]]+editorial[.]playlist_(review|lifecycle)_events'
  ) then
    raise exception
      'PHASE_7A_K4C_P2_FAIL: Playlist typed event writer authority reappeared';
  end if;

  if to_regclass('video.publication_review_events') is not null
     or to_regclass('video.publication_lifecycle_events') is not null
  then
    raise exception
      'PHASE_7A_K4C_P2_FAIL: typed Video event authority reappeared';
  end if;

  if exists (
    select 1
    from pg_proc procedure_row
    where procedure_row.oid in (
      'public.snapshot_playlist_working_version(uuid,bigint,text,uuid)'::regprocedure,
      'public.save_resource_version_editorial_metadata(text,uuid,bigint,uuid[],uuid[],text,text,text[],text,text,uuid)'::regprocedure,
      'public.publish_playlist_version(uuid,bigint,uuid,text,text,uuid)'::regprocedure,
      'public.publish_due_playlist_publications(integer)'::regprocedure,
      'public.unschedule_playlist_publication(uuid,bigint,text,text,uuid)'::regprocedure,
      'public.unpublish_playlist(uuid,bigint,text,text,uuid)'::regprocedure,
      'public.archive_playlist(uuid,bigint,text,text,uuid)'::regprocedure
    )
      and not procedure_row.prosecdef
  ) then
    raise exception
      'PHASE_7A_K4C_P2_FAIL: a governed Playlist writer lost SECURITY DEFINER';
  end if;

  if exists (
    select 1
    from pg_proc procedure_row
    where procedure_row.oid in (
      'public.snapshot_playlist_working_version(uuid,bigint,text,uuid)'::regprocedure,
      'public.save_resource_version_editorial_metadata(text,uuid,bigint,uuid[],uuid[],text,text,text[],text,text,uuid)'::regprocedure,
      'public.publish_playlist_version(uuid,bigint,uuid,text,text,uuid)'::regprocedure,
      'public.publish_due_playlist_publications(integer)'::regprocedure,
      'public.unschedule_playlist_publication(uuid,bigint,text,text,uuid)'::regprocedure,
      'public.unpublish_playlist(uuid,bigint,text,text,uuid)'::regprocedure,
      'public.archive_playlist(uuid,bigint,text,text,uuid)'::regprocedure
    )
      and (
        has_function_privilege('public',procedure_row.oid,'EXECUTE')
        or has_function_privilege('anon',procedure_row.oid,'EXECUTE')
        or not has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
        or not has_function_privilege('service_role',procedure_row.oid,'EXECUTE')
      )
  ) then
    raise exception
      'PHASE_7A_K4C_P2_FAIL: governed Playlist writer execution perimeter changed';
  end if;
end;
$phase_7a_k4c_p2_verify$;

select
  'PHASE_7A_K4C_P2_PLAYLIST_POINTER_WRITER_CONVERGENCE_PASS'
    as verification_result,
  (
    select count(*)
    from pg_proc procedure_row
    where procedure_row.prokind in ('f','p')
      and pg_get_functiondef(procedure_row.oid)
        ~* 'update[[:space:]]+editorial[.]playlist_resources'
      and pg_get_functiondef(procedure_row.oid)
        ~* 'current_(working|submitted|approved|published)_version_id'
      and procedure_row.oid
        <> 'editorial.sync_typed_lifecycle_from_resource()'::regprocedure
  ) as governed_typed_pointer_writer_count,
  (
    select count(*)
    from editorial.playlist_resources binding
    join editorial.resources resource_row
      on resource_row.id = binding.resource_id
    where (
      binding.current_working_version_id,
      binding.current_submitted_version_id,
      binding.current_approved_version_id,
      binding.current_published_version_id
    ) is distinct from (
      resource_row.current_working_version_id,
      resource_row.current_submitted_version_id,
      resource_row.current_approved_version_id,
      resource_row.current_published_version_id
    )
  ) as pointer_parity_drift;

rollback;
