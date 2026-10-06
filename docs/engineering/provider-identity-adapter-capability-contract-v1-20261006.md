# Provider Identity Adapter and Capability Contract V1

**Status:** Architecture authority candidate for #1163  
**Date:** 6 October 2026  
**Relationship:** Extends the accepted Music Identity & Rights standards-adapter architecture. It does not replace it.

## 1. Principle

Provider integrations and standards integrations use the same architectural rule:

```text
external source
  -> parser / fetcher
  -> provider-neutral adapter envelope
  -> WAKILISHA evidence / candidate model
  -> reconciliation
  -> separately governed canonical operation, only when authorized
```

The parser/fetcher/mapper has no canonical mutation authority.

This contract adds provider-specific capability semantics to the already accepted
common adapter envelope. It does not create a new canonical domain model.

## 2. Canonical Provider Key

Every commercial/source provider adapter must expose one stable WAKILISHA
`provider_key`.

Rules:

- lowercase ASCII;
- snake_case;
- stable across adapter versions;
- never territory-specific;
- never object-type-specific;
- aliases normalize at the adapter boundary.

Initial vocabulary target:

- `apple_music`
- `spotify`
- `youtube`
- `audiomack`
- `boomplay`
- `mdundo`
- `soundcloud`
- `deezer`
- `tidal`
- `amazon_music`
- `shazam`
- `tiktok`
- `meta_music`

This list is vocabulary, not a promise that every adapter is implemented.

Non-provider import mechanisms such as CSV/manual submission must not masquerade as
commercial provider keys. They belong to source/import kind vocabulary.

## 3. Provider Objects

Adapters describe external provider objects using typed references.

Initial object types:

- `track`
- `release`
- `artist`
- `playlist`
- `chart`
- `video`
- `channel`
- `work` only where the provider genuinely exposes Work semantics
- `other_reviewed` only under an explicit adapter contract

A provider object reference contains:

- provider key;
- object type;
- provider object ID;
- canonical provider URL/reference when available;
- parent provider object IDs when relevant;
- storefront/territory context where semantically meaningful.

Provider object type does not determine WAKILISHA canonical entity type by itself.

Example:

A YouTube video is a provider `video`. Evidence may later support a relationship
to a Registry Track, but the adapter must not relabel the video itself as a Track.

## 4. Identifier Schemes Are Separate From Providers

Identifier assertions use `scheme_key`, not `provider_key`.

Examples:

- `isrc`
- `upc`
- `ean`
- `iswc`
- `ipi`
- `cae`
- `isni`
- `musicbrainz`
- future reviewed schemes

Provider IDs may also be represented through existing provider evidence and
operational provider bindings.

Do not create `spotify_isrc`, `apple_isrc`, or similar provider-specific
identifier schemes.

## 5. Common Adapter Envelope

Provider adapters must align with the accepted standards-adapter envelope and
add provider capability fields.

Required envelope fields:

- `adapter_key`
- `adapter_version`
- `provider_key`
- `provider_object_type`
- `provider_object_id`
- `source_reference`
- `source_party` when known
- `retrieved_at`
- `source_observed_at` when provider supplies it
- `territory_or_storefront` when meaningful
- `payload_hash`
- `raw_evidence_ref`
- `mapping_result`
- `candidate_refs`
- `capabilities_exercised`
- `warnings`
- `unsupported_fields`
- `mapping_loss`

`mapping_result` remains one of the accepted semantic classes such as:

- mapped;
- partial;
- review_required;
- rejected.

Mapped does not mean canonical identity accepted. It means the source record was
mapped into WAKILISHA evidence/candidate semantics successfully.

## 6. Capability Vocabulary

A provider declares capabilities independently.

Initial capability keys:

### Identity/catalog

- `exact_object_lookup`
- `object_search`
- `stable_track_id`
- `stable_release_id`
- `stable_artist_id`
- `canonical_url`
- `isrc_observation`
- `upc_observation`
- `artist_credit_observation`
- `release_relationship_observation`

### Charts/measurement

- `chart_observation`
- `rank_observation`
- `historical_period_lookup`
- `current_only_observation`
- `territory_specific_chart`
- `cardinal_count_observation`

### Playback/media

- `playback`
- `preview_audio`
- `video_playback`
- `artwork`
- `lyrics_or_transcript` only where contractually/semantically allowed

### Rights/provenance

- `work_identifier_observation`
- `contributor_observation`
- `label_observation`
- `rights_claim_observation`
- `provenance_observation`

### Operational

- `requires_credentials`
- `public_fetch`
- `rate_limited`
- `webhook_or_push`
- `pagination`

Capabilities are versioned adapter facts. They are not inferred from provider
brand name.

## 7. Current Capability Map

Current WAKILISHA code demonstrates fragmented capabilities:

| Provider | Proven current capability surface |
| --- | --- |
| Apple Music | exact/catalog inspection, provider intake, chart fetch, D11B chart observation, playback/enrichment, ISRC observation |
| Spotify | provider intake, chart/playlist fetch, provider evidence, ISRC observation |
| YouTube | D11B chart observation, provider evidence, video/playback identity |
| Audiomack | D11B chart observation |
| SoundCloud | provider evidence and playback |
| Boomplay | source vocabulary/research history; first-class identity adapter not yet proven by this audit |
| Mdundo | source vocabulary/research history; first-class identity adapter not yet proven by this audit |

