# Phase 4A Migration 5D Article Inline Media Read Cutover

Date: 5 August 2026

## Status

Frontend implementation package for validation.

Migration 5C moved the shared public Media image helper onto the governed batch adapter.

Migration 5D moves article inline Media caption enrichment onto the same governed helper.

## Existing path

Published article HTML may contain:

`<img data-asset-id="...">`

`src/services/magazineArticles.ts` extracts those asset IDs and currently reads `public.registry_media_assets` directly.

The resulting Media rows are used by desktop and mobile article pages to build an asset caption map.

The caption renderer consumes:

- id
- caption
- altText
- title

The image itself remains in the article HTML and is not replaced by this lookup.

## Decision

Replace the direct compatibility-table query with:

`batchGetMediaAssetsById(assetIds)`

The helper already delegates each returned asset to:

`public.resolve_legacy_media_asset_lite_batch`

Only resolver-approved assets receive caption metadata.

Blocked, missing or unlinked assets are omitted from the caption map. Their original inline image HTML remains unchanged.

## Compatibility

The existing `MediaAsset` shape remains available.

The governed adapter returns all fields needed by article rendering:

- id
- slug
- title
- url
- media_kind
- metadata

The existing `source` field remains nullable and is set to null because it is not consumed by either article page or the caption renderer.

No article content, Media row, URL, caption or storage file is changed.

## Preserved boundaries

This cutover does not change:

- article hero Media
- article HTML
- Media Library admin reads
- Media uploads or edits
- Lightsail file writes
- the slug-based public-content Media lookup
- compatibility policies or foreign keys
- SQL schema
- Edge Functions
- Readdy

## Validation

Before a PR:

- `magazineArticles.ts` must contain no direct `registry_media_assets` read
- the service must contain no direct Supabase client import
- inline IDs must route through `batchGetMediaAssetsById`
- caption, alt-text, title and original URL mapping must remain
- desktop and mobile article pages must continue using `buildAssetCaptionMap`
- focused tests must pass
- the frontend application build must pass
- schema and control-plane gates must pass
- exactly three files may change

## Deployment

- SQL migration: not required
- Edge Function deployment: not required
- frontend deployment: required only after PR review and merge
- Readdy update: not required

## Rollback

Revert the frontend PR and deploy the previous frontend build.

The compatibility table and original article HTML remain unchanged.
