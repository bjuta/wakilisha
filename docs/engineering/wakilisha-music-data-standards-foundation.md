# WAKILISHA Music Data Standards Foundation

**Status:** Binding engineering architecture checkpoint  
**Authority date:** 23 September 2026  
**Repository baseline:** `d340f8b3cf322aad22d7ba4c3844eeec196e2788`  
**Production database baseline:** 172 migrations, head `20260922171632_mizizi_release_slug_resume_integrity_v1`  
**Scope:** Registry, MIZIZI, Artist Studio, Charts, provider ingestion, credits, works, masters, rights, and future standards adapters.

## 1. Why this document exists

WAKILISHA now has enough real music data, identity history, provider evidence, and Registry mutation infrastructure to define its long-term music data model deliberately.

This document does not make an external industry message format the WAKILISHA persistence model.

It does four things:

1. records the exact current music-data authority;
2. defines the canonical domain boundaries we must preserve;
3. identifies which new primitives are genuinely earned now;
4. defines how international standards surround WAKILISHA as interoperability contracts.

The governing project doctrine remains:

- shared primitives should emerge around recurring authority;
- domain entities remain distinct where their meaning differs;
- assertions are not automatically truth;
- external infrastructure sits behind WAKILISHA-owned contracts;
- every new primitive must have a value loop and provenance contract.

## 2. Current Production authority

The live Registry currently proves:

| Authority | Current state |
| --- | ---: |
| Active Registry Tracks | 2,101 |
| Active Tracks with ISRC | 2,101 |
| Active duplicate ISRC groups | 0 |
| Active Registry Releases | 841 |
| Active Releases with UPC | 840 |
| Registry Labels | 232 |
| Active Releases with `label_id` | 0 |
| Active Releases with provider label text | 841 |
| Registry media assets | 1,099 |
| Provider field observations | 1,131 |
| Registry provenance links | 6,332 |
| Registry canonical write events | 1,473 |
| Registry identity lineage events | 202 |
| Private Registry evidence assertions | 11 |

Track and Release are already separate authorities. Production currently contains:

- 62 active Tracks with zero active Release memberships;
- 1,939 active Tracks with exactly one active Release membership;
- 100 active Tracks with multiple active Release memberships.

A Release cannot therefore define Sound Recording identity.

## 3. Non-negotiable identity contract

### 3.1 WAKILISHA UUID is canonical identity

Every canonical WAKILISHA entity is identified internally by a WAKILISHA-controlled UUID.

External identifiers are identifiers, assertions, and evidence. They are not the canonical database identity.

This applies to:

- ISRC;
- ISWC;
- ISNI;
- IPI;
- IPN;
- GTIN, UPC, and EAN;
- DDEX Party IDs;
- provider IDs;
- fingerprints;
- third-party catalogue identifiers.

DDEX explicitly recommends against using ISRC as a database primary key and states that the same principle applies to ISWC, GRid, and other creation identifiers because external identifiers can be duplicate, incorrect, incomplete, or operationally ambiguous.

Source: https://kb.ddex.net/implementing-each-standard/best-practices-for-all-ddex-standards/guidance-on-identifiers%2C-iso-codes-lists-and-dates/use-of-isrcs-as-the-primary-database-key

### 3.2 Chart identity is never text identity

For any observation admitted into canonical Chart scoring:

`Registry Track UUID` is the dedupe, continuity, carry-forward, airplay, movement, and ranking identity.

`normalized_key` remains useful only for:

- matching;
- search;
- unresolved evidence grouping;
- human diagnostics.

An unresolved title plus Artist observation must not silently manufacture canonical Track identity for ranking.

The current scoring pipeline still aggregates and carries continuity by `normalized_key` before canonical UUID authority is fully applied. That is an active architectural defect and the first executable correction after this documentation checkpoint.

### 3.3 External identifier conflicts must be representable

A standards identifier conflict must not force destructive identity collapse.

The model must allow, for example:

- one external ISRC asserted against two candidate Recording UUIDs;
- one Recording UUID with multiple historical or disputed external identifiers;
- duplicate ISRC clusters;
- ISWC merge or split history;
- superseded provider identifiers.

