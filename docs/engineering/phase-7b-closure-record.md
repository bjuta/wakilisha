# Phase 7B Public Video Product Closure Record

Status: CLOSED

Closed: 3 September 2026

## Decision

Phase 7B Public Video product is closed and production accepted.

The programme exit instrument remained the real Video Episode:

`Monday Morning in September`

The final public acceptance proves one real captioned Video across desktop and mobile with governed adaptive delivery, MP4 fallback, governed transcript presentation, immutable correction continuity, and preserved historical publication authority.

Phase 7 is complete. The next numbered programme work is Phase 8: Field Capture.

## Final production authority

Accepted runtime main:

`b0ffd4718094e9cca8d66de711cdc8e27a448548`

Production database:

- migration count: `83`
- migration head: `20260903085155_phase_7b_public_video_transcript_authority.sql`
- pending repository migrations after promotion: `0`

Production Edge Function:

- `video-public-delivery`
- version: `8`
- status: `ACTIVE`
- `verify_jwt=false`

Production frontend:

- entry: `assets/index-cocVN-2T.js`
- index SHA-256: `f183a37a2a03ded8b3b70519c8560d065af8f59ad5c245dfae6c9bfa2b4a8984`
- entry SHA-256: `535c06db6538bb25ff3e8f8dcf01f821f71a6022c74c541e6f09a37489a85d9b`
- file count: `3687`
- dist-tree SHA-256: `7f1dc4a1a889d9c996231b14cd2f4cd776d436e37d0047aabd8225c8580090f2`
- rollback snapshot:
  `/opt/wakilisha-react-backups/phase7b-video-caption-cue-expiry-20260903T112417Z-b0ffd471`

## Final real Video publication

Current published immutable Video version:

- version number: `16`
- version id: `4ab5a5bb-b0f4-4b8b-8ea2-94fe1be8786e`
- version kind: `published`
- source authority revision: `14`
- publication authority revision after publish: `17`
- content fingerprint:
  `0e0529126f764cfe235f78848e0bf49c7b5da558030cf5f19feb220373ac4be8`

The correction lifecycle was:

- working v13:
  `71fad31e-7819-48c4-baff-525be1522628`
- submitted v14:
  `3e3a0601-b023-48d3-a7cf-b751f9e26b0d`
- approved v15:
  `d02c13cc-417c-43f6-ac94-6ae86bc2bb54`
- published v16:
  `4ab5a5bb-b0f4-4b8b-8ea2-94fe1be8786e`

Every transition preserved the same correction content fingerprint.

## Adaptive Video acceptance

The accepted V4A/V4B/V4C chain provides:

- one shared Media processing-profile authority used by Audio and adaptive Video
- two deterministic HLS renditions plus master playlist
- governed 360p and 720p selection
- HLS master playback with MP4 fallback
- one canonical Video playback canvas
- desktop and mobile settings hierarchy
- quality continuity
- captions
- fullscreen
- public Video visibility and playback continuity

The real adaptive package remains bound to the accepted native Media revision.

V4A canonical record:

`docs/engineering/phase-7b-v4a-adaptive-video-media-foundation.md`

V4C canonical record:

`docs/engineering/phase-7b-v4c-governed-video-quality-selection.md`

## Governed transcript acceptance

The real public Video now carries a governed transcript through canonical Media and immutable Video version authority.

Transcript identity:

- Media asset:
  `23c189c0-1ffd-430b-a183-b5a3c16b58ce`
- exact Media revision:
  `ffa3fc06-52bf-4875-88b5-4bd024a2ea35`
- bytes: `157`
- SHA-256:
  `fb0cf3e6853b21c7428ee75d378d1943b0f6d005e75faf503beb7e01c77ce8f0`

The public Video reader exposes only the logical transcript relationship. The browser never receives the protected Media storage path.

Production protected transcript delivery passed with HTTP `200`, `text/plain; charset=utf-8`, exact byte length, and exact SHA-256.

The public transcript presentation rendered the reviewed timed text on the real Video.

Canonical implementation record:

`docs/engineering/phase-7b-public-video-transcript-authority-and-presentation.md`

## Governed caption correction continuity

The published correction replaces no historical immutable record.

Original published v12 remains stored with:

- version id:
  `3041a5d9-2f23-46a5-8d8d-c243c7d41cc5`
- original caption asset:
  `bf758bdf-188e-4860-94a4-ac364bb67c0d`
- original caption revision:
  `49427742-501d-44a0-951e-da56e51992ae`
