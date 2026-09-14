-- MIZIZI Registry execution target-set integrity seal.
--
-- The foundation stores target_set_fingerprint on every exact execution grant.
-- This migration makes that binding mechanical: the normalized target rows must
-- hash to the stored fingerprint at transaction commit.

begin;
set local statement_timeout = '180s';
set local lock_timeout = '5s';
select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'mizizi-registry-execution-target-integrity',
    0
  )
);

do $preflight$
begin
  if to_regclass('platform_private.registry_execution_grants') is null
     or to_regclass('platform_private.registry_execution_grant_targets') is null
  then
    raise exception
      'STOP: Registry execution-grant foundation is missing';
  end if;

  if to_regprocedure(
       'platform_private.registry_execution_target_set_fingerprint(uuid)'
     ) is not null
  then
    raise exception
      'STOP: Registry execution target-set integrity already exists';
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

create function platform_private.assert_registry_execution_target_set_fingerprint()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform_private
as $$
declare
  v_execution_grant_id uuid;
  v_expected text;
  v_actual text;
begin
  v_execution_grant_id := coalesce(
    new.execution_grant_id,
    old.execution_grant_id,
    new.id,
    old.id
  );

  if v_execution_grant_id is null then
    raise exception
      'Registry execution target integrity could not resolve a grant ID.';
  end if;

  select execution_grant.target_set_fingerprint
  into v_expected
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.id = v_execution_grant_id;

  if not found then
    -- Deleting a grant is already RESTRICTed by dependent authority rows. If a
    -- row is absent during teardown there is nothing left to validate.
    return null;
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

revoke all on function
  platform_private.registry_execution_target_set_fingerprint(uuid),
  platform_private.assert_registry_execution_target_set_fingerprint()
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
  then
    raise exception
      'Registry execution target fingerprint helper leaked direct authority';
  end if;

  if not exists (
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
      'Registry execution target fingerprint triggers are missing';
  end if;
end
$proof$;

commit;
