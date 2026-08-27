-- Phase 7A K4A: shared Resource review and lifecycle event authority.
--
-- K4A promotes append-only review/lifecycle history to shared Resource identity.
-- Existing Article, Playlist, and Audio event tables remain compatibility history.
-- Video must consume the shared ledgers from its first governed lifecycle command.

begin;

set local statement_timeout = '180s';
set local lock_timeout = '5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'phase-7a-k4a-resource-event-authority',
    0
  )
);

create temporary table phase_7a_k4a_baseline
on commit drop
as
select
  (select count(*) from editorial.article_lifecycle_events) as article_lifecycle_count,
  (
    select md5(coalesce(string_agg(to_jsonb(e)::text, E'\n' order by e.id::text), ''))
    from editorial.article_lifecycle_events e
  ) as article_lifecycle_fingerprint,
  (select count(*) from editorial.playlist_lifecycle_events) as playlist_lifecycle_count,
  (
    select md5(coalesce(string_agg(to_jsonb(e)::text, E'\n' order by e.id::text), ''))
    from editorial.playlist_lifecycle_events e
  ) as playlist_lifecycle_fingerprint,
  (select count(*) from audio.publication_lifecycle_events) as audio_lifecycle_count,
  (
    select md5(coalesce(string_agg(to_jsonb(e)::text, E'\n' order by e.id::text), ''))
    from audio.publication_lifecycle_events e
  ) as audio_lifecycle_fingerprint,
  (select count(*) from editorial.playlist_review_events) as playlist_review_count,
  (
    select md5(coalesce(string_agg(to_jsonb(e)::text, E'\n' order by e.id::text), ''))
    from editorial.playlist_review_events e
  ) as playlist_review_fingerprint,
  (select count(*) from audio.publication_review_events) as audio_review_count,
  (
    select md5(coalesce(string_agg(to_jsonb(e)::text, E'\n' order by e.id::text), ''))
    from audio.publication_review_events e
  ) as audio_review_fingerprint;

do $phase_7a_k4a_preflight$
declare
  v_count bigint;
