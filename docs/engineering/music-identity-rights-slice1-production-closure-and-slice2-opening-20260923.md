# Music Identity & Rights Foundation — Slice 1 Production Closure and Slice 2 Opening Authority

Date: 23 September 2026

Status: **SLICE 1 PRODUCTION CLOSED / SLICE 2 OPEN FOR DESIGN + PREVIEW PROOF ONLY**

Programme authority:

- issue #1039 — `Music Identity & Rights Foundation — UUID Charts, Works, Contributions, Rights`;
- binding architecture checkpoint — `docs/engineering/wakilisha-music-data-standards-foundation.md`;
- Slice 1 implementation PR #1042 — `Make Chart scoring authoritative on Registry Track UUIDs`.

This record is the forward authority after Slice 1 Production closure. It preserves the exact accepted Chart UUID state, records the primary-source standards review completed before Slice 2, freezes the live WAKILISHA seams Slice 2 must reuse, and defines the design-only opening boundary for Musical Work, Recording-to-Work, Contribution, Rights Claim, and external identifier assertions.

It does not authorize Production schema mutation.

## 1. Exact accepted authority

Protected repository `main`:

`3b5dcee62134f6d96a2534dcdca3b897c9f4c5ed`

PR #1042:

- merged;
- feature head: `198863279c1d2cb647d024e0da9009ae715c6647`;
- merge commit: `3b5dcee62134f6d96a2534dcdca3b897c9f4c5ed`.

Production database:

- project ref: `pgzizndxdyhqmtyywjmt`;
- migration count: `173`;
- migration head: `20260923063254_chart_uuid_identity_authority_v1`;
- migration filename: `supabase/migrations/20260923063254_chart_uuid_identity_authority_v1.sql`;
- candidate migration SHA-256: `48978a55e2bbc3d5cce054a8b0ddf162d657fc147a4092c0fb289acff6bab621`;
- post-promotion pending repository migrations: `0`;
- permanent verifier: `scripts/control-plane/verify-registry-chart-materialization-runtime.sql`;
- Production verifier result: PASS.

Production Edge runtime:

- function: `chart-ingest-api`;
- status: `ACTIVE`;
- version: `94`;
- `verify_jwt = true`;
- deployed bundle SHA-256: `268942b7b9f117f248573d122b2504009d08d12017cb40b5f2f4b0333871aa2e`.

The live v94 runtime contains the Slice 1 action wiring for:

- `run_canonical_match`;
- `run_entity_resolution`.

The disposable Slice 1 Preview was retired after Production acceptance:

- Preview project ref: `wawolslzeeyicqixqutk`;
- Preview branch id: `e221940b-ac6e-4bca-8576-7caf250710b3`.

Current Supabase branch state contains only the default Production `main` branch.

The merged remote feature branch `fix/chart-uuid-identity-authority-v2` and its disposable local clone were also removed after closure.

## 2. Slice 1 exit conclusion

Slice 1 is accepted as Production closed.

The active Chart ingest path now treats Registry Track UUID as canonical ranking identity. The accepted boundary is:

```text
source fetch
  -> observation normalization
  -> canonical Registry Track matching
  -> entity / lineage resolution
  -> carry-forward / continuity
  -> eligibility
  -> methodology scoring
  -> anti-gaming
  -> shortlist
  -> commit / publish
```

The governing invariants are:

1. resolved Chart evidence aggregates by Registry Track UUID;
2. distinct Registry Track UUIDs do not collapse because title + Artist text match;
3. multiple provider/identifier observations that resolve to one Registry Track UUID fold to one canonical candidate;
4. unresolved, conflicting, split, retired, or otherwise non-current identity does not silently rank;
5. `normalized_key` remains matching, presentation, search, and diagnostic evidence only;
6. previous-edition continuity and carry-forward use canonical Track identity;
7. manual review decisions preserve evidence and invalidate downstream stages when identity authority changes;
8. Registry materialization remains governed and is not smuggled into scoring or dry-run execution;
9. Chart commit/re-ingest remains projection-only with respect to new Registry identity creation.

The Slice 1 correction did not change scoring weights, methodology, source policy, or anti-gaming policy.

## 3. Primary-source standards review completed before Slice 2

The following primary sources were reviewed on 23 September 2026 before any Slice 2 schema design.

### 3.1 DDEX identifier guidance

