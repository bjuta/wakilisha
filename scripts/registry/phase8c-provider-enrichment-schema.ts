import { createRegistryPool, hasTable } from './phase1-db';

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

const writeMode = hasFlag('write');
const dryRunMode = hasFlag('dry-run') || !writeMode;

const enrichmentTables = [
  'provider_field_observations',
  'registry_enrichment_suggestions',
  'provider_entity_links',
];

async function run(): Promise<void> {
  const pool = createRegistryPool();

  try {
    console.log('\nWAKILISHA Phase 8C Provider Enrichment Staging Schema');
    console.log('='.repeat(80));
    console.log(`Mode: ${writeMode ? 'WRITE' : 'DRY RUN ONLY'}`);

    const existing = await Promise.all(
      enrichmentTables.map(async (table) => ({
        table,
        exists: await hasTable(pool, `public.${table}`),
      })),
    );

    const schemaSql = `
      create table if not exists public.provider_field_observations (
        id uuid primary key default gen_random_uuid(),
        provider_item_id text,
        entity_type text not null,
        field_name text not null,
        field_value text,
        provider text not null,
        confidence_score numeric(5,4) not null default 0,
        source_path text not null,
        raw_payload jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now(),
        constraint provider_field_observations_entity_type_check check (entity_type in ('release', 'track', 'artist')),
        constraint provider_field_observations_confidence_check check (confidence_score >= 0 and confidence_score <= 1)
      );

      create table if not exists public.registry_enrichment_suggestions (
        id uuid primary key default gen_random_uuid(),
        registry_entity_type text not null,
        registry_entity_id text not null,
        field_name text not null,
        current_value text,
        suggested_value text not null,
        provider_item_id text,
        confidence_score numeric(5,4) not null default 0,
        decision_status text not null default 'draft',
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        constraint registry_enrichment_suggestions_entity_type_check check (registry_entity_type in ('release', 'track', 'artist')),
        constraint registry_enrichment_suggestions_decision_status_check check (decision_status in ('draft', 'approved', 'rejected', 'applied', 'superseded')),
        constraint registry_enrichment_suggestions_confidence_check check (confidence_score >= 0 and confidence_score <= 1)
      );

      create table if not exists public.provider_entity_links (
        id uuid primary key default gen_random_uuid(),
        registry_entity_type text not null,
        registry_entity_id text not null,
        provider text not null,
        provider_entity_id text not null,
        provider_url text,
        match_status text not null default 'candidate',
        confidence_score numeric(5,4) not null default 0,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        constraint provider_entity_links_entity_type_check check (registry_entity_type in ('release', 'track', 'artist')),
        constraint provider_entity_links_match_status_check check (match_status in ('candidate', 'confirmed', 'rejected')),
        constraint provider_entity_links_confidence_check check (confidence_score >= 0 and confidence_score <= 1)
      );

      create index if not exists provider_field_observations_provider_item_idx
        on public.provider_field_observations (provider, provider_item_id, entity_type, field_name);

      create index if not exists registry_enrichment_suggestions_entity_status_idx
        on public.registry_enrichment_suggestions (registry_entity_type, registry_entity_id, decision_status);

      create index if not exists registry_enrichment_suggestions_provider_item_idx
        on public.registry_enrichment_suggestions (provider_item_id, confidence_score desc);

      create index if not exists provider_entity_links_provider_entity_idx
        on public.provider_entity_links (provider, provider_entity_id, match_status);

      create index if not exists provider_entity_links_registry_entity_idx
        on public.provider_entity_links (registry_entity_type, registry_entity_id);

      alter table public.provider_field_observations enable row level security;
      alter table public.registry_enrichment_suggestions enable row level security;
      alter table public.provider_entity_links enable row level security;

      grant select on public.provider_field_observations to authenticated;
      grant select on public.registry_enrichment_suggestions to authenticated;
      grant select on public.provider_entity_links to authenticated;
    `;

    if (dryRunMode) {
      console.log('\nCurrent provider enrichment staging table coverage');
      console.log('-'.repeat(80));
      console.table(existing);

      console.log('\nPlanned schema changes');
      console.log('-'.repeat(80));
      console.log('create provider_field_observations, registry_enrichment_suggestions, provider_entity_links');
      console.log('add provider/entity/status/confidence constraints and validation indexes');
      console.log('enable RLS and authenticated read grants only');
      console.log('no provider rows or canonical registry rows will be written');

      console.log('\nDry run complete. To apply schema, rerun with: npm run registry:phase8c:provider-enrichment-schema -- --write');
      return;
    }

    await pool.query(schemaSql);

    const after = await Promise.all(
      enrichmentTables.map(async (table) => ({
        table,
        exists: await hasTable(pool, `public.${table}`),
      })),
    );

    console.log('\nSchema applied');
    console.log('-'.repeat(80));
    console.table(after);

    console.log('\nPhase 8C provider enrichment staging schema complete. No provider rows or canonical registry rows were written.');
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error('\nPhase 8C provider enrichment staging schema failed.');
  console.error(error);
  process.exitCode = 1;
});
