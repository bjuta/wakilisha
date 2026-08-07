# Phase 4A Migration 5 public Media read lane acceptance record

Date: 6 August 2026

## Programme status update - 7 August 2026

This is a time-scoped acceptance record for the public Media read lane as it
stood on 6 August 2026.

Its statements that Phase 4A was still open were correct at that checkpoint.

Phase 4A later closed through PR #580 and production main `f6800cb5`.

The authoritative final status is recorded in:

`docs/engineering/phase-4a-media-authority-closure-record.md`

## Status

Acceptance is complete for the Phase 4A public application Media read lane.

Migration 5 public presentation work is closed.

Phase 4A is not closed.

The remaining Phase 4A work is the administrative and write-authority perimeter, immutable file and revision proof, editor usage authority, in-place overwrite removal, and compatibility policy and grant hardening after those consumers are cut over.

## Accepted production baseline

Repository main:

`cdbb43898b9a37b4e92238db029bc4e50b3a430c`

Latest accepted frontend release:

- PR #575, Retire dead track artwork Media lookup
- live entry `assets/index-DV-Zb8i6.js`
- entry hash `654886dac710b1e89c47f4c9b84e6af3d39dec9a9e95e01251d66b70f91e3b34`
- complete frontend file count 4,352
- complete frontend fingerprint `510fa7c3f556a07bb2c4583891088cef819f9561bad2cdae3be43df7672b47a9`
- homepage HTTP 200
- releases HTTP 200
- rollback backup `/opt/wakilisha-react-backups/phase4a-m5e-20260806T050356Z`

## Completed Migration 5 public-read sequence

### Migration 5A

The public delivery resolver gained the narrow legacy compatibility lane.

Accepted behavior:

- active `legacy_snapshot` usage only
- exact immutable compatibility URL parity
- current governance approval or exact untouched Migration 2 baseline
- later non-approved governance changes block delivery
- no governance mutation or inferred approval

### Migration 5B

The governed legacy Media batch adapter became live:

`public.resolve_legacy_media_asset_lite_batch(uuid[], text[])`

Accepted production proof:

- 676 ID lookup results
- 676 URL lookup results
- exact compatibility URL parity
- exact metadata parity
- zero invalid URL results

### Migration 5C

Shared public Media enrichment moved from direct compatibility-table reads to the governed adapter.

Accepted paths include:

- artists
- releases
- articles
- labels
- tracks
- guide heroes
- shared image hooks

Presentation fallback and caches remain in place.

### Migration 5D

Article inline Media caption enrichment moved from direct compatibility-table reads to the governed ID adapter.

Accepted behavior:

- deterministic article asset order
- governed caption, alt text and title enrichment
- blocked or missing Media rows are omitted from enrichment
- original article image HTML remains unchanged

### Migration 5E

The remaining public release-track artwork slug lookup was retired.

Production discovery found:

- 1,943 exact live track-slug candidates
- zero exact Media slug matches
- 1,943 title-derived candidates
- zero title-derived Media slug matches
- zero duplicate active image slug groups

Direct track artwork fields, placeholder handling and generated artwork remain.

## Public application closure proof

The repository classification found:

- zero public or unclassified direct `registry_media_assets` calls
- 28 remaining direct calls
- six remaining direct-consumer files

The remaining direct calls are confined to:

- seven admin UI calls across three files
- one admin service call across one file
- eleven compatibility-service calls in `src/services/mediaService.ts`
- nine WordPress legacy-import calls in one Edge Function

The accepted public Media files contain no direct compatibility-table call:

- `src/utils/mediaAssetProps.ts`
- `src/services/entityMediaEnrichment.ts`
- `src/services/guidePages.ts`
- `src/services/magazineArticles.ts`
- `src/services/publicContent/client.ts`

All 18 focused Migration 5C, 5D and 5E tests passed together.

## Live catalog proof

Governed public functions exist:

- `public.resolve_legacy_media_asset_lite_batch(uuid[],text[])`
- `public.resolve_media_asset_delivery(uuid,uuid,uuid,text)`

Accepted execution authority:

- anonymous batch execution: true
- authenticated batch execution: true
- service-role batch execution: true
- anonymous delivery resolver execution: true

Compatibility perimeter remains unchanged:

- direct grant count: 25
- direct grant fingerprint: `a94648a78554950d5e2686f8a91bbc63`
- policy count: 5
- policy fingerprint: `306c2a982f1539eb7fb03147b68b2ca9`
- total compatibility foreign keys: 15
- external compatibility foreign keys: 14
- external foreign-key fingerprint: `54274ae6a613d38c257c543ccf7050cc`
- internal Media bridge foreign keys: 1
- internal bridge relation: `media.legacy_asset_links`

Authority counts:

- compatibility rows: 1,079
- canonical logical assets: 1,079
- usage links: 987
- file objects: 0
- asset revisions: 0
- variants: 0
- variant selections: 0

## What this acceptance closes

This acceptance closes public application Media presentation through direct compatibility-table calls.

Public Media enrichment now uses the governed batch adapter or existing non-Media presentation fallback.

This acceptance also confirms that the remaining direct consumers are not ordinary public application read paths.

## What remains open

Phase 4A remains active because its exit gate is not yet satisfied.

Remaining work includes:

1. Connect the Media Library to canonical internal reads and governed commands.
2. Connect editor attachment and replacement actions to Media usage authority.
3. Stop in-place overwrite of existing file paths.
4. Register and verify at least one immutable file object.
5. Create at least one immutable asset revision.
6. Prove one logical asset with an original and several derivatives.
7. Remove editor dependence on mutable storage URLs.
8. Audit and cut over admin review, repair and lookup surfaces.
9. Decide the future of the WordPress Media migration path.
10. Tighten compatibility-table policies and grants only after all required consumers have a proved replacement and rollback path.

## Explicit non-decisions

This acceptance does not:

- close Phase 4A
- change compatibility policies
- revoke table grants
- move or remove foreign keys
- change Media Library behavior
- change upload or edit behavior
- stop mutable overwrite
- create file objects, revisions or variants
- deploy SQL
- deploy an Edge Function
- deploy a frontend
- update Readdy

## Next implementation boundary

Continue Migration 5 with the administrative and write-authority perimeter.

The next design must classify each remaining direct call as:

- canonical internal read candidate
- governed command candidate
- repair or review exception
- legacy import dependency
- removable dead path

No policy or grant hardening may precede that classification and replacement proof.
