# WAKILISHA Registry Knowledge Contract

## Status

Approved direction for the Registry-first knowledge programme.

This document defines authority, scope, consolidation rules, and delivery sequence. It does not change database schema, application code, Edge Functions, or public routes.

## Decision

The WAKILISHA Registry is the single source of truth for reusable cultural knowledge.

The Registry owns what WAKILISHA knows.

Other product areas may create, review, interpret, publish, or retrieve knowledge, but they must not create competing sources of truth.

- The Institute owns investigation workflows.
- Magazine owns editorial expression.
- Search owns retrieval and exploration.
- Charts own measurement and chart interpretation.
- Community owns contribution workflows.
- Briefings own delivery.
- The Registry owns canonical identity, accepted knowledge, evidence, relationships, corrections, revision history, and semantic memory.

## Why this decision exists

WAKILISHA currently has three overlapping knowledge systems:

1. The active Registry, which contains the real canonical data and most application usage.
2. A shared institutional knowledge schema in production, which is structurally strong but mostly dormant.
3. A newer Institute-specific evidence and relationship system, which is operational but inquiry-bound.

The organization must not create a fourth system.

The consolidation goal is to preserve the strongest ideas from each system while making the Registry authoritative.

## Current production findings

The production audit found:

- 1,212 Registry artists
- 2,417 Registry tracks
- 789 Registry releases
- 232 Registry labels
- 45 Registry genres
- 216 articles
- 6,468 rows in `registry_entity_relationships`
- 4,210 rows in `registry_track_artists`
- 2,623 rows in `registry_release_tracks`
- 1,361 rows in `registry_release_artists`
- 476 rows in `registry_artist_genres`

The dormant shared knowledge system contains:

- 4 cultural entities
- 3 evidence items
- 2 shared entity relationships
- 2 relationship-evidence links
- 5 evidence review events
- 0 embeddings
- 0 retrieval policies
- 0 retrieval runs
- 0 AI source logs

The live database has `vector`, `pg_trgm`, and `pgcrypto` enabled, but semantic retrieval is not operational.

All test Institute inquiries and their dependent records were intentionally removed before this programme began.

## Core authority rules

### Rule 1: Canonical entities live in the Registry

Artists, tracks, releases, labels, genres, authors, articles, charts, playlists, and future cultural entities must resolve to Registry-owned identities.

The Registry may use typed tables, a shared entity index, or both. The authority remains the Registry.

### Rule 2: Typed structural relationships remain authoritative

Frequently queried structural relationships stay in dedicated tables.

Examples:

- `registry_track_artists`
- `registry_release_artists`
- `registry_release_tracks`
- `registry_artist_genres`
- future `registry_release_genres`
- future `registry_track_genres`
- chart entry to track links
- entity to media links

These tables should not be duplicated into a generic graph merely for consistency.

### Public music identity boundary

Provider packaging does not determine WAKILISHA public identity.

Public music routing is derived from active `registry_release_tracks` membership:

- Exactly one active Track membership surfaces as a Track at `/tracks/{artist-slug}/{track-slug}`.
- Two or more active Track memberships may surface as a Release at `/releases/{artist-slug}/{release-slug}`.
- A one-track provider Release record may remain in the Registry for provenance, provider identifiers, artwork, label, and release-date metadata.
- `registry_tracks.release_id` is a compatibility pointer, not Release membership authority.
- Existing one-track Release URLs should converge to the canonical Track route rather than create a second public identity.

### Chart evidence and public identity

Chart rows preserve what the source observed. They are evidence, not a second canonical Registry.

When a published Chart entry resolves to an active canonical Registry Track or Artist, public endpoints and UI should present the active canonical title, slug, artwork, and Artist identity while leaving the Chart row unchanged.

If the linked canonical entity is not active or no longer resolves, public presentation may fall back to the original Chart evidence. Mlinzi may later reconcile the linkage when stronger evidence exists.

This means a historical source can remain verbatim even after the Registry becomes cleaner. Provenance and clean public presentation are complementary, not competing goals.

### Rule 3: General cultural relationships belong to the Registry graph

`registry_entity_relationships` becomes the flexible graph for relationships that do not deserve dedicated structural tables.

Examples:

- collaborated with
- influenced
- member of
- founded
- associated with scene
- connected to place
- performed at
- part of movement
- preceded
- responded to
- referenced

### Rule 4: Imported or generated information is not automatically truth

Provider data, imported metadata, model suggestions, semantic proximity, and contributor submissions are observations or proposals until reviewed.

The system must distinguish:

- observed
- proposed
- reviewed
- accepted
- public-safe
- disputed
- rejected
- superseded
- archived

### Rule 5: Accepted knowledge must retain provenance

