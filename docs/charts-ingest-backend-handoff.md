# WAKILISHA Chart Ingestion — Backend Handoff Document

**Date:** 2026-05-31  
**Version:** 1.0  
**Frontend Contract Version:** 3.0

---

## Overview

This document is the reference implementation for the WordPress plugin / backend developer who will wire the real REST API to the React ingestion studio. The React app is built as a **contract-first** implementation — every screen, action, and state transition in the UI expects a specific backend shape. This document maps those expectations.

---

## 1. Current React Routes

| Route | Page | Purpose |
|-------|------|---------|
| `/admin/settings/charts/dashboard` | Dashboard | KPIs, active jobs, failed jobs, latest edition |
| `/admin/settings/charts/families` | Families | Chart family list (stub) |
| `/admin/settings/charts/ingest` | Ingest Jobs List | Filterable jobs table with status, counts, actions |
| `/admin/settings/charts/ingest/:jobId` | Job Detail | 9-step wizard with stepper, per-step content, summary rail |
| `/admin/settings/charts/editions` | Editions | Published editions list (stub) |
| `/admin/settings/charts/snapshots` | Snapshots | Immutable snapshots list (stub) |
| `/admin/settings/charts/integration-map` | Integration Map | **Dev-only.** Maps every frontend function to its future WordPress endpoint |

---

## 2. Service Files

All chart ingestion logic lives in `src/services/chartsIngestion/`:

| File | Purpose |
|------|---------|
| `types.ts` | Full TypeScript type system mirroring expected database schema |
| `mockData.ts` | Realistic mock data with 40 candidates, 4 sources, 17 issues, 5 jobs |
| `api.ts` | Mock API functions — all return Promises, read/write localStorage |
| `store.ts` | localStorage-backed mutation store. All mutations persist across refresh |
| `client.ts` | **Adapter boundary.** All components import from here. Switching `CHARTS_INGESTION_MODE` from `"mock"` to `"wordpress"` routes all calls to the WordPress adapter |
| `workflow.ts` | Stage transition guards, publish checklist, step status logic |
| `roles.ts` | 5-role permission matrix with 20+ capabilities |
| `simulation.ts` | Failure injection system for testing error states |

---

## 3. Mock Store Behavior

The mock store (`store.ts`) persists to `localStorage` under key `wkcharts_ingest_store_v1`:

- **On load:** Reads from localStorage. Falls back to `mockData.ts` if missing or corrupt.
- **On mutation:** Every `commit()` writes the full state to localStorage.
- **Reset:** `resetStore()` wipes localStorage and restores initial mock data.
- **Demo reset:** `resetDemoJob()` resets only `demo-job-001` to its original state while preserving other jobs.
- **Logs:** Every mutation appends an `IngestJobLog` entry. The Timeline component renders these chronologically.

---

## 4. Future Endpoint Map

All endpoints are defined in `client.ts` as `WORDPRESS_CHART_ENDPOINTS` — a record of 26 endpoints with:
- `key`, `frontendFunction`, `method`, `path`
- `status`: `not_configured` | `planned` | `mocked` | `ready` | `deprecated`
- `tables`: affected database tables
- `expectedResponse`: top-level response keys
- `payloadExample` / `responseExample`: JSON shape
- `capabilities`: required WordPress capabilities

### Endpoint Groups (26 total)

**Jobs & Setup (7):**
- `GET /wp-json/wakilisha/v1/charts/families`
- `POST /wp-json/wakilisha/v1/charts/ingest-jobs`
- `GET /wp-json/wakilisha/v1/charts/ingest-jobs/{jobId}`
- `GET /wp-json/wakilisha/v1/charts/ingest-jobs`
- `PATCH /wp-json/wakilisha/v1/charts/ingest-jobs/{jobId}/status`
- `POST /wp-json/wakilisha/v1/charts/ingest-jobs/{jobId}/cancel`
- `DELETE /wp-json/wakilisha/v1/charts/ingest-jobs/{jobId}`

