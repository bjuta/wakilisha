-- MIZIZI URL-identity programme authority-window closure.
--
-- This delta does not create mutation authority. Human manage_registry commands
-- remain the only way to enable a stewardship operation and issue the standing
-- MIZIZI capability grant. The executor may only reduce that already-issued
-- authority after a governed run.

do $preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version='20260920095334'
      and name='mizizi_stage_c_narrow_executor_transport_v1'
  ) then
    raise exception 'STOP: Stage C narrow executor transport is required';
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
    raise exception 'STOP: URL-identity authority-window closure requires all stewardship operations disabled at entry';
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
    raise exception 'STOP: URL-identity authority-window closure migration requires zero active MIZIZI standing grants';
  end if;

  if exists (
    select 1
    from platform_private.registry_execution_grants
    where actor_key='mizizi'
      and status='active'
      and consumed_at is null
      and revoked_at is null
  ) then
    raise exception 'STOP: URL-identity authority-window closure migration requires zero active MIZIZI exact grants';
  end if;

  if not exists (
    select 1
    from platform_private.system_actor_executor_bindings
    where actor_key='mizizi'
      and executor_kind='database_role'
      and executor_key='mizizi_executor'
      and status='active'
  )
  or exists (
    select 1
    from platform_private.system_actor_executor_bindings
    where actor_key='mizizi'
      and executor_kind='database_role'
      and executor_key='postgres'
      and status='active'
  ) then
    raise exception 'STOP: Stage C executor binding is not exact';
  end if;
end
$preflight$;

create function mizizi_private.close_stewardship_authority_window_v1(
  p_operation_key text,
  p_capability_grant_id uuid,
  p_reason text
)
returns table (
  expired_exact_grants integer,
  operation_was_enabled boolean,
  standing_grant_status text
)
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, mizizi_private
as $$
declare
  v_operation platform_private.registry_operation_types%rowtype;
  v_standing platform_private.system_actor_capability_grants%rowtype;
  v_expired integer := 0;
  v_operation_was_enabled boolean := false;
  v_changed boolean := false;
  v_standing_status_before text;
