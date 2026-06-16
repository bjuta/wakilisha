# API Naming & Architecture Audit Report
## WAKILISHA — June 2026

---

## Executive Summary

The WAKILISHA project has grown from a WordPress migration into a 50-function Supabase Edge Function fleet, a public read API, a chart ingestion pipeline, a provider intake system, and an admin registry layer. This growth has created **nomenclature debt** that is now a risk to commercial-grade maintainability.

This document inventories every naming convention in use, identifies 12 structural anti-patterns, and proposes a 3-phase harmonization path.

---

## 1. Current Inventory

### 1.1 Edge Functions (50+ deployed)

| Function Name | Domain | Routing Style | Auth Pattern |
|---|---|---|---|
| `wakilisha-public-api` v32 | Public read (artists, charts, magazine, tracks, releases, genres, labels) | Path-based REST | **None** (public) |
| `chart-ingest-api` v22 | Admin chart ingestion pipeline | Action-based body `{ action: "create_dry_run" }` | JWT + capability check |
| `provider-intake-api` v6 | Admin provider search / shell creation | Route-based body `{ route: "search" }` | JWT (no capability check) |
| `registry-enrichment-review` v10 | Shell canonicalization / rejection | Mixed path + body `/canonicalize` | JWT (no capability check) |
| `artist-registry-intake` | CSV artist upload / matching | Action-based body `{ action: "upload_csv" }` | JWT |
| `artist-discography` | Public artist discography | Query param `?slug=` | None |
| `admin-registry-api` | Admin entity CRUD | REST `/entities/:type/:id` | JWT + `manage_registry` capability |
| `admin-save-credentials` | Provider secret storage | Action-based body `{ action: "save" }` | JWT + `manage_settings` capability |
| `admin-user-ops` | Admin invites / password reset | Action-based body `{ action: "invite_user" }` | JWT + `administrator` RPC |
| `run-chart-scoring` v2 | Chart scoring pipeline | Body `{ program_id, edition_date }` | JWT |
| `gsc-oauth-callback` | GSC OAuth exchange | Action-based body | JWT + capability |
| `gsc-import-metrics` | GSC data import | Action-based body | JWT + capability |
| `upload-apple-music-key` | Secure .p8 upload | Multipart file upload | JWT + role |
| `backfill-*` (7 functions) | Data repair scripts | Body params | Service-role only |
| `migrate-*`, `import-*`, `clean-*` (12 functions) | WordPress migration / cleanup | Body params | Service-role only |

### 1.2 Frontend API Calling Patterns

| Service File | Calls To | Pattern |
|---|---|---|
| `src/services/publicContent/client.ts` | `functions/v1/artist-discography` | Direct fetch |
| `src/services/registry/admin/client.ts` | `functions/v1/admin-registry-api` | Direct fetch |
| `src/services/registry/enrichment-review/client.ts` | `functions/v1/registry-enrichment-review` | Direct fetch |
| `src/services/adminSettings/providerCredentialStore.ts` | `functions/v1/admin-save-credentials` | Direct fetch |
| `src/services/chartsIngestion/client.ts` | `functions/v1/chart-ingest-api` | Direct fetch |
| `src/services/chartsIngestion/wpAdapter.ts` | `/api/v1/...` (legacy contract) | **Fantasy URLs — no backend** |
| `src/services/backendContract/backendClient.ts` | `apiBackendAdapter` / `localBackendAdapter` | Contract-based, real calls bypass it |
| `src/api/v2/wakilishaRepairedEndpoints.ts` | Express router | **Dead code — never mounted** |

### 1.3 Environment Variable Names (All redundant-prefix variants)

```
VITE_WAKILISHA_PUBLIC_API_BASE     ← 3 variants of the same thing
VITE_WAKILISHA_API_BASE
VITE_WAKILISHA_BACKEND_API_BASE
VITE_WAKILISHA_RUNTIME_MODE
VITE_WAKILISHA_BACKEND_PROVIDER
VITE_WAKILISHA_REPOSITORY_MODE
VITE_WAKILISHA_ALLOW_LOCAL_FALLBACK
VITE_CHARTS_INGESTION_MODE          ← deprecated legacy alias
```

---

## 2. The 12 Anti-Patterns

### Anti-Pattern 1: No Naming Convention

Function names mix four styles:
- `wakilisha-public-api` → redundant prefix, no domain indicator
- `chart-ingest-api` → domain + action + api
- `admin-registry-api` → audience + domain + api
- `admin-save-credentials` → audience + verb + noun
- `admin-user-ops` → audience + noun + abbreviation
- `run-chart-scoring` → verb + domain + noun
- `artist-registry-intake` → domain + domain + action
- `registry-enrichment-review` → domain + noun + noun

