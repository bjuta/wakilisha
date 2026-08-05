# Phase 4A Migration 3 — Media file and revision command layer

## Purpose

Migration 3 creates the trusted transactional command layer for canonical Media authority.

It adds:

- logical asset creation
- file-object registration
- controlled file verification completion
- immutable asset revision creation and activation
- immutable variant registration
- governed variant activation with optimistic concurrency
- immutable governance-version creation and activation
- governed asset archive and restore

It does not:

- upload bytes
- process derivatives
- create usage authority
- change compatibility rows
- change compatibility foreign keys
- change compatibility policies
- change frontend consumers
- deploy Edge Functions
- expose physical purge

## Command contracts

The migration creates:

- `public.create_media_asset`
- `public.register_media_file_object`
- `public.verify_media_file_object`
- `public.create_media_asset_revision`
- `public.register_media_variant`
- `public.activate_media_variant`
- `public.create_media_governance_version`
- `public.archive_media_asset`
- `public.restore_media_asset`

Every command:

- requires an authenticated human actor
- checks the command-specific Media capability
- uses a security-definer boundary with a safe search path
- preserves one correlation ID across its event set
- returns exact resulting identities and revisions
- rejects stale expected revisions
- writes canonical events exactly once

## Controlled file verification

`media.file_objects` remains immutable.

The shared immutable-row trigger permits one narrow transition only when:

- the trusted verification command sets a transaction-local guard for the exact file-object ID
- the row is currently `unverified`
- identity and locator fields remain unchanged
- verification moves to `verified`, `failed`, or `unreachable`

No general bypass flag exists.

## Compatibility boundary

Migration 3 creates command authority only.

The existing `public.registry_media_assets` runtime remains unchanged. Existing reads and writes are not cut over in this migration.

## Production baseline

Migration 3 requires:

- 1,079 canonical assets
- 1,079 initial governance versions
- 1,079 legacy bridge rows
- zero file objects
- zero asset revisions
- zero variants
- zero variant selections
- zero usage links
- unchanged compatibility fingerprint `f32e074f96b01549b5e597ad8b5f4324`

## Exit gates

- all nine commands exist
- all nine commands are security definer
- all nine commands use a safe search path
- authenticated execution is allowlisted
- anonymous execution is absent
- canonical direct writes remain denied
- the file-object immutable trigger has only the narrow verification transition
- compatibility rows and foreign keys remain unchanged
- canonical production counts remain unchanged until a command is deliberately exercised
