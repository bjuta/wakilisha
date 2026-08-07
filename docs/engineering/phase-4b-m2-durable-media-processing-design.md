# Phase 4B M2: Durable Media Processing

Date: 7 August 2026

## Status

Implementation boundary locked after the production processing-authority audit.

M2 starts from:

`a620c783 Phase 4B M1: add resumable media master ingest (#583)`

M1 is closed and must not be reopened.

## Objective

Turn a verified immutable Media master into durable, inspectable processing work
that can generate governed derivatives asynchronously, retry safely without
another master upload, survive worker interruption, and expose terminal failure.

M2 reuses the platform's existing Media identity, resource identity, durable
jobs, transactional outbox, and event authorities.

M2 does not create a second queue, retry ledger, outbox, Media identity, or
storage authority.

## Audited production baseline

### M1 master

The accepted M1 production master remains:

- upload session `bda7bf24-8021-4d05-bd15-ef3d4b4a5e84`
- file object `b4d803ad-dfa2-4109-8508-88fb1488fc55`
- path `masters/audio/2026/08/bda7bf24-8021-4d05-bd15-ef3d4b4a5e84.wav`
- bytes `31752044`
- SHA256 `38c088cbf6fc557e18b63f7837370c6aaf762c38393f266e41a39266113429b4`
- MIME `audio/wav`
- verification state `verified`

It has no Media revision and no Media variant yet.

M2 acceptance may adopt this exact file object into one governed Audio Media
asset and revision. The master bytes must not be uploaded again or rewritten.

### Processing runtime

Production Lightsail currently has:

- 2 vCPUs
- 1.9 GiB RAM
- no swap
- about 50 GiB free disk
- no FFmpeg
- no FFprobe
- no Media processing worker
- only the Media receiver as a repository-owned Media systemd service

M2 therefore introduces a bounded single-concurrency processing worker. It must
not assume horizontal worker infrastructure or high-memory transcoding capacity.

### Durable jobs

`platform_private.jobs` is the required queue authority.

It already provides:

- queued work
- running leases
- attempt counts
- maximum attempts
- retry-wait
- dead-letter
- cancellation
- completion
- transactional outbox events

Production currently contains unrelated durable work. The generic
`platform_private.claim_jobs()` has no job-type filter.

A Media worker must not call the generic unfiltered claim function.

M2 must add a service-role-only filtered claim contract for Media processing
jobs on the same `platform_private.jobs` table.

### Lease recovery gap

The audited job authority has claim, complete, and fail helpers, but no dedicated
expired-running-lease recovery helper.

M2 must add recovery for expired leases of the Media processing job type.

Recovery must:

1. never steal an unexpired lease
2. clear an expired worker lease
3. preserve attempt history
4. move retryable work to `retry_wait`
5. move exhausted work to `dead_letter`
6. update the command receipt on terminal failure
7. emit the existing command-type retry or failure outbox event
8. remain scoped to the Media processing job type

### Resource identity bridge

`platform_private.jobs.resource_id` references `editorial.resources`.

Media assets are not currently a resource kind, and production has no Media
resource rows.

M2 extends the established typed-resource pattern rather than bypassing the
foreign key.

Add:

- resource kind `media_asset`
- typed immutable binding `editorial.media_asset_resources`
- exactly one binding from `editorial.resources.id` to `media.assets.id`
- deferred binding-integrity support in
  `editorial.assert_resource_binding_integrity()`

For M2-created processing resources, use the Media asset UUID as the resource
UUID. This keeps one stable identity across Media and the shared orchestration
layer without making `editorial.resources` a second Media authority.

Existing historical Media assets are not bulk backfilled in M2.

The processing-submission command may create the missing internal
`media_asset` resource binding for the target asset idempotently.

## Processing identity

The processing target is a Media **asset revision**, not a naked file object.

A processing request is bound to:

- Media asset
- exact immutable asset revision
- exact source file object
- immutable transformation contract version
- submitting actor
- correlation id
- idempotency key

This matters because the same master may later belong to replacement history,
and processing retries must never silently move to another revision.

