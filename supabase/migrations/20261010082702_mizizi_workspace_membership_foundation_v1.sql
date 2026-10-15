-- MIZIZI Headquarters, Slice 1, DB01.
-- Canonical migration path was minted by Supabase CLI 2.107.0 on the owner's Mac.
-- This is an internal-only, non-canonical workspace / membership authority.
-- No public or service-role table grants, Registry writes, or external tenants.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '90s';

do $mizizi_db01_preflight$
begin
  if to_regnamespace('mizizi_private') is null then
    raise exception 'DB01 stop: the existing mizizi_private schema is absent';
  end if;

  if to_regclass('auth.users') is null then
    raise exception 'DB01 stop: auth.users is absent';
  end if;

  if to_regclass('mizizi_private.workspaces') is not null
    or to_regclass('mizizi_private.workspace_memberships') is not null
    or to_regclass('mizizi_private.workspace_events') is not null then
    raise exception 'DB01 stop: workspace objects already exist; inspect authority first';
  end if;
end;
$mizizi_db01_preflight$;

create table mizizi_private.workspaces (
  id uuid primary key default gen_random_uuid(),
  workspace_key text not null unique,
  workspace_kind text not null default 'internal',
  owner_type text not null default 'platform',
  owner_ref text not null default 'wakilisha',
  display_name text not null,
  status text not null default 'active',
  retention_policy_key text not null default 'pending_policy_review',
  created_at timestamptz not null default clock_timestamp(),
  constraint mizizi_workspaces_internal_only_check check (
    workspace_key = 'wakilisha-internal'
    and workspace_kind = 'internal'
    and owner_type = 'platform'
    and owner_ref = 'wakilisha'
    and status = 'active'
  ),
  constraint mizizi_workspaces_name_check check (
    char_length(btrim(display_name)) between 1 and 120
  ),
  constraint mizizi_workspaces_retention_key_check check (
    retention_policy_key ~ '^[a-z][a-z0-9_]{2,79}$'
  )
);

comment on table mizizi_private.workspaces is
  'MIZIZI orchestration tenancy only. DB01 permits one WAKILISHA internal workspace, never canonical Registry identity.';

create table mizizi_private.workspace_memberships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references mizizi_private.workspaces(id)
    on update restrict on delete restrict,
  user_id uuid not null references auth.users(id)
    on update restrict on delete restrict,
  member_role text not null,
  grant_source text not null,
  valid_from timestamptz not null default clock_timestamp(),
  valid_until timestamptz,
  revoked_at timestamptz,
  revision integer not null default 1,
  granted_by uuid not null references auth.users(id)
    on update restrict on delete restrict,
  last_changed_by uuid not null references auth.users(id)
    on update restrict on delete restrict,
  change_reason text not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint mizizi_workspace_memberships_role_check check (
    member_role in ('reader', 'reviewer', 'steward', 'owner')
  ),
  constraint mizizi_workspace_memberships_source_check check (
    grant_source in ('operator_review', 'internal_bootstrap')
  ),
  constraint mizizi_workspace_memberships_valid_until_check check (
    valid_until is null or valid_until > valid_from
  ),
  constraint mizizi_workspace_memberships_revision_check check (revision >= 1),
  constraint mizizi_workspace_memberships_reason_check check (
    char_length(btrim(change_reason)) between 12 and 1000
  ),
  constraint mizizi_workspace_memberships_start_unique unique (
    workspace_id, user_id, valid_from
  )
);

-- Requires explicit revocation before re-granting a membership.
-- An expired but unrevoked row does not silently authorize re-enrollment.
create unique index mizizi_workspace_memberships_unrevoked_unique
  on mizizi_private.workspace_memberships(workspace_id, user_id)
  where revoked_at is null;

create index mizizi_workspace_memberships_user_lookup
  on mizizi_private.workspace_memberships(user_id, workspace_id, revoked_at);

comment on table mizizi_private.workspace_memberships is
  'Operator workspace roles. Membership never confers Registry mutation authority. Use a future typed reviewed command, never direct client DML.';

