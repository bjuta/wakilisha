# WAKILISHA Chart Ingestion Studio

## 1. Project Description
The Chart Ingestion Studio is the admin backend for WAKILISHA's flagship chart product. It provides a serious, audit-focused workflow for ingesting, normalizing, matching, reviewing, ranking, and publishing chart editions. The React frontend serves as the reference implementation for how the ingestion system should feel, behave, and expose state.

## 2. Admin Routes

### Primary Routes
- `/admin/charts/dashboard` — KPIs, active jobs, failed jobs, latest editions
- `/admin/charts/families` — Chart family management
- `/admin/charts/ingest` — Ingest Studio (provider-based new run creation + KPIs)
- `/admin/charts/ingest-runs` — All provider-based ingest runs list
- `/admin/charts/ingest-runs/:runId` — Run detail with live polling + pipeline stages
- `/admin/charts/editions` — Published editions
- `/admin/charts/snapshots` — Immutable snapshots
- `/admin/charts/ingest-health` — **[Sprint 2]** API Health & Endpoint Map

### Operations Routes
- `/admin/charts/review-queue` — Global review issue queue
- `/admin/charts/no-match` — Unresolved canonical match gaps
- `/admin/charts/release-shells` — Auto-created release shells
- `/admin/charts/canon-gaps` — Canon entity gaps
- `/admin/charts/integration-map` — WordPress integration map
- `/admin/charts/public-api-qa` — Public API QA
- `/admin/charts/ingest-jobs` — Legacy CSV ingest jobs
- `/admin/charts/ingest-jobs/:jobId` — Legacy job detail wizard

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
- **Live polling** on run detail page — auto-polls every 3s while status is `running`/`queued`, stops on terminal status
- **API Health page** `/admin/charts/ingest-health`:
  - Plugin health check via `GET /charts/health`
  - Configuration panel showing mode, API base, nonce status
  - Per-endpoint probe (GET each endpoint, detect 404 vs auth vs OK)
  - "Probe All" button that sequences through all ~46 endpoints
  - Sprint 2 endpoints grouped by domain (Runs / Studio / System)
  - Sprint 1 legacy endpoints listed separately
  - Backend developer notes: auth, response shapes, capability requirements
- **Pipeline progress bar** added to run detail when status = `running`
- **Breadcrumb + back nav** on run detail
- **Source URLs panel** on run detail with link to health page
- Added "API Health" to secondary nav in `AdminChartsLayout`

### ✅ Sprint 3 — Real Provider Fetch + Normalization (COMPLETE)

**New Services:**
- `spotifyFetch.ts` — Real Spotify API fetch (Client Credentials). Falls back to seeded mock when env vars not set.
- `appleMusicFetch.ts` — Real Apple Music API fetch. Falls back to seeded mock when token not set.
- `providerFetch.ts` — Orchestrator: parallel source fetch with partial failure handling.
- `normalize.ts` — `NormalizedChartRow` → `IngestResolvedRow` with provisional match status + confidence.
- `mockTracks.ts` — 50+ African tracks (KE/NG/ZA/GH/UG/TZ) deterministically seeded from URL hash.

**Updated:** `ingestStudioMock.ts` dry run pipeline now calls real provider fetch → normalize → provisional match. `ingestStudioMock.ts` no longer returns hardcoded rows.

**Credentials (add to .env.local):**
```
VITE_SPOTIFY_CLIENT_ID=...
VITE_SPOTIFY_CLIENT_SECRET=...
VITE_APPLE_MUSIC_DEVELOPER_TOKEN=...
```
Without credentials: deterministic mock data (same URL = same tracks, reproducible across sessions).

**Partial failure:** One bad source URL does not kill the run. Stage shows `warning` (not `failed`) when partial.

**Raw payloads:** Persisted in `run.notes` as JSON for audit/debugging.

**Edge Function:** `charts-ingest-dry-run` ready to deploy when Supabase is connected (server-side credential storage).

### ✅ Sprint 4 — Entity Enrichment Hardening + V2 Alignment (COMPLETE)

**Canonical Matching Engine** (`canonicalMatch.ts`)
- Real registry search against canonical tracks with ISRC, provider ID, and fuzzy title/artist scoring
- Deterministic confidence scoring: ISRC = 99%, provider ID = 97%, title+artist strong = ~85%+
- Proper `matchStatus` assignment: `canonical | shell | no_match | needs_review | duplicate_candidate`
- Release shell IDs auto-generated for no/low match rows
- Full match decision API: Accept canonical, Change match, Attach, Create shell, Merge shell, Mark duplicate, Ignore, Send to review

