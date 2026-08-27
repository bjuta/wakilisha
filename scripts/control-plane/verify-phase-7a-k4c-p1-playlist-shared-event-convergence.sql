begin;
set local transaction read only;
set local statement_timeout = '60s';

do $phase_7a_k4c_p1_verify$
declare
  v_definition text;
  v_count bigint;
begin
  if to_regprocedure(
       'editorial.append_resource_lifecycle_event(uuid,uuid,text,text,text,text,jsonb,uuid,uuid,uuid)'
     ) is null
     or to_regprocedure(
       'editorial.append_resource_review_event(uuid,uuid,uuid,text,text,text,text,uuid,uuid,uuid)'
     ) is null
     or to_regprocedure(
       'public.submit_playlist_for_review(uuid,bigint,text,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.review_playlist(uuid,bigint,uuid,text,text,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.get_playlist_review_workspace(uuid)'
     ) is null
     or to_regprocedure(
       'editorial.append_playlist_lifecycle_event(uuid,uuid,uuid,text,text,text,text,uuid,uuid,jsonb)'
     ) is null
  then
    raise exception
      'PHASE_7A_K4C_P1_FAIL: Playlist shared-event convergence functions are incomplete';
  end if;

  if to_regclass('editorial.playlist_review_events') is null
     or to_regclass('editorial.playlist_lifecycle_events') is null
  then
    raise exception
      'PHASE_7A_K4C_P1_FAIL: Playlist historical compatibility event stores are missing';
  end if;

  if not exists (
    select 1
    from pg_proc procedure_row
    join pg_namespace namespace_row
      on namespace_row.oid = procedure_row.pronamespace
    where procedure_row.oid =
      'editorial.append_resource_lifecycle_event(uuid,uuid,text,text,text,text,jsonb,uuid,uuid,uuid)'::regprocedure
      and procedure_row.prosecdef
      and procedure_row.proconfig @> array[
        'search_path=pg_catalog, editorial, platform_private'
      ]
  ) or not exists (
    select 1
    from pg_proc procedure_row
    join pg_namespace namespace_row
      on namespace_row.oid = procedure_row.pronamespace
    where procedure_row.oid =
      'editorial.append_resource_review_event(uuid,uuid,uuid,text,text,text,text,uuid,uuid,uuid)'::regprocedure
      and procedure_row.prosecdef
      and procedure_row.proconfig @> array[
        'search_path=pg_catalog, editorial, platform_private'
      ]
  ) then
    raise exception
      'PHASE_7A_K4C_P1_FAIL: shared Resource event append helpers are not hardened';
  end if;

  if has_function_privilege(
       'public',
       'editorial.append_resource_lifecycle_event(uuid,uuid,text,text,text,text,jsonb,uuid,uuid,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'editorial.append_resource_lifecycle_event(uuid,uuid,text,text,text,text,jsonb,uuid,uuid,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'editorial.append_resource_lifecycle_event(uuid,uuid,text,text,text,text,jsonb,uuid,uuid,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'editorial.append_resource_lifecycle_event(uuid,uuid,text,text,text,text,jsonb,uuid,uuid,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'public',
       'editorial.append_resource_review_event(uuid,uuid,uuid,text,text,text,text,uuid,uuid,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'editorial.append_resource_review_event(uuid,uuid,uuid,text,text,text,text,uuid,uuid,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'editorial.append_resource_review_event(uuid,uuid,uuid,text,text,text,text,uuid,uuid,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'editorial.append_resource_review_event(uuid,uuid,uuid,text,text,text,text,uuid,uuid,uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'PHASE_7A_K4C_P1_FAIL: shared Resource event append helper ACL is open';
  end if;

  if exists (
    select 1
    from editorial.playlist_lifecycle_events source
    left join editorial.resource_lifecycle_events shared
      on shared.legacy_source_authority = 'playlist_lifecycle'
     and shared.legacy_source_event_id = source.id
     and shared.id = source.id
     and shared.resource_id = source.resource_id
     and shared.version_id is not distinct from source.version_id
     and shared.action = source.action
     and shared.prior_status is not distinct from source.prior_status
     and shared.resulting_status is not distinct from source.resulting_status
     and shared.note is not distinct from source.note
     and shared.metadata = source.metadata
     and shared.actor_id is not distinct from source.actor_id
     and shared.command_receipt_id = source.command_receipt_id
     and shared.created_at = source.created_at
    where shared.id is null
  ) then
    raise exception
      'PHASE_7A_K4C_P1_FAIL: Playlist lifecycle compatibility history is not fully represented';
  end if;

  if exists (
    select 1
    from editorial.playlist_review_events source
    left join editorial.resource_review_events shared
      on shared.legacy_source_authority = 'playlist_review'
     and shared.legacy_source_event_id = source.id
     and shared.id = source.id
     and shared.resource_id = source.resource_id
     and shared.target_version_id = source.target_version_id
     and shared.result_version_id is not distinct from source.result_version_id
     and shared.action = source.action
     and shared.prior_status = source.prior_status
     and shared.resulting_status = source.resulting_status
     and shared.reason is not distinct from source.reason
     and shared.actor_id is not distinct from source.actor_id
     and shared.command_receipt_id = source.command_receipt_id
     and shared.correlation_id = source.correlation_id
     and shared.created_at = source.created_at
    where shared.id is null
  ) then
    raise exception
      'PHASE_7A_K4C_P1_FAIL: Playlist review compatibility history is not fully represented';
  end if;

  select count(*)
  into v_count
  from pg_proc procedure_row
  join pg_namespace namespace_row
    on namespace_row.oid = procedure_row.pronamespace
  where procedure_row.prokind in ('f','p')
    and pg_get_functiondef(procedure_row.oid)
      ~* 'insert[[:space:]]+into[[:space:]]+editorial[.]playlist_(review|lifecycle)_events';

  if v_count <> 0 then
    raise exception
      'PHASE_7A_K4C_P1_FAIL: % live function(s) still write Playlist typed event authority',
      v_count;
  end if;

  select pg_get_functiondef(
    'public.submit_playlist_for_review(uuid,bigint,text,text,uuid)'::regprocedure
  )
  into v_definition;

  if position('editorial.append_resource_lifecycle_event' in v_definition) = 0
     or position('editorial.append_resource_review_event' in v_definition) = 0
     or position('update editorial.resources' in v_definition) = 0
     or position('v_resource.current_working_version_id' in v_definition) = 0
     or position('v_resource.current_published_version_id' in v_definition) = 0
     or position('insert into editorial.playlist_review_events' in v_definition) <> 0
  then
    raise exception
      'PHASE_7A_K4C_P1_FAIL: Playlist submit is not shared-event/Resource-pointer authority';
  end if;

  select pg_get_functiondef(
    'public.review_playlist(uuid,bigint,uuid,text,text,text,uuid)'::regprocedure
  )
  into v_definition;

  if position('editorial.append_resource_review_event' in v_definition) = 0
     or position('editorial.append_resource_lifecycle_event' in v_definition) = 0
     or position('v_resource.current_submitted_version_id' in v_definition) = 0
     or position('update editorial.resources' in v_definition) = 0
     or position('insert into editorial.playlist_review_events' in v_definition) <> 0
     or position('if p_decision in (' in v_definition) = 0
  then
    raise exception
      'PHASE_7A_K4C_P1_FAIL: Playlist review is not exact-submitted shared authority';
  end if;

  select pg_get_functiondef(
    'editorial.append_playlist_lifecycle_event(uuid,uuid,uuid,text,text,text,text,uuid,uuid,jsonb)'::regprocedure
  )
  into v_definition;

  if position('editorial.append_resource_lifecycle_event' in v_definition) = 0
     or position('platform_private.command_receipts' in v_definition) = 0
     or position('insert into editorial.playlist_lifecycle_events' in v_definition) <> 0
  then
    raise exception
      'PHASE_7A_K4C_P1_FAIL: Playlist lifecycle adapter still owns typed history';
  end if;

  select pg_get_functiondef(
    'public.get_playlist_review_workspace(uuid)'::regprocedure
  )
  into v_definition;

  if position('editorial.resource_review_events' in v_definition) = 0
     or position('editorial.resource_lifecycle_events' in v_definition) = 0
     or position('v_resource.current_working_version_id' in v_definition) = 0
     or position('v_resource.current_submitted_version_id' in v_definition) = 0
     or position('v_resource.current_approved_version_id' in v_definition) = 0
     or position('v_resource.current_published_version_id' in v_definition) = 0
     or position('editorial.playlist_review_events' in v_definition) <> 0
     or position('editorial.playlist_lifecycle_events' in v_definition) <> 0
  then
    raise exception
      'PHASE_7A_K4C_P1_FAIL: Playlist workspace is not canonical Resource history';
  end if;

  select pg_get_functiondef(
    'editorial.playlist_current_content_fingerprint(uuid)'::regprocedure
  )
  into v_definition;

  if position('resource_row.current_working_version_id' in v_definition) = 0
     or position('binding.current_working_version_id' in v_definition) <> 0
  then
    raise exception
      'PHASE_7A_K4C_P1_FAIL: Playlist content fingerprint still consumes typed working pointer';
  end if;

  if has_function_privilege(
       'public',
       'public.submit_playlist_for_review(uuid,bigint,text,text,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.submit_playlist_for_review(uuid,bigint,text,text,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'public',
       'public.review_playlist(uuid,bigint,uuid,text,text,text,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.review_playlist(uuid,bigint,uuid,text,text,text,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'public',
       'public.get_playlist_review_workspace(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.get_playlist_review_workspace(uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.submit_playlist_for_review(uuid,bigint,text,text,uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'service_role',
       'public.submit_playlist_for_review(uuid,bigint,text,text,uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.review_playlist(uuid,bigint,uuid,text,text,text,uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'service_role',
       'public.review_playlist(uuid,bigint,uuid,text,text,text,uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.get_playlist_review_workspace(uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'service_role',
       'public.get_playlist_review_workspace(uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'PHASE_7A_K4C_P1_FAIL: Playlist public RPC execution perimeter is invalid';
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
      'PHASE_7A_K4C_P1_FAIL: % Playlist Resource pointer mirror divergence(s) exist',
      v_count;
  end if;

  if exists (
    select 1
    from (
      select
        resource_id,
        event_number,
        row_number() over (
          partition by resource_id
          order by event_number
        ) as expected_number
      from editorial.resource_lifecycle_events
    ) sequence_row
    where sequence_row.event_number <> sequence_row.expected_number
  ) or exists (
    select 1
    from (
      select
        resource_id,
        event_number,
        row_number() over (
          partition by resource_id
          order by event_number
        ) as expected_number
      from editorial.resource_review_events
    ) sequence_row
    where sequence_row.event_number <> sequence_row.expected_number
  ) then
    raise exception
      'PHASE_7A_K4C_P1_FAIL: shared Resource event sequence is not contiguous';
  end if;

  if to_regclass('video.publication_review_events') is not null
     or to_regclass('video.publication_lifecycle_events') is not null
  then
    raise exception
      'PHASE_7A_K4C_P1_FAIL: typed Video event authority exists';
  end if;
end;
$phase_7a_k4c_p1_verify$;

select
  'PHASE_7A_K4C_P1_PLAYLIST_SHARED_EVENT_CONVERGENCE_PASS'
    as verification_result,
  (select count(*) from editorial.playlist_review_events)
    as playlist_typed_review_event_count,
  (select count(*) from editorial.playlist_lifecycle_events)
    as playlist_typed_lifecycle_event_count,
  (
    select count(*)
    from editorial.resource_review_events event_row
    where event_row.resource_id in (
      select binding.resource_id
      from editorial.playlist_resources binding
    )
  ) as playlist_shared_review_event_count,
  (
    select count(*)
    from editorial.resource_lifecycle_events event_row
    where event_row.resource_id in (
      select binding.resource_id
      from editorial.playlist_resources binding
    )
  ) as playlist_shared_lifecycle_event_count;

rollback;
