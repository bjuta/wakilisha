-- Permanent verifier for #939 Boundary B1 chart materialization runtime.

do $verify$
declare
  v_enabled_count integer;
  v_release_additive_enabled integer;
  v_executor_definition text;
  v_shared_executor_definition text;
  v_chart_issuer_definition text;
  v_materialize_definition text;
  v_origin_definition text;
  v_shell_definition text;
  v_target_subject_constraint text;
begin
  select count(*)::integer
  into v_enabled_count
  from platform_private.registry_operation_types
  where operation_version=1
    and enabled
    and operation_key in (
      'registry.artist.create',
      'registry.track.create',
      'registry.track_artist_credit.admit'
    );

  -- Release Create V1 is a shared Registry identity primitive. Discography may
  -- enable it without granting Charts any Release authority. The additive
  -- Release relationship operations remain outside the Chart broker.
  select count(*)::integer
  into v_release_additive_enabled
  from platform_private.registry_operation_types
  where operation_version=1
    and enabled
    and operation_key in (
      'registry.release_track.admit',
      'registry.release_artist_credit.admit'
    );

  if v_enabled_count <> 3 or v_release_additive_enabled <> 0 then
    raise exception
      'Chart materialization operation enablement drifted';
  end if;

  if to_regprocedure(
       'public.chart_materialize_candidate_registry_v1(uuid,uuid)'
     ) is null
     or to_regprocedure(
       'public.chart_admit_artist_origin_v1(uuid,text,uuid,uuid,text)'
     ) is null
     or to_regprocedure(
       'public.chart_create_artist_origin_shell_v1(text,text,uuid,uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.issue_registry_chart_user_execution_grant_v1(uuid,text,text,uuid,jsonb,text,text,text)'
     ) is null
     or to_regprocedure(
       'platform_private.execute_registry_materialization_core_v1(text,uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.execute_registry_materialization_v1(text,uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.verify_registry_materialization_v1(uuid)'
     ) is null
  then
    raise exception
      'Chart materialization runtime function family is incomplete';
  end if;

  if exists (
    select 1
    from public.role_capabilities
    where capability_key in (
      'create_registry_artist',
      'create_registry_track',
      'create_registry_release',
      'admit_registry_track_artist_credit',
      'admit_registry_release_track',
      'admit_registry_release_artist_credit'
    )
  ) then
    raise exception
      'Typed Registry materialization capability leaked to product roles';
  end if;

  if exists (
    select 1
    from platform_private.system_actor_capability_grants
    where actor_key='registry_chart_admission'
      and status='active'
      and valid_from<=now()
      and expires_at>now()
  ) then
    raise exception
      'Chart materialization unexpectedly has standing authority';
  end if;

  if has_function_privilege(
       'anon',
       'public.chart_materialize_candidate_registry_v1(uuid,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.chart_materialize_candidate_registry_v1(uuid,uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.chart_materialize_candidate_registry_v1(uuid,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'platform_private.execute_registry_materialization_v1(text,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.execute_registry_materialization_v1(text,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'platform_private.execute_registry_materialization_core_v1(text,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.execute_registry_materialization_core_v1(text,uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'Chart materialization privilege boundary drifted';
  end if;

  -- Shared executor support for Release Create must not silently expand the
  -- Chart grant issuer. Prove the Chart broker's exact allow-list remains the
  -- three materialization operations plus Artist Origin only.
  select pg_get_functiondef(
    'platform_private.issue_registry_chart_user_execution_grant_v1(uuid,text,text,uuid,jsonb,text,text,text)'::regprocedure
  ) into v_chart_issuer_definition;

  if position('registry.release.create' in v_chart_issuer_definition) > 0
     or position('registry.release_track.admit' in v_chart_issuer_definition) > 0
     or position('registry.release_artist_credit.admit' in v_chart_issuer_definition) > 0
     or position('registry.artist.create' in v_chart_issuer_definition) = 0
     or position('registry.track.create' in v_chart_issuer_definition) = 0
     or position('registry.track_artist_credit.admit' in v_chart_issuer_definition) = 0
     or position('registry.artist_origin.admit' in v_chart_issuer_definition) = 0
     or position('Operation/capability pair is outside chart materialization V1.' in v_chart_issuer_definition) = 0
  then
    raise exception
      'Chart exact-grant issuer escaped its accepted operation allow-list';
  end if;

  -- Discography wraps the accepted Chart materialization executor to add the
  -- shared Release Create primitive. The Chart identity nucleus remains in the
  -- renamed core and must retain its narrow Artist/Track semantics.
  select regexp_replace(
    pg_get_functiondef(
      'platform_private.execute_registry_materialization_core_v1(text,uuid)'::regprocedure
    ),
    '[[:space:]]+',
    ' ',
    'g'
  )
  into v_executor_definition;

  if not (
       v_executor_definition ~
         'insert into public\.registry_artists[[:space:]]*\([^)]*status[^)]*\)[[:space:]]*values[[:space:]]*\([^;]*''draft'''
     )
     or not (
       v_executor_definition ~
         'insert into public\.registry_tracks[[:space:]]*\([^)]*status[^)]*\)[[:space:]]*values[[:space:]]*\([^;]*''draft'''
     )
     or position('preview_url' in v_executor_definition) > 0
     or position('artwork_url' in v_executor_definition) > 0
  then
    raise exception
      'Chart identity executor crossed the draft identity nucleus boundary';
  end if;

  select pg_get_functiondef(
    'platform_private.execute_registry_materialization_v1(text,uuid)'::regprocedure
  ) into v_shared_executor_definition;

  if position('execute_registry_materialization_core_v1' in v_shared_executor_definition)=0
     or position('registry.release.create' in v_shared_executor_definition)=0
  then
    raise exception
      'Shared materialization wrapper no longer delegates accepted Chart authority';
  end if;

  select pg_get_functiondef(
    'public.chart_materialize_candidate_registry_v1(uuid,uuid)'::regprocedure
  ) into v_materialize_definition;

  select pg_get_functiondef(
    'public.chart_admit_artist_origin_v1(uuid,text,uuid,uuid,text)'::regprocedure
  ) into v_origin_definition;

  select pg_get_functiondef(
    'public.chart_create_artist_origin_shell_v1(text,text,uuid,uuid)'::regprocedure
  ) into v_shell_definition;

  if position('p_candidate_id::text' in v_materialize_definition)=0
     or position('p_run_id::text' in v_materialize_definition)=0
     or position('p_candidate_id::text' in v_origin_definition)=0
     or position('p_run_id::text' in v_origin_definition)=0
     or position('p_candidate_id::text' in v_shell_definition)=0
     or position('p_run_id::text' in v_shell_definition)=0
  then
    raise exception
      'Chart candidate UUID/text identity bridge drifted';
  end if;

  select pg_get_constraintdef(constraint_row.oid)
  into v_target_subject_constraint
  from pg_constraint constraint_row
  where constraint_row.conrelid=
        'platform_private.registry_execution_grant_targets'::regclass
    and constraint_row.conname=
        'registry_execution_grant_targets_subject_type_check';

  if v_target_subject_constraint not like '%track_artist_credit%'
     or v_target_subject_constraint not like '%release_track_membership%'
     or v_target_subject_constraint not like '%release_artist_credit%'
  then
    raise exception
      'Registry execution target relation subject vocabulary drifted';
  end if;

  if position(
       'registry_track_artists'
       in pg_get_functiondef(
            'platform_private.registry_track_artist_credit_collision_state_v1(uuid,uuid,uuid)'::regprocedure
          )
     ) = 0
     or position(
       'status <> ''archived'''
       in pg_get_functiondef(
            'platform_private.registry_track_artist_credit_collision_state_v1(uuid,uuid,uuid)'::regprocedure
          )
     ) > 0
  then
    raise exception
      'Track Artist credit collision authority regressed to status-filtered uniqueness';
  end if;

  raise notice
    'REGISTRY_CHART_MATERIALIZATION_RUNTIME_PASS enabled=3 release_additive_enabled=0 standing_grants=0';
end
$verify$;


-- Permanent verifier for #939 final chart caller-JWT convergence.
do $verify_chart_caller_jwt$
declare v_signature text; v_definition text;
begin
  if not has_table_privilege('authenticated','public.wk_chart_editions_v2','insert') or not has_table_privilege('authenticated','public.wk_chart_editions_v2','update') or not has_table_privilege('authenticated','public.wk_chart_editions_v2','delete') or not has_table_privilege('authenticated','public.wk_chart_entries_v2','insert') or not has_table_privilege('authenticated','public.wk_chart_entries_v2','update') or not has_table_privilege('authenticated','public.wk_chart_entries_v2','delete') then raise exception 'Chart caller-JWT output grants incomplete'; end if;
  foreach v_signature in array array['public.chart_get_run_origin_review_queue_v1(text)','public.chart_get_family_ingest_presets_v1()','public.chart_get_weekly_backfill_plan_v1(text,date,date)','public.chart_reset_run_after_origin_resolution_v1(text)','public.chart_upsert_family_ingest_preset_v1(text,jsonb)','public.chart_get_entry_registry_identity_v1(text)'] loop if to_regprocedure(v_signature) is null or not has_function_privilege('authenticated',v_signature,'execute') or has_function_privilege('anon',v_signature,'execute') or has_function_privilege('service_role',v_signature,'execute') then raise exception 'Chart caller-JWT wrapper privilege drifted: %',v_signature; end if; end loop;
  foreach v_signature in array array['public.chart_get_run_origin_review_queue(text)','public.chart_get_family_ingest_presets()','public.chart_get_weekly_backfill_plan(text,date,date)','public.chart_reset_run_after_origin_resolution(text)','public.chart_upsert_family_ingest_preset(text,jsonb,text)'] loop if has_function_privilege('anon',v_signature,'execute') or has_function_privilege('authenticated',v_signature,'execute') or has_function_privilege('service_role',v_signature,'execute') then raise exception 'Superseded chart helper road remains executable: %',v_signature; end if; end loop;
  select pg_get_functiondef('public.chart_get_entry_registry_identity_v1(text)'::regprocedure) into v_definition; if position('publish_charts' in v_definition)=0 or position('registry_tracks' in v_definition)=0 or position('registry_track_artists' in v_definition)=0 then raise exception 'Chart identity read wrapper drifted'; end if;
  if has_function_privilege('authenticated','public.chart_set_artist_origin_for_charts(uuid,text,text,text,text,text)','execute') or has_function_privilege('service_role','public.chart_set_artist_origin_for_charts(uuid,text,text,text,text,text)','execute') or has_function_privilege('authenticated','public.chart_create_artist_origin_shell(text,text,text,text,text)','execute') or has_function_privilege('service_role','public.chart_create_artist_origin_shell(text,text,text,text,text)','execute') then raise exception 'Legacy chart origin road remains executable'; end if;
  if exists(select 1 from public.role_capabilities p where p.capability_key='publish_charts' and (not exists(select 1 from public.role_capabilities m where m.role_key=p.role_key and m.capability_key='manage_charts') or not exists(select 1 from public.role_capabilities v where v.role_key=p.role_key and v.capability_key='view_charts_admin'))) then raise exception 'publish_charts role bundle lost chart RLS prerequisites'; end if;
  if exists(select 1 from public.role_capabilities i where i.capability_key='manage_ingest' and not exists(select 1 from public.role_capabilities m where m.role_key=i.role_key and m.capability_key='manage_charts')) then raise exception 'manage_ingest role bundle lost manage_charts'; end if;
  raise notice 'REGISTRY_CHART_CALLER_JWT_CONVERGENCE_PASS';
end
$verify_chart_caller_jwt$;

-- Slice 3 Tranche A: Chart Artist Resolution must compose existing Chart
-- materialization authority rather than mutate canonical Track credits directly.
do $verify_chart_artist_resolution_rebase$
declare
  v_definition text;
  v_normalized text;
begin
  if to_regprocedure(
       'public.admin_apply_chart_artist_resolution_decision(uuid)'
     ) is null
     or to_regprocedure(
       'public.admin_resolve_chart_artist_alias(text,uuid,text,boolean)'
     ) is null
     or to_regprocedure(
       'public.admin_set_registry_artist_alias_v1(text,uuid,text,text,text,text)'
     ) is null
  then
    raise exception
      'Chart Artist Resolution convergence command family is incomplete';
  end if;

  if has_function_privilege(
       'anon',
       'public.admin_apply_chart_artist_resolution_decision(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.admin_apply_chart_artist_resolution_decision(uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.admin_apply_chart_artist_resolution_decision(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.admin_set_registry_artist_alias_v1(text,uuid,text,text,text,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.admin_set_registry_artist_alias_v1(text,uuid,text,text,text,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.admin_set_registry_artist_alias_v1(text,uuid,text,text,text,text)',
       'EXECUTE'
     )
  then
    raise exception
      'Chart Artist Resolution caller privilege boundary drifted';
  end if;

  select pg_get_functiondef(
    'public.admin_apply_chart_artist_resolution_decision(uuid)'::regprocedure
  )
  into v_definition;

  if v_definition ~*
       '(insert[[:space:]]+into|update|delete[[:space:]]+from)[[:space:]]+public\.registry_track_artists'
     or position(
          'record_registry_chart_user_evidence_v1'
          in v_definition
        )=0
     or position(
          'issue_registry_chart_user_execution_grant_v1'
          in v_definition
        )=0
     or position(
          'execute_registry_materialization_v1'
          in v_definition
        )=0
     or position(
          'verify_registry_materialization_v1'
          in v_definition
        )=0
     or position(
          'chart_artist_resolution_review'
          in v_definition
        )=0
     or position(
          'requires reviewed credit reconciliation'
          in v_definition
        )=0
  then
    raise exception
      'Chart Artist Resolution bypasses typed credit admission or lost fail-closed conflict handling';
  end if;

  select regexp_replace(
    pg_get_functiondef(
      'platform_private.issue_registry_chart_user_execution_grant_v1(uuid,text,text,uuid,jsonb,text,text,text)'::regprocedure
    ),
    '[[:space:]]+',
    ' ',
    'g'
  )
  into v_normalized;

  if v_normalized !~
       'p_operation_key=''registry\.track\.create''.*p_required_user_capability_key <> ''publish_charts'''
     or v_normalized !~
       'p_operation_key=''registry\.track_artist_credit\.admit''.*p_required_user_capability_key not in \( ''publish_charts'', ''manage_registry'' \)'
  then
    raise exception
      'Chart exact-grant capability partition drifted during Artist Resolution convergence';
  end if;

  select pg_get_functiondef(
    'public.chart_get_entry_registry_identity_v1(text)'::regprocedure
  )
  into v_definition;

  if position(
       'status <> ''archived'''
       in v_definition
     )=0
     or position(
          'having count(*)=1'
          in regexp_replace(v_definition,'[[:space:]]+','','g')
        )=0
  then
    raise exception
      'Chart current Artist identity read does not require one non-archived primary credit';
  end if;

  select pg_get_functiondef(
    'public.admin_resolve_chart_artist_alias(text,uuid,text,boolean)'::regprocedure
  )
  into v_definition;

  if position(
       'admin_set_registry_artist_alias_v1'
       in v_definition
     )=0
     or v_definition ~*
        '(update|delete[[:space:]]+from)[[:space:]]+public\.registry_(artists|track_artists)'
  then
    raise exception
      'Chart Artist alias compatibility wrapper regained legacy canonical mutation';
  end if;

  raise notice
    'REGISTRY_CHART_ARTIST_RESOLUTION_REBASE_PASS';
end
$verify_chart_artist_resolution_rebase$;
