# MIZIZI Slice 2 — Artist Enrichment Authority Convergence

Date: 15 September 2026

Status: **DESIGN AUTHORITY — IMPLEMENTATION NOT YET PRODUCTION-ACTIVE**

Issue: #945

Base authority: `c5ddc62454ad7ca59f3024090e21299085b4ce45`

Production migration head at design freeze: `20260915122100`

Programme authority:

- `docs/engineering/mizizi-registry-authority-security-convergence-programme.md`
- `docs/engineering/mizizi-registry-primitive-convergence-map.md`
- `docs/engineering/mizizi-registry-authority-ledger.md`
- `docs/engineering/mizizi-slice2-chart-materialization-production-closure.md`

## 1. Objective

Converge the remaining Artist enrichment/backfill roads onto the shared Slice-2 Registry governance model without turning Artist enrichment into a generic patch primitive.

The product capability remains:

- acquire provider evidence for an existing Artist;
- admit provider-profile metadata when justified;
- admit a public Artist image when justified;
- propose and explicitly admit a public biography;
- propose and explicitly admit Artist type;
- preserve the already-governed Artist-origin road unchanged.

The authority model changes from authenticated-user → ambient service-role DML to:

`caller JWT + manage_registry`

→ bounded provider/evidence acquisition

→ immutable exact evidence/proposal

→ typed one-Artist operation

→ exact short-lived execution grant

→ canonical mutation

→ independent verification.

The governing rule remains:

> **Do not primitive the culture. Primitive the governance.**

## 2. Exact entry authority

At design freeze:

- merged `main` is `c5ddc62454ad7ca59f3024090e21299085b4ce45`;
- Production migration authority is `132 / 20260915122100`;
- #939 chart materialization convergence is Production accepted and closed;
- `registry.artist_origin.admit/v1` is already Production-governed;
- `backfill-artist-origin` is caller-JWT + `manage_registry`, has no ambient service-role Registry client, and executes/verifies the governed origin operation;
- MIZIZI remains non-autonomous with no new standing Artist-enrichment grants.

No Production mutation is authorized by this design document.

## 3. Read-only audit findings

### 3.1 `registry-enrich-artist`

Production:

- ACTIVE v31;
- `verify_jwt = true`;
- bundle SHA-256 `507ff777c59bd533b49374631f8a931d69f47ad3940f8fbf877ea01fcea4cb9f`.

Authority:

- validates only that a bearer user exists;
- does not require `manage_registry`;
- creates a service-role database client;
- directly updates `registry_artists`.

Current writes include:

- `public_image_url`;
- `image_source_provider`;
- `bio`;
- `metadata.spotify_id`;
- `metadata.apple_music_id`;
- `metadata.spotify_followers`;
- `metadata.spotify_popularity`;
- `metadata.enriched_genres`;
- `updated_at`.

It supports batch mode and `force=true`.

### 3.2 `backfill-artist-spotify-images`

Production:

- ACTIVE v31;
- `verify_jwt = true`;
- bundle SHA-256 `5bce6b2ef7b8b31b7fcc26bdaa0df959da02b66eeac04222e3b2d27a7b4208bf`.

Authority:

- bearer-user authentication only;
- no `manage_registry` check;
- service-role database client;
- direct Artist DML;
- batch ceiling 100.

It writes public image/source plus Spotify follower/popularity metadata.

### 3.3 `backfill-artist-type`

Production:

- ACTIVE v29;
- `verify_jwt = true`;
- bundle SHA-256 `a40feef5e393d2f854fe30691deacbadc87b018cfc1ad46f958ccaba2edfff37`.

Authority:

- bearer-user authentication only;
- no `manage_registry` check;
- service-role database client;
- direct `artist_type` overwrite;
- batch ceiling 300;
- `force=true` supported;
- name heuristics plus optional MusicBrainz evidence.

### 3.4 `backfill-artist-origin`

This road is already converged and is a reference implementation rather than a target for redesign.

Production:

- ACTIVE v30;
- `verify_jwt = true`;
- caller JWT;
- `manage_registry` required;
- no service-role Registry client;
- typed execution + independent verifier.

The candidate must prove this authority remains unchanged.

## 4. Product caller findings

The Admin Artist list page calls the unresolved enrichment functions as live bulk workflows.

The Artist detail page calls:

- `registry-enrich-artist` for one-Artist provider enrichment;
- `registry-enrich-artist` before origin enrichment so provider identity evidence is available;
- `backfill-artist-type` for type enrichment;
- `backfill-artist-origin` for governed origin admission.

The detail-page Artist-type action is currently not exact-target-bound: it sends `batch_size: 1` but no Artist id/slug, while the function selects the first eligible Artist. This can mutate an Artist other than the one displayed in the UI.

Exact target binding is therefore both a control-plane and product-correctness requirement.

The Artist detail page also retains direct browser `.update()` calls for manual save/archive. Production grants deny this as an ordinary authenticated user. A governed replacement already exists through `saveRegistryEntityPatch(...)` → `admin-router/registry`, which requires `manage_registry` and is already used by the list/editor drawer.

The detail page must converge onto that existing Admin boundary. Browser table grants must not broaden.

## 5. Live blast radius

At design freeze, active/draft Artists total 1,210.

- missing valid public image: 545;
- missing bio: 1,031;
- null/`unknown` Artist type: 112;
- Spotify id present: 415;
- Apple Music id present: 307;
- Spotify follower metadata present: 406;
- Spotify popularity metadata present: 406;
- enriched-genre metadata present: 310.

Artist-type distribution among active/draft Artists:

- solo: 1,011;
- group: 77;
- unknown: 71;
- null: 41;
- band: 7;
- collective: 3.

This is a live recurring capability, not disposable migration residue.

## 6. Compatibility-key decision

Current readers use the existing Artist metadata compatibility keys, including:

- `spotify_id`;
- `apple_music_id`;
- `spotify_followers`;
- `spotify_popularity`;
- `enriched_genres`.

Public content and Institute inquiry surfaces consume portions of this shape.

This candidate therefore preserves those read keys. Governance convergence is not coupled to a metadata-renaming migration.

Future schema normalization may project these observations elsewhere, but current consumers must remain compatible during this step.

## 7. Capability-family model

Artist enrichment is one product/governance family but **not** one mutation operation.

The family introduces four typed Registry operations.

### 7.1 Provider profile admission

Operation:

`registry.artist.provider_profile.admit`

Version:

`1`

Operation capability:

`admit_registry_artist_provider_profile`

Risk:

`medium`

Target:

one existing Artist UUID.

May write only the exact compatibility/provider fields bound in the plan:

- provider Artist identifier for a supported provider;
- Spotify followers when the evidence is Spotify;
- Spotify popularity when the evidence is Spotify;
- `enriched_genres` only as the exact normalized provider-observation merge defined by the plan;
- standard `updated_at`.

It may not write:

- public image;
- biography;
- Artist type;
- origin;
- lifecycle status;
- identity name/slug;
- relationships;
- arbitrary metadata keys.

### 7.2 Public image admission

Operation:

`registry.artist.public_image.admit`

Version:

`1`

Operation capability:

`admit_registry_artist_public_image`

Risk:

`medium`

May write only:

- `public_image_url`;
- `image_source_provider`;
- standard `updated_at`.

The plan binds the exact URL, source provider, evidence assertion and expected current image state.

### 7.3 Biography admission

Operation:

`registry.artist.bio.admit`

Version:

`1`

Operation capability:

`admit_registry_artist_bio`

Risk:

`medium`

May write only:

- `bio`;
- standard `updated_at`.

Provider editorial biography text is proposal evidence, not automatic canonical authority.

V1 requires an explicit human `manage_registry` decision and exact plan. Provider fetch success alone cannot write canonical biography text.

### 7.4 Artist-type admission

Operation:

`registry.artist.type.admit`

Version:

`1`

Operation capability:

`admit_registry_artist_type`

Risk:

`high`

May write only:

- `artist_type`;
- standard `updated_at`.

V1 is explicit-human-approval only.

Name heuristics and MusicBrainz are evidence/proposal inputs. They cannot autonomously overwrite Artist type, and there is no `force=true` bypass.

### 7.5 Artist origin remains separate

`registry.artist_origin.admit/v1` remains unchanged.

Origin is not folded into the new enrichment operations and no generic enrichment operation may write origin fields.

## 8. Common operation budgets

All four V1 operations require:

- `requires_existing_target = true`;
- exact targets = 1;
- maximum affected rows = 1;
- exact-grant TTL ceiling = 300 seconds;
- explicit human approval = true;
- independent verifier = true.

No operation capability is granted as a standing product-role capability merely because its definition exists.

The public broker requires the caller's existing `manage_registry` authority and issues/consumes exact operation authority through the shared Registry grant model.

## 9. Evidence model

Provider evidence must be captured before canonical mutation.

The Artist enrichment family may use a domain-specific immutable evidence assertion with explicit typed columns for supported observations. It must not accept an arbitrary canonical patch payload.

Evidence binds at minimum:

- evidence/assertion UUID;
- exact Artist UUID;
- source kind/provider;
- provider Artist identifier where applicable;
- provider display name observed;
- provider image candidate where applicable;
- provider biography candidate where applicable;
- provider genre labels where applicable;
- Spotify follower/popularity observations where applicable;
- MusicBrainz type/id/score where applicable;
- deterministic local name-heuristic result where applicable;
- source reference;
- source payload fingerprint;
- acquisition/observation timestamp;
- recorder principal;
- assertion fingerprint.

Evidence rows are immutable after creation.

A canonical plan references exact evidence IDs/fingerprints; a caller cannot submit arbitrary JSON and label it provider evidence.

## 10. Provider credential boundary

Introduce a narrow provider-acquisition Edge boundary dedicated to Artist evidence.

Provisional runtime name:

`registry-artist-provider-fetch`

Required properties:

- `verify_jwt = true`;
- request bearer user must resolve;
- `manage_registry` required before provider access;
- provider secrets stay server-side;
- service-role use, if required for the existing Admin secret store, is isolated to this provider/evidence boundary;
- no direct canonical Registry DML;
- no Registry operation execution;
- no arbitrary table access exposed to the caller;
- provider payloads are normalized into the exact evidence vocabulary;
- evidence identity/fingerprint returned to the caller/orchestrator rather than credentials.

This mirrors the accepted chart provider-secret separation without reusing chart-specific playlist semantics.

## 11. Governed orchestration boundary

`registry-enrich-artist` remains the product-facing enrichment orchestration name during convergence, but its authority changes.

Target runtime:

- `SUPABASE_URL`;
- `SUPABASE_ANON_KEY`;
- live caller bearer JWT;
- no `SUPABASE_SERVICE_ROLE_KEY` load for Registry mutation;
- `manage_registry` required;
- exact Artist UUID required for mutation;
- provider acquisition delegated to the narrow provider boundary;
- canonical mutation only through typed admission RPCs;
- independent verification after each exact operation.

Bulk UI requests are orchestration only. A batch of N Artists decomposes into N exact one-Artist operations. Batch size never becomes canonical mutation authority.

## 12. Expected-state and plan rules

Each operation binds:

- exact Artist UUID;
- exact operation key/version;
- expected subject-state fingerprint;
- exact field-family-specific current state;
- exact normalized proposed final state;
- evidence IDs/fingerprints;
- issuer/caller principal;
- exact row ceiling;
- idempotency identity;
- ruleset version.

Immediately before write, the executor rechecks target existence and expected state.

Stale state rejects execution. A stale request does not silently overwrite a newer human/provider decision.

## 13. Idempotency

A retry with the same immutable evidence, target, operation version and normalized plan returns/reuses the existing operation result and does not duplicate canonical write receipts.

