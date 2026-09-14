-- MIZIZI Slice 2 / #939
-- Registry identity creation primitive foundation integrity.
--
-- Locks the immutable V1 operation contract while keeping enablement as the
-- deliberate product/runtime switch for Boundary B.

begin;

set local statement_timeout = '180s';
set local lock_timeout = '5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'mizizi-registry-identity-creation-primitive-integrity-v1',
    0
  )
);

do $preflight$
begin
  if to_regprocedure(
       'platform_private.registry_identity_normalize_text_v1(text)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_identity_comparison_key_v1(text)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_identity_canonical_isrc_v1(text)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_identity_canonical_upc_v1(text)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_artist_creation_collision_state_v1(uuid,text)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_track_creation_collision_state_v1(uuid,text,uuid,text)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_release_creation_collision_state_v1(uuid,text,uuid,text)'
     ) is null
  then
    raise exception
      'STOP: Registry identity creation foundation is incomplete';
  end if;
end
$preflight$;

create or replace function
platform_private.guard_registry_identity_creation_operation_type_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if old.operation_key not in (
    'registry.artist.create',
    'registry.track.create',
    'registry.release.create'
  ) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'DELETE' then
    raise exception
      using errcode = '23514',
            message = 'Registry identity creation V1 operation types cannot be deleted; version a replacement instead.';
  end if;

  if row(
       old.operation_key,
       old.operation_version,
       old.capability_key,
       old.risk_class,
       old.allowed_subject_types,
       old.requires_existing_target,
       old.max_targets,
       old.max_rows_ceiling,
       old.max_grant_ttl_seconds,
       old.requires_human_approval,
       old.requires_verifier,
       old.created_at
     )
     is distinct from
     row(
       new.operation_key,
       new.operation_version,
       new.capability_key,
       new.risk_class,
       new.allowed_subject_types,
       new.requires_existing_target,
       new.max_targets,
       new.max_rows_ceiling,
       new.max_grant_ttl_seconds,
       new.requires_human_approval,
       new.requires_verifier,
       new.created_at
     )
  then
    raise exception
      using errcode = '23514',
            message = 'Registry identity creation V1 operation semantics are immutable; version a replacement instead.';
  end if;

  return new;
end
$$;

drop trigger if exists
  registry_identity_creation_operation_type_v1_guard
on platform_private.registry_operation_types;

create trigger
  registry_identity_creation_operation_type_v1_guard
before update or delete
on platform_private.registry_operation_types
for each row
execute function
  platform_private.guard_registry_identity_creation_operation_type_v1();

revoke all on function
  platform_private.guard_registry_identity_creation_operation_type_v1()
from public, anon, authenticated, service_role;

do $proof$
declare
  v_count integer;
begin
  if platform_private.registry_identity_normalize_text_v1(
       '  Café   del Mar  '
     ) <> 'café del mar'
  then
    raise exception
      'STOP: Registry canonical text normalization V1 drifted';
  end if;

  if platform_private.registry_identity_comparison_key_v1(
       'K’naan'
     ) <> 'k naan'
     or platform_private.registry_identity_comparison_key_v1(
       'K''naan'
     ) <> 'k naan'
  then
    raise exception
      'STOP: Registry identity comparison key V1 drifted';
  end if;

  if platform_private.registry_identity_canonical_isrc_v1(
       'us-abc-12-34567'
     ) <> 'USABC1234567'
  then
    raise exception
      'STOP: Registry ISRC canonicalization V1 drifted';
  end if;

  if platform_private.registry_identity_canonical_upc_v1(
       '0 123456789012'
     ) <> '0123456789012'
  then
    raise exception
      'STOP: Registry UPC canonicalization V1 drifted';
  end if;

  select count(*)::integer
  into v_count
  from platform_private.registry_operation_types operation_type
  where (
        operation_type.operation_key,
        operation_type.operation_version,
        operation_type.capability_key,
        operation_type.risk_class,
        operation_type.requires_existing_target,
        operation_type.max_targets,
        operation_type.max_rows_ceiling,
        operation_type.max_grant_ttl_seconds,
        operation_type.requires_human_approval,
        operation_type.requires_verifier,
        operation_type.enabled
      ) in (
        (
          'registry.artist.create', 1, 'create_registry_artist',
          'medium', false, 1, 1, 300, true, true, false
        ),
        (
          'registry.track.create', 1, 'create_registry_track',
          'medium', false, 1, 1, 300, true, true, false
        ),
        (
          'registry.release.create', 1, 'create_registry_release',
          'medium', false, 1, 1, 300, true, true, false
        )
      );

  if v_count <> 3 then
    raise exception
      'STOP: Registry identity creation operation contracts drifted';
  end if;

  if not exists (
       select 1
       from platform_private.system_actors actor
       where actor.actor_key = 'registry_chart_admission'
         and actor.actor_kind = 'automation'
         and actor.status = 'active'
     )
     or not exists (
       select 1
       from platform_private.system_actor_executor_bindings binding
       where binding.actor_key = 'registry_chart_admission'
         and binding.executor_kind = 'database_role'
         and binding.executor_key = 'authenticator'
         and binding.status = 'active'
     )
  then
    raise exception
      'STOP: Registry chart admission transport actor drifted';
  end if;

  if exists (
    select 1
    from public.role_capabilities role_capability
    where role_capability.capability_key in (
      'create_registry_artist',
      'create_registry_track',
      'create_registry_release'
    )
  ) then
    raise exception
      'STOP: Boundary A must not grant identity-creation capability to product roles';
  end if;

  if exists (
    select 1
    from platform_private.system_actor_capability_grants standing_grant
    where standing_grant.capability_key in (
      'create_registry_artist',
      'create_registry_track',
      'create_registry_release'
    )
      and standing_grant.status = 'active'
      and standing_grant.valid_from <= now()
      and standing_grant.expires_at > now()
  ) then
    raise exception
      'STOP: Boundary A must not create standing identity-creation authority';
  end if;

  if exists (
    select 1
    from platform_private.registry_execution_grants execution_grant
    where execution_grant.actor_key = 'registry_chart_admission'
      and execution_grant.operation_key in (
        'registry.artist.create',
        'registry.track.create',
        'registry.release.create'
      )
  ) then
    raise exception
      'STOP: Boundary A identity-creation foundation must remain exact-grant inert';
  end if;

  if exists (
    select 1
    from platform_private.registry_mutation_operations operation
    where operation.actor_key = 'registry_chart_admission'
      and operation.operation_key in (
        'registry.artist.create',
        'registry.track.create',
        'registry.release.create'
      )
  ) then
    raise exception
      'STOP: Boundary A identity-creation foundation must not create mutation operations';
  end if;

  if has_function_privilege(
       'authenticated',
       'platform_private.registry_artist_creation_collision_state_v1(uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.registry_artist_creation_collision_state_v1(uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'platform_private.registry_track_creation_collision_state_v1(uuid,text,uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.registry_track_creation_collision_state_v1(uuid,text,uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'platform_private.registry_release_creation_collision_state_v1(uuid,text,uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.registry_release_creation_collision_state_v1(uuid,text,uuid,text)',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: private identity-collision authority leaked executable privileges';
  end if;
end
$proof$;

commit;