- original caption bytes: `110`
- original caption SHA-256:
  `c724f7dfb6bef10963d17d2c3a8325a589299e48b138490796c0040a7bb30c2c`

The corrected caption was uploaded as a new canonical Media asset, governed for public use, selected through existing Video caption authority, and carried through a fresh immutable Video lifecycle.

Corrected caption identity:

- Media asset:
  `17c13145-5d34-420b-a445-d34b4f4b6570`
- exact Media revision:
  `e1bad3cf-7842-4598-929d-e0f214bea58d`
- bytes: `165`
- SHA-256:
  `f9d0ca3f03868d99fc61a3a4e9bdc8972f18865a375ce784a3692d4a61ee747c`

The added cue is:

```text
00:12.000 --> 00:14.000
Wacha kuongea juu ya footage.
```

Production protected caption delivery for v16 passed with HTTP `200`, `text/vtt; charset=utf-8`, exact byte length, and exact SHA-256.

Desktop and mobile acceptance both proved:

- corrected cue visible from 00:12 through 00:14
- corrected cue disappears at 00:14
- the prior 00:09 through 00:12 cue no longer lingers after its end time

## Caption cue-expiry repair

Real browser acceptance exposed one frontend defect after transcript publication: Chrome could leave the custom caption overlay on the last cue after the cue had ended.

The VTT bytes were correct. The defect was stale player state caused by relying on browser `activeCues` / `cuechange` as the sole expiry signal.

PR #808 repaired only the public Video player and its tests:

- merged main:
  `b0ffd4718094e9cca8d66de711cdc8e27a448548`
- caption visibility now checks explicit cue `startTime` and `endTime` against actual Video `currentTime`
- `timeupdate` resynchronizes visible caption lines
- `cuechange` remains an immediate synchronization signal
- accepted caption VTT bytes were not mutated by the repair

PR Critical and protected-main Critical both passed before production frontend activation.

## Primitive compounding disposition

Phase 7B preserved the Primitive Compounding Contract.

It reused:

- canonical Resource and immutable Video version authority
- shared Media assets, revisions, governance, usage links, and processing profiles
- shared Show and Episode identity
- shared Trust surfaces
- existing Video-specific protected caption adapter, extended narrowly for transcript delivery
- shared timed-text parser and `PlayerTimedTextPanel`

It promoted one cross-domain primitive through real second-domain proof:

- shared Media processing-profile authority now serves Audio and adaptive Video

It deliberately retained Video-specific implementation where second-domain evidence did not justify universalization:

- public Video watching surface
- Video protected-text delivery adapter

No duplicate Video transcript store, Video correction subsystem, or Video-specific processing authority was created.

## Disposable preview disposition

The final transcript preview completed its purpose and was deleted after real production acceptance:

- preview name:
  `phase-7b-public-video-transcript`
- branch id:
  `8cb6cc56-5ea1-41d0-b029-48aa79d94777`
- project ref:
  `fdsyuekeqvkghabgthaw`
- deletion: PASS
- post-delete branch list: production main only

Synthetic immutable preview fixtures were removed with the disposable branch rather than rewritten individually.

## Key implementation and acceptance PRs

The accepted Phase 7B chain includes:

- V1 public read and delivery: PR #761
- V3 provider source convergence: PR #769
- V4A adaptive Media foundation: PR #800
- V4A closure reconciliation: PR #801
- V4B public adaptive playback: PR #802
- V4C governed quality and settings: PR #806
- governed public Video transcript delivery: PR #807
- caption cue-expiry repair: PR #808

The final transcript and corrected-caption publications were governed production content operations. They did not require new SQL or a new application PR.

## Phase 7B exit decision

The Phase 7B exit gate is satisfied.

One real captioned Video publication now proves:

- public current-published-version reads
- native MP4 fallback
- governed adaptive HLS
- desktop and mobile playback
- governed captions
- governed transcript presentation
- immutable review, approval, and publication continuity
- a real post-publication caption correction
- preserved prior immutable publication history
- protected caption and transcript delivery
- production rollback material
- disposable preview cleanup

Do not reopen Phase 7A or Phase 7B to add speculative abstractions.

New Video defects discovered later should be classified normally as product maintenance unless they invalidate one of the closed authority contracts.

## Programme handoff

The numbered programme advances to:

**Phase 8: Field Capture**

Phase 8 should begin from the accepted production state recorded here rather than by reopening Video publication or public Video foundations.

## Deployment classification

Documentation closure only.

- SQL migration needed: No
- Supabase Edge Function deploy needed: No
- frontend deploy needed: No
- production runtime change needed: No
