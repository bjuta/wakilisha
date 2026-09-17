begin;

-- MIZIZI Slice 2 / Gate E
-- Shared Registry review authority and causal binding for human-approved
-- typed Registry execution grants.
--
-- Evidence payloads remain in their existing typed authorities. This migration
-- adds only the shared review-case / review-event envelope and binds approved
-- review authority to the exact execution grant that can cause Registry writes.

set local statement_timeout = '180s';
set local lock_timeout = '5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'mizizi-slice2-gate-e-registry-shared-review-authority-v1',
    0
  )
);

-- Exact grants are short-lived runtime authority. Gate E intentionally has no
-- historical grant backfill. Lock the two grant relations so the zero-ledger
-- baseline cannot drift during installation.
lock table platform_private.registry_execution_grants
  in share row exclusive mode;
lock table platform_private.registry_execution_grant_targets
  in share row exclusive mode;

do $preflight$
begin
  if to_regclass('platform_private.registry_evidence_assertions') is null
     or to_regclass('platform_private.registry_operation_types') is null
     or to_regclass('platform_private.registry_execution_grants') is null
     or to_regclass('platform_private.registry_execution_grant_targets') is null
     or to_regclass('platform_private.registry_mutation_operations') is null
     or to_regclass('platform_private.registry_operation_write_events') is null
     or to_regclass('public.registry_canonical_write_events') is null
  then
    raise exception
      'STOP: accepted Registry governance foundation is missing';
  end if;

  if to_regclass('platform_private.registry_review_cases') is not null
     or to_regclass('platform_private.registry_review_events') is not null
     or to_regclass('platform_private.registry_review_case_status_v1') is not null
     or to_regprocedure(
       'platform_private.ensure_registry_review_case_v1(text,uuid,text,integer,uuid)'
     ) is not null
     or to_regprocedure(
       'platform_private.record_registry_review_decision_v1(uuid,text,text,text,uuid)'
     ) is not null
     or to_regprocedure(
       'platform_private.transition_registry_review_case_v1(uuid,text,text,text)'
     ) is not null
  then
    raise exception
      'STOP: Gate E shared Registry review authority already exists';
  end if;

  if exists (
       select 1
       from platform_private.registry_execution_grants
     )
     or exists (
       select 1
       from platform_private.registry_mutation_operations
     )
     or exists (
       select 1
       from platform_private.registry_operation_write_events
     )
  then
    raise exception
      'STOP: Gate E requires the accepted zero exact-grant / mutation-operation baseline';
  end if;

  if not exists (
    select 1
    from platform_private.registry_operation_types
    where requires_human_approval
      and enabled
  ) then
    raise exception
      'STOP: no enabled human-approved Registry operations exist';
  end if;
end;
$preflight$;

-- ---------------------------------------------------------------------------
-- Shared review case identity.
--
-- A case identifies one typed Registry operation target reviewed against one
-- immutable Registry evidence assertion. It does not contain domain payloads.
-- ---------------------------------------------------------------------------

