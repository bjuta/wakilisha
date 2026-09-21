# MIZIZI Slice 3 Production Closure

> **21 September 2026 current-state note:** this file remains the historical closure record for obsolete-runtime retirement and MIZIZI Stage A/B/C. Whole Slice 3 is still open. Since this record, Admin Registry, Provider Intake, Chart Playback provider persistence, generic Track provider-link admission, and Track Intake create/enrichment have converged. Current Production runtime-bearing code authority is `main@dcdbe948b6dc5edc2cd31133939e45e152db7b57`; Production is 166 migrations / `20260921153000_registry_track_intake_legacy_writer_retirement_v1`. Use `docs/engineering/mizizi-slice3-current-database-authority-convergence.md` for current remaining work.
>
> **20 September 2026 correction:** the retirement and MIZIZI Stage A/B/C evidence in this record remains accepted, but the whole Slice 3 closure decision was premature.
> A fresh exact-main + Production audit found three live service-role Edge canonical writers plus a broader authenticated `SECURITY DEFINER` canonical-writer surface that was not completely represented in the machine privileged-writer manifest.
> #962 is reopened and Slice 4 #991 is blocked until the complete live-writer inventory is mechanically classified and the remaining alternate/broad writer roads converge or are explicitly proven non-bypass under the original Slice 3 exit gate.

Date: 20 September 2026

Status: **RETIREMENT ACCEPTED — SLICE 3 REOPENED FOR FINAL LIVE-WRITER CONVERGENCE**

Programme authority: `docs/engineering/mizizi-registry-authority-security-convergence-programme.md`

Programme issue: #962

Closing runtime PR: #987

Accepted merged main:

`177e4aaee15d5bbb2a77ae8ee43f7e119791aee3`

Production project:

`pgzizndxdyhqmtyywjmt`

Accepted Production migration state:

- migration count: 153;
- migration head: `20260920095334`;
- active MIZIZI standing grants: 0;
- active MIZIZI exact grants: 0;
- `mizizi -> mizizi_executor` binding: active;
- `mizizi -> postgres` binding: disabled.

## 1. Closure position

Slice 3 is closed as **Obsolete Authority Retirement & Bypass Closure**.

The governing rule remained:

> Replacement proof before retirement.

Slice 3 did not delete old authority because it appeared unused. Every runtime,
RPC, compatibility road, or transport boundary that changed was handled only
after current caller, dependency, replacement, rollback, and Production
acceptance evidence established the safe disposition.

The accepted result is that obsolete canonical Registry authority has been
removed or fail-closed while legitimate retained Registry/Admin capabilities
remain available through explicitly classified governed boundaries.

## 2. Execution-authority convergence

The remaining MIZIZI execution transport debt was closed in three accepted
Production stages.

### Stage A — narrow executor foundation

PR #981 installed the dedicated `mizizi_executor` LOGIN role without
SUPERUSER, CREATEDB, CREATEROLE, REPLICATION, BYPASSRLS, INHERIT, direct
canonical Registry mutation authority, or ambient private-schema access.

Accepted migration:

`20260918120331_mizizi_executor_foundation_v1`

### Stage B — typed broker convergence

PR #983 moved the remaining Track slug, Release taxonomy, Release slug, Chart
Track-slug, and deterministic review-escalation mutations behind typed
exact-grant brokers.

Accepted migration:

`20260918173446_mizizi_stage_b_broker_convergence_v1`

The general MIZIZI runner no longer owns direct canonical DML for those
governed targets.

### Stage C — narrow executor transport

PR #985 moved live MIZIZI JIT database transport from ambient `postgres` to
`mizizi_executor`.

Accepted migration:

`20260920095334_mizizi_stage_c_narrow_executor_transport_v1`

Independent Production acceptance proved real JIT `mizizi_executor` sessions,
the exact approved read/wrapper surface, rejection of direct canonical DML,
rejection of ambient `platform_private`/editorial/admin identity reads, and
zero standing/exact MIZIZI grants at rest.

