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

**CONVERGE THEN RETIRE the standalone privileged boundary.**

Do not retire the Artist intake product workflow.

### Why

The current function is product-wired, but its network authorization model is unacceptable for canonical mutation: `verify_jwt=false`, service-role authority, and no request-bound caller authorization.

### Required replacement

Artist intake must become a typed governed operation using the shared Registry mutation/admission primitive. The UI must use the signed-in actor identity, not a public/anon credential, and review decisions must derive actor identity from authenticated authority rather than caller-supplied actor text.

### Exit gate

- upload/staging remains functional;
- review decision is authenticated and capability-bound;
- apply-approved uses typed canonical admission;
- exact before/after acceptance for representative Artist rows;
- old function unavailable after cutover;
- Admin intake route remains functional without hidden fallback.

## 5. `ingest-artist-discography`

### Decision

**KEEP capability; CONVERGE privileged mutation. Do not retire the product workflow.**

### Why

Discography ingestion is live, product-wired, and materially represented in current Registry provenance. It also has legitimate high-blast-radius behavior: Track/Release upsert plus credit/membership rebuild.

### Future shape

The function may remain an investigation/provider adapter, but the canonical mutations should be brokered through typed capabilities such as:

- `registry.artist.ensure_shell`
- `registry.release.upsert_provider_observation`
- `registry.track.upsert_provider_observation`
- `registry.release.membership.replace`
- `registry.track.credit.replace`
- `registry.release.credit.replace`

The capability names are illustrative until Slice 2 finalizes the primitive contract.

### Exit gate

No application-visible regression in preview/apply/create-shell workflow, but no broad service-role mutation remains available merely because a gateway JWT exists.

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

**RETIRE OR INTERNALIZE after dependency proof.**

### Why

They are PUBLIC executable `SECURITY INVOKER` maintenance functions without their own authorization checks. Current ordinary anon/authenticated table grants prevent them from mutating core Registry state, so this is unnecessary surface rather than a demonstrated direct exploit.

### Exit gate

- no live application/RPC consumer;
- no migration/replay contract depends on runtime presence;
- if still operationally useful, replace PUBLIC execute with an internal controlled maintenance path;
- negative test prevents PUBLIC re-exposure.

## 8. `wakilisha-public-api`

### Decision

**CANDIDATE RETIRE; FREEZE new consumers now.**

### Why

Current application/env/API-doc authority points to `public-content-read`, while `wakilisha-public-api` remains an older broad gateway. It also contains canonical Release write-on-read behavior.

### Required proof before retirement

- Production request/traffic analysis;
- Cloudflare/Nginx/host routing analysis;
- API docs and external consumer analysis;
- SEO/prerender compatibility audit;
- direct URL references outside application code;
- acceptance comparison against `public-content-read` for any endpoints still served uniquely.

### Exit gate

No external/public contract is silently broken, and `public-content-read` does not inherit obsolete compatibility behavior solely to make deletion easy.

## 9. `public-content-read` canonical write side effect

### Decision

**RETIRE the write-on-read behavior, not the current broad public read authority.**

### Target behavior

Generating a Release description during a read may remain a presentation concern, but a public read must not persist that derived description into canonical Registry state.

Acceptable future choices include:

- compute the fallback description only in the response;
- precompute it through a governed projection workflow;
- persist it through a typed editorial/Registry mutation with explicit authority.

### Exit gate

A public Release GET/read cannot mutate `registry_releases` even when description is missing. Deterministic database/audit acceptance must prove zero canonical write events from public read requests.

## 10. Admin detail browser DML

Targets:

- Artist detail direct `registry_artists.update()`
- Track detail direct `registry_tracks.update()`
- Release detail direct `registry_releases.update()`

### Decision

**RETIRE stale direct browser mutation code after replacement wiring is accepted.**

Do not grant direct authenticated table DML to make this code work.

### Replacement

Use the canonical Admin Registry mutation client/boundary with the authenticated user's access token, capability check, expected-state protection, and audit receipt.

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

Targets:

- `cultural_entities` core-music shells;
- `entity_relationships`;
- `relationship_evidence`;
- old Institute/contributor dependencies that still point at that graph.

### Decision

**CONVERGE, MIGRATE EVIDENCE, THEN RETIRE THE OLD CORE-MUSIC GRAPH PATH.**

Do not delete rows merely because only two relationships remain.

### Required migration proof

- map four legacy cultural shells to typed Registry identities;
- map old relationships to canonical typed endpoints;
- preserve review state, public-safety state, confidence, evidence, provenance, timestamps, and contributor history;
- audit all functions/views/UI that reference old relationship IDs;
- prove no non-music cultural semantics are accidentally forced into a music-specific graph;
- explicitly decide whether `cultural_entities` remains for non-core cultural domains.

### Exit gate

Core Artist/Track/Release relationships have one authority: `registry_entity_relationships`.

## 14. What is explicitly not being retired

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

## 15. Retirement execution order

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

## 16. Programme rule after retirement

Once a privileged path is retired, WAKILISHA must not reintroduce it as an emergency shortcut.

New Registry writers must enter through the machine-classified capability/admission contract. A one-off importer, backfill, support tool, or autonomous agent is not exempt merely because its intended lifetime is short.