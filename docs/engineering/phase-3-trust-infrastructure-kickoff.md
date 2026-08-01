# Phase 3 kickoff: Trust infrastructure

Date: 21 July 2026

## Status

Ready to start.

## Starting baseline

Phase 3 starts after the Phase 2 Article authority closure.

The closed Article authority provides:

- stable resource identity
- durable drafts
- immutable versions
- governed review
- publication snapshots
- exact preview foundation
- archive and restore
- visible lifecycle history
- visible revision history
- stable public published pages

## Phase 3 objective

Build the shared trust layer once so all canonical WAKILISHA outputs can reuse it.

The first supported outputs are:

- Articles
- Registry changes
- Playlist notes later in the programme

The trust layer must not become an Institute-only evidence system.

## Article Workspace North Star quality gate

Status: Active.

Phase 3A schema implementation is paused.

The Article Workspace remains the first adopter of Sources, Citations, and Credits, but it cannot guide the wider five-year product programme in its current form.

The product audit confirmed:

- North Star gate failed
- responsive behaviour scored one out of five
- large-document usability scored one out of five
- Review controls workflow but does not yet support the act of reviewing
- Publishing does not yet communicate the exact governed version clearly enough
- current identity presentation fragments account, ownership, Author, actor, and future credit concepts

Required sequence:

1. complete the Article Workspace North Star quality pass
2. verify exact public Preview
3. verify keyboard, focus, dialog, and narrow-screen behaviour
4. lock the canonical creditable-person identity contract
5. resume PR 3A schema and Article integration

This quality gate does not reopen Phase 2 authority.

## PR 3A: Sources, citations, and credits

Build scope:

- reusable source records
- source versions
- typed source locators
- citations
- credits
- external contributors
- source withdrawal state
- Registry entity links where needed for trust context
- Article citation attachment
- public source and credit presentation where the authority exists

Acceptance proof:

- one source can be reused by an Article, a Registry change, and later a Playlist note
- citations remain stable when display formatting changes
- credits can represent authenticated users, Registry authors, and named external contributors
- public presentation does not expose private or sensitive source material

## Research and machine-use compatibility

Sources, Citations, Credits, and contributor identities are permanent shared trust infrastructure.

Their identity and versioning contracts must support future research publications, datasets, machine-readable knowledge products, agent retrieval, model evaluation, and licensed AI use.

Citation records describe provenance and use. They do not grant permission.

Credit records describe contribution. They do not determine commercial allocation or payout.

Public-safe presentation does not imply permission to download, reproduce, embed, train on, redistribute, or use commercially.

Licensing, entitlements, usage metering, revenue allocation, and payouts must be separate authorities attached to stable resource and version identities.

Article-specific attachment commands are the first adoption path. They are not the final cross-resource Citation or Credit API.

See `docs/engineering/research-publishing-and-knowledge-licensing-future-contract.md`.

This future direction does not expand the current Phase 3A implementation scope.

## PR 3B: Corrections and provenance

Build scope:

- correction cases
- correction targets
- evidence attachment
- investigation ownership
- decision history
- correction application command
- public correction notes
- affected-resource flags
- contributor notification jobs
- append-only provenance events

Acceptance proof:

- a submitted correction becomes a case
- a reviewed correction creates a new resource version or reviewed Registry change
- public history explains what changed and why

## Immediate non-goals

Do not start these in PR 3A:

- Playlist authority
- Audio authority
- Video authority
- Media platform redesign
- Field Capture
- Inquiry Mode
- public Article visual redesign
- Article lifecycle redesign
- giant public-content-read replacement
- sitemap sharding

## First engineering move

Begin Phase 3A with an audit of existing source-like, citation-like, credit-like, and contributor-like data.

The audit must identify:

1. existing fields that behave like sources
2. existing fields that behave like citations
3. existing author, curator, reviewer, and contributor fields
4. existing Registry links that should become trust relationships
5. current public presentation of sources, credits, and bylines
6. permission boundaries for who may attach, edit, withdraw, or publish source material
7. privacy and sensitivity cases
8. minimum data model for a reusable trust layer
9. migration strategy for useful existing data
10. one narrow proof path for Article adoption

No implementation PR should proceed until this audit defines the authority boundary.
