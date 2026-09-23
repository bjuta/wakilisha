# Music Identity & Rights Foundation: Slice 3 Production Closure and Slice 4 Opening Authority

Date: 23 September 2026

Status: **SLICE 3 PRODUCTION CLOSED / SLICE 4 OPEN FOR DATA-DICTIONARY AND ADAPTER DESIGN ONLY**

Programme authority:

- issue #1039, `Music Identity & Rights Foundation — UUID Charts, Works, Contributions, Rights`;
- Slice 3 read-only reporting PR #1046;
- Slice 3 governed promotion architecture PR #1047;
- external identifier admission PR #1048;
- Release-to-Label admission PR #1049;
- Track/Artist Media-asset binding PR #1050.

This record closes the Slice 3 metadata acquisition and governed promotion boundary. It also opens Slice 4 for the versioned WAKILISHA music data dictionary and standards-adapter design defined by issue #1039.

This document does not authorize new Production mutation.

## 1. Final accepted repository authority

Protected repository `main`:

`dd4b3531ea61e3f7296616eb195cc86188adecbf`

Final Slice 3 implementation PR:

- PR: #1050;
- feature head after replay-seal repair: `44c15d04c73b0df93244ad627f14cb4eb0febc53`;
- merge commit: `dd4b3531ea61e3f7296616eb195cc86188adecbf`;
- PR Critical Control Plane run #1560: PASS;
- merged-main Critical Control Plane run #1561: PASS.

The merged feature branch is no longer present in the repository branch list.

## 2. Final Production migration authority

Production project:

`pgzizndxdyhqmtyywjmt`

Canonical Production promotion:

- workflow: `Repository Migration Production Promotion`;
- workflow run: `35895770373`;
- event: `workflow_dispatch`;
- exact protected-main SHA: `dd4b3531ea61e3f7296616eb195cc86188adecbf`;
- exact reviewed pending file:
  `20260923152227_music_identity_rights_slice3_media_asset_binding_admission_v1.sql`;
- exact-main gate: PASS;
- exact Production-project gate: PASS;
- exact pending-set gate: PASS;
- native repository migration promotion: PASS;
- zero-pending post-promotion gate: PASS.

Production migration state after promotion:

- migration count: `177`;
- migration head: `20260923152227_music_identity_rights_slice3_media_asset_binding_admission_v1`;
- all Production migration versions exist locally at the same canonical timestamps;
- post-promotion native dry-run reports the remote database up to date;
- no migration-history repair, timestamp aliasing, `db pull`, or ledger rewriting was required.

The promotion workflow also proved that the committed `public,editorial` database types match Production using Supabase CLI `2.107.0`, excluding only volatile PostgREST runtime metadata.

## 3. Final Track/Artist Media-binding verification

Permanent verifier:

`scripts/control-plane/verify-music-metadata-media-asset-binding-admission-v1.sql`

Independent post-promotion Production execution: PASS.

Current Production authority state:

- `registry.track.media_asset_binding.admit/v1`: enabled;
- `registry.artist.media_asset_binding.admit/v1`: enabled;
- authenticator executor binding for `registry_media_asset_binding_admin`: exactly `1`;
- standing active capability grants for that actor: `0`;
- execution grants created by this tranche: `0`;
- mutation operations created by this tranche: `0`;
- operation write-event links created by this tranche: `0`.

The migration therefore changed governed mutation authority only. It did not perform a Media backfill in Production.

The two public admission wrappers intentionally remain `authenticated`-executable `SECURITY DEFINER` RPCs because the wrappers immediately enforce the human `manage_registry` capability and enter the private broker transport. Supabase Security Advisor reports the corresponding `authenticated_security_definer_function_executable` warnings. Those findings are accepted for this control-plane design and are not evidence of ambient mutation authority.

## 4. Accepted Media-binding semantics

Production now permits a human with `manage_registry` to admit one exact retained Media-asset candidate at a time for:

- Track artwork binding;
- Artist public-image binding.

Each admission requires:

- an existing canonical subject UUID;
- an existing active `registry_media_assets` row;
- a null typed Media FK on the subject;
- exact equality between the retained subject URL and Media-asset URL;
- expected-state fingerprints for both subject and target asset;
- bound retained-metadata evidence;
- a one-row mutation;
- one canonical write-event causal link;
- independent post-mutation verification.

The operation does not:

- create a Media asset;
- overwrite an existing non-null typed Media FK;
- normalize or fuzzy-match URLs;
- infer a match from filenames, titles, provider identity, dimensions, hash absence, or visual similarity.

No Release Media operation was added because the Slice 3 report found zero exact Release reuse candidates.

## 5. Slice 3 closure ledger

Slice 3 began with reporting rather than mutation and exhausted retained evidence before any network acquisition.

### 5.1 Read-only reporting

PR #1046 established permanent read-only reports for:

- retained provider identifiers;
- Release label and composer observations;
- exact Media reuse candidates.

Accepted Production snapshot:

- Artist / Apple Music: 308 assignments, 306 deterministic, 2 review;
- Artist / Spotify: 451 assignments, 441 deterministic, 10 review;
- Release / Apple Music: 842 assignments, 840 deterministic, 2 review;
- Track / Apple Music: 2,399 assignments, 2,188 deterministic, 211 review;
- 842 Releases with retained `record_label`;
- 524 exact Registry Label candidates;
- 891 retained composer-field rows;
- 50 provider-item/composer pairs;
- 49 distinct raw composer strings;
- exact active Media reuse candidates: 251 Tracks, 1 Artist, 0 Releases.

