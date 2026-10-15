-- MIZIZI Headquarters Slice 1 DB05. CLI-minted file 20261010100017_mizizi_license_hold_policy_v1.sql
-- Internal WAKILISHA governance only. No active licence or hold is seeded.
-- No human decision, Registry grant, provider permission or automated mutation is created.
-- Existing Registry grant issuance and mutation-operation admission get a shared hold barrier.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '90s';

do $db05_preflight$
begin
  if to_regclass('mizizi_private.workspaces') is null
     or to_regclass('mizizi_private.cases') is null
     or to_regclass('mizizi_private.plan_versions') is null
     or to_regclass('platform_private.registry_execution_grants') is null
     or to_regclass('platform_private.registry_mutation_operations') is null
     or to_regclass('platform_private.registry_operation_types') is null then
    raise exception 'DB05 STOP: approved DB01-03 or existing Registry gateway absent';
  end if;
  if exists (select 1 from (values
    ('stewardship_licenses'),('license_events'),('write_holds'),
    ('write_hold_events'),('policy_evaluations')) as v(name)
      where to_regclass('mizizi_private.' || v.name) is not null) then
    raise exception 'DB05 STOP: conflicting policy or hold relation exists';
  end if;
  if (select count(*) from mizizi_private.workspaces) <> 1
     or not exists (select 1 from mizizi_private.workspaces
       where workspace_key='wakilisha-internal' and workspace_kind='internal'
       and owner_type='platform' and owner_ref='wakilisha') then
    raise exception 'DB05 STOP: internal-only workspace authority changed';
  end if;
  if to_regprocedure('extensions.digest(text,text)') is null then
    raise exception 'DB05 STOP: audited SHA-256 digest function unavailable';
  end if;
  if exists (select 1 from platform_private.registry_execution_grants where status='active') then
    raise exception 'DB05 STOP: active grant at migration start';
  end if;
end;
$db05_preflight$;

-- A licence is governance eligibility only. It is NEVER an execution grant.
-- Future activation requires a reviewed, separately authorized command.
create table mizizi_private.stewardship_licenses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references mizizi_private.workspaces(id)
    on update restrict on delete restrict,
  license_key text not null unique,
  claim_family_key text not null,
  actor_key text not null references platform_private.system_actors(actor_key)
    on update restrict on delete restrict,
  operation_key text not null,
  operation_version integer not null,
  capability_key text not null,
  policy_version text not null,
  evidence_fingerprint text not null,
  status text not null default 'proposed',
  max_targets integer not null,
  max_rows integer not null,
  valid_from timestamptz not null,
  expires_at timestamptz not null,
  approved_by_user_id uuid references auth.users(id) on update restrict on delete restrict,
  approval_reference text,
  revision integer not null default 1,
  changed_by_actor_key text not null,
  change_reason text not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint wk_db05_license_registry_operation_fk
    foreign key (operation_key,operation_version,capability_key)
    references platform_private.registry_operation_types(operation_key,operation_version,capability_key)
    on update restrict on delete restrict,
  constraint wk_db05_license_key_shape check (license_key ~ '^[A-Za-z0-9][A-Za-z0-9:_./-]{7,159}$'),
  constraint wk_db05_license_family_shape check (claim_family_key ~ '^[a-z][a-z0-9_]{2,99}$'),
  constraint wk_db05_license_policy_version check (char_length(btrim(policy_version)) between 3 and 128),
  constraint wk_db05_license_fingerprint check (evidence_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint wk_db05_license_status check (status in ('proposed','active','suspended','revoked','expired')),
  constraint wk_db05_license_bounds check (max_targets between 1 and 100 and max_rows between 1 and 200
    and expires_at>valid_from and expires_at<=valid_from + interval '30 days'),
  constraint wk_db05_license_approval check (status <> 'active' or
    (approved_by_user_id is not null and nullif(btrim(approval_reference),'') is not null)),
  constraint wk_db05_license_revision check (revision>=1),
  constraint wk_db05_license_actor check (changed_by_actor_key ~ '^(user:[0-9a-f-]{36}|system:[a-z][a-z0-9_]{2,79})$'),
  constraint wk_db05_license_reason check (char_length(btrim(change_reason)) between 12 and 1000)
);
create index wk_db05_licenses_workspace_family on mizizi_private.stewardship_licenses
  (workspace_id,claim_family_key,operation_key,status);

