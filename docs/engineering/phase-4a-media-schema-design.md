# Phase 4A Media Schema Design

Date: 4 August 2026

## Status

Schema contract proposed for implementation.

This document translates the locked Phase 4A Media authority boundary into an implementable PostgreSQL and Supabase design.

No Phase 4A migration should be written until this contract passes repository review.

The upload and processing pipeline remains Phase 4B work.

## Governing authority

This design is subordinate to:

- `docs/institute/two-workspace-pilot-audit-and-build-plan.md`
- `docs/engineering/phase-4a-media-authority-boundary-audit.md`

The schema must preserve:

- all 1,079 existing `public.registry_media_assets` rows
- all existing foreign keys to `public.registry_media_assets`
- all current public and internal Media runtime behavior until verified cutover
- existing Media URLs during the shadow-authority stage
- unknown rights and missing technical metadata without inference
- historical Source-version references to Media assets
- rollback to the compatibility table and current URLs

The schema must introduce:

- stable logical asset identity
- immutable file-object identity
- immutable asset revisions
- immutable derivative relationships
- governed current-variant selection
- explicit usage links
- versioned governance
- append-only Media events
- an explicit legacy bridge
- transactional command authority
- narrow internal and public read models

## Schema location

Canonical Media authority belongs in the `media` schema.

Reasons:

- Media identity must not belong to Registry, Articles, Publishing, Sources, folders, or a storage provider
- canonical tables require a narrow mutation boundary
- anonymous clients must not read canonical internal rows directly
- public presentation must use allowlisted views or resolver functions
- multiple storage providers must be supported without changing logical identity

Public compatibility and delivery views or functions belong in the `public` schema.

## Existing compatibility authorities

### `public.registry_media_assets`

This remains the current compatibility table.

The first Phase 4A migrations must not:

- drop the table
- convert it into a view
- rewrite all rows
- remove existing policies
- remove existing foreign keys
- change existing UUIDs
- replace current URLs
- move current storage paths
- remove current direct-read behavior

### `public.media_folders`

This remains the compatibility folder authority.

Folders organize logical assets.

Folders do not identify exact bytes, revisions, variants, rights, or usage.

### Storage providers

Initial provider values:

- `lightsail_media`
- `supabase_storage`
- `external_url`
- `legacy_unknown`

Provider values describe storage or delivery.

They are not logical Media identity.

## Capability additions

Retain existing compatibility capabilities:

- `upload_media`
- `manage_media_library`
- `view_missing_images`
- `view_broken_links`
- `view_media_migration`

Add Phase 4 capabilities:

- `view_media_records`
- `register_media_files`
- `verify_media_files`
- `manage_media_assets`
- `manage_media_usage`
- `review_media_governance`
- `archive_media_assets`
- `approve_media_retention`

Recommended initial role assignments:

### administrator

All Phase 4 Media capabilities.

### media_editor

- `view_media_records`
- `register_media_files`
- `manage_media_assets`
- `manage_media_usage`
- `archive_media_assets`

File verification and retention approval are not granted by default.

### editor

- `view_media_records`
- `register_media_files`
- `manage_media_assets`
- `manage_media_usage`

### reviewer

- `view_media_records`
- `review_media_governance`

### registry_editor

- `view_media_records`
- `register_media_files`
- `manage_media_usage`

Registry edit authority alone must not grant Media governance authority.

### author and writer

No global Phase 4 authority by default.

Their existing compatibility upload and Media Library capabilities remain until runtime cutover is complete.

Target-resource commands must additionally verify authority to edit the target resource.

## Controlled vocabularies

Use reference tables where values are expected to grow.

Reference rows must be system-managed and enabled explicitly.

### Asset kinds

Table:

`media.asset_kinds`

Columns:

- `asset_kind text primary key`
- `label text not null`
- `description text not null`
- `enabled boolean not null default true`
- `sort_order integer not null default 100`
- `created_at timestamptz not null default now()`

Initial values:

- `image`
- `document`
- `audio`
- `video`
- `archive`
- `other`

### Asset purposes

Table:

`media.asset_purposes`

Columns:

- `asset_purpose text primary key`
- `label text not null`
- `description text not null`
- `enabled boolean not null default true`
- `sort_order integer not null default 100`
- `created_at timestamptz not null default now()`

Initial values:

- `general`
- `article_hero`
- `article_inline`
- `chart_artwork`
- `artist_photo`
- `release_artwork`
- `track_artwork`
- `downloadable`
- `press_kit`
- `brand_asset`
- `profile_media`
- `social_card`
- `system`

### Storage providers

Table:

`media.storage_providers`

Columns:

- `storage_provider text primary key`
- `label text not null`
- `description text not null`
- `supports_verification boolean not null default false`
- `enabled boolean not null default true`
- `created_at timestamptz not null default now()`

Initial values:

- `lightsail_media`
- `supabase_storage`
- `external_url`
- `legacy_unknown`

### Variant roles

Table:

`media.variant_roles`

Columns:

- `variant_role text primary key`
- `label text not null`
- `description text not null`
- `enabled boolean not null default true`
- `sort_order integer not null default 100`
- `created_at timestamptz not null default now()`

Initial values:

- `thumbnail`
- `responsive_width`
- `crop`
- `web_optimized`
- `social_card`
- `poster_frame`
- `audio_preview`
- `video_transcode`
- `preservation_copy`
- `other`

