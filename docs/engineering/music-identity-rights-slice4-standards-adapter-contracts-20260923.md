# Music Identity & Rights Slice 4 Standards Adapter Contracts

Date: 23 September 2026

Status: **DESIGN AUTHORITY - NO RUNTIME OR PRODUCTION MUTATION AUTHORIZED**

Programme authority:

- issue #1039;
- `docs/engineering/wakilisha-music-data-standards-foundation.md`;
- `docs/engineering/wakilisha-music-data-dictionary-v1.md`;
- `docs/engineering/music-identity-rights-slice3-production-closure-and-slice4-opening-20260923.md`;
- protected main at design open: `fbff84ab493b67bd023cc246b78bc443f5021d65`.

The governing rule is:

**standards are interoperability boundaries; WAKILISHA-owned canonical identity, evidence, review, provenance, and mutation authority remain internal.**

This document defines mapping and adapter contracts. It does not implement a parser, exporter, network exchange, or canonical writer.

## 1. Primary-source standards snapshot

The following primary sources were reviewed for this design.

### DDEX

Current DDEX standards index:

https://kb.ddex.net/reference-material/standards-specifications/

Relevant current versions in that index:

- ERN Part 1: 4.3.2;
- ERN Release Profiles: 2.3.1;
- RIN: 2.1;
- MWN Part 1: 1.3.1;
- MWN Part 2 profiles: 1.0;
- BWARM: 2.1;
- RDR-C: 1.1;
- RDR-N: 1.5;
- RDR-R: 1.1;
- RDR-RCC: 1.0;
- DDEX Data Dictionary Standard: 1.0;
- DDEX Data Dictionary Governance Standard: 1.0;
- DDEX Party Identifier Standard: 1.0.1;
- DDEX Party Identifier Governance Standard: 1.0.

ERN purpose and current-version guidance:

https://kb.ddex.net/implementing-each-standard/electronic-release-notification-message-suite-%28ern%29/

RIN purpose:

https://kb.ddex.net/implementing-each-standard/recording-information-notification-%28rin%29/

MWN:

https://kb.ddex.net/implementing-each-standard/musical-work-data-and-rights-communication-%28mwdr%29/musical-work-right-share-notification-standard-%28mwn%29/

BWARM:

https://kb.ddex.net/implementing-each-standard/musical-work-data-and-rights-communication-%28mwdr%29/bulk-communication-of-work-and-recording-metadata-%28bwarm%29/

RDR:

https://kb.ddex.net/implementing-each-standard/recording-data-and-rights-standards-%28rdr%29

RDR claim conflicts:

https://kb.ddex.net/implementing-each-standard/recording-data-and-rights-standards-%28rdr%29/recording-data-and-rights-claim-conflict-%28rdr-rcc%29

ECM duplicate ISRC clusters:

https://kb.ddex.net/implementing-each-standard/entity-cluster-message-suite-%28ecm%29/ecm-part-3-duplicate-isrc-clusters/

DDEX data dictionaries:

https://kb.ddex.net/reference-material/data-dictionaries/

### ISRC

International ISRC Agency:

https://isrc.ifpi.org/

ISRC identifies sound recordings and music videos. It does not identify musical works, releases/products, or performers.

### ISWC

ISWC authority:

https://www.iswc.org/iswc

ISWC identifies musical works, not recordings, products, or rights shares.

ISWC usage:

https://www.iswc.org/iswc-usage

### ISNI

ISO 27729:2024:

https://www.iso.org/standard/87177.html

ISNI identifies public identities of parties and supports disambiguation across creative industries.

### IPI

CISAC IPI:

https://www.cisac.org/services/information-services/ipi

IPI identifies natural persons and legal entities with interests in works and related rights-management roles.

### IPN

SCAPR:

https://www.scapr.org/about-us/

SCAPR describes the International Performer Number as its unique performer identifier in the International Performer Database.

### GTIN / UPC / EAN

GS1 GTIN:

https://support.gs1.org/support/solutions/articles/43000734404-what-is-the-global-trade-item-number-gtin-

GTIN identifies trade items. UPC is GTIN-12 and EAN is GTIN-13 in common GS1 usage:

https://support.gs1.org/support/solutions/articles/43000734124-what-is-the-difference-between-a-gs1-gtin-a-barcode-an-ean-and-a-upc-

### CWR

CISAC formats:

https://www.cisac.org/formats

CWR is a standard format for musical-work registration and registration-status communication between publishers and rights societies.

### ISO data governance

ISO 8000-115:2024:

https://www.iso.org/standard/88847.html

This standard covers syntactic, semantic, ownership, and resolution requirements for quality identifiers.

ISO/IEC 11179-1:2023:

https://www.iso.org/standard/78914.html

This standard provides the framework for understanding metadata and metadata registries.

### W3C PROV

W3C PROV overview:

https://www.w3.org/TR/prov-overview/

PROV provides interoperable semantics for entities, activities, agents, derivation, attribution, usage, generation, and provenance exchange.

## 2. Adapter architecture

Every standards adapter has four distinct layers:

```text
external payload / identifier
  -> syntax parser
  -> semantic mapper
  -> WAKILISHA candidate/evidence model
  -> governed canonical operation, only when separately authorized
```

The parser and mapper have no canonical mutation authority.

An adapter may:

- parse;
- validate;
- normalize only according to explicit standard rules;
- retain source values;
- map external terms to WAKILISHA concepts;
- produce candidate assertions;
- produce review manifests;
- export already-authorized WAKILISHA data.

An adapter may not:

- create canonical identity because an external message contains an identifier;
- merge canonical entities;
- resolve disputed rights;
- overwrite retained source evidence;
- call unrestricted generic mutation;
- bypass Registry grants, expected-state fingerprints, review, write events, or verifiers.

## 3. Common adapter envelope

Any future executable adapter should emit or consume a WAKILISHA-owned envelope with at least:

| Field | Meaning |
| --- | --- |
| `adapter_key` | stable WAKILISHA adapter family |
| `adapter_version` | WAKILISHA contract version |
| `external_standard` | source or target standard family |
| `external_version` | exact standard/message version |
| `message_or_record_type` | source structural type |
| `source_party` | sender/source identity when known |
| `source_reference` | message/file/record reference |
| `observed_at` | ingestion observation time |
| `payload_fingerprint` | immutable payload or record fingerprint |
| `mapping_profile` | exact mapping profile/version |
| `mapping_result` | mapped / partial / review_required / rejected |
| `loss_flags` | explicit lossy or unsupported distinctions |
| `candidate_refs` | resulting WAKILISHA candidate/evidence references |

This envelope is an integration contract, not a new canonical domain table requirement.

## 4. Identifier adapter contract

### ISRC

External concept:

- sound recording or music video recording identifier.

WAKILISHA mapping:

- `registry_external_identifier_assertions.scheme_key='isrc'`;
- typed Track subject;
- existing `registry_tracks.isrc` may remain a hot-path projection;
- source value retained exactly;
- scheme-valid comparison form may be stored separately.

Must not:

- use ISRC as Track UUID;
- force merge because two Track UUIDs carry the same ISRC;
- delete disputed or superseded assignments.

ECM duplicate-ISRC data may become evidence for review but does not independently adjudicate WAKILISHA identity.

### ISWC

External concept:

- Musical Work identifier.

WAKILISHA mapping:

- external identifier assertion against `registry_works.id`.

Must not:

- identify a Track;
- encode creator shares;
- imply copyright ownership or authorization;
- create a Work solely from an ISWC without a separately authorized Work-admission workflow.

### ISNI

External concept:

- public identity of a party.

WAKILISHA mapping is evidence-dependent:

- Artist persona when the ISNI identifies the public music identity;
- Person when evidence identifies the natural person's public identity;
- Organisation when evidence identifies the organisation's public identity.