create table mizizi_private.workspace_events (
  event_seq bigint generated always as identity primary key,
  event_id uuid not null default gen_random_uuid() unique,
  event_key text not null unique,
  workspace_id uuid not null references mizizi_private.workspaces(id)
    on update restrict on delete restrict,
  membership_id uuid,
  subject_user_id uuid,
  event_type text not null,
  actor_key text not null,
  membership_revision integer,
  previous_role text,
  resulting_role text,
  membership_valid_from timestamptz,
  membership_valid_until timestamptz,
  membership_revoked_at timestamptz,
  reason text not null,
  recorded_at timestamptz not null default clock_timestamp(),
  constraint mizizi_workspace_events_kind_check check (
    event_type in (
      'workspace_created',
      'membership_granted',
      'membership_changed',
      'membership_revoked'
    )
  ),
  constraint mizizi_workspace_events_actor_check check (
    actor_key ~ '^(user:[0-9a-f-]{36}|system:[a-z][a-z0-9_]{2,79})$'
  ),
  constraint mizizi_workspace_events_revision_check check (
    (event_type = 'workspace_created'
      and membership_id is null
      and subject_user_id is null
      and membership_revision is null)
    or
    (event_type <> 'workspace_created'
      and membership_id is not null
      and subject_user_id is not null
      and membership_revision >= 1)
  ),
  constraint mizizi_workspace_events_reason_check check (
    char_length(btrim(reason)) between 12 and 1000
  )
);

create unique index mizizi_workspace_events_membership_revision_unique
  on mizizi_private.workspace_events(membership_id, membership_revision)
  where membership_id is not null;

create index mizizi_workspace_events_workspace_timeline
  on mizizi_private.workspace_events(workspace_id, event_seq desc);

comment on table mizizi_private.workspace_events is
  'Append-only workspace and membership audit. Identity references are not a second Registry or human decision ledger.';

-- The private schema is already protected. DB01 introduces no Data API table access.
alter table mizizi_private.workspaces enable row level security;
alter table mizizi_private.workspaces force row level security;
alter table mizizi_private.workspace_memberships enable row level security;
alter table mizizi_private.workspace_memberships force row level security;
alter table mizizi_private.workspace_events enable row level security;
alter table mizizi_private.workspace_events force row level security;

revoke all on table
  mizizi_private.workspaces,
  mizizi_private.workspace_memberships,
  mizizi_private.workspace_events
  from public, anon, authenticated, service_role, mizizi_executor;

revoke all on sequence mizizi_private.workspace_events_event_seq_seq
  from public, anon, authenticated, service_role, mizizi_executor;

-- DB01 deliberately defines no allow policies and no public mutation RPCs.
-- DB02 must add reviewed typed commands, row visibility and explicit actor checks.

create function mizizi_private.block_workspace_mutation_v1()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $mizizi_block_workspace_mutation$
begin
  raise exception 'DB01: workspace identity is immutable until governed workspace commands exist'
    using errcode = '23514';
end;
$mizizi_block_workspace_mutation$;

create trigger mizizi_workspaces_immutable
before update or delete on mizizi_private.workspaces
for each row execute function mizizi_private.block_workspace_mutation_v1();

create function mizizi_private.block_workspace_event_mutation_v1()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $mizizi_block_workspace_event_mutation$
begin
  raise exception 'MIZIZI workspace events are append-only'
    using errcode = '23514';
end;
$mizizi_block_workspace_event_mutation$;

create trigger mizizi_workspace_events_append_only
before update or delete on mizizi_private.workspace_events
for each row execute function mizizi_private.block_workspace_event_mutation_v1();

