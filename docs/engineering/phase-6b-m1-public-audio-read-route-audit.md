# Phase 6B M1 Public Audio Read and Route Audit

Status: CLOSED IN PRODUCTION

Audit date: 21 August 2026

Closure date: 22 August 2026

Accepted main: `43b2f7ca5d65b2ac67f93cc4d5137832cb3d4688`

Starting production migration head: `20260821095406`

## Closure addendum

This document is retained as the decision record that corrected M1 before preview. The implementation hold described below was resolved before shipment.

Phase 6B M1 is closed.

Closure evidence:

- PR #686, `Open Phase 6B with public Audio and a media-first player`, merged at `f47d08049fafd852e7b3f5cf4cbaf3fc91e5fbd0`.
- `20260821150000_phase_6b_m1_public_audio_read_route.sql` was promoted to production as migration 38.
- the permanent M1 verifier passed after promotion.
- `/audio/:slug` became the governed public Standalone Audio route.
- public Audio entered the existing persistent WAKILISHA Player rather than creating a second playback authority.
- compact and expanded player presentation moved to the media-first, capability-driven contract described in this audit.
- exact published-version, immutable snapshot, Media safety, Chapters, Transcript, Credits, Citations, GUID, and enclosure read boundaries were production-proven.
- the disposable M1 preview was retired after acceptance.

The sections below that say a correction was "required before preview" describe the accepted pre-preview design decision. They are historical evidence, not current open work.

Current Phase 6B status is recorded in `docs/engineering/phase-6b-progress-closure-record.md`.

## Objective

Phase 6B M1 exposes the exact current published Audio version through one narrow public read contract and one lazy public route.

This milestone does not rebuild Audio publication authority. It projects the already accepted Phase 6A authority safely.

The public Audio product must also enter the existing WAKILISHA Player instead of creating a second listener playback system.

## Live baseline findings

Production already has:

- canonical `audio.shows`, `audio.seasons`, and `audio.publications`
- immutable `audio.publication_versions`
- exact `editorial.audio_publication_resources.current_published_version_id`
- immutable `audio.publication_snapshots`
- stable GUID and stable enclosure identity
- exact full-length `audio_delivery` Media binding
- version-bound Chapters
- version-bound Transcript Media identity
- shared Citation and Credit attachments
- current Media public-safety revalidation in `audio.assert_publishable_version_media(uuid)`
- one published Standalone Audio publication and one immutable Audio publication snapshot in production

Production does not grant `anon` or `authenticated` direct `USAGE` on the private `audio` schema. Existing Admin and Editorial Audio RPCs are also closed to `anon`.

## Existing public precedent

Public Playlist already follows the correct read-authority shape:

1. private domain authority remains private
2. one narrow `SECURITY DEFINER` public RPC projects the exact published version
3. Trust data is filtered through public-safe governance rules
4. a service decoder consumes only the RPC payload
5. the route is lazy loaded
6. public UI never queries private domain tables directly

M1 follows that pattern without creating a second publication snapshot system.

## M1 authority decision

Add one public resolver:

`public.get_public_audio_publication(p_slug text) -> jsonb`

The resolver must:

- require `audio.publications.status = 'published'`
- require the bound Resource to be `published` and `public`
- resolve only `current_published_version_id`
- require that version to be `version_kind = 'published'`
- require the immutable publication snapshot for that exact version
- re-run current Media public-safety validation before returning delivery
- fail closed when the exact published Media is no longer public-safe
- compare the live-safe exact delivery against the immutable publication snapshot
- return no working, submitted, or approved version pointers
- return no Review events or Review discussion
- return no raw Audio metadata blob

## Public payload

M1 returns only the fields needed to prove the published boundary and support the first public listening surface:

- publication ID
- Resource ID
- exact published version ID and number
- publication kind
- canonical path
- slug
- title
- summary
- episode number where applicable
- current canonical Show context where applicable
- current canonical Season context where applicable
- exact immutable full-length delivery
- exact Transcript Media identity and delivery when available
- exact published-version Chapters
- stable GUID and enclosure identity
- publication provenance
- public-safe Credits
- public-safe Citations and approved public/public-redacted Sources

A waveform derivative may remain part of Audio editorial tooling, but it is not required to make the public Audio page its own playback engine.

Corrections, RSS XML, scheduling, search, SEO, and public Audio directory expansion remain later Phase 6B slices.

## Route decision

M1 adds one route:

`/audio/:slug`

`audio.publications.slug` is globally unique, so this route resolves both Episode and Standalone Audio without inventing a second identifier.

Show and Season are returned as canonical context, but Show/Season directory and detail routes are deliberately deferred. M1 proves the published Audio object before expanding the navigation product.

## Player product re-audit

### Finding

The existing public player is already the WAKILISHA listener playback platform.

It has:

- one persistent `PlayerContext`
- HTML Audio playback
- Apple Music playback
- YouTube playback
- SoundCloud playback
- queue state
- current time and duration
- seeking
- volume
- repeat and shuffle
- listening-history writes
- source-context analytics
- a desktop `PlayerDock`
- a desktop expanded player
- a mobile mini-player
- a mobile expanded player
- cross-route persistence

