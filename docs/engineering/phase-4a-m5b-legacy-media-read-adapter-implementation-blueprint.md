# Phase 4A Migration 5B Legacy Media Read Adapter

Date: 5 August 2026

## Status

Implementation package for transactional review.

Migration 5A made all 985 active legacy usages safely resolvable through their immutable captured URLs.

Migration 5B adds the public batch adapter needed by the existing shared frontend Media enrichment path. It does not cut over the frontend in this migration.

## Existing shared read path

`src/services/entityMediaEnrichment.ts` sends public artist, release, track, article and label enrichment through the shared helpers in `src/utils/mediaAssetProps.ts`.

Those shared helpers currently query `public.registry_media_assets` directly by URL or asset ID and return this lightweight shape:

- id
- slug
- title
- url
- mime_type
- media_kind
- metadata

## Decision

Add:

`public.resolve_legacy_media_asset_lite_batch(uuid[], text[])`

The function accepts exactly one lookup set:

- asset IDs, or
- current compatibility URLs

It returns the same lightweight Media fields plus:

- requested_asset_id
- requested_url
- usage_link_id
- resolved_mode

For each asset, it selects one deterministic active `legacy_snapshot` usage and calls `public.resolve_media_asset_delivery`.

Only rows that the governed resolver accepts are returned.

A blocked asset is omitted from the result. One blocked asset therefore cannot fail the complete frontend batch.

## Safety boundary

The adapter:

- never returns a raw compatibility URL without resolver approval
- returns the resolver safe delivery URL
- requires an active compatibility row
- requires an active legacy usage
- preserves exact compatibility metadata for presentation parity
- rejects calls containing both lookup modes or neither
- rejects batches larger than 1,000 unique values
- exposes no write path
- changes no existing policy, grant, foreign key, row, storage path or frontend file

## Transactional proof

The linked rollback test must prove:

- every distinct asset with an active legacy usage resolves by ID
- every distinct active legacy URL resolves by URL
- ID and URL lookups return identical asset sets
- every returned URL matches the immutable legacy snapshot
- every returned URL matches the current compatibility URL
- every returned metadata object matches the compatibility metadata
- every returned usage is active and uses `legacy_snapshot`
- an unknown URL returns zero rows
- temporary compatibility URL drift omits that asset
- restoring the URL restores the asset
- all compatibility and canonical fingerprints remain unchanged
- rollback leaves production unchanged

## Staged cutover

1. Deploy and reconcile this SQL contract.
2. Replace the two shared batch queries in `mediaAssetProps.ts`.
3. Prove output parity in the public frontend.
4. Keep direct admin Media Library reads and all write paths on the compatibility table until their separate cutovers.
5. Keep image editing and immutable revision work separate.

## Deployment

- SQL migration: required after review
- Edge Function deployment: not required
- frontend deployment: not required in this migration
- Readdy update: not required
- generated database types: reconciliation required after production deployment
