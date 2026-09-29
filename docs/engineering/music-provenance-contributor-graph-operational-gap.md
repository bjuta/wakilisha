# Music Provenance — Contributor Graph Operational Gap and Completion Contract

Date: 29 September 2026

Related programmes:

- Public Music Identity: #1068
- Public Music Identity Track actual-zero: #1094
- Music Identity & Rights foundation: #1039

Status: **FORWARD ARCHITECTURE / PRODUCT DECISION — DOCUMENTED, NOT YET IMPLEMENTED**

## Purpose

WAKILISHA must not describe public Artist billing as a complete music-provenance
graph.

The Registry already distinguishes public Artist billing from Recording and Work
Contributions, but the canonical contributor graph is not operational today.

This document records that gap explicitly and defines the completion contract
required before contributor provenance can be treated as a functioning public
moat.

## Current Production truth

Read-only Production audit on 29 September 2026 established:

- `public.registry_track_contributions`: **0 rows**;
- `public.registry_work_contributions`: **0 rows**;
- `public.contributors`: **2 rows**;
- `registry.track_contribution.admit/v1`: **disabled**;
- `registry.work_contribution.admit/v1`: **disabled**.

The generic `public.contributors` table is not the canonical Recording or Work
Contribution authority.

The canonical music contribution authorities are:

- Recording Contribution:
  `public.registry_track_contributions.id`;
- Work Contribution:
  `public.registry_work_contributions.id`.

The Music Identity & Rights foundation correctly installed those concepts and
their schema/control-plane boundaries, but it did not populate an operational
contribution graph.

Therefore the current state is:

> contributor-capable schema foundation, but no canonical Recording or Work
> Contribution instances in Production.

This is materially different from having an operational music-provenance graph.

## Existing conceptual authority remains correct

The accepted music data dictionary already distinguishes:

- Artist persona;
- Person;
- Organisation;
- Sound Recording;
- Musical Work;
- Release;
- Recording Contribution;
- Work Contribution;
- Rights Claim.

It also explicitly states that public Track Artist billing must not be treated
as the complete Recording Contribution set.

That distinction is now binding for the public product.

## Billing is not provenance

`public.registry_track_artists` answers public billing questions such as:

- who is a MainArtist;
- who is a FeaturedArtist;
- display/billing order;
- public Artist persona association.

It does not, by itself, answer:

- who produced the Recording;
- who wrote or composed the Work;
- who engineered, mixed or mastered the Recording;
- who played an instrument;
- who sang backing or supporting vocals;
- who conducted or arranged;
- which individual group members participated in a specific Recording;
- who translated or adapted a Work;
- who acted in another reviewed creative or technical role.

Accordingly:

```
Track <-> Artist billing
```

must remain distinct from:

```
Track <-> Recording contributors
Work  <-> Work contributors
```

## Canonical contribution model

### Recording Contribution

`public.registry_track_contributions` is the canonical authority for
participation in the creation or performance of a Sound Recording.

Its current schema already supports:

- `track_id`;
- `person_resource_id`;
- `organization_resource_id`;
- optional `artist_id`;
- `credited_as`;
- controlled `role_key`;
- `instrument_key`;
- bounded `detail_text`;
- `credit_order`;
- lifecycle `status`;
- `evidence_assertion_id`;
- validity intervals;
- non-destructive supersession.

Initial accepted Recording role vocabulary includes:

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

### Work Contribution

`public.registry_work_contributions` is the canonical authority for authorship
or creation of a Musical Work.

Its accepted role vocabulary includes:

- `composer`;
- `lyricist`;
- `songwriter`;
- `arranger`;
- `adaptor`;
- `translator`;
- `publisher_representative`;
- `other_reviewed`.

Recording and Work contributions must remain separate authorities.

A participant may legitimately appear in both.

## Contributor identity rule

A raw credit string is evidence, not automatically canonical identity.

A contribution may resolve to:

- a Person;
- an Organisation;
- an Artist persona where that public identity is relevant;
- retained `credited_as` text while underlying identity remains unresolved.

WAKILISHA must not manufacture a Person merely because a provider says
`Produced by X`.

The admission flow must preserve unresolved credited names until sufficient
evidence resolves them.

This allows the contribution graph to grow without creating false identities.

## Artist persona and Person must remain distinct

An Artist persona is not automatically the natural Person behind it.

Examples include:

- stage names;
- groups;
- production aliases;
- pseudonyms;
- collectives;
- legal Organisations.

A Person may have one or more Artist personas.