Every accepted claim or cultural relationship must be traceable to evidence, a source, or a recorded editorial decision.

### Rule 6: Corrections preserve history

Corrections must not silently overwrite institutional memory.

The system must preserve:

- the previous state
- the corrected state
- the reason
- supporting evidence
- reviewer
- timestamp
- downstream impact

### Rule 7: Semantic similarity proposes, humans decide

Embeddings may retrieve or suggest proximity. They may not establish influence, lineage, causation, membership, authorship, or cultural importance without evidence and review.

### Rule 8: Product workflows cannot own reusable truth

An Inquiry may gather and assess knowledge. An article may explain knowledge. A playlist may express knowledge. None of them may become a separate source of truth when the result is reusable across WAKILISHA.

## Knowledge layers

### Layer 1: Canonical records

The canonical objects WAKILISHA recognizes.

Primary examples:

- Registry artists
- Registry tracks
- Registry releases
- Registry labels
- Registry genres
- Registry authors
- articles
- charts
- playlists
- future people, places, scenes, institutions, events, phrases, and cultural works

### Layer 2: Structural relationships

High-volume product facts represented in typed join tables.

### Layer 3: General cultural relationships

Reviewed, evidence-backed graph edges represented in the Registry relationship system.

### Layer 4: Evidence and claims

Source-backed material that supports, contradicts, qualifies, or contextualizes Registry knowledge.

### Layer 5: Corrections and review memory

Recorded decisions, corrections, rejections, supersession, and review history.

### Layer 6: Semantic memory

Registry-owned chunks, embeddings, retrieval policies, retrieval runs, and source logs.

### Layer 7: Product experiences

Artist pages, track pages, release pages, search, charts, Magazine, playlists, briefings, community, APIs, datasets, and Inquiries.

## Authority matrix

| Knowledge type | Authoritative owner | Supporting inputs |
|---|---|---|
| Artist identity | Registry artist record | aliases, provider links, resolution history |
| Track identity | Registry track record | provider links, ISRC, release context |
| Release identity | Registry release record | provider links, tracklists, release shells |
| Label identity | Registry label record | provider and editorial observations |
| Genre identity | Registry genre record | aliases and curated taxonomy |
| Track credits | `registry_track_artists` | provider observations and editorial review |
| Release credits | `registry_release_artists` | provider observations and editorial review |
| Release tracklist | `registry_release_tracks` | provider payloads and editorial review |
| Artist genre | `registry_artist_genres` | imported classifications and editorial review |
| General cultural relationship | Registry relationship graph | evidence, imports, suggestions, contributions |
| Editorial meaning | reviewed Registry interpretation or article | evidence and editorial decision |
| Source evidence | Registry evidence layer | source files, URLs, interviews, articles, datasets |
| Correction | Registry correction record | contribution, editorial review, evidence |
| Semantic chunk | Registry semantic memory | published and approved Registry-owned content |
| Inquiry conclusion | promoted Registry knowledge plus Inquiry-specific framing | evidence, notes, review decisions |

## Consolidation map

### Keep as canonical Registry structures

- `registry_artists`
- `registry_tracks`
- `registry_releases`
- `registry_labels`
- `registry_genres`
- `registry_authors`
- `registry_track_artists`
- `registry_release_artists`
- `registry_release_tracks`
- `registry_artist_genres`
- `registry_entity_relationships`
- Registry aliases, provider links, resolution events, review items, and canonical write events
- `wk_articles`
- chart tables
- playlist tables

### Absorb into the Registry knowledge layer

The following concepts are retained, even if table names later change:

- evidence items
- evidence review events
- relationship-evidence links
- corrections
- contributor submissions
- semantic chunks and embeddings
- retrieval policies
- retrieval runs
- retrieval run items
- AI source logging

### Retain as workflow-specific Institute data

Only workflow state should remain Institute-specific:

- inquiry question
- question versions
- assignment and status
- workbench setup
- working notes
- review packet
- article and playlist draft links
- publication workflow

Reusable accepted knowledge must be promoted to the Registry.

### Retire after safe migration

- duplicate cultural identity authorities
- duplicate shared relationship authorities
- duplicate evidence authorities
- obsolete helper functions and permissions
- unused retrieval shells that are superseded by the Registry implementation

No table is dropped until its data, consumers, constraints, policies, and rollback path are documented.

## Relationship model decision

### Typed relationships

Dedicated typed tables remain the source of truth for structural relationships.

### Generic relationships

`registry_entity_relationships` will be extended to support institutional judgment.

The target model must support:

- canonical source entity reference
- canonical target entity reference
- controlled relationship type
- optional role
- plain-language reason
- source and provenance
- confidence
- observation status
- review status
- public-safe status
- validity period
- reviewer and review time
- evidence links
- supersession history
- correction lineage

