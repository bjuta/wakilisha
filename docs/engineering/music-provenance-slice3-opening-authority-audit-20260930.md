# Music Provenance Slice 3 — Opening Authority Audit and Design Freeze

**Date:** 30 September 2026  
**Issue:** #1121  
**Binding scope:** `docs/engineering/music-provenance-mizizi-binding-execution-scope-20260929.md`  
**Exact protected main at freeze:** `e44f2aad9830df797d69e11eda8a36faaa875e85`

## 1. Purpose

Freeze the current Production and repository authority before implementing Music Provenance Slice 3 — MIZIZI Earned Autonomy and Cross-Stack Convergence.

This is a read-only audit/design checkpoint.

It authorizes no new Production mutation authority, autonomous claim policy, corpus backfill, or creator rollout.

## 2. Current Production baseline

Production Supabase:

- project: `pgzizndxdyhqmtyywjmt`
- migration count: **193**
- migration head: `20260930091613_music_provenance_slice2_attestation_history_trigger_privilege_fix`
- `public-content-read`: **v93 ACTIVE**
- `seo-sitemap-admin`: **v54 ACTIVE**

Slice 2 technical implementation and Production promotion are closed under #1116.

The real-creator rollout gate remains open under #1118.

### Music corpus at opening

- Registry Artists: **1,227**
- Registry Tracks: **2,453**
- Registry Works: **0**
- canonical Recording Contributions: **0**
- canonical Work Contributions: **0**
- People: **33**
- People backed by an active WAKILISHA user: **16**
- active Person↔Artist links: **0**
- active-user People with a defensible normalized Registry Artist match: **0**

The absence of Person↔Artist links is authoritative. Usernames or display names must not be promoted into creator identity without governed resolution.

## 3. Zero-authority-at-rest opening state

Read-only Production proof at opening:

- active MIZIZI capability grants: **0**
- unexpired MIZIZI execution grants: **0**
- all active/unconsumed Registry execution grants: **0**

Slice 3 begins from zero ambient mutation authority.

This state is an invariant to preserve after every Preview and Production acceptance cycle.

## 4. Existing MIZIZI execution substrate — reuse #991

Music Provenance Slice 3 must reuse the accepted MIZIZI deterministic runtime/control-plane programme tracked in #991.

Do not build:

- a second MIZIZI agent;
- a second exact-grant system;
- a second mutation journal;
- a second verifier family where existing Registry verification can be extended;
- a parallel Admin review store.

The existing substrate already owns:

- no ambient Production mutation credential;
- system-actor capabilities;
- exact Registry execution grants;
- exact grant targets and current-state fingerprints;
- operation types and row/target ceilings;
- typed execution brokers;
- operation journal/write-event authority;
- independent verifier patterns;
- zero-authority-at-rest closure;
- bounded stewardship execution.

Music provenance extends this substrate to Work, Recording Contribution, Work Contribution, Person identity candidates, provenance lineage, and downstream projections.

## 5. Evidence and lineage authority

`platform_private.registry_evidence_assertions` already carries the fields Slice 3 needs to reason about lineage:

- `parent_assertion_id`
- `originator_ref`
- `upstream_source_ref`
- `lineage_key`
- `independence_group_hint`
- `verification_method`
- `source_use_basis`
- `source_use_detail`
- `source_payload_fingerprint`
- `assertion_fingerprint`
- `trust_class`
- `source_kind`
- `source_ref`
- `observed_at`

### Decision

**Do not add a second evidence table.**

The Slice 3 lineage resolver should operate over the retained evidence authority above and produce deterministic findings/review materialization.

It must distinguish:

- independent evidence;
- copied/downstream echoes;
- probable common-provider origin;
- related human evidence camps;
- contradictions;
- unresolved/insufficient evidence.

Database row count is never an evidence-vote count.

### Current evidence corpus

The current retained evidence corpus is small:

- `registry_track_duplicate_admin / INTERNAL_FACT`: 10
- `release_primary_review / INTERNAL_FACT`: 10
- `discography_review_plan / EXTERNAL_EVIDENCE`: 7
- `apple_music_discography_snapshot / EXTERNAL_EVIDENCE`: 2
- `apple_music / EXTERNAL_EVIDENCE`: 1
- `spotify_apple_music / EXTERNAL_EVIDENCE`: 1

Total represented assertions in this audit: **31**.

### Consequence

No autonomous music-provenance claim family is selected at opening merely because the schema can represent one.

Autonomy must follow benchmark evidence, not precede it.

## 6. Contribution operation authority already exists

The four required canonical provenance operations already exist as enabled Registry operation types:

### `registry.work.create/v1`

- capability: `create_registry_work`
- risk class: medium
- max targets: 1
- max rows: 1
- grant TTL ceiling: 300 seconds
- human approval required: yes
- independent verifier required: yes

### `registry.track_work_link.admit/v1`

