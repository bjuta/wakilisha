# Phase 4B M3 acceptance record: Media Library Workflow + Delivery

Date: 7 August 2026

## Status

Production acceptance complete.

This milestone becomes repository-closed when the M3 pull request containing
this record and the accepted implementation is merged to main.

## Repository boundary

M3 was built on the closed M2 main baseline:

- base main: `a420ca20e00e9d802f55a4e4ca9c7c8ec4e52f99`
- branch: `feat/phase4b-m3-media-library-workflow-delivery`

The milestone remains one coherent implementation and acceptance package.

## Production schema authority

Accepted production schema:

- authoritative migrations: 205
- linked migration ledger: current
- generated public-schema types: match production

M3 migrations:

- `20260807152824_phase_4b_m3_media_library_workflow_delivery.sql`
- `20260807160541_phase_4b_m3_upload_session_constraints_v2.sql`
- `20260807165813_phase_4b_m3_adoption_compatibility_identity_url.sql`

Applied migration history was never rewritten. The two post-deployment
corrections were forward migrations.

Migration 204 widened the shared upload-session table constraints so the
forward v2 command can accept audio and video masters from greater than zero
bytes through 2 GiB while the M1 v1 command contract remains frozen.

Migration 205 corrected the compatibility projection for adopted resumable
masters. The compatibility row uses a unique non-deliverable Media asset
identity under `/__private/media-asset/<asset-id>` and never exposes the
protected master URL.

## Runtime authority

Accepted Media runtime:

- receiver SHA-256:
  `bf30b6dd39fd6d957c5ebda3a535f6c92401812ab113992c8284154f1074b8d7`
- `media-upload-api` version: 22
- Media receiver service: active
- Media processor service: active
- frontend entry: `assets/index-BxZq9mzP.js`
- frontend index SHA-256:
  `072265010297d8528fce0243738b5f7f7940703581f831ad32fa07923c8ac911`
- final frontend rollback backup:
  `/opt/wakilisha-react-backups/phase4b-m3-resume-feedback-20260807T173328Z`

Public application smoke returned HTTP 200 for:

- `/`
- `/charts`
- `/artists`
- `/magazine`
- `/admin/media/library`

## Delivered workflow

M3 connects the existing shared Media Library to the M1 resumable upload and
M2 durable processing authorities without creating a second library.

Accepted workflow:

1. validate audio/video input
2. incrementally SHA-256 hash browser blobs
3. create or replay a resumable v2 upload session
4. upload bounded direct parts with per-session capability and part SHA-256
5. pause and resume from durable accepted parts
6. finalize and verify the protected master
7. adopt the exact verified canonical file object without copying it
8. create one logical Media asset and one revision
9. submit durable M2 processing for the exact revision
10. project processing and derivative state through the existing admin read
11. render only governed public derivatives
12. keep masters and canonical derivative objects private

The existing image/PDF direct lane remains in place.

Picker audio/video support remains explicit and opt-in. Existing image/document
picker behavior remains compatible.

## Real production audio proof

Accepted automated audio proof:

- asset: `86007c1f-5f9a-4543-8f01-cd0418348ae0`
- revision: `a5e11853-4536-478e-8574-f2eb1df9107a`
- canonical master file object: `ca2fb2f4-87d0-4b40-8fbe-097085194774`
- processing job: `fe9e4daa-bb86-4837-9d2f-b2a8f7fd0139`
- selected derivative roles: 2
  - `audio_preview`
  - `waveform_data`
- waveform bound: at most 1,000 peaks
- master public delivery: HTTP 404
- canonical derivative-object public delivery: HTTP 404
- selected derivative public delivery: HTTP 200

The audio workflow also proved interruption and resume before finalization.

## Real production video proof

Accepted automated video proof:

- asset: `0201b6df-eee3-4b3d-9791-92df0e9f5795`
- revision: `d727410c-9d08-40e6-823e-9c63671fea11`
- canonical master file object: `31608e7a-e423-4de3-8b5d-9b9c226677d8`
- processing job: `f3c9adf7-b4c1-4832-8cad-6222bd92d6ba`
- selected derivative roles: 3
  - `video_transcode`
  - `poster_frame`
  - `thumbnail`
- master public delivery: HTTP 404
- canonical derivative-object public delivery: HTTP 404
- selected derivative public delivery: HTTP 200

## Idempotency and cleanup proof

Accepted production proof established:

- adoption replay returns the same asset, revision and master
- processing replay returns the same durable job
- no duplicate logical asset is created by adoption replay
- no duplicate job is created by processing replay
- partial-upload cancellation removes receiver partials
- cancelled sessions do not acquire canonical file objects

