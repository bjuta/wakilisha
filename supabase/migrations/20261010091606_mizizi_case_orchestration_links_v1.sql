-- MIZIZI Headquarters, Slice 1, DB02: durable case orchestration.
-- The canonical filename was minted by Supabase CLI 2.107.0 on the owner's Mac.
-- Case history is orchestration only; Registry reviews/decisions/operations stay authoritative.
-- No public RPC, job queue, grants, human approvals, or canonical Registry mutation.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '90s';

do $db02_preflight$
begin
  if to_regclass('mizizi_private.workspaces') is null
    or to_regclass('mizizi_private.workspace_events') is null
    or to_regclass('mizizi_private.workspace_memberships') is null then
    raise exception 'DB02 stop: accepted DB01 foundation missing';
  end if;
  if to_regclass('mizizi_private.cases') is not null
    or to_regclass('mizizi_private.case_events') is not null
    or to_regclass('mizizi_private.case_dependencies') is not null
    or to_regclass('mizizi_private.case_receipt_links') is not null then
    raise exception 'DB02 stop: case object collision, inspect first';
  end if;
  if to_regclass('platform_private.registry_evidence_assertions') is null
    or to_regclass('platform_private.registry_review_cases') is null
    or to_regclass('platform_private.registry_review_events') is null
    or to_regclass('platform_private.registry_execution_grants') is null
    or to_regclass('platform_private.registry_mutation_operations') is null
    or to_regclass('platform_private.command_receipts') is null
    or to_regclass('platform_private.outbox_events') is null
    or to_regclass('public.registry_review_items') is null
    or to_regclass('public.registry_canonicalization_decisions') is null then
    raise exception 'DB02 stop: an allowlisted authoritative source is missing';
  end if;
end;
$db02_preflight$;

create table mizizi_private.cases (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references mizizi_private.workspaces(id)
    on update restrict on delete restrict,
  case_key text not null,
  subject_type text not null,
  subject_id uuid not null,
  claim_family_key text not null,
  claim_key text not null,
  case_state text not null default 'open',
  current_stage text not null default 'triage',
  epistemic_state text not null default 'unknown',
  mutation_state text not null default 'not_planned',
  publication_state text not null default 'not_requested',
  delivery_state text not null default 'not_requested',
  active_plan_version integer,
  last_observation_fingerprint text,
  policy_ruleset_version text,
  risk_class text not null default 'high',
  next_action_at timestamptz,
  revision integer not null default 1,
  parent_case_id uuid,
  correlation_id uuid not null default gen_random_uuid(),
  transition_actor_key text not null,
  transition_reason text not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint mizizi_cases_workspace_key_unique unique (workspace_id,case_key),
  constraint mizizi_cases_workspace_id_unique unique (workspace_id,id),
  constraint mizizi_cases_case_key_check check (case_key ~ '^[a-zA-Z0-9][a-zA-Z0-9:_./-]{7,199}$'),
  constraint mizizi_cases_subject_type_check check (
    subject_type in ('artist','person','track','recording','release','work','contribution','relationship','rights_claim','chart_entry')
  ),
  constraint mizizi_cases_claim_family_check check (claim_family_key ~ '^[a-z][a-z0-9_]{2,99}$'),
  constraint mizizi_cases_claim_key_check check (char_length(btrim(claim_key)) between 3 and 200),
  constraint mizizi_cases_state_check check (
    case_state in ('open','in_progress','awaiting_review','held','done_for_now','resolved','closed')
  ),
  constraint mizizi_cases_stage_check check (
    current_stage in ('triage','research','human_review','planning','execution','verification','finalization','complete')
  ),
  constraint mizizi_cases_epistemic_check check (
    epistemic_state in ('unknown','disputed','supported','refuted','not_applicable')
  ),
  constraint mizizi_cases_mutation_check check (
    mutation_state in ('not_planned','blocked','ready','in_progress','verified','not_required')
  ),
  constraint mizizi_cases_publication_check check (
    publication_state in ('not_requested','held','eligible','published','withdrawn')
  ),
  constraint mizizi_cases_delivery_check check (
    delivery_state in ('not_requested','held','pending','dispatched','acknowledged','rejected')
  ),
  constraint mizizi_cases_risk_check check (risk_class in ('low','medium','high','critical','prohibited')),
  constraint mizizi_cases_active_plan_check check (active_plan_version is null or active_plan_version >= 1),
  constraint mizizi_cases_revision_check check (revision >= 1),
  constraint mizizi_cases_observation_fingerprint_check check (
    last_observation_fingerprint is null or last_observation_fingerprint ~ '^[0-9a-f]{64}$'
  ),
  constraint mizizi_cases_ruleset_check check (
    policy_ruleset_version is null or char_length(btrim(policy_ruleset_version)) between 3 and 128
  ),
  constraint mizizi_cases_actor_check check (
    transition_actor_key ~ '^(user:[0-9a-f-]{36}|system:[a-z][a-z0-9_]{2,79})$'
  ),
  constraint mizizi_cases_reason_check check (char_length(btrim(transition_reason)) between 12 and 1000),
  constraint mizizi_cases_parent_not_self_check check (parent_case_id is null or parent_case_id <> id),
  constraint mizizi_cases_parent_workspace_fk foreign key (workspace_id,parent_case_id)
    references mizizi_private.cases(workspace_id,id) on update restrict on delete restrict
);

