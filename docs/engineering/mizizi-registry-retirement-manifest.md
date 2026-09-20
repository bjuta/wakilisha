# MIZIZI Registry Retirement Manifest

> **17 September 2026 Slice 3 status:** the Artist-enrichment compatibility wrappers `backfill-artist-spotify-images` and `backfill-artist-type` have satisfied replacement and traffic proof and are now authorized for retirement as one coherent family. Production deletion remains a separate post-merge gate. Historical sections below retain the earlier prerequisite state rather than being rewritten.

Date: 14 September 2026

Status: **Slice 1 retirement design authority. This document identifies future retirement targets and prerequisites. It does not authorize deletion.**

Programme authority: `docs/engineering/mizizi-registry-authority-security-convergence-programme.md`

Authority ledger: `docs/engineering/mizizi-registry-authority-ledger.md`

Repository baseline: `main@4d07bf5acce5eb0a414728d7c198b26f54de6cf6`

## 1. Retirement rule

WAKILISHA will not delete an old function, route, table, RPC, or compatibility path merely because a newer path exists.

A retirement is accepted only when all of the following are proved:

1. the current consumers are known;
2. every legitimate capability has a replacement or is intentionally discontinued;
3. historical/canonical data preservation is defined;
4. Production invocation/traffic dependencies are checked where applicable;
5. repository source, UI, routes, docs, tests, deployment configuration, host/proxy configuration, and operational scripts are audited;
6. the replacement boundary has acceptance coverage;
7. the retired path receives a negative regression test where recurrence is plausible;
8. Production removal is followed by read-only acceptance proving the canonical graph is unchanged except for the explicitly accepted mutation.

This follows WAKILISHA's successful WordPress-runtime retirement pattern: retire the runtime authority without erasing accepted cultural content or rewriting history.

## 2. Lifecycle vocabulary

- **KEEP** — valid authority remains.
- **KEEP + CONVERGE** — preserve the capability, move its privileged mutation underneath shared governance.
- **CONVERGE THEN RETIRE** — current product capability remains, but the standalone authority path should disappear after replacement.
- **RETIRE** — capability itself is no longer wanted.
- **PARTIAL RETIREMENT** — function contains both unique live behavior and duplicated behavior; retire only the duplicate portion first.
- **FREEZE** — do not add new consumers while retirement proof is prepared.
- **PRESERVE HISTORY** — data/provenance may remain after runtime authority is gone.

## 3. Confirmed retirement target: `scrape-artist-data`

### Decision

**RETIRE completely in Slice 3. FREEZE immediately as an architectural decision; do not remove during Slice 1.**

### Why

The function:

- is an unauthenticated service-role Registry writer;
- scrapes WAKILISHA's own public Artist presentation;
- can reconstruct Artists, Releases, Tracks, memberships, credits, and relationships from that presentation;
- therefore creates circular public-presentation-to-canonical authority;
- has no current application caller found in current-main code search;
- has no current core Registry rows carrying the `wakilisha_scraper` provenance marker in the audited tables.

WAKILISHA is done using this capability. There is no reason to preserve it as a dormant emergency path.

### Retirement dependency checklist

Before deletion:

- prove no current frontend/admin route invokes it;
- prove no scheduled/cron/external workflow invokes it;
- inspect Edge Function invocation/log/monitoring evidence where available;
- search CI, scripts, deployment helpers, replay proofs, tests, and docs;
- confirm no host proxy or external integration depends on its URL;
- identify every test that currently expects its source to exist;
- distinguish historical replay documentation from live contracts;
- confirm zero required data migration;
- confirm its shared `registry-track-identity` helper remains needed by other functions before changing that helper;
- add a retirement contract that fails if the function source, deployment config, route, or UI consumer is reintroduced.

### Production retirement acceptance

- Edge Function deployment absent;
- source absent from active runtime tree;
- no UI/admin caller;
- no package/script command whose purpose is to invoke it;
- no active deployment configuration;
- canonical Artist/Track/Release counts and membership fingerprints unchanged by the retirement itself;
- accepted public Artist/Release/Track smoke unchanged;
- historical documentation retained where useful, clearly labelled historical.

