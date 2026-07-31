# Phase 3A Sources, Citations, and Credits Schema Design

Date: 31 July 2026

## Status

Schema contract proposed for implementation.

This document translates the locked Phase 3A authority boundary into an implementable PostgreSQL and Supabase design.

No migration should be written until this contract passes repository review.

## Design principles

The Phase 3A trust layer must provide:

- reusable Source records
- immutable Source versions
- typed Source locators
- version-bound Citations
- explicit credited-party identity
- version-bound Credits
- Source withdrawal without historical erasure
- narrow internal and public read models
- transactional mutation commands
- reusable foundations for Articles, Registry changes, Playlists, Audio, Video, Charts, and Inquiry

The design must preserve:

- one canonical authority per object
- Article lifecycle authority
- Registry authority
- Media authority
- authenticated account authority
- public author-profile authority
- immutable Article versions
- public publication snapshots

## Schema location

Canonical trust tables belong in the `editorial` schema.

Reasons:

- trust infrastructure is internal platform authority
- direct anonymous table access should not be required
- public presentation should use narrow allowlisted views or functions
- shared trust records must not become ordinary mutable public tables

Public read models belong in the `public` schema.

## Capability additions

Add the following capability definitions:

- `view_trust_records`
- `manage_sources`
- `review_sources`
- `withdraw_sources`
- `manage_citations`
- `manage_credits`

Recommended initial role assignments:

### administrator

- all six capabilities

### editor

- `view_trust_records`
- `manage_sources`
- `manage_citations`
- `manage_credits`

### reviewer

- `view_trust_records`
- `review_sources`

### registry_editor

- `view_trust_records`
- `manage_sources`
- `manage_citations`

No capability is granted to `author` by default.

Article-specific commands must additionally verify Article edit authority.

## Controlled vocabularies

Controlled values should use reference tables rather than scattered free-text checks where future extension is expected.

### Source types

Table:

`editorial.source_types`

Columns:

- `source_type text primary key`
- `label text not null`
- `description text not null`
- `enabled boolean not null default true`
- `sort_order integer not null default 100`
- `created_at timestamptz not null default now()`

Initial values:

- `interview`
- `book`
- `article`
- `archive_document`
- `photograph`
- `audio_recording`
- `video_recording`
- `registry_record`
- `community_memory`
- `institutional_document`
- `social_post`
- `dataset`
- `website`
- `physical_artefact`
- `other`

### Citation locator types

Table:

`editorial.citation_locator_types`

Columns:

- `locator_type text primary key`
- `label text not null`
- `description text not null`
- `enabled boolean not null default true`
- `sort_order integer not null default 100`
- `created_at timestamptz not null default now()`

Initial values:

- `page`
- `page_range`
- `paragraph`
- `quotation`
- `timestamp`
- `timestamp_range`
- `chapter`
- `image_frame`
- `spreadsheet_row`
- `spreadsheet_cell`
- `archive_identifier`
- `transcript_range`
- `section_heading`
- `whole_source`
- `other`

### Credit roles

Table:

`editorial.credit_roles`

Columns:

- `credit_role text primary key`
- `label text not null`
- `description text not null`
- `enabled boolean not null default true`
- `sort_order integer not null default 100`
- `created_at timestamptz not null default now()`

Initial values:

- `author`
- `editor`
- `curator`
- `researcher`
- `interviewer`
- `producer`
- `host`
- `guest`
- `camera`
- `audio`
- `translator`
- `photographer`
- `contributor`
- `reviewer`
- `fact_checker`
- `other`

## Source identity

### Table

`editorial.sources`

### Purpose

Stable reusable Source identity and mutable workflow state.

Mutable Source rows hold:

- the current editable metadata
- review workflow state
- public-exposure state
- withdrawal state
- pointers to exact immutable Source versions

### Columns