begin
  perform mizizi_private.assert_executor_v1();

  if p_operation_key not in (
       'registry.track_slug.canonicalize',
       'registry.release_taxonomy.repair',
       'registry.release_slug.canonicalize',
       'registry.chart_track_slug.synchronize'
     )
     or p_capability_grant_id is null
     or nullif(btrim(p_reason),'') is null
     or octet_length(p_reason)>1000
  then
    raise exception using errcode='22023',
      message='Exact operation, capability grant and bounded close reason are required.';
  end if;

  select operation.*
  into v_operation
  from platform_private.registry_operation_types operation
  where operation.operation_key=p_operation_key
    and operation.operation_version=1
  for update;

  if not found then
    raise exception using errcode='P0002',
      message='MIZIZI stewardship operation type is missing.';
  end if;

  select standing.*
  into v_standing
  from platform_private.system_actor_capability_grants standing
  where standing.id=p_capability_grant_id
  for update;

  v_standing_status_before := v_standing.status;

  if not found
     or v_standing.actor_key<>'mizizi'
     or v_standing.capability_key<>v_operation.capability_key
     or v_standing.status not in ('active','expired','revoked')
     or not (
       v_standing.scope @>
       jsonb_build_object(
         'operation_key',p_operation_key,
         'operation_version',1,
         'max_rows',1
       )
     )
  then
    raise exception using errcode='42501',
      message='Capability grant does not bind this exact MIZIZI stewardship operation.';
  end if;

  if exists (
    select 1
    from platform_private.registry_execution_grants grant_row
    join platform_private.registry_mutation_operations operation
      on operation.execution_grant_id=grant_row.id
    where grant_row.system_actor_capability_grant_id=p_capability_grant_id
      and grant_row.actor_key='mizizi'
      and grant_row.operation_key=p_operation_key
      and (
        operation.status in (
          'authorized',
          'executing',
          'compensating'
        )
        or (
          operation.status='succeeded'
          and operation.verifier_status<>'passed'
        )
      )
  ) then
    raise exception using errcode='55000',
      message='Cannot close MIZIZI stewardship authority while unsafe operation residue remains.';
  end if;

  update platform_private.registry_execution_grants
  set
    status='expired',
    updated_at=now()
  where system_actor_capability_grant_id=p_capability_grant_id
    and actor_key='mizizi'
    and operation_key=p_operation_key
    and operation_version=1
    and status='active'
    and consumed_at is null
    and revoked_at is null;

  get diagnostics v_expired=row_count;
  if v_expired>0 then
    v_changed := true;
  end if;

  v_operation_was_enabled := v_operation.enabled;

  if v_operation.enabled then
    update platform_private.registry_operation_types
    set
      enabled=false,
      updated_at=now()
    where operation_key=p_operation_key
      and operation_version=1;
    v_changed := true;
  end if;

  if v_standing.status='active' then
    update platform_private.system_actor_capability_grants
    set
      status='expired',
      updated_at=now()
    where id=p_capability_grant_id
      and status='active';
    v_standing.status := 'expired';
    v_changed := true;
  end if;

  if exists (
    select 1
    from platform_private.registry_execution_grants
    where system_actor_capability_grant_id=p_capability_grant_id
      and actor_key='mizizi'
      and operation_key=p_operation_key
      and operation_version=1
      and status='active'
      and consumed_at is null
      and revoked_at is null
  ) then
    raise exception using errcode='55000',
      message='MIZIZI exact execution authority remained active after close.';
  end if;

  if exists (
    select 1
    from platform_private.registry_operation_types
    where operation_key=p_operation_key
      and operation_version=1
      and enabled
  ) then
    raise exception using errcode='55000',
      message='MIZIZI stewardship operation remained enabled after close.';
  end if;

  if v_changed then
    insert into public.registry_audit_log (
      actor_id,
      actor_label,
      action,
      entity_type,
      entity_id,
      before_value,
      after_value,
      metadata
    )
    values (
      v_standing.granted_by_user_id,
      'system:mizizi',
      'close_mizizi_stewardship_authority_window',
      'system_actor_capability_grant',
      p_capability_grant_id,
      jsonb_build_object(
        'standing_grant_status',
        v_standing_status_before,
        'operation_enabled',v_operation_was_enabled
      ),
      jsonb_build_object(
        'standing_grant_status',v_standing.status,
        'operation_enabled',false,
        'expired_exact_grants',v_expired
      ),
      jsonb_build_object(
        'operation_key',p_operation_key,
        'operation_version',1,
        'authority_issuer_user_id',v_standing.granted_by_user_id,
        'closed_by_database_role',session_user,
        'reason',btrim(p_reason)
      )
    );
  end if;

  expired_exact_grants := v_expired;
  operation_was_enabled := v_operation_was_enabled;
  standing_grant_status := v_standing.status;
  return next;
end
$$;

revoke all on function
  mizizi_private.close_stewardship_authority_window_v1(text,uuid,text)
from public, anon, authenticated, service_role;

grant execute on function
  mizizi_private.close_stewardship_authority_window_v1(text,uuid,text)
to mizizi_executor;

do $postflight$
declare
  v_def text;
begin
  if not has_function_privilege(
       'mizizi_executor',
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
    raise exception 'STOP: authority-window close execution grants are not exact';
  end if;

  select pg_get_functiondef(
    'mizizi_private.close_stewardship_authority_window_v1(text,uuid,text)'::regprocedure
  )
  into v_def;

  if v_def ~* 'set[[:space:]]+enabled[[:space:]]*=[[:space:]]*true'
     or v_def ~* 'set[[:space:]]+status[[:space:]]*=[[:space:]]*''active'''
  then
    raise exception 'STOP: authority-window close primitive contains authority-increasing assignment';
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
    raise exception 'STOP: stewardship operations must remain disabled after migration';
  end if;
end
$postflight$;
