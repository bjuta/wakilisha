-- MIZIZI Slice 2 Artist Origin Admin Backfill Convergence
-- Human admin authorizes exact grants; a narrow automation actor executes.
-- No MIZIZI standing authority is created by this migration.

begin;
set local statement_timeout = '180s';
set local lock_timeout = '5s';
select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'mizizi-registry-artist-origin-admin-backfill-convergence', 0
  )
);

do $preflight$
begin
  if to_regclass('platform_private.registry_evidence_assertions') is null
     or to_regclass('platform_private.registry_execution_grants') is null
     or to_regclass('platform_private.registry_mutation_operations') is null
     or to_regclass('platform_private.system_actors') is null
     or to_regclass('platform_private.system_actor_executor_bindings') is null
     or to_regprocedure('platform_private.execute_registry_artist_origin_admission(text,uuid)') is null
     or to_regprocedure('platform_private.verify_registry_artist_origin_admission(uuid)') is null
     or to_regprocedure('platform_private.begin_registry_mutation_operation(text,uuid)') is null
     or to_regprocedure('public.current_user_has_capability(text)') is null
  then
    raise exception 'STOP: accepted Artist-origin governance authority is missing';
  end if;

  if exists (
       select 1 from platform_private.system_actors
       where actor_key = 'registry_artist_origin_admin'
     )
     or exists (
       select 1 from information_schema.columns
       where table_schema = 'platform_private'
         and table_name = 'registry_execution_grants'
         and column_name = 'required_user_capability_key'
     )
     or to_regprocedure('platform_private.record_registry_artist_origin_user_evidence(uuid,text,numeric,text,text,text,timestamp with time zone)') is not null
     or to_regprocedure('platform_private.issue_registry_artist_origin_user_execution_grant(uuid)') is not null
     or to_regprocedure('public.admin_execute_registry_artist_origin_admission(uuid,text,numeric,text,text,text,timestamp with time zone)') is not null
     or to_regprocedure('public.admin_verify_registry_artist_origin_admission(uuid)') is not null
  then
    raise exception 'STOP: Artist-origin admin convergence authority already exists';
  end if;

  if not exists (
    select 1 from pg_roles
    where rolname = 'authenticator'
      and rolcanlogin
      and not rolsuper
  ) then
    raise exception 'STOP: expected PostgREST authenticator role is missing';
  end if;

  if exists (select 1 from platform_private.registry_execution_grants)
     or exists (select 1 from platform_private.registry_mutation_operations)
  then
    raise exception 'STOP: exact-grant/journal history appeared after #935 closure; audit before converging grant authority';
  end if;

  if exists (
    select 1
    from platform_private.system_actor_capability_grants
    where actor_key = 'mizizi'
      and capability_key = 'admit_registry_artist_origin'
      and status = 'active'
      and valid_from <= now()
      and expires_at > now()
  ) then
    raise exception 'STOP: MIZIZI Artist-origin standing authority must remain inactive during admin convergence';
  end if;
end
$preflight$;

alter table platform_private.registry_evidence_assertions
  drop constraint registry_evidence_assertions_recorder_check;

alter table platform_private.registry_evidence_assertions
  add constraint registry_evidence_assertions_recorder_check
    check (
      recorded_by_principal_key ~
        '^((system|policy):[a-z][a-z0-9_.:-]{1,119}|user:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$'
    );

alter table platform_private.registry_execution_grants
  alter column system_actor_capability_grant_id drop not null,
  add column required_user_capability_key text;

alter table platform_private.registry_execution_grants
  drop constraint registry_execution_grants_issuer_consistency_check;

alter table platform_private.registry_execution_grants
  add constraint registry_execution_grants_actor_fkey
    foreign key (actor_key)
    references platform_private.system_actors(actor_key)
    on update restrict on delete restrict,
  add constraint registry_execution_grants_required_user_capability_fkey
    foreign key (required_user_capability_key)
    references public.capability_definitions(capability_key)
    on update restrict on delete restrict,
  add constraint registry_execution_grants_issuer_consistency_check
    check (
      (
        issued_by_user_id is not null
        and issued_by_principal_key = 'user:' || issued_by_user_id::text
        and system_actor_capability_grant_id is null
        and required_user_capability_key is not null
      )
      or (
        issued_by_user_id is null
        and issued_by_principal_key like 'policy:%'
        and system_actor_capability_grant_id is not null
        and required_user_capability_key is null
      )
    );

