# WAKILISHA Supabase Full Data Audit

This audit is based on the full CSV archive exported from Supabase and uploaded as `Archive 2.zip`.

## What arrived

The archive contains 15 CSV exports. The original filenames are generic Supabase snippet names, so this audit maps them by their columns and row counts.

| Inferred table | Rows | Notes |
|---|---:|---|
| `wk_tracks` | 5,549 | Canonical track inventory. |
| `wk_releases` | 169 | Release inventory with review/canonicalization statuses. |
| `wk_labels` | 232 | Label inventory, mostly names/slugs. |
| `wk_genres` | 17 | Genre inventory. |
| `wk_chart_series` | 5 | Chart series inventory. |
| `wk_chart_editions` | 87 | Chart edition inventory. |
| `wk_chart_entries` | 6,332 | Published chart rows with rich source payloads. |
| `wk_registry_entities` | 7,662 | Unified entity registry view/table. |
| `wk_media_assets` | 1,929 | Media/artwork references. |
| `wk_articles` | 11,511 | Large article/post-like export. Needs cleanup/classification. |
| `wk_guides` | 3 | Field guides. |
| `wk_page_surfaces` | 1,449 | Pages and surface-like documents. Needs cleanup/classification. |
| `wk_old_primary_slugs` | 8,204 | Old canonical entity slugs. Critical for redirects and public route parity. |
| `wk_old_registry_rows` | 42,162 | Raw preserved rows from old WordPress registry tables. Critical for relationship rebuild. |
| `wk_wordpress_items` | 1,867 | Raw WordPress items. Critical for content/page migration. |

## Big conclusion

The Supabase export contains the full WAKILISHA content spine. The React migration can work from this dataset.

However, the dataset is not yet React-ready as a clean relationship graph. The current Supabase tables preserve the imported content and a large amount of raw old registry data, but relationship repair and normalization still need to happen before frontend work should be considered complete.

The key thing: `wk_entity_relationships` is empty, but the raw relationship data is recoverable from `wk_old_registry_rows`.

## Confirmed old registry row sources

`wk_old_registry_rows` contains 42,162 rows. The important source tables inside it include:

| Old source table | Rows | Migration meaning |
|---|---:|---|
| `wp_wkcharts_entity_slugs` | 8,204 | Canonical/historical slugs. |
| `wp_wkcharts_track_artists` | 7,295 | Track-to-artist relationships. |
| `wp_wkcharts_edition_items` | 6,332 | Chart edition entries. |
| `wp_wkcharts_tracks` | 5,549 | Old canonical tracks. |
| `wp_wkcharts_release_tracks` | 4,293 | Release tracklists. |
| `wp_wkcharts_track_sources` | 2,006 | Track provider/source payloads. |
| `wp_wkcharts_artists` | 1,712 | Old canonical artists. |
| `wp_wkcharts_release_sources` | 1,487 | Release provider/source payloads. |
| `wp_wkcharts_release_shell_tracks` | 1,026 | Release shell tracklists. |
| `wp_wkcharts_track_stats` | 710 | Track stats. |
| `wp_wkcharts_edition_snapshot_items` | 700 | Snapshot rows. |
| `wp_wkcharts_release_shell_artists` | 648 | Release shell artist links. |
| `wp_waki_music_artists` | 458 | Older music artist layer. |
| `wp_waki_music_artist_profiles` | 417 | Older artist profile layer. |
| `wp_wkcharts_release_admin_history` | 249 | Release admin/review history. |
| `wp_wkcharts_labels` | 232 | Old labels. |
| `wp_wkcharts_ingest_runs` | 201 | Ingestion run history. |
| `wp_waki_artists` | 189 | Older artist source. |
| `wp_wkcharts_release_shells` | 169 | Release shells. |
| `wp_wkcharts_artist_genres` | 131 | Artist-genre relationships. |
| `wp_wkcharts_edition_snapshots` | 77 | Chart edition snapshots. |
| `wp_wkcharts_editions` | 77 | Old chart editions. |

This means the relationship graph is missing in the new table, not lost. It should be rebuilt from the raw preserved rows.

## Entity inventory

### Tracks

Rows: 5,549

Direct-column coverage:

- Artist name: 5,549 / 5,549
- Artist slug: 5,549 / 5,549
- ISRC: 1,253 / 5,549
- Duration: 4,422 / 5,549
- Label name: 1,232 / 5,549
- Label slug: 5,549 / 5,549
- Release title: 0 / 5,549
- Release slug: 0 / 5,549
- Release date: 1,068 / 5,549
- Artwork URL: 1,483 / 5,549
- Direct preview URL: 0 usable direct URLs
- Platform links: 5,549 / 5,549
- Editable payload: 5,549 / 5,549
- Immutable payload: 5,549 / 5,549

Important warning: the direct `preview_url` column is not a reliable preview URL field. In the old payloads, actual preview URLs are often stored under fields such as `preview_duration_ms` inside JSON. This must be corrected in the React schema.

### Releases

Rows: 169

Coverage:

- Artist display: 169 / 169
- Artist slug: 169 / 169
- Release type: 169 / 169
- Release date: 169 / 169
- Label name: 169 / 169
- Label slug: 169 / 169
- Artwork URL: 169 / 169
- Tracklist: 169 / 169
- Platform links: 169 / 169
- Content HTML: 169 / 169
- Excerpt HTML: 169 / 169
- Editable payload: 169 / 169
- Immutable payload: 169 / 169

Release statuses:

- `canonicalized`: 124
- `duplicate_suspected`: 43
- `review_needed`: 1
- `rejected`: 1

