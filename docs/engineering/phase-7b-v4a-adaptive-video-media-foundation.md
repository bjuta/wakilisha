# Phase 7B V4A: Media Processing-Profile Convergence and Adaptive Video Foundation

Date: 2 September 2026

## Status

Milestone candidate. Not preview accepted. Not production accepted. No PR.

## Why V4A exists

Phase 7B cannot close against the authoritative programme exit proof while the real published Video still has only one MP4 delivery derivative.

The real published Video, `Monday Morning in September`, currently has:

- one exact protected Video master
- one selected `video_transcode` MP4 derivative
- one governed Sheng caption
- public provenance
- no adaptive rendition ladder
- no HLS or DASH manifest
- no governed transcript
- no real Video correction-handling proof

V4A addresses only the adaptive Media layer.

## Primitive-compounding decision

This milestone is governed by the Primitive Compounding Contract.

Phase 6A Audio already introduced the first real additive publication-specific Media processing profile:

- `audio-publication-v1`
- `submit_audio_delivery_processing_v1`
- `register_audio_delivery_processing_outputs_v1`

At one domain consumer, that was a legitimate candidate pattern.

Adaptive Video is the second real domain exposing the same semantic concept:

> Process one exact governed Media revision through a named immutable derivative profile, using the existing command/job/lease/retry/file/variant authority.

Therefore V4A must not create:

- `submit_video_adaptive_processing_v1`
- `register_video_adaptive_processing_outputs_v1`
- another Video processing queue
- another Video derivative registry

The second-domain proof requires **extract -> converge -> migrate**.

## Primitive impact declaration

### Reused foundation primitives

V4A reuses without replacement:

- Media logical asset identity
- immutable Media file objects
- exact Media revisions
- Media usage links
- Media variant roles
- immutable derivative variants
- current variant selections
- Media events
- `media.process_revision` command identity
- command receipts
- idempotency
- durable jobs
- outbox events
- lease renewal
- retry/dead-letter handling
- Media CDN delivery origin
- Resource binding for Media assets

### Candidate promoted to canonical authority

V4A promotes the cross-domain concept:

**Media processing profile**

Canonical authority becomes:

- `media.processing_profiles`
- `media.processing_profile_outputs`
- `public.submit_media_processing_profile_v1(...)`
- `public.register_media_processing_profile_outputs_v1(...)`

Audio is the first proven consumer.

Adaptive Video is the second proven consumer.

The profile authority owns:

- profile identity
- required Media asset kind
- generator identity/version
- required governed usage binding
- exact expected output roles
- exact filenames
- exact MIME types
- exact transformation contract

It does not own domain publication lifecycle.

### Existing candidate migrated

The accepted Audio-specific functions remain as compatibility entry points only:

- `submit_audio_delivery_processing_v1`
- `register_audio_delivery_processing_outputs_v1`

After V4A they delegate to the canonical Media processing-profile authority and no longer implement independent receipt/job/file/variant semantics.

The Media worker itself stops using the Audio-specific registration adapter.

### Intentionally domain-specific implementation

The actual transformation producer remains profile-specific inside the shared Media processor.

That is correct.

Audio delivery and adaptive Video encode different bytes and have different transformation specifications. Compounding requires one meaning for the shared processing authority; it does not require flattening distinct transforms into a universal encoder configuration language.

The following remain domain/profile-specific:

- Audio MP3 delivery transformation
- Video HLS rendition construction
- Video bitrate/resolution ladder
- HLS manifest composition

## Preserve Phase 4 base profiles

The accepted Phase 4 profiles remain immutable contracts.

`audio-v1` continues to produce exactly:

- `audio_preview`
- `waveform_data`

`video-v1` continues to produce exactly:

- `video_transcode`
- `poster_frame`
- `thumbnail`

V4A does not replace or broaden:

- `public.submit_media_processing_command_v1`
- `public.register_media_processing_outputs_v1`

The new canonical profile authority is additive.

## Canonical profile authority

`media.processing_profiles` stores one enabled named processing contract.

For each profile it records:

