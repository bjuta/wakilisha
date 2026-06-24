# WAKILISHA React Rebuild

This repository is the clean React-era home for WAKILISHA.

The first milestone is **data repair, not UI**.

WAKILISHA is moving from a WordPress plugin into a unified React app, but we are not copying WordPress into React. The old WordPress plugin and Supabase export contain the cultural data spine: tracks, artists, releases, labels, genres, charts, chart entries, media, articles, guides, old slugs, and preserved registry rows. The job now is to repair that data into a clean graph before building public pages.

## Current migration rule

Do not build frontend pages directly on the flat imported tables.

Build the repaired data layer first:

```text
raw Supabase CSVs
  -> staging tables
  -> repair scripts
  -> clean graph tables
  -> React page payloads
  -> React UI
```

## Structured Supabase import bundle

The large CSV bundle is stored outside GitHub because it is too large for normal source control.

Current source file:

```text
wakilisha_supabase_import_2026-05-30.zip
```

Google Drive handoff link:

```text
https://drive.google.com/file/d/13JlPAmlYUm-yl9kYtYqIYuykprX267YR/view?usp=drive_link
```

Before using it, make sure the Drive file permission is set to:

```text
Anyone with the link can view
```

The development team should download and unzip the bundle locally into:

```text
data/supabase-imports/2026-05-30/
```

Expected local structure:

```text
data/
  supabase-imports/
    2026-05-30/
      README.md
      manifest.json
      raw/
        wk_tracks.csv
        wk_releases.csv
        wk_labels.csv
        wk_genres.csv
        wk_chart_series.csv
        wk_chart_editions.csv
        wk_chart_entries.csv
        wk_registry_entities.csv
        wk_media_assets.csv
        wk_articles.csv
        wk_guides.csv
        wk_page_surfaces.csv
        wk_old_primary_slugs.csv
        wk_old_registry_rows.csv
        wk_wordpress_items.csv
```

The raw CSVs are intentionally ignored by Git. They are source data files, not application source code. Keep them locally under the `raw/` folder and load them through repeatable migration scripts.

## First build target: data repair

Create a migration/repair package, ideally:

```text
packages/migration
```

The repair package should produce:

```text
entity_relationships
track_artists
release_tracks
artist_genres
track_playback_sources
entity_slugs / redirect map
content_route_classification
graph coverage report
route coverage report
playback coverage report
relationship review queue
```

## First repair priority: relationship graph

The current imported dataset has the content, but the relationship graph is incomplete. `wk_entity_relationships` is empty. The relationships are recoverable from `wk_old_registry_rows`, especially old rows corresponding to track-artist links, release-track links, artist-genre links, entity slugs, chart edition items, track sources, release sources, release shell tracks, and release shell artists.

Build order:

1. CSV loader: identify each export by columns, not by filename.
2. Canonical entity index for tracks, artists, releases, labels, genres, chart entries, and media.
3. Slug resolver from old slugs, registry hrefs, and WordPress items.
4. Rebuild track to artist relationships.
5. Rebuild release to track relationships.
6. Rebuild artist to genre relationships.
7. Rebuild chart entry to track relationships.
8. Rebuild release to label relationships.
9. Rebuild entity to media relationships.
10. Generate duplicate candidates and review queue rows.

## Non-negotiables

Do not silently guess risky relationships. Flag them for review.

Review queue items must include:

```text
combined artist strings
duplicate releases
old release slugs with no current release
tracks without artist links
releases without tracklists
tracks without playable metadata
unresolved media assets
route conflicts
```

The direct `preview_url` fields are not trustworthy. Extract clean playback data from nested payloads and old source rows into `track_playback_sources`.

Release states such as `canonicalized`, `duplicate_suspected`, `review_needed`, and `rejected` must be preserved. Do not flatten all releases into a simple published list.

## Repo docs

Use these docs as the implementation guide:

```text
docs/data-repair-first-implementation-plan.md
docs/relationship-graph-build-spec.md
docs/supabase-full-data-audit.md
docs/product-behavior-harness-audit.md
docs/data-contract.md
docs/react-parity-migration-plan.md
docs/wordpress-plugin-audit.md
docs/culture-context-engine-plan.md
docs/magazine-issue-engine-plan.md
docs/magazine-issue-ui-experience-plan.md
```

## Acceptance gate before frontend work

Do not start React page design until the data repair package can prove:

```text
all CSVs load repeatedly
every main entity has a canonical identity
entity_relationships is no longer empty
every track has an artist link or review reason
every release has a tracklist or review reason
old artist-genre links are restored or flagged
chart entries link to canonical tracks or review reasons
media assets link to entities or are flagged
old routes are active, redirected, retired, or flagged
React page payloads can be generated from repaired graph queries
```

Once this gate is met, the app can safely build charts, artists, tracks, releases, labels, genres, magazine, guides, registry canvas, the player, corrections, and Admin Studio without carrying over WordPress-era structural mess.
