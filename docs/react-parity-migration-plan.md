# WAKILISHA React Parity Migration Plan

## Goal

Move WAKILISHA from a WordPress plugin into a unified React application without losing the old site's data, routes, relationships, trust history, player behavior, or editorial surfaces.

The first goal is not to make it prettier.

The first goal is: every published and drafted entity from the old WAKILISHA system must exist in the new system with the correct relationships, public/private route behavior, media, player metadata, provenance, and review state.

---

## Product migration rule

Preserve WAKILISHA behavior. Do not preserve WordPress implementation details.

### Preserve

- artists, tracks, releases, labels, genres, charts, chart editions, chart entries.
- public routes and existing URL expectations.
- chart ingestion, unresolved review, canonicalization, snapshots, audit, provenance.
- player behavior: shared player, preview fallback, Apple Music upgrade path, synchronized surfaces.
- magazine, guides, methodology, collections, registry canvas, profile/settings/corrections, audience/follow systems.
- admin capabilities needed to operate the cultural registry.

### Replace

- CPT surface shells.
- shortcode mounts.
- `template_include` routing.
- WordPress query vars.
- admin-post/wp_ajax endpoints.
- global footer injection.
- SEO plugin filters.
- dbDelta upgrade logic.
- admin-init repair side effects.

---

## Recommended target architecture

### Frontend

- React + Vite or Next.js depending on SSR/SEO decision.
- App routes are explicit and mirror canonical public URLs.
- Root providers:
  - `ThemeProvider`
  - `PlayerProvider`
  - `AuthProvider`
  - `RegistryProvider` or query client
  - `AnalyticsProvider`
  - `SearchProvider`

### Backend

- Node/TypeScript API or Next.js API routes.
- Postgres as canonical store.
- Supabase is acceptable for auth/storage/realtime if desired, but the schema should be WAKILISHA-owned, not Supabase-shaped.
- Background jobs through a queue, not request-time repair handlers.
- Object storage for media.
- Search index via Postgres FTS first; graduate to Meilisearch/Typesense/OpenSearch if needed.

### App boundaries

1. Public app
2. Admin Studio
3. API
4. Worker/jobs
5. Migration tooling
6. Shared package: entity types, route builders, validators, player contract

---

## Phase 0 — Repository foundation

### Outcome

A clean repository that is ready to receive the React application without copying WordPress compromises.

### Tasks

1. Create repo structure:
   - `apps/web`
   - `apps/api`
   - `apps/admin`
   - `packages/db`
   - `packages/types`
   - `packages/ui`
   - `packages/player`
   - `packages/migration`
   - `docs`
2. Add TypeScript, linting, formatting, test runner.
3. Add environment example files.
4. Add database migration runner.
5. Add seed/import command shell.
6. Add route contract tests.

### Acceptance criteria

- Repo builds locally.
- Database migrations can run against an empty Postgres database.
- Route builders can generate every old public URL.
- No UI shell is built before data contracts exist.

---

## Phase 1 — Data extraction from WordPress

### Outcome

A complete export of the old WAKILISHA system.

### Required exports

1. `wp_wkcharts_*` tables.
2. relevant `wp_posts` rows.
3. relevant `wp_postmeta` rows.
4. relevant `wp_terms`, `wp_term_taxonomy`, `wp_term_relationships`, `wp_termmeta` rows.
5. media attachments and upload paths.
6. users/authors required for authorship/admin history.
7. WooCommerce data only if commerce remains in scope.

### Export format

Prefer both:

- SQL dump for fidelity.
- JSONL/CSV exports for migration pipeline debugging.

### Acceptance criteria

- Old table row counts captured in `migration_runs`.
- Every old entity table has a checksum or row count baseline.
- Media reference inventory created.
- No React schema decisions are made from templates alone when DB rows are needed.

---

## Phase 2 — Canonical Postgres schema

### Outcome

A clean schema that captures WAKILISHA's real data model, not WordPress's storage tricks.

### Core tables