Detailed Stage A/B/C evidence remains in their dedicated Production closure
records.

## 3. Obsolete Registry runtime retirement

The final Production Edge inventory proves the following retired runtimes are
absent:

- `scrape-artist-data`;
- `backfill-artist-spotify-images`;
- `backfill-artist-type`;
- `admin-registry-api`;
- `wakilisha-public-api`;
- `registry-enrichment-review`.

The final Production Edge inventory independently proves the following retained
governed runtimes remain ACTIVE:

- `artist-registry-intake` v33;
- `ingest-artist-discography` v68;
- `registry-enrich-artist` v32;
- `backfill-artist-origin` v30;
- `admin-router` v51;
- `provider-intake-api` v48;
- `run-chart-playback-enrichment` v21;
- `chart-ingest-api` v92;
- `public-content-read` v90.

The retired roads are protected by consolidated negative architecture contracts
where reintroduction would recreate obsolete authority.

## 4. Final orphan retirement: `registry-enrichment-review`

Fresh exact-main dependency audit established no current product, workflow,
Edge Function, database function/procedure, view, or cron caller.

The historical frontend client
`src/services/registry/enrichment-review/client.ts` is absent.

The similarly named `scripts/charts/serve-v2-api.ts` compatibility routes do
not call the retired Edge Function. Its old write routes already fail closed
with HTTP 410 and its surviving enrichment context/audit routes are read-only.

### Seven-day traffic proof

Critical Control Plane #1357 queried seven bounded 24-hour
`function_edge_logs` windows from 13 September 2026 12:39 UTC through
20 September 2026 12:39 UTC.

Observed:

- total Edge-function log events: 46,013;
- `registry-enrichment-review` invocations: 0;
- `public-content-read` positive-control invocations: 45,670;
- every individual window: target 0 with positive control nonzero.

### Rollback authority

Before deletion, live Production was independently sealed as:

- status: ACTIVE;
- version: 42;
- function id: `5421aa89-2b73-4fe8-9251-fa23f4dc84df`;
- `verify_jwt=true`;
- bundle SHA-256:
  `deda61f512909d58bc4fc826d5462373e2da9f62177609f81bc29cf00d6aa64d`.

The live entrypoint and shared Track identity helper were byte-identical to
immutable Git at pre-retirement
`main@b553a50f67cc775c131d58873f5e666b1b68b317`.

### Immediate post-merge traffic and deletion

Critical Control Plane #1368 rechecked traffic from
20 September 2026 12:39:00 UTC through 13:20:04 UTC.

Observed:

- total Edge-function log events: 36;
- `registry-enrichment-review` invocations: 0;
- `public-content-read` positive-control invocations: 36.

The exact Production deletion then returned:

`DELETE_HTTP=200`

and:

`SLICE3_REGISTRY_ENRICHMENT_REVIEW_PRODUCTION_RETIREMENT=PASS`

The full Critical Control Plane remained green after deletion.

## 5. Final external Production exit audit

Critical Control Plane #1369 independently proved the complete Edge exit state.

Retired runtimes absent:

- `scrape-artist-data`;
- `backfill-artist-spotify-images`;
- `backfill-artist-type`;
- `admin-registry-api`;
- `wakilisha-public-api`;
- `registry-enrichment-review`.

Retained runtimes ACTIVE:

- `artist-registry-intake`;
- `ingest-artist-discography`;
- `registry-enrich-artist`;
- `backfill-artist-origin`;
- `admin-router`;
- `provider-intake-api`;
- `run-chart-playback-enrichment`;
- `chart-ingest-api`;
- `public-content-read`.

External network acceptance proved:

- retired `registry-enrichment-review` route: HTTP 404;
- `public-content-read` positive-control route: HTTP 401;
- final Edge inventory gate: PASS;
- final Edge network positive control: PASS.

Receipt:

`SLICE3_FINAL_EDGE_EXIT_AUDIT=PASS`

