# Phase 4A Migration 2 — Media logical identity bridge

## Purpose

Migration 2 backfills the canonical logical identity and governance bridge for every existing `public.registry_media_assets` row without changing compatibility rows, existing foreign keys, public output, file bytes, or delivery URLs.

This migration implements the accepted Phase 4A schema-design sequence:

- one canonical `media.assets` row per compatibility row
- matching UUIDs
- one initial `media.asset_governance_versions` row per asset
- one immutable `media.legacy_asset_links` row per asset
- one `governance_version_created` event per asset
- one `legacy_asset_mapped` event per asset

It does not create:

- file objects
- asset revisions
- variants
- variant selections
- usage links
- upload commands
- processing jobs
- frontend changes
- Edge Function changes

## Accepted production baseline

The bounded production discovery recorded:

- 1,079 compatibility assets
- 1,079 active assets
- zero duplicate IDs
- zero blank URLs
- compatibility row fingerprint `f32e074f96b01549b5e597ad8b5f4324`
- 15 total foreign keys to `public.registry_media_assets`
- 14 compatibility foreign keys from schemas outside `media`
- zero canonical rows before Migration 2

## Mapping contract

For every compatibility asset:

- `media.assets.id = public.registry_media_assets.id`
- `asset_kind` uses `file_kind`, then `media_kind`, when present in the controlled vocabulary; otherwise `other`
- `asset_purpose` uses the existing valid purpose; otherwise `general`
- title uses nonblank `title`, then nonblank `slug`, then a deterministic legacy fallback
- lifecycle is `active`
- compatibility folder and timestamps are preserved
- authority revision begins at 1
- the complete compatibility row is captured in `legacy_snapshot`

Initial governance preserves explicit `rights_status` and sets:

- consent: `unknown`
- sensitivity: `none`
- embargo: `none`
- source protection: `internal`
- preservation: `unassessed`
- retention: `retain`
- public safety: `internal`

No rights, consent, byte, checksum, MIME, storage, filename, or usage inference is permitted.

## Transaction and rollback

The migration runs in one transaction.

Any failed assertion rolls back all canonical backfill rows. Compatibility rows and foreign keys are never modified.

Rollback before later migrations may delete the exact Migration 2 event rows, bridge rows, governance rows, and assets after clearing current governance pointers. No physical media is affected.

## Exit gates

- 1,079 logical assets
- 1,079 governance versions
- 1,079 bridge rows
- 1,079 governance events
- 1,079 mapping events
- exact UUID parity
- exact one-to-one bridge parity
- zero file objects, revisions, variants, selections, or usage links
- unchanged compatibility row count and fingerprint
- unchanged 14-row compatibility foreign-key fingerprint
- no anonymous Media access
- no authenticated direct canonical writes