create function mizizi_private.guard_workspace_membership_change_v1()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $mizizi_guard_workspace_membership_change$
begin
  if tg_op = 'DELETE' then
    raise exception 'MIZIZI workspace memberships require a reviewed revocation, not deletion'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' then
    if old.revoked_at is not null
      or new.id is distinct from old.id
      or new.workspace_id is distinct from old.workspace_id
      or new.user_id is distinct from old.user_id
      or new.granted_by is distinct from old.granted_by
      or new.grant_source is distinct from old.grant_source
      or new.valid_from is distinct from old.valid_from
      or new.created_at is distinct from old.created_at
      or new.revision <> old.revision + 1 then
      raise exception 'MIZIZI membership binding/revision cannot be rewritten'
        using errcode = '23514';
    end if;

    if new.last_changed_by is not distinct from old.last_changed_by
      and new.change_reason is not distinct from old.change_reason
      and new.member_role is not distinct from old.member_role
      and new.valid_until is not distinct from old.valid_until
      and new.revoked_at is not distinct from old.revoked_at then
      raise exception 'MIZIZI membership update has no governed change'
        using errcode = '23514';
    end if;

    new.updated_at := clock_timestamp();
  end if;

  return new;
end;
$mizizi_guard_workspace_membership_change$;

create trigger mizizi_workspace_memberships_guard
before update or delete on mizizi_private.workspace_memberships
for each row execute function mizizi_private.guard_workspace_membership_change_v1();

create function mizizi_private.journal_workspace_membership_v1()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $mizizi_journal_workspace_membership$
declare
  v_event_type text;
  v_prior_role text;
begin
  if tg_op = 'INSERT' then
    v_event_type := 'membership_granted';
    v_prior_role := null;
  elsif old.revoked_at is null and new.revoked_at is not null then
    v_event_type := 'membership_revoked';
    v_prior_role := old.member_role;
  else
    v_event_type := 'membership_changed';
    v_prior_role := old.member_role;
  end if;

  insert into mizizi_private.workspace_events (
    event_key, workspace_id, membership_id, subject_user_id,
    event_type, actor_key, membership_revision, previous_role,
    resulting_role, membership_valid_from, membership_valid_until,
    membership_revoked_at, reason
  ) values (
    'membership:' || new.id::text || ':revision:' || new.revision::text,
    new.workspace_id, new.id, new.user_id,
    v_event_type, 'user:' || new.last_changed_by::text,
    new.revision, v_prior_role, new.member_role,
    new.valid_from, new.valid_until, new.revoked_at, new.change_reason
  );

  return null;
end;
$mizizi_journal_workspace_membership$;

create trigger mizizi_workspace_memberships_journal
  after insert or update on mizizi_private.workspace_memberships
  for each row execute function mizizi_private.journal_workspace_membership_v1();

create function mizizi_private.journal_workspace_creation_v1()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $mizizi_journal_workspace_creation$
begin
  insert into mizizi_private.workspace_events (
    event_key, workspace_id, event_type, actor_key, reason
  ) values (
    'workspace:' || new.workspace_key || ':created:v1',
    new.id, 'workspace_created', 'system:mizizi_db01_seed',
    'CLI-minted DB01 internal workspace foundation'
  );
  return null;
end;
$mizizi_journal_workspace_creation$;

create trigger mizizi_workspaces_creation_journal
  after insert on mizizi_private.workspaces
  for each row execute function mizizi_private.journal_workspace_creation_v1();

revoke all on function
  mizizi_private.block_workspace_mutation_v1(),
  mizizi_private.block_workspace_event_mutation_v1(),
  mizizi_private.guard_workspace_membership_change_v1(),
  mizizi_private.journal_workspace_membership_v1(),
  mizizi_private.journal_workspace_creation_v1()
  from public, anon, authenticated, service_role, mizizi_executor;

-- Exactly one internally owned workspace. Do not infer an admin user or pre-grant membership.
insert into mizizi_private.workspaces (
  workspace_key, workspace_kind, owner_type, owner_ref,
  display_name, status, retention_policy_key
) values (
  'wakilisha-internal', 'internal', 'platform', 'wakilisha',
  'WAKILISHA', 'active', 'pending_policy_review'
);

commit;