comment on table mizizi_private.cases is
  'Durable governed Core orchestration. Not the Registry, a source-evidence store, or a replacement human-decision ledger.';

create index mizizi_cases_workspace_state_stage_next
  on mizizi_private.cases(workspace_id,case_state,current_stage,next_action_at,id);
create index mizizi_cases_workspace_subject
  on mizizi_private.cases(workspace_id,subject_type,subject_id,claim_family_key);
create index mizizi_cases_parent
  on mizizi_private.cases(workspace_id,parent_case_id) where parent_case_id is not null;

create table mizizi_private.case_events (
  event_seq bigint generated always as identity primary key,
  event_id uuid not null default gen_random_uuid() unique,
  event_key text not null unique,
  workspace_id uuid not null,
  case_id uuid not null,
  case_revision integer not null,
  event_type text not null,
  actor_key text not null,
  reason text not null,
  correlation_id uuid not null,
  previous_case_state text,
  resulting_case_state text not null,
  previous_stage text,
  resulting_stage text not null,
  previous_epistemic_state text,
  resulting_epistemic_state text not null,
  previous_mutation_state text,
  resulting_mutation_state text not null,
  previous_publication_state text,
  resulting_publication_state text not null,
  previous_delivery_state text,
  resulting_delivery_state text not null,
  recorded_at timestamptz not null default clock_timestamp(),
  constraint mizizi_case_events_case_fk foreign key (workspace_id,case_id)
    references mizizi_private.cases(workspace_id,id) on update restrict on delete restrict,
  constraint mizizi_case_events_case_revision_unique unique (case_id,case_revision),
  constraint mizizi_case_events_revision_check check (case_revision >= 1),
  constraint mizizi_case_events_kind_check check (event_type in ('case_created','case_state_changed')),
  constraint mizizi_case_events_creation_check check (
    (event_type='case_created' and case_revision=1 and previous_case_state is null and previous_stage is null)
    or (event_type='case_state_changed' and case_revision>1 and previous_case_state is not null and previous_stage is not null)
  ),
  constraint mizizi_case_events_reason_check check (char_length(btrim(reason)) between 12 and 1000),
  constraint mizizi_case_events_actor_check check (
    actor_key ~ '^(user:[0-9a-f-]{36}|system:[a-z][a-z0-9_]{2,79})$'
  )
);

comment on table mizizi_private.case_events is
  'Immutable case workflow state journal. Do not store a human decision or Registry mutation result as an independently accepted fact here.';

create index mizizi_case_events_workspace_timeline
  on mizizi_private.case_events(workspace_id,event_seq desc);