- `id uuid primary key default gen_random_uuid()`
- `source_type text not null`
- `title text not null`
- `creator_display text`
- `publisher_display text`
- `source_url text`
- `media_asset_id uuid`
- `archive_identifier text`
- `publication_date date`
- `capture_date date`
- `retrieval_date date`
- `language_code text`
- `country_code text`
- `place_text text`
- `rights_status text not null default 'unknown'`
- `consent_status text not null default 'unknown'`
- `sensitivity text not null default 'none'`
- `reliability_note text`
- `credit_line text`
- `internal_notes text`
- `review_status text not null default 'draft'`
- `exposure_class text not null default 'internal'`
- `source_state text not null default 'active'`
- `current_working_version_id uuid`
- `current_submitted_version_id uuid`
- `current_approved_version_id uuid`
- `working_revision bigint not null default 1`
- `created_by uuid`
- `updated_by uuid`
- `reviewed_by uuid`
- `reviewed_at timestamptz`
- `withdrawn_by uuid`
- `withdrawn_at timestamptz`
- `withdrawal_reason text`
- `withdrawal_public_mode text not null default 'hide_public_reference'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### Foreign keys

- `source_type` references `editorial.source_types(source_type)`
- `media_asset_id` references `public.registry_media_assets(id)` with `on delete set null`
- actor columns reference `auth.users(id)` with `on delete set null`
- Source-version pointers reference `editorial.source_versions(id)` after both tables exist

### Constraints

Title:

- `btrim(title) <> ''`

Working revision:

- `working_revision >= 1`

Review status:

- `draft`
- `ready_for_review`
- `in_review`
- `changes_requested`
- `approved`
- `rejected`

Exposure class:

- `public`
- `public_redacted`
- `internal`
- `restricted`
- `confidential`

Source state:

- `active`
- `withdrawn`
- `archived`

Sensitivity:

- `none`
- `low`
- `moderate`
- `high`
- `extreme`

Rights status:

- `unknown`
- `owned`
- `licensed`
- `public_domain`
- `fair_use`
- `needs_clearance`
- `restricted`

Consent status:

- `unknown`
- `not_required`
- `requested`
- `granted`
- `limited`
- `declined`
- `withdrawn`

Withdrawal public mode:

- `retain_public_reference`
- `redact_public_reference`
- `hide_public_reference`

Review and exposure integrity:

- approved Sources require `reviewed_by`, `reviewed_at`, and `current_approved_version_id`
- `current_submitted_version_id` is required while the Source is ready for review or in review
- Sources that are not approved cannot claim `public` or `public_redacted` exposure
- material saves clear submitted and approved pointers
- material saves reset exposure to `internal`
- withdrawn Sources require withdrawal actor, timestamp, reason, and public mode
- active and archived Sources must not carry partial withdrawal metadata
- withdrawal mode defaults to `hide_public_reference`

### Pointer integrity

A deferred constraint trigger must verify:

- every non-null Source-version pointer belongs to the same Source
- the submitted pointer identifies the exact version under review
- the approved pointer identifies the exact approved version
- trusted commands are the only supported pointer mutation path
- working, submitted, and approved pointers may identify different immutable versions

### Indexes

- `(source_type, source_state, updated_at desc)`
- `(review_status, exposure_class, updated_at desc)`
- `(current_working_version_id)` where not null
- `(current_submitted_version_id)` where not null
- `(current_approved_version_id)` where not null
- `(media_asset_id)` where not null
- `(source_url)` where not null
- `(archive_identifier)` where not null
- GIN or trigram search support may be added later

## Immutable Source versions

### Table

`editorial.source_versions`

### Purpose

Immutable Source metadata snapshots used by Citations, review pointers, and historical publication records.

Review workflow state is not stored inside immutable Source versions.

Approval is represented by `editorial.sources.current_approved_version_id`.

### Columns

- `id uuid primary key default gen_random_uuid()`
- `source_id uuid not null`
- `version_number bigint not null`
- `source_type text not null`
- `title text not null`
- `creator_display text`
- `publisher_display text`
- `source_url text`
- `media_asset_id uuid`
- `archive_identifier text`
- `publication_date date`
- `capture_date date`
- `retrieval_date date`
- `language_code text`
- `country_code text`
- `place_text text`
- `rights_status text not null`
- `consent_status text not null`
- `sensitivity text not null`
- `reliability_note text`
- `credit_line text`
- `internal_notes text`
- `created_by uuid`
- `created_at timestamptz not null default now()`
- `content_fingerprint text not null`

### Foreign keys

- `source_id` references `editorial.sources(id)` with `on delete restrict`
- `source_type` references `editorial.source_types(source_type)`
- `media_asset_id` references `public.registry_media_assets(id)` with `on delete set null`
- `created_by` references `auth.users(id)` with `on delete set null`

### Constraints

- `version_number >= 1`
- unique `(source_id, version_number)`
- unique `(source_id, content_fingerprint)`
- `btrim(title) <> ''`
- `btrim(content_fingerprint) <> ''`
- sensitivity, rights, and consent values match the Source contract
- update and delete are blocked by an immutability trigger
- Source versions referenced by Citations cannot be deleted
- Source versions referenced by working, submitted, or approved pointers cannot be deleted

### Fingerprint

Create:

`editorial.source_snapshot_fingerprint(...)`

The fingerprint includes every metadata field that can change historical interpretation:

- Source type
- title
- creator
- publisher
- URL
- Media asset
- archive identifier
- dates
- language
- place
- rights
- consent
- sensitivity
- reliability note
- credit line
- internal notes

The fingerprint excludes mutable workflow fields:

- review status
- exposure class
- Source state
- reviewer identity
- review timestamp
- withdrawal metadata
- Source-version pointers
- working revision

The function must be immutable and deterministic.

### No-op saves

A save that produces the same fingerprint as the current working version is a no-op.

It must:

- return the existing working Source version
- leave the working revision unchanged
- avoid creating duplicate version history
- avoid resetting review state unnecessarily

### Source-version pointer integrity

After `editorial.source_versions` exists, add foreign keys for:

- `editorial.sources.current_working_version_id`
- `editorial.sources.current_submitted_version_id`
- `editorial.sources.current_approved_version_id`

A deferred constraint trigger verifies that every pointer belongs to the same Source.

## Source Registry links

### Table

`editorial.source_registry_links`

### Purpose

Reviewed contextual links between an exact Source version and canonical Registry entities.

### Columns

- `source_id uuid not null`
- `source_version_id uuid not null`
- `registry_entity_type text not null`
- `registry_entity_id uuid not null`
- `relationship_role text not null default 'context'`
- `created_by uuid`
- `created_at timestamptz not null default now()`

### Foreign keys

- `source_id` references `editorial.sources(id)` with `on delete restrict`
- `source_version_id` references `editorial.source_versions(id)` with `on delete restrict`
- `created_by` references `auth.users(id)` with `on delete set null`

### Primary key

Use:

`(source_version_id, registry_entity_type, registry_entity_id, relationship_role)`

### Relationship roles

Initial values:

- `subject`
- `creator`
- `publisher`
- `custodian`
- `mentioned`
- `context`

### Integrity rules

A constraint trigger must verify:

- `source_version_id` belongs to `source_id`
- `relationship_role` is supported
- the Registry entity exists in a supported canonical authority
- free-text slugs are not accepted as authority
- archived or unresolved Registry shells are rejected unless explicitly allowed by later policy

### Registry validation boundary

`public.registry_canonical_entity_index` is a view and cannot be a foreign-key target.

The implementation must therefore validate against the underlying authoritative Registry tables.

The first supported entity types should be limited to authorities proven by the repository audit.

Do not create a generic unverified polymorphic link to arbitrary public tables.

## Citation identity

### Table

`editorial.citations`

### Purpose

Stable Citation identity pointing to one exact Source version and one structured locator.

### Columns

- `id uuid primary key default gen_random_uuid()`
- `source_id uuid not null`
- `source_version_id uuid not null`
- `locator_type text not null`
- `locator_data jsonb not null default '{}'::jsonb`
- `quotation text`
- `editor_note text`
- `public_label text`
- `public_safe boolean not null default false`
- `citation_state text not null default 'active'`
- `created_by uuid`
- `created_at timestamptz not null default now()`

### Foreign keys

- `source_id` references `editorial.sources(id)` with `on delete restrict`
- `source_version_id` references `editorial.source_versions(id)` with `on delete restrict`
- `locator_type` references `editorial.citation_locator_types(locator_type)`
- `created_by` references `auth.users(id)` with `on delete set null`

### Citation state

Supported values:

- `active`
- `withdrawn`
- `archived`

### Core integrity

A Citation must satisfy:

- `source_version_id` belongs to `source_id`
- locator data matches the selected locator type
- public-safe Citations use approved Source versions
- public-safe Citations use Source versions with exposure `public` or `public_redacted`
- public-safe Citations cannot use a Source version already withdrawn at creation time
- Citation identity does not change when display formatting changes

### Immutability

Citations are immutable after creation.

Corrections create:

- a replacement Citation
- a new attachment
- an archived or withdrawn prior Citation where appropriate

Direct updates and deletes are blocked.

## Citation locator validation

Create:

`editorial.validate_citation_locator(p_locator_type text, p_locator_data jsonb)`

The function must raise a clear exception for unsupported or malformed locator data.

### page

Required shape:

`{"page": 12}`

Rules:

- `page` is an integer
- `page >= 1`

### page_range

Required shape:

`{"startPage": 12, "endPage": 15}`

Rules:

- both values are integers
- both values are at least 1
- `endPage >= startPage`

### paragraph

Required shape:

`{"paragraph": 4}`

Rules:

- paragraph is an integer
- paragraph is at least 1

### quotation

Required shape:

`{"quotation": "Exact quoted portion"}`

Rules:

- quotation is a non-blank string
- quotation length limits are enforced separately

### timestamp

Required shape:

`{"milliseconds": 72000}`

Rules:

- milliseconds is an integer
- milliseconds is at least 0

### timestamp_range

Required shape:

`{"startMilliseconds": 72000, "endMilliseconds": 91000}`

Rules:

- both values are integers
- both are at least 0
- end is not earlier than start

### chapter

Required shape:

`{"chapter": "Chapter 3"}`

Rules:

- chapter is a non-blank string

### image_frame

Required shape:

`{"frame": 24}`

Rules:

- frame is an integer
- frame is at least 0

### spreadsheet_row

Required shape:

`{"sheet": "Sheet1", "row": 24}`

Rules:

- sheet is a non-blank string
- row is an integer at least 1

### spreadsheet_cell

Required shape:

`{"sheet": "Sheet1", "cell": "C24"}`

Rules:

- sheet is a non-blank string
- cell matches a spreadsheet-cell format

### archive_identifier

Required shape:

`{"identifier": "BOX-4-FILE-17"}`

Rules:

- identifier is a non-blank string

### transcript_range

Required shape:

`{"startMilliseconds": 72000, "endMilliseconds": 91000}`

Rules:

- both values are integers
- both are at least 0
- end is not earlier than start

### section_heading

Required shape:

`{"heading": "Early career"}`

Rules:

- heading is a non-blank string

### whole_source

Required shape:

`{}`

Rules:

- no narrower locator is required
- extra locator fields should be rejected unless explicitly supported later

### other

Required shape:

`{"label": "Custom locator"}`

Rules:

- label is a non-blank string
- use of `other` should remain reviewable and uncommon

### Validator strictness

The validator must reject:

- missing required keys
- incorrect JSON value types
- negative numeric positions
- inverted ranges
- unsupported extra keys where strictness is practical
- unknown locator types
- null locator data

Validation must occur in SQL and not only in frontend code.

## Resource Citation attachments

### Table

`editorial.resource_citations`

### Purpose

Attach one immutable Citation to one canonical resource and one exact target version.

### Columns

- `id uuid primary key default gen_random_uuid()`
- `resource_id uuid not null`
- `resource_kind text not null`
- `target_version_type text not null`
- `target_version_id uuid not null`
- `citation_id uuid not null`
- `citation_purpose text not null default 'supports'`
- `target_anchor_type text not null default 'whole_version'`
- `target_anchor_data jsonb not null default '{}'::jsonb`
- `display_order integer not null default 0`
- `public_safe boolean not null default false`
- `created_by uuid`
- `created_at timestamptz not null default now()`

### Foreign keys

- `(resource_id, resource_kind)` references `editorial.resources(id, resource_kind)` with `on delete cascade`
- `citation_id` references `editorial.citations(id)` with `on delete restrict`
- `created_by` references `auth.users(id)` with `on delete set null`

### Initial target-version support

Initial supported value:

- `article_version`

For `article_version` attachments:

- `resource_kind` must equal `article`
- `target_version_id` must identify `editorial.article_versions.id`
- the Article version must belong to `resource_id`
- the Article version must remain immutable
- attachment creation must not modify the Article version

Future target-version types may be added without replacing this authority.

### Citation purposes

Supported values:

- `supports`
- `challenges`
- `contextualizes`
- `quotes`
- `documents`
- `methodology`
- `other`

### Target anchor types

Initial values:

- `whole_version`
- `block_id`
- `heading_id`
- `paragraph_id`
- `character_range`
- `structured_node`

The first Article proof may use `whole_version`.

### Target anchor validation

Create:

`editorial.validate_citation_target_anchor(p_anchor_type text, p_anchor_data jsonb)`

Validation rules must include:

- `whole_version` requires an empty object
- ID-based anchors require one non-blank identifier
- character ranges require non-negative start and end values
- end must not be earlier than start
- unknown anchor types are rejected
- malformed JSON is rejected

Do not derive durable anchors from rendered paragraph order or HTML indexes.

### Integrity constraints

- `display_order >= 0`
- Citation target version belongs to the same resource
- Citation target-version type is supported
- target anchor data passes SQL validation
- public-safe attachment requires a public-safe Citation
- duplicate attachment at the same target, purpose, and anchor is rejected
- direct update and delete are denied to authenticated clients

### Duplicate identity

The first implementation should prevent duplicate attachments using a unique expression or normalized anchor fingerprint covering:

- resource ID
- target-version type
- target-version ID
- Citation ID
- Citation purpose
- target-anchor type
- normalized target-anchor data

## External contributors

### Table

`editorial.external_contributors`

### Purpose

Stable identity for named creditable people who are not represented by an authenticated-user Credit or Registry-author Credit.

### Columns

- `id uuid primary key default gen_random_uuid()`
- `display_name text not null`
- `public_role text`
- `public_url text`
- `location_text text`
- `contact_email text`
- `contact_phone text`
- `consent_status text not null default 'unknown'`
- `public_safe boolean not null default false`
- `contributor_state text not null default 'active'`
- `internal_notes text`
- `created_by uuid`
- `updated_by uuid`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### Foreign keys

- `created_by` references `auth.users(id)` with `on delete set null`
- `updated_by` references `auth.users(id)` with `on delete set null`

### Constraints

Display name:

- `btrim(display_name) <> ''`

Contributor state:

- `active`
- `withdrawn`
- `archived`

Consent status:

- `unknown`
- `not_required`
- `requested`
- `granted`
- `limited`
- `declined`
- `withdrawn`

Public-safety integrity:

- public-safe requires consent `granted` or `not_required`
- withdrawn contributors cannot be newly marked public-safe
- contact fields remain internal regardless of public-safe state

### Identity boundary

External contributors are not:

- authenticated accounts
- Registry authors
- public user profiles
- contributor-submission records
- Article byline strings

No automatic mapping from `public.contributors` is permitted in the first migration.

### Mutation boundary

External contributors may be edited through trusted commands.

Historical Credits must not read mutable external-contributor fields at render time.

## Credit identity

### Table

`editorial.credits`

### Purpose

Immutable typed contribution identity with one explicit credited-party authority.

### Columns

- `id uuid primary key default gen_random_uuid()`
- `credit_role text not null`
- `user_id uuid`
- `registry_author_id uuid`
- `external_contributor_id uuid`
- `display_name_snapshot text not null`
- `role_label_snapshot text`
- `credit_note text`
- `public_safe boolean not null default false`
- `credit_state text not null default 'active'`
- `created_by uuid`
- `created_at timestamptz not null default now()`

### Foreign keys

- `credit_role` references `editorial.credit_roles(credit_role)`
- `user_id` references `auth.users(id)` with `on delete set null`
- `registry_author_id` references `public.registry_authors(id)` with `on delete set null`
- `external_contributor_id` references `editorial.external_contributors(id)` with `on delete set null`
- `created_by` references `auth.users(id)` with `on delete set null`

### Exactly-one credited-party constraint

Exactly one of these fields must be non-null:

- `user_id`
- `registry_author_id`
- `external_contributor_id`

Use a numeric boolean-sum check equivalent to:

`num_nonnulls(user_id, registry_author_id, external_contributor_id) = 1`

The migration must verify that `num_nonnulls` is available in the deployed PostgreSQL version before relying on it.

A manual boolean-sum expression may be used if required.

### Snapshot rules

- `btrim(display_name_snapshot) <> ''`
- display snapshot is captured when the Credit is created
- later profile changes do not alter the Credit
- role label snapshot may preserve publication wording
- Credit note is separate from the controlled role

### Credit state

Supported values:

- `active`
- `withdrawn`
- `archived`

### Public-safety rules

For an authenticated-user Credit:

- public safety is explicitly approved
- no email or account metadata becomes public

For a Registry-author Credit:

- referenced Registry author must exist
- public display may link to the Registry author route
- historical display still comes from the snapshot

For an external-contributor Credit:

- referenced contributor must be active
- contributor must be public-safe
- consent must permit public display

### Immutability

Credits are immutable after creation.

Corrections create:

- a replacement Credit
- a replacement attachment
- an archived or withdrawn previous Credit where appropriate

Direct update and delete are blocked.

## Resource Credit attachments

### Table

`editorial.resource_credits`

### Purpose

Attach one immutable Credit to one exact immutable Article version.

PR 3A does not support resource-level Credits.

### Columns

- `id uuid primary key default gen_random_uuid()`
- `resource_id uuid not null`
- `resource_kind text not null`
- `target_version_type text not null`
- `target_version_id uuid not null`
- `credit_id uuid not null`
- `display_order integer not null default 0`
- `is_primary boolean not null default false`
- `public_safe boolean not null default false`
- `created_by uuid`
- `created_at timestamptz not null default now()`

### Foreign keys

- `(resource_id, resource_kind)` references `editorial.resources(id, resource_kind)` with `on delete cascade`
- `credit_id` references `editorial.credits(id)` with `on delete restrict`
- `created_by` references `auth.users(id)` with `on delete set null`

### Initial target contract

Required values:

- `resource_kind = 'article'`
- `target_version_type = 'article_version'`
- `target_version_id` identifies `editorial.article_versions.id`

The target Article version must belong to `resource_id`.

Null target-version identity is not permitted.

Resource-level Credits require a later migration after a real cross-version use case is proven.

### Attachment constraints

- `display_order >= 0`
- public-safe attachment requires public-safe Credit
- withdrawn or archived Credits cannot receive new public-safe attachments
- duplicate Credit attachment to the same Article version is rejected
- direct authenticated mutation is denied

### Primary author rule

Enforce at most one primary `author` Credit per exact Article version.

The enforcement must inspect the referenced Credit role.

Use:

- transactional command validation
- an integrity trigger as database backstop
- locking through `editorial.article_version_trust_revisions`

### Ownership and byline separation

Creating or attaching a Credit must not modify:

- `editorial.resources.owner_id`
- `editorial.article_versions.owner_id`
- Article mutable author text
- `editorial.article_versions.author_display`
- publication snapshot `author`

Legacy byline and shared Credits coexist until explicit Article integration adopts shared Credit presentation.

## Article-version trust revisions

### Table

`editorial.article_version_trust_revisions`

### Purpose

Provide independent optimistic-concurrency authority for Citation and Credit attachment sets on one immutable Article version.

This table does not replace or increment:

- `public.wk_articles.draft_version`
- Article lifecycle revisions
- Publishing item revisions
- Article-version identity

### Columns

- `article_version_id uuid primary key`
- `citation_revision bigint not null default 1`
- `credit_revision bigint not null default 1`
- `updated_by uuid`
- `updated_at timestamptz not null default now()`

### Foreign keys

- `article_version_id` references `editorial.article_versions(id)` with `on delete cascade`
- `updated_by` references `auth.users(id)` with `on delete set null`

### Constraints

- `citation_revision >= 1`
- `credit_revision >= 1`

### Row creation

The revision row must exist before an attachment mutation succeeds.

The implementation may:

- create the row when the first trust attachment command runs, or
- create rows for existing Article versions during migration

Preferred behaviour:

- lazily insert with revision values of 1
- use `on conflict do nothing`
- lock the resulting row before validating expected revision

### Citation revision rules

Every successful Citation attachment-set mutation must:

- lock the trust-revision row
- require the current expected Citation revision
- increment `citation_revision` exactly once
- leave `credit_revision` unchanged
- record `updated_by`
- update `updated_at`

A failed or no-op Citation command must not increment the revision.

### Credit revision rules

Every successful Credit attachment-set mutation must:

- lock the trust-revision row
- require the current expected Credit revision
- increment `credit_revision` exactly once
- leave `citation_revision` unchanged
- record `updated_by`
- update `updated_at`

A failed or no-op Credit command must not increment the revision.

### Direct mutation boundary

Authenticated clients cannot directly insert, update, or delete trust-revision rows.

Only trusted Citation and Credit commands may mutate them.

### Article isolation

Trust-revision changes must not:

- increment Article `draft_version`
- create a new Article version
- change Article lifecycle
- change Article ownership
- change Article byline
- change publication pointers

## Article-version integrity triggers

Create one narrow integrity function for Article-version attachments.

Recommended function:

`editorial.enforce_article_version_trust_attachment()`

It should validate both Citation and Credit attachment tables.

Required checks:

- target type is `article_version`
- resource kind is `article`
- Article version exists
- Article version belongs to the supplied resource
- resource has a valid `editorial.article_resources` binding
- target Article version remains immutable
- unsupported target-version types are rejected

The function must not:

- mutate Article lifecycle
- change resource ownership
- change Article content
- change publication pointers
- publish or unpublish an Article

## Attachment ordering

Citation and Credit display order must be deterministic.

Commands should normalize ordering to:

- zero-based contiguous integers, or
- one-based contiguous integers

Choose one convention and use it consistently.

Recommended convention:

- zero-based contiguous integers

Replacement commands must reject:

- duplicate order values
- negative values
- gaps, unless commands normalize them before insert
- duplicate attachment identities

## Source review events

### Table

`editorial.source_review_events`

### Purpose

Append-only history of Source review decisions and withdrawal actions.

### Columns

- `id uuid primary key default gen_random_uuid()`
- `source_id uuid not null`
- `source_version_id uuid`
- `actor_id uuid`
- `action text not null`
- `reason text`
- `prior_review_status text`
- `resulting_review_status text`
- `prior_exposure_class text`
- `resulting_exposure_class text`
- `prior_source_state text`
- `resulting_source_state text`
- `correlation_id uuid`
- `created_at timestamptz not null default now()`

### Foreign keys

- `source_id` references `editorial.sources(id)` with `on delete restrict`
- `source_version_id` references `editorial.source_versions(id)` with `on delete restrict`
- `actor_id` references `auth.users(id)` with `on delete set null`

### Supported actions

Initial values:

- `created`
- `version_saved`
- `review_started`
- `changes_requested`
- `approved`
- `rejected`
- `withdrawn`
- `archived`
- `restored`

### Rules

- append-only
- no direct authenticated insert
- written only through trusted commands
- reason is required for rejection, changes requested, withdrawal, archival, and restoration
- correlation ID should be populated when the command infrastructure provides one
- no public access in PR 3A

## Transactional Source commands

Authenticated clients must not directly mutate canonical Source tables.

All Source commands are synchronous and transactional.

They do not create:

- command receipts
- jobs
- outbox events

An optional `correlation_id` may be recorded in Source review events.

### `public.create_source`

Purpose:

Create one Source working row and immutable Source version 1 atomically.

Inputs:

- complete Source metadata JSON
- optional Registry-link payload
- optional correlation ID

Required capability:

- `manage_sources`

Required behaviour:

1. validate actor capability
2. validate controlled vocabulary values
3. validate Media asset where supplied
4. calculate the Source content fingerprint
5. create the mutable Source row
6. create immutable Source version 1
7. create validated Registry links for version 1
8. set `current_working_version_id`
9. leave submitted and approved pointers null
10. set review status to `draft`
11. set exposure class to `internal`
12. record a Source review event
13. return Source ID, Source version ID, and working revision

The command must not create an approved or publicly exposed Source.

### `public.save_source_version`

Purpose:

Save one new immutable Source version when Source metadata materially changes.

Inputs:

- Source ID
- expected working revision
- complete Source metadata JSON
- optional Registry-link payload
- reason or note
- optional correlation ID

Required capability:

- `manage_sources`

Required behaviour:

1. lock the Source row
2. verify expected working revision
3. reject stale updates
4. reject edits to withdrawn Sources unless restored first
5. validate all Source metadata
6. calculate the proposed fingerprint
7. compare it with the current working Source version
8. return the existing version without mutation when fingerprints match
9. create the next immutable Source version when fingerprints differ
10. replace Registry links for the new version atomically
11. update the mutable working metadata
12. move `current_working_version_id`
13. clear `current_submitted_version_id`
14. clear `current_approved_version_id`
15. reset exposure class to `internal`
16. set review status to `changes_requested` when prior review history exists, otherwise `draft`
17. increment working revision
18. append a Source review event
19. return the resulting Source version and revision

A no-op save must not:

- create a Source version
- increment working revision
- reset review state
- create a review event that claims material change

### `public.submit_source_version_for_review`

Purpose:

Submit the exact current working Source version for governed review.

Inputs:

- Source ID
- working Source-version ID
- expected working revision
- optional reason
- optional correlation ID

Required capability:

- `manage_sources`

Required behaviour:

1. lock the Source row
2. verify expected working revision
3. verify the supplied Source version belongs to the Source
4. verify it equals `current_working_version_id`
5. move `current_submitted_version_id`
6. set review status to `ready_for_review`
7. keep exposure class `internal`
8. append a Source review event
9. return Source ID, submitted version ID, and working revision

Submission does not create or mutate a Source version.

### `public.review_source_version`

Purpose:

Apply one governed review decision to the exact submitted Source version.

Inputs:

- Source ID
- Source-version ID
- decision
- reason
- resulting exposure class
- optional correlation ID

Required capability:

- `review_sources`

Supported decisions:

- `start_review`
- `request_changes`
- `approve`
- `reject`

Required behaviour:

- lock the Source row
- verify Source-version ownership
- verify the Source version equals `current_submitted_version_id`
- verify the requested transition is valid
- require a reason where appropriate
- preserve every immutable Source-version row
- append a Source review event

Decision behaviour:

`start_review`:

- set review status to `in_review`
- keep submitted pointer unchanged
- keep exposure class `internal`

`request_changes`:

- set review status to `changes_requested`
- clear submitted pointer
- clear approved pointer
- set exposure class to `internal`

`approve`:

- set review status to `approved`
- move `current_approved_version_id` to the exact submitted version
- preserve `current_submitted_version_id`
- record reviewer and review time
- require explicit exposure class
- permit only `public`, `public_redacted`, or `internal`

`reject`:

- set review status to `rejected`
- clear approved pointer
- set exposure class to `internal`

Approval must not update the immutable Source-version row.

### `public.withdraw_source`

Purpose:

Withdraw one Source without deleting historical identity.

Inputs:

- Source ID
- reason
- optional withdrawal public mode
- optional correlation ID

Required capability:

- `withdraw_sources`

Required behaviour:

- lock Source
- reject duplicate withdrawal
- require a non-blank reason
- use `hide_public_reference` when no mode is supplied
- validate explicitly supplied withdrawal mode
- record actor and timestamp
- set Source state to `withdrawn`
- block new public-safe Citation creation and attachment
- preserve Source versions, Citations, and attachments
- append a Source review event

Withdrawal does not create or mutate a Source version because withdrawal is workflow and presentation state, not Source metadata.

### `public.restore_source`

Purpose:

Restore a withdrawn Source to an internal reviewable state.

Inputs:

- Source ID
- reason
- optional correlation ID

Required capability:

- `withdraw_sources`

Required behaviour:

- lock the Source row
- require a non-blank reason
- clear active withdrawal metadata
- set Source state to `active`
- set review status to `changes_requested`
- set exposure class to `internal`
- clear submitted and approved pointers
- require fresh submission and approval
- append a Source review event

Restoration does not alter immutable Source versions.

## Transactional Citation commands

All Citation and Citation-attachment commands are synchronous and transactional.

### `public.create_citation`

Purpose:

Create one immutable Citation against one exact Source version.

Inputs:

- Source ID
- Source-version ID
- locator type
- locator data
- optional quotation
- optional editor note
- optional public label
- requested public-safe state

Required capability:

- `manage_citations`

Required behaviour:

- validate Source and Source-version identity
- validate locator in SQL
- verify Source version belongs to the Source
- verify public-safe eligibility
- reject new public-safe use when the Source is withdrawn
- require the Source version to equal `current_approved_version_id` for public-safe use
- require Source exposure `public` or `public_redacted` for public-safe use
- create immutable Citation identity
- return Citation ID

The command does not attach the Citation to a resource.

Citation quotation and editor note remain internal in PR 3A.

### `public.attach_article_version_citation`

Purpose:

Attach one Citation to one immutable Article version.

Inputs:

- Article-version ID
- Citation ID
- Citation purpose
- target-anchor type
- target-anchor data
- display order
- requested public-safe state
- expected Citation revision

Required capabilities:

- `manage_citations`
- Article edit authority through `editorial.current_user_can_edit_article(resource_id)`

Required behaviour:

1. resolve Article resource from the Article version
2. verify Article-version identity
3. lock `editorial.article_version_trust_revisions`
4. verify expected Citation revision
5. validate target anchor
6. validate Citation state
7. validate public-safety eligibility
8. reject duplicate attachment
9. insert one attachment
10. increment Citation revision
11. return attachment ID and resulting Citation revision

### `public.replace_article_version_citations`

Purpose:

Atomically replace the complete ordered Citation attachment set for one Article version.

Inputs:

- Article-version ID
- ordered Citation attachment JSON
- expected Citation revision
- optional correlation ID

Required capabilities:

- `manage_citations`
- Article edit authority through `editorial.current_user_can_edit_article(resource_id)`

Required behaviour:

1. resolve the Article resource
2. verify Article-version identity
3. lock the Article-version trust-revision row
4. verify expected Citation revision
5. validate every requested Citation
6. validate every target anchor
7. reject duplicate Citation identities
8. reject duplicate order values
9. require zero-based contiguous ordering
10. reject malformed or incomplete payloads
11. replace the complete attachment set atomically
12. increment Citation revision exactly once
13. return the ordered attachment set and resulting revision

Failure must leave:

- the previous attachment set unchanged
- the Citation revision unchanged

Client-side repeated insert and delete calls are not the canonical replacement path.

## Transactional Credit commands

All Credit and Credit-attachment commands are synchronous and transactional.

### `public.create_external_contributor`

Purpose:

Create one stable external-contributor identity.

Inputs:

- public identity fields
- private contact fields
- consent status
- public-safety state
- internal notes

Required capability:

- `manage_credits`

Required behaviour:

- validate display name
- validate consent
- reject public-safe state without permitted consent
- keep contact fields internal
- return external contributor ID

### `public.update_external_contributor`

Purpose:

Update the mutable external-contributor profile without rewriting historical Credits.

Required capability:

- `manage_credits`

Rules:

- public-safety changes must respect consent
- withdrawal blocks new public-safe Credits
- historical Credit snapshots remain unchanged
- contact fields remain restricted

### `public.create_credit`

Purpose:

Create one immutable Credit.

Inputs:

- credit role
- exactly one credited-party identity
- optional role-label override
- optional credit note
- requested public-safe state

Required capability:

- `manage_credits`

Required behaviour:

- validate `num_nonnulls(...) = 1`
- validate the selected credited-party authority
- resolve the current display name
- store `display_name_snapshot`
- store role-label snapshot where supplied
- store Registry-author slug snapshot where applicable
- store authenticated-user username snapshot internally where applicable
- validate public-safety rules
- create immutable Credit
- return Credit ID

Identity resolution:

- authenticated user uses `public.user_profiles.display_name`
- Registry author uses `public.registry_authors.name`
- external contributor uses `editorial.external_contributors.display_name`

No fallback name matching is allowed.

Authenticated-user Credits do not expose a public profile route in PR 3A.

### `public.attach_article_version_credit`

Purpose:

Attach one Credit to one immutable Article version.

Inputs:

- Article-version ID
- Credit ID
- display order
- primary flag
- requested public-safe state
- expected Credit revision

Required capabilities:

- `manage_credits`
- Article edit authority through `editorial.current_user_can_edit_article(resource_id)`

Required behaviour:

1. resolve the Article resource
2. verify Article-version identity
3. lock `editorial.article_version_trust_revisions`
4. verify expected Credit revision
5. validate Credit state
6. validate public safety
7. enforce deterministic ordering
8. enforce at most one primary author
9. insert the attachment
10. increment Credit revision
11. return attachment ID and resulting Credit revision

### `public.replace_article_version_credits`

Purpose:

Atomically replace the complete ordered Credit attachment set for one Article version.

Inputs:

- Article-version ID
- ordered Credit attachment JSON
- expected Credit revision
- optional correlation ID

Required capabilities:

- `manage_credits`
- Article edit authority through `editorial.current_user_can_edit_article(resource_id)`

Required behaviour:

1. resolve the Article resource
2. verify Article-version identity
3. lock the Article-version trust-revision row
4. verify expected Credit revision
5. validate all Credits before mutation
6. reject duplicate Credit identities
7. reject duplicate order values
8. require zero-based contiguous ordering
9. enforce at most one primary author
10. replace the complete attachment set atomically
11. increment Credit revision exactly once
12. preserve attachments belonging to other Article versions
13. leave legacy Article byline unchanged
14. return the ordered Credit set and resulting revision

Failure must leave:

- the previous attachment set unchanged
- the Credit revision unchanged

## Canonical-table grants and RLS

All Phase 3A canonical trust tables must:

- enable RLS
- revoke all privileges from `public`
- revoke all privileges from `anon`
- revoke direct mutation privileges from `authenticated`
- grant required access to `service_role`
- expose authenticated reads only through explicit policies or narrow read models

Canonical tables include:

- `editorial.source_types`
- `editorial.citation_locator_types`
- `editorial.credit_roles`
- `editorial.sources`
- `editorial.source_versions`
- `editorial.source_registry_links`
- `editorial.citations`
- `editorial.resource_citations`
- `editorial.external_contributors`
- `editorial.credits`
- `editorial.resource_credits`
- `editorial.article_version_trust_revisions`
- `editorial.source_review_events`

Reference vocabulary tables may be selectable by authenticated users.

They must not be anonymously readable unless a public UI requires the vocabulary.

## Source read-authority helpers

Create narrow security-definer helpers.

### `editorial.current_user_can_view_source(p_source_id uuid)`

Returns true for:

- service role
- administrator
- users with `view_trust_records`
- users with Source management or review capability where allowed

It must apply stricter handling for:

- restricted Sources
- confidential Sources

### `editorial.current_user_can_manage_source(p_source_id uuid)`

Returns true for:

- service role
- administrator
- users with `manage_sources`

### `editorial.current_user_can_review_source(p_source_id uuid)`

Returns true for:

- service role
- administrator
- users with `review_sources`

### `editorial.current_user_can_view_credit(p_credit_id uuid)`

Returns true for:

- service role
- administrator
- users with `view_trust_records`
- users with `manage_credits`

These helpers must not grant Article edit authority.

Article attachment commands must separately verify Article permissions.

## Internal authenticated read models

### `public.wk_source_admin_index`

Purpose:

List Sources for ordinary internal trust work.

Recommended fields:

- Source ID
- Source type
- title
- creator display where allowed
- publisher display where allowed
- review status
- exposure class
- Source state
- current working version ID
- current submitted version ID
- current approved version ID
- working revision
- reviewed actor label
- updated actor label
- reviewed timestamp
- created timestamp
- updated timestamp

The index must not expose:

- internal notes
- restricted Source URLs
- confidential Media identity
- withdrawal reason
- reliability note
- sensitive quotation
- consent detail

### `public.wk_source_version_admin_index`

Purpose:

List immutable Source versions without restricted metadata.

Recommended fields:

- Source-version ID
- Source ID
- version number
- Source type
- title
- content fingerprint
- creator actor label
- created timestamp
- is current working version
- is current submitted version
- is current approved version

Review status and exposure class come from the mutable Source authority, not the immutable Source-version row.

### `public.get_source_admin_detail(p_source_id uuid)`

Purpose:

Return ordinary Source working state, immutable version summaries, Registry links, and review-event summaries.

Required behaviour:

- enforce Source read authority
- omit confidential-only fields
- never return data solely because the caller is authenticated
- never return contact details
- never return restricted quotations
- never return reviewer-only notes

### `public.get_source_restricted_detail(p_source_id uuid)`

Purpose:

Return restricted Source metadata to explicitly authorised trust reviewers.

The function is security definer.

Authorised callers:

- service role
- administrator
- users with `review_sources`
- users with a future explicit restricted-trust capability

`view_trust_records` alone is insufficient.

Restricted fields may include:

- internal notes
- restricted Source URL
- restricted archive identifier
- reliability note
- consent detail
- withdrawal reason
- confidential Media identity
- sensitive quotation
- reviewer-only notes

The function must return only the requested Source and must not create a broad unrestricted query surface.

### `public.wk_article_version_trust_index`

Purpose:

Provide a narrow Article-version trust summary.

Recommended fields:

- resource ID
- Article ID
- Article-version ID
- Citation revision
- Credit revision
- Citation count
- public-safe Citation count
- withdrawn Source count
- restricted Source count
- confidential Source count
- Credit count
- public-safe Credit count
- primary author Credit count
- trust warning count

This view supports later Article Workspace integration.

It does not change Article lifecycle or publication authority.

## Public Article Source read model

### View

`public.wk_public_article_sources`

### Purpose

Expose approved public-safe Source and Citation presentation for the exact active published Article version.

### Visibility rules

A row is visible only when:

- an active Article publication snapshot exists
- the Citation attachment targets the exact snapshot Article version
- the Citation attachment is public-safe
- the Citation is public-safe
- the Citation is active
- the Citation Source version equals the Source approved-version pointer
- the Source review status is `approved`
- the Source exposure class is `public` or `public_redacted`
- the Source withdrawal mode permits presentation
- the Article publication snapshot is active

### Recommended fields

- Article ID
- resource ID
- publication snapshot ID
- Article-version ID
- Citation attachment ID
- Citation ID
- Citation purpose
- Source ID
- Source-version ID
- Source type
- public Source title or redacted label
- public creator display where allowed
- public publisher display where allowed
- public Source URL where allowed
- public archive identifier where allowed
- public Citation label
- locator type
- rendered or generalized locator data
- display order

The view does not expose Citation quotation text in PR 3A.

### Redaction rules

For exposure class `public_redacted`, always hide:

- Source URL
- archive identifier
- Media asset identity
- exact quotation
- transcript extracts
- private creator identity
- private publisher or custodian identity
- precise locator details where they reveal protected material

The view may expose:

- Source type
- neutral Source title or redacted label
- generalized locator
- Citation purpose
- display order

Redaction happens in SQL.

The frontend must not receive unsafe fields and then hide them.

### Prohibited fields

The view must not expose:

- internal notes
- editor notes
- reliability notes
- consent details
- withdrawal reason
- reviewer identity
- quotation text
- transcript excerpts
- confidential Media identifiers
- actor account details

### Security

- `security_invoker = true`
- `security_barrier = true`
- grant select to `anon` and `authenticated`
- canonical trust tables remain unavailable to anonymous users
- live-schema verification must confirm the exact public column allowlist

## Public Article Credit read model

### View

`public.wk_public_article_credits`

### Purpose

Expose public-safe Credits for the exact active published Article version.

### Visibility rules

A row is visible only when:

- an active Article publication snapshot exists
- the Credit attachment targets the exact snapshot Article version
- the Credit attachment is public-safe
- the Credit is public-safe
- the Credit is active
- credited-party public rules are satisfied

Resource-level Credit fallback is not supported in PR 3A.

### Recommended fields

- Article ID
- resource ID
- publication snapshot ID
- Article-version ID
- Credit attachment ID
- Credit ID
- credit role
- display-name snapshot
- role-label snapshot
- public credit note
- Registry-author ID where applicable
- Registry-author slug snapshot where applicable
- display order
- primary flag

### Identity rules

Authenticated-user Credits:

- expose only stored display snapshot
- do not expose user ID
- do not expose username snapshot
- do not expose a `/u/:username` route
- do not expose email or account metadata

Registry-author Credits:

- expose stored display snapshot
- may expose Registry-author ID
- may expose stored Registry-author slug for `/authors/:slug`
- current profile data must not replace historical Credit text

External-contributor Credits:

- expose only stored snapshot and approved public fields
- never expose contact email
- never expose contact phone
- never expose internal notes
- require permitted consent for public-safe use

### Security

- `security_invoker = true`
- `security_barrier = true`
- grant select to `anon` and `authenticated`
- no direct public grant on canonical Credit tables

## Article trust-readiness function

Create:

`public.get_article_version_trust_readiness(p_article_version_id uuid)`

### Purpose

Return a narrow trust summary without changing Article lifecycle authority.

### Recommended result

- `article_version_id`
- `resource_id`
- `citation_count`
- `public_safe_citation_count`
- `withdrawn_source_count`
- `restricted_source_count`
- `confidential_source_count`
- `credit_count`
- `public_safe_credit_count`
- `primary_author_credit_count`
- `warning_codes text[]`
- `is_trust_ready boolean`

### Initial warning codes

- `no_citations`
- `no_credits`
- `no_primary_author_credit`
- `withdrawn_source`
- `restricted_source`
- `confidential_source`
- `citation_not_public_safe`
- `credit_not_public_safe`
- `duplicate_primary_author`
- `unsupported_target_anchor`

### Initial policy

The function reports readiness.

It does not block Article publication in PR 3A.

Later policy may make specific trust requirements mandatory by Article type.

## Source withdrawal and historical presentation

Source withdrawal must preserve historical identity while applying explicit public-presentation policy.

### `retain_public_reference`

Existing published public Citation references remain visible.

New public-safe Citation creation and attachment are blocked.

The withdrawal reason remains internal.

### `redact_public_reference`

Existing published public Citations remain represented, but Source identity or locator details are reduced.

Public presentation may use wording such as:

- source withdrawn
- source details withheld
- reference retained for historical integrity

Exact public wording belongs to later frontend integration.

### `hide_public_reference`

The public Source and Citation presentation is hidden.

Historical canonical rows remain intact internally.

The Article body and lifecycle are not automatically changed.

### Withdrawal invariants

Withdrawal must not:

- delete Source versions
- delete Citations
- delete Article attachments
- rewrite published Article content
- rewrite Credit history
- modify ownership
- modify Article lifecycle
- remove review history

## Immutability and deletion policy

The following records are immutable:

- `editorial.source_versions`
- `editorial.citations`
- `editorial.credits`
- `editorial.source_review_events`

The following are mutable only through trusted commands:

- `editorial.sources`
- `editorial.external_contributors`
- Citation attachment sets
- Credit attachment sets
- Article-version trust revision rows

### Hard deletion

Authenticated users cannot hard-delete:

- Sources
- Source versions
- Citations
- Credits
- external contributors
- Source review events

### Referential protection

Use `on delete restrict` for historical identity:

- Source versions referenced by Citations
- Citations referenced by attachments
- Credits referenced by attachments
- external contributors referenced by Credits
- Registry authors referenced by Credits
- authenticated users referenced as credited parties

Credited-party foreign keys are:

- `editorial.credits.user_id`
- `editorial.credits.registry_author_id`
- `editorial.credits.external_contributor_id`

All three use `on delete restrict`.

This preserves:

- the exactly-one credited-party constraint
- immutable Credit identity
- historical display snapshots

Operational actor fields may use `on delete set null`, including:

- `created_by`
- `updated_by`
- `reviewed_by`
- `withdrawn_by`

Media references may use `on delete set null` where the historical Source snapshot still preserves enough descriptive identity.

## Schema verification

Add a dedicated SQL verifier.

Recommended file:

`scripts/control-plane/verify-phase-3a-trust-schema.sql`

The verifier must confirm:

1. all controlled vocabulary tables exist
2. all required seed values exist
3. all canonical trust tables exist
4. `editorial.article_version_trust_revisions` exists
5. RLS is enabled on every canonical trust table
6. canonical tables have no anonymous grants
7. authenticated users have no direct mutation grants
8. Source-version immutability trigger exists
9. Citation immutability trigger exists
10. Credit immutability trigger exists
11. Source review events are append-only
12. Citation locator validator exists
13. target-anchor validator exists
14. Article-version attachment integrity trigger exists
15. Source working, submitted, and approved pointer integrity exists
16. `num_nonnulls(...) = 1` credited-party constraint exists
17. credited-party foreign keys use `on delete restrict`
18. Source withdrawal constraints exist
19. withdrawal mode defaults to `hide_public_reference`
20. Article trust-revision constraints exist
21. Citation commands require expected Citation revision
22. Credit commands require expected Credit revision
23. public Article Source view exists
24. public Article Credit view exists
25. both public trust views use `security_invoker = true`
26. both public trust views use `security_barrier = true`
27. public Source view binds the active publication snapshot version
28. public Credit view binds the active publication snapshot version
29. public Source view requires the approved Source-version pointer
30. public Source view does not expose quotation text
31. public Source view does not expose internal notes
32. public Source view does not expose restricted Source URLs
33. public Credit view does not expose authenticated-user IDs
34. public Credit view does not expose authenticated-user usernames
35. public Credit view does not expose external-contributor contact fields
36. ordinary Source admin views omit confidential-only fields
37. restricted Source detail function enforces elevated authority
38. Article trust-readiness function exists
39. Article edit authority still uses `editorial.current_user_can_edit_article`
40. existing Article lifecycle functions remain present
41. existing Article ownership columns remain unchanged
42. existing Publishing assignees remain operational assignments only
43. no command receipt, job, or outbox dependency was introduced for Phase 3A trust mutations

## Generated types and baseline

After the migration is applied locally and to the linked schema:

- regenerate `src/types/database.types.ts`
- update `docs/engineering/live-schema-baseline.json`
- run the live-schema verifier
- inspect generated relationships for unexpected ambiguity
- verify no public trust table exposes unsafe columns

Do not hand-edit generated database types.

## Regression coverage

Add focused regression tests proving:

### Source authority

1. Source type must be controlled.
2. Source title cannot be blank.
3. Source working revision cannot be less than 1.
4. A new Source starts in `draft`.
5. A new Source starts with `internal` exposure.
6. A new Source has only a working-version pointer.
7. Submitted pointer must belong to the Source.
8. Approved pointer must belong to the Source.
9. Approved Source requires reviewer and review time.
10. Non-approved Source cannot claim public exposure.
11. Withdrawn Source requires complete withdrawal metadata.
12. Withdrawal defaults to `hide_public_reference`.

### Source versions

13. Source versions are immutable.
14. Source version number is unique per Source.
15. Source fingerprint is unique per Source.
16. A no-op save does not create a Source version.
17. A no-op save does not increment working revision.
18. A material save creates a new Source version.
19. A material save moves the working pointer.
20. A material save clears submitted and approved pointers.
21. A material save resets exposure to `internal`.
22. A later Source save does not change an earlier Source version.
23. A Source version referenced by a Citation cannot be deleted.
24. A Source version referenced by a Source pointer cannot be deleted.

### Source review

25. Submission requires the current working Source version.
26. Submission moves the submitted pointer.
27. Submission does not create a Source version.
28. Approval requires the submitted Source version.
29. Approval moves the approved pointer.
30. Approval does not mutate the Source version.
31. Approval requires explicit allowed exposure.
32. Requesting changes clears submitted and approved pointers.
33. Rejecting clears the approved pointer.
34. Restoration requires fresh review.

### Citations

35. Citation requires an exact Source version.
36. Citation Source version must belong to the Source.
37. Malformed page locator is rejected.
38. Inverted page range is rejected.
39. Negative timestamp is rejected.
40. Malformed spreadsheet cell is rejected.
41. whole-source locator accepts an empty object.
42. unknown locator type is rejected.
43. Citation is immutable.
44. public-safe Citation requires the approved Source version.
45. public-safe Citation requires public or public-redacted exposure.
46. withdrawn Source blocks new public-safe Citation use.
47. Citation quotation remains internal.

### Article Citation attachments

48. Article version must belong to the resolved Article resource.
49. Unsupported target-version type is rejected.
50. malformed target anchor is rejected.
51. duplicate attachment is rejected.
52. public-safe attachment requires public-safe Citation.
53. stale Citation revision is rejected.
54. successful single attachment increments Citation revision once.
55. successful replacement increments Citation revision once.
56. Citation mutation does not change Credit revision.
57. ordered replacement is atomic.
58. replacement failure leaves prior attachments unchanged.
59. replacement failure leaves Citation revision unchanged.
60. Citation attachment does not increment Article draft version.

### Credits

61. Credit requires exactly one credited-party authority.
62. Credit with zero identities is rejected.
63. Credit with multiple identities is rejected.
64. credited-party foreign keys use deletion restriction.
65. display snapshot cannot be blank.
66. later user-profile rename does not alter Credit snapshot.
67. later Registry-author rename does not alter Credit snapshot.
68. later external-contributor rename does not alter Credit snapshot.
69. Credit is immutable.
70. authenticated-user username snapshot remains internal.
71. external-contributor contact fields remain internal.
72. public-safe external-contributor Credit requires permitted consent.
73. Registry-author public safety is an explicit Credit decision.

### Article Credit attachments

74. Article version must belong to the resolved Article resource.
75. null target-version identity is rejected.
76. resource-level Credit attachment is rejected.
77. duplicate Credit attachment is rejected.
78. more than one primary author is rejected.
79. stale Credit revision is rejected.
80. successful single attachment increments Credit revision once.
81. successful replacement increments Credit revision once.
82. Credit mutation does not change Citation revision.
83. ordered replacement is atomic.
84. replacement failure leaves prior attachments unchanged.
85. replacement failure leaves Credit revision unchanged.
86. legacy Article byline remains unchanged.
87. canonical resource ownership remains unchanged.
88. Credit attachment does not increment Article draft version.

### Public reads

89. anonymous users cannot read canonical trust tables.
90. active published Article version exposes approved public-safe Citations.
91. draft Article version does not expose trust rows.
92. old Article version does not expose rows after a newer publication snapshot becomes active.
93. Citation against a non-approved Source version does not appear publicly.
94. public-redacted Source hides Source URL.
95. public-redacted Source hides archive identifier.
96. public-redacted Source hides precise protected locator data.
97. public Source view never exposes quotation text.
98. restricted Source fields do not appear publicly.
99. confidential Source fields do not appear publicly.
100. ordinary Source admin views omit confidential-only fields.
101. restricted detail requires elevated authority.
102. external-contributor contact fields do not appear publicly.
103. Registry-author Credit may expose stored author-route identity.
104. authenticated-user Credit does not expose user ID.
105. authenticated-user Credit does not expose username.
106. withdrawal mode controls public presentation.
107. withdrawal preserves canonical historical rows.
108. both public trust views use security invoker.
109. both public trust views use security barrier.

### Legacy authority protection

110. `public.evidence_items` remains unchanged.
111. `public.institute_evidence_items` remains unchanged.
112. `public.registry_relationship_evidence` remains unchanged.
113. Publishing assignments remain separate from Credits.
114. Article lifecycle functions remain authoritative.
115. Article ownership remains canonical.
116. public Article byline remains separate during transition.
117. Phase 3A trust commands do not create command receipts.
118. Phase 3A trust commands do not create jobs.
119. Phase 3A trust commands do not create outbox events.

## Migration decomposition

Preferred production-safe sequence:

### Migration 1: Trust identity foundation

Includes:

- capability definitions
- role assignments
- Source types
- Citation locator types
- Credit roles
- Sources
- Source versions
- Source pointer foreign keys
- Source pointer integrity trigger
- Source review events
- external contributors
- Credits
- credited-party deletion restrictions
- base constraints
- immutability
- RLS and grants

### Migration 2: Trust attachment foundation

Includes:

- Source Registry links
- Citations
- resource Citation attachments
- resource Credit attachments
- Article-version trust revisions
- Citation locator validator
- target-anchor validator
- Article-version integrity trigger
- primary-author integrity trigger
- ordering constraints
- indexes
- RLS and grants

### Migration 3: Trust commands and internal reads

Includes:

- Source create, save, submit, review, withdraw, and restore commands
- Citation creation and attachment commands
- Credit creation and attachment commands
- Article trust-revision locking and increment behaviour
- Source read-authority helpers
- ordinary Source admin views
- restricted Source detail function
- Article-version trust summary
- execution grants
- comments

### Migration 4: Public trust reads

Includes:

- public Article Source view
- public Article Credit view
- Article trust-readiness function
- security-invoker settings
- security-barrier settings
- anonymous select grants on narrow public views only
- public column allowlists
- comments

### Atomic deployment concern

Splitting is acceptable only when every intermediate migration leaves production secure and valid.

No intermediate state may:

- grant public access to canonical trust tables
- leave Source versions mutable
- leave Source pointers without same-Source integrity
- leave credited-party identity vulnerable to deletion drift
- expose attachment mutation before trust-revision enforcement exists
- expose public views before public-safety constraints exist
- expose public views before redaction logic exists
- expose public views before quotation exclusion exists
- create commands before required RLS, constraints, and triggers exist

Migration 4 must not deploy before Migrations 1 through 3 are verified.

A smaller number of migrations is acceptable when required to avoid unsafe intermediate states.

## First implementation boundary

The initial PR includes:

- schema migrations
- transactional commands
- RLS
- internal read models
- narrow public read models
- generated types
- live-schema verification
- regression tests
- one controlled SQL Article proof

The initial PR does not include:

- Article Workspace Source UI
- Article Workspace Citation UI
- Article Workspace Credit UI
- inline editor Citation anchors
- public Article visual redesign
- public Source cards
- contributor profile redesign
- Registry workflow conversion
- Playlist integration
- Audio integration
- Video integration
- correction cases
- general provenance authority

## Controlled Article proof

The schema proof should use a transaction that is rolled back or one explicitly designated non-production-critical Article.

It must demonstrate:

1. create one Source
2. verify Source version 1 is the working version
3. verify submitted and approved pointers are null
4. submit Source version 1 for review
5. approve Source version 1
6. verify the approved pointer references Source version 1
7. create one page or whole-source Citation
8. attach the Citation to one immutable Article version
9. verify Citation revision increments
10. create one authenticated-user Credit
11. create one Registry-author Credit
12. create one external contributor
13. create one external-contributor Credit
14. attach all three Credits to the Article version
15. verify Credit revision increments
16. verify Article draft version did not change
17. verify Article ownership did not change
18. verify legacy Article byline did not change
19. verify trust readiness
20. verify ordinary internal read models
21. verify restricted detail is denied without elevated authority
22. verify restricted detail succeeds with elevated authority
23. verify public views remain empty for an unpublished Article version
24. bind or use an active publication snapshot in a controlled proof
25. verify public Source and Credit presentation
26. verify Citation quotation is absent from public output
27. verify authenticated-user ID and username are absent from public output
28. save Source metadata without change
29. verify no duplicate Source version is created
30. save materially changed Source metadata
31. verify Source version 2 is created
32. verify submitted and approved pointers are cleared
33. verify the existing Citation still references Source version 1
34. verify Source version 1 remains immutable
35. resubmit and approve Source version 2
36. change a credited person profile
37. verify Credit snapshots remain unchanged
38. attempt Citation replacement with stale revision
39. verify the command fails without changing attachments
40. attempt Credit replacement with stale revision
41. verify the command fails without changing attachments
42. withdraw the Source without specifying public mode
43. verify `hide_public_reference` is used
44. verify public Source presentation is hidden
45. verify canonical Source versions, Citations, Credits, and attachments remain
46. verify no command receipt was created
47. verify no job was created
48. verify no outbox event was created

## Resolved implementation status

All 15 initial implementation questions have been resolved through repository and linked-schema evidence.

Locked decisions include:

- five supported canonical Registry entity types
- direct validation against authoritative Registry tables
- `on delete restrict` for credited-party identities
- no authenticated-user public profile route in PR 3A
- no public Citation quotations in PR 3A
- Source URLs hidden for `public_redacted`
- `hide_public_reference` as withdrawal default
- immutable Source versions with separate working, submitted, and approved pointers
- material saves resetting review and public exposure
- separate Article-version trust attachment revisions
- Article-version Credits only
- explicit Credit approval for Registry authors
- historical identity preserved through restricted credited-party deletion
- synchronous trust commands without command receipts, jobs, or outbox
- restricted Source details exposed only through a separately authorised detail function

No unresolved architectural question remains before migration drafting.

Implementation details must still be verified through migration tests and live-schema verification.

## Exit condition

The Phase 3A schema contract is ready for implementation when:

- Source identity is reusable and independent
- Source versions are immutable
- Citations bind exact Source versions
- Article Citations bind exact Article versions
- Citation locators are typed and SQL-validated
- Credits use one explicit identity authority
- Credit display snapshots cannot drift
- ownership, byline, and Credits remain separate
- Source withdrawal preserves historical identity
- private Source material cannot leak through public reads
- mutation commands are transactional
- public views bind the active publication snapshot
- no existing evidence, Media, Registry, contributor, Publishing, or Article authority is silently replaced