begin
  if to_regclass('editorial.resource_versions') is null
     or to_regprocedure('editorial.assert_resource_version_pointer_integrity()') is null
     or to_regnamespace('video') is null
  then
    raise exception
      'STOP: Phase 7A K0/K1/K2 authority is incomplete';
  end if;

  if to_regclass('editorial.resource_lifecycle_events') is not null
     or to_regclass('editorial.resource_review_events') is not null
     or to_regclass('editorial.resource_lifecycle_actions') is not null
     or to_regclass('editorial.resource_review_actions') is not null
  then
    raise exception
      'STOP: K4A shared Resource event authority already exists';
  end if;

  if to_regclass('video.review_events') is not null
     or to_regclass('video.lifecycle_events') is not null
     or to_regclass('video.publication_review_events') is not null
     or to_regclass('video.publication_lifecycle_events') is not null
  then
    raise exception
      'STOP: Video already renewed typed review/lifecycle event authority';
  end if;

  if exists (
    select 1
    from (
      select id from editorial.article_lifecycle_events
      union all
      select id from editorial.playlist_lifecycle_events
      union all
      select id from audio.publication_lifecycle_events
    ) source
    group by source.id
    having count(*) > 1
  ) then
    raise exception
      'STOP: lifecycle legacy event UUID collision prevents identity-preserving backfill';
  end if;

  if exists (
    select 1
    from (
      select id from editorial.playlist_review_events
      union all
      select id from audio.publication_review_events
    ) source
    group by source.id
    having count(*) > 1
  ) then
    raise exception
      'STOP: review legacy event UUID collision prevents identity-preserving backfill';
  end if;

  if exists (
    select 1
    from editorial.article_lifecycle_events e
    left join editorial.resources r
      on r.id = e.resource_id
    where r.id is null
  ) or exists (
    select 1
    from editorial.playlist_lifecycle_events e
    left join editorial.resources r
      on r.id = e.resource_id
    where r.id is null
  ) or exists (
    select 1
    from audio.publication_lifecycle_events e
    left join editorial.resources r
      on r.id = e.resource_id
    where r.id is null
  ) or exists (
    select 1
    from editorial.playlist_review_events e
    left join editorial.resources r
      on r.id = e.resource_id
    where r.id is null
  ) or exists (
    select 1
    from audio.publication_review_events e
    left join editorial.resources r
      on r.id = e.resource_id
    where r.id is null
  ) then
    raise exception
      'STOP: legacy event history references a missing Resource';
  end if;

  if exists (
    select 1
    from editorial.article_lifecycle_events e
    left join editorial.resource_versions v
      on v.id = e.version_id
     and v.resource_id = e.resource_id
    where e.version_id is not null
      and v.id is null
  ) or exists (
    select 1
    from editorial.playlist_lifecycle_events e
    left join editorial.resource_versions v
      on v.id = e.version_id
     and v.resource_id = e.resource_id
    where e.version_id is not null
      and v.id is null
  ) or exists (
    select 1
    from audio.publication_lifecycle_events e
    left join editorial.resource_versions v
      on v.id = e.version_id
     and v.resource_id = e.resource_id
    where e.version_id is not null
      and v.id is null
  ) then
    raise exception
      'STOP: legacy lifecycle history references a missing or cross-Resource Resource Version';
  end if;

  if exists (
    select 1
    from editorial.playlist_review_events e
    left join editorial.resource_versions target
      on target.id = e.target_version_id
     and target.resource_id = e.resource_id
    left join editorial.resource_versions result
      on result.id = e.result_version_id
     and result.resource_id = e.resource_id
    where target.id is null
       or (e.result_version_id is not null and result.id is null)
  ) or exists (
    select 1
    from audio.publication_review_events e
    left join editorial.resource_versions target
      on target.id = e.target_version_id
     and target.resource_id = e.resource_id
    left join editorial.resource_versions result
      on result.id = e.result_version_id
     and result.resource_id = e.resource_id
    where target.id is null
       or (e.result_version_id is not null and result.id is null)
  ) then
    raise exception
      'STOP: legacy review history references a missing or cross-Resource Resource Version';
  end if;

  select count(*)
  into v_count
  from (
    select e.command_receipt_id, e.resource_id, e.actor_id
    from editorial.playlist_lifecycle_events e
    union all
    select e.command_receipt_id, e.resource_id, e.actor_id
    from audio.publication_lifecycle_events e
    union all
    select e.command_receipt_id, e.resource_id, e.actor_id
    from editorial.playlist_review_events e
    union all
    select e.command_receipt_id, e.resource_id, e.actor_id
    from audio.publication_review_events e
  ) e
  left join platform_private.command_receipts receipt
    on receipt.id = e.command_receipt_id
   and receipt.resource_id = e.resource_id
   and receipt.actor_user_id is not distinct from e.actor_id
  where receipt.id is null;

  if v_count <> 0 then
    raise exception
      'STOP: % legacy command receipt(s) disagree with event Resource/actor identity',
      v_count;
  end if;
end;
$phase_7a_k4a_preflight$;

-- ---------------------------------------------------------------------------
-- Controlled shared action vocabulary.
-- ---------------------------------------------------------------------------

create table editorial.resource_lifecycle_actions (
  action text primary key,
  description text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  constraint resource_lifecycle_actions_action_check
    check (
      action ~ '^[a-z][a-z0-9_]*$'
      and length(action) between 1 and 100
    ),
  constraint resource_lifecycle_actions_description_check
    check (nullif(btrim(description), '') is not null)
);

create table editorial.resource_review_actions (
  action text primary key,
  description text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  constraint resource_review_actions_action_check
    check (
      action ~ '^[a-z][a-z0-9_]*$'
      and length(action) between 1 and 100
    ),
  constraint resource_review_actions_description_check
    check (nullif(btrim(description), '') is not null)
);

insert into editorial.resource_lifecycle_actions (
  action,
  description
)
values
  ('submitted', 'Resource version submitted into governed review'),
  ('changes_requested', 'Resource returned to working state after review changes were requested'),
  ('approved', 'Resource version approved for publication'),
  ('scheduled', 'Resource publication scheduled'),
  ('unscheduled', 'Resource publication schedule removed'),
  ('published', 'Approved Resource version published'),
  ('unpublished', 'Published Resource removed from current public position'),
  ('archived', 'Resource archived'),
  ('restored', 'Archived Resource restored');