- profile version
- Media asset kind
- generator name/version
- required usage authority
- required usage target kind
- required usage role
- whether a version-bound usage target is required
- required target-version kind where applicable

`media.processing_profile_outputs` stores the exact output contract:

- ordered output membership
- variant role
- immutable filename
- MIME type
- exact transformation specification

The first two registered profiles are:

- `audio-publication-v1`
- `video-adaptive-v1`

This is evidence-driven convergence, not a speculative universal profile engine.

## Shared submission boundary

`public.submit_media_processing_profile_v1(...)`:

- requires authenticated administrator or `manage_media_assets`
- resolves one enabled canonical profile
- requires an active Media asset of the profile's asset kind
- requires one exact revision
- requires one verified protected Lightsail master
- requires the profile's governed exact-revision usage binding
- writes the existing `media.process_revision` command receipt
- writes the existing durable job
- writes the existing accepted outbox event
- preserves existing idempotency semantics

For Audio, the required usage is the active current `audio_master`.

For adaptive Video, the required usage is an active exact version-bound `video_master`.

## Shared output-registration boundary

`public.register_media_processing_profile_outputs_v1(...)`:

- is service-role-only
- requires an actively leased ordinary `media.process_revision` job
- resolves the profile from the job payload
- requires exactly the registered output count
- rejects unregistered or duplicate roles
- requires exact transformation JSON
- requires exact generator identity
- requires exact immutable storage/public paths
- requires exact MIME type
- reuses `media.insert_verified_file_object_v2`
- reuses `media.variants`
- reuses `media.variant_selections`
- reuses `media.events`

No profile-specific output-registration authority remains necessary.

## Adaptive Video profile

V4A adds:

`video-adaptive-v1`

Generator version:

`phase7b-v4a-v1`

It creates exactly five governed outputs:

1. `video_hls_master.m3u8`
2. `video_hls_360p_playlist.m3u8`
3. `video_hls_360p_media.ts`
4. `video_hls_720p_playlist.m3u8`
5. `video_hls_720p_media.ts`

### 360p rendition

- max width: 640
- max height: 360
- H.264
- 800 kbps video
- AAC
- 96 kbps audio

### 720p rendition

- max width: 1280
- max height: 720
- H.264
- 2500 kbps video
- AAC
- 128 kbps audio

### Shared HLS contract

- HLS version 6
- 4-second segment target
- VOD
- independent segments
- single-file byte-range media per rendition
- deterministic key-frame schedule
- one encoder thread
- bit-exact FFmpeg flags
- stripped source metadata

Single-file byte-range HLS is deliberate.

Two rendition playlists + two rendition media files + one master playlist produce exactly five immutable file objects, fitting the existing Media processing output ceiling while avoiding per-segment database identity.

## Immutable path law

All outputs preserve the existing Media derivative law:

`derived-objects/{asset-id}/{revision-id}/{profile}/{source-file-id}/{filename}`

Public delivery remains:

`https://media.wakilisha.africa/derivatives/{asset-id}/{revision-id}/{profile}/{source-file-id}/{filename}`

A retry that produces different bytes at the same immutable path fails closed.

## Determinism finding

The first unconstrained HLS experiment was not byte-stable across repeated runs.

That candidate was rejected.

The final candidate uses deterministic key-frame scheduling, one encoder thread, bit-exact flags, and zero mux delay/preload. Repeated synthetic processing produced matching hashes for both media renditions and both media playlists. The master playlist is deterministic text.

Preview and production must still prove the exact deployed FFmpeg environment.

## Public product boundary

V4A does **not** change the public Video read model or player.

Public Video remains on the accepted MP4 `video_transcode` during this milestone.

The next bounded slice may prefer HLS only after V4A is production accepted.

## Explicit non-goals

V4A does not:

- change Phase 4 `audio-v1`
- change Phase 4 `video-v1`
- add Video-specific processing RPCs
- create another processing queue or worker
- create another derivative store
- change public Video playback
- add `hls.js`
- remove MP4 fallback
- add or manufacture a transcript
- add Video correction submission/history
- change captions
- change Chapters
- change Video lifecycle
- close Phase 7B

