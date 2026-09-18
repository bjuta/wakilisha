# MIZIZI Registry Authority Ledger

> **17 September 2026 Slice 3 status:** `backfill-artist-spotify-images` and `backfill-artist-type` are retired repository/runtime candidates after post-convergence traffic proof. Current Admin enrichment uses `registry-enrich-artist`; the two compatibility wrappers have no current product, workflow, database, or cron caller. Historical Slice 1 / Slice 2 sections below remain evidence of the authority that existed when audited.

Date: 14 September 2026

Status: **Slice 1 read-only authority audit. This document does not authorize a Production mutation, grant change, function deletion, route deletion, migration, or MIZIZI execution change.**

Programme authority: `docs/engineering/mizizi-registry-authority-security-convergence-programme.md`

Repository baseline: `main@4d07bf5acce5eb0a414728d7c198b26f54de6cf6`

Production project: WAKILISHA / `pgzizndxdyhqmtyywjmt`

## 1. Purpose

This ledger answers one question before WAKILISHA changes the Registry control plane:

> **By what mechanisms can canonical music identity or its authoritative relationships change today?**

The answer must distinguish a table reader from a writer, authentication from authorization, a governed domain mutation from an ambient service-role mutation, a live product path from deployed residue, and canonical mutation from projection/history maintenance.

The ledger is intentionally evidence-led. It does not classify a surface as unsafe merely because it is `SECURITY DEFINER`, uses `service_role`, or appears in a Supabase advisor warning. It classifies the complete authority path.

## 2. Scope

Canonical music authority in scope:

- `public.registry_artists`
- `public.registry_tracks`
- `public.registry_releases`
- `public.registry_track_artists`
- `public.registry_release_artists`
- `public.registry_release_tracks`
- `public.registry_entity_relationships`
- `public.registry_relationship_evidence`

Legacy/parallel relationship authority in scope:

- `public.cultural_entities`
- `public.entity_relationships`
- `public.relationship_evidence`

Associated control-plane and governance structures are included where they authorize, journal, review, or project these mutations.

## 3. Current live canonical baseline

The Slice 1 audit refreshed the earlier research snapshot against Production. The current live totals are:

| Authority | Total | Active |
|---|---:|---:|
| `registry_artists` | 1,227 | 632 |
| `registry_tracks` | 2,447 | 2,101 |
| `registry_releases` | 841 | 841 |
| `registry_track_artists` | 4,320 | 4,026 |
| `registry_release_artists` | 1,424 | 1,424 |
| `registry_release_tracks` | 2,363 | 2,363 |
| `registry_entity_relationships` | 163 | 163 |
| `entity_relationships` | 2 | n/a |
| `cultural_entities` | 4 | 4 |

Artist status distribution is 632 active, 578 draft, 8 needs-review, and 9 archived. Track status distribution is 2,101 active, 310 needs-review, and 36 archived.

These counts supersede earlier research-desk counts as the Slice 1 live baseline. Earlier counts remain historical audit evidence, not current authority.

`registry_release_tracks` remains the active Release-membership authority. The legacy `registry_tracks.release_id` column is not the canonical membership model.

## 4. Primary conclusion

The music Registry is not suffering from multiple large active Artist/Track/Release truth stores.

The core has substantially converged.

The sprawl is in **mutation roads and governance concepts around that core**:

1. governed capability-aware writers;
2. authenticated but under-authorized service-role writers;
3. unauthenticated legacy service-role writers;
4. stale browser-side direct DML;
5. canonical mutation hidden inside public read paths;
6. overlapping old/new relationship authorities;
7. one-time/backfill functions still deployed as permanent runtime authority;
8. duplicated admin/public gateways whose remaining consumers differ.

This is the correct target for convergence.

## 5. Role and table-grant boundary

Direct table DML is already narrower than the Edge Function surface suggests.

For the core Artist/Track/Release and membership/credit tables, ordinary `anon` and `authenticated` roles do not hold direct INSERT/UPDATE/DELETE privileges. `service_role` does.

This matters for two reasons:

- stale frontend `.update()` calls are not secret privileged bypasses; they are authority drift and should converge onto a governed server mutation path rather than receive broader grants;
- old `SECURITY INVOKER` maintenance functions that are PUBLIC executable cannot currently mutate the core tables under ordinary anon/authenticated privileges.

The legacy relationship graph is different. Authenticated DML grants still exist on portions of that graph and are constrained through Institute RLS/policies. It is therefore a genuine parallel governance authority, not merely dead schema.