**Sources (5):**
- `POST /wp-json/wakilisha/v1/charts/ingest-jobs/{jobId}/sources`
- `GET /wp-json/wakilisha/v1/charts/ingest-jobs/{jobId}/sources`
- `DELETE /wp-json/wakilisha/v1/charts/ingest-jobs/{jobId}/sources/{sourceId}`
- `POST /wp-json/wakilisha/v1/charts/ingest-jobs/{jobId}/fetch-sources`
- `GET /wp-json/wakilisha/v1/charts/ingest-jobs/{jobId}/raw-items`

**Candidates (3):**
- `GET /wp-json/wakilisha/v1/charts/ingest-jobs/{jobId}/candidates`
- `PATCH /wp-json/wakilisha/v1/charts/ingest-jobs/{jobId}/candidates/{candidateId}/approve`
- `PATCH /wp-json/wakilisha/v1/charts/ingest-jobs/{jobId}/candidates/{candidateId}/exclude`

**Matching (5):**
- `GET /wp-json/wakilisha/v1/charts/ingest-jobs/{jobId}/matches`
- `POST /wp-json/wakilisha/v1/charts/ingest-jobs/{jobId}/matches/{matchId}/approve`
- `POST /wp-json/wakilisha/v1/charts/ingest-jobs/{jobId}/matches/{matchId}/reject`
- `POST /wp-json/wakilisha/v1/charts/ingest-jobs/{jobId}/candidates/{candidateId}/rematch`
- `POST /wp-json/wakilisha/v1/charts/ingest-jobs/{jobId}/candidates/{candidateId}/new-entity`

**Review Issues (2):**
- `GET /wp-json/wakilisha/v1/charts/ingest-jobs/{jobId}/issues`
- `PATCH /wp-json/wakilisha/v1/charts/ingest-jobs/{jobId}/issues/{issueId}`

**Ranking (1):**
- `PATCH /wp-json/wakilisha/v1/charts/ingest-jobs/{jobId}/candidates/{candidateId}/rank`

**Draft & Publish (3):**
- `POST /wp-json/wakilisha/v1/charts/ingest-jobs/{jobId}/draft`
- `POST /wp-json/wakilisha/v1/charts/ingest-jobs/{jobId}/publish`
- `POST /wp-json/wakilisha/v1/charts/ingest-jobs/{jobId}/preflight`

**Audit & Snapshots (4):**
- `GET /wp-json/wakilisha/v1/charts/ingest-jobs/{jobId}/logs`
- `GET /wp-json/wakilisha/v1/charts/editions`
- `GET /wp-json/wakilisha/v1/charts/snapshots`
- `GET /wp-json/wakilisha/v1/charts/dashboard`

---

## 5. Required WordPress Tables

Based on the type system and endpoint definitions, the plugin must create these tables:

| Table | Purpose |
|-------|---------|
| `wkcharts_chart_families` | Chart family definitions (Top 40, Top 100, etc.) |
| `wkcharts_ingest_jobs` | Ingest job records with status, dates, rules |
| `wkcharts_ingest_sources` | Sources per job (Spotify, Apple, CSV, etc.) |
| `wkcharts_raw_source_items` | Raw fetched data before normalization |
| `wkcharts_ingest_candidates` | Normalized candidates with scores, ranks |
| `wkcharts_ingest_matches` | Canonical track match proposals |
| `wkcharts_review_issues` | Review issues with severity, status, blocking flag |
| `wkcharts_draft_entries` | Draft edition entries (rank, movement, peak) |
| `wkcharts_chart_editions` | Published editions |
| `wkcharts_snapshots` | Immutable JSON snapshots of published editions |
| `wkcharts_ingest_logs` | Audit logs for every job action |
| `wkcharts_canonical_tracks` | Master canonical track registry |

---

## 6. Required WordPress Capabilities

| Capability | Role(s) |
|------------|---------|
| `read_wakilisha_charts` | All roles |
| `create_wakilisha_charts` | Admin, Editor-in-Chief, Chart Editor |
| `edit_wakilisha_charts` | Admin, Editor-in-Chief, Chart Editor |
| `delete_wakilisha_charts` | Admin |
| `publish_wakilisha_charts` | Admin, Editor-in-Chief |
| `override_high_issues` | Admin, Editor-in-Chief |