## 4. `artist-registry-intake`

### Decision

**KEEP. CONVERGENCE COMPLETED IN SLICE 2 GATE A-FINAL.**

Do not retire the Artist intake product workflow or its current governed Edge
orchestration boundary.

### Accepted authority

Current repository and Production authority is:

- request bearer JWT;
- gateway `verify_jwt=true`;
- authenticated caller validation;
- `manage_registry` required before service-role orchestration;
- service-role limited to provider-intake staging/orchestration and canonical
  reads;
- no direct canonical `registry_artists` DML in the Edge function;
- reviewed caller-bound Artist creation/origin/enrichment admissions for
  canonical mutation;
- frozen review fingerprint and separate apply-result identity;
- deterministic idempotent Artist creation;
- active/draft-only reviewed and applied targets;
- canonical write and operation receipts through the accepted typed Registry
  authority.

The current privileged-writer classification is therefore:

- `authentication=request_bearer_user`;
- `authorization=manage_registry`;
- `executionAuthority=service_role_staging_and_reads_plus_caller_jwt_reviewed_registry_admissions`;
- `disposition=keep`;
- `publicCallable=false`;
- `canonicalMutation=true`;
- `legacyDebt=false`.

### Production closure lineage

Gate A-final PR #953 merged at
`91667e67ed29a6cc38c49359c44c837752d1e59d`.

Production acceptance proved:

- Artist Intake ACTIVE v33;
- `verify_jwt=true`;
- deployed bundle SHA-256
  `36d8b345ba6cd2951eaa5e686d7e7bbf4ceb4f3057bf554adc2ca13dfae87fc7`;
- anonymous POST rejected with HTTP 401 at the gateway;
- caller-bound Gate A-final RPCs deny `anon` EXECUTE and allow
  `authenticated` subject to their internal capability checks;
- current deployed source remains byte-identical to current Git.

No Slice 3 Edge deletion, SQL migration, data mutation, or frontend change is
required for this road.

**Status**: `SLICE3_ARTIST_REGISTRY_INTAKE=GOVERNED_KEEP`.

## 5. `ingest-artist-discography`

### Decision

**KEEP. PRIVILEGED MUTATION CONVERGENCE COMPLETED IN SLICE 2.**

Do not retire the Discography product workflow or the current governed
`ingest-artist-discography` orchestration boundary.

### Accepted authority

The old service-role canonical mutation road has already been replaced.

Current authority requires:

- request bearer JWT;
- `manage_registry`;
- isolated provider acquisition through
  `registry-discography-provider-fetch`;
- immutable provider snapshots and source fingerprints;
- reviewed, frozen execution plans;
- exact Artist UUID target binding;
- typed Release/Track identity and provider-profile operations;
- exact-set Release↔Artist, Release↔Track, and Track↔Artist replacement
  operations;
- current/final semantic fingerprints;
- exact row budgets and short-lived execution grants;
- operation/canonical-write receipts;
- independent deterministic verification;
- exact idempotent replay;
- preservation of unresolved credited-name evidence without fabricated Artist
  identity.

The current machine classification is already correct:

- `authentication=request_bearer_user`;
- `authorization=manage_registry`;
- `executionAuthority=caller_jwt_reviewed_evidence_typed_exact_grants`;
- `disposition=keep`;
- `publicCallable=false`;
- `canonicalMutation=true`;
- `legacyDebt=false`.

### Production closure lineage

PR #950 merged at
`e69f78667c8b8451239f085a87309e54a53fd008`.

Production convergence completed:

- canonical migration head for the Discography candidate:
  `20260916055145`;
- exact governed Discography Edge bundles promoted;
- governed frontend preview/create-shell/apply workflow activated;
- zero active `registry_discography_admin` execution grants at rest after
  acceptance;
