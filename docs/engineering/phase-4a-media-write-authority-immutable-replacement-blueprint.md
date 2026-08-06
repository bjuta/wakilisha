# Phase 4A Media Write Authority and Immutable Replacement Blueprint

## Authority

This package follows the accepted Phase 4A Media schema, identity bridge, file and revision command layer, usage authority, public read cutover, and administrative read cutover.

## Starting baseline

- Canonical assets: 1,079
- Compatibility assets: 1,079
- Legacy identity bridges: 1,079
- Usage links: 987
- File objects: 0
- Asset revisions: 0
- Variants: 0
- Variant selections: 0
- Remaining direct compatibility calls: 17 across four files
- Remaining direct writes: 10

## Operational commands

The migration adds four authenticated commands:

1. `create_media_asset_write_v2`
2. `replace_media_asset_file_v2`
3. `update_media_asset_record_v2`
4. `update_media_asset_status_batch_v2`

The create and replacement commands establish verified immutable file objects, revisions, optional derivatives, active variant selections, and compatibility projections in one transaction.

## Immutable replacement rule

A replacement never reuses a registered storage path. The prior file object and revision remain unchanged and addressable. The logical asset keeps the same identity while `current_revision_id` advances.

## Lifecycle rule

Ordinary Media Library removal becomes archive, not hard delete. `active`, `needs_review`, and `rejected` remain active canonical lifecycle states. `archived` maps to canonical archive state. Restoring any non-archived status clears the archive fields.

## Compatibility boundary

The compatibility table remains a projection because 14 external foreign keys and legacy migration paths still depend on it. This package does not tighten its policies or grants. That happens only after the final legacy migration and rollback decision.

## Frozen Institute boundary

The two frozen Institute reads remain untouched.

## Edge and frontend checkpoint

The next checkpoint will:

- reject caller-supplied existing storage paths in `media-upload-api`;
- return upload checksum evidence;
- generate a thumbnail derivative for supported image uploads;
- route upload, replacement, metadata, status, archive, restore, and broken-link repair through the new commands;
- remove all non-legacy direct compatibility writes;
- change permanent-delete UI language and behavior to archive.

## Production proof

After SQL, Edge Function, and frontend deployment, one unused real image candidate will establish:

- one immutable original file object;
- one verified thumbnail derivative;
- one asset revision;
- one active thumbnail selection;
- exact delivery hash evidence;
- preserved compatibility identity.

The preferred candidate is `e24d8a5d-ae5b-46de-bd18-82eeaf49ba23`, which currently has zero active usages.

## Explicit non-decisions

This checkpoint does not:

- apply SQL;
- deploy the Edge Function;
- deploy the frontend;
- modify the WordPress migration function;
- modify the frozen Institute;
- tighten compatibility grants or policies;
- move or drop foreign keys;
- claim that Phase 4A is closed.

## Runtime cutover checkpoint

The runtime checkpoint:

- routes Media Library upload through `create_media_asset_write_v2`;
- routes image replacement through `replace_media_asset_file_v2`;
- routes metadata and status changes through governed write commands;
- turns the ordinary delete action into archive while preserving references;
- routes broken-link metadata writes through Media authority;
- computes SHA-256 in `media-upload-api`;
- rejects caller-supplied existing storage paths;
- uploads every replacement to a new immutable path.

The SQL migration is deployed and verified in production. The Edge Function and frontend remain undeployed. This checkpoint does not change the frozen Institute or the WordPress migration function.
