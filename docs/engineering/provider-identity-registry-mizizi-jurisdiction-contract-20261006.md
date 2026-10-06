# Provider Identity / Registry / MIZIZI Jurisdiction Contract

**Status:** Architecture authority candidate for #1163  
**Date:** 6 October 2026  
**Scope:** Provider identity, external identifiers, Registry reconciliation, Registry review, MIZIZI stewardship, and downstream consumers  
**Implementation authority:** None. This document authorizes no schema change or Production mutation.

## 1. Purpose

WAKILISHA needs one provider-neutral identity control plane that can ingest evidence from many present and future providers without allowing provider-specific code, research pipelines, MIZIZI, or product workflows to become competing canonical identity authorities.

The architecture follows the existing Cultural Operating Layer doctrine:

- identity, provenance, evidence, permissions, and audit history are shared primitives;
- domain entities remain distinct;
- assertions are not automatically truth;
- canonical facts must remain explainable through evidence and reconciliation.

The design must also preserve MIZIZI's accepted charter:

> MIZIZI does not own cultural truth. The Registry owns cultural truth.

MIZIZI remains the steward of accepted Registry truth. It is not redefined as a provider matching service.

## 2. Accepted Current Authority

The following existing authorities are binding starting points.

### 2.1 Registry canonical entities

Registry UUIDs remain the canonical WAKILISHA identities for Track, Release, Artist, Musical Work, and other typed Registry domains.

External identifiers are not Registry primary keys.

### 2.2 External identifier assertion ledger

`public.registry_external_identifier_assertions` already exists as the provider-neutral external-identifier assertion authority.

Its accepted semantics deliberately permit external identifier conflicts and do not make `(scheme_key, comparison_value)` globally unique canonical identity.

The existing governed admission operation is:

`registry.external_identifier_assertion.admit/v1`

The accepted Slice 3 architecture explicitly states:

> Do not create another provider-identifier table.

#1163 therefore treats this ledger as a core reusable primitive rather than proposing a replacement.

### 2.3 Canonical Track-provider operational identity

`public.registry_track_provider_links` is the accepted canonical Track-provider operational binding authority.

The governed canonical mutation is:

`registry.track.provider_link.admit/v1`

through the reviewed admin broker:

`public.admin_admit_registry_track_provider_link_v1(...)`

Direct browser or workflow DML is not the architectural target.

### 2.4 Provider/review evidence bookkeeping

`public.provider_entity_links` is accepted provider-enrichment / review evidence bookkeeping.

It is not canonical provider identity.

Track Intake finalization may retain provider evidence there, but finalization must prove the corresponding governed canonical Track provider link.

### 2.5 Provider observations and source memory

`public.provider_field_observations`, `public.registry_provider_sources`, retained raw payloads, and provider-specific ingestion receipts preserve source evidence.

Cleaning or reconciling canonical identity must not destroy provider source memory.

### 2.6 Governance kernel

The existing Registry governance kernel remains authoritative:

- `platform_private.registry_evidence_assertions`;
- `platform_private.registry_review_cases`;
- typed operation definitions;
- execution grants;
- mutation operations;
- `platform_private.registry_operation_write_events`;
- `public.registry_canonical_write_events`;
- independent verifiers.

#1163 must reuse this kernel.

### 2.7 Identity lineage

`public.registry_identity_lineage` is append-only accepted identity transition history for canonical Artist, Track, and Release identity.

It records merge, supersede, split, alias replacement, and retirement transitions while preserving source authority and evidence snapshots.

A provider mapping must resolve through current Registry lineage without rewriting historical evidence.

## 3. Jurisdiction Matrix

| Action | Durable owner | Other systems may | Other systems must not |
| --- | --- | --- | --- |
| Fetch provider-native object | Provider adapter | cache/read result | decide canonical Registry identity |
| Preserve raw provider payload | Provider evidence layer | reference/hash it | rewrite it to match current Registry |
| Record observed provider field | Provider evidence layer | consume it | treat observation as canonical fact |
| Record external identifier assertion | External identifier assertion authority | propose/admit through governed operation | use identifier as Registry primary key |
| Generate identity candidate | Reconciliation layer | use deterministic or similarity evidence | mutate canonical Registry directly |
| Admit canonical Track-provider link | Registry typed provider-link authority | request reviewed admission | direct DML or bypass verifier |
| Create canonical Track/Release/Artist/etc. | Typed Registry operation for that entity | submit evidence/review | provider adapter or research pipeline creates silently |
| Merge/split/supersede canonical identity | Existing Registry identity authority | propose/review | provider adapter or reconciliation worker executes ad hoc |
| Resolve current canonical successor | Registry lineage resolver | read result | rewrite historical source observations |
| Open ambiguity review | Registry review authority | submit evidence | create parallel review queue |
| Resolve ambiguity | Human/typed Registry review authority | consume decision | autonomous fuzzy matching decides truth |
| Detect canonical drift | MIZIZI | inspect accepted evidence | redefine provider identity |
| Repair deterministic drift | MIZIZI through accepted typed authority | verify/read receipt | invent new canonical relationship |
| Repair downstream projection | MIZIZI or owning projection operation | rebuild from canonical identity | alter source evidence to fit projection |
| Produce read-only identity snapshot | Provider Identity Control Plane | serve charts/research/products | gain canonical write authority |
| Score charts / run D11B | Charts / research consumer | consume resolved snapshot | perform identity reconciliation itself |

