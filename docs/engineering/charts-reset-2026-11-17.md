# Charts reset — cleanup record (2026-11-17)

WK100 and the legacy Charts engine are retired. The public `/charts` pages stay. Charts restarts as a new sprint with fresh thinking about what the chart measures and from which data.

The cleanup is one deliberate step with three parts, done in order:

1. Repository: merge the `audit/charts-cleanup` branch (387 files removed, about 229,000 lines).
2. Production runtime: turn off and delete what the branch no longer contains (Edge Functions, scheduler, secrets).
3. Database: run the WK100 teardown (`ops/charts-reset/`).

Before merging, tag the current `main` so everything removed stays one checkout away:

```bash
git tag charts-archive-2026-11-17 0e8617a4 && git push origin charts-archive-2026-11-17
```

---

## 1. What stays

These keep the public charts working and must not be removed.

| Kept | Why |
|---|---|
| Public routes `/charts`, `/charts/:series`, `/charts/:series/:edition`, `/charts/:series/:market/:edition` | Live public pages |
| `src/pages/charts/directory`, `src/pages/charts/edition`, `src/pages/mobile/charts/edition` | Rendered by those routes |
| `src/services/chartsPublic/*` | Only data path for public charts |
| `src/components/charts/ChartRefreshButton`, `ChartRecordingLink`, `components/design-system/music/ChartRow*` | Used by public pages |
| `src/pages/artists/**/ArtistChartSection`, `ChartList` | Artist pages show chart history |
| Tables `wk_chart_programs_v2`, `wk_chart_editions_v2`, `wk_chart_entries_v2` | The only three tables public pages read (`status='published'` only) |
| `src/pages/admin/charts/components/AdminChartsPageHeader`, `KpiCard`, `LoadingState` | Shared by Admin Analytics and Community pages |
| `/admin/charts/analytics`, `/admin/charts/share-analytics` | Admin Analytics (not part of the chart engine) |
| `supabase/functions/_shared/provider-candidate-evidence.ts`, `registry-track-identity.ts` | Used by Registry/MIZIZI code and tests |
| `chart_ingest_audit_events` table | Logging target for `admin-router`, `admin-save-credentials`, `upload-apple-music-key`, `shared-logging` |
| All migration files, including the 18 WK100 migrations, and their replay proofs | Applied history. Deleting them breaks migration replay and drift checks. The teardown is a new forward migration. |
| `scripts/control-plane/verify-offline-operator-replay-proof.mjs` | Generic migration-replay verifier (its proof fixtures happen to be WK100 migrations) |
| Registry chart verifiers (`verify-registry-chart-*`, `verify-provider-identity-chart-*`), `test/registry/chart-uuid-identity-authority.test.ts` (database assertions) | Verify Registry-domain database objects that remain |
| `packages/migration/reports/chart-entry-tracks.seed.json` | Used by the historical migration package |

## 2. What the branch removes

### Frontend (Admin)
- The whole Admin Charts engine: dashboard, families, ingest studio (about 70 components), ingest runs, ingest health, backfill, editions, edition detail, artist resolution, snapshots, integration map, public API QA, review queue, no-match, canon gaps, scoring runs, WK100 preview, WK100 Operations (3 views), and `AdminChartsLayout`.
- Settings → Chart Defaults and Market Scopes.
- Nav entries, admin search entries, and four dangling buttons/links pointing at those pages.
- Chart editors' default landing route now goes to `/admin/charts/analytics` instead of the removed dashboard.

### Frontend (dead public chart code, unreachable from any route)
- `src/pages/mobile/charts/page.tsx`, `src/pages/mobile/charts/directory/page.tsx`, `ChartTop3`, `ChartsHero`, `ChartTrajectory`, `TrackChartHistory`.

### Services
- `src/services/charts{Ingestion,Scoring,Methodology,Eligibility,Enrichment,EntityResolution,Intelligence,Markets}` (about 18,400 lines, four scoring engines among them).

### Edge Functions (14)
`wk100-capture-private-preview`, `wk100-private-admin-preview`, `wk100-research-html-intake`, `wk100-research-intake`, `wk100-source-admin-methods`, `wk100-source-admin-proposals`, `wk100-source-admin-read`, `wk100-source-scheduler`, `wk-chart-capture`, `chart-ingest-api`, `chart-provider-fetch`, `run-chart-scoring`, `run-chart-playback-enrichment`, `backfill-chart-artwork`, plus 43 `_shared` modules used only by them, and their `config.toml` blocks.

### Scripts, tests, ops, CI
- `scripts/charts/`, WK100/chart acceptance and verify scripts, `scripts/run-engine.ts`, the chart-source-soak harness, the chart V2 dev server, the Phase 4A chart bridge scripts, and 14 `charts:*` / `dev:v2` npm scripts.
- `test/charts/`, `test/scoring/`, WK100 browser and DOM specs.
- `ops/systemd/wakilisha-wk100-source-scheduler.{service,timer}`, `ops/wk100-scheduler/`.
- `.github/workflows/wk100-disposable-security.yml`, and the WK100 steps in `critical-control-plane.yml`.