insert into editorial.resource_review_actions (
  action,
  description
)
values
  ('submitted', 'Exact Resource version entered review'),
  ('review_started', 'Governed review began for the exact submitted Resource version'),
  ('changes_requested', 'Reviewer requested changes to the submitted Resource version'),
  ('approved', 'Reviewer approved the submitted Resource version'),
  ('rejected', 'Reviewer rejected the submitted Resource version');

-- ---------------------------------------------------------------------------
-- Canonical shared lifecycle history.
-- ---------------------------------------------------------------------------

create table editorial.resource_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null,
  event_number bigint not null,
  action text not null,
  version_id uuid,
  prior_status text,
  resulting_status text,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  actor_id uuid,
  command_receipt_id uuid,
  correlation_id uuid,
  legacy_source_authority text,
  legacy_source_event_id uuid,
  created_at timestamptz not null default now(),

  constraint resource_lifecycle_events_resource_fkey
    foreign key (resource_id)
    references editorial.resources(id)
    on update cascade
    on delete restrict,

  constraint resource_lifecycle_events_version_fkey
    foreign key (resource_id, version_id)
    references editorial.resource_versions(resource_id, id)
    on update cascade
    on delete restrict,

  constraint resource_lifecycle_events_action_fkey
    foreign key (action)
    references editorial.resource_lifecycle_actions(action)
    on update restrict
    on delete restrict,

  constraint resource_lifecycle_events_actor_fkey
    foreign key (actor_id)
    references auth.users(id)
    on delete set null,

  constraint resource_lifecycle_events_receipt_fkey
    foreign key (command_receipt_id)
    references platform_private.command_receipts(id)
    on delete restrict,

  constraint resource_lifecycle_events_number_check
    check (event_number >= 1),

  constraint resource_lifecycle_events_status_check
    check (
      (prior_status is null or nullif(btrim(prior_status), '') is not null)
      and
      (resulting_status is null or nullif(btrim(resulting_status), '') is not null)
    ),

  constraint resource_lifecycle_events_metadata_check
    check (
      jsonb_typeof(metadata) = 'object'
      and octet_length(metadata::text) <= 32768
    ),

  constraint resource_lifecycle_events_legacy_identity_check
    check (
      (legacy_source_authority is null and legacy_source_event_id is null)
      or (
        legacy_source_authority in (
          'article_lifecycle',
          'playlist_lifecycle',
          'audio_publication_lifecycle'
        )
        and legacy_source_event_id is not null
      )
    ),

  constraint resource_lifecycle_events_new_command_trace_check
    check (
      legacy_source_authority is not null
      or (
        command_receipt_id is not null
        and correlation_id is not null
      )
    )
);

create unique index resource_lifecycle_events_resource_number_key
  on editorial.resource_lifecycle_events(resource_id, event_number);

create index resource_lifecycle_events_resource_created_idx
  on editorial.resource_lifecycle_events(resource_id, created_at desc, id);

create unique index resource_lifecycle_events_legacy_source_key
  on editorial.resource_lifecycle_events(
    legacy_source_authority,
    legacy_source_event_id
  )
  where legacy_source_authority is not null;

create unique index resource_lifecycle_events_receipt_action_key
  on editorial.resource_lifecycle_events(command_receipt_id, action)
  where command_receipt_id is not null;

-- ---------------------------------------------------------------------------
-- Canonical shared review decision history.
-- ---------------------------------------------------------------------------

