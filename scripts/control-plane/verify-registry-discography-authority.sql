-- Read-only verifier for #945 Gate A Discography Exact-Set Authority V1.
-- Safe for clean Preview and Production after the candidate migrations exist.

do $verify$
declare
  v_count integer;
  v_operation platform_private.registry_operation_types%rowtype;
  v_definition text;
  v_role text;
  v_signature text;
begin
  if to_regclass('platform_private.registry_evidence_assertions') is null
     or to_regclass('platform_private.registry_execution_grants') is null
     or to_regclass('platform_private.registry_execution_grant_targets') is null
     or to_regclass('platform_private.registry_mutation_operations') is null
     or to_regclass('platform_private.registry_operation_write_events') is null
     or to_regclass('platform_private.registry_discography_provider_snapshots') is null
     or to_regclass('platform_private.registry_discography_review_plans') is null
  then
    raise exception 'Discography V1 governance substrate is missing';
  end if;

  -- Discography must fit around the accepted shared governance envelopes rather
  -- than widening them for large provider observations or exact-set plans.
  if not exists (
       select 1
       from pg_constraint constraint_row
       where constraint_row.conrelid='platform_private.registry_evidence_assertions'::regclass
         and pg_get_constraintdef(constraint_row.oid) like '%octet_length%16384%'
     )
     or not exists (
       select 1
       from pg_constraint constraint_row
       where constraint_row.conrelid='platform_private.registry_execution_grants'::regclass
         and pg_get_constraintdef(constraint_row.oid) like '%octet_length%32768%'
     )
  then
    raise exception 'Shared Registry evidence/grant payload ceilings drifted';
  end if;

  if not exists (
       select 1
       from pg_constraint constraint_row
       where constraint_row.conrelid='platform_private.registry_discography_provider_snapshots'::regclass
         and pg_get_constraintdef(constraint_row.oid) like '%2097152%'
     )
     or not exists (
       select 1
       from pg_constraint constraint_row
       where constraint_row.conrelid='platform_private.registry_discography_review_plans'::regclass
         and pg_get_constraintdef(constraint_row.oid) like '%131072%'
     )
     or not exists (
       select 1
       from pg_constraint constraint_row
       where constraint_row.conrelid='platform_private.registry_discography_review_plans'::regclass
         and pg_get_constraintdef(constraint_row.oid) like '%4194304%'
     )
  then
    raise exception 'Discography immutable storage payload ceilings drifted';
  end if;

  if not exists (
       select 1
       from pg_trigger trigger_row
       where trigger_row.tgrelid='platform_private.registry_discography_provider_snapshots'::regclass
         and trigger_row.tgname='registry_discography_provider_snapshots_immutable'
         and not trigger_row.tgisinternal
         and trigger_row.tgenabled<>'D'
     )
     or not exists (
       select 1
       from pg_trigger trigger_row
       where trigger_row.tgrelid='platform_private.registry_discography_review_plans'::regclass
         and trigger_row.tgname='registry_discography_review_plans_immutable'
         and not trigger_row.tgisinternal
         and trigger_row.tgenabled<>'D'
     )
  then
    raise exception 'Discography immutable storage mutation guards are missing';
  end if;

  foreach v_role in array array['public','anon','authenticated','service_role']
  loop
    if has_table_privilege(v_role,'platform_private.registry_discography_provider_snapshots','SELECT')
       or has_table_privilege(v_role,'platform_private.registry_discography_provider_snapshots','INSERT')
       or has_table_privilege(v_role,'platform_private.registry_discography_provider_snapshots','UPDATE')
       or has_table_privilege(v_role,'platform_private.registry_discography_provider_snapshots','DELETE')
       or has_table_privilege(v_role,'platform_private.registry_discography_provider_snapshots','TRUNCATE')
       or has_table_privilege(v_role,'platform_private.registry_discography_review_plans','SELECT')
       or has_table_privilege(v_role,'platform_private.registry_discography_review_plans','INSERT')
       or has_table_privilege(v_role,'platform_private.registry_discography_review_plans','UPDATE')
       or has_table_privilege(v_role,'platform_private.registry_discography_review_plans','DELETE')
       or has_table_privilege(v_role,'platform_private.registry_discography_review_plans','TRUNCATE')
    then
      raise exception 'Discography immutable storage leaked table authority to role %',v_role;
    end if;
  end loop;

  select count(*)::integer
  into v_count
  from public.capability_definitions
  where capability_key in (
    'apply_registry_discography_plan',
    'admit_registry_release_provider_profile',
    'admit_registry_track_provider_profile',
    'admit_registry_artist_discography_summary',
    'replace_registry_release_artist_set',
    'replace_registry_release_track_set',
    'replace_registry_track_artist_credit_set',
    'activate_registry_release',
    'reconcile_registry_draft_identity',
    'reconcile_registry_release_identity'
  )
    and domain = 'registry';

  if v_count <> 10 then
    raise exception 'Discography V1 capability vocabulary is incomplete';
  end if;

  if exists (
    select 1
    from public.role_capabilities
    where capability_key in (
      'apply_registry_discography_plan',
      'admit_registry_release_provider_profile',
      'admit_registry_track_provider_profile',
      'admit_registry_artist_discography_summary',
      'replace_registry_release_artist_set',
      'replace_registry_release_track_set',
      'replace_registry_track_artist_credit_set',
      'activate_registry_release',
      'reconcile_registry_draft_identity',
      'reconcile_registry_release_identity'
    )
  ) then
    raise exception 'Discography V1 internal operation capability leaked into a standing product role';
  end if;

  select count(*)::integer
  into v_count
  from platform_private.registry_operation_types
  where operation_key in (
    'registry.discography.apply',
    'registry.release.provider_profile.admit',
    'registry.track.provider_profile.admit',
    'registry.artist.discography_summary.admit',
    'registry.release_artist_set.replace',
    'registry.release_track_set.replace',
    'registry.track_artist_credit_set.replace',
    'registry.release.activate',
    'registry.draft_identity.reconcile',
    'registry.release.identity.reconcile'
  );

  if v_count <> 10 then
    raise exception 'Discography V1 operation family is incomplete';
  end if;

  for v_operation in
    select *
    from platform_private.registry_operation_types
    where operation_key in (
      'registry.discography.apply',
      'registry.release.provider_profile.admit',
      'registry.track.provider_profile.admit',
      'registry.artist.discography_summary.admit',
      'registry.release_artist_set.replace',
      'registry.release_track_set.replace',
      'registry.track_artist_credit_set.replace',
      'registry.release.activate',
      'registry.draft_identity.reconcile',
      'registry.release.identity.reconcile'
    )
  loop
    if v_operation.operation_version <> 1
       or v_operation.max_targets <> 1
       or v_operation.max_grant_ttl_seconds <> 300
       or not v_operation.requires_existing_target
       or not v_operation.requires_human_approval
       or not v_operation.requires_verifier
       or not v_operation.enabled
    then
      raise exception 'Discography V1 operation semantics drifted: %', v_operation.operation_key;
    end if;
  end loop;

  if exists (
    select 1
    from platform_private.registry_operation_types operation_type
    where operation_type.operation_key in (
      'registry.discography.apply',
      'registry.release.provider_profile.admit',
      'registry.track.provider_profile.admit',
      'registry.artist.discography_summary.admit',
      'registry.release_artist_set.replace',
      'registry.release_track_set.replace',
      'registry.track_artist_credit_set.replace',
      'registry.release.activate',
      'registry.draft_identity.reconcile',
      'registry.release.identity.reconcile'
    )
      and (
        (operation_type.operation_key = 'registry.discography.apply'
          and (operation_type.capability_key <> 'apply_registry_discography_plan'
            or operation_type.risk_class <> 'high'
            or operation_type.allowed_subject_types <> array['artist']::text[]
            or operation_type.max_rows_ceiling <> 1000))
        or (operation_type.operation_key = 'registry.release.provider_profile.admit'
          and (operation_type.capability_key <> 'admit_registry_release_provider_profile'
            or operation_type.risk_class <> 'medium'
            or operation_type.allowed_subject_types <> array['release']::text[]
            or operation_type.max_rows_ceiling <> 1))
        or (operation_type.operation_key = 'registry.track.provider_profile.admit'
          and (operation_type.capability_key <> 'admit_registry_track_provider_profile'
            or operation_type.risk_class <> 'medium'
            or operation_type.allowed_subject_types <> array['track']::text[]
            or operation_type.max_rows_ceiling <> 1))
        or (operation_type.operation_key = 'registry.artist.discography_summary.admit'
          and (operation_type.capability_key <> 'admit_registry_artist_discography_summary'
            or operation_type.risk_class <> 'medium'
            or operation_type.allowed_subject_types <> array['artist']::text[]
            or operation_type.max_rows_ceiling <> 1))
        or (operation_type.operation_key = 'registry.release_artist_set.replace'
          and (operation_type.capability_key <> 'replace_registry_release_artist_set'
            or operation_type.risk_class <> 'high'
            or operation_type.allowed_subject_types <> array['release']::text[]
            or operation_type.max_rows_ceiling <> 64))
        or (operation_type.operation_key = 'registry.release_track_set.replace'
          and (operation_type.capability_key <> 'replace_registry_release_track_set'
            or operation_type.risk_class <> 'high'
            or operation_type.allowed_subject_types <> array['release']::text[]
            or operation_type.max_rows_ceiling <> 400))
        or (operation_type.operation_key = 'registry.track_artist_credit_set.replace'
          and (operation_type.capability_key <> 'replace_registry_track_artist_credit_set'
            or operation_type.risk_class <> 'high'
            or operation_type.allowed_subject_types <> array['track']::text[]
            or operation_type.max_rows_ceiling <> 64))
        or (operation_type.operation_key = 'registry.release.activate'
          and (operation_type.capability_key <> 'activate_registry_release'
            or operation_type.risk_class <> 'medium'
            or operation_type.allowed_subject_types <> array['release']::text[]
            or operation_type.max_rows_ceiling <> 1))
        or (operation_type.operation_key = 'registry.draft_identity.reconcile'
          and (operation_type.capability_key <> 'reconcile_registry_draft_identity'
            or operation_type.risk_class <> 'medium'
            or operation_type.allowed_subject_types <> array['track','release']::text[]
            or operation_type.max_rows_ceiling <> 1))
        or (operation_type.operation_key = 'registry.release.identity.reconcile'
          and (operation_type.capability_key <> 'reconcile_registry_release_identity'
            or operation_type.risk_class <> 'medium'
            or operation_type.allowed_subject_types <> array['release']::text[]
            or operation_type.max_rows_ceiling <> 1))
      )
  ) then
    raise exception 'Discography V1 operation capability/risk/ceiling mapping drifted';
  end if;

  if not exists (
    select 1
    from platform_private.registry_operation_types operation_type
    where operation_type.operation_key = 'registry.release.create'
      and operation_type.operation_version = 1
      and operation_type.capability_key = 'create_registry_release'
      and operation_type.allowed_subject_types = array['release']::text[]
      and operation_type.max_targets = 1
      and operation_type.max_rows_ceiling = 1
      and operation_type.max_grant_ttl_seconds = 300
      and not operation_type.requires_existing_target
      and operation_type.requires_human_approval
      and operation_type.requires_verifier
      and operation_type.enabled
  ) then
    raise exception 'Release Create V1 is not enabled with its accepted identity-only contract';
  end if;

  if not exists (
    select 1
    from platform_private.system_actors actor
    where actor.actor_key = 'registry_discography_admin'
      and actor.actor_kind = 'automation'
      and actor.status = 'active'
      and actor.capability_profile ->> 'authority_mode' = 'human_exact_grant'
      and actor.capability_profile ->> 'required_user_capability' = 'manage_registry'
  )
     or not exists (
       select 1
       from platform_private.system_actor_executor_bindings binding
       where binding.actor_key = 'registry_discography_admin'
         and binding.executor_kind = 'database_role'
         and binding.executor_key = 'authenticator'
         and binding.status = 'active'
     )
  then
    raise exception 'Discography V1 admin broker binding drifted';
  end if;

  foreach v_signature in array array[
    'platform_private.registry_release_artist_set_v1(uuid)',
    'platform_private.registry_release_track_set_v1(uuid)',
    'platform_private.registry_track_artist_credit_set_v1(uuid)',
    'platform_private.registry_discography_set_fingerprint_v1(jsonb)',
    'platform_private.issue_registry_discography_user_execution_grant_v1(uuid,text,text,uuid,jsonb,text,integer)',
    'platform_private.registry_discography_observation_fingerprint_v1(jsonb)',
    'platform_private.registry_discography_validate_observation_v1(uuid,jsonb,text)',
    'platform_private.record_registry_discography_provider_evidence_v1(uuid,jsonb,text)',
    'platform_private.freeze_registry_discography_review_plan_v1(uuid,uuid,jsonb)',
    'platform_private.registry_discography_build_frozen_plan_v1(uuid,uuid,uuid,jsonb)',
    'platform_private.registry_discography_build_frozen_plan_pre_selective_v1(uuid,uuid,uuid,jsonb)',
    'platform_private.registry_discography_build_frozen_plan_core_v1(uuid,uuid,uuid,jsonb)',
    'platform_private.issue_registry_reviewed_admission_grant_v1(uuid,text,text,uuid,jsonb,text)',
    'platform_private.registry_reviewed_release_slug_v2(text,text,date,text,uuid,uuid,jsonb,jsonb)',
    'platform_private.execute_registry_reviewed_identity_reconciliation_v1(text,uuid)',
    'platform_private.verify_registry_reviewed_identity_reconciliation_v1(uuid)',
    'platform_private.execute_registry_reviewed_release_identity_reconciliation_v1(text,uuid)',
    'platform_private.verify_registry_reviewed_release_identity_reconciliation_v1(uuid)',
    'platform_private.execute_registry_reviewed_lifecycle_v1(text,uuid)',
    'platform_private.verify_registry_reviewed_lifecycle_v1(uuid)',
    'platform_private.execute_registry_discography_operation_v1(uuid)',
    'platform_private.verify_registry_discography_operation_v1(uuid)',
    'platform_private.verify_registry_discography_operation_core_v1(uuid)',
    'mizizi_private.registry_reviewed_admission_sentry_v1(uuid)',
    'public.admin_prepare_registry_discography_evidence_v1(uuid,jsonb,text)',
    'public.admin_preview_registry_discography_evidence_v1(uuid)',
    'public.admin_create_registry_discography_artist_shell_v1(uuid,text)',
    'public.admin_execute_registry_discography_evidence_v1(uuid,uuid,jsonb)',
    'public.admin_verify_registry_discography_operation_v1(uuid)'
  ]
  loop
    if to_regprocedure(v_signature) is null then
      raise exception 'Discography V1 function authority is incomplete: %',v_signature;
    end if;
  end loop;

  select pg_get_functiondef(to_regprocedure('platform_private.execute_registry_materialization_v1(text,uuid)'))
  into v_definition;
  if position('registry.release.create' in v_definition) = 0
     or position('insert into public.registry_releases' in lower(v_definition)) = 0
  then
    raise exception 'Shared materialization executor does not implement Release Create V1';
  end if;

  select pg_get_functiondef(to_regprocedure('platform_private.verify_registry_materialization_v1(uuid)'))
  into v_definition;
  if position('registry.release.create' in v_definition) = 0 then
    raise exception 'Shared materialization verifier does not implement Release Create V1';
  end if;

  select regexp_replace(
    pg_get_functiondef(
      to_regprocedure('platform_private.registry_discography_validate_observation_v1(uuid,jsonb,text)')
    ),
    '[[:space:]]+',
    ' ',
    'g'
  ) into v_definition;
  if position('p_source_payload_fingerprint' in v_definition)=0
     or position('acquired_at' in v_definition)=0
  then
    raise exception 'Discography provider evidence does not bind source payload fingerprint and acquisition time';
  end if;

  select pg_get_functiondef(
    to_regprocedure(
      'platform_private.registry_discography_resolve_artist_name_v1(text)'
    )
  ) into v_definition;

  if position('registry_artist_aliases' in v_definition)=0
     or position('canonical_artist_id' in v_definition)=0
     or position('alias_display_name' in v_definition)=0
  then
    raise exception 'Discography Artist resolution ignores active canonical alias authority';
  end if;

  if to_regprocedure(
       'platform_private.registry_discography_resolve_artist_credit_v1(text)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_discography_title_feature_credit_includes_artist_v1(text,text)'
     ) is null
  then
    raise exception 'Discography credited-name identity helpers are missing';
  end if;

  select pg_get_functiondef(
    to_regprocedure(
      'platform_private.registry_discography_track_artist_desired_v1(uuid,uuid,text,jsonb)'
    )
  ) into v_definition;

  if position('registry_discography_resolve_artist_credit_v1' in v_definition)=0
     or position('registry_discography_title_feature_credit_includes_artist_v1' in v_definition)=0
  then
    raise exception 'Discography Track Artist credit identity/role convergence drifted';
  end if;

  if exists (
    select 1
    from public.registry_track_artists credit
    join public.registry_artist_aliases alias
      on lower(alias.alias_slug)=lower(credit.artist_slug)
     and alias.status='active'
    join public.registry_artists canonical
      on canonical.id=alias.canonical_artist_id
     and canonical.status<>'archived'
    where credit.artist_id is null
      and credit.status='active'
  ) then
    raise exception 'Known active Artist alias remains text-only in Track credits';
  end if;

  if exists (
    select 1
    from public.registry_release_artists credit
    join public.registry_artist_aliases alias
      on lower(alias.alias_slug)=lower(credit.artist_slug)
     and alias.status='active'
    join public.registry_artists canonical
      on canonical.id=alias.canonical_artist_id
     and canonical.status<>'archived'
    where credit.artist_id is null
      and credit.status='active'
  ) then
    raise exception 'Known active Artist alias remains text-only in Release credits';
  end if;

  -- Release Artist primary-credit parsing must preserve the primary side of a
  -- featured credit without promoting the featured side to primary.
  if not platform_private.registry_discography_credit_includes_artist_v1(
       'Primary Artist feat. Guest Artist',
       'Primary Artist'
     )
     or platform_private.registry_discography_credit_includes_artist_v1(
       'Primary Artist feat. Guest Artist',
       'Guest Artist'
     )
     or not platform_private.registry_discography_credit_includes_artist_v1(
       'Primary Artist & Guest Artist',
       'Guest Artist'
     )
  then
    raise exception 'Discography Release Artist primary-credit parsing drifted';
  end if;

  -- Multiple selected provider Albums must not resolve to one canonical Track
  -- with conflicting provider-profile facts.
  select pg_get_functiondef(
    to_regprocedure('platform_private.registry_discography_build_frozen_plan_core_v1(uuid,uuid,uuid,jsonb)')
  ) into v_definition;
  if position('v_track_buckets->v_track_key' in v_definition)=0
     or position('is distinct from v_profile' in v_definition)=0
     or position(
       'Selected provider Albums resolve to one canonical Track with conflicting provider profile facts.'
       in v_definition
     )=0
  then
    raise exception 'Discography canonical Track provider-profile ambiguity guard drifted';
  end if;

  -- Reviewed admission must require an exhaustive decision set, allow Leave-all,
  -- compose draft identity reconciliation + active lifecycle, and bind parent
  -- finalization to the MIZIZI sentry.
  select pg_get_functiondef(
    to_regprocedure(
      'platform_private.registry_discography_normalize_reviewed_selections_v1(uuid,jsonb,jsonb)'
    )
  ) into v_definition;
  if position(
       'Every observed Release requires one explicit Discography review decision.'
       in v_definition
     )=0
     or position('plan cannot ignore every Album' in v_definition)>0
  then
    raise exception 'Discography exhaustive explicit-review authority drifted';
  end if;

  select pg_get_functiondef(
    to_regprocedure(
      'platform_private.registry_discography_build_frozen_plan_v1(uuid,uuid,uuid,jsonb)'
    )
  ) into v_definition;
  if position(
       'registry_discography_build_frozen_plan_pre_selective_v1'
       in v_definition
     )=0
     or position('v_existing_album_ids' in v_definition)=0
     or position('v_union_album_ids' in v_definition)=0
     or position('apple_music_album_ids' in v_definition)=0
  then
    raise exception 'Discography cumulative provider-ledger wrapper drifted';
  end if;

  select pg_get_functiondef(
    to_regprocedure(
      'platform_private.registry_discography_build_frozen_plan_pre_selective_v1(uuid,uuid,uuid,jsonb)'
    )
  ) into v_definition;
  if position('active_ingest_v2' in v_definition)=0
     or position('registry.track.activate' in v_definition)=0
     or position('registry.release.activate' in v_definition)=0
     or position('registry.draft_identity.reconcile' in v_definition)=0
     or position('registry.release.identity.reconcile' in v_definition)=0
     or position('registry_reviewed_release_slug_v2' in v_definition)=0
  then
    raise exception 'Discography active-ingest terminal predecessor drifted';
  end if;

  select pg_get_functiondef(
    to_regprocedure(
      'platform_private.registry_track_creation_slug_v1(text,uuid)'
    )
  ) into v_definition;
  if position('|| v_artist_slug' in v_definition)>0
     or position('||v_artist_slug' in v_definition)>0
  then
    raise exception 'Track creation still duplicates Artist scope inside Track slug identity';
  end if;

  select pg_get_functiondef(
    to_regprocedure(
      'platform_private.registry_release_creation_slug_v1(text,uuid)'
    )
  ) into v_definition;
  if position('|| v_artist_slug' in v_definition)>0
     or position('||v_artist_slug' in v_definition)>0
  then
    raise exception 'Release creation still duplicates Artist scope inside Release slug identity';
  end if;

  select pg_get_functiondef(
    to_regprocedure(
      'mizizi_private.registry_reviewed_admission_sentry_v1(uuid)'
    )
  ) into v_definition;
  if position('accepted_release_not_active' in v_definition)=0
     or position('accepted_track_not_active' in v_definition)=0
     or position('left_release_escaped_into_canonical_plan' in v_definition)=0
  then
    raise exception 'MIZIZI reviewed-admission terminal sentry drifted';
  end if;

  -- Exact grants must use semantic idempotency keys, never a state fingerprint
  -- or null in the idempotency-key argument slot.
  select regexp_replace(
    pg_get_functiondef(
      to_regprocedure('public.admin_execute_registry_discography_evidence_v1(uuid,uuid,jsonb)')
    ),
    '[[:space:]]+',
    ' ',
    'g'
  ) into v_definition;
  v_definition := regexp_replace(v_definition,'[[:space:]]+','','g');
  if position('v_grant_plan,v_expected_state,v_max_rows' in v_definition)>0
     or position('v_grant_plan,null,1' in v_definition)>0
     or position('v_parent_plan,v_expected_state,1' in v_definition)>0
     or position('v_grant_plan,v_idempotency_key,v_max_rows' in v_definition)=0
     or position('v_parent_plan,v_parent_idempotency,1' in v_definition)=0
  then
    raise exception 'Discography reviewed execution is not bound to semantic idempotency-key authority';
  end if;

  if position('release_identity_reconciliation' in v_definition)=0
     or position('v_receipts:=''[]''::jsonb' in v_definition)=0
     or position('v_errors:=jsonb_build_array' in v_definition)=0
     or position('v_errors:=v_errors||to_jsonb(v_child_ref' in v_definition)>0
  then
    raise exception 'Discography reviewed execution lost its atomic canonical admission boundary';
  end if;

  select regexp_replace(
    pg_get_functiondef(
      to_regprocedure('public.admin_create_registry_discography_artist_shell_v1(uuid,text)')
    ),
    '[[:space:]]+',
    ' ',
    'g'
  ) into v_definition;
  v_definition := regexp_replace(v_definition,'[[:space:]]+','','g');
  if position('v_plan,null,1' in v_definition)>0
     or position('v_plan,v_idempotency_key,1' in v_definition)=0
  then
    raise exception 'Discography Artist-shell grant is not bound to its semantic idempotency key';
  end if;

  foreach v_signature in array array[
    'platform_private.issue_registry_discography_user_execution_grant_v1(uuid,text,text,uuid,jsonb,text,integer)',
    'platform_private.registry_discography_observation_fingerprint_v1(jsonb)',
    'platform_private.registry_discography_validate_observation_v1(uuid,jsonb,text)',
    'platform_private.record_registry_discography_provider_evidence_v1(uuid,jsonb,text)',
    'platform_private.freeze_registry_discography_review_plan_v1(uuid,uuid,jsonb)',
    'platform_private.registry_discography_build_frozen_plan_v1(uuid,uuid,uuid,jsonb)',
    'platform_private.registry_discography_build_frozen_plan_pre_selective_v1(uuid,uuid,uuid,jsonb)',
    'platform_private.registry_discography_build_frozen_plan_core_v1(uuid,uuid,uuid,jsonb)',
    'platform_private.issue_registry_reviewed_admission_grant_v1(uuid,text,text,uuid,jsonb,text)',
    'platform_private.registry_reviewed_release_slug_v2(text,text,date,text,uuid,uuid,jsonb,jsonb)',
    'platform_private.execute_registry_reviewed_identity_reconciliation_v1(text,uuid)',
    'platform_private.verify_registry_reviewed_identity_reconciliation_v1(uuid)',
    'platform_private.execute_registry_reviewed_release_identity_reconciliation_v1(text,uuid)',
    'platform_private.verify_registry_reviewed_release_identity_reconciliation_v1(uuid)',
    'platform_private.execute_registry_reviewed_lifecycle_v1(text,uuid)',
    'platform_private.verify_registry_reviewed_lifecycle_v1(uuid)',
    'platform_private.execute_registry_discography_operation_v1(uuid)',
    'platform_private.verify_registry_discography_operation_v1(uuid)',
    'platform_private.verify_registry_discography_operation_core_v1(uuid)',
    'mizizi_private.registry_reviewed_admission_sentry_v1(uuid)'
  ]
  loop
    foreach v_role in array array['public','anon','authenticated','service_role']
    loop
      if has_function_privilege(v_role,v_signature,'EXECUTE') then
        raise exception 'Discography V1 private function leaked EXECUTE to role %: %',v_role,v_signature;
      end if;
    end loop;
  end loop;

  foreach v_signature in array array[
    'public.admin_prepare_registry_discography_evidence_v1(uuid,jsonb,text)',
    'public.admin_preview_registry_discography_evidence_v1(uuid)',
    'public.admin_create_registry_discography_artist_shell_v1(uuid,text)',
    'public.admin_execute_registry_discography_evidence_v1(uuid,uuid,jsonb)',
    'public.admin_verify_registry_discography_operation_v1(uuid)'
  ]
  loop
    if has_function_privilege('public',v_signature,'EXECUTE')
       or has_function_privilege('anon',v_signature,'EXECUTE')
       or has_function_privilege('service_role',v_signature,'EXECUTE')
       or not has_function_privilege('authenticated',v_signature,'EXECUTE')
    then
      raise exception 'Discography V1 public wrapper grant drifted: %',v_signature;
    end if;
  end loop;

  if exists (
    select 1
    from platform_private.system_actor_capability_grants grant_row
    where grant_row.actor_key = 'mizizi'
      and grant_row.capability_key in (
        'apply_registry_discography_plan',
        'admit_registry_release_provider_profile',
        'admit_registry_track_provider_profile',
        'admit_registry_artist_discography_summary',
        'replace_registry_release_artist_set',
        'replace_registry_release_track_set',
        'replace_registry_track_artist_credit_set',
        'create_registry_release',
        'activate_registry_release',
        'reconcile_registry_draft_identity',
        'reconcile_registry_release_identity'
      )
      and grant_row.status = 'active'
      and grant_row.valid_from <= now()
      and grant_row.expires_at > now()
  ) then
    raise exception 'MIZIZI gained standing Discography V1 authority';
  end if;

  if exists (
    select 1
    from platform_private.system_actor_capability_grants grant_row
    where grant_row.actor_key = 'registry_discography_admin'
      and grant_row.status = 'active'
      and grant_row.valid_from <= now()
      and grant_row.expires_at > now()
  ) then
    raise exception 'Discography V1 human broker unexpectedly has a standing System-Actor capability grant';
  end if;

  if exists (
    select 1
    from platform_private.registry_execution_grants execution_grant
    where execution_grant.actor_key = 'registry_discography_admin'
      and execution_grant.operation_key in (
        'registry.discography.apply',
        'registry.artist.create',
        'registry.track.create',
        'registry.release.create',
        'registry.release.provider_profile.admit',
        'registry.track.provider_profile.admit',
        'registry.artist.discography_summary.admit',
        'registry.release_artist_set.replace',
        'registry.release_track_set.replace',
        'registry.track_artist_credit_set.replace',
        'registry.release.activate',
        'registry.draft_identity.reconcile',
        'registry.release.identity.reconcile',
        'registry.track.activate'
      )
      and (
        execution_grant.operation_version <> 1
        or execution_grant.issued_by_user_id is null
        or execution_grant.issued_by_principal_key <> 'user:' || execution_grant.issued_by_user_id::text
        or execution_grant.system_actor_capability_grant_id is not null
        or execution_grant.required_user_capability_key <> 'manage_registry'
      )
  ) then
    raise exception 'Discography V1 exact grant escaped human manage_registry authority';
  end if;

  if exists (
    select 1
    from platform_private.registry_execution_grants execution_grant
    where execution_grant.actor_key = 'registry_discography_admin'
      and execution_grant.status = 'active'
      and execution_grant.expires_at > now()
  ) then
    raise exception 'Discography V1 has active exact grants at verifier rest state';
  end if;

  if exists (
    select 1
    from public.registry_releases r
    where r.id='0eb24444-eec5-4f2d-8afa-64945c728599'::uuid
      and (
        r.status<>'active'
        or r.release_type<>'single'
        or r.metadata->>'apple_music_album_id'<>'6783357507'
      )
  ) then
    raise exception 'Boys Mamako historical Release authority drifted';
  end if;

  if exists (
    select 1
    from public.registry_track_artists ta
    where ta.track_id in (
        'cfdd9175-1869-4767-af83-c5c55454119d'::uuid,
        '6b8c6cc3-e96d-434b-a1a1-945d7a5fd067'::uuid
      )
      and ta.artist_id in (
        '5c465840-5e43-48f1-b15a-b23847238f1f'::uuid,
        '138fa127-9c8b-46c8-b469-06f5f4880e2f'::uuid
      )
      and ta.status='active'
      and (
        ta.role<>'primary_artist'
        or not ta.is_primary
        or ta.is_featured
      )
  ) then
    raise exception 'Boys Mamako historical co-primary Track authority drifted';
  end if;

  if exists (
    select 1
    from public.registry_track_artists ta
    where ta.track_id in (
        'cfdd9175-1869-4767-af83-c5c55454119d'::uuid,
        '6b8c6cc3-e96d-434b-a1a1-945d7a5fd067'::uuid
      )
      and ta.artist_id='fb5a17ed-d1d5-44d2-8585-4bed02859689'::uuid
      and ta.status='active'
      and (
        ta.role<>'featured_artist'
        or ta.is_primary
        or not ta.is_featured
      )
  ) then
    raise exception 'Boys Mamako Iphoolish Track authority drifted';
  end if;

  if has_table_privilege('authenticated','public.registry_artists','INSERT')
     or has_table_privilege('authenticated','public.registry_artists','UPDATE')
     or has_table_privilege('authenticated','public.registry_artists','DELETE')
     or has_table_privilege('authenticated','public.registry_tracks','INSERT')
     or has_table_privilege('authenticated','public.registry_tracks','UPDATE')
     or has_table_privilege('authenticated','public.registry_tracks','DELETE')
     or has_table_privilege('authenticated','public.registry_releases','INSERT')
     or has_table_privilege('authenticated','public.registry_releases','UPDATE')
     or has_table_privilege('authenticated','public.registry_releases','DELETE')
     or has_table_privilege('authenticated','public.registry_release_artists','INSERT')
     or has_table_privilege('authenticated','public.registry_release_artists','UPDATE')
     or has_table_privilege('authenticated','public.registry_release_artists','DELETE')
     or has_table_privilege('authenticated','public.registry_release_tracks','INSERT')
     or has_table_privilege('authenticated','public.registry_release_tracks','UPDATE')
     or has_table_privilege('authenticated','public.registry_release_tracks','DELETE')
     or has_table_privilege('authenticated','public.registry_track_artists','INSERT')
     or has_table_privilege('authenticated','public.registry_track_artists','UPDATE')
     or has_table_privilege('authenticated','public.registry_track_artists','DELETE')
  then
    raise exception 'Ordinary authenticated role gained direct canonical Registry DML';
  end if;
end
$verify$;

select 'REGISTRY_DISCOGRAPHY_AUTHORITY_V1_PASS' as status;
