# Phase 7B Public Video Transcript Authority and Presentation

Date: 3 September 2026

## Status

PREVIEW SEALED. PR PENDING. PRODUCTION UNCHANGED.

Base main:

`e084565f9874b7c15598a485dc57f8aa4a495abc`

## Problem layer

Public Video transcript authority, protected transcript transport, and public transcript presentation.

The accepted Video publication system already owns transcript editorial authority through canonical Media usage. This slice does not create a second transcript store, parser, player, or delivery service.

## Primitive compounding disposition

This candidate reuses:

- immutable Video publication-version authority
- canonical `video_transcript` Media usage
- Media revision and governance authority
- the existing Video-specific `video-public-delivery` adapter
- the shared timed-text parser
- `PlayerTimedTextPanel`
- the existing public Video watching surface

The existing Video delivery adapter is extended from caption-only protected text to caption and transcript protected text.

No universal Media protected-text abstraction is introduced.

## SQL authority

The existing public Video reader gains one nullable `transcript` relationship.

It resolves only an exact active version-scoped `video_transcript` Media usage with:

- exact immutable published Video version
- exact Media revision
- active transcript asset
- verified Lightsail file
- `text/plain`
- canonical protected transcript namespace

The browser receives only:

`/video/transcripts/:publishedVersionId.txt`

It does not receive the protected Media storage path.

The new service-only function is:

`public.get_public_video_transcript_delivery_target(uuid)`

It independently re-checks current published-version authority and Video publishability before returning the protected transport target.

`anon` and `authenticated` cannot execute this target.

`service_role` can.

## Edge transport

The existing `video-public-delivery` Edge Function now accepts:

- `kind=caption`
- `kind=transcript`

Caption behavior remains intact.

Transcript delivery accepts only canonical:

`private-files/transcripts/*.txt`

and returns `text/plain`.

Preview-deployed local source SHA-256:

`330845723f80917217d4ebe005b014464b6a4f120d2c06a22dca926cc9aa6799`

Preview deployment:

- status: ACTIVE
- version: 8
- `verify_jwt`: false

## Public product composition

`PublicVideoPublication` gains one nullable governed transcript relationship.

`publicVideoTranscriptUrl()` constructs only the public Edge Function URL.

`PublicVideoWatchingSurface` uses:

- `fetchTimedTextDocument`
- `PlayerTimedTextPanel`
- existing Video seeking authority

The transcript UI is omitted when no transcript relationship exists.

## Local acceptance

Passed:

- exact V4C reader delta audit
- transcript focused tests: 7/7
- accepted Phase 7B V1 regression tests: 9/9
- public-copy dash audit
- `git diff --check`
- `npm run build:app`
- generated `public,editorial` schema seal

Generated schema types SHA-256:

`da2c31ba518bacea64fcc41c43791fc371736dc027c9018a0c024b380c94aab7`

## Preview acceptance

Disposable preview:

- name: `phase-7b-public-video-transcript`
- project ref: `fdsyuekeqvkghabgthaw`
- branch id: `8cb6cc56-5ea1-41d0-b029-48aa79d94777`
- production data copied: no

Baseline replay completed before candidate application:

- migration count: 82
- migration head: `20260903060000`

Candidate application:

- migration:
  `20260903085155_phase_7b_public_video_transcript_authority.sql`
- migration SHA-256:
  `0d3c9b9334c22c3261cb653dd28c9c633ae1de30a1e593fd1debf39a03a7814a`
- candidate migration count: 83
- candidate migration head: `20260903085155`
- exact dry-run pending set before apply: one migration
- permanent read-only verifier: PASS
- governed rollback behavior proof: PASS
- rollback fixture residue: none

The positive SQL behavior proof demonstrated:

- anonymous reader returns the exact public-safe transcript identity
- public payload contains no transcript `storage_path`
- service-only target returns the exact protected transcript identity
- invalid publication/version identities fail closed
- Media governance remains enforced

## Preview runtime configuration boundary

The disposable branch does not contain the custom:

`MEDIA_PRIVATE_DELIVERY_SECRET`

Both the unchanged caption path and the new transcript path therefore return the same function-level:

`503 Public Video delivery unavailable`

This is not treated as a transcript-code regression.

A production control request against the already accepted caption endpoint returned:

- HTTP 200
- `text/vtt; charset=utf-8`
- 110 bytes
- SHA-256:
  `c724f7dfb6bef10963d17d2c3a8325a589299e48b138490796c0040a7bb30c2c`

This isolates the preview HTTP result to missing branch runtime configuration.

The accepted Phase 7B V1 workflow likewise sealed preview authority before the real protected caption HTTP transport smoke, which remained a production acceptance gate.

## Production transcript content boundary

The accepted real Video `Monday Morning in September` does not currently have a governed transcript bound to its immutable published version.

The two existing transcript Media assets are earlier Phase 4B acceptance artifacts and must not be rebound as cultural content.

Final positive production transcript acceptance therefore requires genuine transcript content through the canonical workflow:

1. canonical transcript Media upload
2. Video transcript selection
3. existing `set_video_publication_transcript` authority
4. new immutable Video lifecycle version
5. review and publication
6. public transcript reader proof
7. public transcript HTTP transport proof
8. desktop and mobile presentation proof

No immutable published Video version is backfilled.

## Preview exit decision

Preview database authority is sealed.

The candidate may proceed to PR and protected CI.

The disposable preview remains available until production acceptance, then it is deleted as a whole. Synthetic preview-only immutable fixture rows are not individually rewritten or deleted.

Production remains unchanged.