A changed proposal cannot reuse an old idempotency identity.

Provider re-observation with changed values creates new evidence and therefore a new plan decision.

## 14. Independent verification

Verification occurs in a separate transaction and proves:

- operation identity/version;
- exact target;
- expected verifier status transition;
- affected row count exactly one;
- only the operation-owned columns changed;
- final values equal the normalized plan;
- unrelated Artist fields remain unchanged;
- exact canonical write receipts exist and are linked to the mutation operation;
- evidence/plan fingerprints match;
- no extra row was touched.

The verifier is not executable by ordinary product roles as a private bypass.

## 15. Artist-type policy

The existing default-to-solo heuristic is not authoritative cultural truth.

V1 may produce a proposal such as:

- deterministic name heuristic;
- optional MusicBrainz observation;
- agreement/disagreement detail;
- confidence/score metadata.

But the caller must explicitly approve the exact type before canonical write.

Bulk proposal generation may remain useful; bulk blind write does not.

The detail-page one-Artist action must bind the exact page Artist UUID and may never rely on `LIMIT 1` against the global eligible set.

## 16. Biography policy

Provider editorial notes can be acquired and presented as a proposal.

They do not become canonical `bio` simply because a provider match exists.

V1 requires an explicit human-reviewed admission plan.

This design makes acquisition and authority mechanically distinct and leaves any future editorial/licensing policy decision outside the provider fetch step.

## 17. Public-image policy

Provider images may be proposed automatically from supported provider observations.

Canonical `public_image_url` selection still becomes an exact admitted decision with:

- exact Artist;
- exact URL;
- exact source provider;
- expected prior image state;
- evidence fingerprint;
- verifier.

A caller cannot use the image operation to alter provider IDs, bio, type or origin.

## 18. Provider-profile compatibility policy

Because existing public/Institute readers use compatibility metadata keys, the V1 provider-profile operation may preserve those keys while making writes typed and evidence-bound.

The plan must enumerate exact allowed keys. Unknown metadata keys are rejected rather than merged through a generic object spread.

`metadata` as a whole is never caller-authoritative.

## 19. Frontend convergence

### Artist list

Bulk enrichment UX may remain, but it must:

- authenticate with the live user session;
- invoke the governed orchestration path;
- render proposal/admission outcomes per Artist;
- preserve dry-run/proposal visibility;
- never imply that one bulk request is one unbounded mutation grant.

### Artist detail

The detail surface must:

- send exact Artist UUID for enrichment/type/origin actions;
- remove the non-target-bound Artist-type behavior;
- use the existing `saveRegistryEntityPatch(...)` / `admin-router/registry` path for manual save;
- use the governed Admin Registry boundary for archive/status mutation rather than direct browser DML;
- preserve the governed `backfill-artist-origin` flow.

## 20. Legacy function convergence

`backfill-artist-spotify-images` and `backfill-artist-type` must lose direct service-role canonical mutation authority after new caller proof.

Accepted Slice-2 outcomes are:

- product callers moved to `registry-enrich-artist` governed actions; and
- old function names converted to fail-closed or deliberately narrow compatibility wrappers with no direct canonical DML.

Physical deletion/runtime retirement is Slice 3 and requires dependency/traffic proof.

`backfill-artist-origin` is not retired or folded into the generic family.

## 21. Permanent control-plane requirements

The candidate must extend permanent verification to prove:

- all four operation types exist with exact version/capability/risk/target/row/TTL/verifier policy;
- ordinary product roles do not receive standing operation capabilities;
- no standing MIZIZI grants exist for the new operation types;
- private evidence/grant/executor functions are denied to `anon`, `authenticated`, and inappropriate service-role/public execution paths as defined by the accepted governance model;
- public broker wrappers require caller identity and `manage_registry`;
- `registry-enrich-artist` contains no service-role Registry mutation road;
- `backfill-artist-spotify-images` contains no direct canonical Artist DML after convergence;
- `backfill-artist-type` contains no direct canonical Artist DML after convergence;
- `backfill-artist-origin` remains on the accepted typed origin path;
- direct browser DML remains forbidden;
- provider fetch boundary performs no canonical Registry DML;
- each operation's column ownership is disjoint and enforced;
- no generic Artist metadata patch primitive is introduced.