create or replace function platform_private.guard_registry_execution_grant_immutability()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if row(
       old.id, old.actor_key, old.capability_key,
       old.system_actor_capability_grant_id,
       old.operation_key, old.operation_version,
       old.plan_payload, old.plan_fingerprint,
       old.target_set_fingerprint, old.max_rows,
       old.idempotency_key, old.issued_by_user_id,
       old.issued_by_principal_key, old.policy_ruleset_version,
       old.required_user_capability_key,
       old.issued_at, old.expires_at, old.created_at
     ) is distinct from row(
       new.id, new.actor_key, new.capability_key,
       new.system_actor_capability_grant_id,
       new.operation_key, new.operation_version,
       new.plan_payload, new.plan_fingerprint,
       new.target_set_fingerprint, new.max_rows,
       new.idempotency_key, new.issued_by_user_id,
       new.issued_by_principal_key, new.policy_ruleset_version,
       new.required_user_capability_key,
       new.issued_at, new.expires_at, new.created_at
     )
  then
    raise exception using errcode = '23514',
      message = 'Issued Registry execution authority is immutable; revoke it and issue a new exact grant instead.';
  end if;
  return new;
end
$$;

insert into platform_private.system_actors (
  actor_key, label, actor_kind, status, capability_profile
)
values (
  'registry_artist_origin_admin',
  'Registry Artist Origin Admin Broker',
  'automation',
  'active',
  jsonb_build_object(
    'domain', 'registry',
    'operation_key', 'registry.artist_origin.admit',
    'operation_version', 1,
    'authority_mode', 'human_exact_grant',
    'required_user_capability', 'manage_registry'
  )
);

insert into platform_private.system_actor_executor_bindings (
  actor_key, executor_kind, executor_key, status
)
values (
  'registry_artist_origin_admin',
  'database_role',
  'authenticator',
  'active'
);