## Local/static acceptance

Before preview:

1. Primitive Compounding verifier passes.
2. Primitive Compounding tests pass.
3. Python worker syntax passes.
4. Phase 4 Media processing contracts pass.
5. Phase 6A Audio delivery contracts pass.
6. V4A focused contract passes.
7. no Video-specific processing RPC is defined.
8. Audio compatibility functions delegate to shared profile authority.
9. worker routes both additive profiles through shared registration.
10. base `audio-v1` and `video-v1` authorities remain unmodified.
11. HLS output set is exactly five files.
12. HLS generation remains deterministic.
13. permanent V4A verifier is read-only.
14. no PR is opened.

## Preview acceptance

A fresh disposable Supabase preview must prove the full accepted migration history first.

Only after healthy baseline replay:

1. apply the exact V4A migration
2. prove processing-profile tables and RLS posture
3. run the permanent V4A verifier
4. prove Audio compatibility submission still creates the same ordinary Media job
5. prove Audio compatibility registration delegates without semantic drift
6. prove shared direct Audio profile submission behaves identically
7. prove adaptive Video submission through the shared profile function
8. reject wrong asset kind, wrong revision, missing usage, and wrong target-version shape
9. register the exact five adaptive outputs through the shared registration function
10. reject incomplete, duplicate-role, wrong-role, wrong-transform, wrong-generator, wrong-path, and wrong-MIME packages
11. prove idempotent replay
12. prove old `video-v1` remains intact
13. remove fixtures before preview deletion

## Production order

After preview acceptance and PR merge:

1. apply the exact merged migration
2. independently run permanent verification
3. verify Audio compatibility remains intact
4. deploy only the Media processor worker
5. verify worker byte identity and service health
6. run `video-adaptive-v1` for the existing real Video master through the canonical shared submit function
7. accept exactly five adaptive variants through the canonical shared registration function
8. verify immutable URLs, byte ranges, manifests, MIME types, and selected variants
9. keep public Video on MP4
10. record V4A production acceptance

## Remaining Phase 7B exit work

After V4A:

- public adaptive playback on desktop and mobile
- governed transcript authority and public transcript presentation
- public Video correction continuity and real correction-handling proof
- final real-Video exit acceptance
- Phase 7B closure record

## Accepted preview evidence — 2 September 2026

Disposable Supabase preview:

- branch id: `c6d454ec-37f7-48c0-a3db-20cb87445703`
- project ref: `qbzvovteagnoqrywkozo`
- branch name: `phase-7b-v4a-adaptive-video-media-sealed`
- production data copied: no
- hourly branch cost: `$0.01344`

### Baseline replay

The preview was not accepted while provisioning was still replaying migrations.

An early read observed 48 migrations at `20260823181332`; Postgres logs simultaneously showed `20260824061359_track_lyrics_review_provenance.sql` still applying. That was correctly treated as a mid-replay snapshot, not a failed baseline.

Accepted baseline after replay settled:

- migration count: 79
- migration head: `20260901170500`
- accepted Audio publication processing adapters present
- accepted public Video reader present
- preview status: `FUNCTIONS_DEPLOYED` / `ACTIVE_HEALTHY`

No V4A SQL was applied before that baseline was exact.

### Full migration rollback rehearsal

The complete candidate migration was executed on the accepted 79-migration preview with only terminal `COMMIT` replaced by `ROLLBACK`.

Result: PASS.

After rehearsal:

- migration count remained 79
- migration head remained `20260901170500`
- `media.processing_profiles`: absent
- `media.processing_profile_outputs`: absent
- shared processing-profile RPCs: absent
- adaptive Video variant roles: 0

No rehearsal residue remained.

### Native candidate application

The candidate was promoted to the preview only through native repository migration authority.

Native dry-run before apply:

- pending migrations: exactly 1
- pending file:
  `20260902205000_phase_7b_v4a_adaptive_video_media_foundation.sql`

Native `supabase db push --linked`: PASS.

Native dry-run after apply:

- pending migrations: 0

Accepted preview state:

- migration count: 80
- migration head: `20260902205000`
- permanent V4A verifier: PASS

