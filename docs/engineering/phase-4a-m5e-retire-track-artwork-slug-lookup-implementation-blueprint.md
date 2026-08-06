# Phase 4A Migration 5E Retire Track Artwork Slug Lookup

Date: 5 August 2026

## Status

Frontend implementation package for validation.

Migration 5C moved shared public Media enrichment onto the governed batch adapter.

Migration 5D moved article inline Media caption enrichment onto the same governed helper.

Migration 5E removes the remaining public track-artwork compatibility-table lookup because live discovery found no matching track candidates.

## Live discovery

The read-only production discovery reported:

- 1,078 active image rows
- 1,078 distinct active image slugs
- 0 duplicate slug groups
- 0 duplicate URL conflicts
- 5 selected WordPress-origin image rows
- 1,943 exact live track-slug candidates
- 0 exact track-slug matches
- 1,943 title-derived candidates
- 0 title-derived matches
- 676 governed resolver results across all selected image assets
- 402 selected image assets without governed resolver delivery

The current WordPress-origin preference has no effect because there are no duplicate active image slugs.

The current track-artwork Media lookup has no observed live match in the measured tracklist candidate perimeter.

## Existing path

`src/services/publicContent/client.ts` currently:

1. Generates candidate Media slugs from each release track slug and title.
2. Reads `public.registry_media_assets` directly.
3. Groups active image rows by Media slug.
4. Prefers a WordPress-origin row when duplicates exist.
5. Uses the selected Media URL before the track's direct artwork field.
6. Falls back to generated release artwork when neither URL is available.

## Decision

Remove the direct compatibility-table slug lookup and its unused selection helpers.

Track artwork will use the already existing fallback chain:

1. direct artwork fields stored on the track row
2. the existing placeholder-image helper
3. generated release artwork

No SQL adapter extension is justified for a lookup with zero observed live candidate matches.

## Preserved behavior

Migration 5E preserves:

- release-track ordering
- artist and featured-artist rendering
- track duration and preview URL
- direct artwork fields
- placeholder-image behavior
- generated release artwork
- every non-Media registry read in the public-content client

## Preserved boundaries

Migration 5E does not change:

- the governed Media resolver or adapter
- article, artist, release or label Media enrichment
- Media Library admin reads
- Media uploads, edits or deletes
- WordPress Media migration
- Lightsail storage
- compatibility policies or foreign keys
- SQL schema
- Edge Functions
- Readdy

## Validation

Before a PR:

- `publicContent/client.ts` must contain no `registry_media_assets` reference
- the obsolete Media slug type and helper functions must be absent
- direct track artwork fields must remain
- generated artwork fallback must remain
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

No database row or storage object is changed.