- current `ingest-artist-discography`: ACTIVE v68;
- `verify_jwt=true`;
- current bundle SHA-256:
  `57fdd98772bab0eea44565bc41f7d1571201e80684a9603ae76c13c7ac13fe39`;
- deployed four-file Discography bundle remains byte-identical to current Git.

No Slice 3 SQL migration, Edge deletion, frontend change, or canonical data
mutation is required for this road.

**Status**: `SLICE3_INGEST_ARTIST_DISCOGRAPHY=GOVERNED_KEEP`.

## 6. Artist enrichment/backfill function family

Targets:

- `registry-enrich-artist`
- `backfill-artist-spotify-images`
- `backfill-artist-origin`
- `backfill-artist-type`

### Decision

**CONVERGE THEN RETIRE these four standalone privileged mutation boundaries as a family.**

The capabilities remain; the separate authorization surfaces should not.

### Why

All four are live Admin-product dependencies. They authenticate a user but do not require `manage_registry` or an equivalent per-action capability before using service role to mutate canonical Artist fields.

Patching the same authorization check into four separate functions would fix symptoms while preserving four privileged roads.

### Required replacement

A shared Artist enrichment capability must:

- bind the authenticated principal;
- distinguish evidence acquisition from canonical application;
- record provider/source provenance;
- define which fields each enrichment method may change;
- distinguish deterministic field updates from inferred identity semantics;
- require review/approval where inference risk exceeds policy;
- journal before/after state;
- support idempotent replay.

Artist type and origin deserve stricter evidence semantics than image refresh.

### Exit gate

The Admin Artist list/detail workflows remain available, but all canonical field changes cross one governed Artist-enrichment mutation boundary.

## 7. Old PUBLIC maintenance functions

Targets:

- `link_orphan_release_artists()`
- `rebuild_discography_from_metadata()`
- `split_multi_release_tracks()`

### Decision

**RETIRED. Repository and Production authority are closed.**

### Dependency and traffic proof

Current exact-main and Production inspection established:

- no current product or script caller;
- no live database function/procedure caller;
- no view or materialized-view dependency;
- no trigger dependency;
- no `pg_cron` caller;
- no dependent database object;
- zero recorded function-statistics calls.

Seven-day PostgREST traffic proof covered
`2026-09-11T06:32:40Z` through `2026-09-18T06:32:40Z` with 2,272,478
`/rest/v1/` positive-control requests and zero invocations across all three
target RPC paths. The final immediate pre-apply window from
`2026-09-18T06:32:40Z` through `2026-09-18T07:37:47Z` observed 3,288
additional `/rest/v1/` requests and zero target RPC traffic.

### Repository closure

PR #974 merged at
`main@85efa4db45ad27691d1f6011b1c1a3f4a4c61dcb` with:

- `20260918064000_legacy_registry_maintenance_rpc_retirement.sql`;
- no `CASCADE`;
- the retired writer-family removed from the privileged-writer manifest;
- permanent MIZIZI head-state negative contract;
- Preview replay proof sealed at exact migration head `20260918064000`;
- generated schema types with the three retired RPC signatures removed.

Protected CI on the sealed PR head passed:

- Critical Control Plane #1331;
- MIZIZI Track Production Control Plane #56;
- MIZIZI Release Production Control Plane #34.

### Production retirement closure

Accepted Production state after applying
`20260918064000_legacy_registry_maintenance_rpc_retirement`:

- migration count: 150;
- migration head: `20260918064000`;
- `link_orphan_release_artists()`: absent;
- `rebuild_discography_from_metadata()`: absent;
- `split_multi_release_tracks()`: absent;
- remaining target-name overloads: 0;
- canonical Registry table counts unchanged;
- canonical Registry row fingerprints unchanged across the six audited Registry
  tables;
- post-apply security/performance advisor scans contain no finding naming a
  retired RPC;
- data migration: no;
- canonical data mutation: no;
- Edge deployment: no;
- frontend deployment: no.

The disposable Preview used for replay proof was deleted after the replay
contract passed, stopping its hourly cost.

