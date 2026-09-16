# MIZIZI Slice 2 Discography Exact-Set Authority Design

Status: implementation authority for #945 Gate A

Base authority: `main@0c97dc0eb8a99846e3e93aabcafd80120dd88c77`

This document refines the accepted #945 audit freeze for `ingest-artist-discography`. It does not authorize Production mutation by itself.

## 1. Boundary

The Admin Artist Discography workflow remains one product workflow with several typed canonical authorities.

Provider acquisition is evidence production. It is not Registry mutation authority.

The browser selects and reviews a proposal. It does not round-trip provider facts back as canonical truth.

Canonical mutation uses caller JWT, `manage_registry`, exact grants, typed operations, operation journal entries, canonical write-event linkage, and independent verification.

No ambient service-role client may remain in the canonical discography mutation broker.

## 2. Provider evidence boundary

`registry-discography-provider-fetch` owns Apple Music credential access and external catalog acquisition.

Required properties:

- request bearer JWT;
- `manage_registry` before provider work;
- exact existing Artist UUID;
- service role restricted to `admin_settings_secrets` credential reads;
- no canonical Registry DML;
- normalized Apple Music observation;
- acquisition timestamp;
- source payload SHA-256 fingerprint;
- optional exact album-id fetch for later diagnostic/review use only.

The observation is recorded as immutable Registry evidence before reviewed apply.

Apply consumes the immutable evidence assertion. Apply never refetches Apple Music.

## 3. Reviewed plan boundary

The server freezes one reviewed plan from:

- exact current Artist UUID;
- immutable provider observation evidence;
- provider source-payload fingerprint;
- admin album action selection;
- exact canonical co-primary Artist selections.

The plan rejects:

- a provider observation for another Artist;
- a selected album absent from the immutable observation;
- duplicate album selections;
- malformed or conflicting co-primary Artist identity;
- an all-ignore plan;
- provider fingerprint drift.

Provider album and Track fields in canonical operations are read from the immutable server-side evidence assertion, not from browser-authored payload fields.

## 4. Identity creation stays narrow

Existing identity primitives remain authoritative.

### Artist

New co-primary Artist shells use `registry.artist.create/v1`.

The operation remains a narrow draft identity nucleus. Discography does not gain arbitrary Artist patch authority.

### Track

New Tracks use `registry.track.create/v1` for identity only.

The accepted Track Create V1 contract intentionally excludes duration, artwork, preview URL, provider IDs, provider metadata, and Release membership. The discography candidate must not widen that identity primitive merely to preserve legacy convenience.

### Release

New Releases use the already-defined `registry.release.create/v1` identity primitive.

It is currently installed but intentionally disabled/inert. The discography candidate implements and enables the exact Release Create V1 road for the human Registry broker without giving the chart broker new Release authority by implication.

Release Create V1 remains limited to the accepted identity nucleus: future UUID, deterministic slug, title, normalized title, optional bound UPC, draft state, and audit timestamps.

## 5. Provider fact admission is separate from identity creation

The legacy discography writer currently places provider facts directly on newly created Track and Release rows. Those facts remain product-useful, but they are not identity-creation authority.

The candidate therefore introduces typed evidence-bound fact operations rather than broadening Create V1:

- `registry.release.provider_profile.admit/v1`;
- `registry.track.provider_profile.admit/v1`;
- `registry.artist.discography_summary.admit/v1`.

### Release provider profile

May own only the reviewed Apple Music fact family required by the current product:

- release type;
- release date;
- artwork URL;
- Apple Music album ID and URL metadata;
- provider genre observations;
- provider record-label text observation.

It does not create canonical Label identity, Artist credits, Track membership, or arbitrary metadata.

### Track provider profile

May own only:

- duration;
- explicit flag;
- Track-level number/disc hints where the current schema retains them;
- artwork URL;
- preview URL;
- Apple Music Track/album metadata required by current product behavior.

Release sequencing remains independently authoritative in the Release-to-Track set.

### Artist discography summary

Preserves the current `apple_music_album_ids` and discography-ingested observation time consumed by Institute search without granting a generic Artist metadata patch.

## 6. Additive relation operations remain additive

Existing operations remain what they are:

- `registry.track_artist_credit.admit/v1`;
- `registry.release_track.admit/v1`;
- `registry.release_artist_credit.admit/v1`.

They insert one exact relationship fact.

They are not authority to delete and rebuild a complete set.

Discography may reuse an additive operation only when the workflow genuinely owns an additive one-row semantic transition and is not asserting a complete final set.

## 7. Exact-set replacement operation family

Discography owns three complete-set semantics:

- `registry.release_artist_set.replace/v1`;
- `registry.release_track_set.replace/v1`;
- `registry.track_artist_credit_set.replace/v1`.

Suggested capability keys:

- `replace_registry_release_artist_set`;
- `replace_registry_release_track_set`;
- `replace_registry_track_artist_credit_set`.

Each operation targets exactly one existing parent subject.

Each issued grant binds:

- parent subject UUID;
- expected parent state fingerprint;
- exact current semantic set and fingerprint;
- exact proposed final semantic set and fingerprint;
- immutable evidence assertion and fingerprint;
- policy/ruleset version;
- maximum removed rows;
- maximum inserted rows;
- maximum total affected rows;
- exact caller/issuer;
- short TTL;
- semantic idempotency key.

The generic execution-grant `max_rows` remains the total affected-row ceiling. Removed and inserted sub-budgets are also explicit inside the typed plan and checked independently.

## 8. Semantic set shapes

Fingerprints exclude volatile timestamps and arbitrary database row order.

Rows are normalized and sorted before hashing.

### Release Artist set row

- exact relationship-row UUID;
- Release UUID;
- canonical Artist UUID when resolved, otherwise null;
- credited Artist slug;
- credited Artist display text;
- role;
- `is_primary`;
- `is_featured`;
- credit order;
- display credit where present;
- source;
- confidence;
- active status;
- evidence/provenance metadata allowed by V1.

### Release Track set row

- exact membership-row UUID;
- Release UUID;
- Track UUID;
- disc number;
- track number;
- source;
- confidence;
- active status;
- evidence/provenance metadata allowed by V1.

### Track Artist credit set row

- exact relationship-row UUID;
- Track UUID;
- canonical Artist UUID when resolved, otherwise null;
- credited Artist slug;
- credited Artist display text;
- role;
- `is_primary`;
- `is_featured`;
- credit order;
- display credit where present;
- source;
- confidence;
- active status;
- evidence/provenance metadata allowed by V1.

## 9. Unresolved credited names remain evidence, not Artist identity

Production currently contains:

- 151 active Release Artist credits with `artist_id is null`;
- 654 active Track Artist credits with `artist_id is null`.

These are legitimate unresolved provider attributions in the current discography authority.

Exact-set replacement therefore does not require an Artist UUID for every credited name.

Instead, every relationship row has its own exact UUID. A credit binds either:

1. a canonical Artist UUID plus canonical slug/name snapshot; or
2. unresolved credited-name identity with null `artist_id`, normalized credited slug/name, and exact provider provenance.

The operation must never manufacture an Artist shell solely to satisfy a relationship endpoint.

Later identity resolution is a separate governed operation.

## 10. Blast-radius budgets

Read-only Production baseline at design time:

| Set | Current max | p95 | p99 |
| --- | ---: | ---: | ---: |
| Release to Track | 24 | 13 | about 17 |
| Release to Artist | 10 | 3 | 5 |
| Track to Artist | 11 | 3 | 5 |

Operation-type ceilings may remain above current maxima to avoid making ordinary future Releases impossible.

Every issued grant still binds exact removed, inserted, and total budgets from the frozen plan. Exceeding any one of those budgets rejects before mutation.

## 11. Execution semantics

Each exact-set operation is atomic for its own parent set.

Execution order:

1. consume/begin the exact grant through the existing Registry operation journal;
2. lock the exact parent subject and relevant relation set;
3. recompute parent state and current semantic set fingerprint;
4. reject stale state or set drift;
5. validate final rows and canonical endpoints;
6. compute exact removed/inserted/total counts;
7. reject any budget excess;
8. replace only the exact parent set inside the current database transaction;
9. record one canonical set-replacement write event with before/after set fingerprints and evidence causality;
10. link the write event to the Registry operation;
11. mark execution succeeded with verifier pending;
12. independently re-read and verify the final set.