### Docs and data
- WK100 docs, chart plan/brief docs, the archived chart-research evidence dumps (about 120,000 lines of JSON), the `reports/chart-v2-*` artefacts, `data/charts-import`, `packages/charts-import`, legacy chart migrations under `archive/`, and the retired phase-0c chart functions.

### Contract updates (not deletions)
Repository checks that pinned the old code were updated, not skipped:
- Route audits re-sealed. The preserved route sequence went from 163 to 143 paths, and the diff is exactly the 20 retired chart paths with order unchanged. Admin lazy imports went from 103 to 80. Both audits now fail if a retired chart route returns.
- The Registry privileged-writer manifest drops the two retired writers (67 → 65).
- `verify-phase-0b` replaces the playback-enrichment source guard with a check that the function stays gone.
- Nine source-contract test files that read deleted files had only those assertions removed. Registry and database assertions remain.
- The icon sprite and Remixicon compat CSS were regenerated with the repo's own generators.

## 3. Proof

Each check was run on both `main` and the branch:

| Check | main | branch |
|---|---|---|
| Vitest (all) | 2,507 pass / 58 fail | 2,307 pass / 51 fail, **0 new failures** (the 7 resolved were in deleted scoring tests) |
| `npm run control-plane:verify` | pass | pass |
| `performance:audit`, `:routes`, `:images`, `:public-routes`, `analytics:audit` | pass | pass |
| `vite build` + `:routes:dist`, `:public-routes:dist` | pass | pass |
| `test:ui-dom` | 55 pass | 52 pass (3 were the deleted WK100 spec) |
| `audit:media-storage` | fail | pass |
| TypeScript (identical strict config) | 3,904 errors | 3,246 errors, **0 new** |
| Public app import graph | — | no reachable file imports removed code |

Not run: `analytics:audit:dist` and the full `npm run build`. They need the production GA4 ID and prerender directory, and fail the same way on `main` without them. Playwright `test:ui-browser` also wasn't run; it needs the Playwright container.

The 51 remaining failures already exist on `main` and are unrelated to charts.

## 4. Production runtime (do after merging)

1. **Lightsail scheduler**
   ```bash
   sudo systemctl disable --now wakilisha-wk100-source-scheduler.timer
   sudo rm -f /etc/systemd/system/wakilisha-wk100-source-scheduler.{service,timer}
   sudo rm -rf /opt/wakilisha-wk100-source-scheduler
   sudo shred -u /etc/wakilisha-wk100-source-scheduler.jwt
   sudo systemctl daemon-reload
   ```
   The `.jwt` file is a **service_role** token, which bypasses RLS on the whole database. Removing the file is the minimum. If it is the project's long-lived service-role key and you aren't certain who has had access to that host, rotate it.
2. **Edge Functions.** Check last-14-day invocations first (Dashboard → Edge Functions), then:
   ```bash
   for f in wk100-capture-private-preview wk100-private-admin-preview wk100-research-html-intake wk100-research-intake wk100-source-admin-methods wk100-source-admin-proposals wk100-source-admin-read wk100-source-scheduler wk-chart-capture chart-ingest-api chart-provider-fetch run-chart-scoring run-chart-playback-enrichment backfill-chart-artwork; do supabase functions delete "$f" --project-ref pgzizndxdyhqmtyywjmt; done
   ```
   Also redeploy `admin-analytics-api`, which has a one-line link fix.
3. **Edge secrets** used only by deleted functions:
   `WK100_APPLE_MUSIC_DEVELOPER_TOKEN`, `WK100_APPLE_USE_EXISTING_PLATFORM_CREDENTIALS`, `WK100_CAPTURE_ENABLED`, `WK100_CAPTURE_PREVIEW_ENABLED`, `WK100_CAPTURE_PREVIEW_MANIFEST`, `WK100_CAPTURE_PREVIEW_MANIFEST_SHA256`, `WK100_CAPTURE_PREVIEW_PROJECT_REF`, `WK100_CAPTURE_PROJECT_REF`, `WK100_CAPTURE_SOURCE_MANIFEST`, `WK100_CAPTURE_SOURCE_MANIFEST_SHA256`, `WK100_PRIVATE_PREVIEW_ENABLED`, `WK100_PRIVATE_PREVIEW_INPUT`, `WK100_PRIVATE_PREVIEW_INPUT_SHA256`, `WK100_PRIVATE_PREVIEW_PROJECT_REF`, `WK100_SOURCE_CONSTITUTION_VERSION`, `WK100_SOURCE_SCHEDULER_ENABLED`.
   ```bash
   supabase secrets unset <names…> --project-ref pgzizndxdyhqmtyywjmt
   ```
