\set ON_ERROR_STOP on

do $verify$
declare
  v_wrapper text;
  v_engine text;
  v_executor text;
  v_verifier text;
  v_expected bigint;
  v_actual bigint;
  v_signature text;
begin
  if to_regprocedure(
       'public.admin_apply_registry_track_duplicate_repair(uuid,uuid[],text,boolean)'
     ) is null
     or to_regprocedure(
       'platform_private.apply_registry_track_duplicate_repair_engine_v1(uuid,uuid[],text,boolean)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_track_duplicate_repair_state_fingerprint_v1(uuid,uuid[])'
     ) is null
     or to_regprocedure(
       'platform_private.record_registry_track_duplicate_repair_evidence_v1(uuid,uuid[],text,boolean)'
     ) is null
     or to_regprocedure(
       'platform_private.issue_registry_track_duplicate_repair_grant_v1(uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.execute_registry_track_duplicate_repair_v1(uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.verify_registry_track_duplicate_repair_v1(uuid)'
     ) is null
  then
    raise exception 'Track duplicate repair exact-authority function family is incomplete';
  end if;

  if not exists (
    select 1
    from public.capability_definitions capability
    where capability.capability_key='repair_registry_track_duplicate'
      and capability.domain='registry'
  ) then
    raise exception 'Track duplicate repair typed capability is missing';
  end if;

  if not exists (
    select 1
    from platform_private.system_actors actor
    where actor.actor_key='registry_track_duplicate_admin'
      and actor.actor_kind='automation'
      and actor.status='active'
      and actor.capability_profile->>'authority_mode'='human_exact_grant'
      and actor.capability_profile->>'required_user_capability'='manage_registry'
      and actor.capability_profile->'operation_family'
          @> '["registry.track.duplicate_repair/v1"]'::jsonb
  ) then
    raise exception 'Track duplicate repair System Actor authority drifted';
  end if;

  if not exists (
    select 1
    from platform_private.system_actor_executor_bindings binding
    where binding.actor_key='registry_track_duplicate_admin'
      and binding.executor_kind='database_role'
      and binding.executor_key='authenticator'
      and binding.status='active'
  ) then
    raise exception 'Track duplicate repair authenticator binding drifted';
  end if;

  if not exists (
    select 1
    from platform_private.registry_operation_types operation_type
    where operation_type.operation_key='registry.track.duplicate_repair'
      and operation_type.operation_version=1
      and operation_type.capability_key='repair_registry_track_duplicate'
      and operation_type.risk_class='critical'
      and operation_type.allowed_subject_types=array['track']::text[]
      and operation_type.requires_existing_target
      and operation_type.max_targets=16
      and operation_type.max_rows_ceiling=64
      and operation_type.max_grant_ttl_seconds=300
      and operation_type.requires_human_approval
      and operation_type.requires_verifier
      and operation_type.enabled
  ) then
    raise exception 'Track duplicate repair operation type escaped its frozen blast envelope';
  end if;

  if not exists (
       select 1
       from pg_trigger
       where tgrelid='platform_private.registry_execution_grant_targets'::regclass
         and tgname='registry_execution_grant_target_review_seal'
         and not tgisinternal
         and tgenabled<>'D'
     )
     or not exists (
       select 1
       from pg_trigger
       where tgrelid='platform_private.registry_execution_grants'::regclass
         and tgname='registry_execution_grants_review_authority_guard'
         and not tgisinternal
         and tgenabled<>'D'
     )
  then
    raise exception 'Track duplicate repair lost accepted shared review sealing';
  end if;

  if has_function_privilege(
       'anon',
       'public.admin_apply_registry_track_duplicate_repair(uuid,uuid[],text,boolean)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.admin_apply_registry_track_duplicate_repair(uuid,uuid[],text,boolean)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.admin_apply_registry_track_duplicate_repair(uuid,uuid[],text,boolean)',
       'EXECUTE'
     )
  then
    raise exception 'Track duplicate repair public product boundary grants drifted';
  end if;

  foreach v_signature in array array[
    'platform_private.apply_registry_track_duplicate_repair_engine_v1(uuid,uuid[],text,boolean)',
    'platform_private.registry_track_duplicate_admin_current_user_v1()',
    'platform_private.registry_track_duplicate_repair_state_fingerprint_v1(uuid,uuid[])',
    'platform_private.record_registry_track_duplicate_repair_evidence_v1(uuid,uuid[],text,boolean)',
    'platform_private.issue_registry_track_duplicate_repair_grant_v1(uuid)',
    'platform_private.execute_registry_track_duplicate_repair_v1(uuid)',
    'platform_private.verify_registry_track_duplicate_repair_v1(uuid)'
  ]
  loop
    if has_function_privilege('anon',v_signature,'EXECUTE')
       or has_function_privilege('authenticated',v_signature,'EXECUTE')
       or has_function_privilege('service_role',v_signature,'EXECUTE')
    then
      raise exception 'Private Track duplicate repair authority leaked client/service execution: %',v_signature;
    end if;
  end loop;

  select lower(pg_get_functiondef(
    'public.admin_apply_registry_track_duplicate_repair(uuid,uuid[],text,boolean)'::regprocedure
  )) into v_wrapper;

  if v_wrapper ~
       '(insert[[:space:]]+into|update|delete[[:space:]]+from)[[:space:]]+public[.](registry_|wk_chart_entries_v2)'
     or position('record_registry_track_duplicate_repair_evidence_v1' in v_wrapper)=0
     or position('issue_registry_track_duplicate_repair_grant_v1' in v_wrapper)=0
     or position('execute_registry_track_duplicate_repair_v1' in v_wrapper)=0
     or position('verify_registry_track_duplicate_repair_v1' in v_wrapper)=0
     or position('reviewed_exact_operation' in v_wrapper)=0
  then
    raise exception 'Track duplicate repair public wrapper regained direct mutation or lost exact authority composition';
  end if;

  select lower(pg_get_functiondef(
    'platform_private.apply_registry_track_duplicate_repair_engine_v1(uuid,uuid[],text,boolean)'::regprocedure
  )) into v_engine;

  if position('registry_track_resolution_events' in v_engine)=0
     or position('wk_chart_entries_v2' in v_engine)=0
     or position('registry_track_provider_links' in v_engine)=0
     or position('registry_track_artists' in v_engine)=0
     or position('registry_release_tracks' in v_engine)=0
     or position('duplicateTracksArchived' in pg_get_functiondef(
          'platform_private.apply_registry_track_duplicate_repair_engine_v1(uuid,uuid[],text,boolean)'::regprocedure
        ))=0
  then
    raise exception 'Mature Track duplicate repair engine behavior contract was not preserved';
  end if;

  if (
    select encode(extensions.digest(p.prosrc,'sha256'),'hex')
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='platform_private'
      and p.proname='apply_registry_track_duplicate_repair_engine_v1'
      and pg_get_function_identity_arguments(p.oid)=
          'p_canonical_track_id uuid, p_duplicate_track_ids uuid[], p_note text, p_allow_medium_confidence boolean'
  )<>'ff7ec6d997671e5f27ed2056149e56e4c913284f911e0eb943532f750e39c0e7'
  then
    raise exception 'Mature Track duplicate repair engine body hash drifted';
  end if;

  select lower(pg_get_functiondef(
    'platform_private.execute_registry_track_duplicate_repair_v1(uuid)'::regprocedure
  )) into v_executor;

  if position('begin_registry_mutation_operation' in v_executor)=0
     or position('registry_track_duplicate_repair_state_fingerprint_v1' in v_executor)=0
     or position('for update' in v_executor)=0
     or position('apply_registry_track_duplicate_repair_engine_v1' in v_executor)=0
     or position('registry_operation_write_events' in v_executor)=0
     or position('track duplicate repair exceeded its exact row budget' in v_executor)=0
  then
    raise exception 'Track duplicate repair executor lost stale-state, row-budget, or journal authority';
  end if;

  select lower(pg_get_functiondef(
    'platform_private.verify_registry_track_duplicate_repair_v1(uuid)'::regprocedure
  )) into v_verifier;

  if position('registry_track_resolution_events' in v_verifier)=0
     or position('registry_identity_lineage' in v_verifier)=0
     or position('registry_track_provider_links' in v_verifier)=0
     or position('registry_track_artists' in v_verifier)=0
     or position('registry_release_tracks' in v_verifier)=0
     or position('wk_chart_entries_v2' in v_verifier)=0
     or position('canonical_track_has_ambiguous_current_primary_artist_credit' in v_verifier)=0
  then
    raise exception 'Track duplicate repair independent verifier lost required postconditions';
  end if;

  if exists (
    select 1
    from platform_private.registry_execution_grants execution_grant
    where execution_grant.actor_key='registry_track_duplicate_admin'
      and execution_grant.status='active'
  ) then
    raise exception 'Active Track duplicate repair exact grant remains at rest';
  end if;

  if exists (
    select 1
    from platform_private.registry_mutation_operations operation_row
    where operation_row.actor_key='registry_track_duplicate_admin'
      and operation_row.status='succeeded'
      and operation_row.verifier_status<>'passed'
  ) then
    raise exception 'Succeeded Track duplicate repair operation lacks independent verifier PASS';
  end if;

  select coalesce(sum(cardinality(event.duplicate_track_ids)),0)
  into v_expected
  from public.registry_track_resolution_events event
  where event.action='track_duplicate_repair'
    and event.status='success';

  select count(*)
  into v_actual
  from public.registry_track_resolution_events event
  cross join lateral unnest(event.duplicate_track_ids) duplicate(source_id)
  where event.action='track_duplicate_repair'
    and event.status='success'
    and exists (
      select 1
      from public.registry_identity_lineage lineage
      where lineage.entity_type='track'
        and lineage.source_entity_id=duplicate.source_id
        and lineage.transition_type='supersede'
        and lineage.successor_entity_ids @> array[event.canonical_track_id]::uuid[]
        and lineage.source_authority='registry_track_resolution_events'
        and lineage.source_record_id=
            event.id::text||':'||duplicate.source_id::text
    );

  if v_actual<>v_expected then
    raise exception 'Track duplicate repair supersession lineage coverage drifted: expected %, actual %',v_expected,v_actual;
  end if;
end
$verify$;

select 'REGISTRY_TRACK_DUPLICATE_REPAIR_AUTHORITY_PASS' as verification_result;