create table mizizi_private.case_dependencies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  case_id uuid not null,
  depends_on_case_id uuid not null,
  dependency_kind text not null default 'requires',
  dependency_key text not null,
  added_by_actor_key text not null,
  reason text not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint mizizi_case_dependencies_source_fk foreign key (workspace_id,case_id)
    references mizizi_private.cases(workspace_id,id) on update restrict on delete restrict,
  constraint mizizi_case_dependencies_target_fk foreign key (workspace_id,depends_on_case_id)
    references mizizi_private.cases(workspace_id,id) on update restrict on delete restrict,
  constraint mizizi_case_dependencies_no_self check (case_id <> depends_on_case_id),
  constraint mizizi_case_dependencies_kind_check check (dependency_kind = 'requires'),
  constraint mizizi_case_dependencies_key_check check (
    char_length(btrim(dependency_key)) between 8 and 200
  ),
  constraint mizizi_case_dependencies_reason_check check (char_length(btrim(reason)) between 12 and 1000),
  constraint mizizi_case_dependencies_actor_check check (
    added_by_actor_key ~ '^(user:[0-9a-f-]{36}|system:[a-z][a-z0-9_]{2,79})$'
  ),
  constraint mizizi_case_dependencies_edge_unique unique (workspace_id,case_id,depends_on_case_id),
  constraint mizizi_case_dependencies_key_unique unique (workspace_id,dependency_key)
);

create index mizizi_case_dependencies_referenced_lookup
  on mizizi_private.case_dependencies(workspace_id,depends_on_case_id);

comment on table mizizi_private.case_dependencies is
  'Immutable case dependency DAG. Cycle tests serialize per workspace; future reviewed commands must govern any edge retirement.';

create table mizizi_private.case_receipt_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  case_id uuid not null,
  relation_type text not null,
  authority_schema text not null,
  authority_object_type text not null,
  authority_id uuid not null,
  authority_fingerprint text not null,
  linked_by_actor_key text not null,
  link_reason text not null,
  linked_at timestamptz not null default clock_timestamp(),
  constraint mizizi_case_receipt_links_case_fk foreign key (workspace_id,case_id)
    references mizizi_private.cases(workspace_id,id) on update restrict on delete restrict,
  constraint mizizi_case_receipt_links_unique unique
    (case_id,relation_type,authority_schema,authority_object_type,authority_id),
  constraint mizizi_case_receipt_links_pair_check check (
    (relation_type='evidence' and authority_schema='platform_private' and authority_object_type='registry_evidence_assertions')
    or (relation_type='review_case' and authority_schema='platform_private' and authority_object_type='registry_review_cases')
    or (relation_type='review_event' and authority_schema='platform_private' and authority_object_type='registry_review_events')
    or (relation_type='review_item' and authority_schema='public' and authority_object_type='registry_review_items')
    or (relation_type='human_decision' and authority_schema='public' and authority_object_type='registry_canonicalization_decisions')
    or (relation_type='execution_grant' and authority_schema='platform_private' and authority_object_type='registry_execution_grants')
    or (relation_type='mutation_operation' and authority_schema='platform_private' and authority_object_type='registry_mutation_operations')
    or (relation_type='command_receipt' and authority_schema='platform_private' and authority_object_type='command_receipts')
    or (relation_type='outbox_event' and authority_schema='platform_private' and authority_object_type='outbox_events')
  ),
  constraint mizizi_case_receipt_links_hash_check check (authority_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint mizizi_case_receipt_links_reason_check check (char_length(btrim(link_reason)) between 12 and 1000),
  constraint mizizi_case_receipt_links_actor_check check (
    linked_by_actor_key ~ '^(user:[0-9a-f-]{36}|system:[a-z][a-z0-9_]{2,79})$'
  )
);

create index mizizi_case_receipt_links_authority_lookup
  on mizizi_private.case_receipt_links(authority_schema,authority_object_type,authority_id);

comment on table mizizi_private.case_receipt_links is
  'Append-only typed and existence-checked pointers to existing authoritative receipt IDs; no payload replication or second decision ledger.';

-- Private tables are deliberately not Data API enabled; future reviewed typed commands own writes.
alter table mizizi_private.cases enable row level security;
alter table mizizi_private.cases force row level security;
alter table mizizi_private.case_events enable row level security;
alter table mizizi_private.case_events force row level security;
alter table mizizi_private.case_dependencies enable row level security;
alter table mizizi_private.case_dependencies force row level security;
alter table mizizi_private.case_receipt_links enable row level security;
alter table mizizi_private.case_receipt_links force row level security;

