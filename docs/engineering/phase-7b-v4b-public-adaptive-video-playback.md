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

## Accepted preview evidence — 2 September 2026

Disposable Supabase preview:

- project ref: `fvhwlsowffbzksevcufe`
- branch id: `08d63f42-adad-43cb-8130-789f3aefa762`
- production data copied: no

### Baseline replay

The preview was not accepted from its lifecycle label alone.

An early ledger read observed 37 migrations at `20260821095406` while Postgres logs showed later accepted migrations still applying.

That was treated as a mid-replay snapshot, not a baseline failure.

Accepted replay settled at:

- migration count: 80
- migration head: `20260902205000`
- accepted public Video reader present
- accepted V4A processing-profile authority present

No V4B SQL was applied before that baseline was exact.

### Full rollback rehearsal

The complete V4B migration was executed with only terminal `COMMIT` replaced by `ROLLBACK`.

Result: PASS.

After rehearsal:

- migration count remained 80
- migration head remained `20260902205000`
- the public Video reader contained no retained `adaptive_delivery` marker

### Native preview application

Native dry-run before apply:

- pending migrations: exactly 1
- pending file:
  `20260902220000_phase_7b_v4b_public_adaptive_video_playback.sql`

Native `supabase db push --linked`: PASS.

Native dry-run after apply:

- pending migrations: 0

Permanent V4B verifier: PASS.

Accepted preview migration state:

- migration count: 81
- migration head: `20260902220000`

Migration SHA-256:

`02901a8ce709fbb3f5e8d2e1d56033252a020c4a50ad5fabc0911196a2c8d702`

### Behavior preservation

The accepted V1 rollback-only public Video behavior verifier was rerun after V4B application.

Result: PASS.

This proves the existing anonymous publication reader, index composition, provider delivery, canonical routes, and rollback-only fixture semantics remain intact.

The preview contains no production data. It therefore does not pretend to prove the real complete V4A adaptive package through copied production rows.

That real-package proof remains a production acceptance gate after merge against the already accepted five selected derivatives for `Monday Morning in September`.

### Replay/schema seal

Replay proof:

`docs/engineering/replay-proofs/20260902220000_phase_7b_v4b_public_adaptive_video_playback.sql.json`

Accepted seal:

- base main:
  `bd1a238bbb8c35a0e858c633109621681911d7e3`
- preview project:
  `fvhwlsowffbzksevcufe`
- preview branch:
  `08d63f42-adad-43cb-8130-789f3aefa762`
- schema migration count: 81
- schema migration head: `20260902220000`
- generated public types SHA-256:
  `be5ff86a3c1f93d7feeac2db63de3ccb7cf71cde8aeeacad5162628b93885b2c`
- baseline replay: PASS
- candidate apply: PASS
- verifier: PASS

The generated public type hash is unchanged because the existing RPC signature remains `jsonb`; V4B extends the returned payload shape without adding or changing a typed RPC signature.

### Candidate Critical Control Plane

Sealed branch Critical run:

- run id: `33672345892`
- result: PASS
- migration replay contract: PASS
- migration replay tests: PASS
- Primitive Compounding contract: PASS
- Phase 7A kernel/K5A/K5B/K5C/K5D: PASS
- Phase 7B V1/V2/V3/V4A: PASS
- Phase 7B V4B public adaptive playback: PASS
- full security/lifecycle suite: PASS
- live schema/migration-history parity: PASS
- application build: PASS

The temporary branch trigger and temporary preview-seal workflow were removed before PR.

## Preview exit decision

V4B preview authority is sealed.

The candidate may proceed to PR/CI.

Production remains unchanged at 80 migrations / `20260902205000`.

The production frontend remains unchanged.

The accepted real Video still exposes MP4 only through the public reader until V4B is merged and promoted.