Public Audio must compound this platform rather than create an Audio-only player.

### UX defect discovered during the re-audit

The current player leaks playback implementation state into the listener experience.

Examples include:

- the mobile expanded player labels the HTML Audio backend as `Preview`
- the mobile mini-player can show a persistent `Full` Apple Music CTA
- the mini-player subtitle can append a provider/source label
- the expanded mobile player can render a `Full track available` acquisition card
- the expanded mobile player can render `Full track playing` and `Unlocked through Apple Music` messaging after connection
- desktop and mobile player surfaces expose provider labels such as Apple Music, YouTube, SoundCloud, or a track source as persistent presentation
- player UI can make WAKILISHA acquisition or integration state visually compete with title, creator, artwork, progress, and transport

This is the wrong hierarchy.

A listener should not need to understand WAKILISHA's playback backend, fallback logic, preview URL model, provider connection state, or integration architecture in order to listen.

### Product principle

The player is media-first.

The primary hierarchy is:

1. what is playing
2. who or what it belongs to
3. artwork or the canonical visual fallback
4. play state
5. time and progress
6. primary transport
7. the next listening action

WAKILISHA CTAs, provider acquisition, account connection, save prompts, and integration messaging are secondary artefacts.

They must be:

- contextual rather than persistent
- rendered only when they add immediate value
- dismissible where they interrupt listening
- suppressible after dismissal
- absent from compact player surfaces unless they are essential to completing the current listener action
- visually subordinate to media identity and transport

### Provider abstraction rule

`playbackBackend` is implementation state, not presentation state.

A provider label must not render merely because a backend is active.

The player may disclose a provider when disclosure answers a real listener question, such as:

- the user explicitly opens playback details
- the user chooses or changes a playback source
- a provider connection is required to continue beyond the currently available media
- a provider error requires a recovery choice

Normal successful playback should look like normal playback.

### Apple Music unlock rule

Apple Music connection remains useful, but the player must stop treating acquisition as permanent chrome.

Default behaviour when an unconnected listener starts a track with a WAKILISHA-accessible preview:

1. playback starts immediately
2. compact player remains clean
3. no permanent `Preview` badge is required
4. no permanent `Full` CTA is required
5. media identity, progress, and play controls remain primary

The unlock may appear contextually in a larger surface when it becomes useful, for example:

- after the user opens the expanded player
- near the natural preview boundary
- after the user attempts to seek beyond the available preview
- from an explicit overflow or playback-details action

The listener must be able to dismiss a promotional unlock without losing playback controls.

Successful Apple Music connection should also remove acquisition UI. It should not replace one acquisition state with celebratory integration chrome that remains more prominent than the song.

### Compact player rule

Desktop dock and mobile mini-player are persistent transport, not acquisition surfaces.

Their default content should be limited to:

- artwork
- title
- artist, show, or contextual byline
- progress
- play/pause
- the most useful adjacent transport action for the playing media
- expand/open player affordance where needed

Provider labels, `Preview`, `Full`, connect prompts, save prompts, and promotional cards should not occupy default compact-player hierarchy.

### Expanded player rule

The expanded player is the place for richer listening utilities, not a billboard for WAKILISHA integrations.

Music can expose secondary utilities such as queue, lyrics, save, share, and playback details.

Spoken Audio can expose secondary utilities such as Chapters, Transcript, queue/up-next, share, playback speed, and playback details.

The control deck is content-aware.

Music may keep previous/next, shuffle, repeat, and queue where they make sense.

Episode and Standalone Audio should prioritise spoken-word transport such as back 15 seconds, play/pause, and forward 15 seconds. Track-only actions must not leak into Audio simply because both media types use the same player engine.

### Public Audio page rule

The public Audio page is a content surface, not a second player.

The page may include:

- artwork or canonical fallback
- publication type
- title
- Show/Season context
- summary and editorial copy
- a clear Listen action
- Chapters
- Transcript entry or presentation
- Credits and Sources
- related Audio

The Listen action hands the exact full-length published Audio delivery into the WAKILISHA Player.

Chapter actions seek the same global player state.

Transcript timing, when interactive, follows the same player clock.

### Reference interpretation

The current Audio design references remain useful for page hierarchy and discovery.

The separate player reference is useful for a different reason: it demonstrates that a listening surface can foreground artwork, title, time, progress, transport, and output controls without surrounding them with acquisition copy.

The reference is not a directive to clone another platform. It reinforces the hierarchy required for the WAKILISHA Player.

## Primitive impact correction

The earlier candidate incorrectly treated public Audio as a second consumer of the Audio Editorial Workbench playback primitives.

That promotion is withdrawn.

### `MediaTransport`

`MediaTransport` remains an editorial/workbench primitive until a genuinely equivalent second semantic consumer is proven.

Public listener playback is not the same job merely because both surfaces contain play and seek controls.

### `MediaTimeline`

`MediaTimeline` remains an editorial time-coordinate navigation and annotation primitive.

Its waveform, point/range anchors, review markers, and chapter overlays solve an editorial review problem. It must not become the public listener timeline by convenience.

