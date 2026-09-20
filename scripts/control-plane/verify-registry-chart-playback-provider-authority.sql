do $verify$
declare
  v_definition text;
begin
  if not exists (
    select 1
    from platform_private.registry_operation_types operation_type
    where operation_type.operation_key='registry.track.provider_link.admit'
      and operation_type.operation_version=1
      and operation_type.capability_key='admit_registry_track_provider_link'
      and operation_type.enabled
      and operation_type.risk_class='medium'
      and operation_type.allowed_subject_types=array['track']::text[]
      and operation_type.requires_existing_target
      and operation_type.max_targets=1
      and operation_type.max_rows_ceiling=1
      and operation_type.max_grant_ttl_seconds=300
      and operation_type.requires_human_approval
      and operation_type.requires_verifier
  ) then
    raise exception
      'Chart Playback Provider V1 operation contract drifted';
  end if;

  if not exists (
    select 1
    from platform_private.system_actors actor
    where actor.actor_key='registry_chart_admission'
      and actor.actor_kind='automation'
      and actor.status='active'
      and actor.capability_profile->>'authority_mode'='human_exact_grant'
      and actor.capability_profile->'provider_metadata_family'
          @> '["registry.track.provider_link.admit/v1"]'::jsonb
  ) then
    raise exception
      'Chart Playback Provider V1 actor profile drifted';
  end if;

  if not exists (
    select 1
    from platform_private.system_actor_executor_bindings binding
    where binding.actor_key='registry_chart_admission'
      and binding.executor_kind='database_role'
      and binding.executor_key='authenticator'
      and binding.status='active'
  ) then
    raise exception
      'Chart Playback Provider V1 authenticator binding drifted';
  end if;

  foreach v_definition in array array[
    'platform_private.record_registry_chart_playback_provider_evidence_v1(uuid)',
    'platform_private.issue_registry_chart_playback_provider_grant_v1(uuid,uuid)',
    'platform_private.execute_registry_chart_playback_provider_v1(uuid)',
    'platform_private.verify_registry_chart_playback_provider_v1(uuid)',
    'public.chart_admit_track_provider_link_v1(uuid)'
  ]
  loop
    if to_regprocedure(v_definition) is null then
      raise exception
        'Chart Playback Provider V1 function authority is incomplete: %',
        v_definition;
    end if;
  end loop;

  if has_function_privilege(
       'public',
       'public.chart_admit_track_provider_link_v1(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.chart_admit_track_provider_link_v1(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.chart_admit_track_provider_link_v1(uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.chart_admit_track_provider_link_v1(uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'Chart Playback Provider V1 public wrapper privilege boundary drifted';
  end if;

  foreach v_definition in array array[
    'platform_private.record_registry_chart_playback_provider_evidence_v1(uuid)',
    'platform_private.issue_registry_chart_playback_provider_grant_v1(uuid,uuid)',
    'platform_private.execute_registry_chart_playback_provider_v1(uuid)',
    'platform_private.verify_registry_chart_playback_provider_v1(uuid)'
  ]
  loop
    if has_function_privilege('public',v_definition,'EXECUTE')
       or has_function_privilege('anon',v_definition,'EXECUTE')
       or has_function_privilege('authenticated',v_definition,'EXECUTE')
       or has_function_privilege('service_role',v_definition,'EXECUTE')
    then
      raise exception
        'Chart Playback Provider V1 private function leaked role authority: %',
        v_definition;
    end if;
  end loop;

  select lower(pg_get_functiondef(
    'public.chart_admit_track_provider_link_v1(uuid)'::regprocedure
  ))
  into v_definition;

  if position(
       'record_registry_chart_playback_provider_evidence_v1'
       in v_definition
     )=0
     or position(
       'issue_registry_chart_playback_provider_grant_v1'
       in v_definition
     )=0
     or position(
       'execute_registry_chart_playback_provider_v1'
       in v_definition
     )=0
     or position(
       'verify_registry_chart_playback_provider_v1'
       in v_definition
     )=0
     or position('manage_charts' in v_definition)=0
  then
    raise exception
      'Chart Playback Provider V1 public orchestration drifted';
  end if;

  select lower(pg_get_functiondef(
    'platform_private.issue_registry_chart_playback_provider_grant_v1(uuid,uuid)'::regprocedure
  ))
  into v_definition;

  if position(
       'and execution_grant.idempotency_key=v_idempotency_key'
       in v_definition
     )=0
     or position(
          'v_state_fingerprint :='
          in v_definition
        )=0
     or position(
          'and execution_grant.idempotency_key=v_idempotency_key'
          in v_definition
        )>=position(
          'v_state_fingerprint :='
          in v_definition
        )
     or position(
          'v_existing.plan_payload->>''evidence_assertion_id'''
          in v_definition
        )=0
     or position(
          'v_existing.plan_payload->''claim_payload'''
          in v_definition
        )=0
     or position(
          'registry_execution_target_set_fingerprint('
          in v_definition
        )=0
  then
    raise exception
      'Chart Playback Provider V1 replay-integrity boundary drifted';
  end if;

  select lower(pg_get_functiondef(
    'platform_private.execute_registry_chart_playback_provider_v1(uuid)'::regprocedure
  ))
  into v_definition;

  if position('registry.track.provider_link.admit' in v_definition)=0
     or position('registry_chart_admission' in v_definition)=0
     or position('insert into public.registry_track_provider_links' in v_definition)=0
     or position('update public.registry_tracks' in v_definition)=0
     or position('registry_operation_write_events' in v_definition)=0
     or position('registry_canonical_write_events' in v_definition)=0
  then
    raise exception
      'Chart Playback Provider V1 executor drifted';
  end if;

  select lower(pg_get_functiondef(
    'platform_private.verify_registry_chart_playback_provider_v1(uuid)'::regprocedure
  ))
  into v_definition;

  if position('provider_link_state_mismatch' in v_definition)=0
     or position('provider_payload_fingerprint_mismatch' in v_definition)=0
     or position('canonical_track_provider_identity_mismatch' in v_definition)=0
     or position('canonical_write_event_causality_mismatch' in v_definition)=0
  then
    raise exception
      'Chart Playback Provider V1 verifier drifted';
  end if;

  if exists (
    select 1
    from platform_private.system_actor_capability_grants grant_row
    where grant_row.actor_key='registry_chart_admission'
      and grant_row.capability_key='admit_registry_track_provider_link'
      and grant_row.status='active'
      and grant_row.valid_from<=now()
      and grant_row.expires_at>now()
  ) then
    raise exception
      'Chart Playback Provider V1 gained forbidden standing System-Actor authority';
  end if;
end
$verify$;

select 'REGISTRY_CHART_PLAYBACK_PROVIDER_AUTHORITY_PASS'::text as status;
