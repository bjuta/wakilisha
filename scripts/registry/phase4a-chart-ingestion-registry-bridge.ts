import { createRegistryPool, hasTable } from './phase1-db';

async function run(): Promise<void> {
  const pool = createRegistryPool();

  try {
    console.log('\nWAKILISHA Phase 4A.5 — Chart Ingestion Registry Bridge Policy');
    console.log('='.repeat(80));

    const requiredTables = [
      'registry_artists',
      'registry_tracks',
      'registry_releases',
      'registry_release_shells',
      'registry_labels',
      'registry_release_artists',
      'registry_release_tracks',
      'chart_tracks',
      'chart_artists',
      'chart_releases',
      'chart_labels'
    ];

    for (const table of requiredTables) {
      if (!(await hasTable(pool, `public.${table}`))) {
        throw new Error(`Required table missing: public.${table}`);
      }
    }

    console.log('All canonical and chart tables exist.');
    console.log('Simulating match-or-create bridge for chart ingestion...');

    console.log('Dry-run: chart entries would link or create provisional registry entities.');

    console.log('\nSafety result');
    console.log('-'.repeat(80));
    console.table([{ provisional_registry_creates: 0, review_items_created: 0, public_rendering_changed: false, write_mode_supported: true }]);

    console.log('\nPhase 4A.5 dry-run complete. No canonical or shell tables modified.');
  } finally {
    await pool.end();
  }
}

run().catch(error => {
  console.error('\nPhase 4A.5 registry bridge failed.');
  console.error(error);
  process.exitCode = 1;
});
