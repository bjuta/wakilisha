# Phase 4A Media Authority Boundary Audit

Date: 4 August 2026

## Status

Authority boundary locked for Phase 4A schema design.

This document becomes binding when merged.

Phase 4A schema implementation may proceed only within the authority, compatibility, migration, and safety boundaries recorded here.

The upload and processing pipeline remains Phase 4B work.

## Governing plan

This audit implements the first boundary required by:

- `docs/institute/two-workspace-pilot-audit-and-build-plan.md`
- Phase 4: Media platform
- PR 4A: Media authority redesign

PR 4A requires:

- logical assets
- immutable file objects
- variants
- usage links
- checksums
- technical metadata
- preservation state
- rights
- consent
- sensitivity
- embargo
- source protection
- replacement history
- retention status
- a migration bridge for existing Media records

The PR 4A exit gate remains:

- existing assets remain usable
- one logical asset can safely hold an original and several derivatives
- no editor depends directly on a mutable storage URL

## Audit basis

The read-only audit was run against production and clean repository main:

- repository commit: `674903d59682d9236e9c510cba0960f8fecf9527`
- repository Media paths: 39
- repository Media authority references: 214
- repository mutable Media pattern matches: 50
- Media-related migrations: 10
- production query mode: read-only
- repository changed by audit: no
- production changed by audit: no

Audit artifact identities:

- repository paths: `392bd5b4008bb2889535c9e18a3d3bc2a766a58e17b96e33b6ea6a2ae55710e8`
- repository references: `12ef4b2bf04811f67c0582cefa2e10257ce8879d8e395ab693e701e365c3275a`
- mutable patterns: `7d6c2737bd913e05d01ba0656a49414418fd8a19c75fbaf15930a034931206b1`
- Media migrations: `ddbff77b44d61d647902e4def102c24fd050d71f9f0994444bb7d1bff7a34deb`
- production audit SQL: `b86df1f5a738fbc7e1174000bae8a8193b1126608c53275b63e13f8ba1a87330`
- production audit output: `c1a9cfd1e20b13e3bc41ba155cef55bc74f28299438d36cbafe377bdbeb623a6`

## Production findings

### Current asset estate

Production contains 1,079 rows in `public.registry_media_assets`.

Current state:

- 1,079 active assets
- 1,078 images
- 1 document
- 669 general-purpose assets
- 399 chart artwork assets
- 10 artist photos
- 1 downloadable asset
- 0 duplicate URL groups
- 0 duplicate storage-path groups

Storage classification:

- 1,066 assets have no recorded storage bucket
- 1,066 assets have no recorded storage path
- 13 assets are recorded against `lightsail-media`

Metadata quality:

- 1,067 assets have no file size
- 1,067 assets have no MIME type
- 1,067 assets have no original filename
- all 1,079 assets have unknown rights
- all 1,079 assets have no credit text
- all 1,079 assets have no logical folder assignment

These are evidence gaps.

They must not be filled through inference during the first migration.

### Current storage estate

Production contains four Supabase Storage bucket records:

- `article-media`
- `avatars`
- `cms-media`
- `profile-covers`

The audit found zero recorded `storage.objects` rows in all four buckets.

New Media uploads currently use the external Lightsail Media origin and record `lightsail-media` as a logical bucket value.

Supabase Storage bucket identity and Lightsail storage identity are therefore separate concerns.

Neither becomes logical Media identity.

### Missing Phase 4 authority

Production does not contain canonical authorities for:

- logical Media assets
- immutable file objects
- Media variants
- Media usage links
- checksums
- preservation state
- consent state
- sensitivity
- embargo
- governed source protection

The existing `public.registry_media_assets` row currently combines several different concerns:

- logical asset identity
- public URL
- storage locator
- technical metadata
- editorial title and status
- purpose
- rights summary
- legacy source provenance
- folder organization

That combined row is the compatibility authority today.

It must not remain the final Phase 4 authority.

### Current public-read perimeter

`public.registry_media_assets` currently has overlapping permissive `SELECT` policies:

- `registry_media_assets_public_read` grants the `public` role access to every active row
- `Public users can read active registry image media assets` grants `anon` and `authenticated` access to active image rows
- `authenticated_read_registry_media_assets` grants authenticated users access to all rows

