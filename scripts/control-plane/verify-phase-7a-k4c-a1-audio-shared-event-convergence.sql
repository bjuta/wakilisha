begin;
set local transaction read only;
set local statement_timeout = '120s';
set local lock_timeout = '5s';

do $phase_7a_k4c_a1_verify$
declare
  v_definition text;
  v_count bigint;
begin
  if to_regclass('audio.publication_review_events') is null
     or to_regclass('audio.publication_lifecycle_events') is null
     or to_regclass('audio.publication_review_threads') is null
     or to_regclass('audio.publication_review_comments') is null
     or to_regclass('editorial.resource_review_events') is null
     or to_regclass('editorial.resource_lifecycle_events') is null
  then
    raise exception
      'PHASE_7A_K4C_A1_FAIL: required Audio/shared review history relations are missing';
  end if;

  if to_regprocedure(
       'editorial.append_resource_lifecycle_event(uuid,uuid,text,text,text,text,jsonb,uuid,uuid,uuid)'
     ) is null
     or to_regprocedure(
       'editorial.append_resource_review_event(uuid,uuid,uuid,text,text,text,text,uuid,uuid,uuid)'
     ) is null
     or to_regprocedure(
       'audio.append_publication_lifecycle_event(uuid,uuid,uuid,text,text,text,text,uuid,uuid,jsonb)'
     ) is null
     or to_regprocedure(
       'audio.assert_publication_review_thread_integrity()'
     ) is null
     or to_regprocedure(
       'public.submit_audio_publication_for_review(uuid,bigint,text,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.review_audio_publication(uuid,bigint,uuid,text,text,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.publish_audio_publication_version(uuid,bigint,uuid,text,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.get_admin_audio_publication_workspace(uuid)'
     ) is null
     or to_regprocedure(
       'public.get_audio_editorial_workbench(uuid)'
     ) is null
     or to_regprocedure(
       'public.create_audio_time_review_thread(uuid,uuid,text,numeric,numeric,text,text)'
     ) is null
  then
    raise exception
      'PHASE_7A_K4C_A1_FAIL: Audio convergence function set is incomplete';
  end if;

  -- All typed Audio history must be represented exactly in shared ledgers.
  if exists (
    select 1
    from audio.publication_review_events source
    left join editorial.resource_review_events shared
      on shared.legacy_source_authority = 'audio_publication_review'
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
      'PHASE_7A_K4C_A1_FAIL: typed Audio review history is not fully mapped';
  end if;

  if exists (
    select 1
    from audio.publication_lifecycle_events source
    left join editorial.resource_lifecycle_events shared
      on shared.legacy_source_authority = 'audio_publication_lifecycle'
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
      'PHASE_7A_K4C_A1_FAIL: typed Audio lifecycle history is not fully mapped';
  end if;

  -- No live function may write typed Audio event authority after A1.
  select count(*)
  into v_count
  from pg_proc procedure_row
  where procedure_row.prokind in ('f','p')
    and pg_get_functiondef(procedure_row.oid)
      ~* 'insert[[:space:]]+into[[:space:]]+audio[.]publication_(review|lifecycle)_events';

  if v_count <> 0 then
    raise exception
      'PHASE_7A_K4C_A1_FAIL: % live function(s) still write Audio typed event authority',
      v_count;
  end if;

  -- Submit keeps exact Media gating and writes shared lifecycle/review history.
  select pg_get_functiondef(
    'public.submit_audio_publication_for_review(uuid,bigint,text,text,uuid)'::regprocedure
  )
  into v_definition;

  if position('editorial.append_resource_lifecycle_event' in v_definition) = 0
     or position('editorial.append_resource_review_event' in v_definition) = 0
     or position('current_submitted_version_id = v_snapshot.version_id' in v_definition) = 0
     or position('update editorial.resources' in v_definition) = 0
     or position('insert into audio.publication_review_events' in v_definition) <> 0
     or position('audio.current_publication_master' in v_definition) = 0
     or position('audio.insert_current_publication_snapshot' in v_definition) = 0
     or position('audio_delivery' in v_definition) = 0
     or position('audio/mpeg' in v_definition) = 0
     or position('approved_public' in v_definition) = 0
     or position('approved_redacted' in v_definition) = 0
     or position('audio_publication_media_not_publishable' in v_definition) = 0
  then
    raise exception
      'PHASE_7A_K4C_A1_FAIL: Audio submit shared-event or Media contract drifted';
  end if;

  -- Review targets exact canonical submitted identity and uses shared ledgers.
  select pg_get_functiondef(
    'public.review_audio_publication(uuid,bigint,uuid,text,text,text,uuid)'::regprocedure
  )
  into v_definition;

  if position('v_resource.current_submitted_version_id' in v_definition) = 0
     or position('editorial.append_resource_review_event' in v_definition) = 0
     or position('editorial.append_resource_lifecycle_event' in v_definition) = 0
     or position('audio.copy_publication_version_snapshot' in v_definition) = 0
     or position('audio_submitted_version_stale' in v_definition) = 0
     or position('review_started' in v_definition) = 0
     or position('changes_requested' in v_definition) = 0
     or position('approved' in v_definition) = 0
     or position('insert into audio.publication_review_events' in v_definition) <> 0
     or position('if p_decision in (' in v_definition) = 0
  then
    raise exception
      'PHASE_7A_K4C_A1_FAIL: Audio review shared-event authority drifted';
  end if;

  -- Publish keeps immutable Audio identity and adds shared lifecycle history.
  select pg_get_functiondef(
    'public.publish_audio_publication_version(uuid,bigint,uuid,text,text,uuid)'::regprocedure
  )
  into v_definition;

  if position('v_resource.current_approved_version_id' in v_definition) = 0
     or position('current_published_version_id = v_published.version_id' in v_definition) = 0
     or position('editorial.append_resource_lifecycle_event' in v_definition) = 0
     or position('audio.assert_publishable_version_media' in v_definition) = 0
     or position('audio.copy_publication_version_snapshot' in v_definition) = 0
     or position('audio.publication_feed_identities' in v_definition) = 0
     or position('audio.publication_snapshots' in v_definition) = 0
     or position('urn:uuid:' in v_definition) = 0
     or position('https://wakilisha.africa/audio/enclosures/' in v_definition) = 0
  then
    raise exception
      'PHASE_7A_K4C_A1_FAIL: Audio publish shared lifecycle/feed identity drifted';
  end if;

  -- Existing lifecycle helper is now only a one-way adapter.
  select pg_get_functiondef(
    'audio.append_publication_lifecycle_event(uuid,uuid,uuid,text,text,text,text,uuid,uuid,jsonb)'::regprocedure
  )
  into v_definition;

  if position('editorial.append_resource_lifecycle_event' in v_definition) = 0
     or position('platform_private.command_receipts' in v_definition) = 0
     or position('correlation_id' in v_definition) = 0
     or position('insert into audio.publication_lifecycle_events' in v_definition) <> 0
  then
    raise exception
      'PHASE_7A_K4C_A1_FAIL: Audio lifecycle helper is not a shared-history adapter';
  end if;

  -- Admin workspace preserves shape but reads canonical pointers/history.
  select pg_get_functiondef(
    'public.get_admin_audio_publication_workspace(uuid)'::regprocedure
  )
  into v_definition;

  if position('editorial.resource_review_events' in v_definition) = 0
     or position('editorial.resource_lifecycle_events' in v_definition) = 0
     or position('v_resource.current_working_version_id' in v_definition) = 0
     or position('v_resource.current_submitted_version_id' in v_definition) = 0
     or position('v_resource.current_approved_version_id' in v_definition) = 0
     or position('v_resource.current_published_version_id' in v_definition) = 0
     or position('audio.publication_review_events' in v_definition) <> 0
     or position('audio.publication_lifecycle_events' in v_definition) <> 0
     or position('publication' in v_definition) = 0
     or position('versions' in v_definition) = 0
     or position('master' in v_definition) = 0
     or position('transcript' in v_definition) = 0
     or position('chapters' in v_definition) = 0
     or position('review_events' in v_definition) = 0
     or position('lifecycle_events' in v_definition) = 0
     or position('trust' in v_definition) = 0
     or position('feed_identity' in v_definition) = 0
  then
    raise exception
      'PHASE_7A_K4C_A1_FAIL: Audio admin workspace shared-history/JSON contract drifted';
  end if;

  -- Editorial workbench keeps timed review semantics, canonical submitted only.
  select pg_get_functiondef(
    'public.get_audio_editorial_workbench(uuid)'::regprocedure
  )
  into v_definition;

  if position('v_resource.current_submitted_version_id' in v_definition) = 0
     or position('v_binding.current_submitted_version_id' in v_definition) <> 0
     or position('audio.publication_version_review_media' in v_definition) = 0
     or position('audio.publication_version_chapters' in v_definition) = 0
     or position('audio.publication_review_threads' in v_definition) = 0
     or position('audio.publication_review_comments' in v_definition) = 0
     or position('waveform_url' in v_definition) = 0
     or position('duration_seconds' in v_definition) = 0
  then
    raise exception
      'PHASE_7A_K4C_A1_FAIL: Audio editorial workbench timed-review contract drifted';
  end if;

  -- New threads and trigger integrity both bind exact canonical submitted.
  select pg_get_functiondef(
    'public.create_audio_time_review_thread(uuid,uuid,text,numeric,numeric,text,text)'::regprocedure
  )
  into v_definition;

  if position('v_resource.current_submitted_version_id' in v_definition) = 0
     or position('v_binding.current_submitted_version_id' in v_definition) <> 0
     or position('time_point' in v_definition) = 0
     or position('time_range' in v_definition) = 0
     or position('audio.publication_review_threads' in v_definition) = 0
     or position('audio.publication_review_comments' in v_definition) = 0
  then
    raise exception
      'PHASE_7A_K4C_A1_FAIL: Audio timed-review creation contract drifted';
  end if;

  select pg_get_functiondef(
    'audio.assert_publication_review_thread_integrity()'::regprocedure
  )
  into v_definition;

  if position('v_resource.current_submitted_version_id' in v_definition) = 0
     or position('v_binding.current_submitted_version_id' in v_definition) <> 0
     or position('publication_version_review_media' in v_definition) = 0
     or position('duration_seconds' in v_definition) = 0
  then
    raise exception
      'PHASE_7A_K4C_A1_FAIL: Audio timed-review integrity guard drifted';
  end if;

  -- Typed pointer mirrors must remain exact during A1 compatibility window.
  select count(*)
  into v_count
  from editorial.audio_publication_resources binding
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
      'PHASE_7A_K4C_A1_FAIL: % Audio Resource pointer mirror divergence(s) exist',
      v_count;
  end if;

  -- Shared event sequence remains contiguous for every Resource.
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
      'PHASE_7A_K4C_A1_FAIL: shared Resource event sequence is not contiguous';
  end if;

  -- Playlist P3 and Video K4B ratchets remain intact.
  if exists (
    select 1
    from information_schema.columns column_row
    where column_row.table_schema = 'editorial'
      and column_row.table_name = 'playlist_resources'
      and column_row.column_name in (
        'current_working_version_id',
        'current_submitted_version_id',
        'current_approved_version_id',
        'current_published_version_id'
      )
  ) then
    raise exception
      'PHASE_7A_K4C_A1_FAIL: Playlist P3 pointer retirement regressed';
  end if;

  if to_regclass('video.review_events') is not null
     or to_regclass('video.lifecycle_events') is not null
     or to_regclass('video.publication_review_events') is not null
     or to_regclass('video.publication_lifecycle_events') is not null
  then
    raise exception
      'PHASE_7A_K4C_A1_FAIL: typed Video event authority exists';
  end if;

  -- Typed event stores remain compatibility history without app-role writes.
  if has_table_privilege('anon', 'audio.publication_review_events', 'INSERT')
     or has_table_privilege('anon', 'audio.publication_review_events', 'UPDATE')
     or has_table_privilege('anon', 'audio.publication_review_events', 'DELETE')
     or has_table_privilege('authenticated', 'audio.publication_review_events', 'INSERT')
     or has_table_privilege('authenticated', 'audio.publication_review_events', 'UPDATE')
     or has_table_privilege('authenticated', 'audio.publication_review_events', 'DELETE')
     or has_table_privilege('service_role', 'audio.publication_review_events', 'INSERT')
     or has_table_privilege('service_role', 'audio.publication_review_events', 'UPDATE')
     or has_table_privilege('service_role', 'audio.publication_review_events', 'DELETE')
     or has_table_privilege('anon', 'audio.publication_lifecycle_events', 'INSERT')
     or has_table_privilege('anon', 'audio.publication_lifecycle_events', 'UPDATE')
     or has_table_privilege('anon', 'audio.publication_lifecycle_events', 'DELETE')
     or has_table_privilege('authenticated', 'audio.publication_lifecycle_events', 'INSERT')
     or has_table_privilege('authenticated', 'audio.publication_lifecycle_events', 'UPDATE')
     or has_table_privilege('authenticated', 'audio.publication_lifecycle_events', 'DELETE')
     or has_table_privilege('service_role', 'audio.publication_lifecycle_events', 'INSERT')
     or has_table_privilege('service_role', 'audio.publication_lifecycle_events', 'UPDATE')
     or has_table_privilege('service_role', 'audio.publication_lifecycle_events', 'DELETE')
  then
    raise exception
      'PHASE_7A_K4C_A1_FAIL: typed Audio event-table mutation authority leaked';
  end if;

  -- Preserve exact owner / SECURITY DEFINER / search-path perimeter.
  if exists (
    select 1
    from (
      values
        (
          'public.submit_audio_publication_for_review(uuid,bigint,text,text,uuid)'::regprocedure,
          'search_path=pg_catalog, public, auth, editorial, platform_private, audio, media, extensions'
        ),
        (
          'public.review_audio_publication(uuid,bigint,uuid,text,text,text,uuid)'::regprocedure,
          'search_path=pg_catalog, public, auth, editorial, platform_private, audio, extensions'
        ),
        (
          'public.publish_audio_publication_version(uuid,bigint,uuid,text,text,uuid)'::regprocedure,
          'search_path=pg_catalog, public, auth, editorial, platform_private, audio, media, extensions'
        ),
        (
          'public.get_admin_audio_publication_workspace(uuid)'::regprocedure,
          'search_path=pg_catalog, auth, public, editorial, audio, media'
        ),
        (
          'public.get_audio_editorial_workbench(uuid)'::regprocedure,
          'search_path=pg_catalog, public, editorial, audio'
        ),
        (
          'public.create_audio_time_review_thread(uuid,uuid,text,numeric,numeric,text,text)'::regprocedure,
          'search_path=pg_catalog, public, editorial, audio'
        ),
        (
          'audio.assert_publication_review_thread_integrity()'::regprocedure,
          'search_path=pg_catalog, audio, editorial'
        ),
        (
          'audio.append_publication_lifecycle_event(uuid,uuid,uuid,text,text,text,text,uuid,uuid,jsonb)'::regprocedure,
          'search_path=pg_catalog, audio'
        )
    ) expected(function_oid, search_path_setting)
    join pg_proc procedure_row
      on procedure_row.oid = expected.function_oid
    where pg_get_userbyid(procedure_row.proowner) <> 'postgres'
       or not procedure_row.prosecdef
       or not (
         coalesce(procedure_row.proconfig, '{}'::text[]) @>
           array[expected.search_path_setting]::text[]
       )
  ) then
    raise exception
      'PHASE_7A_K4C_A1_FAIL: changed Audio function owner/SECURITY DEFINER/search path drifted';
  end if;

  -- Browser RPC ACL stays closed to PUBLIC/anon and open to authenticated/service.
  if exists (
    select 1
    from (
      values
        ('public.submit_audio_publication_for_review(uuid,bigint,text,text,uuid)'),
        ('public.review_audio_publication(uuid,bigint,uuid,text,text,text,uuid)'),
        ('public.publish_audio_publication_version(uuid,bigint,uuid,text,text,uuid)'),
        ('public.get_admin_audio_publication_workspace(uuid)'),
        ('public.get_audio_editorial_workbench(uuid)'),
        ('public.create_audio_time_review_thread(uuid,uuid,text,numeric,numeric,text,text)')
    ) signature(value)
    where has_function_privilege('public', signature.value, 'EXECUTE')
       or has_function_privilege('anon', signature.value, 'EXECUTE')
       or not has_function_privilege('authenticated', signature.value, 'EXECUTE')
       or not has_function_privilege('service_role', signature.value, 'EXECUTE')
  ) then
    raise exception
      'PHASE_7A_K4C_A1_FAIL: Audio public RPC execution perimeter is invalid';
  end if;

  if has_function_privilege(
       'public',
       'audio.append_publication_lifecycle_event(uuid,uuid,uuid,text,text,text,text,uuid,uuid,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'audio.append_publication_lifecycle_event(uuid,uuid,uuid,text,text,text,text,uuid,uuid,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'audio.append_publication_lifecycle_event(uuid,uuid,uuid,text,text,text,text,uuid,uuid,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'audio.append_publication_lifecycle_event(uuid,uuid,uuid,text,text,text,text,uuid,uuid,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'public',
       'audio.assert_publication_review_thread_integrity()',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'audio.assert_publication_review_thread_integrity()',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'audio.assert_publication_review_thread_integrity()',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'audio.assert_publication_review_thread_integrity()',
       'EXECUTE'
     )
  then
    raise exception
      'PHASE_7A_K4C_A1_FAIL: internal Audio helper execution leaked';
  end if;
end;
$phase_7a_k4c_a1_verify$;

select
  'PHASE_7A_K4C_A1_AUDIO_SHARED_EVENT_CONVERGENCE_PASS'
    as verification_result,
  (select count(*) from audio.publication_review_events)
    as typed_audio_review_event_count,
  (select count(*) from audio.publication_lifecycle_events)
    as typed_audio_lifecycle_event_count,
  (
    select count(*)
    from editorial.resource_review_events event_row
    where event_row.resource_id in (
      select binding.resource_id
      from editorial.audio_publication_resources binding
    )
  ) as shared_audio_review_event_count,
  (
    select count(*)
    from editorial.resource_lifecycle_events event_row
    where event_row.resource_id in (
      select binding.resource_id
      from editorial.audio_publication_resources binding
    )
  ) as shared_audio_lifecycle_event_count;

rollback;
