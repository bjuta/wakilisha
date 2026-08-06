# Phase 4A Media write authority and immutable replacement acceptance record

Date: 6 August 2026

## Status

Acceptance is complete for the Phase 4A administrative Media read, operational
write-authority, immutable replacement, and browser editor delivery lane.

The lane is closed.

Phase 4A is not closed.

The remaining Phase 4A boundary is the WordPress Media migration dependency,
followed by compatibility policy and grant hardening with an exact replacement
and rollback proof.

## Accepted production authority

Operational write commands:

- `public.create_media_asset_write_v2`
- `public.replace_media_asset_file_v2`
- `public.update_media_asset_record_v2`
- `public.update_media_asset_status_batch_v2`

Accepted behavior:

- authenticated command authorization remains capability-bound
- canonical identity and the compatibility projection update atomically
- upload creates a verified immutable original and responsive derivative
- replacement creates a new revision and new storage paths
- the prior original and derivative remain preserved
- metadata updates use optimistic authority revisions
- ordinary delete behavior archives the logical asset
- authenticated users have no direct `SELECT` on
  `media.asset_governance_versions`

## Deferred constraint correction

Applied migration:

`20260806124500_phase_4a_media_deferred_pointer_trigger_authority.sql`

Accepted trigger contract:

- function `media.enforce_asset_pointer_integrity()`
- owner `postgres`
- `SECURITY DEFINER`
- fixed search path `pg_catalog, media`
- authenticated direct governance-table access remains false
- deferred commit-boundary verification passed

## Accepted application runtime

Edge Function:

- function `media-upload-api`
- production version 18
- original bytes are stored on Lightsail
- original SHA-256 is calculated and verified
- the 640-pixel Nginx derivative is verified and registered
- caller-supplied storage paths are rejected

Frontend:

- entry `assets/index-SgGcF9zd.js`
- entry SHA-256
  `75f8d326964b1af6e5335f276bde92fbaa9ae8544e89cf082824f48e8ed22049`
- upload, immutable replacement, metadata update and archive use governed
  commands
- no ordinary frontend compatibility-table writes remain
- RPC helpers preserve the Supabase client context

Frontend rollback backup:

`/opt/wakilisha-react-backups/phase4a-media-rpc-hotfix-20260806T113042Z-dc50c899`

## Production Media CORS

Accepted origin:

`https://wakilisha.africa`

Source-controlled contract:

`ops/nginx/wakilisha-media-cors-headers.conf`

Accepted Nginx placement:

- one original-upload location
- seven fixed-width derivative locations

Production rollback backup:

`/etc/nginx/wakilisha-backups/media-cors-20260806T135247Z`

The original and derivative response bodies retained their registered SHA-256
values after CORS deployment.

## Live immutable replacement proof

Logical asset:

`7e6866dd-8a40-4a0f-bea5-aae08db721b0`

Proof filename:

`phase4a-live-proof-20260806T114423Z.png`

Accepted state before archival:

- authority revision: 4
- lifecycle state: active
- current immutable revision: 2
- revision 1 preserved: true
- revision 2 current: true
- usage links for the proof asset: 0

Revision 1 original:

- file object `02994ae0-db47-4905-a93a-5d7e0373bd97`
- path
  `uploads/1786022512583-cb0491de-phase4a-live-proof-20260806t114423z.png`
- SHA-256
  `a05ddf7335b8babfe6b88f78d5a115d2598bf5586bccf87925fcac2833a3822a`
- bytes 535,116
- verification state `verified`

Revision 1 responsive derivative:

- file object `abb362f4-2d4b-4fdf-8705-337b96d33af6`
- path
  `__image/w640/uploads/1786022512583-cb0491de-phase4a-live-proof-20260806t114423z.png`
- SHA-256
  `51516aa3e5288d51d42963c615373481f0f780013df5acb621874fc1effdf020`
- bytes 156,486
- verification state `verified`

Revision 2 original:

- file object `202a93a0-6c54-44f9-9add-0a65ce079324`
- path
  `uploads/1786024902551-746750be-phase4a-live-proof-20260806t114423z.png`
- SHA-256
  `869c180cd70eccac6ab508bbc56439d841749c7b7ee989eb22f66a4eec066719`
- bytes 1,862,292
- verification state `verified`

Revision 2 responsive derivative:

- file object `5b0b9529-3158-4527-b340-4ea67094d23a`
- path
  `__image/w640/uploads/1786024902551-746750be-phase4a-live-proof-20260806t114423z.png`
- SHA-256
  `2b4cdae532e614796c4a300382d4bdc9aa22408b1ec7b2e67c77bb249c9867a4`
- bytes 1,608,934
- verification state `verified`

All four public deliveries returned HTTP 200, the exact production CORS origin,
and bytes matching the registered SHA-256 value.

## Accepted final catalog state

After the proof asset is archived:

- canonical logical assets: 1,080
- governance versions: 1,080
- compatibility rows: 1,080
- legacy identity bridges: 1,080
- usage links: 987
- file objects: 4
- asset revisions: 2
- variants: 2
- variant selections: 2
- proof authority revision: 5
- proof lifecycle state: archived
- proof compatibility status: archived
- current immutable revision: 2

Archival does not remove or overwrite either accepted revision.

## Confirmed orphan cleanup

The following failed-upload originals had no file-object registration, no
compatibility projection, and no usage relationship:

- `/opt/wakilisha-media/uploads/1786016706831-014b10d5-phase4a-live-proof-20260806t114423z.png`
- `/opt/wakilisha-media/uploads/1786018965027-1d375aa6-phase4a-live-proof-20260806t114423z.png`

Each contained 535,116 bytes with SHA-256:

`a05ddf7335b8babfe6b88f78d5a115d2598bf5586bccf87925fcac2833a3822a`

Only those two exact unregistered files are removed. Registered revision files
remain untouched.

## What this acceptance closes

This acceptance closes:

- administrative Media read cutover
- Media Library command cutover
- operational Media upload authority
- immutable original and derivative proof
- immutable replacement proof
- in-place overwrite removal
- browser editor CORS for public Media delivery
- authenticated archive behavior for the proof asset
- exact failed-upload orphan cleanup

## What remains open

Phase 4A remains active for:

1. deciding, replacing or formally retiring the WordPress Media migration path
2. removing the final legacy-import compatibility calls when a proved
   replacement exists
3. compatibility policy and grant hardening
4. final Phase 4A closure verification and reconciliation

## Explicit non-decisions

This acceptance does not:

- close Phase 4A
- tighten compatibility policies or grants
- change compatibility foreign keys
- invent file metadata for legacy URL-only records
- modify the frozen Institute boundary
- change the WordPress migration function
- physically purge registered revision files
- redeploy the Edge Function
- redeploy the frontend
- update Readdy
