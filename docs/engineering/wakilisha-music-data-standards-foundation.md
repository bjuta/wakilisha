# WAKILISHA Music Data Standards Foundation

**Status:** Binding engineering architecture checkpoint  
**Authority date:** 23 September 2026  
**Repository baseline:** `ee52a276f61ff93aff948d2a2ff2be796c3e5312`  
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
- do not rank it as a canonical Track until resolution succeeds.

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