Migration rule: do not flatten these into simple published releases. The review/canonicalization status is important operational data.

### Registry entities

Rows: 7,662

Breakdown:

- Track: 5,549
- Artist: 1,712
- Label: 232
- Release: 169

Href coverage:

- Artist: 1,712 / 1,712
- Track: 5,549 / 5,549
- Release: 169 / 169
- Label: 232 / 232

Image coverage:

- Track: 1,483 / 5,549
- Artist: 277 / 1,712
- Release: 169 / 169
- Label: 0 / 232

### Media assets

Rows: 1,929

Breakdown:

- Track media: 1,483
- Artist media: 277
- Release media: 169

Every observed media asset has role `primary`.

Most media URLs are external provider artwork URLs. For parity, React can use these immediately. Later, WAKILISHA should add a media-caching job so the product is not permanently dependent on Apple/Spotify image URL lifecycles.

### Chart series and editions

Chart series rows: 5

Series:

- `2026` — Top Kenyan Songs Released in 2026
- `gengetone` — Top Gengetone Songs
- `kenya` — Top 100 Songs in Kenya
- `rnb` — Top Kenyan R&B Songs
- `test` — Test

Chart editions: 87

Editions by chart slug:

- `rnb`: 27
- `kenya`: 22
- `gengetone`: 21
- `2026`: 17

Chart entries: 6,332

Entries by chart slug:

- `kenya`: 2,000
- `rnb`: 2,000
- `2026`: 1,340
- `gengetone`: 992

Important warning: chart entry rows point to only 435 unique track slugs and 205 unique artist slugs. That is expected for recurring chart editions, but the React migration must preserve appearances over time rather than deduplicating away historical chart positions.

## Player data finding

The visible `preview_url` columns are not trustworthy. Many values look like provider names or timestamps rather than URLs.

The richer old payloads contain actual playable preview URLs. In the chart-entry source payloads, 5,253 rows expose actual preview URLs inside the nested track payload.

React migration rule:

- Do not build player metadata only from the direct `preview_url` columns.
- Create a player metadata extraction job that checks direct columns, immutable payloads, chart-entry source payloads, track source rows, release source rows, and old registry rows.
- Store clean player data in an explicit `track_playback_sources` table or equivalent.

## Old slug inventory

`wk_old_primary_slugs` has 8,204 rows:

- Track: 5,547
- Artist: 1,712
- Release: 708
- Label: 237

This is critical for React route parity and redirects.

Important nuance: old primary slugs contain 708 release slugs, while the current `wk_releases` table has only 169 releases. This means the migration must preserve historical release routes and decide which ones map to current canonical releases, retired releases, duplicates, or redirects.

## WordPress item inventory

`wk_wordpress_items` has 1,867 rows.

Observed post types include:

- `wakilisha_artist`: 1,453
- `post`: 217
- `wk_chart_edition`: 87
- `page`: 72
- `wk_genre_page`: 17
- `wk_chart_series`: 5
- `wk_field_guide`: 3
- `wk_correction_page`: 2
- `wk_settings_surface`: 2
- `wk_registry_track`: 2
- `wk_top10_surface`: 2
- `wk_registry_release`: 1
- `wk_magazine_surface`: 1
- `wk_registry_label`: 1
- `wk_labels_surface`: 1
- `wk_profile_surface`: 1

This confirms that many public pages were WordPress shell/surface pages and should not be blindly copied as independent React data models.

## Article and page-surface warning

The full export has:

- `wk_articles`: 11,511 rows
- `wk_page_surfaces`: 1,449 rows

But earlier table-count samples showed only 217 articles. This likely means the full export named as `wk_articles` includes a broader post/content export, or Supabase query exports were not named consistently.

React migration rule:

Before creating article routes, classify content rows by WordPress post type, status, permalink, and whether they are actual magazine/editorial posts or app/page shells.

## What is clean enough to use now

These can be used as first-class React data foundations after minor cleanup:

- `wk_chart_series`
- `wk_chart_editions`
- `wk_chart_entries`
- `wk_genres`
- `wk_labels`
- `wk_releases`
- `wk_media_assets`
- `wk_old_primary_slugs`
- `wk_wordpress_items`
- `wk_old_registry_rows`

## What needs repair before React depends on it

- Track-to-artist relationships must be rebuilt from `wp_wkcharts_track_artists`.
- Release tracklists must be rebuilt from `wp_wkcharts_release_tracks` and release shell rows.
- Artist-to-genre relationships must be rebuilt from `wp_wkcharts_artist_genres`.
- Player preview URLs must be extracted from nested payloads.
- Combined artist strings must be reviewed and split where appropriate.
- Release duplicates/review-needed statuses must be respected.
- Old release slugs must be resolved to current releases, redirects, duplicates, or retired pages.
- Articles/pages must be classified so app shell pages do not become editorial content.

## Recommended next migration phase

Do not start with UI.

Start with a data repair package:

1. Import the CSVs into staging tables.
2. Rebuild entity slugs from `wk_old_primary_slugs` and old registry rows.
3. Rebuild `entity_relationships` from old relationship tables.
4. Create clean `track_artists` from old `wp_wkcharts_track_artists`.
5. Create clean `release_tracks` from old `wp_wkcharts_release_tracks` and shell rows.
6. Create clean `artist_genres` from old `wp_wkcharts_artist_genres`.
7. Extract playable preview URLs into a clean playback table.
8. Classify articles/pages/surfaces.
9. Build route coverage report.
10. Only then build the React public pages.

## Migration stance

The data is big, but it is usable. The main work is not data entry. The main work is relationship reconstruction, route preservation, and cleaning old WordPress compromise fields into explicit React-era tables.
