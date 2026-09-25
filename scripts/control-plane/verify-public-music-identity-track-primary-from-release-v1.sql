-- Permanent verifier for:
-- 20260925172710_public_music_identity_track_primary_from_release_v1.sql

do $verify$
declare
  v_snapshot_definition text;
  v_grant_definition text;
  v_executor_definition text;
  v_admission_verifier_definition text;
  v_wrapper_definition text;
begin
  if not exists (
       select 1
       from public.capability_definitions capability
       where capability.capability_key=
         'admit_registry_track_primary_from_release_review'
         and capability.domain='registry'
     )
  then
    raise exception
      'STOP: Release-primary reviewed Track-credit capability is missing';
  end if;

  if not exists (
       select 1
       from platform_private.registry_operation_types operation_type
       where operation_type.operation_key=
         'registry.track_artist_credit.release_primary_reviewed_admit'
         and operation_type.operation_version=1
         and operation_type.capability_key=
           'admit_registry_track_primary_from_release_review'
         and operation_type.risk_class='high'
         and operation_type.allowed_subject_types=array['track']::text[]
         and operation_type.requires_existing_target
         and operation_type.max_targets=1
         and operation_type.max_rows_ceiling=1
         and operation_type.max_grant_ttl_seconds=300
         and operation_type.requires_human_approval
         and operation_type.requires_verifier
         and operation_type.enabled
     )
  then
    raise exception
      'STOP: Release-primary reviewed Track-credit operation contract is not exact';
  end if;

  if not exists (
       select 1
       from platform_private.system_actors actor
       where actor.actor_key='registry_release_primary_admin'
         and actor.actor_kind='automation'
         and actor.status='active'
         and actor.capability_profile->>'domain'='registry'
         and actor.capability_profile->>'authority_mode'=
             'human_exact_grant'
         and actor.capability_profile->>'required_user_capability'=
             'manage_registry'
         and actor.capability_profile->'operation_family'
             ? 'registry.track_artist_credit.release_primary_reviewed_admit/v1'
     )
  then
    raise exception
      'STOP: Release-primary reviewed Track-credit System Actor is not exact';
  end if;

  if not exists (
       select 1
       from platform_private.system_actor_executor_bindings binding
       where binding.actor_key='registry_release_primary_admin'
         and binding.executor_kind='database_role'
         and binding.executor_key='authenticator'
         and binding.status='active'
     )
  then
    raise exception
      'STOP: Release-primary reviewed Track-credit authenticator binding is missing';
  end if;

  if exists (
       select 1
       from public.role_capabilities
       where capability_key=
         'admit_registry_track_primary_from_release_review'
     )
  then
    raise exception
      'STOP: Release-primary reviewed admission capability leaked into product roles';
  end if;

  if exists (
       select 1
       from platform_private.system_actor_capability_grants
       where actor_key='registry_release_primary_admin'
         and status='active'
         and valid_from<=now()
         and expires_at>now()
         and revoked_at is null
     )
  then
    raise exception
      'STOP: Release-primary reviewed admission has an active standing System Actor grant';
  end if;

  if exists (
       select 1
       from platform_private.registry_execution_grants grant_row
       where grant_row.actor_key='registry_release_primary_admin'
         and grant_row.status='active'
         and grant_row.expires_at>now()
         and grant_row.revoked_at is null
         and grant_row.consumed_at is null
     )
  then
    raise exception
      'STOP: Release-primary reviewed admission has an unconsumed active exact grant';
  end if;

  if to_regprocedure(
       'platform_private.registry_release_primary_review_current_admin_v1()'
     ) is null
     or to_regprocedure(
       'platform_private.registry_release_primary_review_relation_uuid_v1(uuid,uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_release_primary_review_snapshot_v1(uuid,uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.record_registry_release_primary_review_evidence_v1(uuid,uuid,jsonb)'
     ) is null
     or to_regprocedure(
       'platform_private.issue_registry_release_primary_review_grant_v1(uuid,uuid,jsonb,text)'
     ) is null
     or to_regprocedure(
       'platform_private.execute_registry_release_primary_review_admit_v1(uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.verify_registry_release_primary_review_admit_v1(uuid)'
     ) is null
     or to_regprocedure(
       'public.admin_admit_registry_track_primary_from_release_v1(uuid,uuid,uuid,text)'
     ) is null
  then
    raise exception
      'STOP: Release-primary reviewed admission function surface is incomplete';
  end if;

  if has_function_privilege(
       'anon',
       'public.admin_admit_registry_track_primary_from_release_v1(uuid,uuid,uuid,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.admin_admit_registry_track_primary_from_release_v1(uuid,uuid,uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.admin_admit_registry_track_primary_from_release_v1(uuid,uuid,uuid,text)',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: Release-primary reviewed public wrapper execute grants are not exact';
  end if;

  if has_function_privilege(
       'anon',
       'platform_private.execute_registry_release_primary_review_admit_v1(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'platform_private.execute_registry_release_primary_review_admit_v1(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.execute_registry_release_primary_review_admit_v1(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'platform_private.verify_registry_release_primary_review_admit_v1(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'platform_private.verify_registry_release_primary_review_admit_v1(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.verify_registry_release_primary_review_admit_v1(uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: Release-primary reviewed private executor/verifier leaked execute authority';
  end if;

  select lower(pg_get_functiondef(
    'platform_private.registry_release_primary_review_snapshot_v1(uuid,uuid)'::regprocedure
  ))
  into v_snapshot_definition;

  if position(
       '''already_current'''
       in v_snapshot_definition
     )=0
     or position(
       '''release_primary_review'''
       in v_snapshot_definition
     )=0
     or position(
       'v_exact_current_count'
       in v_snapshot_definition
     )=0
     or position(
       '''1.1.0'''
       in v_snapshot_definition
     )=0
     or position(
       '''1.3.0'''
       in v_snapshot_definition
     )=0
     or position(
       '''1.2.0'''
       in v_snapshot_definition
     )<>0
     or position(
       'credit.artist_id is not null'
       in v_snapshot_definition
     )=0
  then
    raise exception
      'STOP: Release-primary reviewed snapshot is not exact-current replay aware or historical-rule exact';
  end if;

  select lower(pg_get_functiondef(
    'platform_private.issue_registry_release_primary_review_grant_v1(uuid,uuid,jsonb,text)'::regprocedure
  ))
  into v_grant_definition;

  if position(
       'registry_execution_target_set_fingerprint'
       in v_grant_definition
     )=0
  then
    raise exception
      'STOP: Release-primary reviewed grant does not mechanically recheck its exact target set';
  end if;

  select lower(pg_get_functiondef(
    'platform_private.execute_registry_release_primary_review_admit_v1(uuid)'::regprocedure
  ))
  into v_executor_definition;

  if position(
       'insert into public.registry_track_artists'
       in v_executor_definition
     )=0
     or position(
       '''release_primary_review'''
       in v_executor_definition
     )=0
     or position(
       'registry_track_artist_credit_collision_state_v1'
       in v_executor_definition
     )=0
     or position(
       'required_user_capability_key'
       in v_executor_definition
     )=0
     or position(
       'target_count.execution_grant_id'
       in v_executor_definition
     )=0
     or position(
       'update public.registry_track_artists'
       in v_executor_definition
     )<>0
     or position(
       'delete from public.registry_track_artists'
       in v_executor_definition
     )<>0
  then
    raise exception
      'STOP: Release-primary reviewed executor is not insert-only with shared collision authority';
  end if;

  select lower(pg_get_functiondef(
    'platform_private.verify_registry_release_primary_review_admit_v1(uuid)'::regprocedure
  ))
  into v_admission_verifier_definition;

  if position(
       'credit.artist_id is not null'
       in v_admission_verifier_definition
     )=0
  then
    raise exception
      'STOP: Release-primary reviewed verifier does not preserve resolved-primary cardinality semantics';
  end if;

  select lower(pg_get_functiondef(
    'public.admin_admit_registry_track_primary_from_release_v1(uuid,uuid,uuid,text)'::regprocedure
  ))
  into v_wrapper_definition;

  if position(
       'registry_release_primary_review_snapshot_v1'
       in v_wrapper_definition
     )=0
     or position(
       'p_expected_artist_id'
       in v_wrapper_definition
     )=0
     or position(
       'p_expected_track_state_fingerprint'
       in v_wrapper_definition
     )=0
     or position(
       'pg_advisory_xact_lock'
       in v_wrapper_definition
     )=0
     or position(
       '''already_current'''
       in v_wrapper_definition
     )=0
  then
    raise exception
      'STOP: Release-primary reviewed public wrapper is not caller-bound to exact reviewed state';
  end if;
end
$verify$;

select
  'PUBLIC_MUSIC_IDENTITY_TRACK_PRIMARY_FROM_RELEASE_V1_PASS'
  as result;
