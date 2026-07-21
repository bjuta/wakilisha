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
