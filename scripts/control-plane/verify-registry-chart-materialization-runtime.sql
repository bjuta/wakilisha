-- Permanent verifier for #939 Boundary B1 chart materialization runtime.

do $verify$
declare
  v_enabled_count integer;
  v_release_enabled integer;
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

  select count(*)::integer
  into v_release_enabled
  from platform_private.registry_operation_types
  where operation_version=1
    and enabled
    and operation_key in (
      'registry.release.create',
      'registry.release_track.admit',
      'registry.release_artist_credit.admit'
    );

  if v_enabled_count <> 3 or v_release_enabled <> 0 then
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
  then
    raise exception
      'Chart materialization privilege boundary drifted';
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
    'REGISTRY_CHART_MATERIALIZATION_RUNTIME_PASS enabled=3 release_enabled=0 standing_grants=0';
end
$verify$;
