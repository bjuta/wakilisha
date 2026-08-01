# Phase 3A Trust Attachment Foundation Implementation Blueprint

## Status

This document defines the implementation boundary for Phase 3A Migration 2.

It is not a migration and does not change production.

## Migration identity

Planned migration:

`20260731190000_phase_3a_trust_attachment_foundation.sql`

Planned verifier:

`scripts/control-plane/verify-phase-3a-trust-attachment-foundation.sql`

## Existing authority

Migration 1 already provides:

- `editorial.sources`
- `editorial.source_versions`
- `editorial.citation_locator_types`
- `editorial.external_contributors`
- `editorial.credits`
- `editorial.credit_governance`

Existing Article authority provides:

- `editorial.resources`
- `editorial.article_resources`
- `editorial.article_versions`
- `editorial.current_user_can_edit_article(uuid)`

Migration 2 must not change Article content, ownership, lifecycle, version identity, byline text, publication pointers, or publication snapshots.

## Objects to create

1. `editorial.source_registry_links`
2. `editorial.citations`
3. `editorial.resource_citations`
4. `editorial.resource_credits`
5. `editorial.article_version_trust_revisions`

## Functions to create

1. `editorial.validate_citation_locator(text, jsonb)`
2. `editorial.validate_citation_target_anchor(text, jsonb)`
3. `editorial.enforce_citation_integrity()`
4. `editorial.enforce_article_version_trust_attachment()`
5. `editorial.enforce_primary_author_credit()`
6. immutable-row protection functions where an existing reusable function is not suitable

## Citation locator authority

Supported initial locator types:

- page
- page_range
- paragraph
- quotation
- timestamp
- timestamp_range
- chapter
- image_frame
- spreadsheet_row
- spreadsheet_cell
- archive_identifier
- transcript_range
- section_heading
- whole_source
- other

Validation is strict:

- reject null JSON
- reject unknown types
- reject missing keys
- reject incorrect JSON value types
- reject unsupported extra keys
- reject negative positions
- reject inverted ranges
- reject blank required text values

## Target anchor authority

Supported initial anchors:

- whole_version
- block_id
- heading_id
- paragraph_id
- character_range
- structured_node

Durable anchors must not depend on rendered paragraph position or HTML indexes.

## Article attachment authority

Both Citation and Credit attachments initially support only:

- `resource_kind = 'article'`
- `target_version_type = 'article_version'`

The target Article version must:

- exist
- belong to the supplied resource
- have a valid `editorial.article_resources` binding

## Ordering authority

Attachment display order is zero-based.

Stored attachment sets must not contain:

- negative order values
- duplicate order values within one Article version
- duplicate attachment identity

Contiguous-set enforcement belongs primarily in replacement commands planned for Migration 3.

Migration 2 establishes non-negative and uniqueness backstops.

## Credit authority

Credit identity remains immutable.

Credit publication state remains in `editorial.credit_governance`.

A public-safe Credit attachment requires:

- governance `public_safe = true`
- governance `credit_state = 'active'`

At most one attached Credit whose role is `author` may have `is_primary = true` for one exact Article version.

## Citation authority

Citation identity is immutable.

A Citation references exactly one Source version.

Citation integrity requires:

- Source version belongs to Source
- locator passes SQL validation
- public-safe Citation points to an approved Source version
- Source exposure is `public` or `public_redacted`
- Source is not withdrawn when the Citation is created

A public-safe Citation attachment requires a public-safe Citation.

## Trust revision authority

`editorial.article_version_trust_revisions` provides independent concurrency control for Citation and Credit attachment sets.

It must not alter Article draft revision or Article lifecycle revision.

Initial values:

- `citation_revision = 1`
- `credit_revision = 1`

Direct authenticated mutation is denied.

Migration 3 commands will lazily create, lock, compare, and increment these rows.

## Source Registry link authority

The exact allowed Registry target kinds, foreign-key strategy, uniqueness, and public-safety rules must follow the locked Phase 3A schema design and live Registry key authority gathered during the implementation audit.

## Deletion and immutability

Immutable identity rows must reject direct update and delete.

Attachment deletion remains restricted to trusted commands introduced in Migration 3.

Authenticated clients receive no direct insert, update, or delete authority over Migration 2 tables.

## RLS boundary

All Migration 2 tables must have RLS enabled.

No public read authority is added by Migration 2.

Authenticated reads must follow the locked Phase 3A trust capability and Article edit-authority model.

Service-role access remains available for trusted server-side commands and verification.

## Index plan

At minimum:

- Source Registry link target lookup
- Citation Source and Source-version lookup
- Citation state and creation order
- Article-version Citation attachment ordering
- Article-version Credit attachment ordering
- Credit attachment lookup
- uniqueness for normalized Citation attachment identity
- uniqueness for one Credit per Article version
- partial uniqueness for one primary author per Article version

## Verifier responsibilities

The dedicated verifier must confirm:

- all five tables exist
- all required columns exist
- all foreign keys and checks exist
- locator and target-anchor validators reject malformed input
- Article-version attachment integrity trigger exists
- Citation integrity trigger exists
- primary-author integrity trigger exists
- immutable identity protections exist
- duplicate attachment protections exist
- ordering protections exist
- RLS is enabled
- authenticated direct writes are not granted
- no public read policy exists
- Migration 1 objects remain intact

## Final implementation authority

The implementation audit confirmed:

- all six supported Registry authorities use UUID primary keys
- supported entity types are initially limited to:
  - `artist`
  - `author`
  - `genre`
  - `label`
  - `release`
  - `track`
- Source Registry links validate directly against their underlying Registry tables
- `public.registry_canonical_entity_index` remains a read view and is not used as a foreign-key target
- Source Registry link identity is:
  - Source version
  - Registry entity type
  - Registry entity ID
  - relationship role
- Source Registry links are append-only identity rows
- authenticated users receive read authority only through trust capabilities
- service role retains trusted write authority
- no anonymous or public read policy is introduced
- Article attachment reads may additionally use Article edit authority
- direct authenticated writes remain denied

The migration must use the live Registry state fields proven by the final authority audit. It must not invent a common Registry lifecycle column where the underlying tables differ.

## Citation lifecycle resolution

Citation identity remains immutable.

The only permitted Citation update is a trusted terminal lifecycle transition:

- `active` to `withdrawn`
- `active` to `archived`

No transition from a terminal state is permitted.

No Citation delete is permitted.

A trusted lifecycle transition must set this transaction-local gate before updating the Citation:

`set_config('wakilisha.trusted_citation_lifecycle', 'on', true)`

The gate does not grant database update authority. Authenticated clients still have no direct update grant.

Migration 3 commands must:

1. verify caller authority
2. lock the Citation row
3. verify the Citation is active
4. set the transaction-local lifecycle gate
5. change only `citation_state`
6. leave all Citation identity and presentation fields unchanged