PostgreSQL combines permissive row-level security policies with logical `OR`.

The narrower active-image policy therefore does not constrain the broader active-row policy.

Current public table reads can expose every selected column of any active asset, including source metadata, storage locators, internal notes, rights fields, and any future governance fields added to the same row.

Decision:

- future protected Media governance must not be added to the compatibility row on the assumption that row-level security hides columns
- public Media presentation must move to narrow allowlisted views or resolver functions
- the first Phase 4A migration must preserve current compatibility reads until a verified resolver exists
- the cutover must preserve valid active Media delivery while removing broad public table exposure of protected fields
- tightening the current compatibility policies requires a separate consumer audit, regression proof, and rollback path
- this documentation PR does not change current policies or runtime behavior

### Current dependency perimeter

The production audit found 14 direct foreign-key relationships to `public.registry_media_assets`.

They include:

- Article hero images
- Chart artwork
- Registry artist images
- Registry author avatar and cover images
- Registry release and track artwork
- Guide and guide-page hero images
- Registry highlight artwork
- Registry provenance links
- Source Media attachments
- immutable Source-version Media attachments

The frontend Media service contains a hard-coded map of 11 referencing columns.

The database dependency perimeter is already larger than that frontend list.

Delete safety must therefore become database-governed.

A client-maintained list is not an authority boundary.

## Existing authorities

### `public.registry_media_assets`

Current role:

- compatibility identity used by existing foreign keys
- existing public and authenticated Media read source
- existing admin Media metadata row
- current link between public consumers and Media URLs

Decision:

`public.registry_media_assets` remains operational during migration.

It does not become the final logical asset or immutable file-object authority.

It must not be dropped, rewritten in bulk, or converted into a view in the first Phase 4A migration.

### `public.media_folders`

Current role:

- admin-managed logical folder tree
- organizational metadata
- browsing and filtering

Decision:

Folders organize assets.

Folders do not identify files, control public URLs, prove rights, or define usage.

Moving an asset between folders must never change its file identity or public delivery location.

The existing folder table remains a compatibility surface during Phase 4A.

### Lightsail Media origin

Current role:

- file receiver
- public file delivery origin
- current destination for new Media uploads

Decision:

Lightsail is a storage and delivery provider.

It is not logical asset identity.

It is not rights authority.

It is not usage authority.

A Lightsail path must never be treated as a permanent asset identity.

### Supabase Storage

Current role:

- legacy and profile-related bucket configuration
- historical Article and CMS Media routes
- import and migration inputs

Decision:

Supabase Storage remains a supported storage provider where valid objects exist.

It is not the sole Media authority.

Phase 4 must support multiple storage providers without changing logical asset identity.

### Public URLs

Current role:

- direct runtime delivery locations
- lookup and compatibility values
- legacy WordPress and Supabase URL bridges
- current Lightsail delivery locations

Decision:

A URL is a locator.

A URL is not:

- logical asset identity
- immutable file identity
- a checksum
- a usage link
- proof of rights
- proof of public safety

## Canonical Phase 4 authority

The new canonical authority must live in a dedicated `media` schema.

The schema boundary prevents Registry, Article, Publishing, Source, and storage-provider concerns from becoming a second Media authority.

### Logical asset

Canonical authority:

- `media.assets`

A logical asset represents the durable editorial or cultural identity of Media across file replacements and derivatives.

A logical asset must have:

- stable UUID identity
- asset kind
- title
- purpose
- lifecycle state
- current approved asset revision
- current governance version
- optional compatibility folder
- created actor and timestamp
- archived actor, reason, and timestamp where applicable

A logical asset must not store mutable file bytes.

A logical asset must not use its current URL as identity.

Changing the original file must not change the logical asset ID.

### Immutable file object

Canonical authority:

- `media.file_objects`

A file object represents one exact byte sequence.

A file object must record:

- stable UUID identity
- cryptographic SHA-256 checksum
- byte size
- MIME type
- original filename
- file extension where known
- storage provider
- provider bucket or namespace
- immutable provider path
- delivery locator where approved
- technical metadata
- verification state
- ingest actor and timestamp

File-object rules:

- registered bytes are immutable
- a registered provider path is immutable
- a checksum is required before a file object becomes verified
- two file objects may point to equivalent bytes only through explicit deduplication policy
- a file edit creates a new file object
- a file replacement creates a new file object
- no command may overwrite an existing verified file object at the same path

Legacy URL-only assets may exist without a verified file object during migration.

The migration must not invent checksums, paths, MIME types, sizes, or original filenames.

### Asset revision and replacement history

Canonical authority:

- `media.asset_revisions`

An asset revision links one logical asset to the file object selected as its original at a point in time.

Each revision must record:

- logical asset ID
- immutable sequence or revision number
- original file-object ID
- replacement reason
- previous revision where applicable
- created actor
- created timestamp

Asset revisions are immutable.

The current approved revision is selected through governed command authority.

Replacing the original file does not delete or rewrite the previous revision.

### Variant

Canonical authority:

- `media.variants`

A variant represents an immutable derivative relationship.

A variant must identify:

- logical asset ID
- source file-object ID
- derived file-object ID
- variant role
- transformation specification
- dimensions, duration, bitrate, codec, or format where applicable
- generation state
- generator identity and version where applicable
- created timestamp

Examples include:

- thumbnail
- responsive width
- crop
- web-optimized image
- social card
- poster frame
- audio preview
- video transcode
- preservation copy

A variant file object is immutable.

Regenerating a variant creates a new file object and variant record.

### Usage link

Canonical authority:

- `media.usage_links`

A usage link records how one logical asset is used by another canonical resource or exact resource version.

A usage link must identify:

- logical asset ID
- target resource ID
- exact target version where supported
- usage role
- optional placement or ordering
- optional target anchor
- selected asset revision where publication stability requires it
- approved alt-text snapshot where needed
- approved caption snapshot where needed
- approved credit snapshot where needed
- lifecycle state
- created actor and timestamp

Examples include:

- Article hero image
- Article inline image
- Chart artwork
- Registry artist portrait
- Registry release artwork
- Registry track artwork
- Guide hero image
- Source attachment

Usage links attach to logical assets.

They do not attach directly to mutable URLs.

Publication-stable uses must bind the exact asset revision or resolved file object used by that published version.

### Governance version

Canonical authority:

- `media.asset_governance_versions`

Governance must be explicit and versioned.

A governance version must record:

- rights status
- rights basis
- rights holder where known
- licence identifier and terms where applicable
- consent state
- consent scope
- sensitivity
- embargo state and release time
- source-protection class
- preservation state
- retention state
- public-safety state
- internal reason
- approving actor
- created timestamp

Later governance changes must not silently rewrite the historical basis for a published use.

Public presentation must derive from an approved governance version.

### Provenance event

Canonical authority:

- `media.events`

Media lifecycle and governance history must be append-only.

Events must cover at least:

- logical asset created
- legacy asset mapped
- file object registered
- checksum verified
- asset revision created
- asset revision activated
- variant registered
- usage attached
- usage detached
- governance version created
- asset archived
- asset restored
- retention action requested
- physical purge completed where later allowed

## Identity invariants

The following invariants are locked:

1. Logical asset identity is stable.
2. File-object identity represents exact bytes.
3. URLs and storage paths are locators, not identity.
4. Registered file bytes are never overwritten.
5. A file edit creates a new file object.
6. A replacement creates a new asset revision.
7. Variants are explicit immutable relationships.
8. Canonical uses attach through usage links.
9. Published uses bind an exact asset revision where drift would be unsafe.
10. Rights, consent, sensitivity, embargo, source protection, preservation, and retention are explicit governance.
11. Archiving a logical asset does not delete historical file objects or published usage history.
12. Physical deletion is a separate governed retention action.
13. Storage-provider changes do not change logical asset identity.
14. Folder changes do not change file identity or usage identity.
15. Public reads expose only allowlisted safe fields.

## Mutation boundary

Client code must not orchestrate multi-table Media transitions.

Transactional command authority is required for:

- create logical asset
- register file object
- verify checksum
- create asset revision
- activate asset revision
- register variant
- attach usage
- detach usage
- create governance version
- archive asset
- restore asset
- request retention action

Commands must validate:

