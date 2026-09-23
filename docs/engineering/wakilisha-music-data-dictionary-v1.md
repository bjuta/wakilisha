# WAKILISHA Music Data Dictionary v1

Date: 23 September 2026

Status: **SLICE 4 DESIGN AUTHORITY**

Programme authority:

- issue #1039;
- `docs/engineering/wakilisha-music-data-standards-foundation.md`;
- `docs/engineering/music-identity-rights-slice3-production-closure-and-slice4-opening-20260923.md`;
- protected main at design open: `fbff84ab493b67bd023cc246b78bc443f5021d65`.

This document is the versioned semantic dictionary for WAKILISHA music data. It defines what canonical concepts mean inside WAKILISHA before any external standard mapping is considered.

External standards may map into or out of these concepts. They do not redefine them.

## 1. Dictionary governance

Version: `music-data-dictionary/v1`

A dictionary entry is normative when this record defines:

- canonical concept;
- WAKILISHA authority;
- identity rule;
- null and unknown semantics;
- controlled vocabulary where applicable;
- external-standard relationship;
- provenance requirement;
- supersession rule.

Changes that alter meaning require a new dictionary version or an explicitly backward-compatible amendment. Do not silently repurpose an existing field or vocabulary value.

A source may assert data that is structurally valid but not canonical truth. Structural validity, evidence quality, review state, and canonical acceptance are separate states.

## 2. Universal truth states

The following meanings are reserved across the music domain:

| State | Meaning |
| --- | --- |
| `unknown` | WAKILISHA does not currently know the value |
| `not_applicable` | the concept does not apply to this subject |
| `asserted` | a source states the value |
| `supported` | retained evidence materially supports the value |
| `verified` | an accepted verification process confirmed the value |
| `canonical` | WAKILISHA currently accepts the value as canonical authority |
| `disputed` | competing evidence or claims are unresolved |
| `rejected` | a reviewed assertion was not accepted |
| `superseded` | a later accepted state replaces this state without deleting history |
| `historical` | the value was true or operationally used in an earlier period |

Rules:

- `unknown` is not zero, false, empty string, or `not_applicable`;
- `disputed` does not imply false;
- `superseded` does not imply deletion;
- source assertions remain reconstructable after canonical decisions.

## 3. Canonical identity classes

### 3.1 Artist persona

Canonical authority: `public.registry_artists.id`

Meaning: a public music identity, billing identity, brand, project, group, or persona presented to audiences.

Identity rule: WAKILISHA UUID.

An Artist persona is not automatically:

- a natural Person;
- a legal Organisation;
- a rights claimant;
- a contributor's underlying legal identity.

External public-identity identifiers such as ISNI may be asserted against an Artist persona where evidence supports that public identity.

### 3.2 Person

Canonical authority: `editorial.people.resource_id`

Meaning: a natural-person identity reused across WAKILISHA domains.

A Person may have public Artist personas, contributor roles, rights claims, and external identifiers. Those relationships require explicit governed evidence.

### 3.3 Organisation

Canonical authority: `editorial.organizations.resource_id`

Meaning: a legal or organisational identity.

An Organisation is distinct from:

- Registry Label;
- Artist persona;
- provider account;
- distributor;
- collecting society role in a specific message.

Role in a transaction does not redefine Organisation identity.

### 3.4 Registry Label

Canonical authority: `public.registry_labels.id`

Meaning: WAKILISHA Registry identity for a music label.

Organisation-to-Label identity is a separate governed relationship and is not inferred from text equality alone.

### 3.5 Sound Recording

Canonical authority: `public.registry_tracks.id`

Meaning: canonical WAKILISHA identity for a sound recording.

Identity rule: Registry Track UUID.

ISRC is an external identifier of a recording, not the database primary identity.

A remaster, edit, mix, instrumental, stem, or other derivative may be:

- the same Sound Recording;
- a distinct Sound Recording;
- only a distinct Media Asset;

depending on evidence and the applicable recording-identity rules. Filenames and title text do not decide this automatically.

### 3.6 Musical Work

Canonical authority: `public.registry_works.id`

Meaning: the intangible musical creation embodied or used by one or more recordings.

Identity rule: WAKILISHA Work UUID.

ISWC is an external identifier of a Musical Work. It does not identify:

- a sound recording;
- a Release;
- a performer;
- a rights share.

Work title is descriptive data, not canonical identity.

### 3.7 Release

Canonical authority: `public.registry_releases.id`

Meaning: a packaged music product or release identity that may contain one or more recording memberships.

Release identity is distinct from Sound Recording identity.

A Track may:

- belong to no current Release;
- belong to one Release;
- belong to multiple Releases.

Release classification such as single, EP, or album classifies a Release UUID and does not create a different entity class.

### 3.8 Media Asset

Canonical authority: `public.registry_media_assets.id`