DDEX states that ISRC should not be used as a database primary key. Its guidance explicitly recommends internally generated identity because received external identifiers may be incorrect, duplicated, operationally ambiguous, or insufficient to distinguish local objects. DDEX states that the same principle applies to ISWC, GRid, and other creation identifiers.

Source:

https://kb.ddex.net/implementing-each-standard/best-practices-for-all-ddex-standards/guidance-on-identifiers%2C-iso-codes-lists-and-dates/use-of-isrcs-as-the-primary-database-key

WAKILISHA decision:

**WAKILISHA UUID remains canonical identity. External identifiers remain assertions/evidence and interoperability keys.**

### 3.2 ISRC

The International ISRC Registration Authority defines ISRC as an identifier for sound recordings and music video recordings. It is not an identifier for musical compositions, releases/products, or performers.

Sources:

- https://isrc.ifpi.org/
- https://isrc.ifpi.org/why-use-isrc/when-not-to-assign
- https://isrc.ifpi.org/images/downloads/ISRC_Handbook.pdf

WAKILISHA decision:

`registry_tracks.id` remains canonical Sound Recording identity. ISRC attaches to that Recording authority and never replaces the WAKILISHA UUID.

### 3.3 ISWC

The ISWC system identifies musical works. Its official guidance states that ISWC does not identify recordings and does not encode composer/copyright-owner shares. It also allows assignment errors to be reconciled through merge/separation processes.

Sources:

- https://www.iswc.org/iswc
- https://www.iswc.org/cmos

WAKILISHA decision:

Musical Work is a distinct canonical entity with a WAKILISHA UUID. ISWC is an external identifier attached to Work identity, not Work identity itself and not a rights-share record.

### 3.4 ISNI

ISO 27729:2024 defines ISNI for the identification of public identities of parties across media/content industries and for disambiguating public identities.

Source:

https://www.iso.org/standard/87177.html

WAKILISHA decision:

ISNI reinforces rather than erases WAKILISHA's existing distinction between:

- `editorial.people` — natural-person authority;
- `editorial.organizations` — organisation authority;
- `registry_artists` — public music persona / Artist authority.

No generic new Party table is earned.

### 3.5 DDEX Artist / Contributor separation

DDEX ERN 4 distinguishes the public Artist brand from the Party or Parties who wrote or performed the music. DDEX ERN and RIN support explicit contributor roles, instruments, and display credits.

Sources:

- https://kb.ddex.net/implementing-each-standard/electronic-release-notification-message-suite-%28ern%29/ern-4-explained/differences-between-ern-3-and-ern-4/
- https://kb.ddex.net/implementing-each-standard/best-practices-for-all-ddex-standards/guidance-on-contributors%2C-artists-and-writers/artist-roles-and-displaycredits/

WAKILISHA decision:

Public Artist billing/brand authority must remain distinct from the underlying Person or Organisation contributor when that underlying identity is known.

### 3.6 DDEX RDR rights conflicts

DDEX RDR covers recording data, contributors, and recording-side rights claims. RDR-RCC explicitly models conflicts where claims over the same rights exceed 100%.

Sources:

- https://kb.ddex.net/implementing-each-standard/recording-data-and-rights-standards-%28rdr%29/
- https://kb.ddex.net/implementing-each-standard/recording-data-and-rights-standards-%28rdr%29/recording-data-and-rights-claim-conflict-%28rdr-rcc%29

WAKILISHA decision:

Rights Claim is an assertion/reconciliation authority, not a uniqueness-enforced percentage allocation table. Conflicting claims must remain representable. Unknown share is not zero.

### 3.7 DDEX Entity Cluster semantics

DDEX ECM Part 3 communicates cases where multiple ISRCs are believed to identify one Sound Recording. The standard treats this as an assessed statement, not automatic adjudication or identifier replacement.

Source:

https://kb.ddex.net/implementing-each-standard/entity-cluster-message-suite-%28ecm%29/ecm-part-3-duplicate-isrc-clusters/

WAKILISHA decision:

External identifier conflicts and duplicate assignments must not force destructive canonical collapse. WAKILISHA identity lineage/review remains authoritative.

### 3.8 CISAC CWR

CISAC defines Common Works Registration as a standard format for registration of musical works, including the data required for publishers to register works with performance or mechanical-rights societies.

Source:

https://www.cisac.org/formats

WAKILISHA decision:

CWR is an interoperability boundary for Work metadata/registration. It is not a WAKILISHA persistence model.

### 3.9 ISO 8000 identifier quality

ISO 8000-115:2024 addresses the syntax and semantics of quality identifiers, including unambiguous identification of identifier ownership and principles for identifier resolution.

Source:

https://www.iso.org/standard/88847.html

WAKILISHA decision:

Any external identifier assertion model must preserve scheme/namespace/issuer semantics and resolution context. A bare value column is insufficient as universal identifier authority.

### 3.10 ISO/IEC 11179 metadata governance

ISO/IEC 11179-1:2023 provides the framework for understanding metadata and metadata registries.

Source:

https://committee.iso.org/standard/78914.html

WAKILISHA decision:

The WAKILISHA music data dictionary is the semantic authority for new fields, controlled vocabularies, unknown semantics, standard mappings, and deprecation/supersession rules. The ISO model informs governance; it does not require an ISO-shaped physical database.

### 3.11 W3C PROV

W3C PROV models provenance using Entities, Activities, Agents, derivation, usage, generation, attribution, and responsibility.

Sources:

- https://www.w3.org/TR/prov-overview/
- https://www.w3.org/TR/prov-primer/

WAKILISHA decision:

Existing WAKILISHA evidence, provenance, canonical write events, review, and lineage remain relational authority. PROV semantics inform interoperability and vocabulary. No RDF migration is implied.

## 4. Live Production authority Slice 2 must reuse

The opening audit was read-only. No Production row or schema was mutated.

### 4.1 Existing canonical identities

Current authority already exists for:

- Person — `editorial.people`;
- Organisation — `editorial.organizations`;
- Artist persona — `public.registry_artists`;
- Sound Recording — `public.registry_tracks`;
- Release — `public.registry_releases`;
- Label — `public.registry_labels`;
- Media Asset — `public.registry_media_assets`.

`editorial.organization_registry_label_links` already provides the governed Organisation-to-Label bridge.

These identities must not be duplicated by Slice 2.

### 4.2 Existing public Artist billing credits are not complete music contributions

`public.registry_track_artists` and `public.registry_release_artists` are existing public billing/presentation relationships.

They support concepts such as:

- Artist UUID or text fallback;
- role;
- primary / featured flags;
- credit order;
- display credit;
- source/confidence/status.

They must not be reinterpreted as a complete session, Work-writing, production, engineering, or rights contributor model.

### 4.3 Existing editorial credits are not the music Contribution kernel

Production also contains:

- `editorial.credit_roles`;
- `editorial.credits`;
- `editorial.credit_governance`;
- `editorial.external_contributors`;
- `editorial.resource_credits`.

Current `editorial.credit_roles` are editorial/media roles such as Author, Editor, Curator, Researcher, Interviewer, Producer, Host, Guest, Camera, Audio, Translator, Photographer, Contributor, Reviewer, Fact checker, and Other.

Current binding footprint:

- `editorial.credits`: 20 rows;
- `editorial.credit_governance`: 20 rows;
- `editorial.resource_credits`: 218 rows;
- `editorial.external_contributors`: 1 row.

The 218 current resource-credit bindings target:

- 208 Article versions;
- 9 Playlist versions;
- 1 Audio publication version.

Therefore the existing editorial credit subsystem is publication/editorial authority, not Recording/Work music-credit authority.

Slice 2 must not stretch it into a universal contribution table.

### 4.4 Existing provider-link authority

Production currently contains:

`public.provider_entity_links`

- 212 rows;
- current live entity usage: Track;
- providers observed: Apple Music, SoundCloud, Spotify, YouTube;
- current statuses observed: confirmed, superseded.

`public.registry_track_provider_links`

- 332 rows;
- current provider usage: Apple Music;
- current statuses observed: matched, needs_review;
- typed FK to Registry Track;
- unique provider identity on `(provider_key, provider_track_id)`.

Provider-link authority is operational provider identity binding. It should remain authoritative for provider IDs.

A future external-identifier assertion authority must compose this surface rather than replace it.

### 4.5 Existing evidence and exact-operation authority

`platform_private.registry_evidence_assertions` already provides:

- immutable UUID assertion identity;
- typed subject type/id;
- claim key + bounded JSON payload;
- trust class;
- source kind/ref;
- source payload fingerprint;
- observation time;
- principal attribution;
- assertion fingerprint.

