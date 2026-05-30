# WAKILISHA Supabase Preliminary Data Audit

This audit is based on Supabase CSV samples exported from the current WAKILISHA Supabase database.

## Confirmed table counts

| Table | Rows |
|---|---:|
| `wk_articles` | 217 |
| `wk_artists` | 1,451 |
| `wk_chart_editions` | 87 |
| `wk_chart_entries` | 6,332 |
| `wk_chart_series` | 5 |
| `wk_entity_relationships` | 0 |
| `wk_genres` | 17 |
| `wk_labels` | 232 |
| `wk_media_assets` | 1,929 |
| `wk_registry_entities` | 7,662 |
| `wk_releases` | 169 |
| `wk_tracks` | 5,549 |

## Immediate conclusion

The Supabase database has the main WAKILISHA content inventory. It is not empty. The key entities from the WordPress import are present: tracks, artists, releases, labels, genres, chart series, chart editions, chart entries, media assets, articles, guides/page-like content, and registry entities.

However, the relationship graph is not complete: `wk_entity_relationships` currently has zero rows. The React app must therefore not assume the graph is already built. It must reconstruct relationships from chart entries, track fields, release tracklists, registry rows, raw WordPress payloads, media asset slugs, and old import metadata.

## Confirmed sample schemas

### `wk_tracks`

Observed columns include title, slug, artist name/slug, ISRC, duration, label name/slug, release title/slug, release date, artwork URL, preview URL, platform links, editable payload, immutable payload, SEO payload, status, and update time.

Sample warnings: direct release fields were empty in the sample, many preview URLs were empty, and some track metadata appears to live inside payload JSON rather than clean columns.

### `wk_releases`

Observed columns include title, slug, artist display, artist slug, release type, release date, label name/slug, artwork URL, tracklist, platform links, editable payload, immutable payload, SEO payload, status, and update time.

Sample statuses include `canonicalized`, `duplicate_suspected`, `review_needed`, and `rejected`. Release review state must be preserved in React.

### `wk_labels`

Observed columns include name, slug, country, city, logo URL, website, content HTML, excerpt HTML, editable payload, immutable payload, SEO payload, status, and update time.

Sample warnings: many fields are empty. Labels currently look more like normalized names/slugs than rich editorial pages.

### `wk_genres`

Observed columns include name, slug, description, raw metadata, status, created time, and updated time.

Sample warning: descriptions were empty in the observed sample.

### `wk_chart_series`

The sample confirmed 5 chart series with slug, title, raw metadata, status, created time, and updated time.

### `wk_chart_editions`

The sample confirmed 87 chart editions with source WordPress post id, series WordPress post id, edition id, slug, chart slug, title, chart date, cover items, raw metadata, status, created time, and updated time.

### `wk_chart_entries`

Observed columns include chart payload id, chart slug, edition id, chart date, position, previous position, title, artist name, artist slug, track slug, release slug, label name, ISRC, duration, release date, artwork URL, preview URL, source payload, and resolution status.

Important finding: `source_payload` is very rich and includes provider data from Spotify/Apple-style payloads. This table may be the strongest source for reconstructing track, artist, release, artwork, preview, label, and chart relationships.

### `wk_registry_entities`

Observed columns include entity type, id, source WordPress post id, slug, title, country, city, image URL, hero image URL, raw metadata, status, and href.

Important warning: some artist titles are combined artist strings. These should not automatically become single canonical artists in React. The migration needs a cleanup/reconciliation stage for combined artist strings.

### `wk_media_assets`

Observed columns include entity type, entity slug, role, URL, alt text, raw metadata, and source.

Sample findings: mostly release artwork, mostly external Apple Music artwork URLs, source value `old_registry`. React can use remote artwork URLs for immediate parity, but should later add a media-caching job.

## Main data risks

1. Relationship graph is empty in `wk_entity_relationships`.
2. Tracks are not fully connected to releases through direct columns.
3. Some artists are combined artist strings and need splitting/reconciliation.
4. Release statuses include duplicate/review states and must not be flattened into a simple published list.
5. Rich provider data is trapped in JSON payloads and must be parsed intentionally.
6. External media URLs should be used for parity but eventually cached.
7. Public route parity must be built from hrefs, slugs, old primary slugs, page surfaces, and registry entities, not just from table names.

## React migration implication

The current Supabase database is a valid foundation, but it is not yet a clean app-ready graph.

The React app should begin with a data repair/reconciliation layer before frontend design:

1. Build route map from slugs/hrefs.
2. Build canonical entity map.
3. Reconstruct relationships from chart entries and provider payloads.
4. Split or review combined artist strings.
5. Preserve release review statuses.
6. Extract player metadata from tracks, chart entries, and provider payloads.
7. Build materialized public page payloads only after data reconciliation.

## Next required exports

To complete the audit, export full CSVs, not only 100-row samples, for the core tables: tracks, releases, labels, genres, chart series, chart editions, chart entries, registry entities, media assets, articles, guides, page surfaces, old primary slugs, old registry rows, WordPress items, and WordPress import relationships.
