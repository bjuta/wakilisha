-- Mlinzi Registry Steward durable machine memory.
--
-- This migration creates private steward state, not a human review queue.
-- It lets deterministic automation remember unresolved findings and bounded
-- scan progress without exposing that state to public clients.

do $mlinzi_preflight$
begin
  if to_regnamespace('platform_private') is null then
    raise exception 'STOP: platform_private schema is missing';
  end if;

  if to_regclass('public.registry_tracks') is null
     or to_regclass('public.registry_canonical_write_events') is null
     or to_regclass('public.wk_slug_redirects') is null
  then
    raise exception 'STOP: Mlinzi canonical Registry prerequisites are missing';
  end if;
end;
$mlinzi_preflight$;

create table if not exists platform_private.registry_steward_findings (
  finding_key text primary key,
  steward_key text not null default 'mlinzi',
  entity_type text not null,
  entity_id text not null,
  field_name text not null,
  rule text not null,
  disposition text not null,
  retry_count integer not null default 0,
  public_breakage boolean not null default false,
  evidence_fingerprint text,
  context jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  next_retry_at timestamptz,
  human_required_at timestamptz,
  resolved_at timestamptz,
  resolution text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint registry_steward_findings_disposition_check
    check (
      disposition in (
        'auto_repair',
        'leave',
        'defer',
        'human_required',
        'resolved'
      )
    ),

  constraint registry_steward_findings_retry_count_check
    check (retry_count >= 0),

  constraint registry_steward_findings_context_check
    check (
      jsonb_typeof(context) = 'object'
      and octet_length(context::text) <= 32768
    ),

  constraint registry_steward_findings_fingerprint_check
    check (
      evidence_fingerprint is null
      or evidence_fingerprint ~ '^[0-9a-f]{64}$'
    ),

  constraint registry_steward_findings_human_required_check
    check (
      disposition <> 'human_required'
      or human_required_at is not null
    ),

  constraint registry_steward_findings_resolution_check
    check (
      (
        disposition = 'resolved'
        and resolved_at is not null
      )
      or (
        disposition <> 'resolved'
        and resolved_at is null
      )
    )
);

comment on table platform_private.registry_steward_findings is
  'Private durable machine memory for Mlinzi findings. This is not an administrator review queue.';

create index if not exists registry_steward_findings_retry_idx
  on platform_private.registry_steward_findings (
    steward_key,
    disposition,
    next_retry_at,
    last_seen_at,
    finding_key
  )
  where disposition in ('defer', 'human_required');

create index if not exists registry_steward_findings_entity_idx
  on platform_private.registry_steward_findings (
    entity_type,
    entity_id,
    field_name,
    rule
  );

create table if not exists platform_private.registry_steward_checkpoints (
  steward_key text not null,
  pass_key text not null,
  watermark_time timestamptz,
  watermark_key text,
  rows_scanned bigint not null default 0,
  last_run_started_at timestamptz,
  last_run_completed_at timestamptz,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (steward_key, pass_key),

  constraint registry_steward_checkpoints_rows_scanned_check
    check (rows_scanned >= 0),

  constraint registry_steward_checkpoints_context_check
    check (
      jsonb_typeof(context) = 'object'
      and octet_length(context::text) <= 16384
    )
);

comment on table platform_private.registry_steward_checkpoints is
  'Private bounded-scan checkpoints for Registry steward workers.';

create trigger registry_steward_findings_touch_updated_at
before update
on platform_private.registry_steward_findings
for each row
execute function platform_private.touch_updated_at();

create trigger registry_steward_checkpoints_touch_updated_at
before update
on platform_private.registry_steward_checkpoints
for each row
execute function platform_private.touch_updated_at();

revoke all
  on table
    platform_private.registry_steward_findings,
    platform_private.registry_steward_checkpoints
  from public, anon, authenticated;

grant select, insert, update, delete
  on table
    platform_private.registry_steward_findings,
    platform_private.registry_steward_checkpoints
  to service_role;

do $mlinzi_proof$
begin
  if has_table_privilege(
       'anon',
       'platform_private.registry_steward_findings',
       'select'
     )
     or has_table_privilege(
       'authenticated',
       'platform_private.registry_steward_findings',
       'select'
     )
     or has_table_privilege(
       'anon',
       'platform_private.registry_steward_checkpoints',
       'select'
     )
     or has_table_privilege(
       'authenticated',
       'platform_private.registry_steward_checkpoints',
       'select'
     )
  then
    raise exception 'STOP: Mlinzi private state is browser-readable';
  end if;

  if not has_table_privilege(
       'service_role',
       'platform_private.registry_steward_findings',
       'select,insert,update,delete'
     )
     or not has_table_privilege(
       'service_role',
       'platform_private.registry_steward_checkpoints',
       'select,insert,update,delete'
     )
  then
    raise exception 'STOP: service_role cannot operate Mlinzi private state';
  end if;
end;
$mlinzi_proof$;
