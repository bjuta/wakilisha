-- Permanent verifier for Track Intake Track Activation authority.

do $verify$
declare
  v_definition text;
begin
  if not exists (
       select 1
       from public.capability_definitions
       where capability_key='activate_registry_track'
         and domain='registry'
     )
     or not exists (
       select 1
       from platform_private.registry_operation_types operation_type
       where operation_type.operation_key='registry.track.activate'
         and operation_type.operation_version=1
         and operation_type.capability_key='activate_registry_track'
         and operation_type.risk_class='medium'
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
    raise exception 'Track Activate V1 typed operation contract is missing or malformed';
  end if;

  if not exists (
       select 1
       from platform_private.system_actors actor
       where actor.actor_key='registry_track_intake_admin'
         and actor.status='active'
         and actor.capability_profile->'operation_family'
             ? 'registry.track.activate/v1'
     )
  then
    raise exception 'Track Intake admin actor does not advertise Track Activate V1';
  end if;

  if to_regprocedure('platform_private.registry_track_intake_activation_credit_state_v1(uuid,uuid)') is null
     or to_regprocedure('platform_private.record_registry_track_intake_activation_evidence_v1(uuid,uuid,text,text)') is null
     or to_regprocedure('platform_private.issue_registry_track_intake_activation_grant_v1(uuid,uuid,jsonb,text)') is null
     or to_regprocedure('platform_private.execute_registry_track_intake_activation_v1(uuid)') is null
     or to_regprocedure('platform_private.verify_registry_track_intake_activation_v1(uuid)') is null
     or to_regprocedure('public.admin_activate_registry_track_intake_v1(uuid)') is null
  then
    raise exception 'Track Intake Track Activation function set is incomplete';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.admin_activate_registry_track_intake_v1(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.admin_activate_registry_track_intake_v1(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.admin_activate_registry_track_intake_v1(uuid)',
       'EXECUTE'
     )
  then
    raise exception 'Track Intake Track Activation public ACL is not exact';
  end if;

  if has_function_privilege(
       'authenticated',
       'platform_private.execute_registry_track_intake_activation_v1(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.execute_registry_track_intake_activation_v1(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'platform_private.verify_registry_track_intake_activation_v1(uuid)',
       'EXECUTE'
     )
  then
    raise exception 'Track Intake Track Activation private authority leaks external EXECUTE';
  end if;

  select lower(
    pg_get_functiondef(
      'public.admin_activate_registry_track_intake_v1(uuid)'::regprocedure
    )
  )
  into v_definition;

  if position('registry.track.activate' in lower(
       pg_get_functiondef(
         'platform_private.issue_registry_track_intake_activation_grant_v1(uuid,uuid,jsonb,text)'::regprocedure
       )
     ))=0
     or position('manage_registry' in lower(
       pg_get_functiondef(
         'platform_private.issue_registry_track_intake_activation_grant_v1(uuid,uuid,jsonb,text)'::regprocedure
       )
     ))=0
     or position('registry_subject_state_fingerprint' in lower(
       pg_get_functiondef(
         'platform_private.execute_registry_track_intake_activation_v1(uuid)'::regprocedure
       )
     ))=0
     or position('track_intake_review' in lower(
       pg_get_functiondef(
         'platform_private.execute_registry_track_intake_activation_v1(uuid)'::regprocedure
       )
     ))=0
     or position('verify_registry_track_intake_activation_v1' in v_definition)=0
     or position('update public.registry_tracks' in v_definition)>0
  then
    raise exception 'Track Intake Track Activation public bridge bypasses exact lifecycle authority';
  end if;

  raise notice 'REGISTRY_TRACK_INTAKE_TRACK_ACTIVATION_AUTHORITY_PASS';
end
$verify$;