DDEX Entity Cluster Messages explicitly support both Musical Work clusters and groups of Sound Recordings that operationally represent the same Recording despite different ISRCs.

Source: https://kb.ddex.net/implementing-each-standard/entity-cluster-message-suite-%28ecm%29/

## 4. Canonical music-domain boundaries

### 4.1 Artist is a public music identity, not a universal Party

`registry_artists` remains the canonical public music persona or Artist identity.

Do not turn Artist into a universal natural-person or organisation table.

WAKILISHA already has:

- `editorial.people` as Person authority;
- `editorial.organizations` as Organisation authority;
- `registry_artists` as music persona authority;
- `registry_labels` as Registry Label authority;
- `editorial.organization_registry_label_links` as an existing Organisation to Label bridge.

Therefore **do not create a new generic `registry_parties` table**.

In DDEX/CWR/RDR adapters, the external concept of a Party must resolve onto an existing WAKILISHA Person, Organisation, Artist persona, Label relationship, or an unresolved evidence state as appropriate.

A direct Artist to Person or Artist to Organisation identity relationship must be designed as a governed relationship, not inferred from name similarity.

DDEX ERN 4 itself distinguishes the artist brand used for public presentation from the Party or Parties who wrote or performed the music.

Source: https://kb.ddex.net/implementing-each-standard/electronic-release-notification-message-suite-%28ern%29/ern-4-explained/differences-between-ern-3-and-ern-4/

### 4.2 Registry Track is canonical Sound Recording identity

`registry_tracks.id` is the WAKILISHA Sound Recording UUID.

"Track" may remain public product language.

ISRC identifies a Sound Recording externally. It does not replace the WAKILISHA UUID.

### 4.3 Musical Work is a separate entity and is now earned

A Musical Work is not a Recording.

A Work can be embodied in multiple Sound Recordings. A Sound Recording may also require more than one Work relationship in edge cases such as medleys or compound adaptations.

The Work primitive is now earned because WAKILISHA already needs to represent:

- composer and lyricist information;
- work-to-recording identity;
- ISWC;
- publishing claims;
- writer contributions;
- adaptations and derivations;
- work-side rights.

ISWC uniquely identifies Musical Works and explicitly does not identify recordings or ownership shares.

Source: https://www.iswc.org/iswc

The future canonical authority is therefore a WAKILISHA Musical Work UUID. ISWC attaches to it as an external identifier.

### 4.4 Release remains a separate canonical entity

`registry_releases.id` remains the WAKILISHA Release UUID.

Single, EP, and Album are Release classifications. They are not separate identity primitives.

GTIN, UPC, EAN, provider album IDs, and future GRid values are identifiers attached to Release identity.

### 4.5 Media Asset is not Sound Recording and is not master ownership

`registry_media_assets` is already the correct substrate for files and deliverables.

A WAV, FLAC, stem, instrumental, radio edit, remaster asset, or artwork file is an asset embodying or representing another cultural object.

A master audio file is not itself the canonical Sound Recording.

Ownership or control of master rights is a rights assertion against the Sound Recording, not "ownership of the file."

## 5. New primitives that are earned now

Primitivization is deliberately narrow.

### 5.1 Musical Work

**Decision:** create a first-class canonical Musical Work authority.

Why it is earned:

- Recording and composition are semantically distinct;
- ISWC requires a Work boundary;
- provider and first-party metadata can already carry composer information;
- future publishing, credits, and rights cannot be modelled correctly without it.

### 5.2 Contribution

**Decision:** create a governed music Contribution authority.

Current `registry_track_artists` and `registry_release_artists` are public billing and display-credit relationships. They must not be stretched into a universal contributor model.

Contribution must eventually support roles such as:

- performer;
- featured performer;
- producer;
- composer;
- lyricist;
- arranger;
- engineer;
- mixer;
- mastering engineer;
- session musician;
- conductor;
- other controlled or user-defined roles where standards permit.

DDEX ERN and RIN explicitly support rich Contributor roles, instruments, and display credits.