### 5.2 Governed promotion architecture

PR #1047 froze the accepted implementation order:

1. external identifier assertion admission;
2. exact Release-to-Label historical promotion;
3. exact Track/Artist Media-asset binding;
4. composer evidence remains review-only until Work and contributor identity are deliberately established.

It explicitly prohibited a generic backfill mutation engine.

### 5.3 External identifier admission

PR #1048 is Production accepted.

It enabled candidate-only admission for retained provider identifiers while preserving:

- WAKILISHA UUID as canonical identity;
- external identifiers as assertions/evidence;
- conflicting assignments for later review;
- no automatic canonical merge;
- no automatic retained-metadata rewrite.

### 5.4 Release-to-Label admission

PR #1049 is Production accepted.

It enabled one exact historical Release-to-Label admission at a time and retained the following constraints:

- existing Release and existing Registry Label only;
- exact retained label-text match under the accepted comparison rule;
- no fuzzy matching;
- no Label creation;
- no Organisation-to-Label inference;
- no automatic historical backfill.

### 5.5 Track/Artist Media-asset binding

PR #1050 is Production accepted.

It enabled only the two earned typed Media-binding operations and performed no automatic Production backfill.

### 5.6 Composer evidence stop condition

Composer evidence remains review-only.

The retained `composerName` string does not by itself prove:

- Person identity;
- Organisation identity;
- Artist-to-Person equivalence;
- Musical Work identity;
- ISWC;
- Recording-to-Work cardinality;
- safe splitting of multi-name strings.

Therefore Slice 3 correctly does not create Work, Person, Track-to-Work, or Work Contribution authority from composer strings alone.

This is the accepted stop condition defined by the Slice 3 architecture, not incomplete implementation.

## 6. Slice 3 exit conclusion

Slice 3 is Production closed.

The accepted result is:

- retained metadata was audited before any network acquisition;
- deterministic candidates were separated from review-only evidence;
- canonical promotion is typed, provenance-bound, expected-state guarded, human-gated, idempotent, and independently verifiable;
- no generic backfill executor exists;
- no fuzzy canonicalization was introduced;
- no destructive provider-ID uniqueness was introduced;
- no network scrape was required;
- no automatic Work, Person, Contribution, Rights Claim, Label, Organisation-to-Label, or Media-asset creation was introduced;
- no Release Media operation was created without an earned candidate population;
- no standing autonomous MIZIZI authority was introduced;
- no Edge Function or frontend deployment was required;
- disposable Supabase Previews were deleted after acceptance;
- Supabase branches remaining after closure: Production `main` only.

## 7. Slice 4 opening boundary

Slice 4 is now open for **data dictionary and standards adapter design only**.

The required versioned WAKILISHA music data dictionary and mapping contracts must cover the standards named by issue #1039:

- DDEX ERN;
- DDEX RIN;
- DDEX RDR;
- DDEX MWN/BWARM;
- DDEX ECM;
- ISRC;
- ISWC;
- ISNI;
- IPI;
- IPN;
- GTIN/UPC/EAN;
- CWR;
- ISO 8000 principles;
- ISO/IEC 11179 principles;
- W3C PROV semantics.

The governing rule remains:

**standards are interoperability boundaries, not WAKILISHA persistence authority.**

Slice 4 must describe mappings into the existing WAKILISHA-owned model rather than reshape persistence around exchange-message schemas.

## 8. Slice 4 design locks

The Slice 4 design must preserve:

- WAKILISHA UUID as canonical identity;
- Registry Track UUID as canonical Sound Recording identity;
- distinct Recording, Work, Release, Media Asset, Artist persona, Person, Organisation, Contribution, and Rights Claim concepts;
- external identifiers as identifiers/evidence rather than primary identity;
- explicit unknown semantics rather than silently coercing unknown values to zero or empty;
- conflicting assertions and provenance;
- existing Registry evidence, review, write-event, lineage, Person, Organisation, Artist, Label, and Media authorities.

It must not introduce:

- DDEX-shaped persistence;
- CWR-shaped persistence;
- royalty-message-shaped persistence;
- a generic Party table;
- production DDEX exchange;
- CWR export;
- identifier-registration workflows;
- automatic rights adjudication;
- royalty calculation;
- settlement or payment-ledger changes;
- destructive historical backfill;
- bulk title rewriting.

Any future executable adapter or mutation runtime remains a separate reviewed implementation boundary.

## 9. Immediate next engineering action

The next action is documentation and mapping design from exact protected main.

Produce:

1. the versioned WAKILISHA music data dictionary;
2. canonical field definitions, controlled vocabularies, null/unknown semantics, and deprecation/supersession rules;
3. standards-to-WAKILISHA mapping matrices;
4. import/export boundary contracts that preserve provenance and conflicts;
5. explicit mappings for external identifier schemes and namespaces;
6. validation rules that distinguish structural validity from canonical truth;
7. adapter versioning and compatibility rules;
8. a proof that no adapter becomes persistence authority;
9. a test strategy for deterministic mapping behavior.

No Production database mutation is authorized by this opening record.

## 10. Deployment classification

For this closure/opening record:

- SQL migration: **No**
- Supabase Preview: **No**
- Supabase Edge Function: **No**
- frontend: **No**
- Production Finish: **No**
- Production data mutation: **No**
- PR type: **documentation-only**
