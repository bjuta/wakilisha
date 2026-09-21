# MIZIZI Slice 3 Final Live-Writer Authority Audit

Date: 20 September 2026

Status: **READ-ONLY AUTHORITY FREEZE — SLICE 3 REOPENED**

Issue authority: #962

Exact repository authority audited:

`main@9c9e4f4c8fa874911bed0b7e1228d10aa5c6243b`

Production project:

`pgzizndxdyhqmtyywjmt`

## 1. Why this audit exists

The obsolete-runtime retirement work and MIZIZI Stage A/B/C executor
convergence are accepted.

The whole Slice 3 closure was nevertheless premature.

A fresh exact-main + Production audit proved that WAKILISHA has moved several
important flows onto the new secure authority, but not every live canonical
Registry writer has converged. The machine privileged-writer manifest also
proved incomplete: it classified 15 writers, including only two database
functions, while Production contains additional authenticated
`SECURITY DEFINER` functions capable of direct canonical music Registry
mutation.

This audit replaces the premature whole-Slice closure assumption. It does not
undo accepted runtime retirements or MIZIZI executor convergence.

## 2. What is genuinely on the new secure pathways

### 2.1 MIZIZI runner

`scripts/registry/agents/mizizi/run.ts` requires explicit apply confirmation
and executes canonical stewardship changes through:

- deterministic policy/exact grant issuance;
- `mizizi_private.issue_stewardship_execution_grant_v1(...)`;
- `mizizi_private.execute_stewardship_operation_v1(...)`;
- `mizizi_private.verify_stewardship_operation_v1(...)`.

Production state:

- MIZIZI system actor: active;
- `mizizi -> mizizi_executor`: active;
- `mizizi -> postgres`: disabled;
- active standing grants: 0;
- active exact grants: 0;
- unconsumed exact grants: 0;
- MIZIZI pg_cron jobs: 0.

The Track and Release GitHub control planes are explicit workflow/control-plane
entrypoints rather than an autonomous database schedule.

**Disposition**: secure accepted path.

### 2.2 MIZIZI Artist-origin broker

`scripts/registry/agents/mizizi/artist-origin-broker.ts` binds one Artist,
immutable evidence, an idempotency key, an exact execution grant, typed
execution, and an independent verifier.

No service-role key or direct canonical Artist DML is present.

**Disposition**: secure accepted path.

### 2.3 Artist Registry Intake

`artist-registry-intake` authenticates the real bearer caller and requires
`manage_registry`.

Its service-role client is limited to staging/reads. Canonical Artist changes
flow through caller-JWT reviewed Registry RPCs and accepted typed admission
authority.

Production v33 entrypoint is byte-identical to current main.

**Disposition**: secure accepted path.

### 2.4 Artist enrichment and Artist origin

`registry-enrich-artist` uses reviewed evidence, typed admission, and
independent verification.

`backfill-artist-origin` uses the caller JWT, typed Artist-origin admission,
and independent verification with no service-role fallback.

Production v32/v30 entrypoints are byte-identical to current main.

**Disposition**: secure accepted paths.

### 2.5 Discography

`ingest-artist-discography/index.ts` is only the dispatcher into the governed
handler/broker/plan implementation.

Production has real post-convergence causality records for
`registry_discography_admin` showing:

- exact grants consumed;
- mutation operations succeeded;
- verifier status `passed`;
- canonical write events linked to the operations.

The accepted typed family includes:

- `registry.artist.create`;
- `registry.track.create`;
- `registry.release.create`;
- `registry.release.provider_profile.admit`;
- `registry.track.provider_profile.admit`;
- `registry.artist.discography_summary.admit`;
- `registry.release_artist_set.replace`;
- `registry.release_track_set.replace`;
- `registry.track_artist_credit_set.replace`.

All are exact-targeted, short-lived, row-bounded, human-approved where required,
and verifier-backed.

**Disposition**: secure accepted path.

### 2.6 Chart Registry materialization

`chart-ingest-api` runs with caller JWT authority and capability checks and
uses the typed Chart Registry materialization/origin RPC family.