The one-owner rule is binding: one mutation or decision class has exactly one durable owner.

## 4. Provider Identity Control Plane Scope

The Provider Identity Control Plane is an orchestration and reconciliation capability over accepted shared authority.

It owns:

- provider capability registration and adapter contracts;
- normalized external-object references where an existing evidence primitive can represent them;
- external identifier assertions;
- evidence/provenance references;
- deterministic equivalence candidates;
- similarity-based candidate discovery where explicitly labelled non-canonical;
- reconciliation proposals;
- resolution states;
- lineage-aware current-target lookup;
- read-only identity snapshots for consumers;
- reconciliation metrics and audit receipts.

It does **not** automatically own new canonical tables.

A new persistence primitive is earned only when the existing authority inventory proves a semantic gap that cannot be expressed safely through:

- provider source/evidence storage;
- `provider_entity_links`;
- `registry_external_identifier_assertions`;
- canonical provider links;
- Registry review;
- Registry lineage;
- evidence and operation journals.

## 5. Provider Adapter Contract

A provider adapter knows how to observe a provider. It does not know how to decide WAKILISHA truth.

A conforming adapter may emit:

- provider key;
- provider object type;
- provider object ID;
- canonical provider URL/reference;
- territory/storefront when meaningful;
- parent object IDs;
- provider artist/creator IDs;
- provider-returned external identifiers;
- display metadata;
- provider timestamps;
- retrieval timestamp;
- adapter version;
- payload hash;
- raw evidence reference;
- capability flags.

An adapter must not:

- create Registry entities;
- merge canonical entities;
- write `registry_track_provider_links` directly;
- mark a fuzzy title/artist candidate as resolved;
- silently normalize conflicting identifiers into one truth.

## 6. Evidence and Resolution Classes

### 6.1 Strong automatic-resolution evidence

Examples:

1. already accepted canonical provider link;
2. exact stable provider-object relationship with accepted provenance;
3. exact provider object -> stable identifier -> one current canonical Registry entity;
4. multiple independent strong identifiers corroborating the same current entity.

Even strong evidence is subject to lineage and ambiguity checks.

### 6.2 Candidate-only evidence

Examples:

- exact normalized title + artist;
- fuzzy title/artist similarity;
- duration similarity;
- artwork similarity;
- release-date proximity;
- provider search ranking;
- chart co-occurrence.

Candidate-only evidence may prioritize review or stronger evidence collection.

It must not silently become canonical truth.

### 6.3 Unresolved

An external object may remain unresolved indefinitely.

Unresolved is a first-class valid state, not an error to hide by creating a Registry shell.

### 6.4 Quarantined / disputed

Conflicting strong identifiers, multiple current canonical candidates, lineage ambiguity, provider object reuse, or material evidence contradiction must fail closed into quarantine/review.

## 7. Provider Scope

Provider is configuration and adapter behavior, not schema.

### Tier 1 validation

The first architecture validation should cover materially different provider shapes:

- Apple Music;
- Spotify;
- YouTube / YouTube Music;
- Audiomack;
- Boomplay;
- Mdundo.

This list exercises global DSP IDs, video IDs, regional DSPs, URL/path identities, differing metadata depth, and differing API/access models.

### Tier 2

Add when access and marginal identity value justify the adapter:

- Deezer;
- TIDAL;
- Amazon Music;
- SoundCloud;
- Shazam;
- TikTok music surfaces;
- Meta music surfaces.

### Identifier authorities

The system must treat identifier schemes separately from commercial providers:

- ISRC;
- UPC / EAN;
- ISWC;
- IPI / CAE;
- ISNI;
- DDEX-derived identifiers/evidence;
- future rights/fingerprint authorities.

A provider adapter can assert an identifier. The provider is not the identifier authority itself.

### Long-tail admission rule

A provider becomes first-class when it materially adds coverage, stable identity, independent corroboration, strategic Kenyan/African coverage, rights/provenance value, or product capability.

Coverage theatre is not a reason to build an adapter.

## 8. Entity Scope

The contract is entity-generic. Implementation is staged.