create table mizizi_private.license_events (
  event_seq bigint generated always as identity primary key,
  license_id uuid not null references mizizi_private.stewardship_licenses(id)
    on update restrict on delete restrict,
  revision integer not null,
  event_kind text not null,
  current_status text not null,
  actor_key text not null,
  reason text not null,
  recorded_at timestamptz not null default clock_timestamp(),
  constraint wk_db05_license_events_revision unique(license_id,revision),
  constraint wk_db05_license_events_kind check(event_kind in ('proposed','status_changed')),
  constraint wk_db05_license_events_revision_check check(revision>=1)
);

-- Multiple independently authorized holds may overlap. Releasing one never
-- releases any other hold. Review-after is an alert, NOT an automatic expiry.
create table mizizi_private.write_holds (
  id uuid primary key default gen_random_uuid(),
  hold_key text not null unique,
  scope_kind text not null,
  workspace_id uuid references mizizi_private.workspaces(id)
    on update restrict on delete restrict,
  operation_key text,
  operation_version integer,
  status text not null default 'active',
  security_incident boolean not null default false,
  hold_reason text not null,
  held_by_actor_key text not null,
  held_at timestamptz not null default clock_timestamp(),
  review_after timestamptz,
  released_at timestamptz,
  released_by_actor_key text,
  release_reason text,
  revision integer not null default 1,
  constraint wk_db05_hold_operation_fk foreign key(operation_key,operation_version)
    references platform_private.registry_operation_types(operation_key,operation_version)
    on update restrict on delete restrict,
  constraint wk_db05_hold_key_shape check (hold_key ~ '^[A-Za-z0-9][A-Za-z0-9:_./-]{7,159}$'),
  constraint wk_db05_hold_scope check (
    (scope_kind='global' and workspace_id is null and operation_key is null and operation_version is null)
    or (scope_kind='workspace' and workspace_id is not null and operation_key is null and operation_version is null)
    or (scope_kind='operation' and workspace_id is not null and operation_key is not null and operation_version is not null)
  ),
  constraint wk_db05_hold_status check (status in ('active','released')),
  constraint wk_db05_hold_reason check (char_length(btrim(hold_reason)) between 12 and 2000),
  constraint wk_db05_hold_actor check (held_by_actor_key ~ '^(user:[0-9a-f-]{36}|system:[a-z][a-z0-9_]{2,79})$'),
  constraint wk_db05_hold_review check (review_after is null or review_after>held_at),
  constraint wk_db05_hold_release check (
    (status='active' and released_at is null and released_by_actor_key is null and release_reason is null)
    or (status='released' and released_at is not null and released_at>=held_at
      and released_by_actor_key is not null and release_reason is not null
      and released_by_actor_key ~ '^(user:[0-9a-f-]{36}|system:[a-z][a-z0-9_]{2,79})$'
      and char_length(btrim(release_reason)) between 12 and 1000)
  ),
  constraint wk_db05_hold_revision check (revision>=1)
);
create index wk_db05_write_holds_active_scope on mizizi_private.write_holds
  (scope_kind,workspace_id,operation_key,operation_version)
  where status='active';

create table mizizi_private.write_hold_events (
  event_seq bigint generated always as identity primary key,
  hold_id uuid not null references mizizi_private.write_holds(id)
    on update restrict on delete restrict,
  revision integer not null,
  event_kind text not null,
  actor_key text not null,
  reason text not null,
  security_incident boolean not null,
  recorded_at timestamptz not null default clock_timestamp(),
  constraint wk_db05_hold_events_revision unique(hold_id,revision),
  constraint wk_db05_hold_events_kind check (event_kind in ('hold_started','hold_released')),
  constraint wk_db05_hold_events_revision_check check(revision>=1)
);