An adapter must not collapse Artist, Person, and Organisation because the same source message references one party block.

### IPI

External concept:

- interested party in the musical-work rights ecosystem.

WAKILISHA mapping:

- Person or Organisation external identifier assertion;
- contributor or claimant relationship mapped separately.

An IPI does not itself create a Rights Claim.

### IPN

External concept:

- performer identifier.

WAKILISHA mapping:

- Person external identifier assertion after performer identity resolution;
- Recording Contribution mapped separately.

Do not attach an IPN to Artist persona when the underlying performer Person is known.

### GTIN / UPC / EAN

External concept:

- trade item/product identifier.

WAKILISHA mapping:

- Release external identifier assertion where the trade item corresponds to the Release/product context;
- current `registry_releases.upc` may remain a hot-path projection.

UPC and EAN presentation must retain the original source form and the mapped GTIN semantics where relevant.

Do not use product identifiers as Recording identity.

## 5. DDEX ERN mapping

External role:

ERN communicates Releases, resources such as sound recordings, parties, display artists, contributors, and commercial/deal information.

WAKILISHA mapping:

| ERN concept | WAKILISHA concept |
| --- | --- |
| Release | Registry Release candidate/reference |
| SoundRecording resource | Registry Track candidate/reference |
| DisplayArtistName | retained public display/billing evidence |
| DisplayArtist | Artist persona candidate/reference |
| Contributor | Recording or Work Contribution evidence depending on role/context |
| Party | Person/Organisation/Artist identity evidence, not a generic Party row |
| ISRC | Track external identifier assertion |
| product identifier | Release GTIN/UPC/EAN assertion |
| label text | Release label evidence; governed Label link remains separate |
| resource/release image | Media evidence; typed binding remains separate |
| Deal/commercial terms | outside current Slice 4 canonical music foundation unless separately designed |

ERN 4 explicitly distinguishes display Artist brand from contributors. The adapter must preserve that separation.

Do not persist ERN message structure as canonical Registry schema.

## 6. DDEX RIN mapping

External role:

RIN captures recording-session and studio metadata, contributors, roles, instruments, works, technical metadata, and recording context.

WAKILISHA mapping:

| RIN concept | WAKILISHA concept |
| --- | --- |
| recording | Track candidate/reference |
| recording component/stem | Media or future recording-component evidence, not automatically Track identity |
| contributor | Track Contribution evidence |
| composer/writer | Work Contribution evidence only when Work identity exists |
| instrument | `instrument_key` / contribution detail candidate |
| studio event | provenance/activity evidence |
| work/composition | Work candidate/reference, not auto-created |
| ISRC | Track identifier assertion |
| ISWC | Work identifier assertion |
| ISNI/IPI/IPN | typed Person/Organisation/Artist identifier evidence according to scheme |

RIN may be rich enough to support later governed creation workflows, but the adapter itself must stop at evidence/candidate output unless a separate broker is authorized.

## 7. DDEX RDR mapping

External role:

RDR communicates sound recording, performer, neighbouring-rights, mandate, claim, and related rights information.

WAKILISHA mapping:

| RDR concept | WAKILISHA concept |
| --- | --- |
| sound recording | Track |
| performer | Person + Track Contribution where resolved |
| rights controller / claimant | Person or Organisation |
| rights claim | Registry Rights Claim candidate/evidence |
| territory | Rights Claim territory scope |
| usage/right type | controlled Rights Claim vocabulary |
| claim percentage/share | known share only when explicitly supplied and semantically compatible |
| conflict/overclaim | disputed claim state / review evidence |
| ISRC | Track identifier assertion |
| IPN | Person identifier assertion |

RDR-RCC demonstrates that claims may conflict and exceed 100 percent. The adapter must preserve those competing assertions. It must not normalize totals to 100 or delete a conflicting claim.

RDR-R revenue reporting is outside the current persistence boundary for money. Revenue records must not be forced into Rights Claim.

## 8. DDEX MWN and BWARM mapping

External role:

MWN communicates detailed Musical Work rights-share information, while BWARM supports bulk communication of Works, Recordings using those Works, and Work right shares.

WAKILISHA mapping:

| MWN/BWARM concept | WAKILISHA concept |
| --- | --- |
| Musical Work | Work |
| Work identifier | Work external identifier assertion |
| writer/composer | Work Contribution |
| publisher/rightsholder | Organisation/Person plus Rights Claim as evidenced |
| work right share | Rights Claim candidate |
| Recording reference | Track |
| Work-to-Recording relation | Track-to-Work relationship candidate |
| IPI | Person/Organisation identifier assertion |
| ISWC | Work identifier assertion |
| ISRC | Track identifier assertion |

Import must preserve message provenance and claim status. A standards message is not proof that a claim is verified.

## 9. DDEX ECM mapping

ECM communicates entity-cluster assertions, including Musical Work clusters and duplicate ISRC clusters.

WAKILISHA mapping:

- cluster statement -> evidence assertion/review candidate;
- cluster member identifiers -> external identifier assertions/references;
- sender assessment -> provenance;
- verification status -> retained source state, not WAKILISHA canonical merge state.

A cluster does not directly mutate:

- Track UUID identity;
- Work UUID identity;
- identity lineage;
- identifier supersession.

Any merge, split, or supersession remains a separately governed WAKILISHA decision.

## 10. CWR mapping

External role:

CWR communicates Musical Work registration data and registration status between publishers and rights societies.

WAKILISHA mapping:

| CWR concept | WAKILISHA concept |
| --- | --- |
| work | Work candidate/reference |
| work title | Work title evidence |
| writer | Work Contribution evidence |
| publisher | Organisation evidence + Work Contribution or Rights Claim depending on semantics |
| society / registration party | Organisation/source context |
| work identifier | external identifier assertion |
| share / ownership data | Rights Claim candidate |
| registration status | source workflow/evidence state, not WAKILISHA canonical truth |

CWR message records must not become WAKILISHA tables merely because the format contains a field.

CWR export remains explicitly deferred.

## 11. ISO 8000 identifier-quality application

For every identifier mapping, adapter metadata must be sufficient to distinguish:

- identifier scheme;
- identifier owner/issuer or namespace where applicable;
- source value;
- comparison value;
- restrictions or context of use where known;
- resolution method or reference where applicable.

A bare string without scheme and source context is insufficient as universal identifier authority.

## 12. ISO/IEC 11179 metadata-governance application

The WAKILISHA dictionary is the semantic registry for this domain.

Each managed term should have:

- stable name/key;
- definition;
- data type;
- permissible values;
- domain;
- version introduced;
- external mappings;
- null/unknown semantics;
- deprecation/supersession metadata.

ISO/IEC 11179 informs governance. It does not require a new ISO-shaped database.

## 13. W3C PROV mapping

WAKILISHA can export provenance semantics without replacing its relational model.

Conceptual mapping:

| W3C PROV | WAKILISHA |
| --- | --- |
| Entity | source payload, evidence assertion, canonical entity snapshot |
| Activity | ingest, review, canonical operation, verification |
| Agent | user, system actor, provider/source organisation |
| wasDerivedFrom | provenance link / source fingerprint lineage |
| wasAttributedTo | evidence principal / actor attribution |
| used | operation-bound evidence |
| wasGeneratedBy | canonical write event / mutation operation |
| invalidation/supersession | lineage or assertion supersession |

This mapping is for interchange semantics. No RDF storage requirement is introduced.

## 14. Import boundary contract

An import adapter must proceed in this order:

```text
parse
  -> structural validation
  -> source record retention / fingerprint
  -> term mapping
  -> typed identifier extraction
  -> candidate identity resolution
  -> evidence assertion
  -> review_required or deterministic_candidate classification
  -> separately authorized canonical broker, if one exists
```

Fail closed when:

- required source identity is ambiguous;
- external version is unsupported;
- a source role cannot be mapped without semantic loss;
- an identifier syntax is invalid;
- the same source value maps to incompatible WAKILISHA subject classes;
- candidate canonical identity is unresolved;
- expected canonical state changed after candidate generation.

## 15. Export boundary contract

An export adapter may only export:

- canonical data currently authorized for the target purpose;
- retained identifiers with their correct scheme/namespace;
- provenance/status distinctions that the target standard can represent;
- explicit omission or mapping-loss diagnostics when WAKILISHA holds a distinction the target cannot represent.

Export must not:

- fabricate unknown shares;
- infer missing creator identities;
- convert disputed claims to verified claims;
- collapse Person and Artist identity;
- invent ISRC, ISWC, ISNI, IPI, IPN, or GTIN values;
- register identifiers with an external authority;
- claim standards compliance for an unlicensed/untested production exchange.

## 16. Adapter versioning

Adapter versioning is independent from external-standard versioning.

Example:

```text
adapter_key: ddex_ern_import
adapter_version: 1
external_standard: ERN
external_version: 4.3.2
mapping_profile: music-data-dictionary/v1
```

Rules:

- one adapter version may support multiple explicitly tested external versions;
- unsupported versions fail closed;
- mapping changes that alter canonical meaning require a new adapter version;
- adding a parser for a new external patch version may be backward-compatible only if mapping semantics are unchanged;
- every adapter result records its adapter version and external version.

## 17. Mapping-loss contract

Every adapter must classify each mapped field as:

- `exact`;
- `normalized_by_standard_rule`;
- `partial`;
- `unsupported`;
- `review_required`;
- `not_applicable`.

Lossy mapping must never be silent.

If a source distinction has no WAKILISHA concept, retain it in source evidence and mark it unsupported or review-required rather than inventing a canonical field.

## 18. Determinism contract

Given:

- identical source bytes;
- identical adapter version;
- identical mapping profile;
- identical relevant canonical read state;

the parser and semantic mapper must produce the same:

- normalized source representation;
- payload fingerprint;
- mapped terms;
- identifier comparison forms;
- candidate classifications;
- loss flags.

Canonical mutation may still differ if current expected state has changed, because canonical admission is a separate governed step.

## 19. Test strategy

Future adapter implementation must include:

1. golden fixtures from each supported external standard/version;
2. malformed syntax fixtures;
3. unsupported-version fixtures;
4. unknown/omitted/null distinction fixtures;
5. identifier normalization fixtures;
6. Artist versus contributor separation fixtures;
7. Person versus Artist versus Organisation identity fixtures;
8. Track versus Work versus Release identity fixtures;
9. conflicting identifier fixtures;
10. rights overclaim fixtures above 100 percent;
11. disputed/superseded claim fixtures;
12. deterministic repeat mapping;
13. mapping-loss assertions;
14. evidence/provenance fingerprint assertions;
15. proof that parser/mapper code has no direct canonical DML path;
16. export round-trip tests only where the target format can preserve the relevant WAKILISHA distinctions.

Standards conformance validation and WAKILISHA semantic tests are separate gates. Passing an XML/XSD or record-format validator is necessary where applicable but not sufficient for canonical correctness.

## 20. First implementation boundary after this design

The first executable Slice 4 work, if authorized separately, should be a **read-only adapter harness**, not a canonical writer.

It should:

- parse one selected standard/version;
- emit the common adapter envelope;
- map to `music-data-dictionary/v1`;
- retain evidence and mapping-loss diagnostics;
- perform no canonical mutation;
- have deterministic golden fixtures.

Selection of the first external standard must be based on a real WAKILISHA product/data-flow need, not on standards breadth or prestige.

No Production network exchange is authorized by this design.

## 21. Deployment classification

For this design:

- SQL migration: **No**
- Supabase Preview: **No**
- Edge Function: **No**
- frontend: **No**
- Production Finish: **No**
- Production mutation: **No**
- external network integration: **No**
- PR type: **documentation-only**
