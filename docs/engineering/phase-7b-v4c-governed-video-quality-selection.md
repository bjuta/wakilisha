# Phase 7B V4C: Governed Video Quality Selection

Date: 3 September 2026

## Status

Preview accepted. Not production accepted. No PR.

## Problem layer

Public Video adaptive rendition read and playback composition.

V4C adds manual quality selection to the accepted V4B player without creating another player, another Media processing profile, or client-side derivative URL inference.

## Reused authority

V4C reuses:

- `public.get_public_video_publication(text,text)`
- `VideoPlaybackCanvas`
- the canonical `MediaPresentationSurface`
- the accepted V4A `video-adaptive-v1` package
- `media.variant_selections`
- the accepted MP4 fallback
- current captions, chapters, speed, fullscreen, collapse, and floating presentation

## Governed rendition read model

`adaptive_delivery` remains optional.

When the exact V4A selected package is complete, it now also returns a generic `renditions` array.

The current accepted processing profile contributes exactly:

- 360p from selected `video_hls_360p_playlist`
- 720p from selected `video_hls_720p_playlist`

The public player does not construct derivative paths and does not expose resolutions that are not delivered.

The array shape is generic so future processing profiles can add governed resolutions without creating a new player primitive.

## Player behavior

The Settings surface exposes:

- Auto
- each governed delivered rendition, currently 360p and 720p

Auto loads the governed HLS master.

A manual resolution loads that governed child HLS playlist.

The same source choice works for native-HLS browsers and the existing `hls.js` MediaSource path.

Quality switching preserves:

- current playback position
- playing or paused state
- playback rate
- mute state
- caption selection
- the existing player and Media presentation surface

Fatal HLS failure continues to fall back to the accepted MP4.

## Explicit non-goals

V4C does not:

- create 144p, 240p, 480p, 1080p, 1440p, or 2160p derivatives
- change the V4A worker or processing profile
- create another Video player
- create client-side Media URL inference
- change provider playback
- change MediaPresentationSurface
- deploy production before preview authority is sealed

## Candidate acceptance before preview

1. V4A and V4B tests remain green.
2. V4C focused test passes.
3. the public reader exposes only selected governed playlist URLs.
4. the public model fails closed on malformed rendition metadata.
5. `VideoPlaybackCanvas` remains the only Video playback primitive.
6. Auto uses the HLS master.
7. manual selection uses governed rendition URLs.
8. source switching preserves playback state and captions.
9. MP4 fallback remains mandatory.
10. no forbidden public copy punctuation is introduced.
11. `npm run build:app` passes.
12. no PR is opened.

## Preview acceptance

A fresh disposable Supabase preview must first settle at the exact accepted production baseline:

- migration count: 81
- migration head: `20260902220000`

Only after that baseline is exact:

1. native dry-run reports exactly the V4C migration pending
2. apply the exact repository migration with `supabase db push --linked`
3. native dry-run reports zero pending migrations
4. run the permanent V4C verifier
5. rerun accepted V4B and V1 preservation gates
6. record the replay proof and preview schema seal
7. run focused and critical suites
8. build the application
9. commit, push, and open PR only after preview authority is sealed

## Production

Production is unchanged by the candidate and preview gates.

## Accepted preview evidence - 3 September 2026

Disposable Supabase preview:

- project ref: `jwfowahuyuxhuphhjzgg`
- branch id: `81637427-c9b0-45b7-83df-95af8a7936bd`
- production data copied: no

Baseline replay settled exactly at:

- migration count: 81
- migration head: `20260902220000`

Native candidate apply:

- pending before apply: exactly one V4C migration
- migration SHA-256: `a466b84194074feb9ef9f9389dae4b1c04866fc1297cea7649fdf96491b7216b`
- migration count after apply: 82
- migration head after apply: `20260903060000`
- pending after apply: zero

Independent acceptance:

- permanent V4C read-only verifier: PASS
- accepted V4B read-only verifier: PASS
- accepted V1 read-only verifier: PASS
- accepted V1 rollback-only anonymous behavior proof: PASS
- V1 rollback fixture residue after proof: zero

Replay/schema seal:

- base main: `46bf973de39947504b7b084e3a71ea7ab87a6005`
- schema types SHA-256: `be5ff86a3c1f93d7feeac2db63de3ccb7cf71cde8aeeacad5162628b93885b2c`
- baseline replay: PASS
- candidate apply: PASS
- verifier: PASS

The generated public schema types remain byte-identical because V4C extends the JSON payload of the existing `jsonb` public reader without changing its typed function signature.

Production remains unchanged at 81 migrations / `20260902220000`.