### `useMediaPlaybackController`

The candidate `useMediaPlaybackController` extraction is not accepted as part of M1.

The existing public player already owns persistent playback state. Public Audio must enter that authority instead of creating a local playback controller.

### Existing player as the compounding target

The correct compounding work is to evolve the established WAKILISHA Player so it can accept more than Registry music tracks while preserving one playback authority.

M1 should add the smallest backward-compatible playable-media semantics needed for:

- music track
- Audio Episode
- Standalone Audio

The existing music behaviour must remain intact while presentation becomes content-aware.

## Candidate correction required before preview

The current branch is not preview-ready until it removes the parallel public Audio playback path.

Required correction:

1. remove public `MediaTransport` / `MediaTimeline` use
2. remove the candidate public playback controller
3. restore Admin Audio Review to the accepted editorial primitive boundary unless an independent reason exists for its refactor
4. undo premature primitive-registry promotion
5. adapt public Audio into the existing `PlayerContext` contract
6. add a content-kind or equivalent semantic discriminator without breaking existing music consumers
7. make compact player UI media-first and remove persistent acquisition/provider chrome
8. make Apple Music unlock contextual and dismissible rather than persistent
9. make expanded player controls content-aware
10. add Audio-specific player mapping from the governed public Audio model
11. add focused contracts proving Track playback behaviour remains intact
12. add focused contracts proving Audio does not render Track-only actions

No disposable preview is created before this correction is complete and statically proven.

## Files expected to change after correction

Authority and verification:

- `supabase/migrations/20260821150000_phase_6b_m1_public_audio_read_route.sql`
- `scripts/control-plane/verify-phase-6b-m1-public-audio-read-route.sql`

Public client and route:

- `src/services/audio/audioPublicModel.ts`
- `src/services/audio/audioPublicService.ts`
- `src/pages/audio/detail/page.tsx`
- `src/router/lazyPublic.tsx`
- `src/router/config.tsx`
- `scripts/performance/audit-public-route-splitting.mjs`

Player integration, exact paths to be finalised after focused implementation audit:

- `src/context/PlayerContext.tsx`
- `src/components/design-system/music/PlayerDock.tsx`
- `src/components/mobile/MobileAppLayout.tsx`
- `src/pages/player/page.tsx`
- `src/components/mobile/MobileFullPlayer.tsx`

Primitive correction:

- `scripts/control-plane/primitive-registry.json`
- remove `src/components/design-system/editorial/useMediaPlaybackController.ts` from the candidate
- restore `src/components/design-system/editorial/MediaTimeline.tsx` unless another accepted editorial requirement remains
- restore `src/pages/admin/content/audio/detail/components/AudioReviewWorkspace.tsx` unless another accepted editorial requirement remains

Contracts:

- `test/audio/phase-6b-m1-public-audio-read-route.test.ts`
- player-focused regression tests for compact, expanded, Music, and Audio presentation

## What M1 must not touch

- Audio publication commands
- immutable version creation
- Media upload or processing
- Transcript storage
- Review authority
- time-anchored review threads
- Credits/Citations mutation authority
- RSS XML
- Corrections authority
- scheduling
- search indexing
- unrelated Admin Studio surfaces

The existing player may change only through backward-compatible player-product evolution required by public Audio and the media-first player correction documented above.

## Acceptance

M1 is accepted only when:

1. the corrected frontend player architecture is statically proven before preview creation
2. compact mobile and desktop players are media-first
3. default compact player surfaces do not persistently render `Preview`, `Full`, provider acquisition, or provider branding merely because of backend state
4. Apple Music unlock is contextual and can be dismissed where rendered as an interruptive artefact
5. successful playback does not require persistent provider chrome
6. Audio playback enters the existing WAKILISHA Player and survives route navigation
7. Audio uses spoken-word controls in the expanded player without inheriting Track-only actions
8. existing Track playback remains green
9. the complete production migration baseline replays on a fresh disposable preview
10. the exact M1 migration applies once
11. the permanent read-only verifier passes
12. anonymous execution can call only the new intended Audio public read function
13. anonymous users still have no private Audio schema access
14. unpublished Audio returns no public payload
15. the resolver returns only the exact current published version
16. Media governance becoming unsafe makes public delivery fail closed
17. Chapter and Transcript identity remain bound to the exact published version
18. public Trust filtering matches the established Playlist-grade governance rules
19. the public route uses the service contract rather than direct Supabase/private-schema reads
20. focused player tests, primitive compounding, route-splitting audit, critical suite, build, and schema gates pass
21. preview-proven SQL bytes remain unchanged through promotion
22. production smoke succeeds against the real published Audio record

## Deployment classification

- SQL migration needed: Yes
- Supabase Edge Function deploy needed: No
- Readdy Finish update needed: No
- Frontend deploy needed: Yes, after production DB authority is proven
- PR needed now: No. Player correction and preview proof come first
- Production changed: No
- Disposable preview: intentionally not created
- Next test: corrected WAKILISHA Player integration and focused static/player regression proof before any paid preview creation
