begin;

set local statement_timeout = '180s';
set local lock_timeout = '5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'phase-8b-messages-core-verifier-runtime-state-independence',
    0
  )
);

do $preflight$
declare
  v_def text;
begin
  if to_regprocedure(
       'messaging.verify_core_foundation()'
     ) is null
  then
    raise exception
      'STOP: Messages core verifier is missing';
  end if;

  select pg_get_functiondef(
    'messaging.verify_core_foundation()'::regprocedure
  )
  into v_def;

  if position(
       'structural Messages migration unexpectedly assigned super_admin'
       in v_def
     ) = 0
  then
    raise exception
      'STOP: reviewed state-coupled Messages core verifier signature moved';
  end if;

  if position(
       'manage_messages_control_center'
       in v_def
     ) = 0
     or position(
          'browser role has direct Messages table privilege'
          in v_def
        ) = 0
     or position(
          'Messages runtime policy singleton is invalid'
          in v_def
        ) = 0
  then
    raise exception
      'STOP: reviewed Messages core structural verifier contract moved';
  end if;
end;
$preflight$;

create or replace function messaging.verify_core_foundation()
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public, editorial, messaging
as $function$
declare
  v_admin_capabilities bigint;
  v_super_capabilities bigint;
  v_missing_admin_capabilities bigint;
  v_super_assignments bigint;
  v_policy_count bigint;
begin
  select count(*) into v_admin_capabilities
  from public.role_capabilities
  where role_key='administrator';

  select count(*) into v_super_capabilities
  from public.role_capabilities
  where role_key='super_admin';

  select count(*) into v_missing_admin_capabilities
  from public.role_capabilities admin_cap
  where admin_cap.role_key='administrator'
    and not exists (
      select 1
      from public.role_capabilities super_cap
      where super_cap.role_key='super_admin'
        and super_cap.capability_key=admin_cap.capability_key
    );

  select count(*) into v_super_assignments
  from public.user_role_assignments
  where role_key='super_admin';

  select count(*) into v_policy_count
  from messaging.runtime_policy;

  if v_missing_admin_capabilities <> 0 then
    raise exception
      'STOP: super_admin is missing % administrator capability/capabilities',
      v_missing_admin_capabilities;
  end if;

  if not exists (
    select 1
    from public.role_capabilities
    where role_key='super_admin'
      and capability_key='manage_messages_control_center'
  ) then
    raise exception
      'STOP: super_admin lacks Messages Control Center capability';
  end if;

  if exists (
    select 1
    from public.role_capabilities
    where capability_key='manage_messages_control_center'
      and role_key <> 'super_admin'
  ) then
    raise exception
      'STOP: Messages Control Center capability leaked beyond super_admin';
  end if;

  if v_policy_count <> 1
     or not exists (
       select 1
       from messaging.runtime_policy
       where singleton
         and audience_mode='internal'
         and revision=1
     )
  then
    raise exception
      'STOP: Messages runtime policy singleton is invalid';
  end if;

  if exists (
    select 1
    from information_schema.table_privileges
    where table_schema='messaging'
      and grantee in ('anon','authenticated')
  ) then
    raise exception
      'STOP: browser role has direct Messages table privilege';
  end if;

  return jsonb_build_object(
    'ok', true,
    'administrator_capabilities',
      v_admin_capabilities,
    'super_admin_capabilities',
      v_super_capabilities,
    'super_admin_assignments',
      v_super_assignments,
    'audience_mode',
      'internal'
  );
end;
$function$;

comment on function messaging.verify_core_foundation() is
  'Structural Messages core verifier. Runtime super_admin assignment count is informational and must not invalidate the structural contract after explicit operator assignment.';

do $postcheck$
declare
  v_def text;
  v_result jsonb;
begin
  select pg_get_functiondef(
    'messaging.verify_core_foundation()'::regprocedure
  )
  into v_def;

  if position(
       'structural Messages migration unexpectedly assigned super_admin'
       in v_def
     ) <> 0
  then
    raise exception
      'STOP: state-coupled super_admin assignment rejection remains';
  end if;

  if position(
       'manage_messages_control_center'
       in v_def
     ) = 0
     or position(
          'browser role has direct Messages table privilege'
          in v_def
        ) = 0
     or position(
          'Messages runtime policy singleton is invalid'
          in v_def
        ) = 0
  then
    raise exception
      'STOP: structural Messages core verifier checks were lost';
  end if;

  v_result := messaging.verify_core_foundation();

  if not coalesce(
       (v_result ->> 'ok')::boolean,
       false
     )
  then
    raise exception
      'STOP: repaired Messages core verifier did not pass';
  end if;
end;
$postcheck$;

commit;