-- A policy evaluation records a decision basis, not the decision itself.
create table mizizi_private.policy_evaluations (
  id uuid primary key default gen_random_uuid(),
  evaluation_key text not null unique,
  workspace_id uuid not null references mizizi_private.workspaces(id)
    on update restrict on delete restrict,
  case_id uuid,
  claim_family_key text not null,
  policy_version text not null,
  operation_key text,
  operation_version integer,
  subject_snapshot_fingerprint text not null,
  evaluation_result text not null,
  reason_code text not null,
  explanation text not null,
  evaluated_by_actor_key text not null,
  evaluated_at timestamptz not null default clock_timestamp(),
  constraint wk_db05_policy_case_fk foreign key(workspace_id,case_id)
    references mizizi_private.cases(workspace_id,id) on update restrict on delete restrict,
  constraint wk_db05_policy_operation_fk foreign key(operation_key,operation_version)
    references platform_private.registry_operation_types(operation_key,operation_version)
    on update restrict on delete restrict,
  constraint wk_db05_policy_op_pair check ((operation_key is null) = (operation_version is null)),
  constraint wk_db05_policy_key_shape check (evaluation_key ~ '^[A-Za-z0-9][A-Za-z0-9:_./-]{7,159}$'),
  constraint wk_db05_policy_family_shape check (claim_family_key ~ '^[a-z][a-z0-9_]{2,99}$'),
  constraint wk_db05_policy_version_check check (char_length(btrim(policy_version)) between 3 and 128),
  constraint wk_db05_policy_fingerprint check (subject_snapshot_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint wk_db05_policy_result check (evaluation_result in ('deny','needs_review','eligible_for_planning')),
  constraint wk_db05_policy_reason_code check (reason_code ~ '^[a-z][a-z0-9_]{2,99}$'),
  constraint wk_db05_policy_explanation check (char_length(btrim(explanation)) between 12 and 2000),
  constraint wk_db05_policy_actor check (evaluated_by_actor_key ~ '^(user:[0-9a-f-]{36}|system:[a-z][a-z0-9_]{2,79})$')
);

alter table mizizi_private.stewardship_licenses enable row level security;
alter table mizizi_private.stewardship_licenses force row level security;
alter table mizizi_private.license_events enable row level security;
alter table mizizi_private.license_events force row level security;
alter table mizizi_private.write_holds enable row level security;
alter table mizizi_private.write_holds force row level security;
alter table mizizi_private.write_hold_events enable row level security;
alter table mizizi_private.write_hold_events force row level security;
alter table mizizi_private.policy_evaluations enable row level security;
alter table mizizi_private.policy_evaluations force row level security;
revoke all on table mizizi_private.stewardship_licenses,mizizi_private.license_events,
  mizizi_private.write_holds,mizizi_private.write_hold_events,mizizi_private.policy_evaluations
  from public,anon,authenticated,service_role,mizizi_executor;

-- Shared transaction lock serializes hold changes and new Registry admissions.
-- On an admitted operation, the lock persists to transaction end. Hold activation
-- waits, then fences every subsequent admission; no browser-side race.
create function mizizi_private.assert_registry_admission_not_held_v1(
  p_operation_key text,p_operation_version integer
) returns void language plpgsql volatile security invoker set search_path=pg_catalog
as $db05_admission$
declare internal_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('wakilisha:mizizi:registry-holds:v1',0));
  select w.id into strict internal_id from mizizi_private.workspaces w
   where w.workspace_key='wakilisha-internal'
     and w.workspace_kind='internal' and w.status='active';
  if exists (
    select 1 from mizizi_private.write_holds h where h.status='active'
      and (h.scope_kind='global'
       or (h.workspace_id=internal_id and h.scope_kind='workspace')
       or (h.workspace_id=internal_id and h.scope_kind='operation'
           and h.operation_key=p_operation_key and h.operation_version=p_operation_version))
  ) then
    raise exception 'DB05: Registry write admission held by governance policy' using errcode='42501';
  end if;
end;
$db05_admission$;

