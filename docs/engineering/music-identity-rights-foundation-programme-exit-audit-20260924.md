# Music Identity & Rights Foundation Programme Exit Audit

Date: 24 September 2026

Status: **PROGRAMME EXIT CONDITION SATISFIED / ISSUE #1039 READY TO CLOSE**

Programme authority:

- issue #1039, `Music Identity & Rights Foundation — UUID Charts, Works, Contributions, Rights`;
- Slice 1 Production closure record;
- Slice 2 schema/control-plane design and Production acceptance;
- Slice 3 Production closure record;
- Slice 4 data dictionary and standards-adapter design;
- Slice 4 ERN 4.3.2 first-adapter closure record;
- protected main before this audit: `d2145592e8052102839e0925e87581dc3504390a`.

This audit evaluates the programme against the exact exit condition stated in issue #1039.

It does not open new mutation authority.

## 1. Current protected and Production authority

Protected main before this audit:

`d2145592e8052102839e0925e87581dc3504390a`

The immediately preceding merged-main Critical Control Plane run is:

- #1589: PASS.

That run also proved current Production parity:

- all 177 Production migration versions exist locally at the same timestamps;
- repository migration history is fully applied to Production;
- Production reports no pending repository migrations;
- repository schema snapshot matches 177 active migrations;
- Production migration head remains `20260923152227_music_identity_rights_slice3_media_asset_binding_admission_v1.sql`;
- committed `public,editorial` schema types match Production under the canonical normalized type-equality gate.

The programme exit audit therefore evaluates the current protected repository against the current Production schema authority, not a stale historical branch.

## 2. Programme invariants remain intact

The programme has preserved the governing invariants from #1039.

Accepted authority still requires:

- WAKILISHA UUID as canonical identity;
- Registry Track UUID as canonical Sound Recording identity;
- external identifiers as evidence/identifiers rather than primary identity;
- distinct Recording, Musical Work, Release, Media Asset, Artist persona, Person, Organisation, Contribution and Rights Claim concepts;
- unknown rights share distinct from zero;
- preservation of conflicting assertions until reconciliation;
- reuse of existing evidence, provenance, lineage, Person, Organisation, Artist, Label and Media authorities;
- no generic Party table;
- no DDEX-, CWR- or royalty-message-shaped persistence model.

No later Slice 1–4 work reversed these constraints.

## 3. Exit condition 1: prove what each canonical music entity is

**PASS**

The versioned `music-data-dictionary/v1` defines the canonical music concepts and their WAKILISHA authorities before external-standard mapping.

The accepted dictionary distinguishes:

- Artist persona: `public.registry_artists.id`;
- Person: `editorial.people.resource_id`;
- Organisation: `editorial.organizations.resource_id`;
- Registry Label: `public.registry_labels.id`;
- Sound Recording: `public.registry_tracks.id`;
- Musical Work: `public.registry_works.id`;
- Release: `public.registry_releases.id`;
- Media Asset: `public.registry_media_assets.id`;
- Recording-to-Work relationship;
- Recording Contribution;
- Work Contribution;
- Rights Claim;
- external identifier assertion.

The dictionary also fixes null/unknown semantics, provenance expectations, supersession behavior and controlled-vocabulary governance.

External standards map into these meanings. They do not redefine them.

## 4. Exit condition 2: prove which external identifiers have been asserted

**PASS**

Slice 2 created typed external identifier assertion authority.

`public.registry_external_identifier_assertions` keeps external identifiers separate from canonical WAKILISHA UUID identity.

The authority supports typed canonical subjects and retained external identifier evidence, including scheme, source value, namespace/issuer context, assertion state, verification state, validity, evidence and non-destructive supersession.

Slice 3 then introduced the first governed admission runtime for retained provider identifiers without automatic backfill.

Accepted first-tranche runtime families include retained provider evidence for Artist, Track and Release subjects.

The data dictionary additionally defines the semantic role of ISRC, ISWC, ISNI, IPI, IPN, GTIN/UPC/EAN, DDEX party IDs and provider identifiers.

The programme can therefore distinguish:

- a canonical WAKILISHA subject;
- an identifier asserted for that subject;
- the scheme and exact source value;
- the assertion state;
- conflicting or superseded assertions.

## 5. Exit condition 3: prove where each assertion came from

**PASS**

The foundation composes existing provenance authorities rather than creating a parallel provenance system.

Relevant retained authorities include:

- `platform_private.registry_evidence_assertions`;
- `public.registry_provenance_links`;
- `public.registry_canonical_write_events`;
- `public.registry_identity_lineage`;
- review cases and decisions;
- operation and execution-grant records.

The Slice 2 ontology tables bind evidence where applicable.

The external identifier assertion authority retains `evidence_assertion_id` and supersession lineage.

Slice 3 governed admissions require retained candidate evidence, expected-state checks, human authority, write-event linkage and independent verification.

Slice 4 adapters retain source identifiers and exact payload provenance without granting canonical mutation authority.

The foundation can therefore answer the provenance question without treating source presence as canonical truth.

## 6. Exit condition 4: prove which contribution or rights claim applies

**PASS**

Slice 2 installed typed Production authority for:

- `public.registry_track_contributions`;
- `public.registry_work_contributions`;
- `public.registry_rights_claims`;
- `public.registry_track_work_links`.

Recording Contributions remain separate from public Artist billing.

Work Contributions remain separate from Recording Contributions.

Rights Claims are typed to exactly one Recording or one Musical Work and exactly one Person or Organisation claimant.

Rights authority preserves:

- rights domain;
- right/control type;
- territory scope;
- usage scope;
- validity;
- share state;
- share percentage only when known;
- claim lifecycle;
- evidence;
- non-destructive supersession.

