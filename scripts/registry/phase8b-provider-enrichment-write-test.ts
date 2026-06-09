import pg from 'pg';
import { AppleMusicAdapter } from '../../src/services/registry/provider-adapters/apple-music-adapter';
import { PostgresProviderEnrichmentWriteStore } from '../../src/services/registry/provider-enrichment/provider-enrichment-write-store';
import { runPhase8ProviderEnrichment } from './phase8-provider-enrichment-pipeline';

const { Pool } = pg;

type PgPool = InstanceType<typeof Pool>;

function getArg(name: string): string | null {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? null;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function run(): Promise<void> {
  const albumIdOrUrl = getArg('album-id') ?? getArg('url');
  const storefront = getArg('storefront') ?? 'ke';
  const includeTrackLinks = hasFlag('include-track-links') || hasFlag('include-all-links');
  const includeArtistLinks = hasFlag('include-artist-links') || hasFlag('include-all-links');
  const write = hasFlag('write');

  if (!albumIdOrUrl) {
    throw new Error('Provide --album-id=<apple catalog album id> or --url=<apple music album url>.');
  }

  console.log('\nWAKILISHA Phase 8B Provider Enrichment Write Test');
  console.log('='.repeat(80));
  console.log(`Mode: ${write ? 'WRITE' : 'DRY RUN'}`);
  console.log(`Album input: ${albumIdOrUrl}`);
  console.log(`Storefront: ${storefront}`);
  console.log(`Include track links: ${includeTrackLinks}`);
  console.log(`Include artist links: ${includeArtistLinks}`);

  const adapter = AppleMusicAdapter.fromEnv(storefront);
  const release = await adapter.fetchAlbum(albumIdOrUrl, { storefront });

  let pool: PgPool | null = null;

  try {
    const writeStore = write
      ? (() => {
          const connectionString = process.env.DATABASE_URL;
          if (!connectionString) {
            throw new Error('DATABASE_URL is required when --write is passed.');
          }

          pool = new Pool({ connectionString });
          return new PostgresProviderEnrichmentWriteStore({ pool });
        })()
      : undefined;

    await runPhase8ProviderEnrichment({
      releases: [release],
      dryRun: !write,
      writeStore,
      includeTrackLinks,
      includeArtistLinks,
    });
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

run().catch((error) => {
  console.error('\nPhase 8B provider enrichment write test failed.');
  console.error(error);
  process.exitCode = 1;
});