### Usage roles

Table:

`media.usage_roles`

Columns:

- `usage_role text primary key`
- `label text not null`
- `description text not null`
- `enabled boolean not null default true`
- `sort_order integer not null default 100`
- `created_at timestamptz not null default now()`

Initial values:

- `article_hero`
- `article_inline`
- `chart_artwork`
- `artist_portrait`
- `author_avatar`
- `author_cover`
- `release_artwork`
- `track_artwork`
- `guide_hero`
- `highlight_artwork`
- `source_attachment`
- `other`

## Logical asset identity

### Table

`media.assets`

### Purpose

Stable logical Media identity across exact-file replacements and derivative generation.

### Columns

- `id uuid primary key default gen_random_uuid()`
- `asset_kind text not null`
- `asset_purpose text not null default 'general'`
- `title text not null`
- `lifecycle_state text not null default 'active'`
- `compatibility_folder_id uuid`
- `current_revision_id uuid`
- `current_governance_version_id uuid`
- `authority_revision bigint not null default 1`
- `created_by uuid`
- `updated_by uuid`
- `archived_by uuid`
- `archived_at timestamptz`
- `archive_reason text`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### Foreign keys

- `asset_kind` references `media.asset_kinds(asset_kind)`
- `asset_purpose` references `media.asset_purposes(asset_purpose)`
- `compatibility_folder_id` references `public.media_folders(id)` with `on delete set null`
- `created_by` and `updated_by` reference `auth.users(id)` with `on delete set null`
- `archived_by` is a historical actor UUID snapshot without a foreign key
- current pointers are added after referenced tables exist

### Constraints

Title:

- `btrim(title) <> ''`

Authority revision:

- `authority_revision >= 1`

Lifecycle state:

- `active`
- `archived`
- `retention_pending`
- `purged`

Archive integrity:

- archived assets require archive actor, timestamp, and reason
- active assets must not carry partial archive metadata
- purged means physical purge was completed through governed retention authority
- no initial migration may create a purged asset

### Indexes

- `(asset_kind, lifecycle_state, updated_at desc)`
- `(asset_purpose, lifecycle_state, updated_at desc)`
- `(compatibility_folder_id)` where not null
- `(current_revision_id)` where not null
- `(current_governance_version_id)` where not null

## Immutable file objects

### Table

`media.file_objects`

### Purpose

Identity for one exact byte sequence at one immutable storage locator.

### Columns

- `id uuid primary key default gen_random_uuid()`
- `sha256 text`
- `byte_size bigint`
- `mime_type text`
- `original_filename text`
- `file_extension text`
- `storage_provider text not null`
- `storage_namespace text`
- `storage_path text`
- `delivery_url text`
- `technical_metadata jsonb not null default '{}'::jsonb`
- `verification_state text not null default 'unverified'`
- `verified_by uuid`
- `verified_at timestamptz`
- `verification_error text`
- `ingested_by uuid`
- `created_at timestamptz not null default now()`

### Foreign keys

- `storage_provider` references `media.storage_providers(storage_provider)`
- `verified_by` and `ingested_by` reference `auth.users(id)` with `on delete set null`

### Verification states

- `unverified`
- `verified`
- `failed`
- `unreachable`

### Constraints

- `byte_size is null or byte_size >= 0`
- SHA-256 is null or exactly 64 lowercase hexadecimal characters
- verified rows require SHA-256, byte size, MIME type, provider, and storage path
- failed and unreachable rows require a verification error
- external URL rows may have a delivery URL without a storage path
- `btrim(storage_path) <> ''` when storage path is non-null
- `btrim(delivery_url) <> ''` when delivery URL is non-null
- direct update and delete are blocked after creation
- verification changes occur only through trusted commands

### Locator uniqueness

Create a unique partial index covering:

- storage provider
- normalized storage namespace
- storage path

Apply only when storage path is non-null.

No global uniqueness constraint is placed on SHA-256.

Equivalent bytes may be retained at more than one provider or path for preservation and delivery reasons.

Commands must detect equivalent hashes and record the deduplication decision.

### Indexes

- `(sha256, byte_size)` where SHA-256 is not null
- `(verification_state, created_at desc)`
- `(storage_provider, storage_namespace)`
- `(mime_type)` where not null

## Immutable asset revisions

### Table

`media.asset_revisions`

### Purpose

Immutable replacement history selecting one exact file object as the original for one logical asset.

### Columns

- `id uuid primary key default gen_random_uuid()`
- `asset_id uuid not null`
- `revision_number bigint not null`
- `original_file_object_id uuid not null`
- `previous_revision_id uuid`
- `replacement_reason text not null`
- `created_by uuid`
- `created_at timestamptz not null default now()`

### Foreign keys

- `asset_id` references `media.assets(id)` with `on delete restrict`
- `original_file_object_id` references `media.file_objects(id)` with `on delete restrict`
- `previous_revision_id` references `media.asset_revisions(id)` with `on delete restrict`
- `created_by` is a historical actor UUID snapshot without a foreign key

### Constraints

- `revision_number >= 1`
- unique `(asset_id, revision_number)`
- unique `(asset_id, original_file_object_id)`
- `btrim(replacement_reason) <> ''`
- revision 1 has no previous revision
- revisions after 1 require the immediately previous revision
- previous revision belongs to the same logical asset
- original file object must be verified before activation
- direct update and delete are blocked

