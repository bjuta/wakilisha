# MIZIZI Registry Authority Ledger

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

**Live posture**

- ACTIVE deployment
- `verify_jwt = false`
- service-role client
- no request-bound caller authentication
- no Registry capability authorization

Its apparent `auth.getUser()` use does not authenticate the request caller because the client is service-role and is not bound to the caller's bearer token.

**Canonical authority**

Stages CSV intake, records review decisions, and can create/update canonical Artists.

The review path accepts caller-supplied actor information.

**Current consumer**

The Admin Registry Artist intake page calls the function. The current page sends a public/anon credential rather than a user access token as mutation authority.

**Decision**: `CONVERGE`, then retire the standalone privileged boundary. It is a live product path and cannot be deleted until its workflow has a governed replacement.

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

The function also retains an embedded Charts implementation while current Charts code calls `chart-ingest-api`. Current-main search did not establish a live `admin-router/charts` caller.

**Decision**: `KEEP SHARED BOUNDARY`; mark embedded Charts section `CANDIDATE CONVERGENCE/RETIREMENT` after caller proof. Do not turn `admin-router` into a larger god-router.

### 6.7 `admin-registry-api`

**Live posture**

- ACTIVE deployment
- authenticated/capability-governed Admin boundary
- predates portions of `admin-router`

**Current consumer**

The Artist Top Songs admin component still calls this API, so the function is not globally dead.

**Decision**: `PARTIAL CONVERGENCE`. Move remaining unique capability to a shared governed primitive before retiring duplicate CRUD/router responsibilities.

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

This older broad public gateway remains source/deployment residue and contains the same Release-description write-on-read behavior.

Current-main application authority points to `public-content-read`; exact code search did not establish a current application consumer for `wakilisha-public-api` beyond source, docs, historical/operational references.

**Decision**: `CANDIDATE RETIRE`. Require traffic, host/proxy, SEO, external-consumer, and compatibility proof before deletion.

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

The following old maintenance functions are PUBLIC executable, `SECURITY INVOKER`, and do not contain their own authorization guard:

- `link_orphan_release_artists()`
- `rebuild_discography_from_metadata()`
- `split_multi_release_tracks()`

Because ordinary anon/authenticated roles do not have the required core table DML privileges, these are not currently a direct anonymous/authenticated Registry exploit.

They are still unnecessary callable surface.

**Decision**: `RETIRE OR INTERNALIZE` after dependency proof.

## 8. Frontend direct-DML drift

Current Admin detail code contains direct browser mutations against:

- `registry_artists`
- `registry_tracks`
- `registry_releases`

Production grants deny ordinary authenticated direct DML on those tables.

Therefore these calls are not alternate privileged authority; they are stale/broken mutation paths beside the governed Admin server boundary.

**Decision**: `CONVERGE`. Route through the canonical Admin Registry mutation primitive. Do **not** solve by granting browser DML.

## 9. Relationship authority duplication

WAKILISHA currently has two relationship authorities:

- `entity_relationships` + `relationship_evidence` over `cultural_entities`;
- `registry_entity_relationships` + `registry_relationship_evidence` over typed canonical endpoints.

The newer Registry graph is the active large graph: 163 relationships versus 2 in the old graph.

The four active `cultural_entities` rows are legacy music shells (`bien`, `sauti-sol`, Release `still`, Track `still`). Newer creation RPCs forbid new core music identity in that table.

**Decision**: `CONVERGE ON registry_entity_relationships`, but only after dependency/evidence migration proof. Preserve historical evidence and Institute semantics.

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