create function platform_private.registry_execution_grant_has_current_authority(
  p_execution_grant_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
declare
  v_grant platform_private.registry_execution_grants%rowtype;
begin
  select execution_grant.* into v_grant
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.id = p_execution_grant_id;

  if not found then return false; end if;

  if not exists (
       select 1 from platform_private.system_actors actor
       where actor.actor_key = v_grant.actor_key
         and actor.status = 'active'
     )
     or not exists (
       select 1 from platform_private.system_actor_executor_bindings binding
       where binding.actor_key = v_grant.actor_key
         and binding.executor_kind = 'database_role'
         and binding.executor_key = session_user
         and binding.status = 'active'
     )
     or not exists (
       select 1 from platform_private.registry_operation_types operation_type
       where operation_type.operation_key = v_grant.operation_key
         and operation_type.operation_version = v_grant.operation_version
         and operation_type.capability_key = v_grant.capability_key
         and operation_type.enabled
     )
  then
    return false;
  end if;

  if v_grant.issued_by_user_id is not null then
    return
      v_grant.system_actor_capability_grant_id is null
      and v_grant.required_user_capability_key is not null
      and v_grant.issued_by_principal_key = 'user:' || v_grant.issued_by_user_id::text
      and auth.uid() = v_grant.issued_by_user_id
      and coalesce(
        public.current_user_has_capability(v_grant.required_user_capability_key),
        false
      );
  end if;

  return
    v_grant.required_user_capability_key is null
    and v_grant.system_actor_capability_grant_id is not null
    and v_grant.issued_by_principal_key like 'policy:%'
    and exists (
      select 1
      from platform_private.system_actor_capability_grants standing_grant
      where standing_grant.id = v_grant.system_actor_capability_grant_id
        and standing_grant.actor_key = v_grant.actor_key
        and standing_grant.capability_key = v_grant.capability_key
        and standing_grant.status = 'active'
        and standing_grant.valid_from <= now()
        and standing_grant.expires_at > now()
    );
end
$$;

revoke all on function platform_private.registry_execution_grant_has_current_authority(uuid)
from public, anon, authenticated, service_role;

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
    raise exception using errcode = '22023',
      message = 'A valid System Actor and execution grant are required.';
  end if;

  if not exists (
    select 1 from platform_private.system_actors actor
    where actor.actor_key = p_actor_key and actor.status = 'active'
  ) then
    raise exception using errcode = '42501', message = 'The System Actor is not active.';
  end if;

  if not exists (
    select 1 from platform_private.system_actor_executor_bindings binding
    where binding.actor_key = p_actor_key
      and binding.executor_kind = 'database_role'
      and binding.executor_key = session_user
      and binding.status = 'active'
  ) then
    raise exception using errcode = '42501',
      message = 'The current executor is not bound to this System Actor.';
  end if;

  select execution_grant.* into v_grant
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.id = p_execution_grant_id
    and execution_grant.actor_key = p_actor_key
  for update;

  if not found then
    raise exception using errcode = 'P0002',
      message = 'The Registry execution grant does not exist for this System Actor.';
  end if;

  select operation.* into v_existing
  from platform_private.registry_mutation_operations operation
  where operation.execution_grant_id = p_execution_grant_id;

  if found then
    if v_existing.actor_key <> p_actor_key then
      raise exception using errcode = '42501',
        message = 'The execution grant belongs to another System Actor.';
    end if;

    if v_existing.status in ('authorized','executing','compensating')
       and not platform_private.registry_execution_grant_has_current_authority(p_execution_grant_id)
    then
      raise exception using errcode = '42501',
        message = 'The existing Registry operation can no longer be resumed under current authority.';
    end if;

    operation_id := v_existing.id;
    operation_status := v_existing.status;
    idempotent_replay := true;
    return next;
    return;
  end if;

  if v_grant.status <> 'active' then
    raise exception using errcode = '42501', message = 'The Registry execution grant is not active.';
  end if;
  if v_grant.expires_at <= now() then
    raise exception using errcode = '42501', message = 'The Registry execution grant has expired.';
  end if;
  if not platform_private.registry_execution_grant_has_current_authority(p_execution_grant_id) then
    raise exception using errcode = '42501',
      message = 'The Registry execution grant is not authorized under current authority.';
  end if;

  select operation_type.* into v_operation_type
  from platform_private.registry_operation_types operation_type
  where operation_type.operation_key = v_grant.operation_key
    and operation_type.operation_version = v_grant.operation_version
    and operation_type.capability_key = v_grant.capability_key
    and operation_type.enabled;
  if not found then
    raise exception using errcode = '42501', message = 'The typed Registry operation is disabled or missing.';
  end if;

  if v_grant.max_rows > v_operation_type.max_rows_ceiling then
    raise exception using errcode = '42501', message = 'The execution grant exceeds the operation row budget.';
  end if;
  if v_grant.expires_at > v_grant.issued_at + make_interval(secs => v_operation_type.max_grant_ttl_seconds) then
    raise exception using errcode = '42501', message = 'The execution grant exceeds the operation TTL ceiling.';
  end if;
  if (
    select count(*) from platform_private.registry_execution_grant_targets target
    where target.execution_grant_id = v_grant.id
  ) not between 1 and v_operation_type.max_targets then
    raise exception using errcode = '42501', message = 'The execution grant target set violates the operation target budget.';
  end if;
  if exists (
    select 1 from platform_private.registry_execution_grant_targets target
    where target.execution_grant_id = v_grant.id
      and not (target.subject_type = any(v_operation_type.allowed_subject_types))
  ) then
    raise exception using errcode = '42501', message = 'The execution grant contains a forbidden Registry subject type.';
  end if;
  if platform_private.registry_execution_target_set_fingerprint(v_grant.id) <> v_grant.target_set_fingerprint then
    raise exception using errcode = '42501', message = 'The Registry execution target set no longer matches the exact grant.';
  end if;
  if v_operation_type.requires_existing_target and exists (
    select 1 from platform_private.registry_execution_grant_targets target
    where target.execution_grant_id = v_grant.id
      and not platform_private.registry_subject_exists(target.subject_type,target.subject_id)
  ) then
    raise exception using errcode = '42501', message = 'The execution grant contains a Registry target that no longer exists.';
  end if;
  if exists (
    select 1 from platform_private.registry_execution_grant_targets target
    where target.execution_grant_id = v_grant.id
      and target.expected_state_fingerprint is not null
      and target.expected_state_fingerprint is distinct from
        platform_private.registry_subject_state_fingerprint(target.subject_type,target.subject_id)
  ) then
    raise exception using errcode = '42501', message = 'A Registry target changed after the execution grant was issued.';
  end if;
  if platform_private.registry_plan_fingerprint(v_grant.plan_payload) <> v_grant.plan_fingerprint then
    raise exception using errcode = '42501', message = 'The execution grant plan fingerprint does not match its bound plan.';
  end if;

  insert into platform_private.registry_mutation_operations (
    execution_grant_id, actor_key, capability_key,
    operation_key, operation_version, principal_key,
    plan_fingerprint, target_set_fingerprint, max_rows,
    status, verifier_status
  ) values (
    v_grant.id, v_grant.actor_key, v_grant.capability_key,
    v_grant.operation_key, v_grant.operation_version,
    'system:' || v_grant.actor_key,
    v_grant.plan_fingerprint, v_grant.target_set_fingerprint,
    v_grant.max_rows, 'authorized',
    case when v_operation_type.requires_verifier then 'pending' else 'not_required' end
  ) returning id into v_operation_id;

  update platform_private.registry_execution_grants
  set status='consumed', consumed_at=now(), updated_at=now()
  where id = v_grant.id;

  operation_id := v_operation_id;
  operation_status := 'authorized';
  idempotent_replay := false;
  return next;
end
$$;

revoke all on function platform_private.begin_registry_mutation_operation(text,uuid)
from public, anon, authenticated, service_role;

create function platform_private.record_registry_artist_origin_user_evidence(
  p_artist_id uuid,
  p_origin_iso2 text,
  p_confidence numeric,
  p_source_kind text,
  p_source_ref text,
  p_source_payload_fingerprint text,
  p_observed_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_claim_payload jsonb;
  v_recorded_by text;
  v_assertion_fingerprint text;
  v_assertion_id uuid;
begin
  if v_user_id is null
     or not coalesce(public.current_user_has_capability('manage_registry'), false)
  then
    raise exception using errcode='42501', message='manage_registry is required.';
  end if;

  if not exists (
    select 1 from platform_private.system_actor_executor_bindings binding
    where binding.actor_key='registry_artist_origin_admin'
      and binding.executor_kind='database_role'
      and binding.executor_key=session_user
      and binding.status='active'
  ) then
    raise exception using errcode='42501', message='Current transport is not the Artist-origin admin broker.';
  end if;

  if p_artist_id is null or p_observed_at is null or not exists (
    select 1 from public.registry_artists artist where artist.id=p_artist_id
  ) then
    raise exception using errcode='22023', message='A valid Artist and observation time are required.';
  end if;
  if not platform_private.registry_is_valid_iso2(p_origin_iso2) then
    raise exception using errcode='22023', message='Evidence origin must be a canonical ISO-3166-1 alpha-2 code.';
  end if;
  if p_confidence is null or p_confidence < 0 or p_confidence > 1 then
    raise exception using errcode='22023', message='Evidence confidence must be between zero and one.';
  end if;
  if p_source_kind is null or p_source_kind not in ('metadata_country_normalization','musicbrainz') then
    raise exception using errcode='22023', message='Artist Origin V1 does not accept this evidence source kind.';
  end if;
  if nullif(btrim(p_source_ref),'') is null
     or octet_length(p_source_ref)>2000
     or p_source_payload_fingerprint is null
     or p_source_payload_fingerprint !~ '^[0-9a-f]{64}$'
  then
    raise exception using errcode='22023', message='Evidence source reference/fingerprint is invalid.';
  end if;
  if p_observed_at > now()+interval '5 minutes' or p_observed_at < now()-interval '30 days' then
    raise exception using errcode='22023', message='Evidence observation time is outside the V1 freshness window.';
  end if;

  v_claim_payload := jsonb_build_object('origin_iso2',p_origin_iso2,'origin_confidence',p_confidence);
  v_recorded_by := 'user:' || v_user_id::text;

  select assertion.id into v_assertion_id
  from platform_private.registry_evidence_assertions assertion
  where assertion.subject_type='artist'
    and assertion.subject_id=p_artist_id
    and assertion.claim_key='registry.artist.origin'
    and assertion.claim_payload=v_claim_payload
    and assertion.trust_class='EXTERNAL_EVIDENCE'
    and assertion.source_kind=p_source_kind
    and assertion.source_ref=btrim(p_source_ref)
    and assertion.source_payload_fingerprint=p_source_payload_fingerprint
    and assertion.recorded_by_principal_key=v_recorded_by
    and assertion.created_at >= now()-interval '10 minutes'
  order by assertion.created_at desc limit 1;
  if found then return v_assertion_id; end if;

  v_assertion_fingerprint := encode(
    extensions.digest(
      jsonb_build_object(
        'subject_type','artist', 'subject_id',p_artist_id::text,
        'claim_key','registry.artist.origin', 'claim_payload',v_claim_payload,
        'trust_class','EXTERNAL_EVIDENCE', 'source_kind',p_source_kind,
        'source_ref',btrim(p_source_ref),
        'source_payload_fingerprint',p_source_payload_fingerprint,
        'observed_at',p_observed_at,
        'recorded_by_principal_key',v_recorded_by
      )::text,'sha256'
    ),'hex'
  );

  insert into platform_private.registry_evidence_assertions (
    subject_type,subject_id,claim_key,claim_payload,trust_class,
    source_kind,source_ref,source_payload_fingerprint,observed_at,
    recorded_by_principal_key,assertion_fingerprint
  ) values (
    'artist',p_artist_id,'registry.artist.origin',v_claim_payload,'EXTERNAL_EVIDENCE',
    p_source_kind,btrim(p_source_ref),p_source_payload_fingerprint,p_observed_at,
    v_recorded_by,v_assertion_fingerprint
  ) on conflict (assertion_fingerprint) do nothing returning id into v_assertion_id;

  if v_assertion_id is null then
    select assertion.id into v_assertion_id
    from platform_private.registry_evidence_assertions assertion
    where assertion.assertion_fingerprint=v_assertion_fingerprint;
  end if;
  return v_assertion_id;
end
$$;

revoke all on function platform_private.record_registry_artist_origin_user_evidence(uuid,text,numeric,text,text,text,timestamptz)
from public, anon, authenticated, service_role;

create function platform_private.issue_registry_artist_origin_user_execution_grant(
  p_evidence_assertion_id uuid
)
returns table (
  execution_grant_id uuid,
  plan_fingerprint text,
  target_set_fingerprint text,
  expected_state_fingerprint text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_artist public.registry_artists%rowtype;
  v_existing platform_private.registry_execution_grants%rowtype;
  v_plan jsonb;
  v_plan_fingerprint text;
  v_state_fingerprint text;
  v_target_fingerprint text;
  v_execution_grant_id uuid;
  v_idempotency_key text;
  v_origin_iso2 text;
  v_confidence numeric;
  v_expires_at timestamptz;
begin
  if v_user_id is null or not coalesce(public.current_user_has_capability('manage_registry'),false) then
    raise exception using errcode='42501', message='manage_registry is required.';
  end if;
  if not exists (
       select 1 from platform_private.system_actors actor
       where actor.actor_key='registry_artist_origin_admin' and actor.status='active'
     ) or not exists (
       select 1 from platform_private.system_actor_executor_bindings binding
       where binding.actor_key='registry_artist_origin_admin'
         and binding.executor_kind='database_role'
         and binding.executor_key=session_user and binding.status='active'
     ) then
    raise exception using errcode='42501', message='Artist-origin admin broker is not active.';
  end if;
  if not exists (
    select 1 from platform_private.registry_operation_types operation_type
    where operation_type.operation_key='registry.artist_origin.admit'
      and operation_type.operation_version=1
      and operation_type.capability_key='admit_registry_artist_origin'
      and operation_type.enabled
  ) then
    raise exception using errcode='42501', message='Artist-origin admission is disabled.';
  end if;

  select assertion.* into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=p_evidence_assertion_id;
  if not found
     or v_evidence.subject_type<>'artist'
     or v_evidence.claim_key<>'registry.artist.origin'
     or v_evidence.trust_class not in ('EXTERNAL_EVIDENCE','INTERNAL_FACT')
     or v_evidence.recorded_by_principal_key <> 'user:'||v_user_id::text
  then
    raise exception using errcode='42501', message='Evidence assertion is not admissible for this admin Artist-origin grant.';
  end if;
  if v_evidence.observed_at < now()-interval '30 days' or v_evidence.observed_at > now()+interval '5 minutes' then
    raise exception using errcode='42501', message='Evidence assertion is outside the V1 freshness window.';
  end if;

  v_origin_iso2 := v_evidence.claim_payload->>'origin_iso2';
  begin
    v_confidence := (v_evidence.claim_payload->>'origin_confidence')::numeric;
  exception when others then
    raise exception using errcode='22023', message='Evidence confidence is malformed.';
  end;
  if v_origin_iso2 is null or v_confidence is null
     or not platform_private.registry_is_valid_iso2(v_origin_iso2)
     or v_confidence<0.90 or v_confidence>1
  then
    raise exception using errcode='42501', message='Evidence does not meet Artist Origin V1 admission policy.';
  end if;

  select artist.* into v_artist from public.registry_artists artist where artist.id=v_evidence.subject_id;
  if not found or v_artist.status not in ('active','draft')
     or nullif(btrim(v_artist.origin_iso2),'') is not null
     or v_artist.origin_confidence is not null
  then
    raise exception using errcode='42501', message='Artist is not eligible for missing-origin admission.';
  end if;

  v_idempotency_key := 'admin-origin:' || substr(v_evidence.assertion_fingerprint,1,40);
  select execution_grant.* into v_existing
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.actor_key='registry_artist_origin_admin'
    and execution_grant.operation_key='registry.artist_origin.admit'
    and execution_grant.operation_version=1
    and execution_grant.idempotency_key=v_idempotency_key;
  if found then
    if v_existing.issued_by_user_id<>v_user_id
       or v_existing.plan_payload->>'evidence_assertion_id' is distinct from v_evidence.id::text
    then
      raise exception using errcode='23505', message='Idempotency key is already bound to different admin Artist-origin authority.';
    end if;
    execution_grant_id:=v_existing.id;
    plan_fingerprint:=v_existing.plan_fingerprint;
    target_set_fingerprint:=v_existing.target_set_fingerprint;
    select target.expected_state_fingerprint into expected_state_fingerprint
    from platform_private.registry_execution_grant_targets target
    where target.execution_grant_id=v_existing.id and target.subject_type='artist' limit 1;
    expires_at:=v_existing.expires_at;
    return next; return;
  end if;

  v_state_fingerprint := platform_private.registry_subject_state_fingerprint('artist',v_artist.id);
  v_plan := jsonb_build_object(
    'operation_key','registry.artist_origin.admit', 'operation_version',1,
    'artist_id',v_artist.id::text,
    'evidence_assertion_id',v_evidence.id::text,
    'evidence_assertion_fingerprint',v_evidence.assertion_fingerprint,
    'proposed_origin_iso2',v_origin_iso2,
    'proposed_origin_confidence',v_confidence,
    'expected_state_fingerprint',v_state_fingerprint,
    'trust_class',v_evidence.trust_class,
    'policy_ruleset_version','registry-artist-origin-admission-v1'
  );
  v_plan_fingerprint:=platform_private.registry_plan_fingerprint(v_plan);
  v_target_fingerprint:=encode(
    extensions.digest(
      jsonb_build_array(jsonb_build_object(
        'subject_type','artist','subject_id',v_artist.id::text,
        'expected_state_fingerprint',v_state_fingerprint
      ))::text,'sha256'
    ),'hex'
  );
  v_expires_at:=now()+interval '5 minutes';

  insert into platform_private.registry_execution_grants (
    actor_key,capability_key,system_actor_capability_grant_id,
    operation_key,operation_version,plan_payload,plan_fingerprint,
    target_set_fingerprint,max_rows,idempotency_key,status,
    issued_by_user_id,issued_by_principal_key,policy_ruleset_version,
    required_user_capability_key,issued_at,expires_at
  ) values (
    'registry_artist_origin_admin','admit_registry_artist_origin',null,
    'registry.artist_origin.admit',1,v_plan,v_plan_fingerprint,
    v_target_fingerprint,1,v_idempotency_key,'active',v_user_id,
    'user:'||v_user_id::text,'registry-artist-origin-admission-v1',
    'manage_registry',now(),v_expires_at
  ) returning id into v_execution_grant_id;

  insert into platform_private.registry_execution_grant_targets (
    execution_grant_id,subject_type,subject_id,expected_state_fingerprint
  ) values (v_execution_grant_id,'artist',v_artist.id,v_state_fingerprint);

  execution_grant_id:=v_execution_grant_id;
  plan_fingerprint:=v_plan_fingerprint;
  target_set_fingerprint:=v_target_fingerprint;
  expected_state_fingerprint:=v_state_fingerprint;
  expires_at:=v_expires_at;
  return next;
end
$$;

revoke all on function platform_private.issue_registry_artist_origin_user_execution_grant(uuid)
from public, anon, authenticated, service_role;

create function public.admin_execute_registry_artist_origin_admission(
  p_artist_id uuid,
  p_origin_iso2 text,
  p_confidence numeric,
  p_source_kind text,
  p_source_ref text,
  p_source_payload_fingerprint text,
  p_observed_at timestamptz
)
returns table (
  evidence_assertion_id uuid,
  execution_grant_id uuid,
  operation_id uuid,
  operation_status text,
  verifier_status text,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
declare
  v_user_id uuid:=auth.uid();
  v_evidence_id uuid;
  v_grant record;
  v_execution record;
begin
  if v_user_id is null or not coalesce(public.current_user_has_capability('manage_registry'),false) then
    raise exception using errcode='42501', message='manage_registry is required.';
  end if;
  v_evidence_id:=platform_private.record_registry_artist_origin_user_evidence(
    p_artist_id,p_origin_iso2,p_confidence,p_source_kind,p_source_ref,p_source_payload_fingerprint,p_observed_at
  );
  select * into v_grant from platform_private.issue_registry_artist_origin_user_execution_grant(v_evidence_id);
  select * into v_execution from platform_private.execute_registry_artist_origin_admission(
    'registry_artist_origin_admin',v_grant.execution_grant_id
  );

  if not v_execution.idempotent_replay then
    insert into public.registry_audit_log (
      actor_id,actor_label,action,entity_type,entity_id,after_value,metadata
    ) values (
      v_user_id,'registry_admin','execute_registry_artist_origin_admission','registry_artist',p_artist_id,
      jsonb_build_object('origin_iso2',p_origin_iso2,'origin_confidence',p_confidence),
      jsonb_build_object(
        'evidence_assertion_id',v_evidence_id,
        'execution_grant_id',v_grant.execution_grant_id,
        'operation_id',v_execution.operation_id,
        'source_kind',p_source_kind
      )
    );
  end if;

  evidence_assertion_id:=v_evidence_id;
  execution_grant_id:=v_grant.execution_grant_id;
  operation_id:=v_execution.operation_id;
  operation_status:=v_execution.operation_status;
  verifier_status:=v_execution.verifier_status;
  idempotent_replay:=v_execution.idempotent_replay;
  return next;
end
$$;

create function public.admin_verify_registry_artist_origin_admission(p_operation_id uuid)
returns table (operation_id uuid, verifier_status text)
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
begin
  if auth.uid() is null or not coalesce(public.current_user_has_capability('manage_registry'),false) then
    raise exception using errcode='42501', message='manage_registry is required.';
  end if;
  if not exists (
    select 1
    from platform_private.registry_mutation_operations operation
    join platform_private.registry_execution_grants execution_grant
      on execution_grant.id=operation.execution_grant_id
    where operation.id=p_operation_id
      and operation.actor_key='registry_artist_origin_admin'
      and execution_grant.issued_by_user_id=auth.uid()
      and execution_grant.required_user_capability_key='manage_registry'
  ) then
    raise exception using errcode='P0002', message='Human Artist-origin operation not found for current user.';
  end if;
  return query select * from platform_private.verify_registry_artist_origin_admission(p_operation_id);
end
$$;

create function public.admin_set_registry_artist_origin_operation_enabled(
  p_enabled boolean,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
declare
  v_user_id uuid:=auth.uid();
  v_before boolean;
begin
  if v_user_id is null or not coalesce(public.current_user_has_capability('manage_registry'),false) then
    raise exception using errcode='42501', message='manage_registry is required.';
  end if;
  if p_enabled is null or nullif(btrim(p_reason),'') is null or octet_length(p_reason)>1000 then
    raise exception using errcode='22023', message='An enabled state and bounded reason are required.';
  end if;
  select enabled into v_before
  from platform_private.registry_operation_types
  where operation_key='registry.artist_origin.admit' and operation_version=1
  for update;
  if not found then raise exception using errcode='P0002', message='Artist-origin operation type is missing.'; end if;
  update platform_private.registry_operation_types
  set enabled=p_enabled,updated_at=now()
  where operation_key='registry.artist_origin.admit' and operation_version=1;
  insert into public.registry_audit_log (
    actor_id,actor_label,action,entity_type,before_value,after_value,metadata
  ) values (
    v_user_id,'registry_admin','set_registry_artist_origin_operation_enabled','registry_operation_type',
    jsonb_build_object('enabled',v_before),jsonb_build_object('enabled',p_enabled),
    jsonb_build_object('operation_key','registry.artist_origin.admit','operation_version',1,'reason',btrim(p_reason))
  );
  return true;
end
$$;

revoke all on function
  public.admin_execute_registry_artist_origin_admission(uuid,text,numeric,text,text,text,timestamptz),
  public.admin_verify_registry_artist_origin_admission(uuid),
  public.admin_set_registry_artist_origin_operation_enabled(boolean,text)
from public, anon, service_role;

grant execute on function
  public.admin_execute_registry_artist_origin_admission(uuid,text,numeric,text,text,text,timestamptz),
  public.admin_verify_registry_artist_origin_admission(uuid),
  public.admin_set_registry_artist_origin_operation_enabled(boolean,text)
to authenticated;

update platform_private.registry_operation_types
set enabled=true,updated_at=now()
where operation_key='registry.artist_origin.admit'
  and operation_version=1
  and capability_key='admit_registry_artist_origin';

do $proof$
begin
  if (select enabled from platform_private.registry_operation_types
      where operation_key='registry.artist_origin.admit' and operation_version=1) is distinct from true
  then raise exception 'STOP: Artist-origin operation did not activate for admin convergence'; end if;

  if exists (
    select 1 from platform_private.system_actor_capability_grants
    where actor_key='mizizi' and capability_key='admit_registry_artist_origin'
      and status='active' and valid_from<=now() and expires_at>now()
  ) then raise exception 'STOP: admin convergence must not create MIZIZI standing authority'; end if;

  if not exists (
    select 1
    from platform_private.system_actors actor
    join platform_private.system_actor_executor_bindings binding on binding.actor_key=actor.actor_key
    where actor.actor_key='registry_artist_origin_admin'
      and actor.actor_kind='automation' and actor.status='active'
      and binding.executor_kind='database_role'
      and binding.executor_key='authenticator' and binding.status='active'
  ) then raise exception 'STOP: Artist-origin admin broker identity is incomplete'; end if;

  if has_function_privilege('anon','public.admin_execute_registry_artist_origin_admission(uuid,text,numeric,text,text,text,timestamptz)','EXECUTE')
     or has_function_privilege('service_role','public.admin_execute_registry_artist_origin_admission(uuid,text,numeric,text,text,text,timestamptz)','EXECUTE')
     or not has_function_privilege('authenticated','public.admin_execute_registry_artist_origin_admission(uuid,text,numeric,text,text,text,timestamptz)','EXECUTE')
     or has_function_privilege('authenticated','platform_private.issue_registry_artist_origin_user_execution_grant(uuid)','EXECUTE')
     or has_function_privilege('service_role','platform_private.issue_registry_artist_origin_user_execution_grant(uuid)','EXECUTE')
  then raise exception 'STOP: Artist-origin admin execution privilege boundary leaked'; end if;
end
$proof$;

commit;