## 6. Edge Function writer ledger

### 6.1 `scrape-artist-data`

**Live posture**

- ACTIVE deployment
- `verify_jwt = false`
- service-role database client
- no caller authentication
- no caller capability authorization
- permissive CORS

**Canonical authority**

Can create or update Artists, Releases, Tracks, Track credits, Release credits, Release memberships, and Registry entity relationships.

It scrapes WAKILISHA's own `/artists/{slug}/` presentation and can feed that presentation back into canonical Registry state. That is circular authority.

**Consumer/provenance proof**

Current-main code search found no application caller. Remaining references are function source, historical/replay documentation, and tests. A live provenance scan found zero current core Registry rows or Registry relationship rows carrying the function's `wakilisha_scraper` marker.

**Decision**: `RETIRE`, but only in Slice 3 after deployment/traffic/dependency proof is completed. **Do not remove in Slice 1.**

### 6.2 `artist-registry-intake`

**Current accepted posture**

- ACTIVE Production deployment v33;
- `verify_jwt = true`;
- request bearer JWT validated before privileged orchestration;
- `manage_registry` required before any service-role client is created;
- service-role use is restricted to intake staging/orchestration and canonical
  reads;
- the Edge function contains no direct canonical `registry_artists`
  insert/update/delete road;
- canonical Artist creation and enrichment execute through caller-bound reviewed
  Registry admissions.

The Admin Registry Artist intake page sends the signed-in user's Supabase access
token. Review decisions bind the authenticated caller rather than body-supplied
actor text.

Gate A-final introduced and accepted the governed authority chain:

- `admin_review_registry_artist_intake_v1(...)`;
- `admin_get_registry_artist_intake_review_v1(...)`;
- `admin_create_registry_artist_intake_shell_v1(...)`;
- `admin_mark_registry_artist_intake_applied_v1(...)`;
- existing typed Artist Origin and Artist Enrichment admissions.

Review state is fingerprinted before apply, reviewed/applied Artist targets are
restricted to active/draft Registry Artists, new identity creation reuses the
typed `registry.artist.create/v1` materializer, and canonical writes emit the
accepted operation/write-event authority.

Gate A-final merged in PR #953 at
`91667e67ed29a6cc38c49359c44c837752d1e59d` and was Production-accepted with
Artist Intake ACTIVE v33, `verify_jwt=true`, bundle SHA-256
`36d8b345ba6cd2951eaa5e686d7e7bbf4ceb4f3057bf554adc2ca13dfae87fc7`.
Current Production source remains byte-identical to current repository source.

**Decision**: `KEEP`. The standalone Artist Intake product boundary is no
longer legacy privileged debt. Its orchestration remains legitimate because
canonical mutation is delegated to reviewed, caller-bound typed Registry
admissions. Reintroduction of public/anon mutation authority or direct canonical
Artist DML is prohibited by the permanent control-plane contract.

### 6.3 `ingest-artist-discography`

**Live posture**

- ACTIVE deployment
- `verify_jwt = true`
- service-role mutation client
- gateway authentication present
- no request-user/capability authorization inside the function

Gateway JWT verification is authentication, not Registry authorization.

**Canonical authority**

Can:

- create an Artist shell;
- upsert Tracks and Releases;
- update Artist metadata;
- delete and rebuild Release memberships;
- delete and rebuild Release and Track credits.

The destructive membership/credit rebuild makes this one of the highest-blast-radius legitimate Registry writers.

**Current consumer**

The Artist Discography Intake drawer is wired to this function.

**Provenance**

Apple Music/discography provenance is materially represented in current Registry data. This workflow is not disposable in the way `scrape-artist-data` appears to be.

**Decision**: `KEEP CAPABILITY / CONVERGE AUTHORITY`. Preserve the product capability but move execution behind the shared Registry authorization/mutation primitive.

### 6.4 `registry-enrichment-review`

**Live posture**

- ACTIVE deployment
- `verify_jwt = true`
- explicitly resolves bearer user
- checks `manage_registry`
- uses service role only after authorization

**Canonical authority**

Can canonicalize Release shells, create Artists/Tracks/Labels, create Release credits, and create Registry relationships.

**Current consumer status**

Exact current-main slug search established the function and historical references but did not establish a current application caller. That is a caller-status question, not evidence that the function is dead.