Source: https://kb.ddex.net/implementing-each-standard/best-practices-for-all-ddex-standards/guidance-on-contributors%2C-artists-and-writers/artist-roles-and-displaycredits/

### 5.3 Rights Claim

**Decision:** create a rights-claim authority, not a royalty-balance table.

A Rights Claim needs contextual truth:

- subject entity;
- claimant Person or Organisation;
- right or share type;
- territory;
- usage scope;
- valid-from and valid-to;
- percentage when known;
- unknown state when not known;
- dispute state;
- source and evidence;
- review state;
- supersession and history.

Unknown must not be encoded as zero.

Conflicting claims may coexist as assertions while unresolved. A conflict where claims exceed 100 percent is a valid state to represent, not a database impossibility.

DDEX RDR explicitly supports recording rights claims and claim conflicts. RDR-RCC exists specifically for conflicts where claims over the same rights exceed 100 percent.

Sources:

- https://kb.ddex.net/implementing-each-standard/recording-data-and-rights-standards-%28rdr%29
- https://kb.ddex.net/implementing-each-standard/recording-data-and-rights-standards-%28rdr%29/recording-data-and-rights-claim-conflict-%28rdr-rcc%29

### 5.4 External Identifier assertion

**Decision:** the concept is earned, but do not create a generic identifier table until its relationship to existing provider-link and evidence authority is sealed.

WAKILISHA already has provider-specific identity tables and evidence infrastructure. The next schema design must first prove whether the correct primitive is:

- a generalized identifier assertion table;
- an extension of existing provider/entity link authority;
- or a small shared identifier registry plus domain-specific bindings.

The chosen model must preserve:

- scheme;
- value;
- namespace or issuer;
- subject type and UUID;
- assertion status;
- verification state;
- source evidence;
- validity interval where applicable;
- conflict and supersession history.

Do not add endless direct columns such as `iswc`, `isni`, `ipi`, and `ipn` to every domain table.

Hot-path materialized fields such as `registry_tracks.isrc` and `registry_releases.upc` may remain for compatibility and performance while the assertion authority is introduced.

## 6. Primitives explicitly not earned

The following must **not** be introduced merely to mirror a standard:

- a new generic Party table;
- a generic graph table replacing typed music-domain authorities;
- a generic percentage table;
- a generic royalty ledger before royalty settlement exists;
- a DDEX-message-shaped persistence schema;
- a CWR-shaped persistence schema;
- a separate canonical Album entity beside Release;
- a "Master" entity that conflates Sound Recording, media file, and recording rights;
- speculative tables for every future DDEX message family.

Standards adapters may use these concepts at the boundary without forcing them into core persistence.

## 7. Standards conformance map

### 7.1 DDEX

Architectural compatibility now:

- ERN for Releases, Sound Recordings, contributors, commercial metadata, and supply-chain exchange;
- RIN for studio and contribution metadata;
- RDR-N and RDR-RCC for Sound Recording contributors, rights claims, and claim conflicts;
- MWN and BWARM for Musical Works, Work-to-Recording relationships, and work-side rights claims;
- ECM for Musical Work clusters and Duplicate ISRC clusters;
- Party and identifier semantics where useful.

Current DDEX standards catalogue:
https://kb.ddex.net/reference-material/standards-specifications/

WAKILISHA does not need to become a DDEX production message endpoint in this foundation slice.

DDEX permits evaluation and implementation development under its evaluation licence, but requires a free Implementation Licence before a DDEX implementation is moved into production data exchange. A DPID is then used to identify message senders and recipients.

Sources:

- https://kb.ddex.net/general-implementation-guidance/licensing-the-standards/
- https://kb.ddex.net/general-implementation-guidance/licensing-the-standards/ddex-party-identifier-%28dpid%29

### 7.2 ISO identifiers

Relevant identifier families include:

- ISRC for Sound Recordings;
- ISWC, ISO 15707, for Musical Works;
- ISNI, ISO 27729, for public identities of Parties.

ISNI identifies public identities, which reinforces the WAKILISHA distinction between underlying Person or Organisation authority and public Artist identity.