A failed set operation rolls back that set operation. It does not erase independently successful identity or fact operations that already produced their own durable receipts.

## 12. Verifier semantics

The independent verifier must prove:

- operation key/version/capability/ruleset match;
- human `manage_registry` grant authority;
- exact subject target;
- plan fingerprint still matches;
- bound evidence still matches;
- final canonical set fingerprint equals the proposed final fingerprint;
- removed/inserted/total counts stayed within bound budgets;
- write-event count and causality are exact;
- no unrelated parent set changed through this operation;
- verifier replay is idempotent.

Verifier failure is durable operation evidence. It is never hidden by a retry that creates a different plan.

## 13. Parent workflow and partial progress

The discography workflow is orchestration, not a universal transaction.

Each Album plan has its own identity/fact/set operation receipts.

One Album's authority cannot authorize another Album's set replacement.

A later failure may leave newly created draft identities or already-admitted provider facts with their own valid receipts. The Admin flow must report partial progress explicitly and allow surgical resume from durable operation state.

This follows the accepted Registry rule that a failed later fact does not erase already-proven cultural identity history.

## 14. Artist detail caller contract

The current Admin Artist detail page already holds canonical Artist UUID authority upstream, but the Discography panel/drawer currently receives only slug and name.

The frontend convergence threads exact `artist.id` into:

- `DiscographyPanel`;
- `ArtistDiscographyIntakeDrawer`;
- preview request;
- create-shell request;
- apply request.

Slug remains display/routing context, never mutation authority.

## 15. Compatibility and retirement

During candidate construction, the current `ingest-artist-discography` service-role implementation remains explicitly classified as convergence debt.

After the governed broker is proven:

- the broker has no `SUPABASE_SERVICE_ROLE_KEY`;
- preview calls only the provider boundary plus evidence recorder;
- apply consumes immutable evidence and typed RPCs;
- direct table inserts/updates/deletes are absent from the broker;
- manifest classification changes from legacy service-role debt to the governed authority;
- old compatibility behavior is retired only after product caller proof.

No Slice 3 deletion is pulled into this Gate A candidate.

## 16. Permanent verification and CI consolidation

Extend the existing control plane rather than creating a chronological pile of tests.

Permanent protection belongs in:

- `scripts/control-plane/verify-registry-discography-runtime.mjs` for source/manifest boundaries;
- one permanent SQL verifier for operation types, ACLs, zero standing MIZIZI authority, exact grants, and private executor exposure;
- existing `test/artist-discography-release-credit.test.ts` for pure plan/credit semantics;
- existing critical suite integration.

Preview/browser/runtime acceptance remains deployment evidence unless a deterministic invariant deserves permanent CI.

## 17. Required adversarial acceptance

Before merge/promotion, prove at minimum:

- unauthenticated denial;
- authenticated caller without `manage_registry` denial;
- wrong Artist denial;
- provider observation bound to another Artist denial;
- browser-selected album absent from immutable evidence denial;
- changed provider/evidence fingerprint denial;
- stale parent state denial;
- stale current-set fingerprint denial;
- unexpected delete denial;
- unexpected insert denial;
- role/order/primary/featured drift denial;
- removed-row budget denial;
- inserted-row budget denial;
- total-row budget denial;
- expired grant denial;
- wrong principal denial;
- direct private executor denial;
- direct browser canonical DML denial;
- identical replay idempotence;
- changed-plan idempotency-key collision denial;
- Album A authority cannot mutate Album B;
- zero standing MIZIZI grants;
- zero active exact grants at rest after fixture cleanup;
- independent verifier pass on successful operations.

## 18. Deployment classification

SQL migration needed: Yes.

Supabase Edge Function deploy needed: Yes, changed functions only.

Frontend deploy needed: Yes, exact Artist UUID and reviewed-evidence flow.

Production Finish update needed: No current evidence.

Existing Production Registry bulk mutation authorized by convergence itself: No.

PR: only after the implementation candidate is coherent and local/Preview evidence is ready, except a draft CI-only PR if required to exercise protected validation.