**Status**: `SLICE3_LEGACY_REGISTRY_MAINTENANCE_RPC_RETIREMENT=PRODUCTION_ACCEPTED`.

## 8. `wakilisha-public-api`

### Decision

**RETIRE NOW. Repository retirement first; Production deletion remains a separate post-merge gate.**

### Replacement proof

`public-content-read` is the accepted broad public application/API read authority.

Current exact-main proof establishes:

- zero current product caller;
- zero current GitHub workflow caller;
- zero current deployment-script caller;
- zero current migration caller;
- zero legacy-only route surface;
- zero legacy-only RPC surface;
- the two legacy-only relationship-table reads are obsolete implementation detail, superseded for related-Artist presentation by `get_public_artist_structural_proximity`;
- both gateways are mechanically free of direct canonical Registry DML.

### Production traffic proof

The corrected traffic audit used `function_edge_logs` with exact deployed function UUIDs across seven 24-hour windows from `2026-09-11T05:13:00Z` through `2026-09-18T05:13:00Z`.

Observed:

- global Edge Function invocations: 123,351;
- `public-content-read` invocations: 122,955;
- `wakilisha-public-api` invocations: 9.

All 9 legacy invocations are documented WAKILISHA engineering acceptance:

- two v105 calls are the Gate B Production Release `OPTIONS` + `GET` probe for `nakam-sai-feat-sosatheprodigyy-single`;
- seven v106 calls are the D2 Production Artist probes for Savara, Elsy Wameyo, Nyashinski, and Zaituni.

Unknown or organic legacy invocations in the frozen seven-day window: **0**.

### Repository retirement contract

- delete `supabase/functions/wakilisha-public-api/index.ts`;
- remove `wakilisha-public-api` from the privileged-writer manifest;
- move the function into the Phase 0B retired-source negative contract;
- keep the existing consolidated MIZIZI test file and narrow public-read/Top Songs assertions to the surviving `public-content-read` authority;
- add a permanent negative assertion that the retired Edge source and manifest classification remain absent;
- stop active performance tooling from classifying the retired gateway as a normal public-content request;
- update current operational proxy/cache documentation to `public-content-read`;
- preserve historical audits and closure records unchanged.

### Production retirement closure

Production retirement is complete.

Accepted Production state:

- repository retirement merged at `main@29e7bb083791a4dab3104dc8f4da8c3daa209461`;
- final immediate traffic recheck observed 4 global Edge Function invocations, 0 `wakilisha-public-api` invocations, and 4 `public-content-read` invocations;
- deployed `wakilisha-public-api` v106 rollback source was proven byte-identical to immutable Git source at `e8ec4d843f99700b96514ce8a3b2fd7bebb3c64d` and sealed locally before deletion;
- Production deletion of `wakilisha-public-api` returned HTTP 200;
- the function is absent from the Production Edge inventory;
- the retired URL returns HTTP 404 and fails closed;
- `public-content-read` v90 remains ACTIVE at bundle SHA `70a389d05f24c775a047ec8020651a4fb56d3e69420d4ed0eb3a24c610cb4f6d` and its live URL returns HTTP 200;
- SQL migration: no;
- canonical data mutation: no;
- frontend deployment: no;
- separate Finish update: no.

**Status**: `SLICE3_WAKILISHA_PUBLIC_API_RETIREMENT=PRODUCTION_ACCEPTED`.

## 9. `public-content-read` canonical write side effect

### Decision

**RETIRED. KEEP THE BROAD PUBLIC READ AUTHORITY.**

The canonical write-on-read behavior was removed by Slice 2 Gate B and the
remaining stale writer classification was closed by Slice 3 Candidate C.

### Accepted pure-read boundary

Current source and permanent contracts establish:

- missing Release descriptions are synthesized response-time only;
- `public-content-read` performs no direct canonical Registry
  INSERT/UPDATE/UPSERT/DELETE;
- the gateway may not invoke a database function classified as a canonical
  Registry mutator;
