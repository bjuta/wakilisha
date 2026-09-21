-- Permanent verifier for Track Intake provider-neutral Release reviewed-profile authority.

do $verify$
declare
  v_definition text;
begin
  if not exists (
       select 1
       from public.capability_definitions
       where capability_key='admit_registry_release_reviewed_profile'
         and domain='registry'
     )
     or not exists (
       select 1
       from platform_private.registry_operation_types operation_type
       where operation_type.operation_key='registry.release.reviewed_profile.admit'
         and operation_type.operation_version=1
         and operation_type.capability_key='admit_registry_release_reviewed_profile'
         and operation_type.risk_class='medium'
         and operation_type.allowed_subject_types=array['release']::text[]
         and operation_type.requires_existing_target
         and operation_type.max_targets=1
         and operation_type.max_rows_ceiling=1
         and operation_type.max_grant_ttl_seconds=300
         and operation_type.requires_human_approval
         and operation_type.requires_verifier
         and operation_type.enabled
     )
  then
    raise exception 'Release reviewed-profile typed operation contract is missing or malformed';
  end if;

  if not exists (
       select 1
       from platform_private.system_actors actor
       where actor.actor_key='registry_track_intake_admin'
         and actor.status='active'
         and actor.capability_profile->'operation_family'
             ? 'registry.release.reviewed_profile.admit/v1'
     )
  then
    raise exception 'Track Intake admin actor does not advertise Release reviewed-profile V1';
  end if;

  if to_regprocedure('platform_private.registry_track_intake_release_label_match_state_v1(text)') is null
     or to_regprocedure('platform_private.registry_track_intake_release_profile_snapshot_v1(uuid,uuid)') is null
     or to_regprocedure('platform_private.record_registry_track_intake_release_profile_evidence_v1(uuid,uuid,jsonb,boolean,text)') is null
     or to_regprocedure('platform_private.issue_registry_track_intake_release_profile_grant_v1(uuid,uuid,jsonb,text)') is null
     or to_regprocedure('platform_private.execute_registry_track_intake_release_profile_v1(uuid)') is null
     or to_regprocedure('platform_private.verify_registry_track_intake_release_profile_v1(uuid)') is null
     or to_regprocedure('public.admin_admit_registry_track_intake_release_profile_v1(uuid,uuid,boolean)') is null
  then
    raise exception 'Track Intake Release reviewed-profile function set is incomplete';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.admin_admit_registry_track_intake_release_profile_v1(uuid,uuid,boolean)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.admin_admit_registry_track_intake_release_profile_v1(uuid,uuid,boolean)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.admin_admit_registry_track_intake_release_profile_v1(uuid,uuid,boolean)',
       'EXECUTE'
     )
  then
    raise exception 'Track Intake Release reviewed-profile public ACL is not exact';
  end if;

  if has_function_privilege(
       'authenticated',
       'platform_private.execute_registry_track_intake_release_profile_v1(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.execute_registry_track_intake_release_profile_v1(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'platform_private.verify_registry_track_intake_release_profile_v1(uuid)',
       'EXECUTE'
     )
  then
    raise exception 'Track Intake Release reviewed-profile private authority leaks external EXECUTE';
  end if;

  select lower(
    pg_get_functiondef(
      'public.admin_admit_registry_track_intake_release_profile_v1(uuid,uuid,boolean)'::regprocedure
    )
  )
  into v_definition;

  if position('registry.release.reviewed_profile.admit' in lower(
       pg_get_functiondef(
         'platform_private.issue_registry_track_intake_release_profile_grant_v1(uuid,uuid,jsonb,text)'::regprocedure
       )
     ))=0
     or position('manage_registry' in lower(
       pg_get_functiondef(
         'platform_private.issue_registry_track_intake_release_profile_grant_v1(uuid,uuid,jsonb,text)'::regprocedure
       )
     ))=0
     or position('registry_track_intake_release_label_match_state_v1' in lower(
       pg_get_functiondef(
         'platform_private.execute_registry_track_intake_release_profile_v1(uuid)'::regprocedure
       )
     ))=0
     or position('track_intake_review' in lower(
       pg_get_functiondef(
         'platform_private.execute_registry_track_intake_release_profile_v1(uuid)'::regprocedure
       )
     ))=0
     or position('verify_registry_track_intake_release_profile_v1' in v_definition)=0
     or position('update public.registry_releases' in v_definition)>0
     or position('apple_music_ingest' in lower(
       pg_get_functiondef(
         'platform_private.execute_registry_track_intake_release_profile_v1(uuid)'::regprocedure
       )
     ))>0
     or position('track_intake_enriched_at' in lower(
       pg_get_functiondef(
         'platform_private.execute_registry_track_intake_release_profile_v1(uuid)'::regprocedure
       )
     ))>0
  then
    raise exception 'Track Intake Release reviewed-profile public bridge bypasses exact authority';
  end if;

  if exists (
       select 1
       from public.role_capabilities
       where capability_key='admit_registry_release_reviewed_profile'
     )
  then
    raise exception 'Release reviewed-profile operation capability leaked into product roles';
  end if;

  raise notice 'REGISTRY_TRACK_INTAKE_RELEASE_REVIEWED_PROFILE_AUTHORITY_PASS';
end
$verify$;