Meaning: a governed media object used by WAKILISHA, including image or audio-related assets where the Registry model applies.

Media Asset identity is distinct from Sound Recording identity.

A URL is evidence or delivery metadata, not Media Asset identity.

### 3.9 Recording-to-Work relationship

Canonical authority: `public.registry_track_work_links.id`

Meaning: a typed, evidence-bound relation between a Sound Recording and Musical Work.

Current relation vocabulary:

- `embodies`;
- `adaptation_of`;
- `medley_component`;
- `sampled_work`;
- `other_reviewed`.

The model does not assume one Recording maps to exactly one Work.

### 3.10 Recording Contribution

Canonical authority: `public.registry_track_contributions.id`

Meaning: contribution to the creation or performance of a Sound Recording.

Contributor identity may resolve to:

- Person;
- Organisation;
- optional Artist persona for credited public identity;
- retained `credited_as` text when canonical underlying identity is not yet known.

Initial role vocabulary:

- `primary_performer`;
- `featured_performer`;
- `performer`;
- `producer`;
- `recording_engineer`;
- `mixing_engineer`;
- `mastering_engineer`;
- `session_musician`;
- `conductor`;
- `vocalist`;
- `instrumentalist`;
- `other_reviewed`.

Public Track Artist billing remains separate presentation authority and must not be silently treated as the complete Recording Contribution set.

### 3.11 Work Contribution

Canonical authority: `public.registry_work_contributions.id`

Meaning: contribution to the authorship or creation of a Musical Work.

Initial role vocabulary:

- `composer`;
- `lyricist`;
- `songwriter`;
- `arranger`;
- `adaptor`;
- `translator`;
- `publisher_representative`;
- `other_reviewed`.

Raw provider contributor strings do not create Person, Organisation, Work, or Work Contribution identity automatically.

### 3.12 Rights Claim

Canonical authority: `public.registry_rights_claims.id`

Meaning: an evidence-bound assertion about rights or control over exactly one Recording or exactly one Musical Work.

Subject rule:

- exactly one Sound Recording; or
- exactly one Musical Work.

Claimant rule:

- exactly one Person; or
- exactly one Organisation.

Artist persona is not sufficient as legal claimant when the underlying claimant is known.

Rights Claim is an assertion/reconciliation authority. It is not a financial ledger.

## 4. Rights dictionary

### 4.1 Rights domain

Controlled values:

- `recording`;
- `work`.

The rights domain must agree with the typed subject FK.

### 4.2 Share state

Controlled values:

- `known`;
- `unknown`;
- `disputed`;
- `not_applicable`.

Rules:

- `known` requires a numeric percentage;
- all other states require a null percentage;
- zero is a valid known percentage;
- unknown is never encoded as zero;
- multiple conflicting claims may coexist;
- aggregate asserted claims may exceed 100 percent while unresolved.

### 4.3 Claim lifecycle

Controlled values:

- `asserted`;
- `supported`;
- `verified`;
- `disputed`;
- `superseded`;
- `rejected`.

Reconciliation must preserve prior claims and evidence.

### 4.4 Territory semantics

Current representation:

- `worldwide`;
- `explicit`;
- `unknown`.

For `explicit`, territory codes use ISO 3166-1 alpha-2 values in the current model.

Absence of a territory value is not silently interpreted as worldwide.

### 4.5 Financial exclusion

The following do not belong to Rights Claim:

- royalty amount;
- payable;
- receivable;
- balance;
- settlement amount;
- payment status;
- remittance transaction.

Those belong to separately governed future financial systems.

## 5. External identifier dictionary

Canonical authority for historical/asserted mappings:

`public.registry_external_identifier_assertions.id`

An external identifier assertion contains:

- typed canonical WAKILISHA subject;
- scheme;
- exact source value;
- comparison value where scheme rules define one;
- issuer or namespace where relevant;
- assertion state;
- verification state;
- source evidence;
- validity;
- non-destructive supersession.

No external identifier replaces a WAKILISHA UUID.

### 5.1 Scheme vocabulary

| Scheme key | Identifies | WAKILISHA subject |
| --- | --- | --- |
| `isrc` | sound recording / music video recording identifier | Track |
| `iswc` | musical work identifier | Work |
| `isni` | public identity identifier | Artist, Person, Organisation as evidenced |
| `ipi` | interested party in works-rights ecosystem | Person or Organisation |
| `ipn` | performer identifier | Person where performer identity is established |
| `gtin` | trade item / product | Release where applicable |
| `upc` | GTIN-12 product identifier representation | Release where applicable |
| `ean` | GTIN-13 product identifier representation | Release where applicable |
| `ddex_party_id` | DDEX party namespace identifier | Person or Organisation only after explicit identity resolution |
| `apple_music` | provider entity identifier | typed Artist, Track, Release according to source family |
| `spotify` | provider entity identifier | typed Artist, Track, Release according to source family |
| `youtube` | provider entity identifier | typed subject according to source family |
| `soundcloud` | provider entity identifier | typed subject according to source family |
| `other_reviewed` | explicitly reviewed external scheme | typed subject approved by the relevant contract |