**Decision**: `KEEP / HARDEN / CONVERGE`. This is much closer to the desired boundary than the legacy writers.

### 6.5 `chart-ingest-api`

**Live posture**

- ACTIVE deployment
- request-bearer authentication
- action-specific capability checks
- caller-JWT + RLS for Chart-domain reads and writes
- no `SUPABASE_SERVICE_ROLE_KEY` load
- no direct canonical Registry DML
- provider fetch delegated to `chart-provider-fetch`, which returns provider data rather than credentials

**Canonical authority**

Artist creation, Track creation, and Track↔Artist credit admission route through `chart_materialize_candidate_registry_v1(...)`. Existing-Artist origin admission routes through `chart_admit_artist_origin_v1(...)`, and unresolved Artist origin creation routes through `chart_create_artist_origin_shell_v1(...)`.

`chart-ingest-api` is therefore an orchestration boundary, not a canonical Registry writer.

`chart-provider-fetch` is a narrow provider boundary: it verifies the request user and `manage_ingest`, reads the existing Admin-managed provider secret store server-side, performs the provider request, and returns normalized provider data. It has no Registry authority.

**Current consumer**

Current Charts admin client is wired directly to `chart-ingest-api`.

**Decision**: `KEEP / SLICE-2 CONVERGED`. Preserve caller identity, Chart RLS, and governed typed Registry operations. Keep the superseded service-role origin roads revoked.

### 6.6 `admin-router`

**Live posture**

- ACTIVE deployment
- request-bound user authentication
- role/capability resolution
- `manage_registry` enforcement for Registry routes
- service-role mutation after authorization
- rate limiting and audit behavior

**Canonical authority**

Shared Admin Registry CRUD is routed through this boundary.

Current Registry client sends the real user's access token.

The function retained an embedded Charts implementation after current Charts code had already converged on `chart-ingest-api`. The Slice 3 Production traffic gate observed 29,375 global Edge invocations and 14 real `admin-router` invocations across the post-convergence window, with zero `admin-router/charts` calls.

**Decision**: `KEEP SHARED BOUNDARY / RETIRE EMBEDDED CHARTS`. The repository candidate removes only the duplicate Charts dispatcher and contract surface. Registry, credentials, users, content, rate limiting, and shared Admin authorization remain in `admin-router`. Production retirement is not complete until the merged candidate is deployed and independently accepted.

### 6.7 `admin-registry-api`

**D2 retirement posture**

- Production v37 is retained only as the temporary rollback deployment until the final D2 deletion gate;
- current generic Admin Registry CRUD is served by `admin-router/registry`;
- Artist Top Songs reads use `get_artist_top_songs_v1`;
- Artist Top Songs writes use `admin_replace_artist_top_songs_v1`;
- D1 Production acceptance proved both public readers and the authenticated Admin read/write path against the presentation authority;
- exact current-main search establishes no remaining product caller;
- the initial post-D1-release Production traffic window recorded zero `admin-registry-api` invocations.

**Decision**: `RETIRE`. D2 removes the repository runtime source and privileged-writer classification now. The Production v37 deployment is deleted only after the retirement change is merged and a fresh final traffic check remains zero.

### 6.8 `provider-intake-api`

**Live posture**

- ACTIVE deployment
- request-user authorization for privileged routes
- Artist submission and Admin intake semantics are distinct

**Canonical authority**

Creates/updates draft Release shells and provider-intake staging. It is an admission/intake surface, not equivalent to final canonicalization.

**Current consumers**

Artist music submissions and Admin Track intake use it.

**Decision**: `KEEP / CONVERGE`. Preserve provider observation/intake semantics; do not collapse provider evidence into canonical truth.

### 6.9 Artist enrichment/backfill family

The following deployed functions are product-wired from Admin Artist pages:

- `registry-enrich-artist`
- `backfill-artist-spotify-images`
- `backfill-artist-origin`
- `backfill-artist-type`

They authenticate a user but do not establish `manage_registry` or an equivalent action capability before using service role to update canonical Artist fields.

Collectively they can change:

- canonical/public image;
- Artist bio and provider metadata;
- origin and origin confidence;
- Artist type.

`backfill-artist-type` additionally applies name heuristics and optional MusicBrainz evidence to an identity-semantic field.

**Decision**: `CONVERGE AS ONE GOVERNED ARTIST ENRICHMENT CAPABILITY FAMILY`. Do not patch four independent authorization snippets and leave four permanent privileged roads.