The current evidence subject vocabulary is exactly:

- `artist`;
- `track`;
- `release`;
- `registry_relationship`;
- `track_artist_credit`;
- `release_track_membership`;
- `release_artist_credit`.

The same seven subject types are currently enforced for:

- `platform_private.registry_execution_grant_targets`;
- `platform_private.registry_review_cases`.

Slice 2 must extend these vocabularies deliberately rather than replace the control plane with unrestricted polymorphic text.

### 4.6 Existing exact-grant / mutation control plane

Production already has:

- `platform_private.registry_operation_types`;
- `platform_private.registry_execution_grants`;
- `platform_private.registry_execution_grant_targets`;
- `platform_private.registry_mutation_operations`;
- shared Registry review authority;
- canonical write events;
- identity lineage.

Current operation families already cover governed Artist/Track/Release creation, provider facts, exact-set replacement, Track credit admission/reconciliation, duplicate repair, discography, and related Registry actions.

Slice 2 should add only operations genuinely required by the new domain authorities. It must not introduce browser-side direct DML or ambient mutation authority.

### 4.7 Existing generic relationship graph is not core Recording-to-Work authority

`public.registry_entity_relationships` currently has 165 rows.

Observed entity types:

- source: Artist, Track;
- target: Artist, Release, Track.

Observed relationship types include:

- `appeared_on`;
- `collaborated_with`;
- `collaboration`;
- `featured_on`;
- `features`;
- `popular_track`.

This is useful graph/presentation context, but it is not sufficient as the sole canonical Recording-to-Work authority.

Recording-to-Work is a core music-domain relationship and must use typed database-enforced foreign keys.

The generic relationship graph may later project that relation for graph/navigation use.

### 4.8 Existing provenance and lineage

Current Production contains:

- `registry_provenance_links`: 6,332 rows;
- `registry_canonical_write_events`: 1,473 rows;
- `registry_identity_lineage`: 202 rows.

Current provenance links are heavily specialized around chart-entry artwork/media migration.

Canonical write events already cover Artist, Chart Entry, Release, and Track mutations.

Identity lineage currently covers Artist and Track with merge/split/supersede transitions.

Slice 2 should extend event and lineage vocabularies only where new canonical Work or related identity history genuinely requires them.

## 5. Slice 2 physical design boundary

Slice 2 may now design and Preview-prove the following earned authorities.

### 5.1 Musical Work

Create a first-class canonical Musical Work authority with a WAKILISHA UUID.

Minimum semantic requirements:

- Work UUID;
- canonical title plus provenance-aware alternate/title observations where needed;
- lifecycle/status;
- metadata with bounded purpose;
- created/updated audit fields;
- explicit evidence/review path;
- compatibility with ISWC without making ISWC identity.

No Production table name is sealed by this record. The migration design must first prove replay, RLS/grants, evidence vocabulary, and operation authority.

### 5.2 Recording-to-Work

Create a typed relation with real FKs to:

- Registry Track UUID;
- Musical Work UUID.

It must support more than a one-to-one assumption.

Minimum semantics:

- relationship kind;
- assertion/review status;
- provenance/evidence;
- confidence/verification where applicable;
- temporal/supersession history.

Do not use `registry_entity_relationships` as the sole canonical authority.

### 5.3 Recording Contribution

Recording Contribution is separate from public Track Artist billing.

The first design must support:

- Track UUID;
- underlying Person and/or Organisation where known;
- Artist persona when credited public identity is material;
- credited-as/display string;
- controlled role vocabulary;
- instruments/details;
- ordering where meaningful;
- evidence;
- review;
- validity/supersession.

Do not prematurely create one universal polymorphic Contribution table.

### 5.4 Work Contribution

Work Contribution must support roles such as:

- composer;
- lyricist;
- songwriter;
- arranger;
- adaptor;
- translator where appropriate.

The canonical underlying contributor should resolve to existing Person or Organisation authority when known.

Artist persona may be retained as credited/public identity but must not replace the underlying identity.

### 5.5 Rights Claim

Rights Claim may be shared across Recording-side and Work-side domains only if the physical design preserves typed database-enforced subjects.

A claim must have exactly one subject:

- Track UUID; or
- Work UUID.

A claimant must have exactly one canonical claimant authority:

- Person UUID; or
- Organisation UUID.

