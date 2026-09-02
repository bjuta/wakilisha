# Phase 7B V4B: Public Adaptive Video Playback

Date: 2 September 2026

## Status

Milestone candidate. Not preview accepted. Not production accepted. No PR.

## Problem layer

Public Video read and playback composition.

V4A closed the adaptive Media foundation and proved one real published Video has a complete, selected, publicly retrievable HLS package.

V4B does not create new Media processing authority.

It composes the accepted adaptive derivative into the existing public Video read and player primitives.

## Primitive impact declaration

### Reused primitives

V4B reuses:

- `public.get_public_video_publication(text,text)`
- `public.get_public_video_index(integer)`, which already delegates to the publication reader
- `VideoPlaybackCanvas`
- current Video captions and chapter seeking
- current MP4 `video_transcode` fallback
- current V4A `media.variant_selections`
- current V4A five-role adaptive package
- current public Media origin

### No new delivery authority

V4B does not create:

- another public Video RPC
- another player component
- another HLS proxy
- another Media table
- another variant-selection mechanism
- another Video route
- another caption system

The canonical public reader remains the only public Video read authority.

The canonical playback canvas remains the only Video player primitive.

## Read-model extension

The accepted `delivery` object remains mandatory and unchanged.

For native Media it continues to describe the verified MP4 `video_transcode`.

V4B adds one optional sibling:

`adaptive_delivery`

The object is returned only when the exact published Media revision has a complete selected V4A package.

Shape:

- kind: `hls`
- URL: selected `video_hls_master`
- MIME: `application/vnd.apple.mpegurl`
- byte size
- SHA-256
- profile version: `video-adaptive-v1`
- rendition count: 2

No child rendition URLs need to be added to the public read model. The governed master manifest already owns those relative references.

## Fail-closed package rule

The reader resolves adaptive delivery only from `media.variant_selections`.

The selected package must contain exactly:

1. `video_hls_master`
2. `video_hls_360p_playlist`
3. `video_hls_360p_media`
4. `video_hls_720p_playlist`
5. `video_hls_720p_media`

Every selected variant must:

- belong to the same exact Media asset/revision as the published Video source
- point back to the revision's original source file object
- use generator `wakilisha-media-processor`
- use generator version `phase7b-v4a-v1`
- use profile `video-adaptive-v1`
- resolve to a verified public derivative file
- carry the exact role MIME contract

If any condition fails, `adaptive_delivery` is null.

The MP4 delivery remains available and the publication still renders.

## Browser playback composition

The existing `VideoPlaybackCanvas` remains authoritative.

Native Media source input gains optional adaptive fields.

Playback order:

1. If no adaptive URL exists, use MP4 exactly as today.
2. If the browser natively supports HLS, load the governed HLS master directly on the existing `<video>`.
3. Otherwise, if MediaSource HLS is supported, load the governed HLS master through `hls.js` on that same `<video>`.
4. If the HLS client cannot initialize or reports a fatal playback error, fall back to the accepted MP4 URL.
5. If neither native HLS nor MediaSource HLS is available, use MP4.

This is one player with one fallback hierarchy.

## HLS client

V4B pins `hls.js` to `1.7.1`.

The package is loaded dynamically only for browsers that need MediaSource HLS.

Safari/native-HLS does not load the HLS client.

MP4-only publications do not load the HLS client.

This keeps the public route from paying the HLS client cost unless it is required.

## Existing product semantics preserved

V4B does not change:

- captions
- caption settings
- chapter seeking
- play/pause controls
- rewind/forward
- playback speed
- mute
- fullscreen
- collapse/expand/docked playback
- provider embeds
- publication record
- Credits
- Citations
- canonical routes

## Explicit non-goals

V4B does not:

- create adaptive derivatives
- change the V4A worker
- change Media processing profiles
- add manual quality selection
- add an HLS-specific public badge
- add transcript presentation
- add Video correction UI/history
- close Phase 7B

Automatic bitrate selection remains the HLS client's job for this bounded slice.

## Candidate acceptance before preview

1. V4A permanent tests remain green.
2. V1/V2 public Video tests remain green.
3. V4B focused test passes.
4. `VideoPlaybackCanvas` remains the only native/provider player primitive.
5. public reader keeps MP4 `delivery` mandatory.
6. adaptive read uses selected V4A package only.
7. package lock pins `hls.js` 1.7.1 exactly.
8. HLS client is dynamically imported only when native HLS is unavailable.
9. fatal HLS errors fall back to MP4.
10. captions and chapters still target the same `HTMLVideoElement`.
11. no forbidden public copy punctuation is introduced.
12. `npm run build:app` passes.
13. no PR is opened.

## Preview acceptance

A fresh disposable Supabase preview must first replay the existing 80-migration production baseline cleanly.

Only after baseline replay:

1. apply the V4B migration natively
2. run the permanent V4B verifier
3. prove zero pending migrations
4. verify anonymous public reader behavior remains callable
5. verify a publication without a complete adaptive package returns null `adaptive_delivery` without losing MP4
6. verify a complete selected fixture returns HLS master metadata
7. verify partial selected package returns null `adaptive_delivery`
8. preserve V1 public Video read behavior
9. generate exact replay/schema seal
10. delete preview after production acceptance

## Production acceptance order

After preview seal, PR CI, merge, and protected-main acceptance:

1. promote only the merged V4B migration
2. independently run the permanent V4B verifier
3. deploy the exact merged frontend
4. verify the real Video public reader returns both MP4 `delivery` and HLS `adaptive_delivery`
5. prove Safari/native-HLS playback on the real Video
6. prove Chromium/Firefox MediaSource playback on the real Video
7. prove MP4 fallback by disabling/unavailable HLS path
8. prove captions, chapter seeking, collapse/expand, and mobile/desktop playback
9. record V4B production acceptance

## Remaining Phase 7B work after V4B

- governed transcript authority and public presentation
- public Video correction continuity and a real correction-handling proof
- final Phase 7B exit acceptance