4. **GitHub.** Close PRs #1384 and #1386. Remove any branch-protection required checks that came from `wk100-disposable-security.yml`. Close or retitle issue #1338.
5. **Frontend.** Deploy the merged `main` (Finish Update).

## 5. Database teardown

Files are in `ops/charts-reset/`:

| File | Writes? | Purpose |
|---|---|---|
| `01-preflight-readonly.sql` | no | Lists WK100 Editions in the live tables, per-programme counts, WK100 row counts, bucket size, the objects to be dropped, and whether the publish guard depends on WK100. Save the output. |
| `02-teardown-wk100.sql` | **yes, irreversible** | Runs in one transaction (see below). |
| `03-postflight-readonly.sql` | no | Nine pass/fail checks plus per-programme counts to compare with preflight. |
| `04-optional-hide-legacy-editions.sql` | yes, reversible | Optional and separate: takes the old playlist-built `top100`/`toprnb` Editions offline by changing status. Rows are kept. |

What 02 does:
1. **Restores `wk_chart_editions_publish_integrity_guard()`** to its pre-WK100 definition. WK100 rewrote this shared guard so that every top100 publication must come through WK100 ledgers. Dropping the WK100 tables without restoring it would break top100 publishing.
2. Drops the WK100 triggers on `wk_chart_editions_v2` / `wk_chart_entries_v2`. These block deleting WK100 rows.
3. Deletes the WK100 Editions and entries, identified by the WK100 ledgers, by `wk100-ke-YYYYMMDD` ids, and by `WAKILISHA 100 — …` labels. It also deletes their source-coverage rows.
4. Replaces the four WK100 "hide non-published" restrictive policies with programme-neutral ones, so no draft of any programme becomes anon-readable. This is a tightening: drafts of `toprnb` were previously anon-readable through the API.
5. Drops the WK100 unique index.
6. Drops every WK100 table in exact schemas: `platform_private.wk100_*`, `public.wk100_*`, `public.wk_chart_capture_*`, `public.wk_chart_weekly_freezes_v1`, `private.wk_chart_runtime_*`.
7. Drops every WK100 function, all overloads included.
8. Verifies nothing WK100 remains, or aborts and rolls back.
9. Reports whether the `wk-chart-raw-evidence-v1` bucket still exists. Delete it in Dashboard → Storage, since Supabase blocks SQL deletes on storage.

Deliberately kept: `wk100_registry_track_provider_links_admin_review_read_v1`. Despite the name, it grants `view_registry` read on provider links, which Registry admin uses.

Tested on Postgres (PGlite) against a fixture copying the WK100 shapes, including its actual delete-blocking triggers, the rewritten guard (verbatim), the policies and the FK from withdrawals to editions:
- Before the teardown, WK100 blocked both deleting its rows and publishing any top100 Edition.
- After it, WK100 Editions were gone and every other Edition was intact. Publishing top100 went through the restored guard, anon could not see drafts, and all nine postflight checks passed.
- It still worked with the WK100 ledger tables absent (Preview-only migrations).
- A failure injected at step 8 rolled back everything.

It was not run against a copy of Production. Run 01 first, and read its output before running 02.

**Landing it.** Add 02 as `supabase/migrations/<timestamp>_charts_reset_wk100_teardown_v1.sql` and promote it through the normal migration path (replay proof, then `repository-migration-production-promotion.yml`). Don't paste it into the SQL editor: the live-schema drift check (`schema:verify`) compares Production with the migration files, and an unrecorded teardown would fail CI. Regenerate `src/types/database.types.ts` as part of promotion.

**Optional escape hatch.** The raw evidence and the 599 observations are deleted by 02. If you might ever want them, run `pg_dump` on the WK100 tables and download the bucket to cold storage first. Skip this if you want them gone.

## 6. Tier 2: not removed, decide later

The generic chart ingest database layer stays for now. That's `chart_ingest_*` (runs, candidates, matches, scores, exclusions, review issues, stage events, family presets), `chart_research_*`, `wk_chart_scoring_runs`, `wk_chart_methodologies_v2`, `wk_chart_eligibility_rules_v2`, `wk_chart_playback_enrichment_*`, `wk_chart_airplay_*`, the 2026-06-25 cleanup backup tables, and the chart RPCs (`chart_assert_publishable_edition` stays: the restored guard calls it). No code in the branch uses them. Drop them once the new Charts design confirms which, if any, it reuses.

## 7. Found along the way (not changed)

- About 100 other files under `src/` (old magazine, guide, mobile page components) are unreachable from any route. That's a separate cleanup.
- The root `tsconfig.json` has no `jsx` or path aliases, so `tsc` cannot gate the app. Under a strict config, `main` has 3,904 type errors. The build relies on Vite alone.
- `.env` is tracked in git. It holds only the public anon key and URLs, so there's no secret exposure, but it should be untracked.
