-- Phase 8A.2A Field Submission identity foundation permanent verifier.
-- Read-only. Safe for preview and production verification.

do $verify_phase_8a_field_submission_identity$
declare
  v_expected_columns text[];
  v_actual_columns text[];
  v_expected_event_columns text[];
  v_actual_event_columns text[];
  v_binding_definition text;
  v_create_definition text;
  v_update_definition text;
  v_cancel_definition text;
  v_own_read_definition text;
  v_internal_read_definition text;
  v_mutation_definition text;
  v_assignment_count integer;
begin
  if to_regclass('editorial.field_submissions') is null
     or to_regclass('editorial.field_submission_event_types') is null
     or to_regclass('editorial.field_submission_events') is null
  then
    raise exception
      'Phase 8A.2A Field Submission tables are incomplete';
  end if;

  if not exists (
    select 1
    from editorial.resource_kinds
    where kind = 'field_submission'
      and enabled
      and label = 'Field Submission'
  ) then
    raise exception
      'field_submission Resource kind is missing, disabled, or drifted';
  end if;

  if not exists (
    select 1
    from public.role_definitions
    where role_key = 'field_contributor'
      and label = 'Field Contributor'
      and is_system
  ) then
    raise exception
      'field_contributor role is missing or drifted';
  end if;

  if exists (
    select 1
    from (
      values
        ('submit_field_capture'),
        ('read_own_field_capture'),
        ('view_field_intake'),
        ('view_restricted_field_sources')
    ) expected(capability_key)
    where not exists (
      select 1
      from public.capability_definitions actual
      where actual.capability_key = expected.capability_key
        and actual.domain = 'field'
    )
  ) then
    raise exception
      'One or more Phase 8A Field capabilities are missing or drifted';
  end if;

  select count(*)
  into v_assignment_count
  from public.role_capabilities assignment
  where assignment.capability_key in (
    'submit_field_capture',
    'read_own_field_capture',
    'view_field_intake',
    'view_restricted_field_sources'
  );

  if v_assignment_count <> 9 then
    raise exception
      'Unexpected Field capability assignment count: expected 9, found %',
      v_assignment_count;
  end if;

  if exists (
    select 1
    from (
      values
        ('field_contributor', 'submit_field_capture'),
        ('field_contributor', 'read_own_field_capture'),
        ('administrator', 'submit_field_capture'),
        ('administrator', 'read_own_field_capture'),
        ('administrator', 'view_field_intake'),
        ('administrator', 'view_restricted_field_sources'),
        ('editor', 'view_field_intake'),
        ('editor', 'view_restricted_field_sources'),
        ('reviewer', 'view_field_intake')
    ) expected(role_key, capability_key)
    where not exists (
      select 1
      from public.role_capabilities actual
      where actual.role_key = expected.role_key
        and actual.capability_key = expected.capability_key
    )
  ) then
    raise exception
      'One or more expected Field role assignments are missing';
  end if;

  if exists (
    select 1
    from public.role_capabilities actual
    where actual.capability_key in (
      'submit_field_capture',
      'read_own_field_capture',
      'view_field_intake',
      'view_restricted_field_sources'
    )
      and not exists (
        select 1
        from (
          values
            ('field_contributor', 'submit_field_capture'),
            ('field_contributor', 'read_own_field_capture'),
            ('administrator', 'submit_field_capture'),
            ('administrator', 'read_own_field_capture'),
            ('administrator', 'view_field_intake'),
            ('administrator', 'view_restricted_field_sources'),
            ('editor', 'view_field_intake'),
            ('editor', 'view_restricted_field_sources'),
            ('reviewer', 'view_field_intake')
        ) expected(role_key, capability_key)
        where expected.role_key = actual.role_key
          and expected.capability_key = actual.capability_key
      )
  ) then
    raise exception
      'An unintended role received a Field capability';
  end if;

  if exists (
    select 1
    from public.role_capabilities
    where role_key = 'field_contributor'
      and capability_key in (
        'manage_media_assets',
        'manage_media_usage',
        'view_media_records',
        'review_media_governance'
      )
  ) then
    raise exception
      'field_contributor received forbidden Media authority';
  end if;

  v_expected_columns := array[
    'resource_id:uuid:NO',
    'resource_kind:text:NO',
    'submission_reference:text:NO',
    'owner_user_id:uuid:NO',
    'submitter_mode:text:NO',
    'current_revision:int8:NO',
    'submission_state:text:NO',
    'newsroom_identity_mode:text:NO',
    'public_attribution_preference:text:NO',
    'contact_preference:text:NO',
    'rights_declaration:text:NO',
    'rights_declaration_detail:text:YES',
    'consent_declaration:text:NO',
    'consent_declaration_detail:text:YES',
    'declared_sensitivity:text:NO',
    'source_protection_request:text:NO',
    'embargo_request_mode:text:NO',
    'requested_embargo_until:timestamptz:YES',
    'location_mode:text:NO',
    'location_description:text:YES',
    'content_captured_at:timestamptz:YES',
    'intake_notes:text:YES',
    'created_by:uuid:NO',
    'updated_by:uuid:NO',
    'created_at:timestamptz:NO',
    'updated_at:timestamptz:NO',
    'received_at:timestamptz:YES',
    'submitted_at:timestamptz:YES',
    'cancelled_at:timestamptz:YES',
    'expired_at:timestamptz:YES',
    'receipt_issued_at:timestamptz:YES',
    'correlation_id:uuid:NO'
  ];

  select array_agg(
    column_name || ':' || udt_name || ':' || is_nullable
    order by ordinal_position
  )
  into v_actual_columns
  from information_schema.columns
  where table_schema = 'editorial'
    and table_name = 'field_submissions';

  if v_actual_columns is distinct from v_expected_columns then
    raise exception
      'editorial.field_submissions column contract drifted. Expected %, found %',
      v_expected_columns,
      v_actual_columns;
  end if;

  v_expected_event_columns := array[
    'id:uuid:NO',
    'submission_resource_id:uuid:NO',
    'event_type:text:NO',
    'actor_user_id:uuid:YES',
    'command_receipt_id:uuid:YES',
    'media_intake_id:uuid:YES',
    'reason:text:YES',
    'prior_state:jsonb:YES',
    'resulting_state:jsonb:YES',
    'correlation_id:uuid:NO',
    'created_at:timestamptz:NO'
  ];

  select array_agg(
    column_name || ':' || udt_name || ':' || is_nullable
    order by ordinal_position
  )
  into v_actual_event_columns
  from information_schema.columns
  where table_schema = 'editorial'
    and table_name = 'field_submission_events';

  if v_actual_event_columns is distinct from v_expected_event_columns then
    raise exception
      'editorial.field_submission_events column contract drifted. Expected %, found %',
      v_expected_event_columns,
      v_actual_event_columns;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'editorial'
      and table_name = 'field_submissions'
      and column_name in (
        'latitude',
        'longitude',
        'altitude',
        'gps_accuracy',
        'device_location_token'
      )
  ) then
    raise exception
      'Exact device geolocation leaked into the Phase 8A.2A schema';
  end if;

  if (
    select count(*)
    from editorial.field_submission_event_types
  ) <> 12 then
    raise exception
      'Unexpected Field Submission event type count';
  end if;

  if exists (
    select 1
    from (
      values
        ('submission_created'),
        ('declaration_updated'),
        ('upload_session_attached'),
        ('upload_resumed'),
        ('media_verified'),
        ('media_attached'),
        ('submission_received'),
        ('submission_finalized'),
        ('receipt_issued'),
        ('submission_cancelled'),
        ('media_intake_expired'),
        ('submission_expired')
    ) expected(event_type)
    where not exists (
      select 1
      from editorial.field_submission_event_types actual
      where actual.event_type = expected.event_type
        and actual.enabled
    )
  ) then
    raise exception
      'Field Submission event vocabulary is incomplete';
  end if;

  if exists (
    select 1
    from (
      values
        ('field_submissions_resource_fkey', 'editorial.resources'::regclass, 'r'),
        ('field_submission_events_submission_fkey', 'editorial.field_submissions'::regclass, 'r'),
        ('field_submission_events_type_fkey', 'editorial.field_submission_event_types'::regclass, 'r'),
        ('field_submission_events_receipt_fkey', 'platform_private.command_receipts'::regclass, 'r')
    ) expected(constraint_name, referenced_relation, delete_action)
    where not exists (
      select 1
      from pg_constraint constraint_row
      where constraint_row.conname = expected.constraint_name
        and constraint_row.confrelid = expected.referenced_relation
        and constraint_row.confdeltype = expected.delete_action
    )
  ) then
    raise exception
      'One or more Field identity foreign keys are missing or unsafe';
  end if;

  if exists (
    select 1
    from (
      values
        ('field_submissions_owner_created_idx'),
        ('field_submissions_state_updated_idx'),
        ('field_submissions_identity_mode_state_idx'),
        ('field_submission_events_submission_created_idx'),
        ('field_submission_events_receipt_idx')
    ) expected(index_name)
    where not exists (
      select 1
      from pg_indexes actual
      where actual.schemaname = 'editorial'
        and actual.indexname = expected.index_name
    )
  ) then
    raise exception
      'One or more Phase 8A.2A Field indexes are missing';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    join pg_class relation
      on relation.oid = trigger_row.tgrelid
    join pg_namespace namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'editorial'
      and relation.relname = 'field_submission_events'
      and trigger_row.tgname = 'field_submission_events_append_only'
      and not trigger_row.tgisinternal
  ) then
    raise exception
      'Field Submission event append-only trigger is missing';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    join pg_class relation
      on relation.oid = trigger_row.tgrelid
    join pg_namespace namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'editorial'
      and relation.relname = 'field_submissions'
      and trigger_row.tgname = 'field_submissions_resource_binding_integrity'
      and trigger_row.tgconstraint <> 0
      and trigger_row.tgdeferrable
      and trigger_row.tginitdeferred
      and not trigger_row.tgisinternal
  ) then
    raise exception
      'Field Submission deferred Resource binding trigger is missing';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    join pg_class relation
      on relation.oid = trigger_row.tgrelid
    join pg_namespace namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'editorial'
      and relation.relname = 'field_submissions'
      and trigger_row.tgname = 'field_submissions_protect_mutation'
      and not trigger_row.tgisinternal
  ) then
    raise exception
      'Field Submission aggregate mutation trigger is missing';
  end if;

  v_binding_definition := pg_get_functiondef(
    'editorial.assert_resource_binding_integrity()'::regprocedure
  );

  if position('when ''field_submission''' in v_binding_definition) = 0
     or position('from editorial.field_submissions' in v_binding_definition) = 0
     or position('when ''article''' in v_binding_definition) = 0
     or position('when ''playlist''' in v_binding_definition) = 0
     or position('when ''playlist_item''' in v_binding_definition) = 0
     or position('when ''registry_artist''' in v_binding_definition) = 0
     or position('when ''correction_case''' in v_binding_definition) = 0
     or position('when ''media_asset''' in v_binding_definition) = 0
     or position('when ''person''' in v_binding_definition) = 0
     or position('when ''organization''' in v_binding_definition) = 0
     or position('when ''audio_show''' in v_binding_definition) = 0
     or position('when ''audio_season''' in v_binding_definition) = 0
     or position('when ''audio_episode''' in v_binding_definition) = 0
     or position('when ''standalone_audio''' in v_binding_definition) = 0
     or position('when ''show''' in v_binding_definition) = 0
     or position('when ''show_episode''' in v_binding_definition) = 0
     or position('when ''video_episode''' in v_binding_definition) = 0
     or position('when ''standalone_video''' in v_binding_definition) = 0
  then
    raise exception
      'Shared Resource binding integrity does not preserve exact predecessor support plus field_submission';
  end if;

  if not exists (
    select 1
    from pg_proc procedure_row
    join pg_namespace namespace
      on namespace.oid = procedure_row.pronamespace
    where namespace.nspname = 'editorial'
      and procedure_row.proname = 'assert_resource_binding_integrity'
      and procedure_row.prosecdef
  ) then
    raise exception
      'Resource binding integrity lost SECURITY DEFINER execution';
  end if;

  if exists (
    select 1
    from (
      values
        ('field.submission.create'),
        ('field.submission.declarations.update'),
        ('field.submission.cancel')
    ) expected(command_type)
    where not exists (
      select 1
      from platform_private.command_types actual
      where actual.command_type = expected.command_type
        and actual.enabled
    )
  ) then
    raise exception
      'Phase 8A.2A Field command vocabulary is incomplete';
  end if;

  if to_regprocedure('public.create_field_submission_v1(jsonb,text,uuid)') is null
     or to_regprocedure(
       'public.update_field_submission_declarations_v1(uuid,bigint,jsonb,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.cancel_field_submission_v1(uuid,bigint,text,text,uuid)'
     ) is null
     or to_regprocedure('public.get_my_field_submission_v1(uuid)') is null
     or to_regprocedure('public.get_field_submission_intake_v1(uuid)') is null
  then
    raise exception
      'One or more Phase 8A.2A public Field RPCs are missing';
  end if;

  v_create_definition := pg_get_functiondef(
    'public.create_field_submission_v1(jsonb,text,uuid)'::regprocedure
  );

  if position('platform_private.command_receipts' in v_create_definition) = 0
     or position('for update' in lower(v_create_definition)) = 0
     or position('pg_advisory_xact_lock' in v_create_definition) = 0
     or position('platform_private.command_request_fingerprint' in v_create_definition) = 0
     or position('platform_private.begin_authenticated_resource_command' in v_create_definition) = 0
     or position('platform_private.complete_resource_command' in v_create_definition) = 0
     or position('submission_created' in v_create_definition) = 0
     or position('owner_id' in v_create_definition) = 0
     or position('''private''' in v_create_definition) = 0
  then
    raise exception
      'Field create command lost idempotency, receipt, ownership, or event authority';
  end if;

  v_update_definition := pg_get_functiondef(
    'public.update_field_submission_declarations_v1(uuid,bigint,jsonb,text,uuid)'::regprocedure
  );

  if position('p_expected_current_revision' in v_update_definition) = 0
     or position('field_revision_changed' in v_update_definition) = 0
     or position('declaration_updated' in v_update_definition) = 0
     or position('current_revision = field.current_revision + 1' in v_update_definition) = 0
     or position('platform_private.begin_authenticated_resource_command' in v_update_definition) = 0
     or position('platform_private.reject_resource_command' in v_update_definition) = 0
  then
    raise exception
      'Field declaration update lost optimistic concurrency or durable command authority';
  end if;

  v_cancel_definition := pg_get_functiondef(
    'public.cancel_field_submission_v1(uuid,bigint,text,text,uuid)'::regprocedure
  );

  if position('submission_cancelled' in v_cancel_definition) = 0
     or position('field_revision_changed' in v_cancel_definition) = 0
     or position('submission_state = ''cancelled''' in v_cancel_definition) = 0
     or position('current_revision = field.current_revision + 1' in v_cancel_definition) = 0
     or position('platform_private.begin_authenticated_resource_command' in v_cancel_definition) = 0
  then
    raise exception
      'Field cancellation lost lifecycle, event, or durable command authority';
  end if;

  v_mutation_definition := pg_get_functiondef(
    'editorial.protect_field_submission_mutation()'::regprocedure
  );

  if position('Terminal Field Submission state is immutable' in v_mutation_definition) = 0
     or position('current_revision <> old.current_revision + 1' in v_mutation_definition) = 0
     or position('receiving' in v_mutation_definition) = 0
     or position('received' in v_mutation_definition) = 0
     or position('submitted' in v_mutation_definition) = 0
     or position('cancelled' in v_mutation_definition) = 0
     or position('expired' in v_mutation_definition) = 0
  then
    raise exception
      'Field aggregate lifecycle or terminal-state protection drifted';
  end if;

  v_own_read_definition := pg_get_functiondef(
    'public.get_my_field_submission_v1(uuid)'::regprocedure
  );

  if position('read_own_field_capture' in v_own_read_definition) = 0
     or position('field.owner_user_id = v_actor' in v_own_read_definition) = 0
     or position('resource_row.owner_id = v_actor' in v_own_read_definition) = 0
     or position('resource_row.visibility = ''private''' in v_own_read_definition) = 0
  then
    raise exception
      'Own Field read does not prove capability plus dual ownership';
  end if;

  v_internal_read_definition := pg_get_functiondef(
    'public.get_field_submission_intake_v1(uuid)'::regprocedure
  );

  if position('view_field_intake' in v_internal_read_definition) = 0
     or position('view_restricted_field_sources' in v_internal_read_definition) = 0
     or position('newsroom_identity_mode = ''restricted''' in v_internal_read_definition) = 0
     or position('then null::uuid' in lower(v_internal_read_definition)) = 0
  then
    raise exception
      'Restricted Field source identity gating drifted';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants grant_row
    where grant_row.table_schema = 'editorial'
      and grant_row.table_name in (
        'field_submission_event_types',
        'field_submissions',
        'field_submission_events'
      )
      and grant_row.grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
      and grant_row.privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')
  ) then
    raise exception
      'A browser or service role has direct Field table authority';
  end if;

  if has_function_privilege(
       'anon',
       'public.create_field_submission_v1(jsonb,text,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.get_my_field_submission_v1(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.create_field_submission_v1(jsonb,text,uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'Field public RPC execution grants are broader than authenticated callers';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.create_field_submission_v1(jsonb,text,uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.update_field_submission_declarations_v1(uuid,bigint,jsonb,text,uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.cancel_field_submission_v1(uuid,bigint,text,text,uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.get_my_field_submission_v1(uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.get_field_submission_intake_v1(uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'Authenticated Field RPC execution grants are incomplete';
  end if;

  if to_regclass('editorial.field_submission_versions') is not null
     or exists (
       select 1
       from editorial.resource_version_types
       where version_type like 'field_submission%'
     )
  then
    raise exception
      'Field Submission received deferred Resource Version authority';
  end if;

  if exists (
    select 1
    from editorial.resource_aliases alias_row
    join editorial.resources resource_row
      on resource_row.id = alias_row.resource_id
    where resource_row.resource_kind = 'field_submission'
  ) then
    raise exception
      'Field Submission received a public route alias';
  end if;
end;
$verify_phase_8a_field_submission_identity$;
