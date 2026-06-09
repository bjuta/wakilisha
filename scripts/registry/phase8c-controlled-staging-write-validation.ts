import pg from 'pg';
import { AppleMusicAdapter } from '../../src/services/registry/provider-adapters/apple-music-adapter';
import { PostgresProviderEnrichmentWriteStore } from '../../src/services/registry/provider-enrichment/provider-enrichment-write-store';
import { runPhase8ProviderEnrichment } from './phase8-provider-enrichment-pipeline';

const { Pool } = pg;

type TableName =
  | 'provider_field_observations'
  | 'registry_enrichment_suggestions'
  | 'provider_entity_links';

type TableCounts = Record<TableName, number>;

type ValidationDelta = {
  table: TableName;
  before: number;
  after: number;
  delta: number;
  expected: number;
  status: 'PASS' | 'FAIL';
};

const STAGING_TABLES: TableName[] = [
  'provider_field_observations',
  'registry_enrichment_suggestions',
  'provider_entity_links',
];

function getArg(name: string): string | null {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? null;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function tableExists(pool: pg.Pool, tableName: TableName): Promise<boolean> {
  const result = await pool.query(
    `
      select exists (
        select 1
        from information_schema.tables
        where table_schema = 'public'
          and table_name = $1
      ) as exists
    `,
    [tableName],
  );

  return Boolean(result.rows[0]?.exists);
}

async function countTableRows(pool: pg.Pool, tableName: TableName): Promise<number> {
  const result = await pool.query(`select count(*)::int as count from public.${tableName}`);
  return Number(result.rows[0]?.count ?? 0);
}

async function getCounts(pool: pg.Pool): Promise<TableCounts> {
  const entries = await Promise.all(
    STAGING_TABLES.map(async (table) => [table, await countTableRows(pool, table)] as const),
  );

  return Object.fromEntries(entries) as TableCounts;
}

async function assertTablesExist(pool: pg.Pool): Promise<void> {
  const results = await Promise.all(
    STAGING_TABLES.map(async (table) => ({ table, exists: await tableExists(pool, table) })),
  );

  const missing = results.filter((result) => !result.exists);

  console.log('\nStaging table preflight');
  console.table(results);

  if (missing.length > 0) {
    throw new Error(`Missing required staging table(s): ${missing.map((result) => result.table).join(', ')}`);
  }
}

function buildDeltas(
  before: TableCounts,
  after: TableCounts,
  expected: TableCounts,
): ValidationDelta[] {
  return STAGING_TABLES.map((table) => {
    const delta = after[table] - before[table];

    return {
      table,
      before: before[table],
      after: after[table],
      delta,
      expected: expected[table],
      status: delta === expected[table] ? 'PASS' : 'FAIL',
    };
  });
}

async function run(): Promise<void> {
  const albumIdOrUrl = getArg('album-id') ?? getArg('url');
  const storefront = getArg('storefront') ?? 'ke';
  const includeTrackLinks = hasFlag('include-track-links') || hasFlag('include-all-links');
  const includeArtistLinks = hasFlag('include-artist-links') || hasFlag('include-all-links');
  const applyWrite = hasFlag('write');

  if (!albumIdOrUrl) {
    throw new Error('Provide --album-id=<apple catalog album id> or --url=<apple music album url>.');
  }

  if (!applyWrite) {
    throw new Error('Phase 8C is a controlled staging write validator. Re-run with --write when ready.');
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required for Phase 8C controlled staging write validation.');
  }

  const pool = new Pool({ connectionString });

  try {
    console.log('\nWAKILISHA Phase 8C Controlled Staging Write Validation');
    console.log('='.repeat(80));
    console.log(`Album input: ${albumIdOrUrl}`);
    console.log(`Storefront: ${storefront}`);
    console.log(`Include track links: ${includeTrackLinks}`);
    console.log(`Include artist links: ${includeArtistLinks}`);
    console.log('Canonical registry writes: DISABLED');

    await assertTablesExist(pool);

    const beforeCounts = await getCounts(pool);

    console.log('\nBefore counts');
    console.table([beforeCounts]);

    const adapter = AppleMusicAdapter.fromEnv(storefront);
    const release = await adapter.fetchAlbum(albumIdOrUrl, { storefront });
    const writeStore = new PostgresProviderEnrichmentWriteStore({ pool });

    const result = await runPhase8ProviderEnrichment({
      releases: [release],
      dryRun: false,
      writeStore,
      includeTrackLinks,
      includeArtistLinks,
    });

    const afterCounts = await getCounts(pool);

    console.log('\nAfter counts');
    console.table([afterCounts]);

    const expectedDeltas: TableCounts = {
      provider_field_observations: result.writtenFieldObservationCount,
      registry_enrichment_suggestions: result.writtenEnrichmentSuggestionCount,
      provider_entity_links: result.writtenProviderEntityLinkCount,
    };

    const deltas = buildDeltas(beforeCounts, afterCounts, expectedDeltas);

    console.log('\nValidation deltas');
    console.table(deltas);

    const failures = deltas.filter((delta) => delta.status === 'FAIL');
    if (failures.length > 0) {
      throw new Error('Phase 8C validation failed: one or more staging table deltas did not match written counts.');
    }

    console.log('\nPhase 8C validation passed. Staging writes confirmed. No canonical registry writes performed.');
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error('\nPhase 8C controlled staging write validation failed.');
  console.error(error);
  process.exitCode = 1;
});
