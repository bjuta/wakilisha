-- MIZIZI Registry execution integrity seal.
--
-- The foundation stores exact plan and target fingerprints on execution grants.
-- This migration makes those bindings mechanical:
--   * typed operation semantics are immutable within a version;
--   * standing-grant authority fields are immutable after issuance;
--   * exact execution-grant authority fields are immutable after issuance;
--   * normalized target rows must hash to the stored target-set fingerprint;
--   * optional expected canonical subject-state fingerprints are revalidated;
--   * replay of a non-terminal operation cannot bypass a disabled actor,
--     executor binding, standing grant, or operation type.

begin;
set local statement_timeout = '180s';
set local lock_timeout = '5s';
select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'mizizi-registry-execution-integrity',
    0
  )
);

do $preflight$
begin
  if to_regclass('platform_private.system_actor_capability_grants') is null
     or to_regclass('platform_private.registry_operation_types') is null
     or to_regclass('platform_private.registry_execution_grants') is null
     or to_regclass('platform_private.registry_execution_grant_targets') is null
     or to_regclass('platform_private.registry_mutation_operations') is null
  then
    raise exception
      'STOP: Registry governance foundation is missing';
  end if;

  if to_regprocedure(
       'platform_private.registry_execution_target_set_fingerprint(uuid)'
     ) is not null
     or to_regprocedure(
       'platform_private.registry_subject_state_fingerprint(text,uuid)'
     ) is not null
  then
    raise exception
      'STOP: Registry execution integrity seal already exists';
  end if;
end
$preflight$;

create function platform_private.registry_execution_target_set_fingerprint(
  p_execution_grant_id uuid
)
returns text
language sql
stable
security definer
set search_path = pg_catalog, platform_private, extensions
as $$
  select encode(
    extensions.digest(
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'subject_type', target.subject_type,
              'subject_id', target.subject_id::text,
              'expected_state_fingerprint',
                target.expected_state_fingerprint
            )
            order by
              target.subject_type,
              target.subject_id::text
          )
          from platform_private.registry_execution_grant_targets target
          where target.execution_grant_id = p_execution_grant_id
        ),
        '[]'::jsonb
      )::text,
      'sha256'
    ),
    'hex'
  )
$$;

comment on function platform_private.registry_execution_target_set_fingerprint(uuid) is
  'Deterministic SHA-256 over one normalized Registry execution-grant target set, including expected-state fingerprints.';

create function platform_private.registry_subject_state_fingerprint(
  p_subject_type text,
  p_subject_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_state jsonb;
begin
  if p_subject_id is null then
    return null;
  end if;

  case p_subject_type
    when 'artist' then
      select to_jsonb(artist)
      into v_state
      from public.registry_artists artist
      where artist.id = p_subject_id;
    when 'track' then
      select to_jsonb(track)
      into v_state
      from public.registry_tracks track
      where track.id = p_subject_id;
    when 'release' then
      select to_jsonb(release)
      into v_state
      from public.registry_releases release
      where release.id = p_subject_id;
    when 'registry_relationship' then
      select to_jsonb(relationship)
      into v_state
      from public.registry_entity_relationships relationship
      where relationship.id = p_subject_id;
    else
      return null;
  end case;

  if v_state is null then
    return null;
  end if;

  return encode(
    extensions.digest(
      v_state::text,
      'sha256'
    ),
    'hex'
  );
end
$$;

comment on function platform_private.registry_subject_state_fingerprint(text, uuid) is
  'Conservative SHA-256 over the current canonical Registry row for stale-state rejection. Operation-specific aggregate fingerprints may compound this baseline later.';

create function platform_private.guard_registry_operation_type_version_immutability()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
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
       old.requires_verifier
     ) is distinct from row(
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
       new.requires_verifier
     )
  then
    raise exception
      using
        errcode = '23514',
        message = 'Registry operation semantics are immutable within an operation version; create a new version instead.';
  end if;

  return new;