A Recording Contribution may point to a Person and optionally retain the
credited Artist persona under which the contribution was publicly presented.

This distinction is required for a credible provenance graph.

## Group provenance

Group billing and individual participation are separate facts.

For example:

```
Group X — MainArtist of Track T
```

does not prove that every known member of Group X participated on Track T.

Where evidence supports it, individual Recording Contributions may express:

```
Person A — vocalist
Person B — guitar
Person C — producer
```

while the Group remains the public MainArtist.

Membership in a group must never be expanded automatically into participation
on every Recording.

Recording participation requires its own evidence.

## DDEX / ERN alignment

WAKILISHA should preserve the same conceptual separation expressed by DDEX:

- Display Artist / MainArtist / FeaturedArtist describe public billing;
- Contributors describe creative and technical participation;
- contributor roles and instrumentation remain structured rather than flattened
  into a display string;
- consumer-facing credits may be derived from structured contribution metadata;
- enrichment provenance should preserve source/origin and verification state.

DDEX remains an external interoperability model, not WAKILISHA persistence
authority. External terminology maps into WAKILISHA canonical concepts rather
than redefining them.

## Operational gap

The schema alone is insufficient.

As of 29 September 2026, WAKILISHA has no operational pipeline that completes:

```
provider / ERN / reviewed evidence
        ↓
contributor observation
        ↓
identity resolution
        ↓
Person / Organisation / Artist persona
        ↓
Recording Contribution / Work Contribution
        ↓
evidence + provenance
        ↓
public read model
        ↓
Track / Artist / Group / Person presentation
```

The two canonical contribution tables being empty means the public product
cannot currently expose complete recording or work provenance from canonical
Registry authority.

## Required completion layers

The contributor-provenance graph is not operational until all of the following
exist.

### 1. Evidence ingestion

Provider, ERN, manual and other reviewed sources must be able to preserve:

- credited name;
- source role;
- normalized role candidate;
- instrument/detail where supplied;
- source ordering;
- source identity;
- source timestamp;
- source verification/trust context.

Raw evidence must not directly mutate canonical contribution authority.

### 2. Controlled role normalization

Source role text must map into a governed WAKILISHA vocabulary.

The original source role string must remain available as evidence.

Unrecognized roles must fail into reviewed classification rather than silently
collapse into a wrong canonical role.

### 3. Contributor identity resolution

Each candidate contributor must be resolved, where evidence allows, to:

- Person;
- Organisation;
- Artist persona;
- or unresolved `credited_as`.

Identity resolution must not rely on name equality alone.

### 4. Governed admission

The existing operation families:

- `registry.track_contribution.admit/v1`;
- `registry.work_contribution.admit/v1`;

must gain reviewed runtime broker/executor/verifier paths before they can be
enabled.

No standing mutation authority is implied by this document.

### 5. Evidence lineage

Every canonical contribution must be able to answer:

- what source asserted it;
- what exact evidence was reviewed;
- whether it is current, disputed, superseded or unresolved;
- what later contribution superseded it;
- when the assertion became valid;
- whether WAKILISHA independently verified the underlying identity or role.

### 6. Admin review

Admin must be able to review:

- unresolved contributor identities;
- duplicate Person/Artist candidates;
- role ambiguity;
- instrument ambiguity;
- contradictory providers;
- group-member participation claims;
- Recording-versus-Work role placement;
- proposed supersession.

Review must be understandable to a human without exposing low-level exact-grant
machinery.

### 7. Public read model

The public API must expose structured contributions directly.

Public surfaces must not reconstruct canonical credits by parsing strings.

At minimum, public read models should distinguish:

- billing artists;
- Recording contributors;
- Work contributors;
- group membership where separately evidenced;
- provenance/trust presentation suitable for public display.

### 8. Public presentation

The public product must make provenance visible.

#### Track detail

Track detail should become the deepest Recording provenance surface, capable of
presenting:

- MainArtists and FeaturedArtists;
- performers;
- producers;
- recording engineers;
- mixing/mastering engineers;
- vocalists;
- instrumentalists and instruments;
- Work contributors where a Work link exists;
- Release context;
- provider/source provenance suitable for public disclosure.

#### Artist detail

Artist pages should derive sections from canonical relationships, including:

- primary/co-main music;
- featured appearances;
- produced;
- written/composed;
- performed on;
- engineered/mixed/mastered where appropriate;
- other reviewed contribution roles.

An Artist page must not infer these from display strings.

#### Group detail

Group pages should be able to show:

- public group billing;
- separately governed group membership;
- which individual members are actually credited on specific Recordings;
- member roles on those Recordings;
- links to Person/Artist identities where resolved.