**Enrichment Pipeline** (`enrichment.ts`)
- Spotify Web API enrichment (artwork, preview, ISRC, popularity, label)
- Apple Music JWT preview enrichment
- ACRCloud audio fingerprint/metadata with server-side proxy note
- YouTube oEmbed/search for video IDs and preview URLs
- All 4 providers fail gracefully — exact env var names shown in UI when missing
- `checkEnrichmentCredentials()` returns structured `CredentialError[]` with exact var names

**Updated UI:** Pipeline Panel, Provider Health Panel, Run Metadata Panel, Resolved Rows Table, PublishChecklist, MatchSummary — all real, no stubs.

### 🔄 Sprint 5 — Admin Charts Refactor + V2 Charts Integration (IN PROGRESS)

**Goals:**
1. Align all admin/charts/* pages with V2 ontology (ChartSeries, ChartMarket, ChartProgram, ChartEdition)
2. Migrate all admin pages from `ri-*` + `var(--wk-*)` inline CSS to `WkIcon` + `wk-*` Tailwind tokens
3. Connect `public-api-qa` page to test V2 endpoints (not just V1)
4. Surface V2 endpoints prominently in `integration-map` page
5. Connect `editions` page to real V2 data via `v2Adapter.ts`
6. Update `families` page to use V2 program terminology (series + market structure)
7. Fix route conflict: remove `/admin/charts/ingest/:runId` duplicate (use `ingest-runs/:runId` only)
8. Ensure every page uses `WkIcon` (Lucide) — no `ri-*` remains in admin/charts

**V2 Ontology Reference:**
| V2 Concept | Old Name | V2 Public Slug |
|---|---|---|
| ChartSeries | family type | `top-songs`, `rnb`, `gengetone`, `2026-releases` |
| ChartMarket | region | `kenya`, `nigeria`, `south-africa` |
| ChartProgram | chart family | `top-songs-kenya`, `rnb-kenya` |
| ChartEdition | edition | `rnb-2026-05-18` |

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

## 5. WordPress Backend Contract (for backend dev handoff)

### Authentication
All endpoints require `X-WP-Nonce` header injected via `wp_localize_script` as `window.WAKILISHA_REST_NONCE`.

### Capabilities
- `read_wakilisha_charts` — GET endpoints
- `edit_wakilisha_charts` — PATCH/PUT mutations
- `create_wakilisha_charts` — POST creation endpoints
- `publish_wakilisha_charts` — publish/draft endpoints
- `delete_wakilisha_charts` — DELETE endpoints

### Sprint 2 Endpoints (v2 paths — corrected in audit)
| Method | Path | Frontend function |
|--------|------|-------------------|
| GET | /wp-json/wakilisha/v2/charts/ingest/runs | `getIngestRunsWp()` |
| GET | /wp-json/wakilisha/v2/charts/ingest/runs/{runId} | `getIngestRunWp(runId)` |
| POST | /wp-json/wakilisha/v2/charts/ingest/dry-run | `runDryRunWp(request)` |
| POST | /wp-json/wakilisha/v2/charts/ingest/runs/{runId}/commit | `commitIngestRunWp(request)` |
| POST | /wp-json/wakilisha/v2/charts/ingest/runs/{runId}/cancel | `cancelIngestRunWp(runId)` |
| POST | /wp-json/wakilisha/v2/charts/ingest/runs/{runId}/retry | `retryIngestRunWp(runId)` |
| POST | /wp-json/wakilisha/v2/charts/ingest/runs/{runId}/send-gaps | `sendGapsToReviewWp(runId)` |
| GET | /wp-json/wakilisha/v2/charts/ingest/runs/{runId}/resource-guard | `getResourceGuardStatusWp(runId)` |
| GET | /wp-json/wakilisha/v2/charts/ingest/kpis | `getIngestKpisWp()` |
| GET | /wp-json/wakilisha/v2/charts/ingest/activity | `getRecentIngestActivityWp()` |
| GET | /wp-json/wakilisha/v2/charts/health | `getIngestHealthWp()` |

### Error Response Shape
```json
{ "error": "Human-readable message", "code": "machine_code", "retryable": false }
```

### Run Response Shape
```json
{
  "runId": "string",
  "status": "dry_run_complete",
  "stages": [{ "stage": "validate", "status": "done", "durationMs": 120 }],
  "summary": { "totalRows": 410, "canonicalMatches": 342, "shells": 28, "gaps": 24, "matchRate": 83.4 },
  "rows": [{ "id": "row-001", "rank": 1, "title": "...", "matchStatus": "canonical", "confidence": 98 }]
}
```

## 6. V2 Endpoint Map (Sprint 5+)

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