- `artists`
- `artist_aliases`
- `artist_sources`
- `artist_profiles`
- `genres`
- `artist_genres`
- `labels`
- `tracks`
- `track_artists`
- `track_sources`
- `releases`
- `release_tracks`
- `release_sources`
- `release_labels`
- `charts`
- `chart_series`
- `chart_editions`
- `chart_entries`
- `chart_entry_links`
- `collections`
- `collection_items`
- `entity_slugs`
- `entity_relationships`
- `field_provenance`
- `audit_events`
- `quality_scores`
- `duplicate_candidates`
- `review_issues`
- `unresolved_entities`
- `snapshots`
- `snapshot_items`
- `materialized_entity_stats`
- `media_assets`

### Editorial/audience tables

- `articles`
- `article_sections`
- `article_entity_mentions`
- `guides`
- `guide_assets`
- `magazine_sections`
- `magazine_section_items`
- `subscribers`
- `subscriber_events`
- `newsletter_issues`
- `user_entity_follows`
- `user_feed_items`
- `user_recommendations`
- `analytics_events`

### Acceptance criteria

- No table requires WordPress post ID as canonical identity.
- Old WordPress IDs can be stored as `legacy_wp_post_id` or `legacy_table_id` for traceability only.
- Slugs are owned by `entity_slugs`.
- All public routes can be resolved from canonical tables.

---

## Phase 3 — Migration pipeline

### Outcome

Repeatable import from old exports into new schema.

### Pipeline stages

1. Load raw WordPress tables into `legacy_*` staging tables.
2. Normalize strings, dates, providers, image URLs, country codes, role names, statuses.
3. Import artists.
4. Import genres and artist-genre links.
5. Import labels.
6. Import tracks and track sources.
7. Import track artists.
8. Import releases, release sources, release labels, release tracks.
9. Import charts, chart series, editions, entries.
10. Import chart entry links and unresolved entities.
11. Import snapshots, audit logs, provenance, quality scores.
12. Import editorial surfaces: magazine, guides, posts/articles, methodology, collections.
13. Import audience/user graph only after privacy review.
14. Build slugs and route map.
15. Build materialized stats.
16. Generate migration report.

### Acceptance criteria

- Every old published artist exists in new `artists`.
- Every old published/drafted label exists in new `labels`.
- Every old track exists in new `tracks` with artists where known.
- Every release has its tracklist when old data had one.
- Every chart edition has the same number of entries and rank positions.
- Every old public route either resolves to a React route or appears in a deliberate redirect/retirement list.
- No public `/tracks/` or `/releases/` directory is created as parity unless explicitly approved; old site only exposes detail pages under those bases.

---

## Phase 4 — API parity before UI

### Outcome

The backend can serve all old product surfaces as structured JSON.

### API groups

#### Registry

- `GET /api/search?q=&type=`
- `GET /api/registry/canvas`
- `GET /api/entities/:type/:id`
- `GET /api/slugs/resolve?path=`
- `GET /api/artists`
- `GET /api/artists/:slug`
- `GET /api/tracks/:artistSlug/:trackSlug`
- `GET /api/releases/:artistSlug/:releaseSlug`
- `GET /api/labels`
- `GET /api/labels/:slug`
- `GET /api/genres`
- `GET /api/genres/:slug`

#### Charts

- `GET /api/charts`
- `GET /api/charts/:series`
- `GET /api/charts/:series/:date`
- `GET /api/charts/:series/:country/:date`
- `POST /api/admin/ingest/chart-imports`
- `POST /api/admin/ingest/chart-imports/:id/publish`

#### Player

- `GET /api/player/track/:id`
- `POST /api/player/resolve-apple`
- `POST /api/player/preview-recovery`

#### Editorial

- `GET /api/magazine`
- `GET /api/articles/:slug`
- `GET /api/guides`
- `GET /api/guides/:slug`
- `GET /api/collections`
- `GET /api/collections/:slug`

#### User graph and audience

- `GET /api/me/feed`
- `GET /api/me/identity`
- `POST /api/me/follow`
- `POST /api/optins`
- `POST /api/corrections`

### Acceptance criteria

- JSON payloads can render all old pages without reading WordPress templates.
- API test fixtures are generated from migrated data.
- Route-level SEO metadata is included in route payloads.

