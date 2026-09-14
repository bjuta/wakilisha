-- MIZIZI Registry Governance Primitive Foundation
--
-- Slice 2 foundation only. This migration adds reusable authority structures but
-- does not grant MIZIZI Registry capability, register an executable Registry
-- operation, change an existing writer, retire an endpoint, or mutate canonical
-- Registry data.
--
-- Existing authority is compounded rather than replaced:
--   * public.capability_definitions remains the canonical capability vocabulary;
--   * platform_private.system_actors remains non-human principal identity;
--   * platform_private.command_receipts remains the accepted Resource command
--     receipt contract and is not weakened or made polymorphic;
--   * public.registry_canonical_write_events remains canonical per-write evidence.

begin;
set local statement_timeout = '180s';
set local lock_timeout = '5s';
select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'mizizi-registry-governance-primitive-foundation',
    0
  )
);

do $preflight$
begin
  if to_regclass('public.capability_definitions') is null
     or to_regclass('platform_private.system_actors') is null
     or to_regclass('platform_private.system_actor_executor_bindings') is null
     or to_regclass('platform_private.command_receipts') is null
     or to_regclass('public.registry_canonical_write_events') is null
     or to_regclass('public.registry_artists') is null
     or to_regclass('public.registry_tracks') is null
     or to_regclass('public.registry_releases') is null
     or to_regclass('public.registry_entity_relationships') is null
  then
    raise exception
      'STOP: accepted Registry/System Actor/capability/receipt authority is missing';
  end if;

  if to_regclass('platform_private.system_actor_capability_grants') is not null
     or to_regclass('platform_private.registry_operation_types') is not null
     or to_regclass('platform_private.registry_execution_grants') is not null
     or to_regclass('platform_private.registry_execution_grant_targets') is not null
     or to_regclass('platform_private.registry_mutation_operations') is not null
     or to_regclass('platform_private.registry_operation_write_events') is not null
  then
    raise exception
      'STOP: MIZIZI Registry governance primitive foundation already exists';
  end if;
end
$preflight$;

create table platform_private.system_actor_capability_grants (
  id uuid primary key default gen_random_uuid(),
  actor_key text not null,
  capability_key text not null,
  scope jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  valid_from timestamptz not null default now(),
  expires_at timestamptz not null,
  granted_by_user_id uuid not null,
  grant_reason text not null,
  revoked_at timestamptz,
  revoked_by_user_id uuid,
  revoke_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint system_actor_capability_grants_actor_fkey
    foreign key (actor_key)
    references platform_private.system_actors(actor_key)
    on update restrict on delete restrict,
  constraint system_actor_capability_grants_capability_fkey
    foreign key (capability_key)
    references public.capability_definitions(capability_key)
    on update restrict on delete restrict,
  constraint system_actor_capability_grants_granted_by_fkey
    foreign key (granted_by_user_id)
    references auth.users(id)
    on update restrict on delete restrict,
  constraint system_actor_capability_grants_revoked_by_fkey
    foreign key (revoked_by_user_id)
    references auth.users(id)
    on update restrict on delete restrict,
  constraint system_actor_capability_grants_scope_check
    check (
      jsonb_typeof(scope) = 'object'
      and octet_length(scope::text) <= 8192
    ),
  constraint system_actor_capability_grants_status_check
    check (status in ('active', 'revoked', 'expired')),
  constraint system_actor_capability_grants_time_check
    check (expires_at > valid_from),
  constraint system_actor_capability_grants_reason_check
    check (
      btrim(grant_reason) <> ''
      and octet_length(grant_reason) <= 1000
    ),
  constraint system_actor_capability_grants_revoke_state_check
    check (
      (
        status = 'active'
        and revoked_at is null
        and revoked_by_user_id is null
        and revoke_reason is null
      )
      or (
        status = 'expired'
        and revoked_at is null
        and revoked_by_user_id is null
      )
      or (
        status = 'revoked'
        and revoked_at is not null
        and revoked_by_user_id is not null
        and nullif(btrim(revoke_reason), '') is not null
        and octet_length(revoke_reason) <= 1000
      )
    ),
  constraint system_actor_capability_grants_identity_key
    unique (id, actor_key, capability_key)
);

create index system_actor_capability_grants_active_lookup_idx
  on platform_private.system_actor_capability_grants (
    actor_key,
    capability_key,
    expires_at
  )
  where status = 'active';

comment on table platform_private.system_actor_capability_grants is
  'Time-bounded non-human capability grants. Capability names reuse public.capability_definitions; this table does not create a second capability vocabulary.';

