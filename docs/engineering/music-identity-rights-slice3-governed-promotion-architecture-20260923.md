# Music Identity & Rights — Slice 3 Governed Promotion Architecture

**Date:** 23 September 2026  
**Status:** Binding design gate — no Production mutation authorized  
**Programme authority:** issue #1039  
**Repository authority at design opening:** `6c87b50791a9bfc597d587deea69e0e6379673fc`

## 1. Purpose

The Slice 3 read-only reporting package proved that WAKILISHA already retains
enough music metadata to make useful canonical improvements without beginning
with a provider network scrape.

This record defines the next boundary: how retained evidence may move from
read-only candidate reports into governed canonical structures.

It does **not** authorize a backfill, enable any currently disabled Slice 2
operation, or mutate Production.

The governing rule is:

> retained evidence may propose a typed Registry mutation; it never becomes
> canonical truth merely because a report classified it as deterministic.

## 2. Accepted starting authority

The reporting sub-slice is merged through PR #1046.

Durable reports:

- `scripts/control-plane/report-music-metadata-provider-identifiers.sql`;
- `scripts/control-plane/report-music-metadata-label-composer-candidates.sql`;
- `scripts/control-plane/report-music-metadata-media-reuse-candidates.sql`.

Production still has:

- 174 migrations;
- head `20260923083943_music_identity_rights_slice2_authority_v1`;
- zero rows in the new Slice 2 Work, Work-link, Contribution, Rights Claim, and
  external-identifier assertion authorities;
- zero Releases with `label_id`;
- zero active Organisation-to-Registry-Label links.

The Slice 2 operation declarations for:

- Work creation;
- Track-to-Work admission;
- Track Contribution admission;
- Work Contribution admission;
- Rights Claim admission/reconciliation;
- external identifier assertion admission/reconciliation

remain deliberately disabled.

That fail-closed state is binding until a separately reviewed runtime broker and
verifier exist for each enabled operation family.

## 3. Current candidate evidence

The 23 September 2026 read-only Production snapshot found:

### Provider identifiers

After same-entity legacy-key deduplication:

| Entity / scheme | Assignments | Deterministic rows | Review rows |
| --- | ---: | ---: | ---: |
| Artist / Apple Music | 308 | 306 | 2 |
| Artist / Spotify | 451 | 441 | 10 |
| Release / Apple Music | 842 | 840 | 2 |
| Track / Apple Music | 2,399 | 2,188 | 211 |

A deterministic row means the retained provider value currently resolves to one
WAKILISHA UUID for that entity type and scheme. It does not mean the external
identifier becomes WAKILISHA identity.

### Release label evidence

- 842 Releases carry nonblank `metadata.record_label`;
- 230 distinct retained strings;
- 524 Releases have one exact Registry Label candidate under case/whitespace
  normalization only;
- zero have an exact Organisation `display_name` candidate under the same
  rule.

### Composer evidence

- 891 retained provider-field rows carry Apple Music `composerName`;
- 50 provider-item/composer pairs after source-level deduplication;
- 49 distinct raw composer strings.

### Media evidence

Current typed bindings:

- 170 Releases;
- 306 Tracks;
- 307 Artists.

Exact active-asset URL reuse candidates:

- 251 Tracks;
- 1 Artist;
- 0 Releases.

## 4. Architectural decision: no generic backfill mutation engine

Slice 3 must not introduce a database function that accepts arbitrary:

- table names;
- columns;
- entity types;
- JSON patches;
- SQL fragments;
- generic "backfill actions".

That would bypass the Registry's typed operation model and erase the domain
distinctions established in Slice 2.

Instead, Slice 3 may introduce a small **reviewed promotion-plan orchestration
layer** whose only job is to freeze a candidate set and dispatch already-defined
or newly-reviewed typed child operations.

The plan itself has no canonical write authority.

Each child mutation must still have:

- one declared operation key and version;
- one capability;
- bounded target and row limits;
- exact expected-state fingerprinting;
- bound evidence;
- idempotency;
- canonical write-event causality where the target authority uses it;
- independent verification;
- explicit failure and surgical resume state.

A reviewer may approve one frozen plan containing many deterministic candidates
for operational efficiency, but plan approval must not collapse those child
operations into one untraceable bulk UPDATE.

## 5. Promotion family A — external provider identifiers

### 5.1 Target authority

Use:

`public.registry_external_identifier_assertions`

Do not create another provider-identifier table.

Existing provider operational links remain in place. The assertion ledger does
not replace:

- `provider_entity_links`;
- `registry_track_provider_links`;
- Track `isrc`;
- Release `upc`;
- provider metadata projections.

### 5.2 Runtime boundary

The first executable Slice 3 implementation should build the broker and verifier
for:

`registry.external_identifier_assertion.admit/v1`

and enable **only that admission operation** after Preview proof.

Do not enable the reviewed-reconcile operation in the same change unless a real
conflict-reconciliation workflow is also implemented and proved.

The admission broker must:

1. require an existing canonical subject UUID;
2. bind scheme, source value, comparison value, issuer/namespace when known,
   evidence source, and source fingerprint;
3. freeze the current candidate state;
4. reject a stale candidate when the Registry UUID or retained source value has
   changed;
5. preserve external-ID conflicts rather than imposing global uniqueness;
6. write one assertion row per child operation;
7. verify the exact resulting assertion and evidence binding;
8. remain `manage_registry`-gated for the first runtime.

### 5.3 Candidate classes

`deterministic_candidate` rows may enter an approved promotion plan.

`review_only_duplicate_assignment` rows do not enter the deterministic plan.

They remain review evidence. A later human-reviewed conflict workflow may admit
conflicting assertions without merging canonical entities.

### 5.4 What this operation must not do

It must not:

- merge Artists, Tracks, or Releases;
- change provider operational links;
- rewrite Registry metadata;
- claim an external identifier is globally unique;
- infer identity across entity types;
- mark an assertion verified merely because the report found one current UUID.

Initial promoted assertions should preserve the distinction between retained
evidence and independently verified identifier authority.

## 6. Promotion family B — Release to Registry Label

### 6.1 Existing authority that is reusable

`registry.release.reviewed_profile.admit/v1` already proves that `label_id`
belongs to the governed Release reviewed-profile field family.

However, the current executor is intentionally bound to Track Intake:

- actor `registry_track_intake_admin`;
- Track Intake suggestion state;
- Track Intake evidence;
- Track-linked Release resolution.

It is therefore **not** a valid historical backfill executor for the 524 current
exact candidates.

Do not call or weaken that executor merely to reuse its operation key.

### 6.2 Required historical promotion operation

The implementation design should introduce a narrower operation family for this
historical reconciliation, for example:

`registry.release.label_link.admit/v1`

The final name must be sealed in implementation review, but the semantics are
binding:

- one existing Release;
- one existing active/draft Registry Label;
- current `label_id` must be null unless an explicit reviewed replacement
  operation is separately designed;
- retained `metadata.record_label` must still equal the reviewed Label under
  the exact case/whitespace rule;
- punctuation is significant;
- the expected Release state and Label state are frozen;
- evidence records the retained source text and exact match;
- verifier proves exactly one `label_id` result and its write-event causality.

### 6.3 No Organisation inference

The report found zero exact Organisation display-name matches.

Even if future evidence does match an Organisation, Release label text alone
must not create or assert:

`editorial.organization_registry_label_links`.

Organisation↔Label identity is a separate governed relationship with its own
evidence and review.

## 7. Promotion family C — exact Media asset binding

### 7.1 Existing authority

`registry_media_assets` remains the Media authority.

Current Artist image admission governs `public_image_url` and source provider,
not `public_image_id`.

The current Release/Track reviewed profile authorities likewise do not provide a
general historical typed Media-binding executor.

Therefore URL admission and typed asset binding are not the same operation.

### 7.2 Earned operations

Current evidence earns only the subject types with real exact-URL candidates:

- Track: 251 candidates;
- Artist: 1 candidate.

Do not add a Release backfill operation in this Slice 3 implementation merely
for symmetry; the current report found zero Release candidates.

The implementation should define narrow typed operations such as:

- `registry.track.media_asset_binding.admit/v1`;
- `registry.artist.media_asset_binding.admit/v1`.

Final names remain an implementation detail; semantics are binding.

Each operation must require:

- existing canonical subject UUID;
- existing active `registry_media_assets.id`;
- subject's current typed Media FK is null;
- subject's current public/artwork URL exactly equals the active asset URL;
- expected-state fingerprint for both subject binding state and target asset;
- evidence bound to the exact URL comparison;
- one-row mutation;
- independent verifier.

The operation must not:

- create a Media asset;
- overwrite a non-null typed Media binding;
- compare normalized/fuzzy URLs;
- infer a match from filename, title, provider, dimensions, hash absence, or
  visual similarity.

Replacement of an existing typed binding is a separate reviewed operation and is
out of this deterministic backfill.

## 8. Promotion family D — composer / Work / Contribution evidence

### 8.1 No automatic mutation is currently justified