end
$$;

create trigger registry_operation_types_version_immutability_guard
  before update
  on platform_private.registry_operation_types
  for each row
  execute function platform_private.guard_registry_operation_type_version_immutability();

create function platform_private.guard_system_actor_capability_grant_immutability()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if row(
       old.id,
       old.actor_key,
       old.capability_key,
       old.scope,
       old.valid_from,
       old.expires_at,
       old.granted_by_user_id,
       old.grant_reason,
       old.created_at
     ) is distinct from row(
       new.id,
       new.actor_key,
       new.capability_key,
       new.scope,
       new.valid_from,
       new.expires_at,
       new.granted_by_user_id,
       new.grant_reason,
       new.created_at
     )
  then
    raise exception
      using
        errcode = '23514',
        message = 'Issued System Actor capability authority is immutable; revoke it and issue a new grant instead.';
  end if;

  return new;
end
$$;

create trigger system_actor_capability_grants_immutability_guard
  before update
  on platform_private.system_actor_capability_grants
  for each row
  execute function platform_private.guard_system_actor_capability_grant_immutability();

create function platform_private.guard_registry_execution_grant_immutability()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if row(
       old.id,
       old.actor_key,
       old.capability_key,
       old.system_actor_capability_grant_id,
       old.operation_key,
       old.operation_version,
       old.plan_payload,
       old.plan_fingerprint,
       old.target_set_fingerprint,
       old.max_rows,
       old.idempotency_key,
       old.issued_by_user_id,
       old.issued_at,
       old.expires_at,
       old.created_at
     ) is distinct from row(
       new.id,
       new.actor_key,
       new.capability_key,
       new.system_actor_capability_grant_id,
       new.operation_key,
       new.operation_version,
       new.plan_payload,
       new.plan_fingerprint,
       new.target_set_fingerprint,
       new.max_rows,
       new.idempotency_key,
       new.issued_by_user_id,
       new.issued_at,
       new.expires_at,
       new.created_at
     )
  then
    raise exception
      using
        errcode = '23514',
        message = 'Issued Registry execution authority is immutable; revoke it and issue a new exact grant instead.';
  end if;

  return new;
end
$$;

create trigger registry_execution_grants_immutability_guard
  before update
  on platform_private.registry_execution_grants
  for each row
  execute function platform_private.guard_registry_execution_grant_immutability();

create function platform_private.assert_registry_execution_target_set_fingerprint()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform_private
as $$
declare
  v_execution_grant_ids uuid[];
  v_execution_grant_id uuid;
  v_checked uuid[] := array[]::uuid[];
  v_expected text;
  v_actual text;
begin
  if tg_table_name = 'registry_execution_grants' then
    v_execution_grant_ids := array[new.id];
  elsif tg_table_name = 'registry_execution_grant_targets' then
    v_execution_grant_ids := array[
      case
        when tg_op <> 'DELETE' then new.execution_grant_id
        else null
      end,
      case
        when tg_op <> 'INSERT' then old.execution_grant_id
        else null
      end
    ];
  else
    raise exception
      'Registry execution target integrity fired for unexpected table %.',
      tg_table_name;
  end if;

  foreach v_execution_grant_id in array v_execution_grant_ids
  loop
    if v_execution_grant_id is null
       or v_execution_grant_id = any(v_checked)
    then
      continue;
    end if;

    v_checked := array_append(
      v_checked,
      v_execution_grant_id
    );

    select execution_grant.target_set_fingerprint
    into v_expected
    from platform_private.registry_execution_grants execution_grant
    where execution_grant.id = v_execution_grant_id;

    if not found then
      continue;
    end if;

    v_actual :=
      platform_private.registry_execution_target_set_fingerprint(
        v_execution_grant_id
      );

    if v_actual <> v_expected then
      raise exception
        using
          errcode = '23514',
          message = 'Registry execution target set does not match its exact grant fingerprint.';
    end if;
  end loop;

  return null;