### 6.10 `run-chart-playback-enrichment`

**Live posture**

- request authentication
- admin or `manage_charts` capability gate
- service-role persistence

**Canonical authority**

Primarily manages chart playback-enrichment state and provider links. In write mode it also updates Registry Track provider metadata.

**Decision**: `KEEP / CONVERGE`. Treat provider-link persistence as a typed Registry metadata capability rather than broad table authority.

### 6.11 `public-content-read`

**Role**

This is the current broad public application/API read authority. Frontend runtime base, public API client, API documentation, environment authority, and prerendering all point at it.

**Critical finding**

The Release read path uses service role and, when a Release description is blank, synthesizes a description and writes it back to `registry_releases` during the read request.

That is a canonical side effect hidden in a public read path.

The function also performs operational side effects such as rate-limit logging and an editorial publication check. Those are separate concerns; they do not make canonical Registry mutation acceptable.

**Decision**: `KEEP READ AUTHORITY / REMOVE CANONICAL WRITE SIDE EFFECT`. The future invariant is stronger than “no unsafe write”: **canonical public Reads are mechanically read-only with respect to Registry truth.**

### 6.12 `wakilisha-public-api`

**Slice 3 retirement closure**

- `public-content-read` is the accepted broad public application/API authority;
- exact-main application, workflow, deployment-script, and migration audits found no current caller for `wakilisha-public-api`;
- the legacy gateway had zero route or RPC surface not already owned by `public-content-read`;
- its old related-Artist table reads were superseded by the governed structural-proximity read authority;
- corrected seven-day Production traffic analysis found 123,351 total Edge Function invocations, 122,955 `public-content-read` invocations, and 9 `wakilisha-public-api` invocations;
- all 9 legacy invocations were documented WAKILISHA acceptance probes, with zero unknown or organic consumers;
- the repository retirement merged at `main@29e7bb083791a4dab3104dc8f4da8c3daa209461`;
- an immediate pre-delete traffic recheck observed 4 global invocations, 0 legacy invocations, and 4 replacement invocations;
- `wakilisha-public-api` v106 was deleted from Production after rollback-source equivalence was proven and sealed;
- the retired URL returns HTTP 404 and the Production Edge inventory no longer contains the function;
- `public-content-read` v90 remains ACTIVE and live at bundle SHA `70a389d05f24c775a047ec8020651a4fb56d3e69420d4ed0eb3a24c610cb4f6d`.

**Decision**: `RETIRED`. The obsolete broad gateway no longer exists in repository or Production authority. Reintroduction is prohibited by the retired-source negative contract.

### 6.13 `public-query-v1`

This is a newer narrow same-origin public search/query primitive, with Nginx routing and dedicated search acceptance tests.

It is not another broad canonical content gateway.

**Decision**: `KEEP`. Preserve the narrower bounded-read pattern.

## 7. Database function authority

### 7.1 Modern governed writers

The direct Registry writer query identified modern `admin_*` and domain functions whose definitions perform internal administrator/capability/role checks before canonical mutation. Examples include:

- `admin_apply_chart_artist_resolution_decision`
- `admin_apply_registry_track_duplicate_repair`
- `admin_create_registry_track_from_intake_enriched`
- `admin_decouple_registry_artist`
- `admin_merge_registry_artists`
- `admin_resolve_chart_artist_alias`
- `admin_resolve_registry_track_intake_enriched`
- `admin_safe_merge_registry_artists`
- `accept_registry_missing_artist_intake`

These are not classified as vulnerabilities merely because authenticated callers can execute them. Their authorization must be preserved and eventually represented in the machine-readable writer manifest.

### 7.2 Claim-created Artist path

`community_admin_decide_artist_claim` is a governed domain writer, not an ambient Artist-creation bypass. It requires claim-review permission, checks MIZIZI identity candidates before creating a proposed Artist, and records canonical write evidence.

**Decision**: `KEEP DOMAIN SEMANTICS / CONVERGE JOURNAL AND ADMISSION CONTRACT`.

### 7.3 Cultural-entity functions

`create_registry_cultural_entity` and `review_registry_cultural_entity` are Institute-gated and explicitly reject core music identity types such as Artist, Track, Release, Label, and Genre.

This is good boundary behavior.

### 7.4 Relationship review functions

Both legacy and new relationship review paths are Institute-gated:

- `institute_review_entity_relationship`
- `review_registry_relationship`