Source:
https://www.iso.org/standard/87177.html

### 7.3 CISAC and SCAPR identifiers and exchange

CWR remains relevant as a musical-work registration exchange format.

IPI is relevant to interested parties in musical-work rights workflows.

IPN is relevant to performer identity and neighbouring-rights workflows.

These belong in identifier and interoperability boundaries. They do not replace WAKILISHA UUID identity.

CISAC format reference:
https://www.cisac.org/formats

### 7.4 Data quality and provenance

WAKILISHA should use, not blindly implement, these standards as design influences:

- ISO 8000 for master-data quality and identifier quality;
- ISO/IEC 11179 for metadata registry semantics and data-definition governance;
- W3C PROV for interoperable provenance concepts.

ISO 8000-115 explicitly covers syntax, semantics, ownership, and resolution of quality identifiers:
https://www.iso.org/standard/88847.html

W3C PROV models provenance around Entities, Activities, Agents, derivation, usage, generation, and responsibility:
https://www.w3.org/TR/prov-overview/

WAKILISHA should remain relational. No RDF migration is implied.

## 8. Existing WAKILISHA authority to reuse

Do not duplicate these systems:

- `platform_private.registry_evidence_assertions`;
- `provider_field_observations`;
- `registry_provenance_links`;
- `registry_canonical_write_events`;
- `registry_identity_lineage`;
- Registry review machinery;
- `editorial.people`;
- `editorial.organizations`;
- `registry_artists`;
- `registry_labels`;
- `editorial.organization_registry_label_links`;
- `registry_media_assets`.

The music standards foundation must extend these authorities, not create a parallel truth stack.

## 9. Metadata acquisition and backfill policy

Backfill is continuous evidence acquisition, not one giant rewrite.

### 9.1 Provider ingestion

When providers expose useful metadata, ingestion should retain it as a typed observation with the raw source payload preserved.

Useful examples include:

- provider Recording and Release IDs;
- ISRC and UPC;
- composer or writer strings;
- label and imprint;
- copyright text;
- release date and precision;
- genre;
- explicit-content state;
- track and disc sequence;
- available audio or mastering attributes;
- artwork and media references.

Provider absence means unknown, not false.

### 9.2 Existing WAKILISHA data

Before external network backfill, promote trustworthy data we already possess into governed structures.

Known opportunities include:

- existing Apple Track IDs already present on Registry Track metadata;
- existing Apple Release IDs and URLs;
- 841 Release label strings currently not linked through `label_id`;
- existing media assets;
- existing provider observations;
- existing Artist and Release credits.

Promotion must retain provenance and must not convert ambiguous text into canonical identity automatically.

### 9.3 Artist Studio

Artist Studio is the natural first-party capture surface for information consumer DSP APIs often do not reliably provide:

- legal Person or Organisation relationships;
- songwriters and composers;
- producers and engineers;
- performers and instruments;
- Work links;
- publisher and administrator relationships;
- master-rights controller assertions;
- ISWC, ISNI, IPI, and IPN where known;
- ownership or control claims;
- supporting documentation and evidence.

First-party submission remains an assertion. It does not bypass Registry reconciliation.

## 10. Immediate executable programme

This foundation is intentionally limited to four bounded moves.

### A. Chart UUID identity correction

#### Current execution-path audit

Production run history and current source show two scoring surfaces:

- the standalone `run-chart-scoring` path has only one recorded Production run,
  a failed run from 4 July 2026;
- the `chart_ingest_runs` pipeline owns the later published and dry-run history;
- the active ingest pipeline currently normalizes and groups source observations
  before Registry Track resolution;
- `chart_ingest_matches` already has a canonical entity binding contract with
  `canonical_entity_id`, match method, confidence, decision state, and
  candidate/run identity;
- the normal pipeline does not currently require an accepted Track match before
  scoring;
- `handleCommitRun` materializes Registry identity only after shortlist
  selection, which is too late for canonical identity to govern dedupe,
  continuity, and ranking.

Therefore the correct repair is **not** to add another candidate identity column
or to patch the dormant standalone scorer in isolation.