- operational rate-limit logging remains outside canonical music Registry truth;
- Magazine publication scheduling remains an editorial/publication concern,
  not a Registry mutation authority.

The privileged-writer manifest now permanently classifies the gateway as:

- `disposition=keep`;
- `futureBoundary=pure_public_read`;
- `publicCallable=true`;
- `canonicalMutation=false`;
- `legacyDebt=false`.

### Closure lineage

Slice 2 Gate B PR #957 merged at
`b9f425d53e901f87ce83b0be2cc4e3032bf97d54` and Production acceptance proved
response-time Release description synthesis does not mutate the canonical
Release row.

Slice 3 Candidate C PR #964 merged at
`8b45840e9aa142c16021f6dd694eddbb1c14bdae`, correcting the stale
privileged-writer/control-plane classification. Candidate C required no SQL,
Edge, frontend, or data deployment.

Current Production `public-content-read` is ACTIVE v90,
`verify_jwt=true`, bundle SHA-256
`70a389d05f24c775a047ec8020651a4fb56d3e69420d4ed0eb3a24c610cb4f6d`,
and the deployed source remains byte-identical to current Git.

No additional Slice 3 runtime or Production mutation is required.

**Status**: `SLICE3_PUBLIC_CONTENT_READ_WRITE_ON_READ=PRODUCTION_ACCEPTED`.

## 10. Admin detail browser DML

Targets historically identified:

- Artist detail direct `registry_artists.update()`;
- Track detail direct `registry_tracks.update()`;
- Release detail direct `registry_releases.update()`.

### Decision

**RETIRED. Slice 2 Gate A-final already removed these browser mutation roads.**

### Replacement proof

Current exact-main source proves:

- Artist detail save/archive routes through `saveRegistryEntityPatch(...)`;
- Track detail save routes through `saveRegistryEntityPatch(...)`;
- Track archive routes through `archiveRegistryTrack(...)`;
- Release detail save routes through `saveRegistryReleaseDetail(...)`;
- Release archive routes through `archiveRegistryRelease(...)`;
- none of the three current detail pages contains a direct
  `.from("registry_*").update(...)` road.

The governed Production authorities remain present:

- `admin_patch_registry_release_detail_v1(...)`;
- `admin_archive_registry_music_entity_v1(...)`.

Production grants also prove the old browser path cannot reappear accidentally:
`anon` and `authenticated` have no direct `INSERT`, `UPDATE`, or
`DELETE` grants on `registry_artists`, `registry_tracks`, or
`registry_releases`.

### Closure lineage

Slice 2 Gate A-final merged in PR #953 at
`91667e67ed29a6cc38c49359c44c837752d1e59d`. The final Slice 2 Production
closure recorded ordinary browser canonical Registry DML grants at zero.

No additional Slice 3 runtime patch, SQL migration, Edge deployment, frontend
deployment, or canonical data mutation is required for this road.

**Status**: `SLICE3_ADMIN_DETAIL_BROWSER_DML=ALREADY_RETIRED`.

## 11. `admin-router` embedded Charts path

### Decision

**RETIRE NOW. PARTIAL ROUTER RETIREMENT ONLY.**

Current Charts product code invokes `chart-ingest-api` directly. The replacement dispatcher covers the legacy action family and retains the newer governed operations. The rest of `admin-router` remains legitimate shared authority for Registry, provider credentials, users, and content.

### Production traffic proof

The read-only Edge log audit covered `2026-09-15T14:52:23Z` through `2026-09-17T18:47:02Z` in five windows. It observed 29,375 global Edge invocations, 14 `admin-router` invocations, six `chart-ingest-api` invocations, and zero `admin-router/charts` invocations. The positive control therefore proves the logging source was live while the retired route was unused.

### Repository retirement contract

