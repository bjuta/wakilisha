# WAKILISHA Chart Ingestion Studio

## 1. Project Description
The Chart Ingestion Studio is the admin backend for WAKILISHA's flagship chart product. It provides a serious, audit-focused workflow for ingesting, normalizing, matching, reviewing, ranking, and publishing chart editions. The React frontend serves as the reference implementation for how the ingestion system should feel, behave, and expose state.

## 2. Admin Routes

### Production Engine (New — WordPress-like Admin Shell)
- `/admin` — Dashboard overview (KPIs, attention items, recent activity, system health)
- `/admin/content/articles` — Article list view (read-only Phase 1)
- `/admin/content/guides` — Guide list view
- `/admin/content/pages` — Page/surface list view
- `/admin/registry/artists` — Artist list view
- `/admin/registry/tracks` — Track list view
- `/admin/registry/releases` — Release list view
- `/admin/registry/labels` — Label list view
- `/admin/registry/genres` — Genre list view
- `/admin/media/library` — Media library
- `/admin/media/missing` — Missing images
- `/admin/media/broken` — Broken media links
- `/admin/review/queue` — Review queue
- `/admin/imports/jobs` — Import jobs

### Primary Routes
- `/admin/charts/dashboard` — KPIs, active jobs, failed jobs, latest editions
- `/admin/charts/families` — Chart family management
- `/admin/charts/ingest` — Ingest Studio (provider-based new run creation + KPIs)
- `/admin/charts/ingest-runs` — All provider-based ingest runs list
- `/admin/charts/ingest-runs/:runId` — Run detail with live polling + pipeline stages
- `/admin/charts/editions` — Published editions
- `/admin/charts/snapshots` — Immutable snapshots
- `/admin/charts/ingest-health` — API Health & Endpoint Map

### Operations Routes
- `/admin/charts/review-queue` — Global review issue queue
- `/admin/charts/no-match` — Unresolved canonical match gaps
- `/admin/charts/release-shells` — Auto-created release shells
- `/admin/charts/canon-gaps` — Canon entity gaps
- `/admin/charts/integration-map` — WordPress integration map
- `/admin/charts/public-api-qa` — Public API QA
- `/admin/charts/ingest-jobs` — Legacy CSV ingest jobs
- `/admin/charts/ingest-jobs/:jobId` — Legacy job detail wizard

### Settings Routes
- `/admin/settings` — Settings Hub
- `/admin/settings/chart-defaults` — Chart defaults
- `/admin/settings/integrations` — Provider integrations
- `/admin/settings/frontend-appearance` — Appearance
- `/admin/settings/navigation` — Navigation
- `/admin/settings/audit` — Audit log

## 3. Sprint Progress

### ✅ Sprint 1 — Mock foundation + CSV pipeline
- Full mock adapter (`api.ts`) with in-memory store
- `client.ts` adapter selector (mock vs WordPress)
- `contracts.ts` runtime shape assertions
- `normalizers.ts` WP ↔ frontend field mapping
- `wpAdapter.ts` WordPress HTTP layer + 35+ legacy endpoints
- `WORDPRESS_CHART_ENDPOINTS` contract map in `client.ts`
- CSV discovery, mapping, normalization, draft creation
- Legacy ingest job wizard (8-step stepper)
- All admin pages built with mock data

### ✅ Sprint 2 — Provider-based runs + API Health page
- **`runDryRunWp`, `commitIngestRunWp`, etc.** — WP v2 adapter functions for provider-based runs
- **`INGEST_STUDIO_WP_ENDPOINTS`** — 11 Sprint 2 endpoint definitions with path/method/description
- **Live polling** on run detail page
- **API Health page** `/admin/charts/ingest-health`
- **Pipeline progress bar** on run detail
- **Breadcrumb + back nav** on run detail
- **Source URLs panel** on run detail

### ✅ Sprint 3 — Real Provider Fetch + Normalization (COMPLETE)
- `spotifyFetch.ts`, `appleMusicFetch.ts`, `providerFetch.ts`, `normalize.ts`
- `mockTracks.ts` — 50+ African tracks
- `ingestStudioMock.ts` dry run pipeline with real provider fetch
- Partial failure handling
- Raw payloads persisted in `run.notes`
- Edge Function `charts-ingest-dry-run` ready

### ✅ Sprint 4 — Entity Enrichment Hardening + V2 Alignment (COMPLETE)
- **Canonical Matching Engine** (`canonicalMatch.ts`)
- **Enrichment Pipeline** (`enrichment.ts`)
- `checkEnrichmentCredentials()` structured credential errors
- Updated UI: Pipeline Panel, Provider Health Panel, etc.

### ✅ Sprint 5 — Admin Charts Refactor + V2 Charts Integration (IN PROGRESS)
- V2 ontology alignment
- V2 endpoint map for public API
- V2 data connection via `v2Adapter.ts`

### ✅ Phase 1 — Admin Shell + Dashboard + Read-only Visibility (NEW)
- **AdminShell** layout with full sidebar navigation (11 sections: Dashboard, Content, Charts, Registry, Commerce, Media, Relationships, Review, Imports, Settings, Tools)
- **Dashboard** with real Supabase counts, KPI cards, attention items, recent activity, quick actions, system health
- **Read-only list views** for Articles, Guides, Pages, Artists, Tracks, Releases, Labels, Genres
- **Media Library** with real media assets
- **Review Queue** linking to charts review queue
- **Import Jobs** with real ingestion runs
- **Routing** wired under `/admin/*`
- **Admin link** added to public site top bar

## 4. Adapter Architecture