A new developer cannot guess what a function is called.

### Anti-Pattern 2: Monolithic vs Micro-Fragmented

Two functions are 1,500+ line monoliths (`wakilisha-public-api`, `chart-ingest-api`) while 12 migration functions are 100-line one-offs. No clear boundary rule for function size.

### Anti-Pattern 3: No Semantic Versioning in URLs

`/functions/v1/{name}` — the `v1` is Supabase's platform version, not our API version. Our API versions live in file comments (`// v32`, `// v22`).

Commercial-grade APIs version in the URL: `/api/v1/...`, `/api/v2/...`.

### Anti-Pattern 4: Four Routing Paradigms

| Style | Used By | Example |
|---|---|---|
| Path-based REST | `wakilisha-public-api`, `admin-registry-api` | `/artists/breeder-lw` |
| Action-based body | `chart-ingest-api`, `artist-registry-intake` | `{ action: "create_dry_run" }` |
| Route-based body | `provider-intake-api` | `{ route: "search" }` |
| Mixed path + body | `registry-enrichment-review` | `POST /canonicalize` + body |

A client library cannot abstract over these without a bespoke adapter per function.

### Anti-Pattern 5: No Unified Error Envelope

Five different error shapes across the fleet:

```js
// wakilisha-public-api
{ error: "Not found" }

// chart-ingest-api
{ error: "runId_required", requestId: "abc123" }

// admin-registry-api
{ ok: false, error: "Entity not found", errorCode: "not_found" }

// admin-user-ops
{ error: "Only administrators can use this endpoint." }

// provider-intake-api
{ error: "Apple Music credentials not configured." }
```

A frontend error handler needs a switch statement per function.

### Anti-Pattern 6: Inconsistent Auth Guards

| Function | Auth Check |
|---|---|
| `chart-ingest-api` | `user_role_assignments` → `role_capabilities` (manual, copy-pasted) |
| `admin-user-ops` | `current_user_is_administrator` RPC |
| `admin-registry-api` | `user_role_assignments` → `role_capabilities` (manual, copy-pasted) |
| `admin-save-credentials` | `user_role_assignments` + capability (manual) |
| `provider-intake-api` | **JWT only — no capability check** |
| `registry-enrichment-review` | **JWT only — no capability check** |

### Anti-Pattern 7: Copy-Pasted Infrastructure

Apple Music JWT creation exists in **3 separate functions**.
CORS header logic copy-pasted in **every function** with minor variations.
Supabase client creation copy-pasted in **every function**.

### Anti-Pattern 8: Redundant Prefixes in Env Vars

`VITE_WAKILISHA_PUBLIC_API_BASE` — the project IS WAKILISHA, so `WAKILISHA_` is redundant inside it.

Three variables all reference the same thing (`PUBLIC_API_BASE`, `API_BASE`, `BACKEND_API_BASE`).

### Anti-Pattern 9: The "v2" Overload

The string `v2` means 4 different things:
- `api/v2/wakilishaRepairedEndpoints.ts` — dead Express router
- `wk_chart_programs_v2` — database table version
- `VITE_WAKILISHA_PUBLIC_API_BASE = "/api/v1"` — public API base URL
- `v2Adapter.ts` — frontend chart adapter

### Anti-Pattern 10: The Fantasy Backend Contract

`backendContract/runtimeContract.ts` defines clean REST endpoints:

```
POST /api/wakilisha/charts/ingest/dry-run
GET  /api/wakilisha/charts/programs
```

**These URLs do not exist.** The real calls go to `POST /functions/v1/chart-ingest-api` with action bodies. The contract is documentation with execution cost but no value.

### Anti-Pattern 11: No Shared Edge Function Library

Every function is a self-contained Deno script. Fixing a CORS bug requires editing 20 files. Adding a new capability requires updating auth logic in every admin function.

### Anti-Pattern 12: URL Routes in the Wrong Place

`wakilisha-public-api` manually strips its own path prefix on every request:

```ts
function normalizePath(raw: string): string {
  return raw.replace(/^(\/functions\/v1)?\/wakilisha-public-api/, "");
}
```

This is internal routing masquerading as path normalization.

---

## 3. Harmonic Naming Convention (Target State)

### 3.1 Function Naming

**Pattern:** `{audience}-{domain}-{verb}`