Group membership alone must not imply recording participation.

#### Person detail

Where public-safe Person presentation exists, a Person should eventually be able
to traverse all contribution roles across Artist personas, Recordings, Works and
groups without collapsing those identities.

## Provenance as public product behavior

WAKILISHA's provenance moat is not satisfied by storing evidence privately.

The public product should allow a listener to travel the graph.

From a Track:

```
Track
→ Main / Featured Artists
→ performers
→ producers
→ engineers
→ musicians
→ Work
→ songwriters / composers
→ Release
→ Label
→ evidence / provenance
```

From an Artist:

```
Artist
→ music fronted
→ music co-fronted
→ music featured on
→ music produced
→ music written
→ music performed on
→ groups participated through
→ recurring collaborators
```

Presentation must remain progressive and readable rather than exposing raw
Registry machinery.

## Public trust presentation

Internal fields such as rule version, raw confidence decimals and grant IDs are
not public UX.

Where evidence allows, public presentation may expose human-readable trust
signals such as:

- source;
- verified by WAKILISHA;
- artist/label/provider supplied;
- last confirmed date;
- disputed or unresolved state.

The exact public vocabulary requires product review, but provenance must not be
silently discarded at the read-model boundary.

## Rights separation

Contribution does not imply rights ownership.

A producer, performer, composer or engineer contribution must never
automatically create:

- a rights claim;
- ownership percentage;
- publishing control;
- neighbouring-rights entitlement;
- royalty entitlement.

Rights remain separately evidenced and governed.

## MIZIZI responsibilities

MIZIZI should eventually detect and surface:

- provider contributor evidence with no canonical contribution;
- canonical contributions with stale or superseded evidence;
- contradictory role claims;
- unresolved credited names;
- one contributor represented by multiple probable identities;
- group membership being incorrectly treated as recording participation;
- billing credits being incorrectly treated as complete provenance;
- Recording roles stored as Work roles or vice versa;
- missing evidence linkage;
- public provenance projections that disagree with canonical contributions.

MIZIZI must not invent contributors or roles merely to complete the graph.

## Existing evidence backlog

The Music Identity & Rights programme already identified retained provider
evidence relevant to future contribution promotion, including Apple Music
composer fields.

Those observations remain evidence only.

Raw composer strings must not automatically create:

- Persons;
- Works;
- Work Contributions.

The next implementation must begin by auditing the complete retained contributor
evidence corpus, not by opportunistically promoting one provider field.

## Acceptance gates

WAKILISHA must not describe the music-provenance graph as operationally complete
until fresh acceptance proves at minimum:

- canonical Recording Contribution admission path exists and is independently
  verified;
- canonical Work Contribution admission path exists and is independently
  verified;
- contributor operations remain zero-authority-at-rest outside reviewed
  execution;
- source evidence is retained for every admitted contribution;
- unresolved names can remain unresolved without manufactured identities;
- Artist billing is never used as a substitute for complete Recording
  Contributions;
- group membership never implies participation without Recording evidence;
- Recording and Work contribution roles remain separated;
- rights claims are not inferred from contribution status;
- public API exposes structured contribution data;
- Track presentation consumes canonical contribution authority;
- Artist/Group presentation consumes canonical contribution authority;
- public credit UI does not parse display strings to reconstruct roles;
- contradictory evidence produces review rather than silent overwrite;
- supersession preserves historical evidence;
- canonical contributor graph has non-zero accepted rows backed by reviewed
  evidence;
- protected Registry writer and exact-grant control planes remain green.

## Immediate implementation implication

Public Music Identity work must not add contributor-looking presentation by
parsing current Artist billing strings.

Before contributor-rich Artist/Group/Track presentation is implemented, the
programme must establish the contributor evidence → identity → admission →
public-read chain described above.

The already-installed contribution schema should be reused unless a concrete
audit proves a missing invariant.

Do not create a second contributor table or parallel credit graph merely because
the existing canonical tables are empty.

## Decision summary

WAKILISHA currently has:

- a strong conceptual provenance model;
- canonical Recording and Work Contribution schema;
- disabled typed operation declarations;
- zero canonical Recording Contribution rows;
- zero canonical Work Contribution rows.

Therefore:

> WAKILISHA has a provenance foundation, not yet an operational contributor
> provenance graph.

The public Artist billing graph is necessary but incomplete.

The provenance moat becomes real only when all participants in Recordings and
Works can be represented through canonical, evidence-backed, governed
contributions and those relationships are visible through public product
surfaces.