create function mizizi_private.guard_write_hold_lifecycle_v1()
returns trigger language plpgsql security invoker set search_path=pg_catalog
as $db05_hold_guard$
begin
 perform pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtextextended('wakilisha:mizizi:registry-holds:v1',0));
 if tg_op='DELETE' then
   raise exception 'DB05 hold deletion prohibited' using errcode='23514';
 end if;
 if tg_op='INSERT' then
   if new.status<>'active' or new.revision<>1 then
     raise exception 'DB05 new hold must begin active at revision one' using errcode='23514';
   end if;
   new.held_at:=clock_timestamp();
 end if;
 if tg_op='UPDATE' then
   if old.status<>'active' or new.status<>'released'
     or new.revision<>old.revision+1
     or (to_jsonb(new)-array['status','revision','released_at','released_by_actor_key','release_reason']::text[])
          is distinct from (to_jsonb(old)-array['status','revision','released_at','released_by_actor_key','release_reason']::text[]) then
     raise exception 'DB05 only one audited hold release transition permitted' using errcode='23514';
   end if;
 end if;
 if new.scope_kind in ('workspace','operation') and not exists (
   select 1 from mizizi_private.workspaces w
     where w.id=new.workspace_id and w.workspace_key='wakilisha-internal'
       and w.workspace_kind='internal' and w.status='active'
 ) then
   raise exception 'DB05 external workspace holds not admitted in Slice 1' using errcode='23514';
 end if;
 return new;
end;
$db05_hold_guard$;
create trigger wk_db05_write_holds_guard
 before insert or update or delete on mizizi_private.write_holds
 for each row execute function mizizi_private.guard_write_hold_lifecycle_v1();

create function mizizi_private.guard_stewardship_license_v1()
returns trigger language plpgsql security invoker set search_path=pg_catalog
as $db05_license_guard$
declare op platform_private.registry_operation_types%rowtype;
begin
 if tg_op='DELETE' then
   raise exception 'DB05 licence deletion prohibited' using errcode='23514';
 end if;
 if tg_op='INSERT' and (new.status<>'proposed' or new.revision<>1) then
   raise exception 'DB05 new licence must begin as proposed' using errcode='23514';
 end if;
 if tg_op='UPDATE' then
   if new.revision<>old.revision+1
     or (to_jsonb(new)-array['revision','status','changed_by_actor_key','change_reason','updated_at']::text[])
       is distinct from (to_jsonb(old)-array['revision','status','changed_by_actor_key','change_reason','updated_at']::text[])
     or not (old.status='proposed' and new.status in ('active','revoked')
       or old.status='active' and new.status in ('suspended','revoked','expired')
       or old.status='suspended' and new.status in ('active','revoked','expired')) then
     raise exception 'DB05 licence identity or status transition invalid' using errcode='23514';
   end if;
   new.updated_at:=clock_timestamp();
 end if;
 if not exists (select 1 from mizizi_private.workspaces w
   where w.id=new.workspace_id and w.workspace_key='wakilisha-internal'
     and w.workspace_kind='internal' and w.status='active') then
   raise exception 'DB05 external workspace licence not admitted in Slice 1' using errcode='23514';
 end if;
 select * into strict op from platform_private.registry_operation_types
  where operation_key=new.operation_key and operation_version=new.operation_version
   and capability_key=new.capability_key;
 if new.max_targets>op.max_targets or new.max_rows>op.max_rows_ceiling then
   raise exception 'DB05 licence exceeds registered Registry ceilings' using errcode='23514';
 end if;
 if new.status='active' and (not op.enabled or new.expires_at<=clock_timestamp()) then
   raise exception 'DB05 disabled/expired operation cannot carry active licence' using errcode='23514';
 end if;
 return new;
end;
$db05_license_guard$;
create trigger wk_db05_licenses_guard
 before insert or update or delete on mizizi_private.stewardship_licenses
 for each row execute function mizizi_private.guard_stewardship_license_v1();

create function mizizi_private.append_db05_history_v1()
returns trigger language plpgsql security invoker set search_path=pg_catalog
as $db05_history$
begin
 if tg_table_name='write_holds' then
   insert into mizizi_private.write_hold_events
     (hold_id,revision,event_kind,actor_key,reason,security_incident)
   values (new.id,new.revision,
     case when tg_op='INSERT' then 'hold_started' else 'hold_released' end,
     case when tg_op='INSERT' then new.held_by_actor_key else new.released_by_actor_key end,
     case when tg_op='INSERT' then new.hold_reason else new.release_reason end,
     new.security_incident);
 elsif tg_table_name='stewardship_licenses' then
   insert into mizizi_private.license_events
     (license_id,revision,event_kind,current_status,actor_key,reason)
   values (new.id,new.revision,
     case when tg_op='INSERT' then 'proposed' else 'status_changed' end,
     new.status,new.changed_by_actor_key,new.change_reason);
 else
   raise exception 'DB05 unrecognized governance journal source' using errcode='23514';
 end if;
 return new;
