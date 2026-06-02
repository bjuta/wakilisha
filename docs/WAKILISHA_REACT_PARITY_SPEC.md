# WAKILISHA React Parity Implementation Spec

## Purpose
Rebuild the WAKILISHA WordPress plugin workflows and data surfaces in the React app using canonical entity tables and deterministic surfaces, avoiding old bugs.

---

## 1. Data Foundation

### 1.1 Raw Import / Staging
- Tables: `wk_old_registry_rows`, `wk_registry_entities`
- Preserve all statuses: draft, published, archived
- Keep provenance: `source_table`, `source_row_id`, `import_run_id`, `raw_meta`

### 1.2 Canonical Entities
- Artists: `wk_artists` with bio, gender, country, ISO2, act_type, images, members, aliases, streaming IDs, raw_meta
- Releases: `wk_releases` with title, type, primary artist, label, artwork, tracks, platform IDs, country, ISO2, raw_meta
- Tracks: `wk_tracks` with release, artist, duration, credits, ISRC, lyrics, featured artists, artwork, platform IDs, raw_meta
- Labels: `wk_labels` with bio, country, logo, website, social links, raw_meta
- Genres: `wk_genres` with description, parent, image, raw_meta
- Editorial: `wk_editorial_content` with slug, title, dek, body, excerpt, author, section, tags, hero image, published date, raw_meta

### 1.3 Surface Tables / Views
- `wk_surface_magazine`
- `wk_surface_guides`
- `wk_surface_artists`
- `wk_surface_releases`
- `wk_surface_tracks`
- `wk_surface_labels`
- `wk_surface_genres`
- All read-only for frontend, no repaired table data as primary source

### 1.4 Chart Truth
- `wk_chart_*_v2` remains canonical for programs, editions, entries, methodology, eligibility
- Chart entries link to canonical tracks/artists

### 1.5 Repair / QA Layer
- `wakilisha_repaired.*` for linking, enrichment, QA, audit, review only
- Never for primary identity or public surfaces

---

## 2. API Refactor

- `/repaired/*` → `/content/*` endpoints
- Repository and API layers:
  - `scripts/charts/content-surfaces-repository.ts`
  - `scripts/charts/content-surfaces-api.ts`
- Each endpoint reads **only** from canonical surface
- All fields included for future UI: bio, gender, act_type, discography, country, ISO2, images, release/track counts

---

## 3. Frontend Changes

- Magazine, Artists, Releases, Tracks, Labels, Genres pages consume `contentSurfaces` API
- Update TS models to include new fields for bio, discography, metrics
- Deduplicate, filter by status (published/public only for frontend)
- Preserve existing React UI layouts if working; extend to render new fields later

---

## 4. Admin Workflows

- Registry Browser: stats strip, tabs, filters, health chips, bulk actions, inspector drawer
- Chart Ingest: stepper workflow
  - Readiness → Family → Sources → Filters → Dry Run → Draft/Publish
- Settings: split into Integrations, Surface Assets, Notifications, Methodology/Copy

---

## 5. Implementation Phases

1. Capture old workflow (parity HTML / screenshots)
2. Build canonical entity tables from import
3. Create surface views
4. API endpoints wired to surfaces
5. Update frontend to consume `/content/*`
6. Registry Browser and Ingest parity
7. Entity workbenches (artist, release, track, label, genre)
8. Surface Ops parity (magazine, guides, hero, SEO, methodology)
9. Analytics, provenance, governance, QA

---

## 6. Acceptance Criteria

- Articles and guides visible with metadata
- Artists show bio, country, ISO2, gender, act_type, discography counts
- Releases and tracks display artwork, label, type, year, track counts
- Charts remain linked to canonical tracks/artists
- No repaired table is used for primary identity
- Frontend and API are deterministic, fully covered by canonical surfaces
- Admin workflows preserved but redesigned for React

---

## 7. Repo Artifacts

- `packages/db/migrations/004_content_surfaces.sql`
- `packages/migration/src/content/*` scripts
- `scripts/charts/content-surfaces-api.ts`
- `scripts/charts/content-surfaces-repository.ts`
- Frontend client updates from `repairedContent` → `contentSurfaces`
- TS models updated to include new metadata fields

---

**Dev Note:**
> Treat the old plugin as workflow evidence. Rebuild its capabilities on top of canonical entity tables and deterministic content surfaces, connecting both API and frontend exclusively to those surfaces. Do not port repaired tables as identity sources.