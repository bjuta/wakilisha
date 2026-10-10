-- MIZIZI Headquarters Slice 1 DB03: expected-state snapshots and frozen case plans.
-- CLI-minted canonical filename: 20261010093509_mizizi_case_plan_snapshot_v1.sql
-- No job queue, direct Registry writes, human-decision duplication or standing grants.
begin;
set local lock_timeout='5s';
set local statement_timeout='90s';

do $db03_preflight$
begin
  if to_regclass('mizizi_private.cases') is null
     or to_regclass('mizizi_private.case_events') is null
     or to_regclass('platform_private.jobs') is null
     or to_regclass('platform_private.command_receipts') is null then
    raise exception 'DB03 STOP: DB02 or shared typed-command authority missing';
  end if;
  if to_regclass('mizizi_private.case_snapshots') is not null
     or to_regclass('mizizi_private.plan_versions') is not null
     or to_regclass('mizizi_private.stage_leases') is not null then
    raise exception 'DB03 STOP: prior object or parallel queue collision';
  end if;
  if to_regprocedure('extensions.digest(text,text)') is null then
    raise exception 'DB03 STOP: audited SHA-256 digest function missing';
  end if;
end;
$db03_preflight$;

create table mizizi_private.case_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  case_id uuid not null,
  expected_case_revision integer not null,
  subject_type text not null,
  subject_id uuid not null,
  expected_case_state text not null,
  expected_stage text not null,
  expected_epistemic_state text not null,
  expected_observation_fingerprint text,
  expected_policy_ruleset_version text,
  snapshot_fingerprint text not null,
  frozen_by_actor_key text not null,
  freeze_reason text not null,
  frozen_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  constraint mizizi_case_snapshots_case_fk foreign key(workspace_id,case_id)
    references mizizi_private.cases(workspace_id,id) on update restrict on delete restrict,
  constraint mizizi_case_snapshots_scope_id_unique unique (workspace_id,case_id,id),
  constraint mizizi_case_snapshots_revision_positive check (expected_case_revision>=1),
  constraint mizizi_case_snapshots_fingerprint_shape check (snapshot_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint mizizi_case_snapshots_observation_shape check (expected_observation_fingerprint is null or expected_observation_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint mizizi_case_snapshots_actor_shape check (frozen_by_actor_key ~ '^(user:[0-9a-f-]{36}|system:[a-z][a-z0-9_]{2,79})$'),
  constraint mizizi_case_snapshots_reason_length check (char_length(btrim(freeze_reason)) between 12 and 1000),
  constraint mizizi_case_snapshots_expiry_bound check (expires_at > frozen_at and expires_at <= frozen_at + interval '30 days')
);

comment on table mizizi_private.case_snapshots is
  'Immutable, server-fingerprinted case precondition snapshot; NOT a copy of canonical Registry evidence or human decisions.';
create index mizizi_case_snapshots_case_revision
  on mizizi_private.case_snapshots(workspace_id,case_id,expected_case_revision,frozen_at desc);

create table mizizi_private.plan_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  case_id uuid not null,
  plan_version integer not null,
  plan_key text not null,
  snapshot_id uuid not null,
  plan_status text not null default 'frozen',
  operation_key text not null,
  operation_version integer not null,
  required_verifier_key text not null,
  ruleset_version text not null,
  model_version text,
  policy_version text not null,
  target_contract_version text not null default 'typed_targets_v1',
  targets jsonb not null,
  max_target_rows integer not null,
  plan_fingerprint text not null,
  frozen_by_actor_key text not null,
  freeze_reason text not null,
  frozen_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  constraint mizizi_plan_versions_operation_fk foreign key(operation_key,operation_version)
    references platform_private.registry_operation_types(operation_key,operation_version)
    on update restrict on delete restrict,
  constraint mizizi_plan_versions_case_fk foreign key(workspace_id,case_id)
    references mizizi_private.cases(workspace_id,id) on update restrict on delete restrict,
  constraint mizizi_plan_versions_snapshot_fk foreign key(workspace_id,case_id,snapshot_id)
    references mizizi_private.case_snapshots(workspace_id,case_id,id) on update restrict on delete restrict,
  constraint mizizi_plan_versions_scope_version_unique unique (workspace_id,case_id,plan_version),
  constraint mizizi_plan_versions_scope_id_unique unique (workspace_id,case_id,id),
  constraint mizizi_plan_versions_workspace_key_unique unique (workspace_id,plan_key),
  constraint mizizi_plan_versions_one_plan_per_snapshot unique (snapshot_id),
  constraint mizizi_plan_versions_positive check (plan_version>=1 and operation_version>=1),
  constraint mizizi_plan_versions_state check (plan_status='frozen'),
  constraint mizizi_plan_versions_plan_key check (plan_key ~ '^[a-zA-Z0-9][a-zA-Z0-9:_./-]{7,199}$'),
  constraint mizizi_plan_versions_operation_key check (operation_key ~ '^[a-z][a-z0-9._/-]{5,127}$'),
  constraint mizizi_plan_versions_verifier_key check (required_verifier_key ~ '^[a-z][a-z0-9._/-]{5,127}$'),
  constraint mizizi_plan_versions_version_labels check (
    char_length(btrim(ruleset_version)) between 3 and 128
    and char_length(btrim(policy_version)) between 3 and 128
    and (model_version is null or char_length(btrim(model_version)) between 3 and 128)),
  constraint mizizi_plan_versions_target_contract check (target_contract_version='typed_targets_v1'),
  constraint mizizi_plan_versions_targets_shape check (jsonb_typeof(targets)='array' and jsonb_array_length(targets) between 1 and 24),
  constraint mizizi_plan_versions_row_ceiling check (max_target_rows between 1 and 200),
  constraint mizizi_plan_versions_fingerprint_shape check (plan_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint mizizi_plan_versions_actor_check check (frozen_by_actor_key ~ '^(user:[0-9a-f-]{36}|system:[a-z][a-z0-9_]{2,79})$'),
  constraint mizizi_plan_versions_reason_check check (char_length(btrim(freeze_reason)) between 12 and 1000),
  constraint mizizi_plan_versions_expiry_bound check (expires_at > frozen_at and expires_at <= frozen_at+interval '7 days')
);

comment on table mizizi_private.plan_versions is
  'Immutable frozen proposal, NOT a Registry execution grant; targets are strictly shape-validated and contain no credentials or grants. Admission must recheck snapshot, policy/hold and receipt authority.';
create index mizizi_plan_versions_case_latest
  on mizizi_private.plan_versions(workspace_id,case_id,plan_version desc);
create index mizizi_plan_versions_expiration
  on mizizi_private.plan_versions(expires_at) where plan_status='frozen';

-- Existing cases have nullable active_plan_version; bind nonnull pointers to a real frozen plan.
alter table mizizi_private.cases
  add constraint mizizi_cases_active_plan_version_fk
  foreign key (workspace_id,id,active_plan_version)
  references mizizi_private.plan_versions (workspace_id,case_id,plan_version)
  on update restrict on delete restrict;

alter table mizizi_private.case_snapshots enable row level security;
alter table mizizi_private.case_snapshots force row level security;
alter table mizizi_private.plan_versions enable row level security;
alter table mizizi_private.plan_versions force row level security;
revoke all on table mizizi_private.case_snapshots,mizizi_private.plan_versions
  from public,anon,authenticated,service_role,mizizi_executor;

-- Database-owned exact snapshot freeze. The caller does not supply subject or hash.
create function mizizi_private.freeze_case_snapshot_v1()
returns trigger language plpgsql security invoker set search_path=pg_catalog
as $db03_snapshot$
declare c mizizi_private.cases%rowtype;
begin
  select * into strict c from mizizi_private.cases
    where workspace_id=new.workspace_id and id=new.case_id for update;
  if c.revision<>new.expected_case_revision then
    raise exception 'DB03 stale case revision snapshot' using errcode='23514';
  end if;
  if c.case_state in ('closed','resolved') then
    raise exception 'DB03 cannot freeze terminal case' using errcode='23514';
  end if;
  new.subject_type:=c.subject_type;
  new.subject_id:=c.subject_id;
  new.expected_case_state:=c.case_state;
  new.expected_stage:=c.current_stage;
  new.expected_epistemic_state:=c.epistemic_state;
  new.expected_observation_fingerprint:=c.last_observation_fingerprint;
  new.expected_policy_ruleset_version:=c.policy_ruleset_version;
  new.frozen_at:=clock_timestamp();
  new.snapshot_fingerprint:=encode(extensions.digest(
    concat_ws('|','mizizi-snapshot-v1',new.workspace_id::text,new.case_id::text,
      new.expected_case_revision::text,new.subject_type,new.subject_id::text,
      new.expected_case_state,new.expected_stage,new.expected_epistemic_state,
      coalesce(new.expected_observation_fingerprint,'none'),
      coalesce(new.expected_policy_ruleset_version,'none')),'sha256'),'hex');
  return new;
end;
$db03_snapshot$;
create trigger mizizi_freeze_case_snapshot
 before insert on mizizi_private.case_snapshots
 for each row execute function mizizi_private.freeze_case_snapshot_v1();

create function mizizi_private.assert_frozen_plan_v1()
returns trigger language plpgsql security invoker set search_path=pg_catalog
as $db03_plan$
declare
 c mizizi_private.cases%rowtype;
 s mizizi_private.case_snapshots%rowtype;
 o platform_private.registry_operation_types%rowtype;
 t jsonb;
 sum_rows integer:=0;
 next_version integer;
begin
 select * into strict c from mizizi_private.cases
  where workspace_id=new.workspace_id and id=new.case_id for update;
 select * into strict s from mizizi_private.case_snapshots
  where workspace_id=new.workspace_id and case_id=new.case_id and id=new.snapshot_id;
 if s.expected_case_revision<>c.revision
    or s.subject_type<>c.subject_type or s.subject_id<>c.subject_id
    or s.expected_case_state<>c.case_state or s.expected_stage<>c.current_stage
    or s.expected_epistemic_state<>c.epistemic_state
    or s.expected_observation_fingerprint is distinct from c.last_observation_fingerprint
    or s.expected_policy_ruleset_version is distinct from c.policy_ruleset_version
    or s.expires_at<=clock_timestamp() then
   raise exception 'DB03 snapshot precondition stale or expired' using errcode='23514';
 end if;
 select * into strict o from platform_private.registry_operation_types
  where operation_key=new.operation_key and operation_version=new.operation_version;
 if new.max_target_rows>o.max_rows_ceiling
   or jsonb_array_length(new.targets)>o.max_targets then
   raise exception 'DB03 plan exceeds Registry operation ceiling' using errcode='23514';
 end if;
 if new.expires_at>s.expires_at then
   raise exception 'DB03 plan expiry exceeds snapshot validity' using errcode='23514';
 end if;
 select coalesce(max(plan_version),0)+1 into next_version
   from mizizi_private.plan_versions where workspace_id=new.workspace_id and case_id=new.case_id;
 if new.plan_version<>next_version then
   raise exception 'DB03 plan version must advance exactly once' using errcode='23514';
 end if;
 -- Strict 4-key target objects. Reject any extra keys, including grants, secrets or commands.
 for t in select value from jsonb_array_elements(new.targets) loop
   if jsonb_typeof(t)<>'object' or t-'target_type'-'target_id'-'expected_fingerprint'-'max_rows'<>'{}'::jsonb
      or not (t ?& array['target_type','target_id','expected_fingerprint','max_rows']) then
     raise exception 'DB03 forbidden target object or grant payload' using errcode='23514';
   end if;
   if jsonb_typeof(t->'target_type')<>'string'
      or not ((t->>'target_type') = any(o.allowed_subject_types))
      or jsonb_typeof(t->'target_id')<>'string'
      or (t->>'target_id') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or jsonb_typeof(t->'expected_fingerprint')<>'string'
      or (t->>'expected_fingerprint') !~ '^[0-9a-f]{64}$'
      or jsonb_typeof(t->'max_rows')<>'number'
      or (t->>'max_rows') !~ '^[0-9]{1,3}$'
      or (t->>'max_rows')::integer not between 1 and 100 then
     raise exception 'DB03 invalid typed target' using errcode='23514';
   end if;
   sum_rows:=sum_rows+(t->>'max_rows')::integer;
 end loop;
 if sum_rows>new.max_target_rows then
   raise exception 'DB03 target row sum exceeds plan ceiling' using errcode='23514';
 end if;
 new.frozen_at:=clock_timestamp();
 new.plan_fingerprint:=encode(extensions.digest(
   concat_ws('|','mizizi-plan-v1',new.workspace_id::text,new.case_id::text,
      new.plan_version::text,new.plan_key,new.snapshot_id::text,s.snapshot_fingerprint,
      new.plan_status,new.operation_key,new.operation_version::text,new.required_verifier_key,
      new.ruleset_version,coalesce(new.model_version,'none'),new.policy_version,
      new.target_contract_version,new.targets::text,new.max_target_rows::text,
      new.expires_at::text),'sha256'),'hex');
 return new;
end;
$db03_plan$;
create trigger mizizi_assert_frozen_plan
 before insert on mizizi_private.plan_versions
 for each row execute function mizizi_private.assert_frozen_plan_v1();

-- Both snapshot and plan are append-only including owner/expiry, even for migration owner.
create function mizizi_private.block_frozen_plan_change_v1()
returns trigger language plpgsql security invoker set search_path=pg_catalog
as $db03_immutable$
begin
 raise exception 'DB03 frozen plan and snapshot immutable' using errcode='23514';
end;
$db03_immutable$;
create trigger mizizi_case_snapshots_immutable
 before update or delete on mizizi_private.case_snapshots
 for each row execute function mizizi_private.block_frozen_plan_change_v1();
create trigger mizizi_plan_versions_immutable
 before update or delete on mizizi_private.plan_versions
 for each row execute function mizizi_private.block_frozen_plan_change_v1();

revoke all on function
 mizizi_private.freeze_case_snapshot_v1(),
 mizizi_private.assert_frozen_plan_v1(),
 mizizi_private.block_frozen_plan_change_v1()
 from public,anon,authenticated,service_role,mizizi_executor;

commit;