- capability: `admit_registry_track_work_link`
- risk class: medium
- max targets: 1
- max rows: 1
- grant TTL ceiling: 300 seconds
- human approval required: yes
- independent verifier required: yes

### `registry.track_contribution.admit/v1`

- capability: `admit_registry_track_contribution`
- risk class: medium
- max targets: 1
- max rows: 1
- grant TTL ceiling: 300 seconds
- human approval required: yes
- independent verifier required: yes

### `registry.work_contribution.admit/v1`

- capability: `admit_registry_work_contribution`
- risk class: medium
- max targets: 1
- max rows: 1
- grant TTL ceiling: 300 seconds
- human approval required: yes
- independent verifier required: yes

### Decision

Slice 3 must not invent a generic contribution mutation road.

It should add deterministic finding/benchmark/policy orchestration around these exact operations.

Any later autonomous policy still has to earn a bounded path through this existing operation authority and independent verification.

## 7. Shared Registry review authority already supports provenance subjects

`platform_private.registry_review_cases` and `platform_private.registry_review_events` are the shared immutable review authority.

The accepted subject-type constraint already includes:

- `work`
- `track_work_link`
- `track_contribution`
- `work_contribution`
- `rights_claim`
- `external_identifier_assertion`

Current review cases at opening:

- artist: 2
- release: 4
- track: 48
- contribution/work cases: 0

The review event model is append-only and can bind a human-approved decision causally to one exact execution grant.

### Existing MIZIZI finding pattern

Current MIZIZI review materialization already uses:

1. deterministic `mizizi_private.finding_fingerprint_v1(...)`;
2. typed private queue/broker logic;
3. shared Registry review authority;
4. no direct `mizizi_executor` table DML;
5. exact operation/grant authority for mutation.

The closest predecessor is the public-music-identity review authority.

### Decision

Extend that pattern for provenance finding families.

Do not add a separate MIZIZI findings table unless a later audit proves shared review authority cannot represent a required invariant.

## 8. Public projection authority

Slice 2 already exposes structured public Track provenance through the existing API family.

`public-content-read` Track output includes:

- `recordingContributions`
- `works`
- `provenanceReceipt`

The underlying public authority is `public.get_public_track_provenance_v1(uuid)`.

Pending/review-only creator evidence remains excluded from public projection.

### Decision

Slice 3 extends the existing `public-content-read` and OpenAPI contract.

No second provenance API family.

Canonical public projections must continue to derive from canonical contribution authority, not contributor display strings.

## 9. API cache / downstream invalidation distinction

`public-content-read` currently sends:

`Cache-Control: no-cache, no-store, must-revalidate`

Therefore the public content API itself does not currently require a CDN cache-purge mechanism after contribution writes.

The actual downstream convergence problem is derived/static material:

- SEO metadata;
- prerendered HTML;
- sitemap output;
- future search documents;
- any other materialized projection introduced later.

### Decision

Slice 3 should define a deterministic **projection refresh / invalidation contract**, not invent a generic cache service.

A canonical contribution write must provide enough output/receipt authority to identify affected downstream subjects:

- Track;
- Person;
- Artist persona;
- Group where applicable;
- Work;
- public API projection;
- SEO/prerender/sitemap;
- future search document.

Do not use unrelated Track `updated_at` mutation as an invalidation side channel.

## 10. Analytics authority and gap

Existing browser product analytics use `src/services/analytics.ts -> trackEvent(...)`.

The existing GA4 implementation/build audits protect:

- deferred GA loading;
- page-view ownership;
- production measurement-ID compilation;
- bundle separation;
- local/internal traffic boundaries.

They do not yet protect music-provenance event vocabulary or private-field exclusion.

The Slice 3 binding scope calls for bounded events including:

- `credits_section_viewed`
- `credits_expanded`
- `contributor_opened`
- `provenance_opened`
- `credit_claim_started`
- `credit_confirmation_completed`
- `credit_disputed`

These events are not implemented at this freeze.

### Decision

Extend the existing analytics path and existing audits.

Add a durable provenance-event contract that rejects private/internal fields such as:

- evidence IDs;
- review IDs;
- grant IDs;
- raw confidence;
- private permission values;
- financial information.

Do not create a new telemetry stack.

## 11. SEO / Schema.org / route-binding gaps

### Current ontology gap

Current Artist SEO projection assumes `MusicGroup` in places where Artist type is not considered.

Slice 3 must distinguish tested public identities so that:

- solo Artist personas may project as `Person`;
- groups/bands may project as `MusicGroup`.

Do not force unsupported WAKILISHA/DDEX semantics into Schema.org.

### Current ordered-Artist selection debt

Current `seo-sitemap-admin` still contains relationship selectors using:

`Number(row.credit_order || 999)`

and selection conditions that can replace an existing row merely because another row is primary or has order 1.

This incorrectly treats `credit_order = 0` as missing and can violate deterministic ordered Artist authority.