create table editorial.resource_review_events (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null,
  event_number bigint not null,
  target_version_id uuid not null,
  result_version_id uuid,
  action text not null,
  prior_status text not null,
  resulting_status text not null,
  reason text,
  actor_id uuid,
  command_receipt_id uuid,
  correlation_id uuid,
  legacy_source_authority text,
  legacy_source_event_id uuid,
  created_at timestamptz not null default now(),

  constraint resource_review_events_resource_fkey
    foreign key (resource_id)
    references editorial.resources(id)
    on update cascade
    on delete restrict,

  constraint resource_review_events_target_version_fkey
    foreign key (resource_id, target_version_id)
    references editorial.resource_versions(resource_id, id)
    on update cascade
    on delete restrict,

  constraint resource_review_events_result_version_fkey
    foreign key (resource_id, result_version_id)
    references editorial.resource_versions(resource_id, id)
    on update cascade
    on delete restrict,

  constraint resource_review_events_action_fkey
    foreign key (action)
    references editorial.resource_review_actions(action)
    on update restrict
    on delete restrict,

  constraint resource_review_events_actor_fkey
    foreign key (actor_id)
    references auth.users(id)
    on delete set null,

  constraint resource_review_events_receipt_fkey
    foreign key (command_receipt_id)
    references platform_private.command_receipts(id)
    on delete restrict,

  constraint resource_review_events_number_check
    check (event_number >= 1),

  constraint resource_review_events_status_check
    check (
      nullif(btrim(prior_status), '') is not null
      and nullif(btrim(resulting_status), '') is not null
    ),

  constraint resource_review_events_reason_check
    check (
      action not in ('changes_requested', 'rejected')
      or nullif(btrim(reason), '') is not null
    ),

  constraint resource_review_events_result_shape_check
    check (
      (action = 'approved' and result_version_id is not null)
      or
      (action <> 'approved' and result_version_id is null)
    ),

  constraint resource_review_events_legacy_identity_check
    check (
      (legacy_source_authority is null and legacy_source_event_id is null)
      or (
        legacy_source_authority in (
          'playlist_review',
          'audio_publication_review'
        )
        and legacy_source_event_id is not null
      )
    ),

  constraint resource_review_events_new_command_trace_check
    check (
      legacy_source_authority is not null
      or (
        command_receipt_id is not null
        and correlation_id is not null
      )
    )
);

create unique index resource_review_events_resource_number_key
  on editorial.resource_review_events(resource_id, event_number);

create index resource_review_events_resource_created_idx
  on editorial.resource_review_events(resource_id, created_at desc, id);

create unique index resource_review_events_legacy_source_key
  on editorial.resource_review_events(
    legacy_source_authority,
    legacy_source_event_id
  )
  where legacy_source_authority is not null;

create unique index resource_review_events_receipt_key
  on editorial.resource_review_events(command_receipt_id)
  where command_receipt_id is not null;

-- ---------------------------------------------------------------------------
-- Append-only and governed insert integrity.
-- ---------------------------------------------------------------------------

create or replace function editorial.protect_resource_event_history()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'editorial'
as $function$
begin
  raise exception
    'Shared Resource event history is append-only';
end;
$function$;

create or replace function editorial.assert_resource_event_insert_integrity()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'editorial', 'platform_private'
as $function$
declare
  v_receipt_resource_id uuid;
  v_receipt_actor_id uuid;
  v_action_enabled boolean;
begin
  if tg_table_name = 'resource_lifecycle_events' then
    select action_row.enabled
    into v_action_enabled
    from editorial.resource_lifecycle_actions action_row
    where action_row.action = new.action;
  elsif tg_table_name = 'resource_review_events' then
    select action_row.enabled
    into v_action_enabled
    from editorial.resource_review_actions action_row
    where action_row.action = new.action;
  else
    raise exception
      'Shared Resource event insert integrity attached to unexpected table %',
      tg_table_name;
  end if;

  if coalesce(v_action_enabled, false) is not true then
    raise exception
      'Shared Resource event action % is not enabled',
      new.action;
  end if;

  if new.legacy_source_authority is null
     and (
       new.command_receipt_id is null
       or new.correlation_id is null
     )
  then
    raise exception
      'New shared Resource events require command receipt and correlation identity';
  end if;

  if new.command_receipt_id is not null then
    select
      receipt.resource_id,
      receipt.actor_user_id
    into
      v_receipt_resource_id,
      v_receipt_actor_id
    from platform_private.command_receipts receipt
    where receipt.id = new.command_receipt_id;

    if not found then
      raise exception
        'Shared Resource event command receipt is missing';
    end if;

    if v_receipt_resource_id <> new.resource_id then
      raise exception
        'Shared Resource event command receipt belongs to another Resource';
    end if;

    if v_receipt_actor_id is distinct from new.actor_id then
      raise exception
        'Shared Resource event actor must match command receipt actor';
    end if;
  end if;

  return new;
end;
$function$;

create or replace function editorial.assert_resource_event_sequence_integrity()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'editorial'
as $function$
declare
  v_count bigint;
  v_min bigint;
  v_max bigint;