create table platform_private.registry_operation_types (
  operation_key text not null,
  operation_version integer not null,
  capability_key text not null,
  risk_class text not null,
  allowed_subject_types text[] not null,
  requires_existing_target boolean not null default true,
  max_targets integer not null,
  max_rows_ceiling integer not null,
  max_grant_ttl_seconds integer not null,
  requires_human_approval boolean not null default true,
  requires_verifier boolean not null default true,
  enabled boolean not null default false,
  description text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (operation_key, operation_version),
  constraint registry_operation_types_capability_fkey
    foreign key (capability_key)
    references public.capability_definitions(capability_key)
    on update restrict on delete restrict,
  constraint registry_operation_types_key_check
    check (
      operation_key ~ '^registry[.][a-z][a-z0-9_.:-]{2,119}$'
    ),
  constraint registry_operation_types_version_check
    check (operation_version > 0),
  constraint registry_operation_types_risk_check
    check (risk_class in ('low', 'medium', 'high', 'critical')),
  constraint registry_operation_types_subjects_check
    check (
      cardinality(allowed_subject_types) between 1 and 8
      and array_position(allowed_subject_types, null) is null
      and allowed_subject_types <@ array[
        'artist',
        'track',
        'release',
        'registry_relationship'
      ]::text[]
    ),
  constraint registry_operation_types_limits_check
    check (
      max_targets between 1 and 1000
      and max_rows_ceiling between 1 and 10000
      and max_grant_ttl_seconds between 60 and 86400
    ),
  constraint registry_operation_types_description_check
    check (
      btrim(description) <> ''
      and octet_length(description) <= 2000
    ),
  constraint registry_operation_types_capability_key
    unique (operation_key, operation_version, capability_key)
);

comment on table platform_private.registry_operation_types is
  'Deployment-owned typed Registry operation catalogue. Rows are added only when a real converging writer proves the operation contract; this foundation intentionally seeds none.';

