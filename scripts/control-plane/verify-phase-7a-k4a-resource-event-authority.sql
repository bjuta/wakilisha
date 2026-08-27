-- Permanent read-only verifier for Phase 7A K4A shared Resource event authority.

begin;
set local transaction read only;
set local statement_timeout = '120s';
set local lock_timeout = '5s';

do $verify_phase_7a_k4a_resource_event_authority$
declare
  v_count bigint;
begin
  if to_regclass('editorial.resource_lifecycle_actions') is null
     or to_regclass('editorial.resource_review_actions') is null
     or to_regclass('editorial.resource_lifecycle_events') is null
     or to_regclass('editorial.resource_review_events') is null
  then
    raise exception
      'PHASE_7A_K4A_FAIL: one or more shared Resource event relations are missing';
  end if;

  if to_regclass('editorial.article_lifecycle_events') is null
     or to_regclass('editorial.playlist_lifecycle_events') is null
     or to_regclass('editorial.playlist_review_events') is null
     or to_regclass('audio.publication_lifecycle_events') is null
     or to_regclass('audio.publication_review_events') is null
  then
    raise exception
      'PHASE_7A_K4A_FAIL: a legacy typed event history relation was removed';
  end if;

  if to_regclass('video.review_events') is not null
     or to_regclass('video.lifecycle_events') is not null
     or to_regclass('video.publication_review_events') is not null
     or to_regclass('video.publication_lifecycle_events') is not null
  then
    raise exception
      'PHASE_7A_K4A_FAIL: Video renewed typed review/lifecycle event authority';
  end if;

  if (
    select count(*)
    from editorial.resource_lifecycle_actions action_row
    where action_row.action in (
      'submitted',
      'changes_requested',
      'approved',
      'scheduled',
      'unscheduled',
      'published',
      'unpublished',
      'archived',
      'restored'
    )
      and action_row.enabled
  ) <> 9 then
    raise exception
      'PHASE_7A_K4A_FAIL: shared lifecycle action vocabulary is incomplete';
  end if;

  if (
    select count(*)
    from editorial.resource_review_actions action_row
    where action_row.action in (
      'submitted',
      'review_started',
      'changes_requested',
      'approved',
      'rejected'
    )
      and action_row.enabled
  ) <> 5 then
    raise exception
      'PHASE_7A_K4A_FAIL: shared review action vocabulary is incomplete';
  end if;

  if not exists (
    select 1
    from pg_constraint constraint_row
    where constraint_row.conrelid =
      'editorial.resource_lifecycle_events'::regclass
      and constraint_row.conname =
        'resource_lifecycle_events_resource_fkey'
      and constraint_row.confrelid = 'editorial.resources'::regclass
  )
  or not exists (
    select 1
    from pg_constraint constraint_row
    where constraint_row.conrelid =
      'editorial.resource_lifecycle_events'::regclass
      and constraint_row.conname =
        'resource_lifecycle_events_version_fkey'
      and constraint_row.confrelid =
        'editorial.resource_versions'::regclass
      and position(
        'FOREIGN KEY (resource_id, version_id) REFERENCES editorial.resource_versions(resource_id, id)'
        in pg_get_constraintdef(constraint_row.oid, true)
      ) > 0
  )
  or not exists (
    select 1
    from pg_constraint constraint_row
    where constraint_row.conrelid =
      'editorial.resource_review_events'::regclass
      and constraint_row.conname =
        'resource_review_events_target_version_fkey'
      and constraint_row.confrelid =
        'editorial.resource_versions'::regclass
      and position(
        'FOREIGN KEY (resource_id, target_version_id) REFERENCES editorial.resource_versions(resource_id, id)'
        in pg_get_constraintdef(constraint_row.oid, true)
      ) > 0
  )
  or not exists (
    select 1
    from pg_constraint constraint_row
    where constraint_row.conrelid =
      'editorial.resource_review_events'::regclass
      and constraint_row.conname =
        'resource_review_events_result_version_fkey'
      and constraint_row.confrelid =
        'editorial.resource_versions'::regclass
      and position(
        'FOREIGN KEY (resource_id, result_version_id) REFERENCES editorial.resource_versions(resource_id, id)'
        in pg_get_constraintdef(constraint_row.oid, true)
      ) > 0
  ) then
    raise exception
      'PHASE_7A_K4A_FAIL: shared event identity is not anchored to Resource/Resource Version authority';
  end if;

  if exists (
    select 1
    from editorial.resource_lifecycle_events event_row
    left join editorial.resource_versions version_row
      on version_row.id = event_row.version_id
     and version_row.resource_id = event_row.resource_id
    where event_row.version_id is not null
      and version_row.id is null
  ) or exists (
    select 1
    from editorial.resource_review_events event_row
    left join editorial.resource_versions target_row
      on target_row.id = event_row.target_version_id
     and target_row.resource_id = event_row.resource_id
    left join editorial.resource_versions result_row
      on result_row.id = event_row.result_version_id
     and result_row.resource_id = event_row.resource_id
    where target_row.id is null
       or (
         event_row.result_version_id is not null
         and result_row.id is null
       )
  ) then
    raise exception
      'PHASE_7A_K4A_FAIL: shared event history references a missing or cross-Resource Resource Version';
  end if;

  if exists (
    select 1
    from editorial.resource_lifecycle_events event_row
    left join editorial.resource_lifecycle_actions action_row
      on action_row.action = event_row.action
     and action_row.enabled
    where action_row.action is null
  ) or exists (
    select 1
    from editorial.resource_review_events event_row
    left join editorial.resource_review_actions action_row
      on action_row.action = event_row.action
     and action_row.enabled
    where action_row.action is null
  ) then
    raise exception
      'PHASE_7A_K4A_FAIL: shared event history uses a disabled or unknown action';
  end if;

  if exists (
    select 1
    from editorial.resource_lifecycle_events event_row
    where event_row.legacy_source_authority is null
      and (
        event_row.command_receipt_id is null
        or event_row.correlation_id is null
      )
  ) or exists (
    select 1
    from editorial.resource_review_events event_row
    where event_row.legacy_source_authority is null
      and (
        event_row.command_receipt_id is null
        or event_row.correlation_id is null
      )
  ) then
    raise exception
      'PHASE_7A_K4A_FAIL: a new canonical event lacks command/correlation identity';
  end if;

  if exists (
    select 1
    from editorial.resource_lifecycle_events event_row
    join platform_private.command_receipts receipt
      on receipt.id = event_row.command_receipt_id
    where receipt.resource_id <> event_row.resource_id
       or receipt.actor_user_id is distinct from event_row.actor_id
  ) or exists (
    select 1
    from editorial.resource_review_events event_row
    join platform_private.command_receipts receipt
      on receipt.id = event_row.command_receipt_id
    where receipt.resource_id <> event_row.resource_id
       or receipt.actor_user_id is distinct from event_row.actor_id
  ) then
    raise exception
      'PHASE_7A_K4A_FAIL: a canonical event command receipt disagrees with Resource/actor identity';
  end if;

  select count(*)
  into v_count
  from editorial.resource_lifecycle_events
  where legacy_source_authority is not null;

  if v_count <> (
    (select count(*) from editorial.article_lifecycle_events)
    + (select count(*) from editorial.playlist_lifecycle_events)
    + (select count(*) from audio.publication_lifecycle_events)
  ) then
    raise exception
      'PHASE_7A_K4A_FAIL: shared lifecycle historical backfill count drifted';
  end if;

  select count(*)
  into v_count
  from editorial.resource_review_events
  where legacy_source_authority is not null;

  if v_count <> (
    (select count(*) from editorial.playlist_review_events)
    + (select count(*) from audio.publication_review_events)
  ) then
    raise exception
      'PHASE_7A_K4A_FAIL: shared review historical backfill count drifted';
  end if;

  if exists (
    select 1
    from editorial.article_lifecycle_events source
    left join editorial.resource_lifecycle_events canonical
      on canonical.id = source.id
     and canonical.legacy_source_authority = 'article_lifecycle'
     and canonical.legacy_source_event_id = source.id
     and canonical.resource_id = source.resource_id
     and canonical.version_id is not distinct from source.version_id
     and canonical.action = source.action
     and canonical.prior_status is not distinct from source.prior_status
     and canonical.resulting_status is not distinct from source.resulting_status
     and canonical.note is not distinct from source.note
     and canonical.metadata = source.metadata
     and canonical.actor_id is not distinct from source.actor_id
     and canonical.created_at = source.created_at
    where canonical.id is null
  ) or exists (
    select 1
    from editorial.playlist_lifecycle_events source
    left join editorial.resource_lifecycle_events canonical
      on canonical.id = source.id
     and canonical.legacy_source_authority = 'playlist_lifecycle'
     and canonical.legacy_source_event_id = source.id
     and canonical.resource_id = source.resource_id
     and canonical.version_id is not distinct from source.version_id
     and canonical.action = source.action
     and canonical.prior_status is not distinct from source.prior_status
     and canonical.resulting_status is not distinct from source.resulting_status
     and canonical.note is not distinct from source.note
     and canonical.metadata = source.metadata
     and canonical.actor_id is not distinct from source.actor_id
     and canonical.command_receipt_id = source.command_receipt_id
     and canonical.created_at = source.created_at
    where canonical.id is null
  ) or exists (
    select 1
    from audio.publication_lifecycle_events source
    left join editorial.resource_lifecycle_events canonical
      on canonical.id = source.id
     and canonical.legacy_source_authority = 'audio_publication_lifecycle'
     and canonical.legacy_source_event_id = source.id
     and canonical.resource_id = source.resource_id
     and canonical.version_id is not distinct from source.version_id
     and canonical.action = source.action
     and canonical.prior_status is not distinct from source.prior_status
     and canonical.resulting_status is not distinct from source.resulting_status
     and canonical.note is not distinct from source.note
     and canonical.metadata = source.metadata
     and canonical.actor_id is not distinct from source.actor_id
     and canonical.command_receipt_id = source.command_receipt_id
     and canonical.created_at = source.created_at
    where canonical.id is null
  ) then
    raise exception
      'PHASE_7A_K4A_FAIL: canonical lifecycle history no longer matches typed compatibility history';
  end if;

  if exists (
    select 1
    from editorial.playlist_review_events source
    left join editorial.resource_review_events canonical
      on canonical.id = source.id
     and canonical.legacy_source_authority = 'playlist_review'
     and canonical.legacy_source_event_id = source.id
     and canonical.resource_id = source.resource_id
     and canonical.target_version_id = source.target_version_id
     and canonical.result_version_id is not distinct from source.result_version_id
     and canonical.action = source.action
     and canonical.prior_status = source.prior_status
     and canonical.resulting_status = source.resulting_status
     and canonical.reason is not distinct from source.reason
     and canonical.actor_id is not distinct from source.actor_id
     and canonical.command_receipt_id = source.command_receipt_id
     and canonical.correlation_id = source.correlation_id
     and canonical.created_at = source.created_at
    where canonical.id is null
  ) or exists (
    select 1
    from audio.publication_review_events source
    left join editorial.resource_review_events canonical
      on canonical.id = source.id
     and canonical.legacy_source_authority = 'audio_publication_review'
     and canonical.legacy_source_event_id = source.id
     and canonical.resource_id = source.resource_id
     and canonical.target_version_id = source.target_version_id
     and canonical.result_version_id is not distinct from source.result_version_id
     and canonical.action = source.action
     and canonical.prior_status = source.prior_status
     and canonical.resulting_status = source.resulting_status
     and canonical.reason is not distinct from source.reason
     and canonical.actor_id is not distinct from source.actor_id
     and canonical.command_receipt_id = source.command_receipt_id
     and canonical.correlation_id = source.correlation_id
     and canonical.created_at = source.created_at
    where canonical.id is null
  ) then
    raise exception
      'PHASE_7A_K4A_FAIL: canonical review history no longer matches typed compatibility history';
  end if;

  if exists (
    select 1
    from editorial.resource_lifecycle_events event_row
    group by event_row.resource_id
    having min(event_row.event_number) <> 1
       or max(event_row.event_number) <> count(*)
  ) or exists (
    select 1
    from editorial.resource_review_events event_row
    group by event_row.resource_id
    having min(event_row.event_number) <> 1
       or max(event_row.event_number) <> count(*)
  ) then
    raise exception
      'PHASE_7A_K4A_FAIL: canonical event numbering is not contiguous from 1';
  end if;

  if (
    select count(*)
    from pg_trigger trigger_row
    where not trigger_row.tgisinternal
      and (
        (
          trigger_row.tgrelid =
            'editorial.resource_lifecycle_events'::regclass
          and trigger_row.tgname in (
            'resource_lifecycle_events_append_only',
            'resource_lifecycle_events_insert_integrity',
            'resource_lifecycle_events_sequence_integrity'
          )
        )
        or
        (
          trigger_row.tgrelid =
            'editorial.resource_review_events'::regclass
          and trigger_row.tgname in (
            'resource_review_events_append_only',
            'resource_review_events_insert_integrity',
            'resource_review_events_sequence_integrity'
          )
        )
      )
  ) <> 6 then
    raise exception
      'PHASE_7A_K4A_FAIL: shared Resource event trigger contract is incomplete';
  end if;

  if (
    select count(*)
    from pg_proc function_row
    join pg_namespace schema_row
      on schema_row.oid = function_row.pronamespace
    where schema_row.nspname = 'editorial'
      and function_row.proname in (
        'protect_resource_event_history',
        'assert_resource_event_insert_integrity',
        'assert_resource_event_sequence_integrity'
      )
      and function_row.prosecdef
      and (
        (
          function_row.proname = 'protect_resource_event_history'
          and coalesce(function_row.proconfig, '{}'::text[])
                @> array['search_path=pg_catalog, editorial']::text[]
        )
        or
        (
          function_row.proname = 'assert_resource_event_insert_integrity'
          and coalesce(function_row.proconfig, '{}'::text[])
                @> array['search_path=pg_catalog, editorial, platform_private']::text[]
        )
        or
        (
          function_row.proname = 'assert_resource_event_sequence_integrity'
          and coalesce(function_row.proconfig, '{}'::text[])
                @> array['search_path=pg_catalog, editorial']::text[]
        )
      )
  ) <> 3 then
    raise exception
      'PHASE_7A_K4A_FAIL: shared Resource event helper security/search-path contract drifted';
  end if;

  if has_function_privilege(
       'anon',
       'editorial.protect_resource_event_history()'::regprocedure,
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'editorial.protect_resource_event_history()'::regprocedure,
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'editorial.protect_resource_event_history()'::regprocedure,
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'editorial.assert_resource_event_insert_integrity()'::regprocedure,
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'editorial.assert_resource_event_insert_integrity()'::regprocedure,
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'editorial.assert_resource_event_insert_integrity()'::regprocedure,
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'editorial.assert_resource_event_sequence_integrity()'::regprocedure,
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'editorial.assert_resource_event_sequence_integrity()'::regprocedure,
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'editorial.assert_resource_event_sequence_integrity()'::regprocedure,
       'EXECUTE'
     )
  then
    raise exception
      'PHASE_7A_K4A_FAIL: shared Resource event internal helper EXECUTE leaked to an application role';
  end if;

  if (
    select count(*)
    from pg_class table_row
    join pg_namespace schema_row
      on schema_row.oid = table_row.relnamespace
    where schema_row.nspname = 'editorial'
      and table_row.relname in (
        'resource_lifecycle_actions',
        'resource_review_actions',
        'resource_lifecycle_events',
        'resource_review_events'
      )
      and table_row.relrowsecurity
  ) <> 4 then
    raise exception
      'PHASE_7A_K4A_FAIL: one or more shared Resource event tables lack RLS';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants grant_row
    where grant_row.table_schema = 'editorial'
      and grant_row.table_name in (
        'resource_lifecycle_actions',
        'resource_review_actions',
        'resource_lifecycle_events',
        'resource_review_events'
      )
      and grant_row.grantee in (
        'PUBLIC',
        'anon',
        'authenticated',
        'service_role'
      )
  ) then
    raise exception
      'PHASE_7A_K4A_FAIL: direct shared Resource event table privilege leaked to an application role';
  end if;
end;
$verify_phase_7a_k4a_resource_event_authority$;

select
  'PHASE_7A_K4A_RESOURCE_EVENT_AUTHORITY_PASS' as verification_result,
  (
    select count(*)
    from editorial.resource_lifecycle_events
  ) as resource_lifecycle_event_count,
  (
    select count(*)
    from editorial.resource_review_events
  ) as resource_review_event_count,
  (
    select count(*)
    from editorial.resource_lifecycle_events
    where legacy_source_authority is null
  ) as native_shared_lifecycle_event_count,
  (
    select count(*)
    from editorial.resource_review_events
    where legacy_source_authority is null
  ) as native_shared_review_event_count;

rollback;