end;
$db05_history$;
create trigger wk_db05_hold_history
 after insert or update on mizizi_private.write_holds
 for each row execute function mizizi_private.append_db05_history_v1();
create trigger wk_db05_license_history
 after insert or update on mizizi_private.stewardship_licenses
 for each row execute function mizizi_private.append_db05_history_v1();

create function mizizi_private.block_db05_immutable_history_v1()
returns trigger language plpgsql security invoker set search_path=pg_catalog
as $db05_history_guard$
begin
 raise exception 'DB05 governance event/evaluation is immutable' using errcode='23514';
end;
$db05_history_guard$;
create trigger wk_db05_license_events_immutable before update or delete
 on mizizi_private.license_events for each row
 execute function mizizi_private.block_db05_immutable_history_v1();
create trigger wk_db05_hold_events_immutable before update or delete
 on mizizi_private.write_hold_events for each row
 execute function mizizi_private.block_db05_immutable_history_v1();
create trigger wk_db05_policy_evaluations_immutable before update or delete
 on mizizi_private.policy_evaluations for each row
 execute function mizizi_private.block_db05_immutable_history_v1();

-- The existing grant issuance gateway and mutation-operation admission are
-- coupled to the same durable hold predicate. This prevents a stale browser,
-- pending job or old grant from admitting a new Registry write during a hold.
create function mizizi_private.enforce_registry_admission_hold_v1()
returns trigger language plpgsql security invoker set search_path=pg_catalog
as $db05_gateway$
begin
 if tg_table_name='registry_execution_grants' then
   if (tg_op='INSERT' and new.status='active')
     or (tg_op='UPDATE' and new.status='active' and old.status is distinct from new.status) then
     perform mizizi_private.assert_registry_admission_not_held_v1(new.operation_key,new.operation_version);
   end if;
 elsif tg_table_name='registry_mutation_operations' then
   if (tg_op='INSERT' and new.status in ('authorized','executing'))
     or (tg_op='UPDATE' and new.status in ('authorized','executing')
       and old.status is distinct from new.status) then
     perform mizizi_private.assert_registry_admission_not_held_v1(new.operation_key,new.operation_version);
   end if;
 else
   raise exception 'DB05 unexpected gateway table' using errcode='23514';
 end if;
 return new;
end;
$db05_gateway$;
create trigger wk_db05_registry_grant_admission_hold
 before insert or update of status on platform_private.registry_execution_grants
 for each row execute function mizizi_private.enforce_registry_admission_hold_v1();
create trigger wk_db05_registry_operation_admission_hold
 before insert or update of status on platform_private.registry_mutation_operations
 for each row execute function mizizi_private.enforce_registry_admission_hold_v1();

revoke all on function
 mizizi_private.assert_registry_admission_not_held_v1(text,integer),
 mizizi_private.guard_write_hold_lifecycle_v1(),
 mizizi_private.guard_stewardship_license_v1(),
 mizizi_private.append_db05_history_v1(),
 mizizi_private.block_db05_immutable_history_v1(),
 mizizi_private.enforce_registry_admission_hold_v1()
 from public,anon,authenticated,service_role,mizizi_executor;

comment on table mizizi_private.write_holds is
  'Internal-only durable governance holds. No automatic expiry. Active global/workspace/operation hold denies Registry issuance and operation admission at existing DB gateways.';
comment on table mizizi_private.stewardship_licenses is
  'Evidence-bound policy eligibility only. No execution grant or standing actor authority is created by a licence.';
comment on table mizizi_private.policy_evaluations is
  'Immutable decisions about planning eligibility only, never direct canonical mutation authority.';

commit;