Apple Music `composerName` gives WAKILISHA a retained contributor string.

It does **not** prove:

- Person identity;
- Organisation identity;
- Artist-person equivalence;
- Musical Work identity;
- Work title;
- ISWC;
- whether one Recording embodies one Work or several;
- whether a raw multi-name string should be split in a particular way.

Therefore Slice 3 must not create:

- `registry_works`;
- `registry_track_work_links`;
- `registry_work_contributions`;
- `editorial.people`

from `composerName` alone.

### 8.2 Correct next surface

The correct next step for composer evidence is a review surface or durable
review manifest that presents:

- canonical Track UUID;
- Track title and existing public Artist billing;
- provider item;
- exact raw composer string;
- retained raw payload provenance;
- any existing Work/Contribution authority if later present.

A reviewer may then deliberately establish Work identity and contributor
identity using the separately governed Slice 2 operation families.

Until such a workflow exists, the Work, Track-to-Work, and Work Contribution
operations remain disabled.

This is a deliberate stop condition, not missing implementation.

## 9. Reviewed promotion-plan lifecycle

A Slice 3 promotion plan should follow:

```text
read-only report
  -> freeze exact candidate manifest
  -> record manifest fingerprint
  -> human review / approval
  -> dispatch typed child operation(s)
  -> verify each child
  -> record per-row success / review / stale / failure
  -> surgical resume only for remaining rows
  -> final zero-unaccounted-candidate verifier
```

A plan may contain hundreds or thousands of candidates, but:

- each canonical mutation remains attributable to a typed child operation;
- stale rows fail closed individually;
- one failure does not require re-running already-succeeded rows;
- reruns are idempotent;
- plan counts are derived from the frozen manifest, not from a changing live
  report.

## 10. First implementation tranche

The first implementation tranche is deliberately only:

**external provider identifier assertion admission**

because:

1. the target authority already exists;
2. the operation type and capability already exist;
3. the operation is currently disabled exactly because runtime authority was
   intentionally deferred;
4. the read-only report provides a large deterministic candidate population;
5. no canonical entity field needs to be rewritten;
6. conflicts remain representable without destructive dedupe.

The tranche must include:

- one migration implementing the private broker/executor/verifier and only the
  required operation enablement;
- permanent SQL verifier;
- generated database types if changed by the repository workflow;
- focused contract tests;
- immutable promotion-plan contract if batching is included;
- disposable Preview baseline replay;
- positive deterministic fixtures;
- negative duplicate-ID fixtures;
- stale expected-state fixtures;
- idempotent replay fixtures;
- zero-residue fixture cleanup.

Only after that runtime is Production accepted should Slice 3 implement
Release-label or Media-binding promotion.

## 11. Production/Preview policy

This design document changes no runtime.

For the first implementation tranche:

1. create the migration with the repository's canonical Supabase CLI workflow;
2. apply to one clean disposable Preview;
3. prove baseline parity;
4. prove only the target migration is pending;
5. run permanent verifier;
6. run positive and negative fixtures transactionally or clean all residue;
7. run full critical CI and build;
8. merge;
9. promote Production SQL separately;
10. prove Production migration history and verifier;
11. no frontend activation unless the implementation actually changes
    frontend code;
12. retire Preview and feature branch last.

## 12. Scope locks

Slice 3 promotion must not introduce:

- generic table/column/JSON patch mutation;
- fuzzy canonicalization;
- provider-network scraping before retained evidence is exhausted;
- automatic Person creation from contributor strings;
- automatic Work creation from Recording title;
- automatic Track↔Work linkage from title similarity;
- generic Party;
- external ID as WAKILISHA primary identity;
- destructive global external-ID uniqueness;
- automatic Organisation↔Label identity;
- automatic Rights Claims;
- royalty or settlement scope;
- a Release Media operation without an actual candidate population;
- direct browser DML to Registry authority;
- standing autonomous MIZIZI authority.

## 13. Design exit

This design gate is accepted when the repository records and protected CI prove
the following implementation order:

1. external identifier assertion admission runtime;
2. Release-label exact-match historical promotion;
3. Track/Artist exact-URL Media binding;
4. composer evidence remains review-only until Work/contributor identity is
   explicitly established.

No Production mutation is authorized by this document.

## 14. Deployment classification

For this design record:

- SQL migration: **No**
- Supabase Preview: **No**
- Edge Function: **No**
- frontend: **No**
- Production Finish: **No**
- Production mutation: **No**

The next engineering action after merge is the external-identifier assertion
admission runtime from exact protected main.