Minimum semantics:

- rights domain;
- right/share type;
- territory scope;
- usage scope;
- valid-from / valid-to;
- share state;
- high-precision percentage only when known;
- control type;
- claim status;
- source/evidence;
- review state;
- supersession lineage.

Required truth rules:

- unknown share = explicit unknown state + NULL percentage;
- zero is a real numerical assertion, distinct from unknown;
- conflicting assertions may coexist;
- unresolved claims may exceed 100%;
- financial payable/receivable/balance/settlement fields do not belong here.

### 5.6 External identifier assertions

The concept is earned, but this record does **not** authorize a speculative universal identifier table.

The Preview design must first reconcile:

- `registry_track_provider_links`;
- `provider_entity_links`;
- hot-path `registry_tracks.isrc`;
- hot-path `registry_releases.upc`;
- provider metadata;
- `platform_private.registry_evidence_assertions`;
- future Work ISWC;
- Person/Organisation/Artist public-identity identifiers.

Required semantics regardless of physical design:

- scheme;
- preserved source value;
- comparison-normalized value where the scheme defines one;
- issuer/namespace where applicable;
- canonical WAKILISHA subject;
- assertion status;
- verification method/actor/time;
- source evidence;
- validity where applicable;
- conflict/supersession history.

Do not introduce global uniqueness merely because an external standard intends uniqueness. The system must retain incorrect, duplicate, disputed, or stale assignments long enough to reconcile them.

Provider operational bindings may maintain stricter accepted-state uniqueness where that is already an earned invariant.

## 6. Scope locks

Slice 2 must not:

- create a generic `registry_parties` table;
- turn Artist into Person or Organisation;
- turn Release into Recording or Work;
- reinterpret existing public Artist billing as complete contributor authority;
- reinterpret editorial publication credits as music-credit authority;
- use a generic `subject_type + subject_id + party_id` tuple where typed FKs can enforce core rights truth;
- create a generic percentage table;
- make ISRC, ISWC, ISNI, IPI, IPN, UPC/EAN/GTIN, DPID, or provider ID a WAKILISHA primary key;
- impose destructive global uniqueness on external identifier assertions;
- copy DDEX, CWR, RDR, RIN, or other exchange-message structures into persistence;
- add royalty calculation, settlement, payable balances, or payment ledger fields;
- expose direct browser DML to the new authorities;
- grant MIZIZI autonomous new mutation authority merely because the schema exists;
- run destructive historical backfill;
- fuzzy-link Person, Organisation, Artist, Work, or rights claims from name similarity;
- mutate Production during the opening design gate.

## 7. Required Slice 2 Preview proof

Before any Production migration is considered, one clean disposable Preview must prove:

1. complete baseline migration replay;
2. candidate migration applies from exact accepted `main`;
3. typed FK integrity for Work, Recording-to-Work, Contribution, and Rights Claim;
4. explicit RLS/grant posture for every exposed table;
5. extension of evidence/grant/review subject vocabularies without weakening current constraints;
6. no ambient browser write authority;
7. no new generic Party table;
8. no external identifier as canonical primary identity;
9. unknown rights share remains distinguishable from zero;
10. conflicting rights assertions can coexist;
11. disputed external identifier assignments can coexist without destructive identity collapse;
12. current Track/Release/Artist/Person/Organisation authorities remain intact;
13. current Chart UUID authority remains intact;
14. exact-operation/evidence/review/journal integration is independently verifiable;
15. migration replay proof is sealed before PR merge.

Any first runtime mutation broker for these entities is a separate acceptance surface from the schema itself and must be proved independently.

## 8. Immediate next engineering action

The next action is a **schema-design and read-only candidate phase**, not Production mutation.

Produce:

- exact proposed tables/constraints/FKs;
- role and status vocabularies;
- evidence subject vocabulary extensions;
- exact operation catalogue additions;
- RLS/grant design;
- write-path authority;
- verifier design;
- migration replay plan;
- minimum candidate fixtures for Preview;
- rollback/retirement implications;
- confirmation that no current authority is duplicated.

Only after that design is reviewed should a migration file be created.

## 9. Deployment classification

For this record:

- SQL migration needed: **No**
- Supabase Edge Function deploy needed: **No**
- Production Finish update needed: **No**
- frontend deploy needed: **No**
- Production data mutation: **No**

This is documentation-only closure/opening authority.