The active pipeline must reuse `chart_ingest_matches` as the resolution
authority and move Track resolution ahead of canonical scoring.

Move canonical Registry Track resolution before canonical scoring aggregation.

For resolved evidence:

- dedupe by Registry Track UUID;
- aggregate source evidence by Registry Track UUID;
- key airplay context by Registry Track UUID;
- key previous-edition continuity by Registry Track UUID;
- classify movement by Registry Track UUID;
- carry forward by Registry Track UUID;
- allow only one canonical ranked row per Registry Track UUID.

For unresolved evidence:

- preserve evidence;
- group text only for matching or diagnostics;
- create or retain a governed match/review state;
- do not rank it as a canonical Track until Registry identity resolution or
  governed Registry admission succeeds.

The intended stage boundary is:

```text
source fetch
  -> observation normalization
  -> Registry Track resolution / governed admission
  -> aggregate evidence by Registry Track UUID
  -> eligibility
  -> scoring
  -> anti-gaming
  -> shortlist
  -> commit/publish
```

A Chart dry run must not create speculative Registry identity simply to make a
candidate scoreable. New canonical Track admission must use existing Registry
authority and evidence rules.

Do not change scoring weights, chart methodology, anti-gaming policy, or source history in this correction.

### B. Music ontology schema design

Design, but do not yet mutate Production, for:

- Musical Work;
- Recording-to-Work relationship;
- Contribution;
- Rights Claim;
- external identifier assertions.

The design must explicitly map Person and Organisation onto existing editorial authority rather than introduce a new Party table.

### C. Existing metadata promotion design

Define read-only candidate reports for:

- provider identifiers already stored in metadata;
- Label text to existing Label and Organisation authority;
- provider composer or contributor observations;
- existing media assets.

No fuzzy auto-canonicalization in this stage.

### D. Data dictionary

Create a versioned WAKILISHA music data dictionary for every new concept before Production mutation.

Each entry should define:

- canonical concept;
- owning domain entity;
- datatype;
- allowed values;
- nullable and unknown semantics;
- provenance requirement;
- visibility;
- external-standard mappings;
- version introduced;
- supersession or deprecation rule.

## 11. What this programme does not include

Not in the immediate foundation:

- royalty calculation;
- royalty settlement;
- financial ledger changes;
- DDEX production exchange;
- CWR export;
- ISWC registration;
- IPN registration;
- automatic rights adjudication;
- destructive historical backfill;
- bulk title rewriting;
- new Artist merge heuristics.

Those require their own earned workflows.

## 12. Ten-year invariant

The system must always be able to answer:

> What is this entity?

> What identifiers have been asserted for it?

> Who or what asserted each fact?

> What evidence supported the assertion?

> What changed?

> What did we believe at a given time?

> Why were two records linked, merged, split, or kept distinct?

> Which rights claim applies for which right, territory, use, and time?

> Can the resulting analytical output be reproduced from canonical UUID identity and retained evidence?

If a future provider, standard, importer, AI model, or acquisition partner cannot fit through those questions without replacing WAKILISHA identity authority, the integration is wrong.


## 13. Data dictionary v1 — current semantic authority

This section is a semantic dictionary, not a migration specification. Physical
column names may change after Preview replay, but these meanings may not be
collapsed.

### 13.1 Canonical entities

| Concept | Internal authority | Identity | External mapping | Null / unknown semantics |
| --- | --- | --- | --- | --- |
| Person | `editorial.people` | Person UUID | DDEX Party / ISNI / IPI / IPN where applicable | absence of an external identifier means unknown |
| Organisation | `editorial.organizations` | Organisation UUID | DDEX Party / ISNI / IPI / label, publisher, administrator roles | absence of a relationship means unknown, not "independent" |
| Artist Persona | `registry_artists` | Artist UUID | display Artist / performer brand / provider Artist ID | Artist must not be assumed to be a legal Person |
| Sound Recording | `registry_tracks` | Track UUID | DDEX SoundRecording / ISRC / provider Recording ID | ISRC absence or conflict does not remove Recording identity |
| Musical Work | new typed Registry authority | Work UUID | DDEX MusicalWork / ISWC | Work may exist before ISWC is known |
| Release | `registry_releases` | Release UUID | DDEX Release / GTIN, UPC, EAN, provider Release ID | Release type may be source-declared or inferred; identity is independent |
| Label | `registry_labels` | Label UUID | label/imprint presentation; Organisation may be linked separately | label text without canonical link remains evidence |
| Media Asset | `registry_media_assets` | Asset UUID | file/deliverable/resource representation | asset ownership does not imply rights ownership |

