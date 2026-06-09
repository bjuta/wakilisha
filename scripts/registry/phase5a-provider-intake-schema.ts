import { createRegistryPool, hasTable } from "./phase1-db";

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

const writeMode = hasFlag("write");
const dryRunMode = hasFlag("dry-run") || !writeMode;

const intakeTables = [
  "provider_sources",
  "provider_runs",
  "provider_items",
  "provider_match_candidates",
  "provider_promotion_decisions",
];

async function run(): Promise<void> {
  const pool = createRegistryPool();

  try {
    console.log("\nWAKILISHA Phase 5A Provider Intake Schema");
    console.log("=".repeat(80));
    console.log(`Mode: ${writeMode ? "WRITE" : "DRY RUN ONLY"}`);

    const requiredTables = ["registry_artists", "registry_tracks", "registry_releases", "registry_media_assets"];
    for (const table of requiredTables) {
      if (!(await hasTable(pool, `public.${table}`))) {
        throw new Error(`Required registry table missing: public.${table}`);
      }
    }

    const existing = await Promise.all(
      intakeTables.map(async (table) => ({ table, exists: await hasTable(pool, `public.${table}`) })),
    );

    const schemaSql = `
      create table if not exists public.provider_sources (
        id uuid primary key default gen_random_uuid(),
        provider_kind text not null,
        name text not null,
        slug text not null,
        description text,
        is_active boolean not null default true,
        config jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        constraint provider_sources_slug_unique unique (slug),
        constraint provider_sources_kind_check check (provider_kind in ('spotify', 'apple_music', 'youtube', 'boomplay', 'mdundo', 'chart_import', 'wordpress_legacy', 'csv_upload', 'manual_submission', 'other'))
      );

      create table if not exists public.provider_runs (
        id uuid primary key default gen_random_uuid(),
        provider_source_id uuid not null references public.provider_sources(id) on delete cascade,
        run_key text not null,
        status text not null default 'draft',
        started_at timestamptz,
        completed_at timestamptz,
        source_cursor text,
        stats jsonb not null default '{}'::jsonb,
        errors jsonb not null default '[]'::jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        constraint provider_runs_source_key_unique unique (provider_source_id, run_key),
        constraint provider_runs_status_check check (status in ('draft', 'running', 'completed', 'failed', 'cancelled'))
      );

      create table if not exists public.provider_items (
        id uuid primary key default gen_random_uuid(),
        provider_source_id uuid not null references public.provider_sources(id) on delete cascade,
        provider_run_id uuid references public.provider_runs(id) on delete set null,
        provider_external_id text,
        provider_url text,
        entity_type text not null,
        status text not null default 'staged',
        normalized_slug text,
        normalized_title text,
        normalized_artist text,
        normalized_payload jsonb not null default '{}'::jsonb,
        raw_payload jsonb not null default '{}'::jsonb,
        confidence_score numeric(5,4) not null default 0,
        source_timestamp timestamptz,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        constraint provider_items_entity_type_check check (entity_type in ('artist', 'track', 'release', 'label', 'genre', 'media')),
        constraint provider_items_status_check check (status in ('staged', 'matched', 'review', 'blocked', 'promoted')),
        constraint provider_items_confidence_check check (confidence_score >= 0 and confidence_score <= 1)
      );

      create table if not exists public.provider_match_candidates (
        id uuid primary key default gen_random_uuid(),
        provider_item_id uuid not null references public.provider_items(id) on delete cascade,
        registry_entity_type text not null,
        registry_entity_id uuid,
        match_status text not null default 'candidate',
        match_rule text not null,
        confidence_score numeric(5,4) not null default 0,
        evidence jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        constraint provider_match_registry_type_check check (registry_entity_type in ('artist', 'track', 'release', 'label', 'genre', 'media')),
        constraint provider_match_status_check check (match_status in ('candidate', 'accepted', 'rejected', 'superseded')),
        constraint provider_match_confidence_check check (confidence_score >= 0 and confidence_score <= 1)
      );

      create table if not exists public.provider_promotion_decisions (
        id uuid primary key default gen_random_uuid(),
        provider_item_id uuid not null references public.provider_items(id) on delete cascade,
        match_candidate_id uuid references public.provider_match_candidates(id) on delete set null,
        decision text not null,
        decision_status text not null default 'draft',
        registry_entity_type text,
        registry_entity_id uuid,
        notes text,
        metadata jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        constraint provider_promotion_decision_check check (decision in ('auto_match', 'propose_new', 'review_required', 'block', 'promote')),
        constraint provider_promotion_status_check check (decision_status in ('draft', 'approved', 'applied', 'rejected')),
        constraint provider_promotion_registry_type_check check (registry_entity_type is null or registry_entity_type in ('artist', 'track', 'release', 'label', 'genre', 'media'))
      );

      create index if not exists provider_runs_source_idx on public.provider_runs (provider_source_id, created_at desc);
      create index if not exists provider_items_source_entity_idx on public.provider_items (provider_source_id, entity_type, status);
      create index if not exists provider_items_normalized_slug_idx on public.provider_items (normalized_slug);
      create index if not exists provider_items_external_id_idx on public.provider_items (provider_external_id);
      create index if not exists provider_match_item_idx on public.provider_match_candidates (provider_item_id, confidence_score desc);
      create index if not exists provider_promotion_item_idx on public.provider_promotion_decisions (provider_item_id, decision_status);

      alter table public.provider_sources enable row level security;
      alter table public.provider_runs enable row level security;
      alter table public.provider_items enable row level security;
      alter table public.provider_match_candidates enable row level security;
      alter table public.provider_promotion_decisions enable row level security;

      grant select on public.provider_sources to authenticated;
      grant select on public.provider_runs to authenticated;
      grant select on public.provider_items to authenticated;
      grant select on public.provider_match_candidates to authenticated;
      grant select on public.provider_promotion_decisions to authenticated;
    `;

    if (dryRunMode) {
      console.log("\nCurrent provider intake table coverage");
      console.log("-".repeat(80));
      console.table(existing);

      console.log("\nPlanned schema changes");
      console.log("-".repeat(80));
      console.log("create provider_sources, provider_runs, provider_items, provider_match_candidates, provider_promotion_decisions");
      console.log("add entity/status/confidence constraints and match indexes");
      console.log("enable RLS and authenticated read grants only");
      console.log("no registry rows will be written");

      console.log("\nSafety result");
      console.log("-".repeat(80));
      console.table([{ schema_modified: false, provider_rows_written: 0, registry_rows_written: 0, public_rendering_changed: false, write_mode_supported: true }]);
      console.log("\nDry run complete. To apply schema, rerun with: npm run registry:phase5a:provider-intake-schema -- --write");
      return;
    }

    await pool.query(schemaSql);

    const after = await Promise.all(
      intakeTables.map(async (table) => ({ table, exists: await hasTable(pool, `public.${table}`) })),
    );

    console.log("\nSchema applied");
    console.log("-".repeat(80));
    console.table(after);

    console.log("\nSafety result");
    console.log("-".repeat(80));
    console.table([{ schema_modified: true, provider_rows_written: 0, registry_rows_written: 0, public_rendering_changed: false }]);

    console.log("\nPhase 5A provider intake schema complete. No provider or registry rows were written.");
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error("\nPhase 5A provider intake schema failed.");
  console.error(error);
  process.exitCode = 1;
});