This is a capability inventory, not an implementation ranking.

## 8. Adapter Output Semantics

An adapter may output:

- exact provider object identity;
- provider-returned identifiers;
- provider-native relationships;
- normalized display fields;
- retained source fields;
- evidence confidence/quality metadata;
- candidate Registry references where produced by a separate reconciliation step.

An adapter may not output `canonical_track_id`, `canonical_release_id`, or
`canonical_artist_id` as an authoritative decision solely from provider
metadata.

If an adapter references an already accepted canonical provider link, it may
return that relationship as **existing canonical authority**, clearly
distinguished from a new resolution decision.

## 9. Reconciliation Boundary

Reconciliation consumes:

- adapter envelope;
- existing canonical provider links;
- external identifier assertions;
- Registry canonical state;
- identity lineage;
- retained provider evidence;
- review decisions;
- deterministic shared policy.

Reconciliation produces one of:

- `resolved_existing_authority`
- `deterministic_candidate`
- `review_required`
- `unresolved`
- `quarantined_conflict`
- `superseded_external_reference`

These are control-plane states, not provider adapter states.

A deterministic candidate still requires the separately governed canonical
operation appropriate to the fact family.

## 10. Similarity Boundary

Similarity can generate or rank candidates.

Examples:

- normalized title;
- artist-name similarity;
- duration;
- release date;
- artwork;
- neighboring provider relationships.

Similarity must never independently produce
`resolved_existing_authority`.

Any future automatic threshold for deterministic resolution must be tied to
strong evidence classes and reviewed/frozen separately from adapter code.

## 11. Lineage

Before emitting a current canonical resolution, reconciliation must follow
accepted Registry lineage.

Historical provider evidence remains attached to its historical observation.

Do not rewrite provider source rows because a Registry Track, Release, or Artist
was later merged, split, superseded, or retired.

A read contract may expose:

- observed historical Registry subject;
- current canonical successor;
- lineage transition;
- lineage evidence reference.

## 12. MIZIZI Integration

MIZIZI reads:

- canonical resolution;
- evidence/assertion state;
- lineage;
- downstream projections.

MIZIZI may flag:

- stale canonical provider links;
- projection drift;
- orphaned provider bindings;
- contradiction between accepted evidence and current projection;
- lineage propagation failures.

MIZIZI does not:

- call provider search to choose identity;
- score similarity as canonical authority;
- maintain adapter credentials;
- own provider capability definitions.

## 13. Read-only Consumer Snapshot

Consumers such as D11B receive a versioned snapshot, not internal write
capability.

Minimum fields:

- snapshot version;
- generated timestamp;
- provider key;
- provider object type;
- provider object ID;
- external identifiers/evidence refs;
- resolution state;
- canonical entity type;
- canonical entity ID or null;
- current canonical successor ID where lineage applies;
- authority class;
- evidence fingerprint;
- adapter version;
- reconciliation policy version;
- snapshot hash.

## 14. Versioning

Adapter version changes when source parsing/mapping semantics change.

Reconciliation policy version changes when identity decision semantics change.

Provider capability version changes when the declared capability contract
changes materially.

These versions are independent.

The same provider may have multiple adapters for materially different source
surfaces, provided they share `provider_key` and declare distinct
`adapter_key` values.

Example:

- Apple catalog adapter;
- Apple chart adapter.

They share provider identity. They do not pretend their observation semantics are
the same.

## 15. Failure Rules

Fail closed when:

- provider object ID is missing where required;
- provider response identity contradicts the requested object;
- source payload cannot be fingerprinted;
- identifier scheme is unknown/unreviewed;
- strong identifiers point to multiple current canonical entities;
- Registry lineage cannot identify one current successor;
- provider object appears reused or semantically changed;
- canonical expected state changed after candidate generation.

Retain evidence and return an unresolved/review/quarantine state.

## 16. Persistence Decision

This contract does not authorize a new provider capability table or external
object table.

The architecture phase should first test whether:

- versioned code/config can own provider capability registration;
- `registry_provider_sources`, `provider_entity_links`, raw provider payloads
  and external identifier assertions can preserve required evidence;
- existing Registry operation/evidence/review primitives can own promotion.

Only a proven lifecycle/query/integrity gap earns new persistence.

## 17. Acceptance

A future implementation of this contract must prove:

1. adding a new provider normally changes adapter/config code, not canonical schema;
2. adapter tests run without canonical Registry writes;
3. exact source bytes + adapter version produce deterministic normalized evidence;
4. unresolved objects remain representable;
5. conflicting identifiers remain representable;
6. provider key aliases normalize deterministically;
7. identifier schemes remain provider-independent;
8. reconciliation is separately versioned;
9. canonical writes pass through existing typed Registry authority;
10. MIZIZI remains downstream stewardship, not reconciliation.