Current source has no `SUPABASE_SERVICE_ROLE_KEY`.

Production v92 entrypoint is byte-identical to current main.

**Disposition**: secure accepted path.

### 2.7 Browser direct canonical DML

Fresh source search found zero browser `INSERT`, `UPDATE`, or `DELETE`
calls against:

- `registry_artists`;
- `registry_tracks`;
- `registry_releases`;
- `registry_track_artists`;
- `registry_release_artists`;
- `registry_release_tracks`.

Product mutation is server/RPC mediated.

**Disposition**: secure accepted invariant.

## 3. Edge Functions that still bypass typed canonical authority

A credential + table + mutation sweep found three live Edge runtimes that still
perform direct service-role canonical mutation.

Other service-role Edge Functions that mention Registry tables were rechecked
and are read-only against those canonical tables.

### 3.1 `admin-router` Registry section

Production:

- ACTIVE v51;
- `verify_jwt=true`;
- live entrypoint byte-identical to current main.

Current product callers use the shared Admin Registry client and editor drawer
for Artist, Track, Release, Label, and Genre editing.

The route authenticates the bearer user and requires `manage_registry`, then
performs direct service-role PATCH/DELETE against the mapped Registry table.

Newer narrow Gate A commands already displaced part of this authority:

- Track archive uses `admin_archive_registry_music_entity_v1(...)`;
- Release archive uses the same narrow archive command;
- Release detail page uses `admin_patch_registry_release_detail_v1(...)`.

The broad router remains active for list/drawer editing and Artist/Track flows.

**Disposition**: `CONVERGE`.

Target: narrow caller-bound per-domain commands and/or accepted typed operations,
then remove service-role canonical DML from the Registry router.

### 3.2 `provider-intake-api`

Production:

- ACTIVE v48;
- `verify_jwt=true`;
- live entrypoint byte-identical to current main.

Current Track Intake / Artist music-submission workflows depend on it.

Privileged routes require `manage_registry`, but Release-shell creation and
refresh still directly INSERT/UPDATE `registry_releases` under service role.

Accepted secure authority already contains typed `registry.release.create`
and Release provider-profile admission.

**Disposition**: `CONVERGE`.

Target: provider evidence/staging followed by typed Release admission and
verification.

### 3.3 `run-chart-playback-enrichment`

Production:

- ACTIVE v21;
- `verify_jwt=true`;
- live entrypoint byte-identical to current main.

Current Admin Charts edition-detail calls it.

It authenticates an administrator/`manage_charts` caller and stores provider
link evidence, but then directly updates `registry_tracks.metadata` under
service role.

Accepted secure authority already contains
`registry.track.provider_profile.admit` for bounded Apple Music provider
facts.

**Disposition**: `CONVERGE`.

Target: provider observation/evidence followed by typed Track provider-profile
admission and independent verification.

## 4. Production database-function writer inventory

A fresh Production scan inspected authenticated/anon-executable public
`SECURITY DEFINER` functions for direct static DML against core music
Registry tables and typed relationship tables.

Result:

- anon-executable direct core mutators: 0;
- authenticated-executable direct core mutators: 19.

A separate dynamic-SQL sweep found no additional browser-callable canonical
mutation escape hatch. Dynamic execution around the accepted Registry
materialization family resolves to private exact-grant executors that are not
executable by anon/authenticated roles.

### 4.1 Accepted narrow human/domain commands

These are direct database commands, but their current authority is intentional
and sufficiently narrow for the existing Slice 3 boundary.

#### `admin_archive_registry_music_entity_v1(...)`

Installed by Slice 2 Gate A-final.

Properties:

- caller identity required;
- `manage_registry` authorization;
- exact entity type + ID;
- expected `updated_at` compare-and-set;
- archive-only state transition;
- Registry audit log;
- canonical write event.

Current Track and Release archive clients use it.

**Disposition**: `KEEP — BOUNDED HUMAN COMMAND`.

#### `admin_patch_registry_release_detail_v1(...)`

Installed by Slice 2 Gate A-final.

Properties:

- caller identity required;
- `manage_registry`;
- one Release;
- explicit Release-detail field family;
- expected `updated_at` compare-and-set;
- Registry audit log;
- canonical write event.

Current Release detail uses it.

**Disposition**: `KEEP — BOUNDED HUMAN COMMAND`.

### 4.2 Accepted typed relationship authority

The following functions mutate
`registry_entity_relationships` /
`registry_relationship_evidence`, the accepted typed Registry relationship
authority established by Slice 2 Gate C:

- `complete_registry_relationship_review(...)`;
- `create_registry_entity_relationship(...)`;
- `merge_registry_relationship_duplicate(...)`;
- `normalize_registry_relationship_vocabulary(...)`;
- `resolve_registry_relationship_endpoint(...)`;
- `review_registry_relationship(...)`.

They are not anonymous. They enforce reviewer/admin/capability authority and
their domain-specific evidence/review/state contracts.

`complete_registry_relationship_review(...)` is the current product-facing
review command. Lower-level relationship functions are internal/operational
typed relationship commands; some are composed by the higher-level commands.

The old core-music cultural graph remains immutable through the three accepted
fail-closed triggers.

**Disposition**: `KEEP — TYPED RELATIONSHIP AUTHORITY`.

The related helper
`resolve_registry_relationship_endpoint_from_alias(...)` composes the accepted
endpoint-resolution command and is not a separate canonical DML implementation.

## 5. Database functions that remain convergence debt

### 5.1 Missing Artist Intake

`accept_registry_missing_artist_intake(...)`

Current caller:

`src/services/registryKnowledgeReviewService.ts`

It directly creates a Registry Artist/alias and resolves relationship endpoints.
It has authentication/capability/review checks, but does not use the accepted
Artist-create exact-grant operation or Registry operation journal.

**Disposition**: `CONVERGE`.

Reuse:

- `registry.artist.create`;
- accepted typed relationship endpoint authority.

### 5.2 Chart Artist resolution

`admin_apply_chart_artist_resolution_decision(...)`

Current caller:

`src/pages/admin/charts/artist-resolution/page.tsx`

It directly changes `registry_track_artists` after admin/capability checks,
without exact operation journal/verifier authority.

**Disposition**: `CONVERGE`.

Reuse:

- Track↔Artist credit admission / exact-set authority.

### 5.3 Track duplicate repair

`admin_apply_registry_track_duplicate_repair(...)`

Current caller:

`src/pages/admin/relationships/duplicates/page.tsx`

It performs a high-blast multi-table Track repair across canonical Tracks,
credits, Release memberships, provider links, and resolution evidence.

It is capability-gated but is not exact-grant/journal/verifier governed.

**Disposition**: `CONVERGE — DEDICATED HIGH-RISK REPAIR OPERATION`.

Do not express this as a generic Registry patch.

### 5.4 Artist creation for decouple

`admin_create_registry_artist_for_decouple(...)`

Current callers:

- Admin Charts Artist resolution;
- Admin Registry Artist-alias decouple.

It creates a canonical Artist directly under capability-gated
`SECURITY DEFINER`.

**Disposition**: `CONVERGE`.

Reuse:

- `registry.artist.create`.

### 5.5 Track Intake canonical creation

`admin_create_registry_track_from_intake_enriched(...)`

Current caller:

`src/pages/admin/registry/tracks/intake/page.tsx`

It directly creates canonical Track and Track↔Artist rows and writes canonical
evidence, but bypasses the already-installed Track-create and credit operation
journal.

**Disposition**: `CONVERGE`.

Reuse:

- `registry.track.create`;
- Track↔Artist credit admission/set authority;
- existing Track Intake evidence/review state.

### 5.6 Artist decouple

`admin_decouple_registry_artist(...)`

No current direct `src/` caller was found.

Its current database caller is
`admin_apply_artist_decouple_decision(uuid)`, which is called by the Admin
Artist-alias decouple product.

The lower-level mutator remains authenticated-executable itself.

**Disposition**: `INTERNALIZE + CONVERGE`.

Target:

- keep the reviewed decouple product command;
- move canonical decouple mutation behind one dedicated exact operation;
- remove direct authenticated execution of the lower-level mutator when
  dependency proof permits.

### 5.7 Old manual Artist merge

`admin_merge_registry_artists(...)`

No current `src/` caller, script caller, or database-function caller was found
in the fresh audit.

A newer product path uses
`admin_safe_merge_registry_artists(...)`.

Function-call statistics are not useful enough to declare retirement from this
audit alone.

**Disposition**: `CANDIDATE RETIRE`.

Required before deletion:

- bounded Production API traffic proof;
- dependency proof;
- rollback source;
- permanent negative contract.

### 5.8 Chart Artist alias resolution

`admin_resolve_chart_artist_alias(...)`

Current caller:

`src/pages/admin/registry/artist-aliases/page.tsx`

It can mutate Artist aliases and Track↔Artist relationships under a
capability-gated SECURITY DEFINER boundary without operation journaling.

**Disposition**: `CONVERGE`.

Target:

- typed alias-resolution/credit operation composition;
- preserve alias-resolution domain semantics.

### 5.9 Track Intake enrichment resolution

`admin_resolve_registry_track_intake_enriched(...)`

Current direct caller:

`src/pages/admin/registry/tracks/intake/page.tsx`

It is also composed by
`admin_create_registry_track_from_intake_enriched(...)`.

It can update canonical Track/Release provider-enrichment state under reviewed
Track Intake authority but outside the exact provider-profile operation journal.

**Disposition**: `CONVERGE`.

Reuse:

- Track/Release provider-profile admission where field semantics match;
- keep Track Intake review/evidence semantics.

### 5.10 Safe Artist merge

`admin_safe_merge_registry_artists(...)`

Current caller:

`src/pages/admin/registry/artist-aliases/page.tsx`

It performs a multi-table canonical Artist merge under capability-gated
SECURITY DEFINER authority without exact-grant/journal/verifier semantics.

**Disposition**: `CONVERGE — DEDICATED HIGH-RISK MERGE OPERATION`.

Do not represent Artist merge as a generic Artist patch.

### 5.11 Artist Claim decision

`community_admin_decide_artist_claim(...)`

Current caller:

`src/services/artists/claimedArtist.ts`

The claim-review and representation semantics are legitimate and must remain.

When a proposed Artist claim is verified, however, the function can directly
create the canonical Artist/aliases rather than composing the accepted
Artist-create admission journal.

**Disposition**: `KEEP DOMAIN SEMANTICS / CONVERGE CANONICAL CREATION`.

Reuse:

- existing claim review/representation state machine;
- `registry.artist.create` for new canonical identity.

The related
`community_admin_resolve_artist_claim_existing(...)` composes the claim
decision for an existing Artist and does not create a second independent
canonical creation road.

## 6. Machine privileged-writer manifest gap

Current manifest:

`scripts/control-plane/registry-privileged-writer-manifest.json`

Current size:

- total entries: 15;
- Production runners: 2;
- Edge Functions: 11;
- database functions: 2.

The manifest therefore does not enumerate the complete live database mutation
surface.

Its verifier validates declared entries and selected required writers, but does
not discover all authenticated canonical database mutators and fail when an
unclassified writer exists.

The manifest rule:

`newWriterRequiresClassification: true`

is therefore not yet a complete mechanical invariant.

**Required correction before Slice 3 may close**:

1. represent every retained canonical writer family or exact public entrypoint
   in machine-readable authority;
2. classify accepted narrow commands separately from convergence debt;
3. add a permanent verifier that mechanically detects new/unclassified
   authenticated canonical mutation authority;
4. include transitive public entrypoints that delegate to lower-level canonical
   mutators so hiding DML one function deeper does not evade classification.

## 7. Final Edge writer inventory

Fresh source and Production parity audit confirms:

### Secure/accepted

- `artist-registry-intake`;
- `ingest-artist-discography`;
- `registry-enrich-artist`;
- `backfill-artist-origin`;
- `chart-ingest-api`;
- MIZIZI runner;
- MIZIZI Artist-origin broker;
- `public-content-read` as pure read.