### Decision

Slice 3 must consolidate relationship selection around the accepted ordered MainArtist/primary authority:

- preserve order 0;
- primary/MainArtist precedence must be explicit;
- lower authoritative sequence wins;
- stable tie-break only where role/order are equal;
- canonical URL remains route-binding authoritative;
- alternate co-main routes never become canonical by iteration order.

## 12. PR #776 supersession

PR #776 has been closed unmerged as superseded.

Its old build architecture is not current authority:

- checked-in dynamic `public/sitemap.xml` no longer exists;
- its `refresh-public-sitemap.mjs` design is not the current Production build;
- current prerender/sitemap behavior is governed by the accepted exact-main build and current SEO Edge authority;
- current route tests already defend clean Track routes and redirect retirement.

One still-valid invariant was retained:

> deterministic Artist relationship selection must preserve `credit_order = 0` and must not let later rows overwrite the authoritative Main/primary Artist.

That invariant belongs to this Slice 3 programme, not to a revived #776 branch.

## 13. Registry terminology debt

The binding terminology is:

- Track Artist billing → `registry_track_artists`
- Release Artist billing → `registry_release_artists`
- Recording Contributions → `registry_track_contributions`
- Work Contributions → `registry_work_contributions`

Current/historical MIZIZI material still contains ambiguous “Track credits” language, including current Admin review copy.

### Decision

Fix current knowledge-contract and active product terminology where ambiguity affects present behavior.

Do not rewrite historical closure documents merely to modernize wording.

## 14. Real-creator cohort relationship

#1118 remains a separate **broad-rollout** gate.

The opening Production audit found no active Person↔Artist links and no defensible normalized match between active-user People and Registry Artists.

Therefore Slice 3 must not:

- treat arbitrary current users as creators;
- infer Artist persona identity from username/display name;
- manufacture Person records from raw contributor strings.

The real cohort begins only with deliberate known-creator identity establishment/review and real Tracks.

Engineering may continue through Slice 3 while #1118 remains open.

## 15. Slice 3 implementation order

This is one Slice 3 rollback boundary under #1121. The sequence below is internal execution order, not a new issue tree.

### A. Lineage resolver + read-only provenance findings

Build deterministic lineage reasoning over existing evidence fields.

First output is read-only finding materialization through the shared review pattern.

No autonomous canonical mutation.

### B. Admin exception convergence

Extend the existing MIZIZI/Admin review workspace and typed review RPCs for material provenance exceptions.

Do not send routine deterministic confirmations to Admin.

### C. Benchmark harness

Create a reproducible benchmark for candidate claim families.

Measure independence, contradiction handling, false merges, abstention, and precision.

Do not select autonomy policy until evidence demonstrates one safe family.

### D. One bounded autonomy family at most

If and only if the benchmark supports it, permit one claim family through the existing deterministic policy/exact-grant/executor/verifier substrate.

Zero standing authority remains mandatory.

### E. Cross-stack public convergence

Complete:

- structured public API/OpenAPI;
- Person vs MusicGroup JSON-LD;
- route-binding-aware SEO/prerender/sitemap;
- deterministic Artist ordering;
- privacy-safe provenance analytics;
- deterministic downstream projection refresh/invalidation;
- active terminology convergence.

### F. Preview / Production acceptance

Use the normal WAKILISHA deployment doctrine:

- CLI-generated migration filename before target SQL;
- focused tests;
- CI consolidation;
- disposable Preview;
- replay + permanent verifier;
- runtime/browser acceptance;
- protected CI;
- merge;
- separate Production SQL/Edge/frontend promotion as applicable;
- zero-authority-at-rest verifier;
- Preview cleanup.

## 16. Opening implementation classification

At this audit/design freeze:

- SQL migration needed: **No**
- Supabase Edge Function deploy needed: **No**
- frontend deploy needed: **No**
- Production mutation needed: **No**
- PR needed: **Docs-only freeze PR**
- next technical action after freeze merge: **create exact-main Slice 3 implementation branch and generate the first migration filename only if the frozen lineage/finding design requires SQL**

## 17. Non-negotiable invariants carried forward

- assertions are evidence until governed canonical admission;
- copied source echoes do not become independent corroboration;
- related human evidence can be grouped without erasing dissent;
- raw contributor strings do not manufacture Persons;
- Artist billing is not Recording participation;
- Group membership is not Recording participation;
- contribution is not rights/royalty/split ownership;
- ambiguous Person merge cannot auto-promote;
- public pending/disputed evidence remains excluded unless product policy explicitly authorizes a public historical/dispute state from canonical authority;
- browser/service roles do not gain generic canonical contribution DML;
- no ambient MIZIZI mutation credential;
- no standing/unconsumed exact grant at rest;
- one existing MIZIZI runtime/control plane;
- Admin handles exceptions, not routine deterministic work;
- Critical CI remains consolidated rather than becoming a chronological archive.