### 13.2 Relationships with typed domain meaning

#### Recording to Work

A first-class Recording-to-Work relation is required.

It must preserve at minimum:

- Recording UUID;
- Musical Work UUID;
- relationship kind;
- evidence/provenance;
- confidence or verification state;
- review state;
- temporal/supersession history where the assertion changes.

The relationship must support more than a one-to-one assumption. Medleys,
adaptations, samples, and compound works are not grounds for flattening a
Recording and Work into the same identity.

Do not use `registry_entity_relationships` as the sole canonical authority for
this relation. That table may project or describe graph context, but
Recording-to-Work is a core music-domain relationship whose FK integrity should
be database-enforceable.

#### Person / Organisation to Artist Persona

This relationship is governed identity evidence.

A Person or Organisation may underlie, control, participate in, or be associated
with an Artist persona, but those meanings are not interchangeable.

No name-similarity process may promote this link automatically.

### 13.3 Contribution semantics

Contribution is an earned shared behavior, but the first physical schema should
preserve the two domain contexts instead of forcing a generic polymorphic row.

#### Recording Contribution

Examples:

- primary or featured performance;
- instrumental performance;
- producer;
- recording engineer;
- mixer;
- mastering engineer;
- conductor;
- session musician;
- other recording-session roles.

A Recording Contribution should be able to reference:

- the Recording UUID;
- a Person or Organisation when the underlying contributor is known;
- an Artist persona when the credited public identity is material;
- `credited_as`;
- role vocabulary;
- instrument or contribution detail;
- contribution order when meaningful;
- evidence, review, provenance, validity, and supersession.

The existing `registry_track_artists` remains public billing/presentation
authority and must not be silently reinterpreted as complete session credits.

#### Work Contribution

Examples:

- composer;
- lyricist;
- songwriter;
- arranger;
- adaptor;
- translator where the Work model requires it.

A Work Contribution should reference the Musical Work and the canonical Person
or Organisation responsible for the role. An Artist persona may be retained as
a credited/public identity, but it does not replace the underlying contributor
identity when that identity is known.

The existing `registry_authors` table is editorial/content authorship and must
not be reused as music Work authorship.

A later shared Contribution kernel may be earned only after Recording and Work
contribution workflows prove that their lifecycle and authority are genuinely
the same. Do not pre-abstract them now.

### 13.4 Rights Claim semantics

Rights Claim is an earned cross-domain primitive because the same lifecycle
applies to Work-side and Recording-side assertions:

`assertion -> evidence -> reconciliation -> canonical/resolved state`.

The physical design should prefer database-enforced typed references rather
than a generic `subject_type + subject_id + party_id` tuple.

A claim should carry exactly one subject:

- Recording UUID; **or**
- Musical Work UUID.

A claimant should be exactly one canonical identity:

- Person UUID; **or**
- Organisation UUID.

Artist persona is presentation identity and is not sufficient as the legal
claimant when the underlying claimant is known.

Minimum semantic fields:

| Field | Meaning |
| --- | --- |
| rights domain | Recording-side or Work-side |
| right/share type | controlled vocabulary with standard mapping |
| territory scope | explicit territory set, worldwide marker, or unknown |
| usage scope | the uses to which the claim applies |
| valid from / valid to | temporal truth, not overwrite history |
| share state | known / unknown / disputed / not-applicable |
| share percentage | high-precision value only when known |
| control type | owner, controller, administrator, publisher, collecting agent, etc. as applicable |
| claim status | asserted / supported / verified / disputed / superseded / rejected |
| source/evidence | mandatory provenance |
| review state | governed reconciliation |
| supersession | non-destructive correction lineage |

