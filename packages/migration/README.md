# WAKILISHA Migration Package

This package rebuilds the WAKILISHA relationship graph from raw Supabase CSV exports before any React UI work begins.

## Commands

### 1. Audit CSV imports

```bash
npm run migration:audit
```

Detects all CSV files in `data/supabase-imports/2026-05-30/raw/` by column signatures, not filenames.

Produces:
- `packages/migration/reports/csv-audit.md`
- `packages/migration/reports/csv-audit.json`

### 2. First graph pass

```bash
npm run migration:graph
```

Builds a basic relationship graph from the flat imported tables.

Produces:
- `packages/migration/reports/entity-relationships.seed.json`
- `packages/migration/reports/relationship-review-queue.json`
- `packages/migration/reports/graph-coverage.json`
- `packages/migration/reports/graph-summary.md`

### 3. Full repair pass

```bash
npm run migration:repair
```

Deeply parses `wk_old_registry_rows` to reconstruct the full relationship graph:
- Track artists from `wp_wkcharts_track_artists`
- Release tracks from `wp_wkcharts_release_tracks` and `wp_wkcharts_release_shell_tracks`
- Artist genres from `wp_wkcharts_artist_genres`
- Entity slugs and redirects from `wp_wkcharts_entity_slugs` and `wk_old_primary_slugs`
- Playback sources from `wp_wkcharts_track_sources` and chart entry payloads
- Content classification from `wk_articles`, `wk_guides`, `wk_page_surfaces`, and `wk_wordpress_items`

Produces:
- `packages/migration/reports/track-artists.seed.json`
- `packages/migration/reports/release-tracks.seed.json`
- `packages/migration/reports/artist-genres.seed.json`
- `packages/migration/reports/track-playback-sources.seed.json`
- `packages/migration/reports/track-playback-sources.full.json`
- `packages/migration/reports/entity-slugs.seed.json`
- `packages/migration/reports/entity-slugs.full.json`
- `packages/migration/reports/entity-relationships.full.json`
- `packages/migration/reports/relationship-review-queue.full.json`
- `packages/migration/reports/chart-entry-tracks.seed.json`
- `packages/migration/reports/content-classification.json`
- `packages/migration/reports/content-coverage.json`
- `packages/migration/reports/graph-coverage.json`
- `packages/migration/reports/route-coverage.json`
- `packages/migration/reports/route-coverage.md`
- `packages/migration/reports/playback-coverage.json`
- `packages/migration/reports/playback-coverage.md`
- `packages/migration/reports/migration-summary.json`
- `packages/migration/reports/migration-summary.md`

### 4. Generate seed SQL

```bash
npm run migration:seed
```

Generates runnable SQL from the repair reports to populate the `wakilisha_repaired` schema.

Produces:
- `packages/db/migrations/003_seed_repaired_data.sql`

## Environment variables

- `WAKILISHA_IMPORT_DIR` — Override the CSV import directory
- `WAKILISHA_REPORT_DIR` — Override the report output directory
- `WAKILISHA_SEED_DIR` — Override the seed SQL output directory

## Acceptance gate

The repair pass prints an acceptance gate summary. All checks must pass before React UI work begins:

- All CSVs load repeatedly
- Every main entity has a canonical identity
- `entity_relationships` is no longer empty
- Every track has an artist link or review reason
- Every release has a tracklist or review reason
- Old artist-genre links are restored or flagged
- Chart entries link to canonical tracks or review reasons
- Media assets link to entities or are flagged
- Old routes are active, redirected, retired, or flagged
- React page payloads can be generated from repaired graph queries