## Command contract

Add controlled command type:

`media.process_revision`

Job type:

`media.process_revision`

Events:

- `media.processing.accepted`
- `media.processing.succeeded`
- `media.processing.failed`
- `media.processing.retry_scheduled`

Submission requires:

- authenticated user
- administrator or `manage_media_assets`
- existing active Media asset
- current or explicitly selected revision
- verified original file object
- supported source MIME for the requested processing profile

The command receipt records the real submitting actor.

The service worker never invents an administrator identity.

## Worker authorization

Existing public Media variant commands call `media.require_command_actor()` and
therefore require an authenticated user UUID.

The processing worker runs as a service principal and must not impersonate a
browser user.

M2 adds a narrow service-role processing completion function that:

1. verifies the job is actively leased to the calling worker
2. loads the immutable command input
3. loads the recorded `actor_user_id` from the command receipt
4. validates the target asset, revision, and source file object
5. registers exact derived file objects
6. records variants and selections attributed to the original command actor
7. preserves one correlation identity
8. returns an idempotent result when the same exact derivative was already
   registered

This is a processing adapter to canonical Media authority, not a second Media
write model.

## Processor runtime

Add repository-owned:

- `ops/media-processor/worker.py`
- `ops/systemd/wakilisha-media-processor.service`

The worker:

- runs as `www-data`
- uses FFmpeg and FFprobe installed from the host package manager
- uses one processing slot
- polls only `media.process_revision`
- has no direct database password
- uses the Supabase service key from a root-owned environment file
- claims through service-role RPC
- reads protected masters locally
- writes derivative staging files under a private processing staging root
- fsyncs outputs before immutable activation
- never modifies masters
- registers derivatives only after exact output size and SHA256 are known
- removes abandoned staging files
- reports retryable versus terminal failures through the shared job authority

Systemd must bound resource use appropriate to the current 1.9 GiB host.

At minimum:

- `NoNewPrivileges=yes`
- `PrivateTmp=yes`
- `ProtectSystem=full`
- explicit `ReadWritePaths`
- one worker process
- restart on unexpected failure
- conservative memory limit
- environment file mode `0600`

## Storage layout

Protected originals remain:

`/opt/wakilisha-media/masters/...`

M2 derivatives use a separate immutable tree:

`/opt/wakilisha-media/derivatives/...`

Temporary processing output uses:

`/opt/wakilisha-media-processing/...`

A deterministic derivative path is derived from:

- asset revision id
- source file object id
- variant role
- processing profile version

A retry must target the same deterministic derivative path.

If an immutable target already exists:

- exact byte size and SHA256 match: reuse it
- mismatch: fail terminally as an immutable-path collision

No worker operation may overwrite an existing verified derivative.

## M2 derivative contract

M2 uses the existing Phase 4A Media variant authority.

Existing roles already include:

- `thumbnail`
- `web_optimized`
- `poster_frame`
- `audio_preview`
- `video_transcode`
- `preservation_copy`

M2 adds one missing governed role:

`waveform_data`

### Audio profile v1

For supported audio masters:

1. probe source with FFprobe
2. record duration, codec, channel count, sample rate, and bitrate where available
3. create `audio_preview`
4. create `waveform_data`

`audio_preview`:

- MP3
- 128 kbps
- stereo where source permits
- first 30 seconds for M2 proof
- public derivative
- immutable

`waveform_data`:

- bounded JSON peak envelope derived from the source
- deterministic number of samples
- no raw PCM
- immutable
- public-safe derivative data

The waveform is stored as a derived file object and governed Media variant, not
as mutable metadata on the master.

### Video profile v1

For supported video masters:

1. probe source with FFprobe
2. create bounded `video_transcode`
3. create `poster_frame`
4. create `thumbnail`

`video_transcode`:

- MP4 container
- H.264 video
- AAC audio when audio is present
- maximum 720p
- preserve aspect ratio
- `faststart`
- bounded CPU and memory

`poster_frame`:

- JPEG
- deterministic extraction time
- immutable

