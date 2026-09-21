-- Permanent structural verifier for Track Intake Track Create V2 foundation.

do $verify$
declare
  v_definition text;
begin
  if not exists (
       select 1
       from platform_private.system_actors actor
       where actor.actor_key='registry_track_intake_admin'
         and actor.actor_kind='automation'
         and actor.status='active'
     )
     or not exists (
       select 1
       from platform_private.system_actor_executor_bindings binding
       where binding.actor_key='registry_track_intake_admin'
         and binding.executor_kind='database_role'
         and binding.executor_key='authenticator'
         and binding.status='active'
     )
  then
    raise exception 'Track Intake admin broker is missing or not exact';
  end if;

  if not exists (
       select 1
       from platform_private.registry_operation_types operation_type
       where operation_type.operation_key='registry.track.create'
         and operation_type.operation_version=2
         and operation_type.capability_key='create_registry_track'
         and operation_type.risk_class='medium'
         and operation_type.allowed_subject_types=array['track']::text[]
         and not operation_type.requires_existing_target
         and operation_type.max_targets=1
         and operation_type.max_rows_ceiling=1
         and operation_type.max_grant_ttl_seconds=300
         and operation_type.requires_human_approval
         and operation_type.requires_verifier
         and operation_type.enabled
     )
  then
    raise exception 'Track Create V2 operation contract is missing or malformed';
  end if;

  if not exists (
       select 1
       from platform_private.registry_operation_types operation_type
       where operation_type.operation_key='registry.track.create'
         and operation_type.operation_version=1
         and operation_type.enabled
     )
  then
    raise exception 'Track Create V1 was disturbed by V2 foundation';
  end if;

  if to_regprocedure('platform_private.registry_track_intake_current_admin_v1()') is null
     or to_regprocedure('platform_private.registry_track_intake_review_snapshot_v1(uuid)') is null
     or to_regprocedure('platform_private.registry_track_intake_deterministic_track_uuid_v1(uuid)') is null
     or to_regprocedure('platform_private.registry_track_intake_reviewed_slug_v1(uuid,text)') is null
     or to_regprocedure('platform_private.registry_track_creation_collision_state_v2(uuid,text,uuid,text,text)') is null
     or to_regprocedure('platform_private.record_registry_track_intake_identity_evidence_v1(uuid,uuid,text,text,text,text,uuid)') is null
     or to_regprocedure('platform_private.issue_registry_track_intake_create_v2_grant(uuid,uuid,uuid,jsonb)') is null
     or to_regprocedure('platform_private.execute_registry_track_create_v2(text,uuid)') is null
     or to_regprocedure('platform_private.verify_registry_track_create_v2(uuid)') is null
     or to_regprocedure('public.admin_create_registry_track_intake_identity_v1(uuid,text)') is null
  then
    raise exception 'Track Intake Track Create V2 function set is incomplete';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.admin_create_registry_track_intake_identity_v1(uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.admin_create_registry_track_intake_identity_v1(uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.admin_create_registry_track_intake_identity_v1(uuid,text)',
       'EXECUTE'
     )
  then
    raise exception 'Track Intake Track Create V2 public ACL is not exact';
  end if;

  if has_function_privilege(
       'authenticated',
       'platform_private.execute_registry_track_create_v2(text,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.execute_registry_track_create_v2(text,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'platform_private.issue_registry_track_intake_create_v2_grant(uuid,uuid,uuid,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.issue_registry_track_intake_create_v2_grant(uuid,uuid,uuid,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'platform_private.verify_registry_track_create_v2(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.verify_registry_track_create_v2(uuid)',
       'EXECUTE'
     )
  then
    raise exception 'Track Intake Track Create V2 private authority leaks external EXECUTE';
  end if;

  select lower(
    pg_get_functiondef(
      'public.admin_create_registry_track_intake_identity_v1(uuid,text)'::regprocedure
    )
  )
  into v_definition;

  if position('registry_track_intake_admin' in v_definition)=0
     or position('registry.track.create' in v_definition)=0
     or position('operation_version'',2' in v_definition)=0
     or position('registry_track_creation_collision_state_v2' in v_definition)=0
     or position('execute_registry_track_create_v2' in v_definition)=0
     or position('verify_registry_track_create_v2' in v_definition)=0
     or position('manage_registry' in lower(
          pg_get_functiondef(
            'platform_private.registry_track_intake_current_admin_v1()'::regprocedure
          )
        ))=0
     or position('insert into public.registry_tracks' in v_definition)>0
     or position('update public.registry_tracks' in v_definition)>0
     or position('insert into public.registry_track_artists' in v_definition)>0
  then
    raise exception 'Track Intake public Track Create V2 bridge bypasses the exact broker boundary';
  end if;

  if to_regprocedure(
       'public.admin_create_registry_track_from_intake_enriched(uuid,text,text)'
     ) is null
     or to_regprocedure(
       'public.admin_resolve_registry_track_intake_enriched(uuid,uuid,text,boolean)'
     ) is null
  then
    raise exception 'Track Intake legacy product road was retired before caller cutover';
  end if;

  raise notice 'REGISTRY_TRACK_INTAKE_TRACK_CREATE_V2_FOUNDATION_PASS';
end
$verify$;