---

## Phase 5 — Public React route parity

### Outcome

React renders all public old surfaces with unified visual language.

### Build order

1. App shell, navbar, footer, theme provider.
2. Global player provider and player shell.
3. Search modal/global search.
4. Charts index, series, edition.
5. Artists directory and artist detail.
6. Genres directory and genre detail.
7. Labels directory and label detail.
8. Track detail and release detail.
9. Registry canvas.
10. Magazine index and article detail.
11. Guides index and guide detail.
12. Collections.
13. Play and Top 10.
14. Methodology/about/contacts/FAQ/privacy.
15. Auth/profile/settings/corrections.
16. Commerce boundary if needed.

### Acceptance criteria

- Every old public route in the route map has a React equivalent, redirect, or explicit retirement decision.
- Track and release detail pages work even though their archive pages are not public parity requirements.
- Player can launch from chart rows, artist songs, release tracklists, magazine rows, and registry entity cards.
- No page feels like a separate WordPress-era island.

---

## Phase 6 — Admin Studio parity

### Outcome

WAKILISHA can operate itself without WordPress admin.

### Modules

1. Ingest Studio
2. Registry Browser
3. Entity Editor
4. Chart Edition Editor
5. Review Queue
6. Unresolved Entity Resolver
7. Release Canonicalization
8. Release Shells
9. Track Preview Recovery
10. Artist/Genre/Label Management
11. Data Quality and Duplicate Detection
12. Provenance and Audit Log
13. Graph/Relationship Repair
14. Snapshots/Integrity
15. Jobs/Batch Jobs
16. Reports/Exports
17. Editorial Intelligence
18. Magazine Section Editor
19. Guides Manager
20. Audience Registry
21. Analytics
22. Governance/Corrections
23. Settings/Appearance/Navigation

### Acceptance criteria

- Admins can ingest a new chart edition.
- Admins can resolve unmatched rows.
- Admins can edit canonical entity metadata.
- Admins can see provenance and audit history.
- Admins can refresh materialized stats.
- Admins can publish/update editorial surfaces.

---

## Phase 7 — QA, parity diff, redirects, launch

### Outcome

The React app is safe to replace the old WordPress public experience.

### QA tracks

1. Data parity QA.
2. Route parity QA.
3. Player QA.
4. SEO/social preview QA.
5. Mobile QA.
6. Auth/profile/follow QA.
7. Admin ingest QA.
8. Performance QA.

### Migration report must include

- old counts vs new counts.
- missing entities.
- duplicate collisions.
- unresolved rows.
- broken media references.
- route map coverage.
- redirect map.
- player metadata coverage: preview URL, Apple ID, ISRC, artwork.
- chart edition entry count parity.
- release tracklist parity.

### Launch criteria

- 100% of published public routes accounted for.
- 100% of chart edition rank counts match.
- 100% of old published labels and genres present.
- 100% of old public artist pages resolve.
- No missing artwork above agreed threshold.
- Player works from all major surfaces.
- Admin can publish a new chart edition in the new system.

---

## Decision points needing founder clarity

These decisions affect architecture and should not be guessed silently:

1. Should React create public `/tracks/` and `/releases/` directory pages, even though old WAKILISHA did not publicly expose those archive pages?
2. Should commerce stay inside WAKILISHA or be moved to a separate commerce platform/boundary?
3. Should WordPress remain as a headless editorial CMS for articles/guides, or should the React app own all editorial content?
4. Should Apple Music remain the primary full-track provider, or should the new player be provider-agnostic from day one?
5. Should draft/private entities migrate into the same production tables with visibility flags, or into separate editorial staging tables?
6. Should public profile routes `/@username/` remain central to the product or be postponed?
7. Should the registry canvas remain a public flagship route or become an exploratory/search component embedded across pages?

My recommendation: keep provider-agnostic data structures, keep Apple Music as the first full-track integration, migrate drafts into production tables with status/visibility flags, and keep `/registry/` as a flagship route because it expresses WAKILISHA's cultural infrastructure identity.
