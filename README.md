# WAKILISHA

WAKILISHA is a cultural platform, beginning with music.

This repository is the React-era production home for the public platform, Registry, editorial tools, Community, shared Trust systems, Media, and the long-running cultural production programme.

The project began with WordPress and Supabase data repair. That foundation remains important project history, but it is no longer the current implementation phase.

## Current programme

Read these first:

```text
docs/institute/PROGRAMME_STATUS.md
docs/roadmap/wakilisha-master-programme-map.md
docs/institute/two-workspace-pilot-audit-and-build-plan.md
```

As of 30 August 2026:

- Phases 0 through 6 are complete.
- Phase 7A Video publication authority is current.
- The Resource-kernel convergence and post-kernel hardening are closed.
- K5A governed Video editorial commands/admin reads are production accepted.
- K5B purpose-built Video Editor composition is production accepted at 67 migrations, head `20260830102151_phase_7a_k5b_video_editor_shared_show_catalog`.
- Phase 7A remains open until one real Video satisfies the canonical internal publication-authority exit gate.

The roadmap is an orientation tool. Building WAKILISHA naturally exposes adjacent work, and those detours can materially improve the platform. When they do, record what changed and reconcile the map so the project remains understandable.

Do not infer the current programme phase from old parity documents, local milestone labels, or chat history. Use the current programme status and master map.

## Historical foundation: data repair first

The React rebuild began with data repair rather than UI work.

WAKILISHA moved from a WordPress plugin into a unified React app, but the goal was never to copy WordPress into React. The old WordPress plugin and Supabase export contained the cultural data spine: tracks, artists, releases, labels, genres, charts, chart entries, media, articles, guides, old slugs, and preserved Registry rows. The first job was to repair that data into a clean graph before building public pages.

That historical migration rule was:

```text
raw Supabase CSVs
  -> staging tables
  -> repair scripts
  -> clean graph tables
  -> React page payloads
  -> React UI
```

The sections below preserve that original migration context because it still matters when working on Registry history, imported relationships, old routes, and one-time repair logic.

## Structured Supabase import bundle

The large CSV bundle is stored outside GitHub because it is too large for normal source control.

Historical source file:

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

## Historical first repair target

The repair package was designed to produce:

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

## Historical first repair priority: relationship graph

The imported dataset contained the content, but the relationship graph was incomplete. `wk_entity_relationships` was empty. The relationships were recoverable from `wk_old_registry_rows`, especially old rows corresponding to track-artist links, release-track links, artist-genre links, entity slugs, chart edition items, track sources, release sources, release shell tracks, and release shell artists.

Original build order:

1. CSV loader: identify each export by columns, not by filename.
2. Canonical entity index for tracks, artists, releases, labels, genres, chart entries, and media.
3. Slug resolver from old slugs, Registry hrefs, and WordPress items.
4. Rebuild track to artist relationships.
5. Rebuild release to track relationships.
6. Rebuild artist to genre relationships.
7. Rebuild chart entry to track relationships.
8. Rebuild release to label relationships.
9. Rebuild entity to media relationships.
10. Generate duplicate candidates and review queue rows.

## Data-repair non-negotiables

Do not silently guess risky relationships. Flag them for review.

Review queue items should include:

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

## Repository documentation

Current programme orientation:

```text
docs/institute/PROGRAMME_STATUS.md
docs/roadmap/wakilisha-master-programme-map.md
docs/roadmap/post-phase-5-interlude-ledger.md
docs/roadmap/document-authority-map.md
docs/institute/two-workspace-pilot-audit-and-build-plan.md
```

Historical repair and parity references include:

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
docs/parity/
```

Read `docs/parity/README.md` before treating parity-phase numbering as current programme numbering.

## Historical frontend acceptance gate

The original data-repair programme required the following before React page design:

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

That gate belongs to the repository's foundation history. The current programme now builds on the much larger production system documented above.
