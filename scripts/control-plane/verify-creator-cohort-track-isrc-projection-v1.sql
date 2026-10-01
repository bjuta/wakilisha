-- WAKILISHA creator cohort Track ISRC projection authority verifier.

begin;

do $verify$
declare
  v_candidate text;
  v_execute text;
  v_verify text;
  v_wrapper text;
begin
  if not exists (
    select 1
    from public.capability_definitions capability
    where capability.capability_key=
      'admit_registry_track_isrc_projection'
  ) then
    raise exception
      'Track ISRC projection capability is missing';
  end if;

  if not exists (
    select 1
    from platform_private.registry_operation_types operation_type
    where operation_type.operation_key=
            'registry.track.isrc_projection.admit'
      and operation_type.operation_version=1
      and operation_type.capability_key=
            'admit_registry_track_isrc_projection'
      and operation_type.risk_class='medium'
      and operation_type.allowed_subject_types=
            array['track']::text[]
      and operation_type.requires_existing_target
      and operation_type.max_targets=1
      and operation_type.max_rows_ceiling=2
      and operation_type.max_grant_ttl_seconds=300
      and operation_type.requires_human_approval
      and operation_type.requires_verifier
      and operation_type.enabled
  ) then
    raise exception
      'Track ISRC projection operation is missing or malformed';
  end if;

  if not exists (
    select 1
    from platform_private.system_actors actor
    where actor.actor_key='registry_provider_link_admin'
      and actor.status='active'
      and actor.capability_profile->'operation_family'
          @> '["registry.track.isrc_projection.admit/v1"]'::jsonb
  ) then
    raise exception
      'Provider-link admin actor lacks Track ISRC projection authority declaration';
  end if;

  if to_regprocedure(
       'platform_private.registry_track_isrc_normalize_v1(text)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_track_isrc_projection_candidate_state_v1(uuid,uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.record_registry_track_isrc_projection_evidence_v1(uuid,uuid,jsonb)'
     ) is null
     or to_regprocedure(
       'platform_private.issue_registry_track_isrc_projection_grant_v1(uuid,uuid,uuid,text,text)'
     ) is null
     or to_regprocedure(
       'platform_private.execute_registry_track_isrc_projection_v1(uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.verify_registry_track_isrc_projection_v1(uuid)'
     ) is null
     or to_regprocedure(
       'public.admin_admit_registry_track_isrc_projection_v1(uuid,uuid)'
     ) is null
  then
    raise exception
      'Track ISRC projection function family is incomplete';
  end if;

  select pg_get_functiondef(
    'platform_private.registry_track_isrc_projection_candidate_state_v1(uuid,uuid)'::regprocedure
  )
  into v_candidate;

  if position('apple_music' in v_candidate)=0
     or position('exact_title_artist' in v_candidate)=0
     or position('0.93' in v_candidate)=0
     or position('song,attributes,isrc' in v_candidate)=0
     or position('song,id' in v_candidate)=0
     or position('deterministic_projection_candidate' in v_candidate)=0
     or position('candidate_track_count' in v_candidate)=0
     or position('existing_registry_track_count' in v_candidate)=0
     or position('conflicting_current_assertion_count' in v_candidate)=0
  then
    raise exception
      'Track ISRC projection deterministic candidate contract drifted';
  end if;

  select pg_get_functiondef(
    'platform_private.execute_registry_track_isrc_projection_v1(uuid)'::regprocedure
  )
  into v_execute;

  if position(
       'insert into public.registry_external_identifier_assertions'
       in lower(v_execute)
     )=0
     or position(
       'update public.registry_tracks'
       in lower(v_execute)
     )=0
     or position(
       'set isrc=v_isrc'
       in lower(v_execute)
     )=0
     or position(
       'admit_isrc_projection'
       in v_execute
     )=0
     or position(
       'registry.track.isrc_projection.admit'
       in v_execute
     )=0
  then
    raise exception
      'Track ISRC projection executor drifted';
  end if;

  select pg_get_functiondef(
    'platform_private.verify_registry_track_isrc_projection_v1(uuid)'::regprocedure
  )
  into v_verify;

  if position(
       'canonical_write_event_causality_mismatch'
       in v_verify
     )=0
     or position(
       'canonical_track_isrc_mismatch'
       in v_verify
     )=0
     or position(
       'identifier_assertion_mismatch'
       in v_verify
     )=0
  then
    raise exception
      'Track ISRC projection verifier drifted';
  end if;

  select pg_get_functiondef(
    'public.admin_admit_registry_track_isrc_projection_v1(uuid,uuid)'::regprocedure
  )
  into v_wrapper;

  if position(
       'registry_provider_link_admin_current_user_v1'
       in v_wrapper
     )=0
     or position(
       'deterministic_projection_candidate'
       in v_wrapper
     )=0
     or position(
       'verify_registry_track_isrc_projection_v1'
       in v_wrapper
     )=0
  then
    raise exception
      'Track ISRC projection public wrapper drifted';
  end if;

  if has_function_privilege(
       'anon',
       'public.admin_admit_registry_track_isrc_projection_v1(uuid,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.admin_admit_registry_track_isrc_projection_v1(uuid,uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.admin_admit_registry_track_isrc_projection_v1(uuid,uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'Track ISRC projection public wrapper grants drifted';
  end if;

  if has_function_privilege(
       'authenticated',
       'platform_private.execute_registry_track_isrc_projection_v1(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.execute_registry_track_isrc_projection_v1(uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'Track ISRC projection private executor leaked role authority';
  end if;

  if exists (
    select 1
    from platform_private.registry_execution_grants grant_row
    where grant_row.actor_key='registry_provider_link_admin'
      and grant_row.operation_key=
            'registry.track.isrc_projection.admit'
      and grant_row.operation_version=1
      and grant_row.status='active'
      and grant_row.expires_at>now()
  ) then
    raise exception
      'Active Track ISRC projection execution grant remains at rest';
  end if;
end
$verify$;

rollback;