- remove the embedded Charts dispatcher from `admin-router`;
- remove `/charts` and the legacy root action fallback;
- remove Charts from the router health-advertised section list;
- remove the retired path from both Admin Router OpenAPI authorities;
- keep `chart-ingest-api` and `chart-provider-fetch` unchanged;
- extend the existing MIZIZI chart convergence test with a permanent negative contract rather than adding a new test file.

### Production promotion

After protected CI and merge, deploy `admin-router` and run the normal frontend Production Finish update so the live Admin API docs receive the retired `/charts` contract. No SQL or canonical data mutation is required. Rollback authority for the Edge runtime is the exact accepted Production v50 bundle if an undiscovered dependency appears during Production acceptance.

## 12. `admin-registry-api`

### Decision

**RETIRE in Slice 3 D2 after D1 replacement proof.**

The prerequisite convergence is complete:

- generic Admin Registry CRUD is served by `admin-router/registry`;
- Top Songs reads are served by `get_artist_top_songs_v1`;
- Top Songs writes are served by `admin_replace_artist_top_songs_v1`;
- D1 Production public-reader and authenticated Admin acceptance passed;
- current-main has no remaining product caller;
- the initial bounded post-release Production traffic audit recorded zero invocations.

D2 removes the source and standing writer classification, then keeps Production v37 only until the merged retirement contract and a final zero-traffic check authorize deployment deletion. Historical Top Songs relationship rows, evidence, migration lineage, and presentation rows are preserved.

## 13. Legacy relationship authority

Historical targets:

- `cultural_entities` core-music shells;
- `entity_relationships` core-music observations;
- `relationship_evidence` links attached to those observations.

### Decision

**CORE-MUSIC AUTHORITY ALREADY RETIRED. PRESERVE THE HISTORICAL ROWS AND THE BROADER NON-MUSIC INSTITUTE MODEL.**

### Slice 2 convergence proof

Gate C already completed the required evidence-preserving convergence:

- all four legacy core-music shells map to exact typed Registry identities;
- both legacy relationship UUIDs are reused in
  `registry_entity_relationships`;
- review state, public-safety state, reason, provenance, timestamps, actor fields,
  and historical metadata are preserved;
- both legacy evidence links are present in
  `registry_relationship_evidence`;
- the old relationship and evidence rows were deliberately retained rather than
  deleted.

The Production population is now fully bounded:

- `cultural_entities`: 4 total, all four historical core-music shells;
- `entity_relationships`: 2 total, both historical core-music relationships;
- `relationship_evidence`: 2 total, one for each historical relationship;
- typed counterpart coverage: 2 / 2;
- typed evidence coverage: 2 / 2;
- canonical shell pointer coverage: 4 / 4.

### Fail-closed retirement boundary

Production has enabled triggers that reject mutation of legacy core-music
identity, relationships, and relationship evidence:

- `trg_reject_legacy_core_cultural_entity_mutation`;
- `trg_reject_legacy_core_relationship_mutation`;
- `trg_reject_legacy_core_relationship_evidence_mutation`.

Their trigger functions expose no EXECUTE authority to `public`, `anon`, or
`authenticated`.

Current runtime code does not use the legacy tables as core-music relationship
authority. Product and Institute record-detail relationship reads use
`registry_entity_relationships`.

### Historical replay authority

The Production-data-bound Gate C migration is intentionally retired from active
clean replay and retained byte-for-byte at:

`docs/engineering/replay-baseline/retired-active-migrations/20260916182000_registry_relationship_authority_convergence_v1.sql`

The active forward replacement
`20260917121000_registry_relationship_replay_authority_v1.sql` contains only
the enduring fail-closed triggers and no data-bound inserts, updates, or
deletes. The permanent replay verifier emits
`MIZIZI_RELATIONSHIP_REPLAY_AUTHORITY_PASS`.

### Broader cultural semantics explicitly preserved

Do **not** drop `cultural_entities`, `entity_relationships`, or
`relationship_evidence` merely because the current Production population is
only the historical core-music receipt.

`create_registry_cultural_entity(...)` remains a governed Institute primitive
for non-core cultural types and explicitly rejects
Artist/Track/Release/Label/Genre. `review_registry_cultural_entity(...)` also
refuses music-Registry identity.