begin
  if tg_table_name = 'resource_lifecycle_events' then
    select
      count(*),
      min(event_row.event_number),
      max(event_row.event_number)
    into
      v_count,
      v_min,
      v_max
    from editorial.resource_lifecycle_events event_row
    where event_row.resource_id = new.resource_id;
  elsif tg_table_name = 'resource_review_events' then
    select
      count(*),
      min(event_row.event_number),
      max(event_row.event_number)
    into
      v_count,
      v_min,
      v_max
    from editorial.resource_review_events event_row
    where event_row.resource_id = new.resource_id;
  else
    raise exception
      'Shared Resource event sequence integrity attached to unexpected table %',
      tg_table_name;
  end if;

  if v_count > 0
     and (
       v_min <> 1
       or v_max <> v_count
     )
  then
    raise exception
      'Shared Resource event numbers must be contiguous from 1 for each Resource';
  end if;

  return new;
end;
$function$;

revoke execute
  on function editorial.protect_resource_event_history(),
     editorial.assert_resource_event_insert_integrity(),
     editorial.assert_resource_event_sequence_integrity()
  from public, anon, authenticated, service_role;

create trigger resource_lifecycle_events_append_only
before update or delete
on editorial.resource_lifecycle_events
for each row
execute function editorial.protect_resource_event_history();

create trigger resource_review_events_append_only
before update or delete
on editorial.resource_review_events
for each row
execute function editorial.protect_resource_event_history();

create trigger resource_lifecycle_events_insert_integrity
before insert
on editorial.resource_lifecycle_events
for each row
execute function editorial.assert_resource_event_insert_integrity();

create trigger resource_review_events_insert_integrity
before insert
on editorial.resource_review_events
for each row
execute function editorial.assert_resource_event_insert_integrity();

create constraint trigger resource_lifecycle_events_sequence_integrity
after insert
on editorial.resource_lifecycle_events
deferrable initially deferred
for each row
execute function editorial.assert_resource_event_sequence_integrity();

create constraint trigger resource_review_events_sequence_integrity
after insert
on editorial.resource_review_events
deferrable initially deferred
for each row
execute function editorial.assert_resource_event_sequence_integrity();

-- ---------------------------------------------------------------------------
-- Deterministic identity-preserving historical backfill.
-- ---------------------------------------------------------------------------

with legacy as (
  select
    e.id,
    e.resource_id,
    null::bigint as source_event_number,
    e.version_id,
    e.action,
    e.prior_status,
    e.resulting_status,
    e.note,
    e.metadata,
    e.actor_id,
    null::uuid as command_receipt_id,
    null::uuid as correlation_id,
    'article_lifecycle'::text as legacy_source_authority,
    e.created_at
  from editorial.article_lifecycle_events e

  union all

  select
    e.id,
    e.resource_id,
    e.event_number as source_event_number,
    e.version_id,
    e.action,
    e.prior_status,
    e.resulting_status,
    e.note,
    e.metadata,
    e.actor_id,
    e.command_receipt_id,
    null::uuid as correlation_id,
    'playlist_lifecycle'::text as legacy_source_authority,
    e.created_at
  from editorial.playlist_lifecycle_events e

  union all

  select
    e.id,
    e.resource_id,
    e.event_number as source_event_number,
    e.version_id,
    e.action,
    e.prior_status,
    e.resulting_status,
    e.note,
    e.metadata,
    e.actor_id,
    e.command_receipt_id,
    null::uuid as correlation_id,
    'audio_publication_lifecycle'::text as legacy_source_authority,
    e.created_at
  from audio.publication_lifecycle_events e
),
numbered as (
  select
    legacy.*,
    row_number() over (
      partition by legacy.resource_id
      order by
        case when legacy.source_event_number is null then 1 else 0 end,
        legacy.source_event_number,
        legacy.created_at,
        legacy.id
    ) as canonical_event_number
  from legacy
)
insert into editorial.resource_lifecycle_events (
  id,
  resource_id,
  event_number,
  action,
  version_id,
  prior_status,
  resulting_status,
  note,
  metadata,
  actor_id,
  command_receipt_id,
  correlation_id,
  legacy_source_authority,
  legacy_source_event_id,
  created_at
)
select
  numbered.id,
  numbered.resource_id,
  numbered.canonical_event_number,
  numbered.action,
  numbered.version_id,
  numbered.prior_status,
  numbered.resulting_status,
  numbered.note,
  numbered.metadata,
  numbered.actor_id,
  numbered.command_receipt_id,
  numbered.correlation_id,
  numbered.legacy_source_authority,
  numbered.id,
  numbered.created_at