### Asset pointer integrity

After revision creation, add:

- `media.assets.current_revision_id` references `media.asset_revisions(id)` with `on delete restrict`

A deferred constraint trigger verifies:

- current revision belongs to the same asset
- current revision uses a verified file object
- revision number is the highest activated revision for the asset
- trusted commands are the only supported pointer mutation path

Legacy URL-only assets may have a null current revision until exact bytes are verified.

## Immutable variants

### Table

`media.variants`

### Purpose

Immutable derivative relationship between one source file object and one derived file object.

### Columns

- `id uuid primary key default gen_random_uuid()`
- `asset_id uuid not null`
- `asset_revision_id uuid not null`
- `source_file_object_id uuid not null`
- `derived_file_object_id uuid not null`
- `variant_role text not null`
- `transformation_spec jsonb not null default '{}'::jsonb`
- `technical_metadata jsonb not null default '{}'::jsonb`
- `generator_name text`
- `generator_version text`
- `created_by uuid`
- `created_at timestamptz not null default now()`

### Foreign keys

- `asset_id` references `media.assets(id)` with `on delete restrict`
- `asset_revision_id` references `media.asset_revisions(id)` with `on delete restrict`
- source and derived file objects reference `media.file_objects(id)` with `on delete restrict`
- `variant_role` references `media.variant_roles(variant_role)`
- `created_by` is a historical actor UUID snapshot without a foreign key

### Constraints

- source and derived file objects must differ
- asset revision belongs to asset
- source file object matches the asset revision original or an explicitly supported source variant
- source and derived file objects must both be verified before registration
- transformation specification must be a JSON object
- direct update and delete are blocked
- registering a variant does not activate it
- regenerating a variant creates a new row and file object

### Duplicate identity

Prevent duplicate relationships covering:

- asset revision
- source file object
- derived file object
- variant role

## Current variant selection

### Table

`media.variant_selections`

### Purpose

Governed mutable pointer selecting one active immutable variant for one asset revision and variant role.

### Columns