No additional Slice 3 SQL migration, data migration, Edge deployment, frontend
deployment, or canonical data mutation is required for the core-music road.

**Status**:
`SLICE3_LEGACY_CORE_MUSIC_RELATIONSHIP_AUTHORITY=ALREADY_RETIRED`.

## 14. `registry-enrichment-review`

### Decision

**RETIRE. Repository retirement is authorized; Production deletion remains a
separate post-merge gate.**

### Why

Fresh Slice 3 dependency proof found no current product, workflow, Edge,
database function/procedure, view, or cron caller for the deployed runtime.

The historical frontend client documented in older architecture evidence is
absent from current main.

The runtime is still a high-authority service-role writer after
`manage_registry` authorization and can directly mutate canonical Registry
identity, credits, memberships, and relationships. With no legitimate live
consumer, preserving that dormant authority creates risk without preserving a
product capability.

### Production traffic proof

Critical Control Plane #1357 queried the exact deployed function id
`5421aa89-2b73-4fe8-9251-fa23f4dc84df` across seven 24-hour
`function_edge_logs` windows from 13 September 2026 12:39 UTC through
20 September 2026 12:39 UTC.

Observed:

- 46,013 total Edge-function log events;
- 0 `registry-enrichment-review` invocations;
- 45,670 `public-content-read` positive-control invocations.

Traffic gate: **PASS**.

### Repository retirement contract

- delete `supabase/functions/registry-enrichment-review/index.ts`;
- remove `registry-enrichment-review` from the active privileged-writer
  manifest;
- add it to the existing Phase 0B retired-source negative contract;
- update the consolidated MIZIZI test so the retired source must remain absent;
- preserve historical architecture and replay evidence unchanged;
- retain the shared `registry-track-identity.ts` helper because MIZIZI and
  active tests still use it.

### Production retirement gate

After protected merge:

1. run one immediate bounded traffic recheck;
2. prove the live v42 rollback source/hash;
3. delete only `registry-enrichment-review`;
4. prove the function is absent from Production Edge inventory;
5. prove the retired URL fails closed;
6. prove retained Registry/Admin authorities remain healthy;
7. run the final whole-Slice 3 mechanical exit audit.

No SQL migration, canonical data mutation, frontend deployment, or unrelated
Edge deployment is required.

## 15. What is explicitly not being retired

The following should not be swept away merely for consolidation aesthetics:

- `registry_artists`, `registry_tracks`, `registry_releases`;
- typed Track/Release Artist credits;
- Release membership table;
- `registry_entity_index` read projection;
- command receipts/jobs/outbox primitives;
- provider evidence/intake data;
- historical analytics/search-console URL observations;
- Artist Studio/community/editorial domain tables whose semantics are not equivalent;
- `public-query-v1` narrow search authority;
- governed domain RPCs that already enforce their business permission contract;
- Chart/discography/provider capabilities that have legitimate active consumers.

## 16. Retirement execution order

The intended Slice 3 order is:

1. land replacement primitives from Slice 2;
2. route active product writers onto those primitives;
3. prove parity and receipts;
4. remove canonical write-on-read behavior;
5. retire stale browser DML;
6. retire orphaned/duplicate runtime surfaces, including `scrape-artist-data` once final dependency proof passes;
7. migrate legacy relationship authority with evidence preservation;
8. revoke obsolete execution grants;
9. delete obsolete live Edge deployments;
10. add negative architectural tests;
11. run canonical graph, public route, Admin workflow, replay, and security acceptance;
12. document exact Production completion.

This order prevents a security cleanup from becoming a product outage or a data migration by accident.

## 17. Programme rule after retirement

Once a privileged path is retired, WAKILISHA must not reintroduce it as an emergency shortcut.

New Registry writers must enter through the machine-classified capability/admission contract. A one-off importer, backfill, support tool, or autonomous agent is not exempt merely because its intended lifetime is short.