The privileged-writer manifest must be updated from the live before-state to the accepted after-state.

## 22. Required Preview acceptance

A paid disposable Preview must prove at minimum:

1. unauthenticated provider/enrichment call rejected;
2. authenticated caller without `manage_registry` rejected;
3. correct `manage_registry` caller can acquire provider evidence without credential leakage;
4. provider fetch cannot directly mutate Registry state;
5. provider-profile admission updates only whitelisted compatibility metadata;
6. image admission updates only image/source fields;
7. bio provider observation alone does not mutate `bio`;
8. explicit reviewed bio admission succeeds and verifies;
9. heuristic/type proposal alone does not mutate `artist_type`;
10. explicit reviewed Artist-type admission succeeds and verifies;
11. wrong Artist target rejected;
12. stale subject state rejected;
13. evidence fingerprint drift rejected;
14. plan drift rejected;
15. replay idempotent;
16. over-budget/multi-target grant rejected;
17. direct private executor attempt denied;
18. direct browser canonical Artist DML denied;
19. exact operation grants return to zero at rest after fixture cleanup;
20. MIZIZI standing grants for these operations remain zero;
21. current origin operation still passes its existing verifier and acceptance contract;
22. Artist detail type action mutates only the displayed Artist;
23. Artist detail manual save/archive works through the governed Admin Router;
24. bulk Artist list flow decomposes into independently exact per-Artist outcomes.

## 23. Production promotion order

After protected CI and merge:

1. exact merged-main Production SQL promotion through `scripts/control-plane/promote-repository-migrations.sh`;
2. prove Production migration ledger/head and zero pending migrations;
3. run permanent Production SQL verifier(s);
4. deploy provider-acquisition Edge boundary if added/changed;
5. verify JWT/capability/non-mutation boundary;
6. deploy governed `registry-enrich-artist`;
7. deploy changed compatibility wrappers only if their source changed;
8. deploy frontend only if Admin Artist output changed, using the canonical frontend Production runner;
9. run real caller-JWT Production acceptance;
10. verify zero unexpected Artist mutations and exact audit/operation evidence;
11. remove disposable Preview;
12. record Production closure before moving to the next #945 internal gate.

No Product Artist backfill is automatically run merely because governance code deployed.

## 24. Rollback

Database migration history is forward-only.

If Production verification fails:

- stop additional writes through the affected enrichment action;
- preserve operation/evidence/write-event logs;
- use a forward corrective migration for database authority defects;
- redeploy the previous known-good Edge bundle where runtime code is responsible;
- restore the previous frontend build where UI routing is responsible;
- do not rewrite accepted migration history;
- do not bulk-revert Artist values without exact evidence of an incorrect mutation.

## 25. Non-goals

This candidate does not:

- redesign `registry.artist_origin.admit/v1`;
- grant MIZIZI autonomous enrichment authority;
- introduce standing MIZIZI Artist-enrichment grants;
- rename live provider metadata compatibility keys;
- introduce a generic Artist patch primitive;
- introduce arbitrary metadata merge authority;
- redesign canonical genre relationships;
- bulk-enrich existing Production Artists merely because the new boundary exists;
- retire/delete old Edge functions before Slice-3 dependency proof;
- solve discography/membership/credit authority, public-read purity, relationship convergence, lineage, or shared cross-domain Evidence/Review contracts in this candidate.

Those remain later internal gates of #945.

## 26. Candidate deployment classification

After implementation is accepted and merged:

- SQL migration needed: **Yes**
- Supabase Edge Function deploy needed: **Yes**
- frontend deploy needed: **Yes**
- Production Finish update needed: **No current evidence**
- automatic Production Artist backfill: **No**

This document freezes the candidate contract. It is not itself permission to mutate Production.
