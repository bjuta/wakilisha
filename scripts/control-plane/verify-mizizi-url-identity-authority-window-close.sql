do $verify$
declare
  v_def text;
begin
  if to_regprocedure(
       'mizizi_private.close_stewardship_authority_window_v1(text,uuid,text)'
     ) is null
  then
    raise exception 'MIZIZI authority-window close primitive is missing';
  end if;

  if not has_function_privilege(
       'mizizi_executor',
       'mizizi_private.close_stewardship_authority_window_v1(text,uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'mizizi_private.close_stewardship_authority_window_v1(text,uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'mizizi_private.close_stewardship_authority_window_v1(text,uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'mizizi_private.close_stewardship_authority_window_v1(text,uuid,text)',
       'EXECUTE'
     )
  then
    raise exception 'MIZIZI authority-window close privileges are not exact';
  end if;

  select pg_get_functiondef(
    'mizizi_private.close_stewardship_authority_window_v1(text,uuid,text)'::regprocedure
  )
  into v_def;

  if v_def !~ 'perform mizizi_private[.]assert_executor_v1[(][)]'
     or v_def !~ 'status=''expired'''
     or v_def !~ 'enabled=false'
     or v_def ~* 'enabled[[:space:]]*=[[:space:]]*true'
  then
    raise exception 'MIZIZI authority-window close function is not reduction-only';
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
    raise exception 'Active MIZIZI standing authority exists at rest';
  end if;

  if exists (
    select 1
    from platform_private.registry_execution_grants
    where actor_key='mizizi'
      and status='active'
      and consumed_at is null
      and revoked_at is null
  ) then
    raise exception 'Active MIZIZI exact authority exists at rest';
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
  )<>4 then
    raise exception 'MIZIZI stewardship operations are not disabled at rest';
  end if;
end
$verify$;

select 'MIZIZI_URL_IDENTITY_AUTHORITY_WINDOW_CLOSE_PASS' as verification_result;