Unknown share remains distinct from zero.

Conflicting claims may coexist while unresolved and are not normalized destructively to 100 percent.

The exit condition does not require WAKILISHA to invent contributions or rights claims where no accepted claim exists. The foundation can represent and prove an accepted claim when present, and can distinguish that from unresolved or absent authority.

Composer observations retained by Slice 3 remain review-only rather than being converted automatically into Person, Work or Contribution identity.

## 7. Exit condition 5: prove what changed over time

**PASS**

Temporal and change history is preserved through complementary authorities:

- validity windows on relationship, contribution, claim and assertion rows;
- explicit status state;
- `superseded_by_*` relationships;
- evidence observation history;
- canonical write events with before/after state;
- identity lineage;
- review decisions;
- operation and execution records.

The music data dictionary explicitly reserves `superseded` and `historical` semantics and prohibits overwriting source memory to make current state appear timeless.

This preserves the distinction between:

- current canonical authority;
- historical canonical authority;
- prior assertions;
- rejected/disputed evidence;
- superseded identity or relationship state.

## 8. Exit condition 6: prove why observations were merged, linked, split or kept separate

**PASS**

The foundation retains the evidence needed to explain identity decisions.

Existing WAKILISHA authority provides:

- evidence assertions and fingerprints;
- provenance links;
- review cases and decisions;
- execution grants;
- canonical write events;
- identity-lineage events;
- typed Recording-to-Work relationships;
- external identifier assertions;
- chart-ingest match state and canonical entity references.

Identity lineage explicitly represents merge, split, supersession and related canonical transitions.

The programme preserved review-required states where evidence is insufficient rather than forcing fuzzy canonicalization.

Slice 3 deliberately rejected fuzzy Label, Media, composer and provider-identifier promotion.

Slice 4 likewise keeps standards assertions as source evidence until separately governed canonical admission.

This provides an audit trail for why observations were linked, admitted, rejected, split, superseded or deliberately kept distinct.

## 9. Exit condition 7: prove Chart output is reproducible from Registry Track UUID identity

**PASS**

Slice 1 changed the active chart-ingest authority order to require Registry Track resolution before aggregation, eligibility and scoring.

The accepted pipeline is:

`source fetch -> normalization -> Registry Track resolution / governed admission -> evidence aggregation by Track UUID -> eligibility -> scoring -> anti-gaming -> shortlist -> commit/publish`

The permanent Chart UUID contract proves:

- accepted Track UUID uniqueness per run;
- canonical identity stages execute before carry-forward, eligibility, scoring and shortlist;
- commit and re-ingest are projection-only;
- unresolved observations do not become ranking identity;
- Registry admission is explicit and review-gated;
- origin, playback and commit validation resolve through accepted Track UUIDs.

The scoring formula, policy, source weighting and anti-gaming rules were not replaced by text-key identity.

Chart identity therefore satisfies the #1039 exit requirement.

## 10. Slice-by-slice programme closure

### Slice 1

**CLOSED IN PRODUCTION**

Chart UUID identity authority is accepted and deployed.

### Slice 2

**CLOSED IN PRODUCTION**

The music ontology foundation is accepted and deployed:

- Musical Work;
- Recording-to-Work;
- Recording Contribution;
- Work Contribution;
- Rights Claim;
- external identifier assertion authority.

### Slice 3

**CLOSED IN PRODUCTION**

The accepted metadata-acquisition/promotion order is complete:

- read-only retained-metadata reports;
- governed external identifier admission;
- exact Release-to-Label admission;
- exact Track/Artist Media-asset binding;
- composer evidence deliberately left review-only.

No generic backfill engine or fuzzy canonicalization was introduced.

### Slice 4

**CLOSED**

The WAKILISHA music data dictionary and standards mapping contracts are accepted.

The first executable adapter, ERN 4.3.2, is closed at bounded Audio read-only acceptance.

No second executable standards adapter is justified merely to increase standards breadth.

## 11. Explicit deferrals remain correctly deferred

The programme did not pull explicitly deferred work into the foundation.

Still outside #1039:

- royalty calculation;
- settlement;
- payment-ledger changes;
- DDEX Production message exchange;
- CWR export;
- identifier registration-agency workflows;
- automatic rights adjudication;
- destructive historical backfill;
- bulk title rewriting.

These are not exit-condition failures.

They are intentionally separate future systems or workflows.

## 12. No hidden closure mutation

This programme exit audit is documentation-only.

It authorizes no:

- SQL migration;
- Supabase Preview;
- Edge deployment;
- frontend activation;
- Production data mutation;
- schema mutation;
- canonical Registry mutation;
- external standards network exchange.

The Production state remains the already accepted 177-migration authority.

## 13. Final programme decision

All seven explicit #1039 exit conditions are satisfied by the accepted Slice 1–4 authority.

The programme has achieved its intended foundation:

- canonical music identity remains WAKILISHA-owned;
- external identifiers remain evidence;
- Work, Recording, Release, Media, identity, contribution and rights concepts remain distinct;
- provenance and history are retained;
- unresolved evidence can remain unresolved;
- Chart output is Track-UUID authoritative;
- standards adapters remain boundary code rather than persistence authority.

Decision:

**close issue #1039 as completed after this audit record is merged and protected-main CI passes.**

Future work that builds on this foundation should open a new bounded issue tied to a concrete product, data-flow or operational need rather than extending #1039 indefinitely.

## 14. Deployment classification

For this audit:

- SQL migration: **No**
- Supabase Preview: **No**
- Edge Function: **No**
- frontend activation: **No**
- Production Finish: **No**
- Production data mutation: **No**
- external standards network exchange: **No**
- issue action after merge and protected-main CI: **close #1039 as completed**
- PR type: **documentation-only**
