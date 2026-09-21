-- Permanent structural verifier for Track Intake Artist Credit authority.

do $verify$
declare
  v_definition text;
begin
  if not exists (
       select 1
       from platform_private.system_actors actor
       where actor.actor_key='registry_track_intake_admin'
         and actor.status='active'
         and actor.capability_profile->'operation_family'
             ? 'registry.track_artist_credit.admit/v1'
     )
  then
    raise exception 'Track Intake admin actor does not advertise Artist Credit V1';
  end if;

  if not exists (
       select 1
       from platform_private.registry_operation_types operation_type
       where operation_type.operation_key='registry.track_artist_credit.admit'
         and operation_type.operation_version=1
         and operation_type.capability_key='admit_registry_track_artist_credit'
         and operation_type.allowed_subject_types=array['track_artist_credit']::text[]
         and not operation_type.requires_existing_target
         and operation_type.max_targets=1
         and operation_type.max_rows_ceiling=1
         and operation_type.requires_human_approval
         and operation_type.requires_verifier
         and operation_type.enabled
     )
  then
    raise exception 'Accepted Track Artist Credit V1 operation was disturbed';
  end if;

  if to_regprocedure('platform_private.registry_track_intake_deterministic_credit_uuid_v1(uuid)') is null
     or to_regprocedure('platform_private.record_registry_track_intake_credit_evidence_v1(uuid,uuid,uuid,uuid,text,integer,text)') is null
     or to_regprocedure('platform_private.issue_registry_track_intake_credit_grant_v1(uuid,uuid,uuid,jsonb)') is null
     or to_regprocedure('platform_private.execute_registry_track_intake_credit_v1(uuid)') is null
     or to_regprocedure('public.admin_admit_registry_track_intake_credit_v1(uuid,uuid)') is null
  then
    raise exception 'Track Intake Artist Credit authority function set is incomplete';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.admin_admit_registry_track_intake_credit_v1(uuid,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.admin_admit_registry_track_intake_credit_v1(uuid,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.admin_admit_registry_track_intake_credit_v1(uuid,uuid)',
       'EXECUTE'
     )
  then
    raise exception 'Track Intake Artist Credit public ACL is not exact';
  end if;

  if has_function_privilege(
       'authenticated',
       'platform_private.execute_registry_track_intake_credit_v1(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.execute_registry_track_intake_credit_v1(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'platform_private.issue_registry_track_intake_credit_grant_v1(uuid,uuid,uuid,jsonb)',
       'EXECUTE'
     )
  then
    raise exception 'Track Intake Artist Credit private authority leaks external EXECUTE';
  end if;

  select lower(
    pg_get_functiondef(
      'public.admin_admit_registry_track_intake_credit_v1(uuid,uuid)'::regprocedure
    )
  )
  into v_definition;

  if position('registry.track_artist_credit.admit' in v_definition)=0
     or position('registry_track_intake_admin' in lower(
          pg_get_functiondef(
            'platform_private.issue_registry_track_intake_credit_grant_v1(uuid,uuid,uuid,jsonb)'::regprocedure
          )
        ))=0
     or position('manage_registry' in lower(
          pg_get_functiondef(
            'platform_private.issue_registry_track_intake_credit_grant_v1(uuid,uuid,uuid,jsonb)'::regprocedure
          )
        ))=0
     or position('track_intake_review' in lower(
          pg_get_functiondef(
            'platform_private.execute_registry_track_intake_credit_v1(uuid)'::regprocedure
          )
        ))=0
     or position('verify_registry_materialization_core_v1' in v_definition)=0
     or position('insert into public.registry_track_artists' in v_definition)>0
  then
    raise exception 'Track Intake Artist Credit public bridge bypasses exact authority';
  end if;

  raise notice 'REGISTRY_TRACK_INTAKE_ARTIST_CREDIT_AUTHORITY_PASS';
end
$verify$;