from numbered
order by numbered.resource_id, numbered.canonical_event_number;

with legacy as (
  select
    e.id,
    e.resource_id,
    e.event_number as source_event_number,
    e.target_version_id,
    e.result_version_id,
    e.action,
    e.prior_status,
    e.resulting_status,
    e.reason,
    e.actor_id,
    e.command_receipt_id,
    e.correlation_id,
    'playlist_review'::text as legacy_source_authority,
    e.created_at
  from editorial.playlist_review_events e

  union all

  select
    e.id,
    e.resource_id,
    e.event_number as source_event_number,
    e.target_version_id,
    e.result_version_id,
    e.action,
    e.prior_status,
    e.resulting_status,
    e.reason,
    e.actor_id,
    e.command_receipt_id,
    e.correlation_id,
    'audio_publication_review'::text as legacy_source_authority,
    e.created_at
  from audio.publication_review_events e
),
numbered as (
  select
    legacy.*,
    row_number() over (
      partition by legacy.resource_id
      order by
        legacy.source_event_number,
        legacy.created_at,
        legacy.id
    ) as canonical_event_number
  from legacy
)
insert into editorial.resource_review_events (
  id,
  resource_id,
  event_number,
  target_version_id,
  result_version_id,
  action,
  prior_status,
  resulting_status,
  reason,
  actor_id,
  command_receipt_id,
  correlation_id,
  legacy_source_authority,
  legacy_source_event_id,
  created_at
)
select
  numbered.id,
  numbered.resource_id,
  numbered.canonical_event_number,
  numbered.target_version_id,
  numbered.result_version_id,
  numbered.action,
  numbered.prior_status,
  numbered.resulting_status,
  numbered.reason,
  numbered.actor_id,
  numbered.command_receipt_id,
  numbered.correlation_id,
  numbered.legacy_source_authority,
  numbered.id,
  numbered.created_at
from numbered
order by numbered.resource_id, numbered.canonical_event_number;

-- ---------------------------------------------------------------------------
-- Security boundary.
-- ---------------------------------------------------------------------------

alter table editorial.resource_lifecycle_actions enable row level security;
alter table editorial.resource_review_actions enable row level security;
alter table editorial.resource_lifecycle_events enable row level security;
alter table editorial.resource_review_events enable row level security;

revoke all
  on table editorial.resource_lifecycle_actions,
           editorial.resource_review_actions,
           editorial.resource_lifecycle_events,
           editorial.resource_review_events
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Migration-local proof.
-- ---------------------------------------------------------------------------

do $phase_7a_k4a_verify$
declare
  v_baseline record;
  v_count bigint;