```
components/pages
    ↓ import from
client.ts  (single boundary — selects adapter based on VITE_CHARTS_INGESTION_MODE)
    ↓ routes to
api.ts (mock)       OR       wpAdapter.ts (WordPress REST)
    ↓
normalizers.ts (camelCase ↔ snake_case)
contracts.ts (shape assertions in DEV)
```

## 5. V2 Endpoint Map (Sprint 5+)

| Method | Path | Frontend function |
|---|---|---|
| GET | /wp-json/wakilisha/v2/charts | `getV2ChartFamilies()` |
| GET | /wp-json/wakilisha/v2/charts/{programSlug} | `getV2ChartFamily(slug)` |
| GET | /wp-json/wakilisha/v2/charts/{programSlug}/latest | `getV2LatestChartEdition(slug)` |
| GET | /wp-json/wakilisha/v2/charts/{programSlug}/{editionSlug} | `getV2ChartEdition(slug, edition)` |
| GET | /wp-json/wakilisha/v2/charts/{programSlug}/{editionSlug}/entries | `getV2ChartEditionEntries(slug, edition)` |
| GET | /wp-json/wakilisha/v2/charts/resolve/{slug} | `resolveV2Alias(slug)` |
| GET | /wp-json/wakilisha/v2/tracks/{trackSlug}/chart-history | `getV2TrackChartHistory(slug)` |
| GET | /wp-json/wakilisha/v2/charts/health | `testPublicV2Connection()` |

## 6. Phase Plan (PDF-aligned)

### Phase 1: Admin Shell and Visibility ✅
- Build: AdminShell layout with sidebar navigation
- Build: Dashboard overview with summary cards + real counts
- Build: Read-only list views for Articles, Artists, Tracks, Releases, Labels, Genres, Guides, Pages
- Build: Detail view placeholders
- Build: Search/filter basics
- Build: Import job visibility
- Build: Review queue visibility
- Build: Settings visibility
- **Goal:** We can see and inspect all content

### ✅ Phase 2: Editable Content and Registry (COMPLETE)
- **Article editor** ✅ — title, slug, excerpt, body HTML, author, status, categories, tags, SEO, publish/draft, save, delete
- **Artist editor** ✅ — display_name, sort_name, bio, artist_type, gender, origin_iso2, image_url, status
- **Track editor** ✅ — title, ISRC, duration_ms, explicit, track_number, disc_number, artwork_url, preview_url, status
- **Release editor** ✅ — title, release_type, UPC, release_date, date_precision, label_id, description, artwork_url, status
- **Label editor** ✅ — name, description, country_code, status
- **Genre editor** ✅ — name, parent_genre_id, description, status
- **All editors** support: draft save, status toggle, unsaved changes warning, keyboard shortcuts (Cmd+S), archive/delete, toast notifications, image preview, audio preview (tracks)
- **Goal:** All imported content is now editable in the admin

### ✅ Phase 3: Import Management (COMPLETE)
- Build: Upload ZIP page with drag-drop, file validation, progress tracking
- Build: Import Job Detail page with Validate→Stage→Promote pipeline visualization
- Build: Import Reports page with summary stats and entity breakdowns
- Build: Staging Records page with status filtering
- Build: Failed Records page with individual retry and bulk retry
- Build: All routes wired under /admin/imports/*
- Build: Sidebar items enabled for all import sections
- **Goal:** Clean WordPress export can be safely imported

### ✅ Phase 4: Relationship and Repair Workflows (COMPLETE)
- Build: Entity Relationship Viewer with graph + table views, filtering, search, entity type stats
- Build: Duplicate Merge page with candidate list, confidence scores, match fields, merge/reject actions, confirmation modal, undo support
- Build: Resolution run stats panel (total rows, resolved, review, shells, duplicates)
- Enhance: Missing Images page with status tracking (pending/in-progress/resolved/skipped), priority indicators, bulk actions, batch upload modal, search/filter, resolve/skip/reopen actions
- Enhance: Broken Links page with full scanner, repair workflow, auto-fix with suggested replacements, bulk actions, status tracking, last-checked timestamps
- Enable: Relationships sidebar items (Entity Relationships, Duplicate Merge) - no more "Soon" badges
- Enable: Media sidebar items with updated badge counts
- **Goal:** Imported data can be repaired and improved

### ✅ Phase 5: Publishing Workflow (COMPLETE)
- Build: Publishing Dashboard — unified view of all content by status (draft, published, pending, trashed) with KPI cards and filtering
- Build: Content Archive — trashed content with restore (individual + bulk) and type filtering
- Build: Revision History component — expandable mock revision list with version numbers, editor info, change summaries, diff preview, and restore confirmation
- Build: SEO/Social Preview component — Google search result, Facebook Open Graph, Twitter/X card previews with tab switcher and SEO score checker
- Build: Publishing Timeline component — visual workflow status (Draft → Review → Scheduled → Published → Archived → Trashed) with animated indicators
- Enhance: Article editor meta panel with collapsible sections for Publishing Timeline, SEO Preview, and Revision History
- All routes wired under /admin/content/*
- Sidebar items enabled (Publishing, Archive)
- **Goal:** WAKILISHA can resume full content production with visibility, SEO, and version control

### ⏳ Phase 6: Advanced Production Tools (NEXT)
- Build: Content templates
- Build: Homepage/module manager
- Build: Collections
- Build: Related content suggestions
- Build: Bulk editorial workflows
- Build: Analytics hooks
- Build: Media download/mirroring jobs
- **Goal:** Admin becomes a mature production engine