create table platform_private.registry_review_cases (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null,
  subject_id uuid not null,
  operation_key text not null,
  operation_version integer not null,
  evidence_assertion_id uuid not null,
  case_fingerprint text not null,
  created_at timestamptz not null default now(),
  constraint registry_review_cases_subject_type_check
    check (
      subject_type in (
        'artist',
        'track',
        'release',
        'registry_relationship',
        'track_artist_credit',
        'release_track_membership',
        'release_artist_credit'
      )
    ),
  constraint registry_review_cases_operation_fkey
    foreign key (operation_key, operation_version)
    references platform_private.registry_operation_types (
      operation_key,
      operation_version
    )
    on update restrict
    on delete restrict,
  constraint registry_review_cases_evidence_fkey
    foreign key (evidence_assertion_id)
    references platform_private.registry_evidence_assertions (id)
    on update restrict
    on delete restrict,
  constraint registry_review_cases_fingerprint_check
    check (case_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint registry_review_cases_fingerprint_key
    unique (case_fingerprint),
  constraint registry_review_cases_exact_authority_key
    unique (
      subject_type,
      subject_id,
      operation_key,
      operation_version,
      evidence_assertion_id
    )
);

create index registry_review_cases_subject_idx
  on platform_private.registry_review_cases (
    subject_type,
    subject_id,
    created_at desc
  );

comment on table platform_private.registry_review_cases is
  'Immutable shared Registry review-case identity. Domain payloads remain in typed authorities; each case binds one exact operation target to one immutable Registry evidence assertion.';

-- ---------------------------------------------------------------------------
-- Append-only review events.
--
-- decision       = current reviewer judgment
-- supersede      = retire one effective decision without erasing it
-- reopen         = reopen a superseded case before a new decision
--
-- An approved event may bind the exact execution grant it authorizes. The
-- operation ledger already points back to that grant, so no parallel mutation
-- ledger is introduced here.
-- ---------------------------------------------------------------------------

create table platform_private.registry_review_events (
  id uuid primary key default gen_random_uuid(),
  event_sequence bigint generated always as identity,
  review_case_id uuid not null,
  event_type text not null,
  decision text null,
  rationale text not null,
  reviewer_principal_key text not null,
  related_event_id uuid null,
  execution_grant_id uuid null,
  event_fingerprint text not null,
  created_at timestamptz not null default now(),
  constraint registry_review_events_case_fkey
    foreign key (review_case_id)
    references platform_private.registry_review_cases (id)
    on update restrict
    on delete restrict,
  constraint registry_review_events_related_event_fkey
    foreign key (related_event_id)
    references platform_private.registry_review_events (id)
    on update restrict
    on delete restrict,
  constraint registry_review_events_execution_grant_fkey
    foreign key (execution_grant_id)
    references platform_private.registry_execution_grants (id)
    on update restrict
    on delete restrict,
  constraint registry_review_events_event_type_check
    check (event_type in ('decision', 'supersede', 'reopen')),
  constraint registry_review_events_decision_check
    check (
      decision is null
      or decision in ('approved', 'rejected', 'needs_more_evidence')
    ),
  constraint registry_review_events_rationale_check
    check (
      nullif(btrim(rationale), '') is not null
      and octet_length(rationale) <= 4000
    ),
  constraint registry_review_events_reviewer_principal_check
    check (
      reviewer_principal_key ~
        '^((system|policy):[a-z][a-z0-9_.:-]{1,119}|user:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$'
    ),
  constraint registry_review_events_semantics_check
    check (
      (
        event_type = 'decision'
        and decision is not null
        and (
          execution_grant_id is null
          or decision = 'approved'
        )
      )
      or (
        event_type in ('supersede', 'reopen')
        and decision is null
        and related_event_id is not null
        and execution_grant_id is null
      )
    ),
  constraint registry_review_events_sequence_key
    unique (event_sequence),
  constraint registry_review_events_fingerprint_check
    check (event_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint registry_review_events_fingerprint_key
    unique (event_fingerprint)
);

create unique index registry_review_events_case_grant_key
  on platform_private.registry_review_events (
    review_case_id,
    execution_grant_id
  )
  where execution_grant_id is not null;

create index registry_review_events_case_sequence_idx
  on platform_private.registry_review_events (
    review_case_id,
    event_sequence desc
  );

create index registry_review_events_grant_idx
  on platform_private.registry_review_events (execution_grant_id)
  where execution_grant_id is not null;

comment on table platform_private.registry_review_events is
  'Append-only shared Registry review decisions and lifecycle transitions. Approved events may bind the exact execution grant whose mutation operation they causally authorize.';

-- ---------------------------------------------------------------------------
-- Append-only guards.
-- ---------------------------------------------------------------------------

create function platform_private.reject_registry_review_immutable_mutation_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  raise exception
    using
      errcode = '23514',
      message = 'Registry review history is immutable; append a supersede/reopen/decision event instead.';
end;
$$;

create trigger registry_review_cases_immutable
  before update or delete
  on platform_private.registry_review_cases
  for each row
  execute function platform_private.reject_registry_review_immutable_mutation_v1();

create trigger registry_review_events_immutable
  before update or delete
  on platform_private.registry_review_events
  for each row
  execute function platform_private.reject_registry_review_immutable_mutation_v1();

-- ---------------------------------------------------------------------------
-- Deterministic current-state projection. Historical rows are never rewritten.
-- ---------------------------------------------------------------------------

create view platform_private.registry_review_case_status_v1 as
select
  review_case.id as review_case_id,
  review_case.subject_type,
  review_case.subject_id,
  review_case.operation_key,
  review_case.operation_version,
  review_case.evidence_assertion_id,
  review_case.case_fingerprint,
  review_case.created_at as case_created_at,
  case
    when latest_event.id is null then 'open'
    when latest_event.event_type = 'reopen' then 'reopened'
    when latest_event.event_type = 'supersede' then 'superseded'
    else 'effective'
  end as review_state,
  effective_decision.id as effective_review_event_id,
  effective_decision.decision as effective_decision,
  effective_decision.rationale as effective_rationale,
  effective_decision.reviewer_principal_key as effective_reviewer_principal_key,
  effective_decision.execution_grant_id as effective_execution_grant_id,
  effective_decision.created_at as effective_decided_at,
  latest_event.id as latest_event_id,
  latest_event.event_type as latest_event_type,
  latest_event.created_at as latest_event_at
from platform_private.registry_review_cases review_case
left join lateral (
  select review_event.*
  from platform_private.registry_review_events review_event
  where review_event.review_case_id = review_case.id
  order by review_event.event_sequence desc
  limit 1
) latest_event on true
left join lateral (
  select decision_event.*
  from platform_private.registry_review_events decision_event
  where decision_event.review_case_id = review_case.id
    and decision_event.event_type = 'decision'
    and not exists (
      select 1
      from platform_private.registry_review_events supersede_event
      where supersede_event.review_case_id = review_case.id
        and supersede_event.event_type = 'supersede'
        and supersede_event.related_event_id = decision_event.id
    )
  order by decision_event.event_sequence desc
  limit 1
) effective_decision on true;

comment on view platform_private.registry_review_case_status_v1 is
  'Deterministic projection of open/effective/superseded/reopened Registry review state. Source review events remain append-only authority.';

-- ---------------------------------------------------------------------------
-- Shared case/decision recorders. They are private implementation authority,
-- not a new public generic review RPC.
-- ---------------------------------------------------------------------------

create function platform_private.ensure_registry_review_case_v1(
  p_subject_type text,
  p_subject_id uuid,
  p_operation_key text,
  p_operation_version integer,
  p_evidence_assertion_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, platform_private, extensions
as $$
declare
  v_operation platform_private.registry_operation_types%rowtype;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_case_fingerprint text;
  v_case_id uuid;
begin
  if p_subject_id is null
     or p_evidence_assertion_id is null
     or p_operation_version is null
     or p_operation_version < 1
  then
    raise exception using errcode='22023',
      message='Typed subject, evidence, and operation version are required.';
  end if;

  select operation_type.*
  into v_operation
  from platform_private.registry_operation_types operation_type
  where operation_type.operation_key = p_operation_key
    and operation_type.operation_version = p_operation_version;

  if not found
     or not v_operation.requires_human_approval
     or not (p_subject_type = any(v_operation.allowed_subject_types))
  then
    raise exception using errcode='42501',
      message='Review case must bind a human-approved typed Registry operation and allowed subject.';
  end if;

  select evidence.*
  into v_evidence
  from platform_private.registry_evidence_assertions evidence
  where evidence.id = p_evidence_assertion_id;

  if not found then
    raise exception using errcode='P0002',
      message='Registry review evidence assertion does not exist.';
  end if;

  v_case_fingerprint := encode(
    extensions.digest(
      jsonb_build_object(
        'subject_type', p_subject_type,
        'subject_id', p_subject_id::text,
        'operation_key', p_operation_key,
        'operation_version', p_operation_version,
        'evidence_assertion_fingerprint', v_evidence.assertion_fingerprint
      )::text,
      'sha256'
    ),
    'hex'
  );

  insert into platform_private.registry_review_cases (
    subject_type,
    subject_id,
    operation_key,
    operation_version,
    evidence_assertion_id,
    case_fingerprint
  ) values (
    p_subject_type,
    p_subject_id,
    p_operation_key,
    p_operation_version,
    p_evidence_assertion_id,
    v_case_fingerprint
  )
  on conflict (
    subject_type,
    subject_id,
    operation_key,
    operation_version,
    evidence_assertion_id
  ) do nothing
  returning id into v_case_id;

  if v_case_id is null then
    select review_case.id
    into v_case_id
    from platform_private.registry_review_cases review_case
    where review_case.subject_type = p_subject_type
      and review_case.subject_id = p_subject_id
      and review_case.operation_key = p_operation_key
      and review_case.operation_version = p_operation_version
      and review_case.evidence_assertion_id = p_evidence_assertion_id
      and review_case.case_fingerprint = v_case_fingerprint;
  end if;

  if v_case_id is null then
    raise exception using errcode='23505',
      message='Registry review-case identity conflicts with a different fingerprint.';
  end if;

  return v_case_id;
end;
$$;

create function platform_private.record_registry_review_decision_v1(
  p_review_case_id uuid,
  p_decision text,
  p_rationale text,
  p_reviewer_principal_key text,
  p_execution_grant_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, platform_private, extensions
as $$
declare
  v_case platform_private.registry_review_cases%rowtype;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_status record;
  v_grant platform_private.registry_execution_grants%rowtype;
  v_related_event_id uuid;
  v_event_fingerprint text;
  v_event_id uuid;
  v_existing_id uuid;
  v_evidence_id_text text;
begin
  if p_review_case_id is null
     or p_decision not in ('approved', 'rejected', 'needs_more_evidence')
     or nullif(btrim(coalesce(p_rationale, '')), '') is null
     or octet_length(p_rationale) > 4000
     or p_reviewer_principal_key is null
     or p_reviewer_principal_key !~
       '^((system|policy):[a-z][a-z0-9_.:-]{1,119}|user:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$'
  then
    raise exception using errcode='22023',
      message='Valid Registry review decision, rationale, and reviewer principal are required.';
  end if;

  select review_case.*
  into v_case
  from platform_private.registry_review_cases review_case
  where review_case.id = p_review_case_id
  for update;

  if not found then
    raise exception using errcode='P0002',
      message='Registry review case does not exist.';
  end if;

  select evidence.*
  into v_evidence
  from platform_private.registry_evidence_assertions evidence
  where evidence.id = v_case.evidence_assertion_id;

  if not found then
    raise exception using errcode='23503',
      message='Registry review case lost its evidence authority.';
  end if;

  if p_execution_grant_id is not null then
    select review_event.id
    into v_existing_id
    from platform_private.registry_review_events review_event
    where review_event.review_case_id = v_case.id
      and review_event.execution_grant_id = p_execution_grant_id
      and review_event.event_type = 'decision'
      and review_event.decision = 'approved';

    if found then
      return v_existing_id;
    end if;

    if p_decision <> 'approved'
       or p_reviewer_principal_key not like 'user:%'
    then
      raise exception using errcode='42501',
        message='Only a human approved review decision may authorize an exact execution grant.';
    end if;

    select execution_grant.*
    into v_grant
    from platform_private.registry_execution_grants execution_grant
    where execution_grant.id = p_execution_grant_id;

    if not found
       or v_grant.operation_key <> v_case.operation_key
       or v_grant.operation_version <> v_case.operation_version
       or v_grant.issued_by_principal_key <> p_reviewer_principal_key
    then
      raise exception using errcode='42501',
        message='Execution grant is not bound to this review operation/reviewer authority.';
    end if;

    if not exists (
      select 1
      from platform_private.registry_execution_grant_targets target
      where target.execution_grant_id = v_grant.id
        and target.subject_type = v_case.subject_type
        and target.subject_id = v_case.subject_id
    ) then
      raise exception using errcode='42501',
        message='Execution grant target is not bound to this review case.';
    end if;

    v_evidence_id_text := v_grant.plan_payload ->> 'evidence_assertion_id';

    if v_evidence_id_text is distinct from v_case.evidence_assertion_id::text
       or v_grant.plan_payload ->> 'evidence_assertion_fingerprint'
          is distinct from v_evidence.assertion_fingerprint
       or v_grant.plan_payload ->> 'trust_class'
          is distinct from v_evidence.trust_class
    then
      raise exception using errcode='42501',
        message='Execution grant plan is not bound to the reviewed evidence assertion.';
    end if;
  end if;

  select review_status.*
  into v_status
  from platform_private.registry_review_case_status_v1 review_status
  where review_status.review_case_id = v_case.id;

  if v_status.review_state = 'reopened' then
    v_related_event_id := v_status.latest_event_id;
  elsif v_status.review_state = 'open' then
    v_related_event_id := null;
  else
    raise exception using errcode='55000',
      message='Registry review case already has an effective decision; supersede and reopen it before recording another decision.';
  end if;

  v_event_fingerprint := encode(
    extensions.digest(
      jsonb_build_object(
        'case_fingerprint', v_case.case_fingerprint,
        'event_type', 'decision',
        'decision', p_decision,
        'rationale', btrim(p_rationale),
        'reviewer_principal_key', p_reviewer_principal_key,
        'related_event_id', coalesce(v_related_event_id::text, ''),
        'execution_grant_id', coalesce(p_execution_grant_id::text, '')
      )::text,
      'sha256'
    ),
    'hex'
  );

  insert into platform_private.registry_review_events (
    review_case_id,
    event_type,
    decision,
    rationale,
    reviewer_principal_key,
    related_event_id,
    execution_grant_id,
    event_fingerprint
  ) values (
    v_case.id,
    'decision',
    p_decision,
    btrim(p_rationale),
    p_reviewer_principal_key,
    v_related_event_id,
    p_execution_grant_id,
    v_event_fingerprint
  )
  on conflict (event_fingerprint) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select review_event.id
    into v_event_id
    from platform_private.registry_review_events review_event
    where review_event.event_fingerprint = v_event_fingerprint;
  end if;

  return v_event_id;
end;
$$;

create function platform_private.transition_registry_review_case_v1(
  p_review_case_id uuid,
  p_transition text,
  p_rationale text,
  p_reviewer_principal_key text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, platform_private, extensions
as $$
declare
  v_case platform_private.registry_review_cases%rowtype;
  v_status record;
  v_related platform_private.registry_review_events%rowtype;
  v_event_fingerprint text;
  v_event_id uuid;
begin
  if p_review_case_id is null
     or p_transition not in ('supersede', 'reopen')
     or nullif(btrim(coalesce(p_rationale, '')), '') is null
     or octet_length(p_rationale) > 4000
     or p_reviewer_principal_key is null
     or p_reviewer_principal_key !~
       '^((system|policy):[a-z][a-z0-9_.:-]{1,119}|user:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$'
  then
    raise exception using errcode='22023',
      message='Valid Registry review transition, rationale, and reviewer principal are required.';
  end if;

  select review_case.*
  into v_case
  from platform_private.registry_review_cases review_case
  where review_case.id = p_review_case_id
  for update;

  if not found then
    raise exception using errcode='P0002',
      message='Registry review case does not exist.';
  end if;

  select review_status.*
  into v_status
  from platform_private.registry_review_case_status_v1 review_status
  where review_status.review_case_id = v_case.id;

  if p_transition = 'supersede' then
    if v_status.review_state <> 'effective'
       or v_status.effective_review_event_id is null
    then
      raise exception using errcode='55000',
        message='Only an effective Registry review decision may be superseded.';
    end if;

    select review_event.*
    into v_related
    from platform_private.registry_review_events review_event
    where review_event.id = v_status.effective_review_event_id;

    if v_related.execution_grant_id is not null
       and exists (
         select 1
         from platform_private.registry_execution_grants execution_grant
         where execution_grant.id = v_related.execution_grant_id
           and execution_grant.status = 'active'
       )
    then
      raise exception using errcode='55000',
        message='Cannot supersede review authority while its exact execution grant is active.';
    end if;
  else
    if v_status.review_state <> 'superseded'
       or v_status.latest_event_id is null
    then
      raise exception using errcode='55000',
        message='Only a superseded Registry review case may be reopened.';
    end if;

    select review_event.*
    into v_related
    from platform_private.registry_review_events review_event
    where review_event.id = v_status.latest_event_id
      and review_event.event_type = 'supersede';

    if not found then
      raise exception using errcode='23514',
        message='Registry review state is inconsistent with its event history.';
    end if;
  end if;

  v_event_fingerprint := encode(
    extensions.digest(
      jsonb_build_object(
        'case_fingerprint', v_case.case_fingerprint,
        'event_type', p_transition,
        'rationale', btrim(p_rationale),
        'reviewer_principal_key', p_reviewer_principal_key,
        'related_event_id', v_related.id::text
      )::text,
      'sha256'
    ),
    'hex'
  );

  insert into platform_private.registry_review_events (
    review_case_id,
    event_type,
    decision,
    rationale,
    reviewer_principal_key,
    related_event_id,
    execution_grant_id,
    event_fingerprint
  ) values (
    v_case.id,
    p_transition,
    null,
    btrim(p_rationale),
    p_reviewer_principal_key,
    v_related.id,
    null,
    v_event_fingerprint
  )
  on conflict (event_fingerprint) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select review_event.id
    into v_event_id
    from platform_private.registry_review_events review_event
    where review_event.event_fingerprint = v_event_fingerprint;
  end if;

  return v_event_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Exact grant review sealing.
--
-- Existing grant issuers already insert the grant target before returning the
-- grant. This trigger seals the approved shared review event at that point.
-- If review sealing fails, target insertion fails and the grant transaction
-- rolls back. No accepted grant-issuer signature or body is duplicated here.
-- ---------------------------------------------------------------------------

create function platform_private.seal_registry_execution_grant_review_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform_private
as $$
declare
  v_grant platform_private.registry_execution_grants%rowtype;
  v_operation platform_private.registry_operation_types%rowtype;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_evidence_id_text text;
  v_evidence_id uuid;
  v_case_id uuid;
  v_rationale text;
begin
  select execution_grant.*
  into v_grant
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.id = new.execution_grant_id;

  if not found then
    raise exception using errcode='23503',
      message='Registry execution target lost its exact grant.';
  end if;

  select operation_type.*
  into v_operation
  from platform_private.registry_operation_types operation_type
  where operation_type.operation_key = v_grant.operation_key
    and operation_type.operation_version = v_grant.operation_version;

  if not found then
    raise exception using errcode='23503',
      message='Registry execution grant lost its typed operation definition.';
  end if;

  if not v_operation.requires_human_approval then
    return new;
  end if;

  if v_grant.issued_by_user_id is null
     or v_grant.issued_by_principal_key <> 'user:' || v_grant.issued_by_user_id::text
  then
    raise exception using errcode='42501',
      message='Human-approved Registry operations require a real user issuer.';
  end if;

  v_evidence_id_text := v_grant.plan_payload ->> 'evidence_assertion_id';

  if v_evidence_id_text is null
     or v_evidence_id_text !~
       '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then
    raise exception using errcode='42501',
      message='Human-approved Registry grant lacks an exact evidence assertion reference.';
  end if;

  v_evidence_id := v_evidence_id_text::uuid;

  select evidence.*
  into v_evidence
  from platform_private.registry_evidence_assertions evidence
  where evidence.id = v_evidence_id;

  if not found
     or v_grant.plan_payload ->> 'evidence_assertion_fingerprint'
        is distinct from v_evidence.assertion_fingerprint
     or v_grant.plan_payload ->> 'trust_class'
        is distinct from v_evidence.trust_class
  then
    raise exception using errcode='42501',
      message='Human-approved Registry grant is not bound to immutable evidence authority.';
  end if;

  v_case_id := platform_private.ensure_registry_review_case_v1(
    new.subject_type,
    new.subject_id,
    v_grant.operation_key,
    v_grant.operation_version,
    v_evidence.id
  );

  v_rationale := format(
    'Approved exact Registry grant for %s v%s on %s:%s using evidence %s.',
    v_grant.operation_key,
    v_grant.operation_version,
    new.subject_type,
    new.subject_id,
    v_evidence.id
  );

  perform platform_private.record_registry_review_decision_v1(
    v_case_id,
    'approved',
    v_rationale,
    v_grant.issued_by_principal_key,
    v_grant.id
  );

  return new;
end;
$$;

create trigger registry_execution_grant_target_review_seal
  after insert
  on platform_private.registry_execution_grant_targets
  for each row
  execute function platform_private.seal_registry_execution_grant_review_v1();

-- ---------------------------------------------------------------------------
-- Deferred fail-closed guard. A human-required grant is not valid at commit
-- unless every exact target is represented by one matching effective approved
-- review event. Terminal grants retain their historical approved review even if
-- that review is superseded later.
-- ---------------------------------------------------------------------------

create function platform_private.assert_registry_execution_grant_review_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform_private
as $$
declare
  v_grant platform_private.registry_execution_grants%rowtype;
  v_operation platform_private.registry_operation_types%rowtype;
  v_target_count integer;
  v_valid_review_count integer;
  v_linked_review_count integer;
begin
  select execution_grant.*
  into v_grant
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.id = new.id;

  if not found then
    return null;
  end if;

  select operation_type.*
  into v_operation
  from platform_private.registry_operation_types operation_type
  where operation_type.operation_key = v_grant.operation_key
    and operation_type.operation_version = v_grant.operation_version;

  if not found then
    raise exception using errcode='23503',
      message='Registry execution grant lost its operation definition.';
  end if;

  select count(*)::integer
  into v_target_count
  from platform_private.registry_execution_grant_targets target
  where target.execution_grant_id = v_grant.id;

  select count(*)::integer
  into v_linked_review_count
  from platform_private.registry_review_events review_event
  where review_event.execution_grant_id = v_grant.id;

  if not v_operation.requires_human_approval then
    if v_linked_review_count <> 0 then
      raise exception using errcode='23514',
        message='Non-human Registry operations must not depend on human review authority.';
    end if;
    return null;
  end if;

  if v_target_count < 1 then
    raise exception using errcode='23514',
      message='Human-approved Registry grant has no exact target.';
  end if;

  select count(*)::integer
  into v_valid_review_count
  from platform_private.registry_review_events review_event
  join platform_private.registry_review_cases review_case
    on review_case.id = review_event.review_case_id
  join platform_private.registry_execution_grant_targets target
    on target.execution_grant_id = v_grant.id
   and target.subject_type = review_case.subject_type
   and target.subject_id = review_case.subject_id
  join platform_private.registry_evidence_assertions evidence
    on evidence.id = review_case.evidence_assertion_id
  left join platform_private.registry_review_case_status_v1 review_status
    on review_status.review_case_id = review_case.id
  where review_event.execution_grant_id = v_grant.id
    and review_event.event_type = 'decision'
    and review_event.decision = 'approved'
    and review_case.operation_key = v_grant.operation_key
    and review_case.operation_version = v_grant.operation_version
    and review_event.reviewer_principal_key = v_grant.issued_by_principal_key
    and review_case.evidence_assertion_id::text
        = v_grant.plan_payload ->> 'evidence_assertion_id'
    and evidence.assertion_fingerprint
        = v_grant.plan_payload ->> 'evidence_assertion_fingerprint'
    and evidence.trust_class
        = v_grant.plan_payload ->> 'trust_class'
    and (
      v_grant.status <> 'active'
      or review_status.effective_review_event_id = review_event.id
    );

  if v_valid_review_count <> v_target_count
     or v_linked_review_count <> v_target_count
  then
    raise exception using errcode='23514',
      message='Human-approved Registry grant is missing exact effective review authority for one or more targets.';
  end if;

  return null;
end;
$$;

create constraint trigger registry_execution_grants_review_authority_guard
  after insert or update
  on platform_private.registry_execution_grants
  deferrable initially deferred
  for each row
  execute function platform_private.assert_registry_execution_grant_review_v1();

-- ---------------------------------------------------------------------------
-- Security boundary. Shared review storage is private and cannot become a
-- generic client-side mutation road.
-- ---------------------------------------------------------------------------

revoke all on table
  platform_private.registry_review_cases,
  platform_private.registry_review_events
from public, anon, authenticated, service_role;

revoke all on table
  platform_private.registry_review_case_status_v1
from public, anon, authenticated, service_role;

revoke all on function
  platform_private.reject_registry_review_immutable_mutation_v1(),
  platform_private.ensure_registry_review_case_v1(text,uuid,text,integer,uuid),
  platform_private.record_registry_review_decision_v1(uuid,text,text,text,uuid),
  platform_private.transition_registry_review_case_v1(uuid,text,text,text),
  platform_private.seal_registry_execution_grant_review_v1(),
  platform_private.assert_registry_execution_grant_review_v1()
from public, anon, authenticated, service_role;

commit;