Rules:

- unknown percentage is NULL plus explicit `unknown` state, never zero;
- zero is a real asserted numerical value and must remain distinguishable;
- conflicting claims may coexist;
- the assertion universe may exceed 100 percent while disputed;
- a resolved allocation may impose domain-specific coherence separately;
- no financial payable, receivable, balance, or settlement amount belongs in
  this primitive.

### 13.5 External identifier semantics

The external-identifier concept is shared, but its physical primitive is not yet
sealed because WAKILISHA already has domain-specific provider identity
authorities.

Before adding a generic table, the implementation design must reconcile:

- `registry_track_provider_links`;
- provider IDs embedded in current Registry metadata;
- `provider_entity_links`;
- `registry_provider_sources`;
- the Registry entity index;
- Person and Organisation identity outside the Registry schema;
- evidence/provenance requirements;
- conflicting identifier assertions.

Required semantics regardless of physical design:

| Property | Requirement |
| --- | --- |
| scheme | typed scheme such as ISRC, ISWC, ISNI, IPI, IPN, GTIN, Apple, Spotify |
| value | preserved source value plus canonical comparison form where defined |
| issuer / namespace | explicit when the scheme requires it |
| subject | canonical WAKILISHA UUID identity |
| assertion status | candidate / accepted / disputed / rejected / superseded |
| verification | method, actor, timestamp |
| source | exact evidence/provenance |
| validity | temporal bounds when applicable |
| conflict | representable without deleting either identity |

No global uniqueness constraint should be introduced merely because an external
standard intends uniqueness. WAKILISHA must be able to represent incorrect,
duplicate, stale, or disputed external assignments so that they can be
reconciled.

### 13.6 Release classification

Release identity and Release classification remain separate.

`single`, `ep`, and `album` are classifications of a Release UUID, not
different entity classes.

The current WAKILISHA 1 / 2-6 / 7+ taxonomy remains accepted operational
classification authority until deliberately changed.

A future source-declared Release type should be retained independently from a
WAKILISHA inferred packaging class when both are useful. One must not silently
overwrite the provenance of the other.

### 13.7 Master semantics

"Master" is not a new root entity.

The architecture must distinguish:

1. Sound Recording identity — `registry_tracks.id`;
2. master or derivative media asset — `registry_media_assets.id`;
3. master-side rights/control — Rights Claim against the Sound Recording.

A remaster, radio edit, instrumental, stem, or alternate mix may require a new
Sound Recording identity, a new Media Asset, or both depending on whether the
underlying Recording identity changes. That decision is evidence-governed and
must not be inferred from a filename.

### 13.8 Unknown, disputed, and temporal truth

The data dictionary reserves distinct meanings for:

- unknown;
- not applicable;
- asserted;
- supported;
- verified;
- canonical/resolved;
- disputed;
- rejected;
- superseded;
- historical.

Do not collapse these into nullable booleans or zero values.

Corrections should preserve prior assertions and effective-time history rather
than destructively rewrite source memory.

## 14. Physical-schema guardrails before implementation

Any candidate schema for this foundation must satisfy all of these before a
Production migration is considered:

1. primary keys are WAKILISHA UUIDs;
2. external identifiers are not primary keys;
3. Person and Organisation reuse existing editorial authority;
4. no generic Party table is introduced;
5. core domain joins use real foreign keys where PostgreSQL can enforce them;
6. polymorphic `type + id` references are avoided for core Work, Recording,
   Contribution, and Rights authority when typed FKs can express the model;
7. evidence subject vocabulary is extended deliberately for each new authority,
   not replaced with an unrestricted text field;
8. RLS and grants are explicit for every new public table;
9. canonical writers use the existing Registry exact-operation / evidence /
   verification lifecycle rather than direct browser DML;
10. old assertions and superseded relationships remain reconstructable;
11. percentage precision is not silently rounded;
12. no table claims to be a financial ledger unless it obeys the separate
    append-oriented money doctrine;
13. standards adapters can map into and out of the model without becoming its
    source of canonical identity.

