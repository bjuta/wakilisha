-- WAKILISHA / MIZIZI Slice 2 / #939
-- Boundary B1 chart materialization runtime integrity.

begin;

set local statement_timeout = '180s';
set local lock_timeout = '5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'wk939-registry-chart-materialization-runtime-integrity-v1',
    0
  )
);

do $verify$
declare
  v_enabled_count integer;
  v_disabled_release_count integer;
  v_subject_constraint text;
begin
  select count(*)::integer
  into v_enabled_count
  from platform_private.registry_operation_types operation_type
  where operation_type.operation_version=1
    and operation_type.enabled
    and operation_type.operation_key in (
      'registry.artist.create',
      'registry.track.create',
      'registry.track_artist_credit.admit'
    );

  if v_enabled_count <> 3 then
    raise exception
      'STOP: exactly the three chart materialization V1 operations must be enabled';
  end if;

  select count(*)::integer
  into v_disabled_release_count
  from platform_private.registry_operation_types operation_type
  where operation_type.operation_version=1
    and not operation_type.enabled
    and operation_type.operation_key in (
      'registry.release.create',
      'registry.release_track.admit',
      'registry.release_artist_credit.admit'
    );

  if v_disabled_release_count <> 3 then
    raise exception
      'STOP: Release materialization family must remain inert';
  end if;

  select pg_get_constraintdef(constraint_row.oid)
  into v_subject_constraint
  from pg_constraint constraint_row
  where constraint_row.conrelid=
        'platform_private.registry_evidence_assertions'::regclass
    and constraint_row.conname=
        'registry_evidence_assertions_subject_type_check';

  if v_subject_constraint not like '%track_artist_credit%'
     or v_subject_constraint not like '%release_track_membership%'
     or v_subject_constraint not like '%release_artist_credit%'
  then
    raise exception
      'STOP: evidence subject vocabulary did not converge with governed relation subjects';
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
      'STOP: typed Registry materialization capability leaked to product roles';
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
      'STOP: chart materialization must not use standing System Actor authority';
  end if;

  if has_function_privilege(
       'authenticated',
       'platform_private.issue_registry_chart_user_execution_grant_v1(uuid,text,text,uuid,jsonb,text,text,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.issue_registry_chart_user_execution_grant_v1(uuid,text,text,uuid,jsonb,text,text,text)',
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
       'platform_private.verify_registry_materialization_v1(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.verify_registry_materialization_v1(uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: private chart materialization authority leaked executable privileges';
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
       'anon',
       'public.chart_admit_artist_origin_v1(uuid,text,uuid,uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.chart_admit_artist_origin_v1(uuid,text,uuid,uuid,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.chart_admit_artist_origin_v1(uuid,text,uuid,uuid,text)',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: public chart materialization RPC privileges drifted';
  end if;

  if position(
       'status=''draft'''
       in pg_get_functiondef(
            'platform_private.execute_registry_materialization_v1(text,uuid)'::regprocedure
          )
     ) = 0
     or position(
       'preview_url'
       in pg_get_functiondef(
            'platform_private.execute_registry_materialization_v1(text,uuid)'::regprocedure
          )
     ) > 0
     or position(
       'artwork_url'
       in pg_get_functiondef(
            'platform_private.execute_registry_materialization_v1(text,uuid)'::regprocedure
          )
     ) > 0
  then
    raise exception
      'STOP: identity executor crossed the draft identity nucleus boundary';
  end if;

  raise notice
    'REGISTRY_CHART_MATERIALIZATION_RUNTIME_PASS enabled=3 release_enabled=0 standing_grants=0';
end
$verify$;

commit;