### Pending convergence

- `admin-router` Registry;
- `provider-intake-api`;
- `run-chart-playback-enrichment`.

No additional service-role Edge Function was found performing direct DML on the
audited canonical Artist/Track/Release/credit/membership/typed-relationship
tables.

Read-only service-role Registry consumers were not misclassified as writers.

## 8. Corrected Slice 3 remaining work

Do not create a new child-phase tree.

Complete one serious final Slice 3 convergence block in this order.

### Boundary 1 — complete authority inventory and permanent detection

- expand/fix the machine privileged-writer authority;
- classify all current direct and transitive canonical writer entrypoints;
- add a permanent unclassified-writer failure gate;
- preserve accepted narrow human and typed relationship commands.

No Production mutation should be required for this inventory/control-plane
boundary.

### Boundary 2 — converge existing-primitive callers

Move roads that can already reuse accepted primitives without inventing a new
authority family:

- Missing Artist Intake -> typed Artist create + typed relationship resolution;
- Track Intake create -> typed Track create + Track↔Artist authority;
- Track Intake provider updates -> typed provider-profile admission;
- proposed Artist Claim creation -> typed Artist create;
- `provider-intake-api` Release creation/refresh -> typed Release
  create/provider-profile authority;
- Chart playback provider metadata -> typed Track provider-profile authority;
- Chart Artist resolution where semantics match existing Track↔Artist
  admission/set authority.

Preserve each product/domain review workflow. Replace only its canonical
mutation road.

### Boundary 3 — high-blast identity repair and generic Admin Registry mutation

Design narrowly typed operations for:

- Track duplicate repair;
- Artist decouple;
- Artist safe merge;
- Artist alias resolution where it changes canonical credits;
- remaining Artist/Track/Label/Genre Admin Registry edit/delete authority.

Reuse existing narrow Release detail/archive and Track archive commands rather
than rebuilding them.

Retire/internalize stale lower-level roads only after dependency/traffic proof,
including the old `admin_merge_registry_artists(...)` candidate.

## 9. Slice 4 status

Slice 4 issue #991 exists but is blocked.

Do not advance MIZIZI Stewardship Runtime Foundation as the active programme
until #962 re-closes.

This audit does not authorize new autonomous MIZIZI capability.

## 10. Separate security programme

Issue #992 owns the broader Supabase advisor audit.

Do not mix private-schema RLS, generic SECURITY DEFINER lint cleanup, extension
placement, or search-path hardening into this Slice 3 convergence unless an
exact finding is proven to be part of a Registry writer road being changed.

## 11. Current deployment classification

This audit authorizes classification/design only.

- SQL migration now: **No**;
- Edge deploy now: **No**;
- frontend deploy now: **No**;
- Production mutation now: **No**;
- Slice 4 implementation: **BLOCKED**.

Next engineering action:

**make the canonical-writer inventory mechanically complete, then converge the
existing-primitive callers before designing the high-blast repair/merge
operations.**


## 11. Track Intake convergence amendment — 21 September 2026

Sections 5.5 and 5.9 above preserve the original live-writer audit state. Their Track Intake findings are now converged.

The Admin Track Intake caller no longer invokes either legacy enriched writer. Canonical mutation is split across typed, independently verified Track identity, reviewed-credit reconciliation, Track profile, Release profile, provider-link, and activation operations. Workflow finalization contains no canonical Registry DML.

The following roads are retired and covered by a permanent negative verifier:

- `admin_create_registry_track_from_intake_enriched(uuid,text,text)`
- `admin_resolve_registry_track_intake_enriched(uuid,uuid,text,boolean)`
- `admin_resolve_registry_track_intake(uuid,uuid,text)`
- `sync_registry_track_intake_artist_credits(uuid,uuid)`

The machine privileged-writer manifest removes the two classified legacy direct writers and classifies the five governed Track Intake canonical command surfaces instead.

This amendment does not change the disposition of any non-Track-Intake finding in the original audit.