revoke all on table
  mizizi_private.cases,
  mizizi_private.case_events,
  mizizi_private.case_dependencies,
  mizizi_private.case_receipt_links
  from public,anon,authenticated,service_role,mizizi_executor;
revoke all on sequence mizizi_private.case_events_event_seq_seq
  from public,anon,authenticated,service_role,mizizi_executor;

create function mizizi_private.guard_case_revision_v1()
returns trigger language plpgsql security invoker
set search_path = pg_catalog
as $guard_case_revision$
begin
  if tg_op='DELETE' then
    raise exception 'MIZIZI cases cannot be deleted' using errcode='23514';
  end if;
  if tg_op='UPDATE' then
    if new.id is distinct from old.id
      or new.workspace_id is distinct from old.workspace_id
      or new.case_key is distinct from old.case_key
      or new.subject_type is distinct from old.subject_type
      or new.subject_id is distinct from old.subject_id
      or new.claim_family_key is distinct from old.claim_family_key
      or new.claim_key is distinct from old.claim_key
      or new.parent_case_id is distinct from old.parent_case_id
      or new.correlation_id is distinct from old.correlation_id
      or new.created_at is distinct from old.created_at
      or new.revision <> old.revision + 1 then
      raise exception 'MIZIZI immutable binding or stale case revision' using errcode='23514';
    end if;
    if (new.case_state,new.current_stage,new.epistemic_state,new.mutation_state,
      new.publication_state,new.delivery_state,new.active_plan_version,
      new.last_observation_fingerprint,new.policy_ruleset_version,new.risk_class,new.next_action_at)
      is not distinct from
      (old.case_state,old.current_stage,old.epistemic_state,old.mutation_state,
      old.publication_state,old.delivery_state,old.active_plan_version,
      old.last_observation_fingerprint,old.policy_ruleset_version,old.risk_class,old.next_action_at) then
      raise exception 'MIZIZI case revision requires a real state change' using errcode='23514';
    end if;
    new.updated_at := clock_timestamp();
  end if;
  return new;
end;
$guard_case_revision$;

create trigger mizizi_case_revision_guard
  before update or delete on mizizi_private.cases
  for each row execute function mizizi_private.guard_case_revision_v1();

create function mizizi_private.journal_case_revision_v1()
returns trigger language plpgsql security invoker
set search_path = pg_catalog
as $journal_case_revision$
declare
  v_prev_case_state text;
  v_prev_stage text;
  v_prev_epistemic text;
  v_prev_mutation text;
  v_prev_publication text;
  v_prev_delivery text;
begin
  -- OLD is undefined on INSERT; bind only initialized scalar values to SQL.
  if tg_op='UPDATE' then
    v_prev_case_state := old.case_state;
    v_prev_stage := old.current_stage;
    v_prev_epistemic := old.epistemic_state;
    v_prev_mutation := old.mutation_state;
    v_prev_publication := old.publication_state;
    v_prev_delivery := old.delivery_state;
  end if;
  insert into mizizi_private.case_events (
    event_key,workspace_id,case_id,case_revision,event_type,actor_key,reason,correlation_id,
    previous_case_state,resulting_case_state,previous_stage,resulting_stage,
    previous_epistemic_state,resulting_epistemic_state,previous_mutation_state,resulting_mutation_state,
    previous_publication_state,resulting_publication_state,previous_delivery_state,resulting_delivery_state
  ) values (
    'case:'||new.id::text||':revision:'||new.revision::text,
    new.workspace_id,new.id,new.revision,
    case when tg_op='INSERT' then 'case_created' else 'case_state_changed' end,
    new.transition_actor_key,new.transition_reason,new.correlation_id,
    v_prev_case_state,new.case_state,
    v_prev_stage,new.current_stage,
    v_prev_epistemic,new.epistemic_state,
    v_prev_mutation,new.mutation_state,
    v_prev_publication,new.publication_state,
    v_prev_delivery,new.delivery_state
  );
  return null;
end;
$journal_case_revision$;

create trigger mizizi_cases_journal
  after insert or update on mizizi_private.cases
  for each row execute function mizizi_private.journal_case_revision_v1();