The problem is therefore duplicated relationship authority, not an absence of reviewer authorization.

### 7.5 Old PUBLIC maintenance functions

Targets:

- `link_orphan_release_artists()`
- `rebuild_discography_from_metadata()`
- `split_multi_release_tracks()`

**Slice 3 retirement closure**

Production inspection established all three were zero-argument `SECURITY INVOKER`
functions owned by `postgres`, callable through PUBLIC EXECUTE, with no internal
authorization guard.

Dependency proof found:

- no current application or script caller;
- no live database function/procedure caller;
- no view or materialized-view dependency;
- no trigger dependency;
- no `pg_cron` caller;
- no dependent database object;
- zero recorded function-statistics calls.

A seven-day `edge_logs` audit from `2026-09-11T06:32:40Z` through
`2026-09-18T06:32:40Z` observed 2,272,478 `/rest/v1/` requests and zero
requests to any of the three exact `/rest/v1/rpc/...` paths. A final immediate
pre-apply audit from `2026-09-18T06:32:40Z` through
`2026-09-18T07:37:47Z` observed 3,288 additional `/rest/v1/` requests and
zero target RPC invocations.

Repository retirement merged at
`main@85efa4db45ad27691d1f6011b1c1a3f4a4c61dcb`. Production then applied
`20260918064000_legacy_registry_maintenance_rpc_retirement`.

Accepted Production state:

- migration ledger: 150 migrations;
- migration head: `20260918064000`;
- all three zero-argument maintenance functions are absent;
- remaining overloads across the three retired function names: 0;
- pre/post canonical Registry fingerprints are identical across
  `registry_artists`, `registry_tracks`, `registry_releases`,
  `registry_track_artists`, `registry_release_artists`, and
  `registry_release_tracks`;
- canonical Registry data mutation: none;
- post-apply Supabase advisor scans contain no finding naming any retired RPC;
- no Edge deployment;
- no frontend deployment.

Historical migrations remain immutable. The September 5 replay-parity migration
continues to record the historical PUBLIC-execute state that existed at that
point in schema history; the September 18 head migration is the retirement
authority.

**Decision**: `RETIRED`. No replacement runtime is required. Reintroduction of
these PUBLIC maintenance RPCs is prohibited by the head-state negative contract.

## 8. Frontend direct-DML drift

**Slice 3 closure: already retired by Slice 2 Gate A-final.**

The historical Slice 1 audit identified direct browser mutations against:

- `registry_artists`;
- `registry_tracks`;
- `registry_releases`.

Current exact-main source no longer contains those mutation roads:

- Artist detail manual save/archive uses `saveRegistryEntityPatch(...)` through
  the shared Admin Registry client;
- Track detail save uses `saveRegistryEntityPatch(...)`;
- Track archive uses `archiveRegistryTrack(...)` and the governed
  `admin_archive_registry_music_entity_v1(...)` authority;
- Release detail save uses `saveRegistryReleaseDetail(...)` backed by
  `admin_patch_registry_release_detail_v1(...)`;
- Release archive uses `archiveRegistryRelease(...)` and the same governed
  archive authority.

Production confirms both replacement RPCs exist, while `anon` and
`authenticated` have no `INSERT`, `UPDATE`, or `DELETE` grants on
`registry_artists`, `registry_tracks`, or `registry_releases`.

Slice 2 Gate A-final merged the source convergence in PR #953 at
`91667e67ed29a6cc38c49359c44c837752d1e59d`. Slice 2 was subsequently
closed in Production with ordinary browser canonical Registry DML grants at
zero, as recorded in the final Slice 2 closure.

**Decision**: `RETIRED`. No Slice 3 implementation or Production mutation is
required. The stale direct browser DML path survives only in historical audit
documentation.

## 9. Relationship authority duplication

**Slice 3 closure: core-music legacy relationship authority was already converged and frozen by Slice 2 Gate C.**

The two table families have different surviving roles:

- `registry_entity_relationships` + `registry_relationship_evidence` are the
  current typed Registry relationship authority for core music;
- `cultural_entities` + `entity_relationships` + `relationship_evidence`
  retain historical Institute evidence and the broader non-music cultural model.

Production currently contains exactly four legacy core-music
`cultural_entities` rows:

- Artist `mejja`;
- Artist `fik-fameica`;
- Track `siaka`;
- Release `mtoto-wa-khadija`.