end
$$;

create constraint trigger registry_execution_grants_target_fingerprint_guard
  after insert or update of target_set_fingerprint
  on platform_private.registry_execution_grants
  deferrable initially deferred
  for each row
  execute function platform_private.assert_registry_execution_target_set_fingerprint();

create constraint trigger registry_execution_grant_targets_fingerprint_guard
  after insert or update or delete
  on platform_private.registry_execution_grant_targets
  deferrable initially deferred
  for each row
  execute function platform_private.assert_registry_execution_target_set_fingerprint();

create or replace function platform_private.begin_registry_mutation_operation(
  p_actor_key text,
  p_execution_grant_id uuid
)
returns table (
  operation_id uuid,
  operation_status text,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private
as $$
declare
  v_existing platform_private.registry_mutation_operations%rowtype;
  v_grant platform_private.registry_execution_grants%rowtype;
  v_operation_type platform_private.registry_operation_types%rowtype;
  v_operation_id uuid;
begin
  if p_actor_key is null
     or p_actor_key !~ '^[a-z][a-z0-9_.:-]{1,99}$'
     or p_execution_grant_id is null
  then
    raise exception
      using errcode = '22023',
            message = 'A valid System Actor and execution grant are required.';
  end if;

  if not exists (
    select 1
    from platform_private.system_actors actor
    where actor.actor_key = p_actor_key
      and actor.status = 'active'
  ) then
    raise exception
      using errcode = '42501',
            message = 'The System Actor is not active.';
  end if;

  if not exists (
    select 1
    from platform_private.system_actor_executor_bindings binding
    where binding.actor_key = p_actor_key
      and binding.executor_kind = 'database_role'
      and binding.executor_key = session_user
      and binding.status = 'active'
  ) then
    raise exception
      using errcode = '42501',
            message = 'The current executor is not bound to this System Actor.';
  end if;

  select operation.*
  into v_existing
  from platform_private.registry_mutation_operations operation
  where operation.execution_grant_id = p_execution_grant_id;

  if found then
    if v_existing.actor_key <> p_actor_key then
      raise exception
        using errcode = '42501',
              message = 'The execution grant belongs to another System Actor.';
    end if;

    if v_existing.status in (
      'authorized',
      'executing',
      'compensating'
    )
       and not exists (
         select 1
         from platform_private.registry_execution_grants execution_grant
         join platform_private.system_actor_capability_grants standing_grant
           on standing_grant.id = execution_grant.system_actor_capability_grant_id
          and standing_grant.actor_key = execution_grant.actor_key
          and standing_grant.capability_key = execution_grant.capability_key
         join platform_private.registry_operation_types operation_type
           on operation_type.operation_key = execution_grant.operation_key
          and operation_type.operation_version = execution_grant.operation_version
          and operation_type.capability_key = execution_grant.capability_key
         where execution_grant.id = p_execution_grant_id
           and execution_grant.actor_key = p_actor_key
           and standing_grant.status = 'active'
           and standing_grant.valid_from <= now()
           and standing_grant.expires_at > now()
           and operation_type.enabled
       )
    then
      raise exception
        using errcode = '42501',
              message = 'The existing Registry operation can no longer be resumed under current authority.';
    end if;

    operation_id := v_existing.id;
    operation_status := v_existing.status;
    idempotent_replay := true;
    return next;
    return;
  end if;

  select execution_grant.*
  into v_grant
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.id = p_execution_grant_id
  for update;

  if not found or v_grant.actor_key <> p_actor_key then
    raise exception
      using errcode = 'P0002',
            message = 'The Registry execution grant does not exist for this System Actor.';
  end if;

  if v_grant.status <> 'active' then
    raise exception
      using errcode = '42501',
            message = 'The Registry execution grant is not active.';
  end if;

  if v_grant.expires_at <= now() then
    raise exception
      using errcode = '42501',
            message = 'The Registry execution grant has expired.';
  end if;

  if not exists (
    select 1
    from platform_private.system_actor_capability_grants standing_grant
    where standing_grant.id = v_grant.system_actor_capability_grant_id
      and standing_grant.actor_key = v_grant.actor_key
      and standing_grant.capability_key = v_grant.capability_key
      and standing_grant.status = 'active'
      and standing_grant.valid_from <= now()
      and standing_grant.expires_at > now()
  ) then
    raise exception
      using errcode = '42501',
            message = 'The underlying System Actor capability grant is not active.';
  end if;

  select operation_type.*
  into v_operation_type
  from platform_private.registry_operation_types operation_type
  where operation_type.operation_key = v_grant.operation_key
    and operation_type.operation_version = v_grant.operation_version
    and operation_type.capability_key = v_grant.capability_key
    and operation_type.enabled;

  if not found then
    raise exception
      using errcode = '42501',
            message = 'The typed Registry operation is disabled or missing.';
  end if;

  if v_grant.max_rows > v_operation_type.max_rows_ceiling then
    raise exception
      using errcode = '42501',
            message = 'The execution grant exceeds the operation row budget.';
  end if;

  if v_grant.expires_at >
     v_grant.issued_at
       + make_interval(secs => v_operation_type.max_grant_ttl_seconds)
  then
    raise exception
      using errcode = '42501',
            message = 'The execution grant exceeds the operation TTL ceiling.';
  end if;

  if (
    select count(*)
    from platform_private.registry_execution_grant_targets target
    where target.execution_grant_id = v_grant.id
  ) not between 1 and v_operation_type.max_targets
  then
    raise exception
      using errcode = '42501',
            message = 'The execution grant target set violates the operation target budget.';
  end if;

  if exists (
    select 1
    from platform_private.registry_execution_grant_targets target
    where target.execution_grant_id = v_grant.id
      and not (
        target.subject_type = any(v_operation_type.allowed_subject_types)
      )
  ) then
    raise exception
      using errcode = '42501',
            message = 'The execution grant contains a forbidden Registry subject type.';
  end if;

  if platform_private.registry_execution_target_set_fingerprint(v_grant.id)
     <> v_grant.target_set_fingerprint
  then
    raise exception
      using errcode = '42501',
            message = 'The Registry execution target set no longer matches the exact grant.';
  end if;

  if v_operation_type.requires_existing_target
     and exists (
       select 1
       from platform_private.registry_execution_grant_targets target
       where target.execution_grant_id = v_grant.id
         and not platform_private.registry_subject_exists(
           target.subject_type,
           target.subject_id
         )
     )
  then
    raise exception
      using errcode = '42501',
            message = 'The execution grant contains a Registry target that no longer exists.';
  end if;

  if exists (
    select 1
    from platform_private.registry_execution_grant_targets target
    where target.execution_grant_id = v_grant.id
      and target.expected_state_fingerprint is not null
      and target.expected_state_fingerprint
        is distinct from
          platform_private.registry_subject_state_fingerprint(
            target.subject_type,
            target.subject_id
          )
  ) then
    raise exception
      using errcode = '42501',
            message = 'A Registry target changed after the execution grant was issued.';
  end if;

  if platform_private.registry_plan_fingerprint(v_grant.plan_payload)
     <> v_grant.plan_fingerprint
  then
    raise exception
      using errcode = '42501',
            message = 'The execution grant plan fingerprint does not match its bound plan.';
  end if;

  insert into platform_private.registry_mutation_operations (
    execution_grant_id,
    actor_key,
    capability_key,
    operation_key,
    operation_version,
    principal_key,
    plan_fingerprint,
    target_set_fingerprint,
    max_rows,
    status,
    verifier_status
  )
  values (
    v_grant.id,
    v_grant.actor_key,
    v_grant.capability_key,
    v_grant.operation_key,
    v_grant.operation_version,
    'system:' || v_grant.actor_key,
    v_grant.plan_fingerprint,
    v_grant.target_set_fingerprint,
    v_grant.max_rows,
    'authorized',
    case
      when v_operation_type.requires_verifier then 'pending'
      else 'not_required'
    end
  )
  returning id into v_operation_id;

  update platform_private.registry_execution_grants
  set status = 'consumed',
      consumed_at = now(),
      updated_at = now()
  where id = v_grant.id;

  operation_id := v_operation_id;
  operation_status := 'authorized';
  idempotent_replay := false;
  return next;
end
$$;

revoke all on function
  platform_private.registry_execution_target_set_fingerprint(uuid),
  platform_private.registry_subject_state_fingerprint(text, uuid),
  platform_private.guard_registry_operation_type_version_immutability(),
  platform_private.guard_system_actor_capability_grant_immutability(),
  platform_private.guard_registry_execution_grant_immutability(),
  platform_private.assert_registry_execution_target_set_fingerprint()
from public, anon, authenticated, service_role;

revoke all on function
  platform_private.begin_registry_mutation_operation(text, uuid)
from public, anon, authenticated, service_role;

do $proof$
begin
  if has_function_privilege(
       'anon',
       'platform_private.registry_execution_target_set_fingerprint(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'platform_private.registry_execution_target_set_fingerprint(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.registry_execution_target_set_fingerprint(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'platform_private.registry_subject_state_fingerprint(text,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'platform_private.registry_subject_state_fingerprint(text,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.registry_subject_state_fingerprint(text,uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'Registry execution integrity helpers leaked direct authority';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    join pg_class relation
      on relation.oid = trigger_row.tgrelid
    join pg_namespace namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'platform_private'
      and relation.relname = 'registry_operation_types'
      and trigger_row.tgname =
        'registry_operation_types_version_immutability_guard'
      and not trigger_row.tgisinternal
  )
     or not exists (
       select 1
       from pg_trigger trigger_row
       join pg_class relation
         on relation.oid = trigger_row.tgrelid
       join pg_namespace namespace
         on namespace.oid = relation.relnamespace
       where namespace.nspname = 'platform_private'
         and relation.relname = 'system_actor_capability_grants'
         and trigger_row.tgname =
           'system_actor_capability_grants_immutability_guard'
         and not trigger_row.tgisinternal
     )
     or not exists (
       select 1
       from pg_trigger trigger_row
       join pg_class relation
         on relation.oid = trigger_row.tgrelid
       join pg_namespace namespace
         on namespace.oid = relation.relnamespace
       where namespace.nspname = 'platform_private'
         and relation.relname = 'registry_execution_grants'
         and trigger_row.tgname =
           'registry_execution_grants_immutability_guard'
         and not trigger_row.tgisinternal
     )
     or not exists (
       select 1
       from pg_trigger trigger_row
       join pg_class relation
         on relation.oid = trigger_row.tgrelid
       join pg_namespace namespace
         on namespace.oid = relation.relnamespace
       where namespace.nspname = 'platform_private'
         and relation.relname = 'registry_execution_grants'
         and trigger_row.tgname =
           'registry_execution_grants_target_fingerprint_guard'
         and not trigger_row.tgisinternal
     )
     or not exists (
       select 1
       from pg_trigger trigger_row
       join pg_class relation
         on relation.oid = trigger_row.tgrelid
       join pg_namespace namespace
         on namespace.oid = relation.relnamespace
       where namespace.nspname = 'platform_private'
         and relation.relname = 'registry_execution_grant_targets'
         and trigger_row.tgname =
           'registry_execution_grant_targets_fingerprint_guard'
         and not trigger_row.tgisinternal
     )
  then
    raise exception
      'Registry execution integrity triggers are incomplete';
  end if;
end
$proof$;

commit;