## 6. Database and authority exit invariants

Independent post-retirement Production SQL verification established:

- migration count: 153;
- migration head: `20260920095334`;
- active MIZIZI standing grants: 0;
- active MIZIZI exact grants: 0;
- active `mizizi -> mizizi_executor` binding: 1;
- disabled `mizizi -> postgres` binding: 1;
- obsolete public Registry maintenance RPCs: 0;
- all three legacy core relationship fail-closed triggers remain enabled;
- ordinary `anon` direct INSERT/UPDATE/DELETE on canonical Artists, Tracks,
  and Releases: 0;
- ordinary `authenticated` direct INSERT/UPDATE/DELETE on canonical Artists,
  Tracks, and Releases: 0.

No canonical Registry data was erased merely because a runtime that once wrote
it was retired.

Historical provenance, identity lineage, evidence, and accepted relationship
history remain separate from current execution authority.

## 7. Slice 3 exit gate decision

The #962 exit boundary is accepted because current merged-main Production now
mechanically proves:

- obsolete canonical Registry writers identified for retirement are removed or
  fail-closed;
- no legitimate live caller depends on a retired Edge road;
- stale browser canonical mutation cannot be preserved through direct canonical
  table DML;
- old public/compatibility Edge runtimes cannot recreate canonical write-on-read
  or service-role bypass authority;
- core-music relationship mutation remains behind accepted typed Registry
  relationship authority;
- superseded public maintenance RPCs are absent;
- every retained Registry writer is explicitly classified and governed;
- ordinary browser canonical DML grants remain zero;
- unjustified standing/exact MIZIZI grants remain zero;
- MIZIZI uses the narrow dedicated executor rather than ambient `postgres`;
- MIZIZI remains non-autonomous;
- replacement authority, provenance, identity lineage, and historical evidence
  remain intact;
- exact merged-main Production state is independently accepted.

**The obsolete-runtime retirement work is accepted, but Slice 3 is not closed.**

Status receipt:

`MIZIZI_SLICE3_OBSOLETE_RUNTIME_RETIREMENT=PRODUCTION_ACCEPTED`

Whole-Slice closure remains blocked. The authoritative remaining-work inventory is:

`docs/engineering/mizizi-slice3-final-live-writer-authority-audit.md`

The first confirmed convergence set includes:

- `admin-router` Registry direct service-role PATCH/DELETE;
- `provider-intake-api` direct service-role `registry_releases` writes;
- `run-chart-playback-enrichment` direct service-role `registry_tracks.metadata` writes;
- `public.admin_create_registry_track_from_intake_enriched(...)` direct SECURITY DEFINER canonical Track creation;
- `public.community_admin_decide_artist_claim(...)` direct SECURITY DEFINER canonical Artist creation.

## 8. What this does not authorize

Slice 3 closure does not authorize MIZIZI autonomous Production mutation.

It does not authorize:

- generic SQL for the MIZIZI Mind;
- ambient Production credentials;
- standing mutation capability;
- model-controlled permission escalation;
- broad autonomous retries;
- hidden rollback/time-travel semantics;
- bypass of exact capability, target, state, expiry, budget, journal, or
  verifier requirements.

The Supabase security-advisor RLS findings previously observed on private and
editorial schemas remain a separate security-audit backlog. Slice 3 closure does
not claim those warnings are exploitable and does not authorize blind RLS
changes without an exact schema-ACL/exposure audit.

## 9. Next programme

Slice 4 — MIZIZI Stewardship Runtime Foundation — is defined but **blocked**.

The active programme boundary remains reopened Slice 3 final live-writer convergence.

Do not advance Slice 4 audit/design as the active programme until #962 re-closes.

No Slice 4 Production mutation is authorized.

## 10. Deployment classification

This documentation closure requires:

- SQL migration: **No**;
- Supabase Edge Function deploy: **No**;
- frontend deploy: **No**;
- canonical Registry mutation: **No**;
- Production runtime mutation: **No**.
