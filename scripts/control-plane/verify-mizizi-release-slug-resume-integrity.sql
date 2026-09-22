do $verify$
declare
  v_def text;
begin
  if to_regprocedure(
       'mizizi_private.release_slug_plan_v1(uuid)'
     ) is null
  then
    raise exception
      'MIZIZI Release slug planner is missing';
  end if;

  select pg_get_functiondef(
    'mizizi_private.release_slug_plan_v1(uuid)'::regprocedure
  )
  into v_def;

  if position(
       'registry_canonical_write_events'
       in v_def
     )=0
     or position(
       'canonicalize_release_slug'
       in v_def
     )=0
     or position(
       'system:mizizi'
       in v_def
     )=0
     or position(
       'mizizi_private.release_slug_plan_v1'
       in v_def
     )=0
     or position(
       'event.before_value'
       in v_def
     )=0
     or position(
       'event.after_value'
       in v_def
     )=0
     or position(
       'v_prior_mizizi_date_fallback'
       in v_def
     )=0
  then
    raise exception
      'MIZIZI Release slug planner is not provenance-bound for monotonic date fallback';
  end if;

  if not has_function_privilege(
       'mizizi_executor',
       'mizizi_private.release_slug_plan_v1(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'mizizi_private.release_slug_plan_v1(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'mizizi_private.release_slug_plan_v1(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'mizizi_private.release_slug_plan_v1(uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'MIZIZI Release slug planner privileges are not exact';
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
    raise exception
      'Active MIZIZI standing authority exists at rest';
  end if;

  if exists (
    select 1
    from platform_private.registry_execution_grants
    where actor_key='mizizi'
      and status='active'
      and consumed_at is null
      and revoked_at is null
  ) then
    raise exception
      'Active MIZIZI exact authority exists at rest';
  end if;

  if exists (
    select 1
    from platform_private.registry_operation_types
    where operation_key='registry.release_slug.canonicalize'
      and operation_version=1
      and enabled
  ) then
    raise exception
      'MIZIZI Release slug operation is enabled at rest';
  end if;
end
$verify$;

select
  'MIZIZI_RELEASE_SLUG_RESUME_INTEGRITY_PASS'
    as verification_result;
