import { createRegistryPool } from "./phase1-db";

const ddl = `
create extension if not exists pgcrypto;

create table if not exists public.registry_review_items (
  id uuid primary key default gen_random_uuid(),
  review_key text not null unique,
  entity_type text not null,
  entity_id uuid,
  related_entity_type text,
  related_entity_id uuid,
  review_type text not null,
  priority text not null default 'normal',
  status text not null default 'open',
  title text not null,
  summary text,
  source_table text,
  source_id text,
  source_payload jsonb not null default '{}'::jsonb,
  candidate_payload jsonb not null default '{}'::jsonb,
  resolution_payload jsonb not null default '{}'::jsonb,
  assigned_to uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.registry_canonicalization_decisions (
  id uuid primary key default gen_random_uuid(),
  review_item_id uuid,
  decision_type text not null,
  entity_type text not null,
  entity_id uuid,
  before_payload jsonb not null default '{}'::jsonb,
  after_payload jsonb not null default '{}'::jsonb,
  decision_notes text,
  decided_by uuid,
  status text not null default 'recorded',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.registry_review_items add column if not exists review_key text;
alter table public.registry_review_items add column if not exists entity_type text;
alter table public.registry_review_items add column if not exists entity_id uuid;
alter table public.registry_review_items add column if not exists related_entity_type text;
alter table public.registry_review_items add column if not exists related_entity_id uuid;
alter table public.registry_review_items add column if not exists review_type text;
alter table public.registry_review_items add column if not exists priority text not null default 'normal';
alter table public.registry_review_items add column if not exists status text not null default 'open';
alter table public.registry_review_items add column if not exists title text;
alter table public.registry_review_items add column if not exists summary text;
alter table public.registry_review_items add column if not exists source_table text;
alter table public.registry_review_items add column if not exists source_id text;
alter table public.registry_review_items add column if not exists source_payload jsonb not null default '{}'::jsonb;
alter table public.registry_review_items add column if not exists candidate_payload jsonb not null default '{}'::jsonb;
alter table public.registry_review_items add column if not exists resolution_payload jsonb not null default '{}'::jsonb;
alter table public.registry_review_items add column if not exists assigned_to uuid;
alter table public.registry_review_items add column if not exists created_at timestamptz not null default now();
alter table public.registry_review_items add column if not exists updated_at timestamptz not null default now();
alter table public.registry_review_items add column if not exists resolved_at timestamptz;

alter table public.registry_canonicalization_decisions add column if not exists review_item_id uuid;
alter table public.registry_canonicalization_decisions add column if not exists decision_type text;
alter table public.registry_canonicalization_decisions add column if not exists entity_type text;
alter table public.registry_canonicalization_decisions add column if not exists entity_id uuid;
alter table public.registry_canonicalization_decisions add column if not exists before_payload jsonb not null default '{}'::jsonb;
alter table public.registry_canonicalization_decisions add column if not exists after_payload jsonb not null default '{}'::jsonb;
alter table public.registry_canonicalization_decisions add column if not exists decision_notes text;
alter table public.registry_canonicalization_decisions add column if not exists decided_by uuid;
alter table public.registry_canonicalization_decisions add column if not exists status text not null default 'recorded';
alter table public.registry_canonicalization_decisions add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.registry_canonicalization_decisions add column if not exists created_at timestamptz not null default now();

create unique index if not exists registry_review_items_review_key_idx on public.registry_review_items (review_key);
create index if not exists registry_review_items_status_idx on public.registry_review_items (status);
create index if not exists registry_review_items_type_status_idx on public.registry_review_items (review_type, status);
create index if not exists registry_review_items_entity_idx on public.registry_review_items (entity_type, entity_id);
create index if not exists registry_review_items_priority_idx on public.registry_review_items (priority);
create index if not exists registry_review_items_created_at_idx on public.registry_review_items (created_at desc);
create index if not exists registry_canonicalization_decisions_review_item_idx on public.registry_canonicalization_decisions (review_item_id);
create index if not exists registry_canonicalization_decisions_entity_idx on public.registry_canonicalization_decisions (entity_type, entity_id);

insert into public.registry_audit_log (actor_label, action, entity_type, metadata)
values (
  'system',
  'phase2_review_schema_applied',
  'registry_review_schema',
  jsonb_build_object(
    'scope', 'additive_only',
    'public_rendering_changed', false,
    'public_api_changed', false,
    'canonical_entities_changed', false,
    'destructive_changes', false
  )
);
`;

async function main() {
  const pool = createRegistryPool();

  try {
    await pool.query("select 1");
    console.log("[phase2-review-schema] Database connection verified.");

    await pool.query("begin");
    await pool.query(ddl);
    await pool.query("commit");

    console.log("[phase2-review-schema] Additive review schema applied successfully.");
    console.log("[phase2-review-schema] No public rendering, API, or canonical entity data was changed.");
  } catch (error) {
    await pool.query("rollback").catch(() => undefined);
    console.error("[phase2-review-schema] Failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
