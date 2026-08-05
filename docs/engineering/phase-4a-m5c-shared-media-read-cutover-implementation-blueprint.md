# Phase 4A Migration 5C Shared Media Read Cutover

Date: 5 August 2026

## Status

Frontend implementation package for validation.

Migration 5A made the 985 active legacy usages resolvable.

Migration 5B added and deployed the governed batch adapter:

`public.resolve_legacy_media_asset_lite_batch(uuid[], text[])`

Migration 5C connects the existing shared public Media helper to that adapter.

## Scope

The cutover changes only:

- `src/utils/mediaAssetProps.ts`
- one focused structural test
- this implementation blueprint

The existing public enrichment service already routes artist, release, track, article and label metadata through this helper.

## Read behavior

The helper keeps its existing public interfaces:

- `batchGetMediaAssetsByUrl`
- `batchGetMediaAssetsById`
- `getMediaImageProps`
- `getImagePropsFromUrl`
- `useMediaImage`
- `clearMediaImageCache`

URL and ID batches now call the governed RPC rather than reading `public.registry_media_assets` directly.

The React hook reuses the URL batch helper instead of maintaining a separate direct-table query.

## Presentation compatibility

For resolver-approved assets, the helper receives the same lightweight Media fields:

- id
- slug
- title
- url
- mime_type
- media_kind
- metadata

Migration 5B already proved exact URL and metadata parity for all 676 active legacy assets.

When an asset is omitted because it is blocked, unlinked or unavailable, the existing rendering fallback remains:

- the entity-provided image URL is still used
- the caller-provided fallback alt text is still used
- the complete batch does not fail

## Cache behavior

The existing in-memory URL and ID caches remain.

Successful rows are cached normally.

Omitted rows and failed batches are cached as null to avoid repeated requests during the current page lifecycle.

Bulk Media operations may still clear the cache through `clearMediaImageCache`.

## Boundaries preserved

This cutover does not change:

- Media Library admin reads
- Media upload, metadata update, delete or status commands
- image editing or Lightsail overwrite behavior
- compatibility policies or grants
- compatibility foreign keys
- SQL schema
- Edge Functions
- Readdy
- storage files or paths

The compatibility table remains available as the rollback path.

## Validation

Before a PR:

- generated database types must include the Migration 5B RPC
- the shared helper must contain no direct `registry_media_assets` read
- URL batches must call the RPC with `p_urls`
- ID batches must call the RPC with `p_asset_ids`
- the React hook must reuse `batchGetMediaAssetsByUrl`
- fallback rendering and both caches must remain
- the focused Vitest contract must pass
- the frontend application build must pass
- schema and engineering control-plane gates must pass
- the working tree must contain exactly three files

## Deployment

- SQL migration: not required
- Edge Function deployment: not required
- frontend deployment: required only after PR review and merge
- Readdy update: not required

## Rollback

Revert the frontend PR and deploy the previous frontend build.

The compatibility table and existing entity image URLs remain unchanged.