| Audience | Domain | Verb | Function Name |
|---|---|---|---|
| `public` | `content` | `read` | `public-content-read` |
| `admin` | `charts` | `ingest` | `admin-charts-ingest` |
| `admin` | `registry` | `edit` | `admin-registry-edit` |
| `admin` | `settings` | `secrets` | `admin-settings-secrets` |
| `admin` | `users` | `manage` | `admin-users-manage` |
| `admin` | `provider` | `intake` | `admin-provider-intake` |
| `admin` | `review` | `shells` | `admin-review-shells` |
| `system` | `charts` | `score` | `system-charts-score` |
| `system` | `data` | `repair` | `system-data-repair` |
| `system` | `wp` | `import` | `system-wp-import` |

**Rules:**
- Always 3 segments, kebab-case
- Audience: `public` | `admin` | `system` (system = service-role only)
- No `api` suffix — it is implied
- No `wakilisha` prefix — it is implied

### 3.2 URL Structure

All APIs use path-based REST with version in the URL segment:

```
# Public (no auth)
GET /api/v1/public/artists
GET /api/v1/public/artists/:slug
GET /api/v1/public/charts
GET /api/v1/public/charts/:programSlug/:editionSlug
GET /api/v1/public/tracks/:slug
GET /api/v1/public/releases/:slug
GET /api/v1/public/genres/:slug
GET /api/v1/public/labels/:slug
GET /api/v1/public/magazine
GET /api/v1/public/magazine/issues/:slug

# Admin (JWT + capability)
GET    /api/v1/admin/registry/entities?entityType=
GET    /api/v1/admin/registry/entities/:type/:id
PATCH  /api/v1/admin/registry/entities/:type/:id
POST   /api/v1/admin/charts/ingest/runs
POST   /api/v1/admin/charts/ingest/runs/:runId/dry-run
POST   /api/v1/admin/charts/ingest/runs/:runId/commit
POST   /api/v1/admin/charts/ingest/runs/:runId/cancel
GET    /api/v1/admin/provider/search
POST   /api/v1/admin/provider/shells
POST   /api/v1/admin/provider/shells/:id/canonicalize
POST   /api/v1/admin/settings/secrets
POST   /api/v1/admin/users/invites
POST   /api/v1/admin/users/password-resets

# System (service-role + internal token)
POST   /api/v1/system/charts/score
POST   /api/v1/system/data/repair
POST   /api/v1/system/wp/import
```

### 3.3 Unified Error Envelope

```typescript
interface ApiResponse<T> =
  | {
      ok: true;
      data: T;
      meta: { requestId: string; servedAt: string; version: string };
    }
  | {
      ok: false;
      error: {
        code: string;        // "not_found", "permission_denied", etc.
        message: string;     // Human-readable
        detail?: string;     // Optional debug detail
        retryable: boolean;
        action?: { label: string; href?: string };
      };
      meta: { requestId: string; servedAt: string; version: string };
    };
```

Every function returns this shape, no exceptions.

### 3.4 Environment Variables

```
# Before                            → After
VITE_WAKILISHA_PUBLIC_API_BASE      → PUBLIC_API_BASE
VITE_WAKILISHA_API_BASE             → (remove — redundant)
VITE_WAKILISHA_BACKEND_API_BASE     → (remove — redundant)
VITE_WAKILISHA_RUNTIME_MODE         → RUNTIME_MODE
VITE_WAKILISHA_BACKEND_PROVIDER     → BACKEND_PROVIDER
VITE_WAKILISHA_REPOSITORY_MODE      → REPOSITORY_MODE
VITE_WAKILISHA_ALLOW_LOCAL_FALLBACK → ALLOW_LOCAL_FALLBACK
VITE_CHARTS_INGESTION_MODE          → (delete — deprecated)
```

### 3.5 Shared Edge Function Library

```
supabase/shared/
  cors.ts         — CORS headers with origin allowlist
  auth.ts         — JWT verify + capability check
  errors.ts       — ApiResponse error factory
  db.ts           — Supabase client factory (service role)
  appleMusic.ts   — JWT creation + API helpers
  logging.ts      — Audit event writer
  responses.ts    — JSON response factory with envelope
```

---

## 4. Target Architecture: 3 Gateways

Instead of 50 standalone functions, consolidate into 3 API gateways:

### Gateway 1: `public-content-read`
- **Handles:** artists, tracks, releases, labels, genres, charts, magazine, authors, previews
- **Auth:** none
- **URL prefix:** `/api/v1/public/...`
- **Implementation:** extract existing `wakilisha-public-api` routing into a clean router with `shared/` imports

### Gateway 2: `admin-router`
- **Handles:** registry CRUD, chart ingest, provider intake, shell review, settings, user management, GSC, scoring triggers
- **Auth:** JWT + capability check via `shared/auth.ts`
- **URL prefix:** `/api/v1/admin/...`
- **Sub-domains:**
  - `/admin/registry/...` ← from `admin-registry-api`
  - `/admin/charts/ingest/...` ← from `chart-ingest-api`
  - `/admin/provider/...` ← from `provider-intake-api`
  - `/admin/review/...` ← from `registry-enrichment-review`
  - `/admin/settings/...` ← from `admin-save-credentials` + `upload-apple-music-key`
  - `/admin/users/...` ← from `admin-user-ops`
  - `/admin/gsc/...` ← from `gsc-oauth-callback` + `gsc-import-metrics`