- `asset_revision_id uuid not null`
- `variant_role text not null`
- `variant_id uuid not null`
- `selection_revision bigint not null default 1`
- `selected_by uuid`
- `selected_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### Primary key

Use:

`(asset_revision_id, variant_role)`

### Foreign keys

- `asset_revision_id` references `media.asset_revisions(id)` with `on delete restrict`
- `variant_role` references `media.variant_roles(variant_role)`
- `variant_id` references `media.variants(id)` with `on delete restrict`
- `selected_by` references `auth.users(id)` with `on delete set null`

### Constraints

- `selection_revision >= 1`
- selected variant belongs to the same asset revision
- selected variant uses the same variant role
- selected variant points to a verified derived file object
- direct authenticated insert, update, and delete are denied
- trusted selection commands are the only mutation path

### Selection rules

- one asset revision has at most one selected variant per role
- first selection creates revision 1
- replacement selection increments the revision exactly once
- replacing a selection does not mutate or delete either immutable variant
- prior selection identity is preserved in `media.events`
- no resolver may choose a variant by latest timestamp or highest UUID

## Versioned governance

### Table

`media.asset_governance_versions`

### Purpose

Immutable governance record for rights, consent, safety, sensitivity, embargo, source protection, preservation, and retention.

### Columns

- `id uuid primary key default gen_random_uuid()`
- `asset_id uuid not null`
- `version_number bigint not null`
- `rights_status text not null default 'unknown'`
- `rights_basis text`
- `rights_holder text`
- `licence_identifier text`
- `licence_terms text`
- `consent_status text not null default 'unknown'`
- `consent_scope text`
- `sensitivity text not null default 'none'`
- `embargo_state text not null default 'none'`
- `embargo_until timestamptz`
- `source_protection_class text not null default 'internal'`
- `preservation_state text not null default 'unassessed'`
- `retention_state text not null default 'retain'`
- `public_safety_state text not null default 'internal'`
- `internal_reason text`
- `approved_by uuid`
- `created_by uuid`
- `created_at timestamptz not null default now()`

### Foreign keys

- `asset_id` references `media.assets(id)` with `on delete restrict`
- `approved_by` and `created_by` are historical actor UUID snapshots without foreign keys

### Rights states

- `unknown`
- `owned`
- `licensed`
- `public_domain`
- `fair_use`
- `needs_clearance`
- `restricted`

### Consent states

- `unknown`
- `not_required`
- `requested`
- `granted`
- `limited`
- `declined`
- `withdrawn`

### Sensitivity

- `none`
- `low`
- `moderate`
- `high`
- `extreme`

### Embargo states

- `none`
- `scheduled`
- `active`
- `released`

### Source-protection classes

- `public`
- `public_redacted`
- `internal`
- `restricted`
- `confidential`

### Preservation states

- `unassessed`
- `working_copy`
- `preservation_candidate`
- `preserved`
- `at_risk`
- `lost`

### Retention states

- `retain`
- `review_required`
- `purge_requested`
- `purge_approved`
- `purged`

### Public-safety states

- `internal`
- `review_required`
- `approved_public`
- `approved_redacted`
- `blocked`

### Constraints

- `version_number >= 1`
- unique `(asset_id, version_number)`
- embargo time is required for scheduled or active embargo
- approved public safety requires rights not equal to restricted
- approved public safety requires consent granted or not required where consent applies
- confidential source protection cannot be publicly approved
- purged retention state cannot be created by an ordinary governance command
- direct update and delete are blocked

### Current governance pointer

After governance versions exist, add:

- `media.assets.current_governance_version_id` references `media.asset_governance_versions(id)` with `on delete restrict`

A deferred constraint trigger verifies that the current governance version belongs to the same asset.

## Usage links

### Table

`media.usage_links`

### Purpose

Attach one logical Media asset to one supported canonical target and optional exact target version.

### Columns

- `id uuid primary key default gen_random_uuid()`
- `asset_id uuid not null`
- `asset_revision_id uuid`
- `resolution_mode text not null default 'current_revision'`
- `target_authority text not null`
- `target_kind text not null`
- `target_id uuid not null`
- `target_version_kind text`
- `target_version_id uuid`
- `usage_role text not null`
- `placement_data jsonb not null default '{}'::jsonb`
- `display_order integer not null default 0`
- `alt_text_snapshot text`
- `caption_snapshot text`
- `credit_snapshot text`
- `usage_state text not null default 'active'`
- `usage_revision bigint not null default 1`
- `state_reason text`
- `state_changed_by uuid`
- `state_changed_at timestamptz`
- `created_by uuid`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### Foreign keys

- `asset_id` references `media.assets(id)` with `on delete restrict`
- `asset_revision_id` references `media.asset_revisions(id)` with `on delete restrict`
- `usage_role` references `media.usage_roles(usage_role)`
- `created_by` references `auth.users(id)` with `on delete set null`
- `state_changed_by` is a historical actor UUID snapshot without a foreign key

### Target authorities

Initial supported target authorities:

- `editorial`
- `registry`
- `charts`
- `guides`
- `sources`

Initial supported target kinds:

- `article`
- `artist`
- `author`
- `release`
- `track`
- `chart_entry`
- `guide`
- `guide_page`
- `highlight`
- `source`

### Target validation

Create:

`media.validate_usage_target(...)`

The function must validate against the exact authoritative table for the selected target authority and kind.

It must reject:

- unsupported target authority
- unsupported target kind
- missing target
- target version that does not belong to target identity
- free-text slug identity
- arbitrary public table names
- archived or unresolved targets unless later policy allows them

### Resolution modes

Supported values:

- `current_revision`
- `exact_revision`
- `legacy_snapshot`

Meaning:

#### `current_revision`

The usage intentionally follows the logical asset's current revision.

Rules:

- `asset_revision_id` is null
- the usage is internal or otherwise explicitly allowed to drift
- it cannot satisfy publication stability

#### `exact_revision`

The usage binds one exact immutable asset revision.

Rules:

- `asset_revision_id` is required
- the revision belongs to the same logical asset
- publication-stable canonical usage uses this mode

#### `legacy_snapshot`

The usage resolves through the immutable URL and metadata captured in `media.legacy_asset_links.legacy_snapshot`.

Rules:

- `asset_revision_id` is null
- the asset has exactly one immutable legacy bridge
- no verified asset revision existed when the usage was created
- the usage records a migrated compatibility relationship
- new canonical uploads cannot use this mode
- the current mutable compatibility URL is not consulted at render time

### Publication stability

A usage may use `current_revision` while it is internal and intentionally allowed to track later replacement.

A usage must use `exact_revision` when:

- it belongs to an immutable target version
- it is used by a published output
- replacement drift would alter historical presentation
- the command marks it publication stable

A pre-existing legacy URL-only asset may use `legacy_snapshot` for publication stability until exact bytes can be verified.

This is a migration exception.

It must not become the normal authority for new Media.

### Usage states

- `active`
- `detached`
- `archived`

### Constraints

- `display_order >= 0`
- `usage_revision >= 1`
- placement data must be a JSON object
- target version kind and target version ID are both null or both non-null
- `current_revision` requires a null asset revision
- `exact_revision` requires a non-null asset revision
- `legacy_snapshot` requires a null asset revision and an immutable legacy bridge
- bound asset revision belongs to asset
- non-active states require reason, actor, and timestamp
- detached and archived uses remain historically addressable
- identity, target, placement, resolution mode, snapshots, and creation metadata are immutable after insert
- trusted lifecycle commands may update only state, state metadata, usage revision, and updated timestamp
- direct authenticated update and all direct delete are blocked

### Duplicate identity

Use a normalized placement fingerprint.

Prevent duplicate active usage covering:

- logical asset
- target authority
- target kind
- target ID
- target version kind
- target version ID
- usage role
- normalized placement fingerprint

## Legacy compatibility bridge

### Table

`media.legacy_asset_links`

### Purpose

One-to-one bridge between every compatibility asset and one canonical logical asset.

### Columns

- `legacy_asset_id uuid primary key`
- `asset_id uuid not null unique`
- `mapping_reason text not null`
- `legacy_snapshot jsonb not null`
- `created_by uuid`
- `created_at timestamptz not null default now()`

### Foreign keys

- `legacy_asset_id` references `public.registry_media_assets(id)` with `on delete restrict`
- `asset_id` references `media.assets(id)` with `on delete restrict`
- `created_by` is a historical actor UUID snapshot without a foreign key

### Mapping integrity

The bridge is immutable.

Rules:

- insert one row only after the legacy-to-canonical identity decision is resolved
- one legacy asset maps to exactly one logical asset
- one logical asset maps to at most one legacy compatibility row
- the bridge has no mutable mapping state
- corrections require an explicit reviewed migration and corrective Media event
- direct remapping, update, and delete are blocked

### Backfill identity

The first backfill should use:

`media.assets.id = public.registry_media_assets.id`

The explicit bridge remains required even when UUIDs match.

### Legacy snapshot

The snapshot records compatibility evidence at mapping time:

- legacy UUID
- slug
- title
- URL
- Media kind
- status
- source identity fields
- storage bucket
- storage path
- folder ID
- file kind
- purpose
- technical metadata fields
- rights status
- credit text
- tags
- legacy timestamps

The snapshot is historical evidence.

It is not a replacement for canonical file or governance authority.

## Append-only Media events

### Table

`media.events`

### Purpose

Append-only lifecycle, mapping, verification, governance, and usage history.

### Columns

- `id uuid primary key default gen_random_uuid()`
- `asset_id uuid`
- `file_object_id uuid`
- `asset_revision_id uuid`
- `variant_id uuid`
- `usage_link_id uuid`
- `governance_version_id uuid`
- `event_type text not null`
- `actor_id uuid`
- `reason text`
- `prior_state jsonb`
- `resulting_state jsonb`
- `correlation_id uuid`
- `created_at timestamptz not null default now()`

### Foreign keys

Canonical object fields reference their matching Media tables with `on delete restrict`.

Actor ID is a historical UUID snapshot without a foreign key.

### Initial event types

- `asset_created`
- `legacy_asset_mapped`
- `file_object_registered`
- `file_object_verified`
- `file_object_verification_failed`
- `file_object_unreachable`
- `asset_revision_created`
- `asset_revision_activated`
- `variant_registered`
- `variant_activated`
- `usage_attached`
- `usage_detached`
- `usage_archived`
- `governance_version_created`
- `asset_archived`
- `asset_restored`
- `retention_requested`
- `retention_approved`
- `physical_purge_completed`

### Rules

- append-only
- no direct authenticated insert
- no update
- no delete
- written only through trusted commands
- at least one canonical object identity is required
- one correlation ID is preserved across every event written by one command

## Immutability triggers

Create a shared protection function:

`media.protect_immutable_row()`

Apply it to:

- `media.file_objects`
- `media.asset_revisions`
- `media.variants`
- `media.asset_governance_versions`
- `media.legacy_asset_links`
- `media.events`

The function blocks direct update and delete.

Narrow trusted command functions may use an explicit transaction-local guard only where verification-state completion requires one controlled update to a newly registered file object.

A general bypass flag is not permitted.

Variant selections are governed mutable pointers.

Rules:

- direct authenticated mutation is denied
- every activation requires the expected selection revision
- first activation expects revision 0 and creates revision 1
- replacement activation increments the selection revision exactly once
- every activation appends `variant_activated`

Usage-link identity is immutable after insertion.

The lifecycle model is locked:

- target identity, asset identity, resolution mode, placement, snapshots, and creation metadata never change
- trusted commands may update only `usage_state`, `usage_revision`, `state_reason`, `state_changed_by`, `state_changed_at`, and `updated_at`
- every successful state transition requires the expected usage revision
- every successful state transition increments usage revision exactly once
- every successful state transition appends one Media event
- direct authenticated update is denied
- delete is always denied

This governed mutable lifecycle avoids an unresolved successor-row model while preserving complete state history through `media.events`.

## Transactional command layer

Canonical tables must not be directly mutated by browser clients.

All commands must:

- require an authenticated human actor
- check the command-specific Media capability
- set a safe search path
- validate all controlled values
- lock mutable authority rows
- require the expected object revision where governed mutable state changes
- write the complete command-specific Media event set exactly once
- preserve one correlation ID across every event written by the command
- return exact resulting identities and revisions

Phase 4A does not introduce service-principal identity.

A later Phase 4B service command must not bypass actor attribution silently.

### `public.create_media_asset`

Purpose:

Create one logical asset without requiring a file object.

Inputs:

- asset kind
- asset purpose
- title
- optional compatibility folder
- optional correlation ID

Required capability:

- `manage_media_assets`

Required behavior:

1. validate actor capability
2. validate kind and purpose
3. create logical asset
4. create initial governance version with explicit unknown and internal states
5. set current governance pointer
6. append `asset_created` and `governance_version_created` under one correlation ID
7. return asset ID, governance version ID, and authority revision

### `public.register_media_file_object`

Purpose:

Register one candidate exact file object.

Inputs:

- storage provider
- namespace
- immutable path
- delivery URL
- original filename
- supplied MIME type
- supplied byte size
- technical metadata
- optional correlation ID

Required capability:

- `register_media_files`

Required behavior:

1. validate actor capability
2. validate provider and locator
3. reject an already registered locator
4. create an unverified file object
5. append `file_object_registered`
6. return file-object ID and verification state

This command does not upload bytes.

Phase 4B owns upload and processing.

### `public.verify_media_file_object`

Purpose:

Record the result of trusted byte verification.

Inputs:

- file-object ID
- calculated SHA-256
- calculated byte size
- detected MIME type
- technical metadata
- optional failure detail
- optional correlation ID

Required capability:

- `verify_media_files`

The initial role assignment grants this capability only through administrator authority.

Phase 4B may later add a governed service-principal path in a separate reviewed contract.

Required behavior:

1. lock file object
2. reject already finalized verification
3. validate exact checksum format
4. record `verified`, `failed`, or `unreachable` state
5. append the matching verification event
6. return resulting state

### `public.create_media_asset_revision`

Purpose:

Create and activate one new original-file revision.

Inputs:

- asset ID
- expected authority revision
- verified file-object ID
- replacement reason
- optional correlation ID

Required capability:

- `manage_media_assets`

Required behavior:

1. lock asset
2. verify expected authority revision
3. reject archived, retention-pending, or purged assets
4. require verified file object
5. create next immutable revision
6. set previous revision
7. activate current revision pointer
8. increment authority revision exactly once
9. append revision-created and revision-activated events
10. return asset revision ID and new authority revision

### `public.register_media_variant`

Purpose:

Register one immutable derivative relationship.

Inputs:

- asset ID
- asset revision ID
- source file-object ID
- derived verified file-object ID
- variant role
- transformation specification
- technical metadata
- generator identity
- optional correlation ID

Required capability:

- `manage_media_assets`

Required behavior:

1. validate asset and revision
2. validate source and derived file objects
3. require both file objects to be verified
4. validate variant role
5. reject duplicate relationship
6. create immutable variant
7. append `variant_registered`
8. return variant ID

### `public.activate_media_variant`

Purpose:

Select one immutable variant as the current delivery variant for one asset revision and role.

Inputs:

- asset revision ID
- variant role
- variant ID
- expected selection revision, using 0 when no selection exists
- reason
- optional correlation ID

Required capability:

- `manage_media_assets`

Required behavior:

1. validate asset revision, role, and variant
2. require the variant to belong to the supplied asset revision and role
3. require the derived file object to be verified
4. lock the selection identity
5. verify the expected selection revision
6. create revision 1 when no selection exists
7. otherwise replace the pointer and increment selection revision exactly once
8. preserve both immutable variant rows
9. append `variant_activated` with prior and resulting selection state
10. return variant ID and selection revision

### `public.create_media_governance_version`

Purpose:

Create and activate one immutable governance version.

Inputs:

- asset ID
- expected authority revision
- complete governance payload
- reason
- optional correlation ID

Required capability:

- `review_media_governance`

Required behavior:

1. lock asset
2. verify expected authority revision
3. validate all governance values
4. validate public-safety constraints
5. create next governance version
6. activate current governance pointer
7. increment authority revision exactly once
8. append `governance_version_created`
9. return governance version ID and new authority revision

### `public.attach_media_usage`

Purpose:

Attach a logical asset to one validated target.

Inputs:

- asset ID
- resolution mode
- optional exact asset revision
- target authority and kind
- target identity
- optional target-version identity
- usage role
- placement data
- display order
- optional approved snapshots
- optional correlation ID

Required capability:

- `manage_media_usage`

Required behavior:

1. validate Media capability
2. validate target edit authority
3. validate target and target version
4. validate resolution mode
5. require `exact_revision` for publication-stable canonical use
6. allow `legacy_snapshot` only for a mapped legacy URL-only asset without a verified revision
7. validate current governance permits intended use
8. reject duplicate active usage
9. create usage link with revision 1
10. append `usage_attached`
11. return usage-link ID and usage revision

### `public.detach_media_usage`

Purpose:

End one usage without erasing history.

Inputs:

- usage-link ID
- expected usage revision
- reason
- optional correlation ID

Required capability:

- `manage_media_usage`

Required behavior:

1. lock usage identity
2. verify expected usage revision
3. validate target edit authority
4. require current state `active`
5. set state to `detached`
6. record reason, actor, and timestamp
7. increment usage revision exactly once
8. append `usage_detached`
9. return usage-link ID, state, and usage revision

### `public.archive_media_usage`

Purpose:

Archive one active or detached usage without erasing identity or prior lifecycle events.

Inputs:

- usage-link ID
- expected usage revision
- reason
- optional correlation ID

Required capability:

- `manage_media_usage`

Required behavior:

1. lock usage identity
2. verify expected usage revision
3. validate target edit authority
4. reject already archived use
5. set state to `archived`
6. record reason, actor, and timestamp
7. increment usage revision exactly once
8. append `usage_archived`
9. return usage-link ID, state, and usage revision

### `public.archive_media_asset`

Purpose:

Archive a logical asset without deleting files or usage history.

Inputs:

- asset ID
- expected authority revision
- reason
- optional correlation ID

Required capability:

- `archive_media_assets`

Required behavior:

1. lock asset
2. verify expected revision
3. reject purge states
4. set archived state and metadata
5. increment authority revision
6. append `asset_archived`
7. preserve revisions, variants, governance, bridge, and usage links

### `public.restore_media_asset`

Purpose:

Restore an archived logical asset.

Required capability:

- `archive_media_assets`

Required behavior:

- reverse only governed archive state
- preserve history
- increment authority revision
- append `asset_restored`

### Retention commands

Initial design names:

- `public.request_media_retention_action`
- `public.approve_media_retention_action`
- `public.record_media_physical_purge`

Retention commands require separate approval authority.

Physical purge must not be implemented in the first migration.

The first migration may create the governance vocabulary and command contract without exposing a purge operation.

## Internal read models

Canonical tables remain private.

Create allowlisted authenticated read functions or views.

### `public.list_media_assets_v2`

Returns:

- logical asset identity
- kind and purpose
- lifecycle
- current revision summary
- current verified original file summary
- current governance summary safe for the actor
- compatibility mapping summary
- usage count
- authority revision
- timestamps

It must not return:

- internal governance reason to users without review authority
- storage credentials
- private source-protection evidence
- retention approval notes
- unapproved delivery locators

### `public.get_media_asset_v2`

Returns one logical asset with:

- revisions
- verified file objects
- variants
- current variant selections and selection revisions
- usage links
- governance history according to actor capability
- compatibility link
- append-only event summary

## Public read models

Do not tighten current compatibility policies in the first migration.

Create a new narrow resolver contract for later cutover.

### `public.resolve_media_asset_delivery`

Inputs:

- logical asset ID
- optional usage-link ID
- optional exact asset revision ID
- optional requested variant role

Input modes:

### Usage-bound resolution

When usage-link ID is supplied:

- derive asset identity, resolution mode, bound revision, and approved snapshots from the usage link
- supplied logical asset ID must match the usage link
- supplied exact asset revision ID must be null or match the usage link
- `legacy_snapshot` is allowed only in this mode

### Direct exact-revision resolution

When usage-link ID is null and exact asset revision ID is supplied:

- the revision must belong to the supplied logical asset
- resolution mode is `exact_revision`

### Direct current-revision resolution

When usage-link ID and exact asset revision ID are both null:

- resolve the logical asset current revision
- resolution mode is `current_revision`
- this mode cannot claim publication stability

Returns only approved public fields:

- logical asset ID
- resolution mode
- exact asset revision ID where available
- exact file-object ID where available
- safe delivery URL
- MIME type where verified
- width and height where safe
- duration where safe
- approved alt text snapshot where applicable
- approved caption snapshot where applicable
- approved credit snapshot where applicable

Resolution rules:

- `exact_revision` resolves only through the bound verified asset revision
- `current_revision` resolves only where drift is permitted
- `legacy_snapshot` resolves only through the immutable URL captured in the legacy bridge
- `legacy_snapshot` never reads the current mutable compatibility URL
- requested variant role resolves only through `media.variant_selections`
- no variant may be selected by creation time, UUID order, or ungoverned latest-row logic
- a null requested variant role resolves the original file object of the chosen asset revision
- exact revision and file-object IDs may be null only for valid `legacy_snapshot` resolution

The resolver must reject:

- blocked or internal governance
- active embargo
- restricted source protection
- archived assets where policy blocks delivery
- unverified file objects for current or exact revision modes
- unpublished variants
- `current_revision` for publication-stable usage
- `legacy_snapshot` without one immutable bridge and captured URL
- `legacy_snapshot` for a new canonical asset
- `legacy_snapshot` with a requested variant role
- mismatched asset, usage-link, or revision inputs
- requested variant role without one governed selection
- missing valid publication-stable resolution

## Row-level security and grants

### Canonical tables

For all `media` schema tables:

- revoke all from `public`, `anon`, and `authenticated`
- grant only required sequence usage where applicable
- grant service role full authority
- authenticated access occurs through security-definer commands and allowlisted reads
- enable RLS as defense in depth where PostgREST exposure is possible

### Reference tables

Authenticated Media users may read controlled vocabulary tables.

Only administrators may mutate reference values.

### Compatibility table

No policy changes to `public.registry_media_assets` occur in the first migration.

The current overlapping permissive policies are addressed only after:

- resolver parity
- consumer audit
- public regression proof
- rollback proof

## Legacy backfill

### Logical asset backfill

For every `public.registry_media_assets` row:

1. create `media.assets` using the same UUID
2. copy explicit kind, purpose, title, lifecycle, folder, and timestamps where supported
3. preserve unknown values
4. create one `media.legacy_asset_links` row
5. store a complete legacy snapshot
6. create one initial governance version
7. set rights to the explicit current value, including `unknown`
8. set consent to `unknown`
9. set sensitivity to `none`
10. set public safety to `internal`
11. set preservation to `unassessed`
12. set retention to `retain`
13. set current governance pointer
14. append `governance_version_created` and `legacy_asset_mapped` under one correlation ID

No file object or revision is created unless exact bytes are verified.

### File-object candidates

Only the 13 current `lightsail-media` rows are eligible for the first bounded file-object verification proof.

The backfill must not automatically register them as verified.

A candidate inventory may record:

- legacy asset ID
- storage path
- delivery URL
- supplied MIME type
- supplied size
- candidate state

Actual verification requires fetching bytes and calculating SHA-256.

### URL-only assets

The 1,066 assets without a known storage bucket or path receive:

- logical asset
- governance version
- compatibility bridge
- legacy snapshot

They do not receive:

- invented storage provider
- invented storage path
- invented checksum
- invented byte size
- invented MIME type
- invented original filename
- verified file object
- asset revision

## Usage-link backfill

Usage-link backfill is not part of the first foundation migration.

A later migration must:

1. inventory every real foreign-key relationship
2. map each relationship to a typed usage role
3. preserve exact target identity
4. use `exact_revision` where a verified revision exists
5. use `legacy_snapshot` for publication-stable legacy URL-only assets
6. use `current_revision` only where drift is explicitly allowed
7. create shadow usage links
8. compare counts, identities, roles, and resolution modes against source foreign keys
9. keep source foreign keys unchanged
10. verify zero loss before cutover

The frontend hard-coded reference map must not drive the database backfill.

The database foreign-key inventory is authoritative.

## Migration sequence

### Migration 1: Media authority foundation

Create:

- `media` schema
- capability definitions and conservative role assignments
- controlled vocabulary tables
- `media.assets`
- `media.file_objects`
- `media.asset_revisions`
- `media.variants`
- `media.variant_selections`
- `media.asset_governance_versions`
- `media.usage_links`
- `media.legacy_asset_links`
- `media.events`
- constraints
- indexes
- immutable-row protection
- pointer-integrity triggers
- canonical grants and RLS perimeter

Do not backfill compatibility rows in the same migration.

Exit checks:

- schema objects exist
- canonical tables are empty
- authenticated direct mutation is denied
- compatibility runtime is unchanged

### Migration 2: Logical identity bridge

Backfill:

- 1,079 logical assets
- 1,079 initial governance versions
- 1,079 legacy bridge rows
- 1,079 governance-version events
- 1,079 mapping events

Do not create file objects or revisions.

Exit checks:

- exact one-to-one mapping
- matching UUIDs
- no missing legacy rows
- no duplicate mappings
- no changed compatibility rows
- no changed foreign keys
- no changed public output

### Migration 3: File-object and revision command layer

Create and verify:

- file-object registration command
- file-object verification command
- asset-revision command
- variant registration command
- variant activation command
- governance-version command
- lifecycle commands
- event writing
- optimistic concurrency

Use a disposable local validation database before production.

Exit checks:

- immutable file objects cannot be updated or deleted
- asset replacement preserves prior revision
- equivalent bytes require explicit handling
- variant registration does not activate delivery
- variant activation uses optimistic concurrency
- no in-place overwrite command exists

### Migration 4: Usage authority and read models

Create and verify:

- typed target validator
- usage attachment commands
- usage detachment authority
- internal Media read models
- narrow public delivery resolver
- usage backfill verifier

Do not tighten compatibility policies yet.

Exit checks:

- shadow usage counts match existing relationships
- publication-stable uses bind exact revisions or immutable legacy snapshots
- requested variants resolve only through governed selections
- public resolver exposes only allowlisted safe fields
- current clients remain unchanged

### Migration 5: Controlled compatibility cutover

Only after production proof:

- connect Media Library to commands and internal reads
- connect editors to usage authority
- stop in-place file overwrite
- route new delivery through resolver
- compare compatibility and canonical outputs
- preserve rollback
- then review compatibility policy tightening

This migration may be split into SQL, Edge Function, and frontend pull requests.

## Verification requirements

Every Phase 4A migration requires:

- migration syntax validation
- fresh local database application
- upgrade-path application from current authoritative migration set
- exact migration-ledger check
- schema type regeneration
- live-schema baseline reconciliation
- RLS and grants verification
- immutable-row mutation tests
- pointer-integrity tests
- variant-selection concurrency tests
- command event-set and correlation tests
- no-inference backfill tests
- compatibility row-count proof
- foreign-key preservation proof
- public-read regression proof
- rollback plan

## First narrow production proof

Use one existing Lightsail-backed compatibility asset.

Required proof:

1. preserve compatibility row and UUID
2. fetch the existing bytes and calculate checksum, size, and MIME type
3. register the existing file object at its current immutable path
4. verify the registered existing file object
5. create and activate revision 1
6. produce one bounded derivative at a new immutable path
7. register the derivative file object
8. verify the registered derivative file object
9. register one immutable variant
10. activate that variant through governed selection
11. attach one `exact_revision` usage to a real target
12. resolve the usage through the new read model
13. register replacement bytes as a new file object at a new immutable path
14. verify the registered replacement file object
15. create and activate revision 2
16. preserve revision 1 and its original file object
17. prove the publication-stable usage still resolves revision 1
18. preserve compatibility reads and existing foreign keys
19. prove rollback without deleting file objects

## Immediate non-goals

The schema design does not authorize:

- general upload processing
- transcoding workers
- background queues
- artificial-intelligence enrichment
- bulk legacy byte download
- automatic rights inference
- automatic consent inference
- automatic folder assignment
- compatibility foreign-key removal
- public policy tightening before resolver parity
- Media Library redesign
- profile Media redesign
- physical purge implementation
- Audio, Video, Playlist, Field Capture, or Inquiry implementation
- any second Media authority outside the `media` schema

## Implementation gate

Migration 1 may begin only after this schema contract is reviewed and merged.

Migration 1 must remain a schema-only foundation.

It must not:

- backfill production assets
- change compatibility rows
- change current public policies
- change storage files
- deploy Edge Functions
- change frontend code
- begin Phase 4B

## Exit condition

The Phase 4A schema design is ready for implementation when:

- every canonical Media identity has one table
- mutable pointers and immutable records are separated
- exact bytes are immutable
- revision history is explicit
- variants are explicit
- current variant selection is explicit and revisioned
- usage targets are typed and validated
- governance is immutable and versioned
- public reads are allowlisted
- compatibility migration is staged and reversible
- the first migration is schema-only
- later backfill cannot invent missing evidence
- current runtime remains unchanged until verified cutover