create function mizizi_private.block_case_history_mutation_v1()
returns trigger language plpgsql security invoker
set search_path = pg_catalog
as $block_case_history_mutation$
begin
  raise exception 'MIZIZI case evidence and links are append-only' using errcode='23514';
end;
$block_case_history_mutation$;

create trigger mizizi_case_events_immutable
  before update or delete on mizizi_private.case_events
  for each row execute function mizizi_private.block_case_history_mutation_v1();
create trigger mizizi_case_dependencies_immutable
  before update or delete on mizizi_private.case_dependencies
  for each row execute function mizizi_private.block_case_history_mutation_v1();
create trigger mizizi_case_receipt_links_immutable
  before update or delete on mizizi_private.case_receipt_links
  for each row execute function mizizi_private.block_case_history_mutation_v1();

create function mizizi_private.prevent_case_dependency_cycle_v1()
returns trigger language plpgsql security invoker
set search_path = pg_catalog
as $prevent_case_dependency_cycle$
begin
  -- Serialize dependency-edge admissions for this workspace, including concurrent reverse edges.
  perform 1 from mizizi_private.workspaces where id=new.workspace_id for update;
  if not found then
    raise exception 'MIZIZI case dependency workspace absent' using errcode='23503';
  end if;
  if exists (
    with recursive walk(case_id) as (
      select new.depends_on_case_id
      union
      select d.depends_on_case_id
      from mizizi_private.case_dependencies d
      join walk w on w.case_id=d.case_id
      where d.workspace_id=new.workspace_id
    )
    select 1 from walk where case_id=new.case_id
  ) then
    raise exception 'MIZIZI case dependency cycle blocked' using errcode='23514';
  end if;
  return new;
end;
$prevent_case_dependency_cycle$;

create trigger mizizi_case_dependency_cycle_guard
  before insert on mizizi_private.case_dependencies
  for each row execute function mizizi_private.prevent_case_dependency_cycle_v1();

create function mizizi_private.assert_case_receipt_authority_v1()
returns trigger language plpgsql security invoker
set search_path = pg_catalog
as $assert_case_receipt_authority$
declare v_found boolean := false;
begin
  -- Fixed allowlist; no caller-chosen table identifiers or dynamic SQL.
  if new.relation_type='evidence' then
    select exists(select 1 from platform_private.registry_evidence_assertions where id=new.authority_id) into v_found;
  elsif new.relation_type='review_case' then
    select exists(select 1 from platform_private.registry_review_cases where id=new.authority_id) into v_found;
  elsif new.relation_type='review_event' then
    select exists(select 1 from platform_private.registry_review_events where id=new.authority_id) into v_found;
  elsif new.relation_type='review_item' then
    select exists(select 1 from public.registry_review_items where id=new.authority_id) into v_found;
  elsif new.relation_type='human_decision' then
    select exists(select 1 from public.registry_canonicalization_decisions where id=new.authority_id) into v_found;
  elsif new.relation_type='execution_grant' then
    select exists(select 1 from platform_private.registry_execution_grants where id=new.authority_id) into v_found;
  elsif new.relation_type='mutation_operation' then
    select exists(select 1 from platform_private.registry_mutation_operations where id=new.authority_id) into v_found;
  elsif new.relation_type='command_receipt' then
    select exists(select 1 from platform_private.command_receipts where id=new.authority_id) into v_found;
  elsif new.relation_type='outbox_event' then
    select exists(select 1 from platform_private.outbox_events where id=new.authority_id) into v_found;
  end if;
  if not v_found then
    raise exception 'MIZIZI case receipt link lacks existing typed authority' using errcode='23503';
  end if;
  return new;
end;
$assert_case_receipt_authority$;

create trigger mizizi_case_receipt_link_authority_guard
  before insert on mizizi_private.case_receipt_links
  for each row execute function mizizi_private.assert_case_receipt_authority_v1();

revoke all on function
  mizizi_private.guard_case_revision_v1(),
  mizizi_private.journal_case_revision_v1(),
  mizizi_private.block_case_history_mutation_v1(),
  mizizi_private.prevent_case_dependency_cycle_v1(),
  mizizi_private.assert_case_receipt_authority_v1()
  from public,anon,authenticated,service_role,mizizi_executor;

commit;