Initial controlled cancellation session:

- `c2ec4ddb-b211-4fc3-9f96-3398f1f2063a`

## Browser acceptance

The final human-visible browser acceptance was performed in the production
Media Library.

Accepted browser audio fixture:

- `phase4b-m3-real-media-20260807T164136Z-browser-pause-resume.wav`

Accepted browser video fixture:

- `phase4b-m3-real-media-20260807T164136Z-browser-video.mp4`

The same retained video fixture was used once by the automated real-video
acceptance and once by the human browser workflow, so production contains two
verified upload sessions for this filename. This is expected and does not
represent a replay duplicate.

Observed and accepted:

- browser SHA-256 hashing proceeds under the production CSP
- multipart audio upload exposes Pause
- Pause stops progression after accepted parts
- Resume continues from already accepted parts rather than restarting
- audio upload reaches processing and Ready
- processed audio preview plays
- waveform data renders
- video upload reaches processing and Ready
- processed video preview plays
- poster/thumbnail presentation is available
- the legacy image editing workflow remains usable

The successful browser audio/video acceptance increased the live processing
authority to:

- Media processing jobs: 9
- processor variants: 12

## Browser CSP correction

The first browser acceptance exposed two CSP omissions:

- streaming SHA-256 WebAssembly compilation was blocked
- waveform JSON fetches from `media.wakilisha.africa` were blocked

The accepted correction adds:

- `'wasm-unsafe-eval'` to `script-src`
- `https://media.wakilisha.africa` to `connect-src`

General `'unsafe-eval'` remains disabled.

Waveform delivery was separately verified to return CORS permission for
`https://wakilisha.africa`.

## Resume feedback correction

The underlying Resume protocol was correct, but browser acceptance found a
three-to-five-second period with no visual acknowledgement while the client
reconciled durable session status and prepared the next part.

The accepted frontend correction updates the queue immediately on Resume.

Final human proof used:

- `phase4b-m3-resume-feedback-20260807T173328Z.wav`

Observed sequence:

1. row visibly paused
2. Resume clicked
3. row immediately changed to
   `Resuming from 1 of 7 accepted parts...`
4. progress UI became active without waiting for the next part to complete
5. test upload was cancelled
6. UI reported partial parts cleaned up

The feedback correction changes no resumable protocol, SQL, receiver, or Edge
runtime.

The final feedback fixture remains cancelled and produced no accepted Media
asset.

## Automated regression acceptance

Final focused Media suite:

- test files: 6
- tests: 44
- result: PASS

Coverage includes:

- M1 resumable master authority
- M2 durable Media processing
- M3 audio/video v2 session authority
- upload-session constraint widening
- verified-master adoption
- compatibility identity URL authority
- streaming browser SHA-256
- per-part capability/checksum upload
- Pause/Resume/Cancel
- immediate Resume acknowledgement
- workflow-state admin read projection
- governed audio/video derivative rendering
- explicit picker opt-in
- browser CSP WebAssembly and Media-connect authority
- existing Phase 4A Media write and CORS contracts

Application build passes.

Live schema verification passes.

Engineering control-plane verification passes.

## M3 exit gates

Passed.

- Existing image/PDF upload behavior remains usable.
- Audio and video use resumable protected masters.
- Browser hashing is bounded and incremental.
- Uploads can pause and resume from durable accepted parts.
- Cancellation cleans partial state.
- Verified masters are adopted without reuploading or copying.
- Processing can retry/replay without reuploading the master.
- Audio preview and waveform derivatives are governed and publicly deliverable.
- Video transcode, poster and thumbnail derivatives are governed and publicly
  deliverable.
- Masters remain non-public.
- Canonical derivative objects remain non-public.
- Admin read authority projects upload, processing and delivery state.
- Native audio/video previews render from governed derivatives.
- Picker behavior remains backward-compatible by default.
- Browser CSP permits required Media operations without enabling general
  JavaScript eval.
- Resume provides immediate human-visible acknowledgement.
- Temporary production acceptance authority is revoked.
- Production schema, receiver, processor, Edge and frontend are mutually
  consistent.

## Deferred to M4

M4 owns Operational Hardening + Acceptance + CLOSE.

M4 should build on this accepted M3 authority and focus on:

- operational hardening
- storage reconciliation
- orphan cleanup
- failed-processing recovery operations
- monitoring and observability
- retention/cleanup operational proof
- final Phase 4B acceptance
- final Phase 4B closure

M3 does not reopen M1, M2, or Phase 4A authority.