The current table remains operational during migration.

### Current data caution

Of 6,468 current generic relationship rows, 6,332 are chart-entry artwork links. The table is therefore not yet a mature cultural graph.

Current non-media graph rows include:

- 50 popular-track links
- 35 featured-on links
- 32 features links
- 19 collaboration links

The audit also found unresolved artist slugs in some relationships. Future relationships should use canonical IDs wherever possible, with slugs retained for compatibility and readability.

## Evidence model decision

The Registry evidence layer must support:

- source type
- source URL or file reference
- title
- exact excerpt or passage
- summary
- claim or observation
- why it matters
- reliability
- confidence
- review status
- retrieval status
- rights and consent status
- linked Registry entities
- linked Registry relationships
- reviewer
- decision history

Raw model outputs and flexible captures may remain JSON. Accepted institutional knowledge must be promoted into typed, queryable structures.

## Semantic memory decision

Semantic memory belongs to the Registry.

The first corpus should include only approved or public-safe knowledge:

- published articles
- artist biographies
- release descriptions
- track descriptions
- reviewed evidence
- accepted cultural relationships
- chart interpretation

The first corpus should not indiscriminately embed:

- raw provider payloads
- unreviewed suggestions
- private contributor material
- disputed evidence without retrieval controls
- secrets or restricted admin records

Retrieval must combine:

- exact lookup
- full-text search
- semantic similarity
- entity filters
- relationship traversal
- review status
- public-safe status
- time, place, source type, and confidence filters

## Product contract

### Institute

The Institute investigates and promotes accepted outputs into Registry knowledge.

### Magazine

Magazine publishes Registry-backed explanations and adds reviewed interpretations and source material back into the Registry.

### Search

Search retrieves Registry entities, relationships, evidence, and context. It must not invent relationships from semantic similarity.

### Charts

Charts remain authoritative for chart measurements. Reviewed chart context may enter Registry evidence and interpretation.

### Community

Community submissions may become evidence, relationships, corrections, or record changes only after review.

### Briefings

Briefings consume Registry knowledge and signals. They do not create a separate knowledge store.

## Delivery sequence

### PR 1: Registry Knowledge Contract

Documentation only.

Deliverables:

- authority rules
- authority matrix
- consolidation map
- relationship model decision
- evidence model decision
- semantic memory decision
- delivery sequence
- guardrails

### PR 2: Registry relationship foundation

- extend `registry_entity_relationships`
- add canonical entity references where practical
- add reason, review, public-safe, reviewer, and supersession fields
- document and clean overlapping indexes
- preserve all existing rows
- add verification SQL

### PR 3: Registry evidence foundation

- create or recover Registry-owned evidence tables
- preserve review history
- migrate the small dormant shared evidence dataset
- add RLS and verification SQL

### PR 4: Relationship evidence

- link Registry cultural relationships to Registry evidence
- support support, contradiction, qualification, and context

### PR 5: Registry entity index

- support cross-domain identities such as people, places, scenes, institutions, events, phrases, and cultural works
- map typed Registry records without replacing their canonical tables

### PR 6: Registry semantic corpus

- define chunking rules
- define embedding model and dimensions
- create embedding pipeline
- add retrieval-safe states
- add vector index only when data volume justifies it

### PR 7: Registry retrieval service

- hybrid retrieval
- task-specific policies
- source logging
- retrieval audit trail
- product-specific retrieval recipes

### PR 8 onward: Public product proofs

At minimum:

- richer artist-page context
- investigative search
- editorial research support

Inquiries benefit from the same system but do not define it.

## Guardrails

- No new parallel evidence system.
- No new parallel relationship authority.
- No new parallel embedding store.
- No direct AI writes into accepted Registry knowledge.
- No semantic relationship becomes public without evidence and review.
- No production table is dropped before consumer and rollback audits.
- No public route changes in PR 1.
- No frontend changes in PR 1.
- No Edge Function changes in PR 1.
- No Supabase migration in PR 1.
- No production data changes in PR 1.

## PR 1 acceptance criteria

PR 1 is complete when:

- the Registry is formally declared the single source of truth
- authority boundaries are explicit
- typed and generic relationships are distinguished
- evidence, corrections, contributions, and semantic memory are assigned to the Registry
- Institute responsibilities are limited to workflow and investigation
- the current production fragmentation is documented
- the phased migration plan is approved
- no code or schema behavior changes are included

## Next decision after merge

Begin PR 2 with a schema-level relationship plan and verification queries. Do not apply changes until the plan accounts for all current relationship consumers and preserves the 6,468 existing rows.