Migration SHA-256:

`266def2527d55c0afc5e061acecf5036a5cc7edeccac08e1a39aaeb92742aa04`

### Canonical processing-profile state

Accepted canonical profiles:

`audio-publication-v1`

- asset kind: audio
- generator: `wakilisha-media-processor`
- generator version: `phase6a-m2-v1`
- required usage: editorial / audio_publication / audio_master
- version-bound target required: no
- outputs: 1

`video-adaptive-v1`

- asset kind: video
- generator: `wakilisha-media-processor`
- generator version: `phase7b-v4a-v1`
- required usage: video / video_publication / video_master
- target version kind: `video_publication_version`
- version-bound target required: yes
- outputs: 5

### Security and callable perimeter proof

Rollback-safe preview boundary proof passed:

- anon direct table read: denied
- anon shared submit EXECUTE: denied
- authenticated shared submit EXECUTE: allowed
- authenticated null-identity call: rejected with
  `Authenticated Media processing actor is required.`
- authenticated shared registrar EXECUTE: denied
- service-role shared registrar EXECUTE: allowed
- service-role invalid registration call: rejected with
  `Media processing-profile registration request is invalid.`
- Audio compatibility submit remains authenticated-only
- Audio compatibility registrar remains service-role-only

No fixture residue was retained.

### Advisor disposition

V4A-specific Security Advisor findings:

1. `media.processing_profiles`: RLS enabled with no policy — INFO
2. `media.processing_profile_outputs`: RLS enabled with no policy — INFO
3. authenticated `SECURITY DEFINER` shared submit — WARN

Disposition:

- the two profile tables intentionally expose no direct application table API:
  RLS is enabled and direct privileges are revoked from public, anon,
  authenticated, and service_role
- the shared submit is intentionally an authenticated command endpoint and
  preserves WAKILISHA's governed command pattern:
  explicit `auth.uid()`, `manage_media_assets` / administrator capability,
  fixed search path, default EXECUTE revoked, anon denied
- V4A introduced no `auth.role()` checks

V4A-specific Performance Advisor findings:

- three unindexed foreign-key INFO notices on static processing-profile vocabulary

Disposition:

- no index is added speculatively because these are tiny configuration tables,
  not high-volume lookup or deletion paths
- the canonical primary/unique keys already cover normal profile resolution

No advisor finding indicates public row exposure, privilege broadening, or a
new production query-path performance defect.

### Replay/schema seal

Replay proof:

`docs/engineering/replay-proofs/20260902205000_phase_7b_v4a_adaptive_video_media_foundation.sql.json`

Accepted seal:

- base main:
  `6af61b3bf6eb0acd671f5b354334291e9d65b94d`
- preview project:
  `qbzvovteagnoqrywkozo`
- preview branch:
  `c6d454ec-37f7-48c0-a3db-20cb87445703`
- schema migration count: 80
- schema migration head: `20260902205000`
- generated type SHA-256:
  `be5ff86a3c1f93d7feeac2db63de3ccb7cf71cde8aeeacad5162628b93885b2c`
- baseline replay: PASS
- candidate apply: PASS
- verifier: PASS

### Candidate Critical Control Plane

Branch-sealed Critical Control Plane run:

- run id: `33666447348`
- result: PASS
- migration replay contract: PASS
- migration replay tests: PASS
- Primitive Compounding contract: PASS
- Phase 7A kernel/K5A/K5B/K5C/K5D gates: PASS
- Phase 7B V1/V2/V3 gates: PASS
- V4A adaptive Video Media foundation gate: PASS
- full security/lifecycle suite: PASS
- live schema/migration-history drift check: PASS
- application build: PASS

The temporary branch-only preview-seal workflow was removed after generating
the canonical replay artifacts. It is not part of the permanent milestone.

## Preview exit decision

V4A preview authority is sealed.

The candidate may now proceed to PR/CI.

Production remains unchanged at 79 migrations / `20260901170500`.

No Media processor worker deployment has occurred.

No adaptive Video derivatives exist in production.

Public Video still uses the accepted MP4 `video_transcode`.

