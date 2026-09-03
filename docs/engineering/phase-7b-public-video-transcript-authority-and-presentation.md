# Phase 7B Public Video Transcript Authority and Presentation

Date: 3 September 2026

## Status

PRODUCTION ACCEPTED. REAL TRANSCRIPT PRESENTATION ACCEPTED. PREVIEW DELETED.

Implementation base main:

`e084565f9874b7c15598a485dc57f8aa4a495abc`

Accepted implementation merge:

`3aa6f87a346e9227b8a77e05e99695d9d8fc5942`

Current Phase 7B closure runtime main:

`b0ffd4718094e9cca8d66de711cdc8e27a448548`

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


## Production acceptance

PR #807 merged the governed public Video transcript capability.

Production database authority advanced exactly to:

- migration count: `83`
- migration head:
  `20260903085155_phase_7b_public_video_transcript_authority.sql`
- permanent verifier: PASS
- post-promotion pending migrations: `0`

Production `video-public-delivery` is ACTIVE at version `8` with `verify_jwt=false`.

The exact merged-main frontend was activated in production before real transcript publication.

## Real transcript publication

The genuine reviewed transcript for `Monday Morning in September` was uploaded through canonical Media, governed for public use, selected in the Video Editor, and carried through new immutable Video lifecycle versions.

Transcript Media identity:

- asset:
  `23c189c0-1ffd-430b-a183-b5a3c16b58ce`
- exact revision:
  `ffa3fc06-52bf-4875-88b5-4bd024a2ea35`
- bytes: `157`
- SHA-256:
  `fb0cf3e6853b21c7428ee75d378d1943b0f6d005e75faf503beb7e01c77ce8f0`

The public transcript body is:

```text
00:00.000 --> 00:03.500
[overlapping street chatter]

00:09.000 --> 00:12.000
- Inajistabilize?
- Mmh

00:12.000 --> 00:14.000
Wacha kuongea juu ya footage.
```

The initial transcript publication reached published v12 without backfilling the earlier immutable v8.

The later governed caption correction preserved the same transcript exact revision through working v13, submitted v14, approved v15, and final published v16.

Final published v16:

`4ab5a5bb-b0f4-4b8b-8ea2-94fe1be8786e`

The public reader returns the exact transcript relationship for v16.

Production protected transcript delivery returned:

- HTTP `200`
- `text/plain; charset=utf-8`
- `157` bytes
- exact SHA-256:
  `fb0cf3e6853b21c7428ee75d378d1943b0f6d005e75faf503beb7e01c77ce8f0`

Public presentation of the reviewed timed text was accepted on the real Video.

## Caption regression discovered during transcript presentation

The transcript presentation exercise exposed one separate browser defect: the custom public caption overlay could retain the previous VTT cue after its explicit end time.

The VTT bytes were correct. PR #808 repaired the frontend player by deriving visible captions from cue `startTime` / `endTime` against actual Video `currentTime` and resynchronizing on `timeupdate`.

No transcript authority or caption file was rewritten by that player repair.

Desktop and mobile cue-expiry acceptance both passed after production activation.

## Final correction continuity

The reviewed 00:12 through 00:14 spoken line was then added to a new governed caption asset and carried through the existing immutable Video lifecycle.

Corrected caption:

- asset:
  `17c13145-5d34-420b-a445-d34b4f4b6570`
- exact revision:
  `e1bad3cf-7842-4598-929d-e0f214bea58d`
- bytes: `165`
- SHA-256:
  `f9d0ca3f03868d99fc61a3a4e9bdc8972f18865a375ce784a3692d4a61ee747c`

Final public v16 caption delivery returned HTTP `200` with exact bytes and SHA-256.

Desktop and mobile both proved the corrected cue renders from 00:12 through 00:14 and disappears at 00:14.

Historical published v12 remains stored with its original exact 110-byte caption relationship.

## Preview disposition

The disposable transcript preview was deleted after final real production acceptance:

- project ref:
  `fdsyuekeqvkghabgthaw`
- branch id:
  `8cb6cc56-5ea1-41d0-b029-48aa79d94777`
- deletion: PASS
- post-delete development-branch list: none

The preview-only synthetic immutable fixtures disappeared with the disposable branch. They were not rewritten individually.

This transcript slice is closed as part of the canonical Phase 7B closure:

`docs/engineering/phase-7b-closure-record.md`