create table platform_private.registry_execution_grants (
  id uuid primary key default gen_random_uuid(),
  actor_key text not null,
  capability_key text not null,
  system_actor_capability_grant_id uuid not null,
  operation_key text not null,
  operation_version integer not null,
  plan_payload jsonb not null,
  plan_fingerprint text not null,
  target_set_fingerprint text not null,
  max_rows integer not null,
  idempotency_key text not null,
  status text not null default 'active',
  issued_by_user_id uuid not null,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  revoked_at timestamptz,
  revoked_by_user_id uuid,
  revoke_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint registry_execution_grants_actor_capability_fkey
    foreign key (
      system_actor_capability_grant_id,
      actor_key,
      capability_key
    )
    references platform_private.system_actor_capability_grants(
      id,
      actor_key,
      capability_key
    )
    on update restrict on delete restrict,
  constraint registry_execution_grants_operation_fkey
    foreign key (
      operation_key,
      operation_version,
      capability_key
    )
    references platform_private.registry_operation_types(
      operation_key,
      operation_version,
      capability_key
    )
    on update restrict on delete restrict,
  constraint registry_execution_grants_issued_by_fkey
    foreign key (issued_by_user_id)
    references auth.users(id)
    on update restrict on delete restrict,
  constraint registry_execution_grants_revoked_by_fkey
    foreign key (revoked_by_user_id)
    references auth.users(id)
    on update restrict on delete restrict,
  constraint registry_execution_grants_plan_check
    check (
      jsonb_typeof(plan_payload) = 'object'
      and octet_length(plan_payload::text) <= 32768
    ),
  constraint registry_execution_grants_plan_fingerprint_check
    check (plan_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint registry_execution_grants_target_fingerprint_check
    check (target_set_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint registry_execution_grants_max_rows_check
    check (max_rows between 1 and 10000),
  constraint registry_execution_grants_idempotency_check
    check (
      idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
    ),
  constraint registry_execution_grants_status_check
    check (status in ('active', 'consumed', 'revoked', 'expired')),
  constraint registry_execution_grants_time_check
    check (expires_at > issued_at),
  constraint registry_execution_grants_terminal_state_check
    check (
      (
        status = 'active'
        and consumed_at is null
        and revoked_at is null
        and revoked_by_user_id is null
        and revoke_reason is null
      )
      or (
        status = 'consumed'
        and consumed_at is not null
        and revoked_at is null
        and revoked_by_user_id is null
      )
      or (
        status = 'expired'
        and consumed_at is null
        and revoked_at is null
        and revoked_by_user_id is null
      )
      or (
        status = 'revoked'
        and consumed_at is null
        and revoked_at is not null
        and revoked_by_user_id is not null
        and nullif(btrim(revoke_reason), '') is not null
        and octet_length(revoke_reason) <= 1000
      )
    ),
  constraint registry_execution_grants_idempotency_key
    unique (
      actor_key,
      operation_key,
      operation_version,
      idempotency_key
    ),
  constraint registry_execution_grants_identity_key
    unique (
      id,
      actor_key,
      capability_key,
      operation_key,
      operation_version
    )
);

create index registry_execution_grants_active_lookup_idx
  on platform_private.registry_execution_grants (
    actor_key,
    operation_key,
    operation_version,
    expires_at
  )
  where status = 'active';

comment on table platform_private.registry_execution_grants is
  'One-shot exact Registry execution grants binding System Actor capability, typed operation version, immutable plan fingerprint, target-set fingerprint, blast-radius ceiling, expiry, issuer, and idempotency.';

create table platform_private.registry_execution_grant_targets (
  execution_grant_id uuid not null,
  subject_type text not null,
  subject_id uuid not null,
  expected_state_fingerprint text,
  created_at timestamptz not null default now(),
  primary key (execution_grant_id, subject_type, subject_id),
  constraint registry_execution_grant_targets_grant_fkey
    foreign key (execution_grant_id)
    references platform_private.registry_execution_grants(id)
    on update restrict on delete restrict,
  constraint registry_execution_grant_targets_subject_type_check
    check (
      subject_type in (
        'artist',
        'track',
        'release',
        'registry_relationship'
      )
    ),
  constraint registry_execution_grant_targets_state_fingerprint_check
    check (
      expected_state_fingerprint is null
      or expected_state_fingerprint ~ '^[0-9a-f]{64}$'
    )
);

create index registry_execution_grant_targets_subject_idx
  on platform_private.registry_execution_grant_targets (
    subject_type,
    subject_id
  );

comment on table platform_private.registry_execution_grant_targets is
  'Exact typed target set for one Registry execution grant. It is a pointer contract, not a universal cultural-entity table.';

create table platform_private.registry_mutation_operations (
  id uuid primary key default gen_random_uuid(),
  execution_grant_id uuid not null,
  actor_key text not null,
  capability_key text not null,
  operation_key text not null,
  operation_version integer not null,
  principal_key text not null,
  plan_fingerprint text not null,
  target_set_fingerprint text not null,
  max_rows integer not null,
  affected_rows integer not null default 0,
  status text not null default 'authorized',
  verifier_status text not null default 'pending',
  command_receipt_id uuid,
  result_payload jsonb not null default '{}'::jsonb,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint registry_mutation_operations_grant_fkey
    foreign key (
      execution_grant_id,
      actor_key,
      capability_key,
      operation_key,
      operation_version
    )
    references platform_private.registry_execution_grants(
      id,
      actor_key,
      capability_key,
      operation_key,
      operation_version
    )
    on update restrict on delete restrict,
  constraint registry_mutation_operations_receipt_fkey
    foreign key (command_receipt_id)
    references platform_private.command_receipts(id)
    on update restrict on delete restrict,
  constraint registry_mutation_operations_principal_check
    check (principal_key = 'system:' || actor_key),
  constraint registry_mutation_operations_plan_fingerprint_check
    check (plan_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint registry_mutation_operations_target_fingerprint_check
    check (target_set_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint registry_mutation_operations_row_budget_check
    check (
      max_rows between 1 and 10000
      and affected_rows between 0 and max_rows
    ),
  constraint registry_mutation_operations_status_check
    check (
      status in (
        'authorized',
        'executing',
        'succeeded',
        'failed',
        'rejected',
        'compensating',
        'compensated'
      )
    ),
  constraint registry_mutation_operations_verifier_check
    check (
      verifier_status in (
        'pending',
        'passed',
        'failed',
        'not_required'
      )
    ),
  constraint registry_mutation_operations_payload_check
    check (
      jsonb_typeof(result_payload) = 'object'
      and octet_length(result_payload::text) <= 32768
    ),
  constraint registry_mutation_operations_execution_grant_key
    unique (execution_grant_id)
);

create index registry_mutation_operations_actor_status_idx
  on platform_private.registry_mutation_operations (
    actor_key,
    status,
    created_at desc
  );

comment on table platform_private.registry_mutation_operations is
  'Registry-domain operation journal. It binds an exact one-shot execution grant to execution/verification state without pretending Registry UUIDs are editorial.resources.';

create table platform_private.registry_operation_write_events (
  operation_id uuid not null,
  canonical_write_event_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (operation_id, canonical_write_event_id),
  constraint registry_operation_write_events_operation_fkey
    foreign key (operation_id)
    references platform_private.registry_mutation_operations(id)
    on update restrict on delete restrict,
  constraint registry_operation_write_events_event_fkey
    foreign key (canonical_write_event_id)
    references public.registry_canonical_write_events(id)
    on update restrict on delete restrict
);

create index registry_operation_write_events_event_idx
  on platform_private.registry_operation_write_events(
    canonical_write_event_id
  );

comment on table platform_private.registry_operation_write_events is
  'Causality link from a Registry Mutation Operation to existing per-write canonical evidence. Existing registry_canonical_write_events remains authoritative write evidence.';

revoke all on table
  platform_private.system_actor_capability_grants,
  platform_private.registry_operation_types,
  platform_private.registry_execution_grants,
  platform_private.registry_execution_grant_targets,
  platform_private.registry_mutation_operations,
  platform_private.registry_operation_write_events
from public, anon, authenticated, service_role;

create function platform_private.registry_plan_fingerprint(
  p_plan_payload jsonb
)
returns text
language sql
immutable
security definer
set search_path = pg_catalog, extensions
as $$
  select encode(
    extensions.digest(
      coalesce(p_plan_payload, 'null'::jsonb)::text,
      'sha256'
    ),
    'hex'
  )
$$;

comment on function platform_private.registry_plan_fingerprint(jsonb) is
  'Deterministic SHA-256 fingerprint over normalized jsonb text for Registry plan binding.';

create function platform_private.registry_subject_exists(
  p_subject_type text,
  p_subject_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_subject_id is null then
    return false;
  end if;

  return case p_subject_type
    when 'artist' then
      exists (
        select 1
        from public.registry_artists artist
        where artist.id = p_subject_id
      )
    when 'track' then
      exists (
        select 1
        from public.registry_tracks track
        where track.id = p_subject_id
      )
    when 'release' then
      exists (
        select 1
        from public.registry_releases release
        where release.id = p_subject_id
      )
    when 'registry_relationship' then
      exists (
        select 1
        from public.registry_entity_relationships relationship
        where relationship.id = p_subject_id
      )
    else false
  end;
end
$$;

comment on function platform_private.registry_subject_exists(text, uuid) is
  'Typed existence resolver for Registry operation targets. It does not create a universal entity authority.';

create function platform_private.begin_registry_mutation_operation(
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

    operation_id := v_existing.id;
    operation_status := v_existing.status;
    idempotent_replay := true;
    return next;
    return;
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
    update platform_private.registry_execution_grants
    set status = 'expired',
        updated_at = now()
    where id = v_grant.id;

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

comment on function platform_private.begin_registry_mutation_operation(text, uuid) is
  'Consumes one exact Registry execution grant into one journaled Registry operation. No canonical write is performed by this function.';

revoke all on function
  platform_private.registry_plan_fingerprint(jsonb),
  platform_private.registry_subject_exists(text, uuid),
  platform_private.begin_registry_mutation_operation(text, uuid)
from public, anon, authenticated, service_role;

-- Foundation safety proof: adding the schema must not activate autonomous
-- Registry authority or change the existing System Actor executor binding.
do $foundation_proof$
declare
  v_binding_count integer;
begin
  if exists (
    select 1
    from platform_private.system_actor_capability_grants
  ) then
    raise exception
      'MIZIZI governance foundation must not seed System Actor capability grants';
  end if;

  if exists (
    select 1
    from platform_private.registry_operation_types
  ) then
    raise exception
      'MIZIZI governance foundation must not seed executable Registry operation types';
  end if;

  if exists (
    select 1
    from platform_private.registry_execution_grants
  )
     or exists (
       select 1
       from platform_private.registry_mutation_operations
     )
  then
    raise exception
      'MIZIZI governance foundation must not seed execution authority or operations';
  end if;

  select count(*)::integer
  into v_binding_count
  from platform_private.system_actor_executor_bindings binding
  where binding.actor_key = 'mizizi'
    and binding.executor_kind = 'database_role'
    and binding.executor_key = 'postgres'
    and binding.status = 'active';

  if v_binding_count <> 1 then
    raise exception
      'Existing MIZIZI executor binding drifted while installing the inert foundation';
  end if;

  if has_table_privilege(
       'anon',
       'platform_private.registry_execution_grants',
       'SELECT'
     )
     or has_table_privilege(
       'authenticated',
       'platform_private.registry_execution_grants',
       'SELECT'
     )
     or has_table_privilege(
       'service_role',
       'platform_private.registry_execution_grants',
       'SELECT'
     )
     or has_table_privilege(
       'anon',
       'platform_private.registry_mutation_operations',
       'INSERT'
     )
     or has_table_privilege(
       'authenticated',
       'platform_private.registry_mutation_operations',
       'INSERT'
     )
     or has_table_privilege(
       'service_role',
       'platform_private.registry_mutation_operations',
       'INSERT'
     )
  then
    raise exception
      'MIZIZI governance private tables leaked direct browser/service-role authority';
  end if;

  if has_function_privilege(
       'anon',
       'platform_private.begin_registry_mutation_operation(text,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'platform_private.begin_registry_mutation_operation(text,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.begin_registry_mutation_operation(text,uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'MIZIZI governance operation broker leaked direct execution authority';
  end if;
end
$foundation_proof$;

commit;