- actor capability
- logical asset lifecycle state
- file-object verification state
- checksum uniqueness policy
- storage-locator uniqueness
- exact target resource and version
- usage-role validity
- publication stability
- governance state
- optimistic concurrency for mutable current pointers
- compatibility mapping where legacy rows remain in use

The Phase 4 command layer must not depend on browser clients updating several tables in sequence.

## Permission boundary

Media authority must use Media-specific capabilities.

The current `registry_media_assets` write policy is tied partly to Review Queue authority.

That is transitional domain coupling.

Phase 4 must separate:

- viewing the Media library
- uploading candidate files
- managing logical assets and metadata
- managing usage links
- reviewing rights and public safety
- archiving assets
- approving retention or physical purge

Administrators retain full authority.

Article, Registry, Chart, Publishing, Source, or Review permissions alone must not grant unrestricted Media mutation authority.

Attaching a Media usage must verify both:

- Media attachment authority
- edit authority for the target canonical resource

## Public read boundary

Public Media delivery must use narrow allowlisted reads or resolver functions.

Public reads may expose only:

- stable logical asset identity where needed
- approved current or publication-bound delivery URL
- safe MIME and technical presentation fields
- approved alt text
- approved caption
- approved credit
- approved rights label where intended
- safe responsive variants

Public reads must not expose:

- internal storage credentials
- receiver paths not intended for public use
- internal notes
- consent evidence
- private source-protection details
- internal rights documents
- retention reasons
- private file-object history
- unpublished replacement files
- restricted or embargoed delivery locators

Frontend filtering is not a security boundary.

## Compatibility and migration bridge

### Stable legacy mapping

Every migrated `public.registry_media_assets` row must map to exactly one `media.assets` row.

The first backfill should preserve the existing UUID where practical:

- `media.assets.id = public.registry_media_assets.id`

A one-to-one compatibility mapping must still be recorded explicitly.

This preserves auditability and makes accidental duplicate logical assets detectable.

### Existing foreign keys

The 14 direct foreign-key relationships to `public.registry_media_assets` remain unchanged in the first migration.

They must not be bulk-rewired before:

- logical asset backfill is verified
- usage-link backfill is verified
- public and internal read adapters are proven
- rollback is tested
- current runtime behavior is preserved

The existing table remains the compatibility target until the cutover gate passes.

### Legacy URL-only assets

The 1,066 assets without storage bucket or path remain legacy URL-only assets until bytes can be verified.

Migration rules:

- preserve the existing URL
- do not invent a storage provider
- do not infer a storage path
- do not invent a checksum
- do not invent file size or MIME type
- do not infer original filename
- do not claim immutable file-object verification

A logical asset may exist before a verified file object is available.

### Lightsail assets

The 13 assets with `lightsail-media` storage identity are candidates for the first verified file-object backfill.

They are not automatically trusted.

Each candidate must be checked for:

- reachable bytes
- exact checksum
- byte size
- MIME type
- immutable path
- duplicate byte identity
- public-safety state

### Rights and credits

All 1,079 current assets have unknown rights and no credit text.

The first migration must preserve `unknown`.

It must not infer ownership, licence, consent, public domain, fair use, or credit from:

- URL host
- source kind
- source entity
- file name
- existing public visibility
- Article publication
- Registry use
- chart use

Governance review is separate follow-up work.

### Folders

All 1,079 current assets are unfiled.

The first migration must not auto-assign folders based on purpose, source, URL, or file name.

Folder organization is not a migration blocker.

### Current mutable edit behavior

The current Media service and edit modal re-upload edited images to the same Lightsail path.

The current upload API accepts an existing `storage_path` and sends a `PUT` request to that path.

This behavior conflicts with immutable file-object authority.

Phase 4A must preserve current runtime until a replacement command is ready.

The cutover must then change edits to:

1. create a new immutable storage path
2. register a new file object
3. create a new asset revision
4. preserve the previous file object and revision
5. activate the new revision through governed authority
6. update compatibility reads without breaking existing consumers

No in-place byte overwrite may remain after cutover.

## Cutover sequence

### Stage 1: Shadow authority

Create:

- `media.assets`
- `media.file_objects`
- `media.asset_revisions`
- `media.variants`
- `media.usage_links`
- `media.asset_governance_versions`
- `media.events`
- explicit legacy bridge records

Do not change current runtime reads or writes.

### Stage 2: Identity backfill

Backfill one logical asset for every `registry_media_assets` row.

Verify:

- one-to-one mapping
- UUID preservation
- no duplicate logical asset
- no lost legacy URL
- no changed foreign key

### Stage 3: Verified file-object backfill

Begin with a bounded Lightsail sample.

Register file objects only after byte verification.

Legacy URL-only rows remain without verified file objects.

### Stage 4: Usage-link backfill

Translate existing foreign-key relationships into shadow usage links.

Do not remove current foreign keys.

Compare shadow usage counts and roles against current relationships.

### Stage 5: Command authority

Introduce transactional commands for new uploads, replacements, variants, usage, governance, and lifecycle.

Dual-write compatibility fields only where required and verified.

### Stage 6: Read adapter

Introduce internal and public resolvers that read canonical Media authority while preserving existing consumer output.

Editors and public clients must not read storage paths directly.

### Stage 7: Runtime cutover

Move Media Library and editor integrations to command and resolver authority.

Disable in-place overwrite behavior.

Preserve rollback to the compatibility table and existing URLs.

### Stage 8: Legacy retirement

Only after production proof:

- stop direct writes to `registry_media_assets`
- replace remaining direct URL dependencies
- move foreign-key consumers to usage authority where appropriate
- make the compatibility table read-only or replace it with a compatibility view
- retain the bridge for historical resolution

Dropping legacy columns, rows, or files is not part of initial Phase 4A work.

## First narrow production proof

The first Phase 4A production proof must use one existing Lightsail-backed asset.

It must demonstrate:

1. Preserve the existing `registry_media_assets` row and UUID.
2. Create exactly one mapped logical asset.
3. Fetch and checksum the current bytes.
4. Register one verified immutable file object.
5. Create the first asset revision.
6. Register at least one derivative variant with a separate file object.
7. Create one usage link to a real canonical resource or exact version.
8. Resolve the same current public presentation through the new read adapter.
9. Replace the original with a new immutable path and file object.
10. Create and activate a new asset revision.
11. Verify that the previous file object and revision remain addressable.
12. Verify that published or version-bound use does not drift unexpectedly.
13. Verify that the compatibility row and existing foreign keys still resolve.
14. Verify rollback without deleting either file object.

## Immediate non-goals

PR 4A must not:

- build the general upload and processing pipeline
- add transcoding workers
- add image-analysis or artificial-intelligence enrichment
- bulk-download all legacy URLs
- infer missing rights or consent
- automatically publish unknown-rights Media
- delete legacy files
- remove existing Media foreign keys
- replace profile Media flows
- redesign the Media Library frontend
- redesign Article, Registry, Chart, Source, or Publishing authority
- begin Audio, Video, Playlist, Field Capture, or Inquiry Mode implementation
- treat folders as file identity
- treat URLs as asset identity
- create a second Media authority outside the `media` schema

## Phase 4A schema design sequence

Recommended sequence:

1. canonical Media types and lifecycle values
2. Media-specific capabilities
3. logical asset identity
4. immutable file objects and checksum authority
5. immutable asset revisions
6. variants
7. governance versions
8. usage links
9. append-only Media events
10. legacy one-to-one bridge
11. transactional commands
12. internal read models
13. narrow public resolvers
14. backfill and parity verifiers
15. generated database types
16. regression tests
17. one narrow Lightsail-backed production proof
18. controlled runtime cutover plan

## Exit condition

The Phase 4A authority boundary is satisfied when:

- logical assets remain stable across file replacement
- exact bytes have immutable file-object identity
- checksums and storage locators are explicit
- variants are explicit and immutable
- usage links replace URL-based association
- rights, consent, sensitivity, embargo, source protection, preservation, and retention are explicit governance
- current assets remain usable during migration
- existing foreign keys remain safe until verified cutover
- in-place file overwrite is removed through a governed replacement command
- public reads expose only approved safe fields
- no Article, Registry, Chart, Source, Publishing, folder, storage provider, or URL is silently promoted into a conflicting Media authority
