# Phase 4B M3: Media Library Workflow + Delivery

Date: 7 August 2026

## Status

Implementation contract locked from merged M2 main.

M2 is closed at:

`a420ca20e00e9d802f55a4e4ca9c7c8ec4e52f99`

M3 must not reopen M1 or M2 history. Required forward changes are additive or replacement-safe.

## Objective

Connect the existing shared administrative Media Library to the accepted M1 resumable-ingest and M2 durable-processing authorities.

M3 is an integration milestone. It does not create another Media Library, upload service, processing queue, Media identity, or picker implementation.

## Audited starting point

Production has:

- 202 authoritative migrations
- 1081 Media assets
- one governed audio asset
- zero governed video assets
- three durable resumable upload sessions
- five Media processing jobs
- two processing variants
- two active processing variant selections

The accepted audio proof remains:

- asset `6686d661-8aa5-4b15-8d94-dd47e577473c`
- lifecycle state `active`
- authority revision `2`
- current revision `41341969-9f3e-4223-b279-5a0769c93c17`
- original file object `b4d803ad-dfa2-4109-8508-88fb1488fc55`
- `audio_preview`
- `waveform_data`

## Existing frontend authority

`MediaLibraryCore` is the single shared component for:

- `/admin/media/library`
- `MediaPickerModal`

M3 preserves that structure.

The current library upload lane accepts only images and PDFs.

The current image and PDF flow uses:

- `media-upload-api`
- `create_media_asset_write_v2`
- immutable file-object and revision authority

That lane is accepted Phase 4A behavior and must remain operational.

The current preview panel renders images and generic file cards. It does not render governed audio or video derivatives.

The runtime frontend currently has no M1 resumable-session integration and no M2 processing-submission integration.

## M1 limitation inherited by M3

`create_media_upload_session_v1` is frozen as the accepted M1 contract.

It is intentionally limited to:

- audio MIME types
- audio extensions
- masters under `masters/audio/`
- files larger than 25 MiB
- files no larger than 2 GiB

M3 must not silently mutate this accepted v1 behavior.

## M3 upload-session authority

M3 adds a new forward upload-session contract for Media Library masters.

Use a new versioned command rather than changing v1 semantics.

The M3 session contract must support:

### Audio

Common supported extensions:

- mp3
- m4a
- aac
- wav
- flac
- ogg
- oga

MIME must be `audio/*`.

Storage root:

`masters/audio/`

### Video

Common supported extensions:

- mp4
- mov
- m4v
- webm
- mkv

MIME must be `video/*`.

Storage root:

`masters/video/`

### Size

The M3 master lane is used for audio and video regardless of whether the file is above or below the old 25 MiB M1 threshold.

Maximum master size remains 2 GiB unless a later audited production change raises it.

The existing image and PDF lane remains separate and unchanged.

## Browser hashing

The upload-session authority requires the expected SHA-256 before transfer begins.

The current frontend has no chunk-capable browser SHA-256 implementation.

M3 must hash large masters incrementally.

The implementation must:

1. read the file in bounded chunks
2. avoid `file.arrayBuffer()` over the entire master
3. expose hashing progress separately from upload progress
4. support cancellation while hashing
5. produce the exact lowercase 64-character SHA-256 required by the session command

A small pinned browser hashing dependency is permitted if it is isolated behind one Media utility and verified by contract tests.

## Resumable transfer workflow

The existing `media-upload-api` remains the authenticated control plane.

Large master bytes must never pass through the Edge Function.

The browser workflow is:

1. validate file kind and extension
2. calculate SHA-256 incrementally
3. create or replay the resumable upload session
4. receive per-session capability and part-upload base URL
5. upload deterministic parts directly to the receiver
6. persist part success in UI state
7. allow in-session pause and resume
8. query durable session status before resuming
9. finalize only after all parts are present
10. verify the exact byte size and SHA-256
11. obtain the canonical verified `media.file_objects` identity
12. adopt that exact file object into canonical Media asset and revision authority
13. submit M2 processing for the exact revision
14. refresh the existing Media Library read model

No retry may require re-uploading a verified master.

## Capability handling

The receiver capability is scoped to one upload session.

M3 must not expose the shared receiver secret.

The frontend may hold the per-session capability only for the active resumable workflow.

The first M3 acceptance requirement is in-session interruption and resume. Durable cross-browser recovery is not claimed unless a safe capability reissue contract is added and verified.

## Canonical asset adoption

M3 must not make the browser perform a fragile sequence of direct Media inserts.

Add one narrow authenticated workflow adapter that:

1. requires `manage_media_assets`
2. loads a verified resumable upload session owned by the actor
3. verifies its canonical file object
4. creates or idempotently reuses one logical Media asset
5. creates or idempotently reuses revision one bound to that exact file object
6. records normal governance and compatibility projections through existing canonical Media authority
7. returns the asset id, revision id, file object id, and authority revision
8. never copies or rewrites master bytes

The adapter orchestrates existing canonical Media authority. It is not a second write model.

## Processing submission

After canonical adoption, submit:

`media.process_revision`

using:

- exact asset id
- exact revision id
- immutable profile version
- real authenticated actor
- fresh correlation id
- deterministic idempotency key for the workflow

Retrying processing must reuse the verified master and canonical revision.

## Admin read-model extension

`read_media_assets_admin_v2(jsonb)` already exposes canonical current revision identity but no M3 workflow state.

M3 may add backward-compatible JSON fields to the existing adapter.

The library read model needs, at minimum:

- current revision id
- original file object id
- upload session state when relevant
- latest Media processing job status
- processing attempt count
- last processing error
- selected derivative roles
- selected derivative public URLs
- selected derivative MIME types
- processing profile version

Required derivative roles:

Audio:

- `audio_preview`
- `waveform_data`

Video:

- `video_transcode`
- `poster_frame`
- `thumbnail`

Protected master storage paths must never be returned as browser delivery URLs.

## Media Library workflow

The existing `MediaLibraryCore` remains the single library implementation.

Standalone library mode must support:

- image
- document
- audio
- video

Upload state for audio and video must distinguish:

- hashing
- creating session
- uploading
- paused
- verifying
- processing
- ready
- retry waiting
- failed
- cancelled

The UI must show byte progress and part progress for resumable transfers.

A verified upload may continue processing after the upload UI finishes.

## Picker compatibility

The shared picker architecture remains.

M3 must not make every existing picker consumer suddenly accept audio and video.

Add an explicit allowed-kind contract.

Default picker behavior remains compatible with current consumers.

Consumers that opt into audio or video may receive only public governed derivative URLs, never protected master URLs.

## Preview and delivery

### Audio

For a ready audio asset, render:

- native browser audio playback from `audio_preview`
- waveform data from `waveform_data`
- processing state
- source filename and metadata

The master remains protected.

### Video

For a ready video asset, render:

- poster frame before playback
- native browser video playback from `video_transcode`
- thumbnail where appropriate
- processing state
- source filename and metadata

The master remains protected.

### Failed processing

A processing failure must leave the verified master and logical Media asset intact.

The library must show the terminal or retry state and allow a governed processing retry.

It must not ask the user to upload the master again.

## Existing image and PDF regression boundary

M3 must preserve:

- current image uploads
- current PDF uploads
- image editing and immutable replacement
- metadata editing
- archive behavior
- filters and pagination
- picker image behavior
- current public image delivery
- Phase 4A CORS contract

No audio or video change may route image or PDF bytes through the resumable master lane.

## Video authority extension

M2 already implements `video-v1` processing:

- H.264/AAC MP4
- maximum 720p
- poster JPEG
- thumbnail JPEG

M3 must make the ingest authority capable of reaching that existing processor.

A real video master production acceptance is required before M3 closes.

## Production acceptance

M3 is not accepted until production proves:

1. existing image upload still works
2. existing PDF upload still works
3. a real audio master completes the M3 browser workflow
4. upload interruption and resume work without re-uploading completed parts
5. cancellation cleans partial upload state
6. a verified master is adopted into exactly one canonical asset and revision
7. M2 processing starts from that exact revision
8. audio preview and waveform are visible in the existing Media Library
9. a real video master completes the resumable workflow
10. video processing produces transcode, poster, and thumbnail
11. video derivatives render in the existing Media Library
12. protected audio and video masters remain HTTP 404
13. protected canonical derivatives remain HTTP 404
14. public selected derivatives return HTTP 200
15. processing retry does not require master re-upload
16. the existing picker remains backward compatible
17. an opt-in picker can select supported audio or video public derivatives
18. no duplicate asset, revision, file object, variant, or processing job is created by idempotent replay
19. existing public Media regression checks remain green
20. frontend production deployment is verified after build promotion

## Repository package

M3 should remain one coherent milestone PR.

Expected implementation surfaces are limited to:

- this design record
- one forward SQL migration for M3 workflow authority and read projection
- live schema types and baseline
- `media-upload-api` only where required to expose the new versioned session control
- `ops/media-receiver/server.py` for the forward audio/video master receiver contract
- `mediaService`
- `package.json` and `package-lock.json` for one pinned streaming SHA-256 dependency
- one bounded browser hashing utility if required
- `MediaLibraryCore`
- `MediaLibraryPreviewPanel`
- `MediaPickerModal` only for allowed-kind compatibility
- focused Media contract tests
- deployment or acceptance verifier where required

Do not split M3 into separate upload, read-model, preview, and picker PRs unless a concrete production blocker requires it.

## Rollback

Before SQL deployment, discard the branch.

After additive SQL deployment but before frontend deployment, leave the unused forward authority in place or remove it through a later forward migration.

After frontend deployment, revert the frontend build to the last known good backup. Do not roll back verified masters, canonical Media identity, or durable processing history by destructive SQL.

## Locked conclusion

M3 is a forward integration of the existing Media Library onto M1 resumable ingest and M2 durable processing.

It preserves the current image and PDF lane, extends master ingest to audio and video through a new versioned session contract, adds bounded browser hashing, adopts verified file objects through canonical Media authority, exposes workflow state through the existing admin read boundary, and renders only governed public derivatives.

M3 does not create another Media system.