begin
  select *
  into v_baseline
  from phase_7a_k4a_baseline;

  if v_baseline.article_lifecycle_fingerprint is distinct from (
    select md5(coalesce(string_agg(to_jsonb(e)::text, E'\n' order by e.id::text), ''))
    from editorial.article_lifecycle_events e
  ) or v_baseline.playlist_lifecycle_fingerprint is distinct from (
    select md5(coalesce(string_agg(to_jsonb(e)::text, E'\n' order by e.id::text), ''))
    from editorial.playlist_lifecycle_events e
  ) or v_baseline.audio_lifecycle_fingerprint is distinct from (
    select md5(coalesce(string_agg(to_jsonb(e)::text, E'\n' order by e.id::text), ''))
    from audio.publication_lifecycle_events e
  ) or v_baseline.playlist_review_fingerprint is distinct from (
    select md5(coalesce(string_agg(to_jsonb(e)::text, E'\n' order by e.id::text), ''))
    from editorial.playlist_review_events e
  ) or v_baseline.audio_review_fingerprint is distinct from (
    select md5(coalesce(string_agg(to_jsonb(e)::text, E'\n' order by e.id::text), ''))
    from audio.publication_review_events e
  ) then
    raise exception
      'STOP: K4A mutated existing typed event history';
  end if;

  select count(*)
  into v_count
  from editorial.resource_lifecycle_events;

  if v_count <> (
    v_baseline.article_lifecycle_count
    + v_baseline.playlist_lifecycle_count
    + v_baseline.audio_lifecycle_count
  ) then
    raise exception
      'STOP: K4A lifecycle backfill count mismatch';
  end if;

  select count(*)
  into v_count
  from editorial.resource_review_events;

  if v_count <> (
    v_baseline.playlist_review_count
    + v_baseline.audio_review_count
  ) then
    raise exception
      'STOP: K4A review backfill count mismatch';
  end if;

  if exists (
    select 1
    from editorial.article_lifecycle_events source
    left join editorial.resource_lifecycle_events canonical
      on canonical.id = source.id
     and canonical.legacy_source_authority = 'article_lifecycle'
     and canonical.legacy_source_event_id = source.id
     and canonical.resource_id = source.resource_id
     and canonical.version_id is not distinct from source.version_id
     and canonical.action = source.action
     and canonical.prior_status is not distinct from source.prior_status
     and canonical.resulting_status is not distinct from source.resulting_status
     and canonical.note is not distinct from source.note
     and canonical.metadata = source.metadata
     and canonical.actor_id is not distinct from source.actor_id
     and canonical.created_at = source.created_at
    where canonical.id is null
  ) or exists (
    select 1
    from editorial.playlist_lifecycle_events source
    left join editorial.resource_lifecycle_events canonical
      on canonical.id = source.id
     and canonical.legacy_source_authority = 'playlist_lifecycle'
     and canonical.legacy_source_event_id = source.id
     and canonical.resource_id = source.resource_id
     and canonical.version_id is not distinct from source.version_id
     and canonical.action = source.action
     and canonical.prior_status is not distinct from source.prior_status
     and canonical.resulting_status is not distinct from source.resulting_status
     and canonical.note is not distinct from source.note
     and canonical.metadata = source.metadata
     and canonical.actor_id is not distinct from source.actor_id
     and canonical.command_receipt_id = source.command_receipt_id
     and canonical.created_at = source.created_at
    where canonical.id is null
  ) or exists (
    select 1
    from audio.publication_lifecycle_events source
    left join editorial.resource_lifecycle_events canonical
      on canonical.id = source.id
     and canonical.legacy_source_authority = 'audio_publication_lifecycle'
     and canonical.legacy_source_event_id = source.id
     and canonical.resource_id = source.resource_id
     and canonical.version_id is not distinct from source.version_id
     and canonical.action = source.action
     and canonical.prior_status is not distinct from source.prior_status
     and canonical.resulting_status is not distinct from source.resulting_status
     and canonical.note is not distinct from source.note
     and canonical.metadata = source.metadata
     and canonical.actor_id is not distinct from source.actor_id
     and canonical.command_receipt_id = source.command_receipt_id
     and canonical.created_at = source.created_at
    where canonical.id is null
  ) then
    raise exception
      'STOP: K4A lifecycle backfill does not preserve exact legacy event meaning';
  end if;

  if exists (
    select 1
    from editorial.playlist_review_events source
    left join editorial.resource_review_events canonical
      on canonical.id = source.id
     and canonical.legacy_source_authority = 'playlist_review'
     and canonical.legacy_source_event_id = source.id
     and canonical.resource_id = source.resource_id
     and canonical.target_version_id = source.target_version_id
     and canonical.result_version_id is not distinct from source.result_version_id
     and canonical.action = source.action
     and canonical.prior_status = source.prior_status
     and canonical.resulting_status = source.resulting_status
     and canonical.reason is not distinct from source.reason
     and canonical.actor_id is not distinct from source.actor_id
     and canonical.command_receipt_id = source.command_receipt_id
     and canonical.correlation_id = source.correlation_id
     and canonical.created_at = source.created_at
    where canonical.id is null
  ) or exists (
    select 1
    from audio.publication_review_events source
    left join editorial.resource_review_events canonical
      on canonical.id = source.id
     and canonical.legacy_source_authority = 'audio_publication_review'
     and canonical.legacy_source_event_id = source.id
     and canonical.resource_id = source.resource_id
     and canonical.target_version_id = source.target_version_id
     and canonical.result_version_id is not distinct from source.result_version_id
     and canonical.action = source.action
     and canonical.prior_status = source.prior_status
     and canonical.resulting_status = source.resulting_status
     and canonical.reason is not distinct from source.reason
     and canonical.actor_id is not distinct from source.actor_id
     and canonical.command_receipt_id = source.command_receipt_id
     and canonical.correlation_id = source.correlation_id
     and canonical.created_at = source.created_at
    where canonical.id is null
  ) then
    raise exception
      'STOP: K4A review backfill does not preserve exact legacy event meaning';
  end if;


  if exists (
    select 1
    from editorial.resource_lifecycle_events event_row
    group by event_row.resource_id
    having min(event_row.event_number) <> 1
       or max(event_row.event_number) <> count(*)
  ) or exists (
    select 1
    from editorial.resource_review_events event_row
    group by event_row.resource_id
    having min(event_row.event_number) <> 1
       or max(event_row.event_number) <> count(*)
  ) then
    raise exception
      'STOP: K4A canonical event numbering is not contiguous from 1';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants grant_row
    where grant_row.table_schema = 'editorial'
      and grant_row.table_name in (
        'resource_lifecycle_actions',
        'resource_review_actions',
        'resource_lifecycle_events',
        'resource_review_events'
      )
      and grant_row.grantee in (
        'PUBLIC',
        'anon',
        'authenticated',
        'service_role'
      )
  ) then
    raise exception
      'STOP: K4A direct shared Resource event table privilege leaked to an application role';
  end if;

  if to_regclass('video.review_events') is not null
     or to_regclass('video.lifecycle_events') is not null
     or to_regclass('video.publication_review_events') is not null
     or to_regclass('video.publication_lifecycle_events') is not null
  then
    raise exception
      'STOP: K4A renewed typed Video review/lifecycle event authority';
  end if;

  if (
    select count(*)
    from pg_class table_row
    join pg_namespace schema_row
      on schema_row.oid = table_row.relnamespace
    where schema_row.nspname = 'editorial'
      and table_row.relname in (
        'resource_lifecycle_actions',
        'resource_review_actions',
        'resource_lifecycle_events',
        'resource_review_events'
      )
      and table_row.relrowsecurity
  ) <> 4 then
    raise exception
      'STOP: one or more K4A shared Resource event tables lack RLS';
  end if;

  if (
    select count(*)
    from pg_proc function_row
    join pg_namespace schema_row
      on schema_row.oid = function_row.pronamespace
    where schema_row.nspname = 'editorial'
      and function_row.proname in (
        'protect_resource_event_history',
        'assert_resource_event_insert_integrity',
        'assert_resource_event_sequence_integrity'
      )
      and function_row.prosecdef
      and (
        (
          function_row.proname = 'protect_resource_event_history'
          and coalesce(function_row.proconfig, '{}'::text[])
                @> array['search_path=pg_catalog, editorial']::text[]
        )
        or
        (
          function_row.proname = 'assert_resource_event_insert_integrity'
          and coalesce(function_row.proconfig, '{}'::text[])
                @> array['search_path=pg_catalog, editorial, platform_private']::text[]
        )
        or
        (
          function_row.proname = 'assert_resource_event_sequence_integrity'
          and coalesce(function_row.proconfig, '{}'::text[])
                @> array['search_path=pg_catalog, editorial']::text[]
        )
      )
  ) <> 3 then
    raise exception
      'STOP: K4A privileged helper security/search-path contract drifted';
  end if;

  if has_function_privilege(
       'anon',
       'editorial.protect_resource_event_history()'::regprocedure,
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'editorial.protect_resource_event_history()'::regprocedure,
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'editorial.protect_resource_event_history()'::regprocedure,
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'editorial.assert_resource_event_insert_integrity()'::regprocedure,
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'editorial.assert_resource_event_insert_integrity()'::regprocedure,
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'editorial.assert_resource_event_insert_integrity()'::regprocedure,
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'editorial.assert_resource_event_sequence_integrity()'::regprocedure,
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'editorial.assert_resource_event_sequence_integrity()'::regprocedure,
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'editorial.assert_resource_event_sequence_integrity()'::regprocedure,
       'EXECUTE'
     )
  then
    raise exception
      'STOP: K4A internal helper EXECUTE leaked to an application role';
  end if;
end;
$phase_7a_k4a_verify$;

commit;
