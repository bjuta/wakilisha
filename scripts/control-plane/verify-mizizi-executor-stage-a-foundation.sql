-- MIZIZI Slice 3 Stage A executor foundation verifier.
-- Read-only. Proves the future narrow executor is installed inertly.

do $verify$
declare
  v_role record;
  v_active_standing bigint;
  v_active_exact bigint;
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version='20260918120331'
      and name='mizizi_executor_foundation_v1'
  ) then
    raise exception 'STOP: exact Stage A migration identity is absent';
  end if;

  select *
  into v_role
  from pg_roles
  where rolname='mizizi_executor';

  if not found then
    raise exception 'STOP: mizizi_executor role is absent';
  end if;

  if not v_role.rolcanlogin
     or v_role.rolsuper
     or v_role.rolcreatedb
     or v_role.rolcreaterole
     or v_role.rolreplication
     or v_role.rolbypassrls
     or v_role.rolinherit then
    raise exception 'STOP: mizizi_executor role privilege shape is unsafe';
  end if;

  if not exists (
    select 1
    from platform_private.system_actor_executor_bindings
    where actor_key='mizizi'
      and executor_kind='database_role'
      and executor_key='mizizi_executor'
      and status='disabled'
  ) then
    raise exception 'STOP: inert mizizi_executor binding is missing';
  end if;

  if not exists (
    select 1
    from platform_private.system_actor_executor_bindings
    where actor_key='mizizi'
      and executor_kind='database_role'
      and executor_key='postgres'
      and status='active'
  ) then
    raise exception 'STOP: live postgres binding changed during Stage A';
  end if;

  select count(*)
  into v_active_standing
  from platform_private.system_actor_capability_grants
  where actor_key='mizizi'
    and status='active'
    and valid_from <= now()
    and (expires_at is null or expires_at > now())
    and revoked_at is null;

  if v_active_standing <> 0 then
    raise exception 'STOP: active MIZIZI standing grants exist: %', v_active_standing;
  end if;

  select count(*)
  into v_active_exact
  from platform_private.registry_execution_grants
  where actor_key='mizizi'
    and status='active'
    and expires_at > now()
    and revoked_at is null
    and consumed_at is null;

  if v_active_exact <> 0 then
    raise exception 'STOP: active MIZIZI exact grants exist: %', v_active_exact;
  end if;

  if (
    select count(*)
    from platform_private.registry_operation_types
    where operation_version=1
      and operation_key in (
        'registry.release_taxonomy.repair',
        'registry.chart_track_slug.synchronize'
      )
      and enabled=false
      and max_targets=1
      and max_rows_ceiling=1
      and max_grant_ttl_seconds=300
      and requires_verifier=true
      and requires_existing_target=true
  ) <> 2 then
    raise exception 'STOP: Stage A operation registry shape is incomplete or widened';
  end if;

  if has_table_privilege('mizizi_executor','public.registry_tracks','INSERT')
     or has_table_privilege('mizizi_executor','public.registry_tracks','UPDATE')
     or has_table_privilege('mizizi_executor','public.registry_tracks','DELETE')
     or has_table_privilege('mizizi_executor','public.registry_releases','INSERT')
     or has_table_privilege('mizizi_executor','public.registry_releases','UPDATE')
     or has_table_privilege('mizizi_executor','public.registry_releases','DELETE')
     or has_table_privilege('mizizi_executor','public.wk_chart_entries_v2','INSERT')
     or has_table_privilege('mizizi_executor','public.wk_chart_entries_v2','UPDATE')
     or has_table_privilege('mizizi_executor','public.wk_chart_entries_v2','DELETE')
     or has_table_privilege('mizizi_executor','public.registry_review_items','INSERT')
     or has_table_privilege('mizizi_executor','public.registry_review_items','UPDATE')
     or has_table_privilege('mizizi_executor','public.registry_review_items','DELETE')
     or has_table_privilege('mizizi_executor','platform_private.registry_execution_grants','INSERT')
     or has_table_privilege('mizizi_executor','platform_private.registry_execution_grants','UPDATE')
     or has_table_privilege('mizizi_executor','platform_private.registry_execution_grants','DELETE') then
    raise exception 'STOP: mizizi_executor has direct governed-table mutation authority';
  end if;

  if not has_schema_privilege('mizizi_executor','mizizi_private','USAGE')
     or has_schema_privilege('mizizi_executor','platform_private','USAGE') then
    raise exception 'STOP: mizizi_executor schema boundary is incorrect';
  end if;

  if not has_function_privilege('mizizi_executor','mizizi_private.assert_executor_v1()','EXECUTE')
     or not has_function_privilege('mizizi_executor','mizizi_private.release_taxonomy_plan_v1(uuid)','EXECUTE')
     or not has_function_privilege('mizizi_executor','mizizi_private.chart_track_slug_plan_v1(text)','EXECUTE')
     or not has_function_privilege(
       'mizizi_executor',
       'mizizi_private.queue_registry_review_v1(text,text,text,text,text,text,text,text,numeric,text,text,jsonb)',
       'EXECUTE'
     ) then
    raise exception 'STOP: exact Stage A executor broker grants are incomplete';
  end if;

  if has_function_privilege('anon','mizizi_private.assert_executor_v1()','EXECUTE')
     or has_function_privilege('authenticated','mizizi_private.assert_executor_v1()','EXECUTE')
     or has_function_privilege('service_role','mizizi_private.assert_executor_v1()','EXECUTE')
     or has_function_privilege('anon','mizizi_private.release_taxonomy_plan_v1(uuid)','EXECUTE')
     or has_function_privilege('authenticated','mizizi_private.release_taxonomy_plan_v1(uuid)','EXECUTE')
     or has_function_privilege('service_role','mizizi_private.release_taxonomy_plan_v1(uuid)','EXECUTE')
     or has_function_privilege('anon','mizizi_private.chart_track_slug_plan_v1(text)','EXECUTE')
     or has_function_privilege('authenticated','mizizi_private.chart_track_slug_plan_v1(text)','EXECUTE')
     or has_function_privilege('service_role','mizizi_private.chart_track_slug_plan_v1(text)','EXECUTE')
     or has_function_privilege(
       'anon',
       'mizizi_private.queue_registry_review_v1(text,text,text,text,text,text,text,text,numeric,text,text,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'mizizi_private.queue_registry_review_v1(text,text,text,text,text,text,text,text,numeric,text,text,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'mizizi_private.queue_registry_review_v1(text,text,text,text,text,text,text,text,numeric,text,text,jsonb)',
       'EXECUTE'
     ) then
    raise exception 'STOP: Stage A broker leaked to browser/service roles';
  end if;
end
$verify$;

select
  'MIZIZI_EXECUTOR_STAGE_A_FOUNDATION_PASS'::text as status,
  (select count(*) from supabase_migrations.schema_migrations)::int as migration_count,
  (select max(version) from supabase_migrations.schema_migrations) as migration_head,
  (
    select count(*)::int
    from platform_private.system_actor_capability_grants
    where actor_key='mizizi'
      and status='active'
      and valid_from <= now()
      and (expires_at is null or expires_at > now())
      and revoked_at is null
  ) as active_standing_grants,
  (
    select count(*)::int
    from platform_private.registry_execution_grants
    where actor_key='mizizi'
      and status='active'
      and expires_at > now()
      and revoked_at is null
      and consumed_at is null
  ) as active_exact_grants;