First implementation must prove:

1. Track;
2. Release;
3. Artist.

The contract must remain extensible to:

- Musical Work;
- Person;
- Organisation;
- Label;
- Media Asset where identity semantics justify it;
- future cultural entities.

Do not build speculative adapters or canonical mutation operations for those domains without concrete evidence and a typed Registry contract.

## 9. MIZIZI Boundary

MIZIZI is downstream stewardship over accepted authority.

### MIZIZI may

- consume accepted provider identity and external identifier assertions;
- detect drift between canonical identity and projections;
- follow Registry lineage to current successors;
- detect orphaned/stale canonical provider bindings;
- repair deterministic downstream drift through accepted operations;
- emit observations/findings when provider evidence contradicts canonical state;
- escalate material ambiguity into existing Registry review;
- verify invariants continuously and historically.

### MIZIZI may not

- operate provider APIs as the primary ingestion layer;
- invent provider-object equivalence;
- promote fuzzy similarity to canonical truth;
- create a second external identifier ledger;
- create its own provider-link table;
- bypass the Registry broker/evidence/grant/verifier kernel;
- replace human review for culturally meaningful ambiguity.

### Feedback loop

The allowed loop is:

```text
Provider observation
  -> evidence/assertion
  -> reconciliation/review
  -> canonical Registry fact
  -> MIZIZI stewardship
  -> new finding/evidence when drift or contradiction appears
  -> reconciliation/review
```

MIZIZI may feed evidence back upstream. It does not become upstream reconciliation authority.

## 10. Consumer Boundary

Charts, D11B, search, playback, Artist Studio, claims, analytics, and future APIs consume provider identity through stable read contracts.

They must not implement their own matching logic.

D11B specifically receives a versioned, hashable, read-only identity snapshot containing:

- provider object reference;
- evidence state;
- canonical entity ID or null;
- lineage resolution;
- authority class;
- evidence/provenance reference;
- snapshot hash.

D11B receives no canonical mutation capability.

## 11. Immediate Convergence Decisions

The following are architecture decisions for #1163:

1. Reuse `registry_external_identifier_assertions`; do not create a second generic identifier table.
2. Preserve `registry_track_provider_links` as current canonical Track-provider operational identity.
3. Preserve `provider_entity_links` as evidence/review bookkeeping until an audited migration proves a narrower or retired role.
4. Reuse Registry evidence/review/operation/write-event/verifier infrastructure.
5. Reuse `registry_identity_lineage` for current-successor resolution.
6. Do not move MIZIZI upstream into provider reconciliation.
7. Do not put canonical reconciliation policy inside provider adapters.
8. Do not use D11B research tables as provider identity authority.
9. Do not introduce a generic `external_objects` table merely because the abstraction is attractive. Prove the semantic gap first.
10. Any new canonical provider-binding authority for Release/Artist/etc. must be earned by a concrete use case and compared against external identifier assertions plus existing evidence links before schema is added.

## 12. Open Architecture Questions

These are audit questions, not permission to build new infrastructure:

1. Can existing provider source/evidence primitives represent unresolved external provider objects durably enough for all Tier 1 adapters?
2. Does `provider_entity_links` need to remain generic evidence bookkeeping, or can some legacy uses retire after convergence?
3. Is Track the only domain requiring an operational provider binding, with Release/Artist provider IDs represented adequately as external identifier assertions, or are typed provider bindings earned for those domains?
4. Which existing provider-specific enrichment flows still perform canonical matching policy locally?
5. Which browser/service roles retain direct DML against identity-related tables despite accepted typed operations?
6. Which provider keys/identifier schemes are inconsistent across existing tables and adapters?
7. What exact evidence classes allow automatic resolution versus mandatory review?
8. What provider-object retention semantics are required when an object disappears, redirects, or is reused?

No schema work begins until these questions are answered against current Production/repository authority.

## 13. What Not To Touch In Architecture Phase

Do not:

- generate SQL migrations;
- alter Production;
- deploy Edge Functions;
- backfill provider links;
- bulk-create external identifier assertions;
- change Registry entity creation;
- alter merge/split algorithms;
- rewrite MIZIZI;
- change D11B formulas or thresholds;
- create another review queue;
- weaken human approval requirements.

## 14. Exit Gate

Architecture phase is complete when:

- every current identity-related write surface is inventoried;
- every action has one durable owner;
- overlapping authorities have an explicit convergence/retirement decision;
- MIZIZI responsibilities do not duplicate reconciliation responsibilities;
- provider adapter contract is provider-neutral;
- existing shared primitives are reused wherever semantically sufficient;
- genuinely missing primitives are named with evidence showing why existing ones cannot serve;
- a bounded implementation sequence can be opened without a big-bang rewrite.