All four carry canonical pointers to existing typed Registry identities. The
legacy graph contains exactly two core-music relationships and two linked
evidence rows. Both relationship UUIDs are preserved in
`registry_entity_relationships` with
`source_kind='legacy_cultural_relationship_migration'`, and each typed
relationship carries the corresponding migrated evidence link.

Slice 2 Gate C preserved the old rows as immutable historical observations
rather than deleting them. Production has all three fail-closed triggers enabled:

- `trg_reject_legacy_core_cultural_entity_mutation`;
- `trg_reject_legacy_core_relationship_mutation`;
- `trg_reject_legacy_core_relationship_evidence_mutation`.

The trigger functions are not executable by `public`, `anon`, or
`authenticated`.

Current product relationship reads use typed Registry authority. No current
runtime source directly reads or writes the three legacy tables as core-music
authority. The Institute record-search surface reads
`registry_entity_relationships`, not `entity_relationships`.

The broader cultural model is deliberately preserved. Production
`create_registry_cultural_entity(...)` accepts only non-core cultural types
such as person, scene, place, event, institution, work, concept, language,
movement, publication, organization, article, inquiry, memory, and source. It
explicitly rejects Artist/Track/Release/Label/Genre identity, and
`review_registry_cultural_entity(...)` refuses to review those music types in
this table.

The original data-bound convergence migration is preserved as historical replay
evidence under
`docs/engineering/replay-baseline/retired-active-migrations/20260916182000_registry_relationship_authority_convergence_v1.sql`.
Its enduring fail-closed authority was moved to
`20260917121000_registry_relationship_replay_authority_v1.sql`.

**Decision**: `CORE-MUSIC AUTHORITY RETIRED; HISTORICAL EVIDENCE PRESERVED`.
Do not drop the broader cultural tables. Their non-music Institute semantics are
outside this retirement target.

## 10. Public/read authority duplication

Current evidence supports this separation:

- `public-content-read`: broad current public application/API authority;
- `public-query-v1`: narrow same-origin search/query primitive;
- `wakilisha-public-api`: older broad gateway candidate for retirement after consumer proof.

Do not combine the first two merely because both are public. Their bounded responsibilities differ.

## 11. Command/control-plane authority

Current Production counts:

| Primitive | Rows |
|---|---:|
| `platform_private.command_types` | 128 |
| `platform_private.command_receipts` | 251 |
| `platform_private.jobs` | 16 |
| `platform_private.outbox_events` | 505 |
| `registry_canonical_write_events` | 552 |
| `registry_audit_log` | 157 |

`command_receipts` already carries strong concepts: principal, command type, idempotency, request fingerprint, request/result payloads, status, actor, and completion state.

However, its `resource_id` has a hard foreign key to `editorial.resources(id)`.

**Decision**: preserve the proven receipt contract. Do not pretend a Registry Track/Artist/Release is an editorial Resource. Introduce a Registry operation/target abstraction around the receipt rather than weakening its existing semantics.

## 12. Supabase advisor interpretation

The audit baseline included approximately:

- 100 mutable-search-path warnings;
- 78 anon-executable `SECURITY DEFINER` warnings;
- 507 authenticated-executable `SECURITY DEFINER` warnings;
- 140 RLS-enabled/no-policy informational findings.

These are inventory signals, not vulnerability counts.

Slice 1 narrows them by actual mutation target, SQL security mode, role grants, internal authorization, caller, and blast radius.

Future CI should make this classification machine-readable so a new privileged function cannot silently enter the system without an owner and authority contract.

## 13. Authority classes for the machine-readable manifest

Every privileged callable or Edge writer must eventually declare:

- `principal_type`
- `authentication_mode`
- `required_capability`
- `domain`
- `operation_kind`
- `mutation_targets`
- `allowed_fields`
- `service_role_required`
- `public_callable`
- `human_callable`
- `mizizi_callable`
- `receipt_required`
- `approval_class`
- `blast_radius_class`
- `reversible`
- `verifier`
- `owner`
- `lifecycle = keep | converge | retire`

Missing classification should fail CI once the manifest becomes executable policy.

## 14. Slice 1 exit assessment

The audit has enough evidence to reject piecemeal security fixes.

The next implementation work should be driven by the companion Retirement Manifest and Primitive Convergence Map.

No surface in this ledger is authorized for deletion or mutation merely because it is marked `RETIRE` or `CONVERGE`.

The next mutation-bearing slice begins only after these three artifacts are accepted together.