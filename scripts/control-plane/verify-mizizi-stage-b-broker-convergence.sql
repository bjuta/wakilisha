-- MIZIZI Slice 3 Stage B typed broker convergence verifier.
-- Read-only. Proves broker authority is installed but inert.

do $verify$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version='20260918173446'
      and name='mizizi_stage_b_broker_convergence_v1'
  ) then
    raise exception 'STOP: exact Stage B migration identity is absent';
  end if;

  if (
    select count(*)
    from platform_private.registry_operation_types
    where operation_version=1
      and operation_key in (
        'registry.track_slug.canonicalize',
        'registry.release_taxonomy.repair',
        'registry.release_slug.canonicalize',
        'registry.chart_track_slug.synchronize'
      )
      and enabled=false
      and max_targets=1
      and max_rows_ceiling=1
      and max_grant_ttl_seconds=300
      and requires_verifier=true
  )<>4 then
    raise exception 'STOP: Stage B operation type shape is not exact and inert';
  end if;

  if not exists (
    select 1
    from platform_private.system_actor_executor_bindings
    where actor_key='mizizi'
      and executor_kind='database_role'
      and executor_key='postgres'
      and status='active'
  )
     or not exists (
       select 1
       from platform_private.system_actor_executor_bindings
       where actor_key='mizizi'
         and executor_kind='database_role'
         and executor_key='mizizi_executor'
         and status='disabled'
     )
  then
    raise exception 'STOP: Stage B transport boundary changed prematurely';
  end if;

  if exists (
    select 1
    from platform_private.system_actor_capability_grants
    where actor_key='mizizi'
      and status='active'
      and valid_from<=now()
      and expires_at>now()
      and revoked_at is null
  ) then
    raise exception 'STOP: active MIZIZI standing grant exists at rest';
  end if;

  if exists (
    select 1
    from platform_private.registry_execution_grants
    where actor_key='mizizi'
      and status='active'
      and expires_at>now()
      and revoked_at is null
      and consumed_at is null
  ) then
    raise exception 'STOP: active MIZIZI exact grant exists at rest';
  end if;

  if has_table_privilege(
       'mizizi_executor',
       'public.registry_tracks',
       'UPDATE'
     )
     or has_table_privilege(
       'mizizi_executor',
       'public.registry_releases',
       'UPDATE'
     )
     or has_table_privilege(
       'mizizi_executor',
       'public.wk_chart_entries_v2',
       'UPDATE'
     )
     or has_table_privilege(
       'mizizi_executor',
       'public.registry_review_items',
       'INSERT'
     )
     or has_table_privilege(
       'mizizi_executor',
       'public.registry_canonical_write_events',
       'INSERT'
     )
     or has_table_privilege(
       'mizizi_executor',
       'platform_private.registry_execution_grants',
       'INSERT'
     )
  then
    raise exception 'STOP: direct executor mutation authority exists';
  end if;

  if not has_function_privilege(
       'mizizi_executor',
       'mizizi_private.issue_stewardship_execution_grant_v1(text,text,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'mizizi_executor',
       'mizizi_private.execute_stewardship_operation_v1(uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'mizizi_executor',
       'mizizi_private.verify_stewardship_operation_v1(uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'mizizi_executor',
       'mizizi_private.queue_registry_review_v1(text,text,text,text,text,text,text,text,numeric,text,text,jsonb)',
       'EXECUTE'
     )
  then
    raise exception 'STOP: exact Stage B broker EXECUTE authority is incomplete';
  end if;

  if has_function_privilege(
       'anon',
       'mizizi_private.execute_stewardship_operation_v1(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'mizizi_private.execute_stewardship_operation_v1(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'mizizi_private.execute_stewardship_operation_v1(uuid)',
       'EXECUTE'
     )
  then
    raise exception 'STOP: Stage B broker leaked to browser/service roles';
  end if;
end
$verify$;

select
  'MIZIZI_STAGE_B_BROKER_CONVERGENCE_PASS'::text as status,
  (select count(*) from supabase_migrations.schema_migrations)::int
    as migration_count,
  (select max(version) from supabase_migrations.schema_migrations)
    as migration_head,
  (
    select count(*)::int
    from platform_private.system_actor_capability_grants
    where actor_key='mizizi'
      and status='active'
      and valid_from<=now()
      and expires_at>now()
      and revoked_at is null
  ) as active_standing_grants,
  (
    select count(*)::int
    from platform_private.registry_execution_grants
    where actor_key='mizizi'
      and status='active'
      and expires_at>now()
      and revoked_at is null
      and consumed_at is null
  ) as active_exact_grants;