### Gateway 3: `system-worker`
- **Handles:** chart scoring, data repair, WordPress import, backfills, migration scripts
- **Auth:** service-role token + internal API key
- **URL prefix:** `/api/v1/system/...`
- **Implementation:** merge all `system-*`, `backfill-*`, `migrate-*`, `clean-*`, `run-chart-scoring`

**Benefits:**
- 50 functions → 3 (simpler cold start management)
- Shared imports work across all endpoints in a gateway
- CORS, auth, error formatting applied once per gateway
- API versioning managed per gateway, not per function

---

## 5. Migration Path

### Phase A — Shared Library + Error Unification (1–2 weeks)
*No breaking changes. Fixes structural debt internally.*

1. Create `supabase/shared/` with `cors.ts`, `auth.ts`, `errors.ts`, `db.ts`, `appleMusic.ts`, `logging.ts`
2. Refactor 5 critical functions to use `shared/`:
   - `wakilisha-public-api`, `chart-ingest-api`, `admin-registry-api`, `provider-intake-api`, `admin-save-credentials`
3. Unify error format in those 5 functions
4. Add missing capability checks to `provider-intake-api` and `registry-enrichment-review`
5. Delete dead code: `src/api/v2/wakilishaRepairedEndpoints.ts`, `wpAdapter.ts`, `backendContract/*`
6. Add new env var names as aliases for old names

**Deliverable:** 5 core functions share library, consistent errors, 1,000+ lines of duplication removed

### Phase B — API Gateway Consolidation (2–3 weeks)
*URL changes — requires frontend update.*

1. Build `public-content-read` gateway at `/api/v1/public/...`
   - Copy existing `wakilisha-public-api` handlers into clean router
   - Deploy and redirect old URL to new URL
2. Build `admin-router` gateway at `/api/v1/admin/...`
   - Merge: `chart-ingest-api`, `admin-registry-api`, `provider-intake-api`, `registry-enrichment-review`, `admin-save-credentials`, `admin-user-ops`, `upload-apple-music-key`, `gsc-oauth-callback`, `gsc-import-metrics`
3. Build `system-worker` gateway at `/api/v1/system/...`
   - Merge all backfill, migration, scoring functions
4. Update all frontend service files to use new URL prefix
5. Keep old functions deployed for 30-day deprecation window

**Deliverable:** 3 edge functions handle all API traffic. 47 functions in deprecation queue

### Phase C — Commercial Polish (1–2 weeks)
*Production-ready documentation and monitoring.*

1. OpenAPI spec auto-generated for all 3 gateways
2. Health check endpoints: `GET /api/v1/public/health`, `/admin/health`, `/system/health`
3. Rate limiting: public (generous), admin (moderate), system (internal-only)
4. Request tracing: every response includes `requestId`, logged to `admin_audit_events`
5. API documentation page in admin (rendered from OpenAPI spec)
6. `Accept-Version` header support for future breaking changes

**Deliverable:** Documented, monitored, traced API platform

---

## 6. Quick Wins (This Week)

These can be done immediately with zero risk:

1. **Delete `src/api/v2/wakilishaRepairedEndpoints.ts`** — dead Express router in a React SPA
2. **Delete `src/services/backendContract/`** — ghost layer replaced by thin direct clients
3. **Rename `wakilisha-public-api` → `public-content-read`** — one Supabase function rename
4. **Add `shared/errors.ts`** and use in `admin-registry-api` and `chart-ingest-api`
5. **Add capability check to `provider-intake-api`** — security gap
6. **Add capability check to `registry-enrichment-review`** — security gap

---

## 7. Success Criteria

| # | Criterion |
|---|---|
| 1 | All API functions follow `{audience}-{domain}-{verb}` pattern |
| 2 | All APIs use path-based REST with `/api/v{N}/` prefix |
| 3 | Every response uses `{ ok, data/error, meta }` envelope |
| 4 | Every admin endpoint uses the same capability middleware from `shared/auth.ts` |
| 5 | Zero copy-pasted CORS/auth/client code across functions |
| 6 | No env var contains redundant `WAKILISHA_` prefix |
| 7 | Zero dead code: no Express routers, no fantasy contracts, no legacy WP adapters |
| 8 | 3 edge function gateways replace 50 standalone functions |

---

*Audit prepared June 2026.*