Provider operational bindings remain authoritative for provider runtime resolution. The assertion ledger records evidence/history and does not replace provider-link tables.

### 5.2 Identifier comparison

Source value must be preserved exactly.

A comparison form may be derived only from documented rules for that scheme. Generic punctuation stripping, case folding, fuzzy matching, phonetic matching, or similarity scoring must not become universal identifier normalization.

### 5.3 Identifier conflict

The model must represent:

- one external value asserted against multiple WAKILISHA UUIDs;
- multiple historical or disputed values asserted against one WAKILISHA UUID;
- superseded assignments;
- duplicate external identifiers that require review.

No global uniqueness constraint may destroy this evidence.

## 6. Provenance dictionary

WAKILISHA provenance composes existing authorities:

- `platform_private.registry_evidence_assertions`;
- `public.registry_provenance_links`;
- `public.registry_canonical_write_events`;
- `public.registry_identity_lineage`;
- review cases and decisions;
- operation and execution-grant records.

Core meanings:

- **Evidence assertion**: what a source said, under what trust class, with source identity and fingerprint.
- **Provenance link**: relation between a canonical object and a retained source or derivation.
- **Canonical write event**: governed record of a canonical mutation and its before/after state.
- **Identity lineage**: merge, split, supersession, or other canonical identity transition.
- **Review decision**: human-governed disposition of evidence or candidate state.

W3C PROV concepts may map to these authorities for interchange, but WAKILISHA does not require RDF persistence.

## 7. Source and trust semantics

Every externally sourced fact admitted into canonical authority must retain enough provenance to answer:

- who or what supplied it;
- when it was observed;
- the source namespace and source entity;
- the exact raw or retained value where material;
- the transformation or comparison rule used;
- the evidence fingerprint;
- the review or verification method;
- the canonical operation that accepted or rejected it.

A provider's presence in a message is not proof of canonical identity.

## 8. Structural validity versus canonical truth

Four separate checks are required for standards-facing data:

1. **Syntax validity**: the payload conforms to the external format or identifier syntax.
2. **Semantic mapping validity**: each source term can be mapped to a WAKILISHA concept without contradiction.
3. **Identity/evidence validity**: referenced parties, works, recordings, releases, or claims have adequate evidence and typed candidate resolution.
4. **Canonical admission validity**: a governed WAKILISHA operation accepts the resulting canonical change.

Passing steps 1 or 2 must never imply step 4.

## 9. Null, omission, and default rules

General rules:

- omitted source value means "not supplied", not false and not zero;
- blank source text is retained as source-quality evidence when operationally useful but is not promoted as a canonical nonblank value;
- unknown values stay explicit;
- default values are permitted only when they are WAKILISHA operational defaults, not invented source claims;
- an adapter must record when a target field cannot represent a source distinction without loss.

## 10. Temporal and supersession rules

Do not overwrite source memory to make the latest state appear timeless.

Where the authority supports it, retain:

- observation time;
- valid-from;
- valid-to;
- superseded-by;
- assertion or claim state;
- review decision time;
- canonical write-event time.

External messages may describe current state, historical state, or corrections. Adapter mapping must preserve that distinction.

## 11. Controlled vocabulary governance

A controlled vocabulary entry requires:

- stable WAKILISHA key;
- human-readable meaning;
- domain scope;
- external-standard mappings where applicable;
- version introduced;
- deprecation state;
- replacement key where superseded.

External allowed-value sets do not become WAKILISHA vocabulary keys automatically.

Many-to-one and one-to-many mappings are permitted when documented. Lossy mappings must be explicit.

## 12. Dictionary compatibility

Compatible v1 changes include:

- adding an external synonym for an existing concept;
- adding a new standards mapping that does not change WAKILISHA meaning;
- clarifying text without changing field semantics;
- adding a vocabulary value that is genuinely additive and does not reinterpret existing rows.

A new dictionary version is required when:

- an existing canonical concept changes meaning;
- a vocabulary value changes semantic scope;
- null/unknown semantics change;
- identity authority changes;
- a standard mapping would require destructive reinterpretation of existing canonical data.

## 13. What this dictionary does not authorize

This document does not authorize:

- SQL migration;
- external message ingestion runtime;
- DDEX production exchange;
- CWR export;
- identifier registration-agency workflows;
- automatic canonical entity creation;
- automatic rights adjudication;
- royalty calculation;
- settlement;
- payment ledger changes;
- destructive historical backfill;
- bulk title rewriting;
- fuzzy identity matching.

Any executable adapter or canonical mutation runtime requires its own reviewed implementation and deployment proof.
