\set ON_ERROR_STOP on

do $verify$
declare
  v_wrapper text;
  v_engine text;
  v_signature text;
  v_expected bigint;
  v_actual bigint;
begin
  if to_regprocedure('public.admin_apply_artist_decouple_decision(uuid)') is null
     or to_regprocedure('public.admin_safe_merge_registry_artists(uuid,uuid,text,boolean,text)') is null
     or to_regprocedure('platform_private.apply_registry_artist_decouple_engine_v1(uuid,jsonb,text,boolean,uuid)') is null
     or to_regprocedure('platform_private.apply_registry_artist_merge_engine_v1(uuid,uuid,text,boolean,text)') is null
     or to_regprocedure('platform_private.registry_artist_decouple_state_fingerprint_v1(uuid)') is null
     or to_regprocedure('platform_private.registry_artist_merge_state_fingerprint_v1(uuid,uuid)') is null
     or to_regprocedure('platform_private.record_registry_artist_decouple_evidence_v1(uuid)') is null
     or to_regprocedure('platform_private.record_registry_artist_merge_evidence_v1(uuid,uuid,text,boolean,text)') is null
     or to_regprocedure('platform_private.issue_registry_artist_decouple_grant_v1(uuid)') is null
     or to_regprocedure('platform_private.issue_registry_artist_merge_grant_v1(uuid)') is null
     or to_regprocedure('platform_private.execute_registry_artist_decouple_v1(uuid)') is null
     or to_regprocedure('platform_private.execute_registry_artist_merge_v1(uuid)') is null
     or to_regprocedure('platform_private.verify_registry_artist_decouple_v1(uuid)') is null
     or to_regprocedure('platform_private.verify_registry_artist_merge_v1(uuid)') is null
  then
    raise exception 'Tranche B Artist high-blast exact-authority function family is incomplete';
  end if;

  if to_regprocedure('public.admin_merge_registry_artists(uuid,uuid,text,boolean)') is not null then
    raise exception 'Old manual Artist merge executable authority still exists';
  end if;

  if not exists (
    select 1
    from public.capability_definitions capability
    where capability.capability_key='decouple_registry_artist'
      and capability.domain='registry'
  ) or not exists (
    select 1
    from public.capability_definitions capability
    where capability.capability_key='merge_registry_artist'
      and capability.domain='registry'
  ) then
    raise exception 'Artist high-blast typed capabilities are incomplete';
  end if;

  if not exists (
    select 1
    from platform_private.system_actors actor
    where actor.actor_key='registry_artist_decouple_admin'
      and actor.actor_kind='automation'
      and actor.status='active'
      and actor.capability_profile->>'authority_mode'='human_exact_grant'
      and actor.capability_profile->>'required_user_capability'='manage_registry'
      and actor.capability_profile->'operation_family'
          @> '["registry.artist.decouple/v1"]'::jsonb
  ) or not exists (
    select 1
    from platform_private.system_actors actor
    where actor.actor_key='registry_artist_merge_admin'
      and actor.actor_kind='automation'
      and actor.status='active'
      and actor.capability_profile->>'authority_mode'='human_exact_grant'
      and actor.capability_profile->>'required_user_capability'='manage_registry'
      and actor.capability_profile->'operation_family'
          @> '["registry.artist.merge/v1"]'::jsonb
  ) then
    raise exception 'Artist high-blast System Actor authority drifted';
  end if;

  if not exists (
    select 1 from platform_private.system_actor_executor_bindings binding
    where binding.actor_key='registry_artist_decouple_admin'
      and binding.executor_kind='database_role'
      and binding.executor_key='authenticator'
      and binding.status='active'
  ) or not exists (
    select 1 from platform_private.system_actor_executor_bindings binding
    where binding.actor_key='registry_artist_merge_admin'
      and binding.executor_kind='database_role'
      and binding.executor_key='authenticator'
      and binding.status='active'
  ) then
    raise exception 'Artist high-blast authenticator bindings drifted';
  end if;

  if not exists (
    select 1
    from platform_private.registry_operation_types operation_type
    where operation_type.operation_key='registry.artist.decouple'
      and operation_type.operation_version=1
      and operation_type.capability_key='decouple_registry_artist'
      and operation_type.risk_class='critical'
      and operation_type.allowed_subject_types=array['artist']::text[]
      and operation_type.requires_existing_target
      and operation_type.max_targets=9
      and operation_type.max_rows_ceiling=4096
      and operation_type.max_grant_ttl_seconds=300
      and operation_type.requires_human_approval
      and operation_type.requires_verifier
      and operation_type.enabled
  ) then
    raise exception 'Artist decouple operation escaped its frozen blast envelope';
  end if;

  if not exists (
    select 1
    from platform_private.registry_operation_types operation_type
    where operation_type.operation_key='registry.artist.merge'
      and operation_type.operation_version=1
      and operation_type.capability_key='merge_registry_artist'
      and operation_type.risk_class='critical'
      and operation_type.allowed_subject_types=array['artist']::text[]
      and operation_type.requires_existing_target
      and operation_type.max_targets=2
      and operation_type.max_rows_ceiling=1024
      and operation_type.max_grant_ttl_seconds=300
      and operation_type.requires_human_approval
      and operation_type.requires_verifier
      and operation_type.enabled
  ) then
    raise exception 'Artist merge operation escaped its frozen blast envelope';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.admin_apply_artist_decouple_decision(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.admin_apply_artist_decouple_decision(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.admin_apply_artist_decouple_decision(uuid)',
       'EXECUTE'
     )
  then
    raise exception 'Artist decouple public command grant boundary drifted';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.admin_safe_merge_registry_artists(uuid,uuid,text,boolean,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.admin_safe_merge_registry_artists(uuid,uuid,text,boolean,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.admin_safe_merge_registry_artists(uuid,uuid,text,boolean,text)',
       'EXECUTE'
     )
  then
    raise exception 'Safe Artist merge public command grant boundary drifted';
  end if;

  foreach v_signature in array array[
    'platform_private.apply_registry_artist_decouple_engine_v1(uuid,jsonb,text,boolean,uuid)',
    'platform_private.apply_registry_artist_merge_engine_v1(uuid,uuid,text,boolean,text)',
    'platform_private.registry_artist_decouple_admin_current_user_v1()',
    'platform_private.registry_artist_merge_admin_current_user_v1()',
    'platform_private.registry_artist_decouple_state_fingerprint_v1(uuid)',
    'platform_private.registry_artist_merge_state_fingerprint_v1(uuid,uuid)',
    'platform_private.record_registry_artist_decouple_evidence_v1(uuid)',
    'platform_private.record_registry_artist_merge_evidence_v1(uuid,uuid,text,boolean,text)',
    'platform_private.issue_registry_artist_decouple_grant_v1(uuid)',
    'platform_private.issue_registry_artist_merge_grant_v1(uuid)',
    'platform_private.execute_registry_artist_decouple_v1(uuid)',
    'platform_private.execute_registry_artist_merge_v1(uuid)',
    'platform_private.verify_registry_artist_decouple_v1(uuid)',
    'platform_private.verify_registry_artist_merge_v1(uuid)'
  ]
  loop
    if has_function_privilege('anon',v_signature,'EXECUTE')
       or has_function_privilege('authenticated',v_signature,'EXECUTE')
       or has_function_privilege('service_role',v_signature,'EXECUTE')
    then
      raise exception 'Private Artist high-blast authority leaked client/service execution: %',v_signature;
    end if;
  end loop;

  select lower(pg_get_functiondef(
    'public.admin_apply_artist_decouple_decision(uuid)'::regprocedure
  )) into v_wrapper;

  if v_wrapper ~
       '(insert[[:space:]]+into|update|delete[[:space:]]+from)[[:space:]]+public[.](registry_|wk_chart_entries_v2|chart_entries)'
     or position('record_registry_artist_decouple_evidence_v1' in v_wrapper)=0
     or position('issue_registry_artist_decouple_grant_v1' in v_wrapper)=0
     or position('execute_registry_artist_decouple_v1' in v_wrapper)=0
     or position('verify_registry_artist_decouple_v1' in v_wrapper)=0
     or position('reviewed_exact_operation' in v_wrapper)=0
  then
    raise exception 'Artist decouple public wrapper regained direct mutation or lost exact authority composition';
  end if;

  select lower(pg_get_functiondef(
    'public.admin_safe_merge_registry_artists(uuid,uuid,text,boolean,text)'::regprocedure
  )) into v_wrapper;

  if v_wrapper ~
       '(insert[[:space:]]+into|update|delete[[:space:]]+from)[[:space:]]+public[.](registry_|wk_chart_entries_v2|chart_entries)'
     or position('record_registry_artist_merge_evidence_v1' in v_wrapper)=0
     or position('issue_registry_artist_merge_grant_v1' in v_wrapper)=0
     or position('execute_registry_artist_merge_v1' in v_wrapper)=0
     or position('verify_registry_artist_merge_v1' in v_wrapper)=0
     or position('reviewed_exact_operation' in v_wrapper)=0
  then
    raise exception 'Safe Artist merge public wrapper regained direct mutation or lost exact authority composition';
  end if;

  if (
    select encode(extensions.digest(p.prosrc,'sha256'),'hex')
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='platform_private'
      and p.proname='apply_registry_artist_decouple_engine_v1'
      and pg_get_function_identity_arguments(p.oid)=
          'p_source_artist_id uuid, p_replacements jsonb, p_note text, p_archive_source boolean, p_chart_primary_artist_id uuid'
  )<>'bf2e8410e11af4207d064a800b7405045098ea0442742941a4fe5f55d026463e'
  then
    raise exception 'Mature Artist decouple engine body hash drifted';
  end if;

  if (
    select encode(extensions.digest(p.prosrc,'sha256'),'hex')
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='platform_private'
      and p.proname='apply_registry_artist_merge_engine_v1'
      and pg_get_function_identity_arguments(p.oid)=
          'p_source_artist_id uuid, p_canonical_artist_id uuid, p_note text, p_archive_source boolean, p_merge_reason text'
  )<>'c5a595d6cd76da5df7d92d7e54449a270a3423cfffc8d8b0ce67eb85af3fd075'
  then
    raise exception 'Mature safe Artist merge engine body hash drifted';
  end if;

  select lower(pg_get_functiondef(
    'platform_private.apply_registry_artist_decouple_engine_v1(uuid,jsonb,text,boolean,uuid)'::regprocedure
  )) into v_engine;

  if position('registry_track_artists' in v_engine)=0
     or position('registry_release_artists' in v_engine)=0
     or position('wk_chart_entries_v2' in v_engine)=0
     or position('chart_entries' in v_engine)=0
     or position('registry_artist_aliases' in v_engine)=0
     or position('artist_credit_decoupled' in v_engine)=0
  then
    raise exception 'Mature Artist decouple engine behavior contract was not preserved';
  end if;

  select lower(pg_get_functiondef(
    'platform_private.apply_registry_artist_merge_engine_v1(uuid,uuid,text,boolean,text)'::regprocedure
  )) into v_engine;

  if position('registry_artist_aliases' in v_engine)=0
     or position('registry_track_artists' in v_engine)=0
     or position('registry_release_artists' in v_engine)=0
     or position('wk_chart_entries_v2' in v_engine)=0
     or position('registry_artist_resolution_events' in v_engine)=0
     or position('artist_merge' in v_engine)=0
  then
    raise exception 'Mature safe Artist merge engine behavior contract was not preserved';
  end if;

  if exists (
    select 1 from platform_private.registry_execution_grants execution_grant
    where execution_grant.actor_key in (
      'registry_artist_decouple_admin',
      'registry_artist_merge_admin'
    )
      and execution_grant.status='active'
  ) then
    raise exception 'Active Artist high-blast exact grant remains at rest';
  end if;

  if exists (
    select 1 from platform_private.registry_mutation_operations operation_row
    where operation_row.actor_key in (
      'registry_artist_decouple_admin',
      'registry_artist_merge_admin'
    )
      and operation_row.status='succeeded'
      and operation_row.verifier_status<>'passed'
  ) then
    raise exception 'Succeeded Artist high-blast operation lacks independent verifier PASS';
  end if;

  select count(*) into v_expected
  from public.registry_artist_resolution_events event
  where event.action='artist_merge' and event.status='success';

  select count(*) into v_actual
  from public.registry_artist_resolution_events event
  where event.action='artist_merge'
    and event.status='success'
    and exists (
      select 1
      from public.registry_identity_lineage lineage
      where lineage.entity_type='artist'
        and lineage.source_entity_id=event.source_artist_id
        and lineage.transition_type='merge'
        and lineage.source_authority='registry_artist_resolution_events'
        and lineage.source_record_id=event.id::text
    );

  if v_actual<>v_expected then
    raise exception 'Artist merge event-to-lineage coverage drifted: expected %, actual %',v_expected,v_actual;
  end if;

  select count(*) into v_expected
  from public.registry_audit_log audit
  where audit.action='artist_credit_decoupled'
    and audit.entity_type='registry_artist';

  select count(*) into v_actual
  from public.registry_audit_log audit
  where audit.action='artist_credit_decoupled'
    and audit.entity_type='registry_artist'
    and exists (
      select 1
      from public.registry_identity_lineage lineage
      where lineage.entity_type='artist'
        and lineage.source_entity_id=audit.entity_id
        and lineage.transition_type='split'
        and lineage.source_authority='registry_audit_log:artist_credit_decoupled'
        and lineage.source_record_id=audit.id::text
    );

  if v_actual<>v_expected then
    raise exception 'Artist decouple audit-to-lineage coverage drifted: expected %, actual %',v_expected,v_actual;
  end if;
end
$verify$;

select 'MIZIZI_TRANCHE_B_HIGH_BLAST_AUTHORITY_PASS' as verification_result;