`thumbnail`:

- JPEG
- width 320
- preserve aspect ratio
- immutable

M2 implementation must support the video profile even if the first production
processing proof uses the accepted M1 audio master.

A real video upload and interrupted-transfer acceptance remains required before
Phase 4B closes.

## Public derivative delivery

Masters remain protected.

The derivative Nginx lane may expose:

`/derivatives/`

only after the derivative file object is verified and the processing command
has registered the corresponding variant.

M2 acceptance must prove a generated audio preview returns HTTP 200 and the
master remains HTTP 404.

Signed private master delivery remains outside M2 unless required by the worker.

## Retry and idempotency

A processing retry must not require another master upload.

The following must be idempotent:

- command submission with the same idempotency key and fingerprint
- resource binding creation
- deterministic output path
- derived file-object registration
- variant registration for the same revision, role, source, and transform
- active variant selection when already selected
- job completion after durable Media registration

A changed processing request must use a new idempotency key and processing
profile version.

## Failure semantics

M2 must expose:

- `queued`
- `running`
- `retry_wait`
- `succeeded`
- `dead_letter`
- `cancelled`

Worker failure categories:

### Retryable

Examples:

- temporary FFmpeg process failure
- transient Supabase RPC/network failure
- temporary filesystem pressure
- worker interruption or expired lease

### Terminal

Examples:

- missing verified source master
- source checksum mismatch
- unsupported MIME/profile
- immutable derivative path collision with different bytes
- corrupt source that FFprobe cannot parse
- exhausted maximum attempts

No terminal processing failure deletes or mutates the verified master.

## Production acceptance

M2 is not accepted until production proves all of the following with the
existing M1 WAV master:

1. create one governed Audio Media asset
2. attach the existing verified M1 file object as revision 1 without re-upload
3. create its `media_asset` shared resource binding
4. submit one `media.process_revision` command
5. prove one durable shared job and accepted outbox event
6. claim only the Media job, leaving unrelated queued work untouched
7. process the protected WAV through FFmpeg/FFprobe
8. register one immutable MP3 `audio_preview`
9. register one immutable `waveform_data` JSON derivative
10. preserve exact source master bytes and SHA256
11. expose preview publicly with HTTP 200
12. keep master public delivery at HTTP 404
13. prove both derivatives are canonical verified file objects
14. prove both variants belong to the exact source revision and file object
15. prove active variant selections point to those variants
16. prove the shared job succeeds and emits the success outbox event
17. submit the same processing request again and prove idempotent replay
18. inject one retryable processing failure without another upload
19. prove `retry_wait`
20. reclaim and succeed the same job or a dedicated recovery proof job
21. inject an expired worker lease and prove recovery
22. inject a terminal processing failure and prove `dead_letter`
23. prove the original master is unchanged after every failure path
24. prove worker, systemd, derivative delivery, and database rollback paths

Final marker:

`PHASE_4B_M2_DURABLE_MEDIA_PROCESSING_ACCEPTANCE_PASS`

## Rollback

Rollback must be additive and non-destructive.

Database rollback:

- disable the `media.process_revision` command type
- stop new processing submissions
- preserve jobs, receipts, events, file objects, variants, and selections

Worker rollback:

- stop and disable `wakilisha-media-processor.service`
- restore prior service/runtime package state where practical
- preserve generated immutable derivatives

Nginx rollback:

- remove or restore the derivative delivery location from the recorded backup
- do not remove master protection

Never delete accepted masters or canonical derivative records to roll back M2.

## M2 non-goals

M2 does not:

- build the Media Library frontend
- expose upload progress UI
- build Audio publication pages
- build Video publication pages
- bulk backfill every historical Media asset into `editorial.resources`
- create transcripts or captions
- create signed user-facing original delivery
- redesign Phase 4A Media identity
- create another queue or outbox
- replace the M1 upload receiver

Those remain M3 or M4 concerns.

## Implementation sequence

M2 is one substantial milestone and should remain one implementation PR.

The internal build sequence is:

1. schema and command bridge
2. filtered claim and expired-lease recovery
3. service-only Media processing completion adapter
4. worker and systemd contract
5. FFmpeg/FFprobe host dependency and derivative storage
6. derivative Nginx delivery
7. local contract tests and SQL verifier
8. production database deployment
9. processor/runtime deployment
10. real production audio processing acceptance
11. retry, expired-lease, dead-letter, and idempotency acceptance
12. record acceptance
13. one M2 PR

Do not split this sequence into layer-specific PRs unless a genuine blocker
requires it.

## Production acceptance evidence

Production acceptance completed on 2026-08-07 after the durable processing database authority, processor runtime, and derivative delivery lane were deployed and verified.

### Accepted production authority

- Authoritative migrations: 202.
- Migration 201: `20260807125500_phase_4b_m2_durable_media_processing.sql`.
- Migration 202: `20260807140830_phase_4b_m2_idempotent_replay_fix.sql`.
- Processor worker SHA256: `d43507928d7b0b1d1674890e00f714b95f27f2ab7f0e8727fbca5ce7821fd057`.
- Processor systemd SHA256: `ce10b700dff229c74194f465ba0a235016f6eb6ad65dbdab7a8042307548aacb`.
- Media Nginx SHA256: `0fe06bd6ce5244c64095401cd156f6c4600d33cb01c2a9569aa1cfa0dc50d31b`.
- FFmpeg and FFprobe version: `6.1.1-3ubuntu5`.
- Processor service: active.
- Frontend changed: no.
- Receiver changed: no.
- Edge Function changed: no.

### Accepted source master

- Asset: `6686d661-8aa5-4b15-8d94-dd47e577473c`.
- Asset revision: `41341969-9f3e-4223-b279-5a0769c93c17`.
- Original file object: `b4d803ad-dfa2-4109-8508-88fb1488fc55`.
- Original storage path: `masters/audio/2026/08/bda7bf24-8021-4d05-bd15-ef3d4b4a5e84.wav`.
- Original byte size: `31752044`.
- Original SHA256: `38c088cbf6fc557e18b63f7837370c6aaf762c38393f266e41a39266113429b4`.
- Existing M1 master adopted without re-upload: pass.
- Original master unchanged after all processing and failure-path tests: pass.

### Durable processing proof

- Preserved retry-exhaustion job: `a9c489e4-1cf7-4884-a778-5ffc709ed044`.
- Successful main processing job: `8cb84dd3-572a-4553-ba7f-475251b3e233`.
- Controlled retry recovery job: `353c34c2-8bad-4724-8a0e-4441a57a9c2f`.
- Controlled expired-lease recovery job: `33524fc8-8252-49dc-8ebd-75e0b45ab66b`.
- Controlled terminal dead-letter job: `3aef9bee-9a59-4895-b296-a767b1266583`.
- Final Media processing jobs: 5.
- Final succeeded jobs: 3.
- Final dead-letter jobs: 2.
- Canonical variants: 2.
- Active variant selections: 2.
- Canonical derivative file objects: 2.
- Unrelated queued shared job remained untouched by Media claims: pass.

### Delivery and idempotency proof

- Audio preview HTTP: 200.
- Waveform JSON HTTP: 200.
- Protected canonical derivative HTTP: 404.
- Protected master HTTP: 404.
- Idempotent replay returned the same succeeded command and job: pass.
- Replay created no new job: pass.
- Replay created no duplicate variant: pass.
- Replay created no duplicate derivative file object: pass.
- Retry recovery without master re-upload: pass.
- Expired worker lease recovery: pass.
- Retry exhaustion to dead letter: pass.
- Controlled terminal dead letter: pass.
- Temporary acceptance administrator role revoked after proof: pass.

### Final acceptance marker

`PHASE_4B_M2_DURABLE_MEDIA_PROCESSING_ACCEPTANCE_PASS`

Phase 4B M2 Durable Media Processing is production-accepted. M3 Media Library Workflow + Delivery is unblocked only after the M2 repository PR is merged.