---

## 7. Publish Guards

The frontend enforces these guards (mirrored in `workflow.ts`). The backend **must** enforce them server-side:

1. **Sources fetched** — all sources must have `status === "completed"`
2. **Candidates normalized** — at least 1 candidate exists
3. **Canonical matches approved** — zero unresolved matches
4. **No duplicate ranks** — `finalRank` must be unique across candidates
5. **No duplicate tracks** — no two candidates share the same `canonicalTrackId`
6. **No high blocking issues** — zero open issues with `severity === "high"` and `blocking === true`
7. **Draft edition created** — `draftEntries` must exist
8. **Snapshot ready** — payload must be valid JSON
9. **Role can publish** — user must have `publish_wakilisha_charts`

---

## 8. Snapshot Requirements

- Snapshots are **immutable** once created.
- Each snapshot must contain: `edition` reference, `entries` array, `chartFamily` reference, timestamp, checksum.
- Corrections must create a **new edition** with a correction event — never silently edit existing snapshots.
- The frontend shows a `sha256:` mock checksum. The backend should generate a real SHA-256 of the snapshot JSON.

---

## 9. Known Frontend Assumptions

### Data Shape
- All dates are ISO-8601 strings (`YYYY-MM-DD` or full ISO).
- `score` is a float (e.g., `850.5`).
- `weight` is a float between 0 and 1.
- `rank` fields are 1-indexed integers.
- `sourcePositions` and `sourceMetrics` are `Record<string, number>` maps.

### Error Handling
- The frontend expects HTTP 4xx/5xx responses with a JSON body containing `{ error: string, code?: string }`.
- API timeouts should return 504 with a retryable flag.
- Permission denied should return 403 with the missing capability name.

### Pagination
- The frontend does not currently paginate candidates or raw items. The backend should default to returning all records for a job (typical chart size is 40–100 entries). If this becomes a problem, add `?page=` and `?per_page=` params.

### Real-time Updates
- The frontend does **not** use WebSockets. It reloads data after every mutation. The backend should return the mutated entity + updated summary in the response so the frontend can optimistically update.

### LocalStorage
- The mock store uses `localStorage`. The real backend will replace this entirely. No localStorage migration is needed.

---

## 10. How to Wire the Backend

1. **Create the WordPress tables** (see Section 5).
2. **Register the REST routes** (see Section 4).
3. **Implement the capabilities** (see Section 6) and check them on every mutating endpoint.
4. **Set the adapter mode** in `client.ts`:
   ```ts
   const CHARTS_INGESTION_MODE: IngestionMode = "wordpress";
   ```
5. **Implement the WordPress adapter** in `client.ts` by replacing the `wpStub` with actual `fetch()` calls to the WordPress REST API.
6. **Test against the Integration Map** at `/admin/settings/charts/integration-map` — every endpoint should show `"ready"` status when wired.

---

## 11. Failure State Testing

The frontend includes a **Simulation Controls** panel (visible only on `demo-job-001` for Admin role). Use it to test:
- Source fetch failures and retry recovery
- Normalization engine failures
- Canonical matching failures
- Duplicate rank / duplicate canonical track issues
- Publish failures (403, timeout)
- Permission denied

Each simulation:
- Updates the job/source state
- Appends an error log
- Shows the UI error state
- Blocks the relevant next step
- Offers a retry action that restores state

---

## 12. Role Testing

Switch roles in the job detail header to verify behavior:
- **Viewer** — all actions should be read-only or disabled
- **Contributor** — can add sources but cannot draft/publish
- **Chart Editor** — can ingest, review, draft, but cannot publish or override high issues
- **Editor-in-Chief** — full editorial control except admin-only features
- **Admin** — everything including simulation controls

---

## 13. Contact

This document is generated from the React frontend contract. If the backend schema diverges, update this document and the `types.ts` file to maintain parity.

**Frontend source of truth:** `src/services/chartsIngestion/types.ts`  
**Endpoint source of truth:** `src/services/chartsIngestion/client.ts` → `WORDPRESS_CHART_ENDPOINTS`  
**Guard source of truth:** `src/services/chartsIngestion/workflow.ts`