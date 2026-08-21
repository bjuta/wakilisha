# Phase 6B M1 Public Audio Read and Route Audit

Status: implementation candidate

Date: 21 August 2026

Accepted main: `43b2f7ca5d65b2ac67f93cc4d5137832cb3d4688`

Starting production migration head: `20260821095406`

## Objective

Phase 6B M1 exposes the exact current published Audio version through one narrow public read contract and one lazy public route.

This milestone does not rebuild Audio publication authority. It projects the already accepted Phase 6A authority safely.

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

Public Playlist already follows the correct shape:

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

M1 returns only the fields needed to prove the published boundary:

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
- current waveform derivative for that same exact master revision when available
- exact Transcript Media identity and delivery when available
- exact published-version Chapters
- stable GUID and enclosure identity
- publication provenance
- public-safe Credits
- public-safe Citations and approved public/public-redacted Sources

Corrections, RSS XML, scheduling, search, SEO, directory pages, and global-player integration remain later Phase 6B slices.

## Route decision

M1 adds one route:

`/audio/:slug`

`audio.publications.slug` is globally unique, so this route resolves both Episode and Standalone Audio without inventing a second identifier.

Show and Season are returned as canonical context, but Show/Season directory and detail routes are deliberately deferred. M1 proves the published Audio object before expanding the navigation product.

## Primitive impact

M1 is the first Phase 6B milestone to consume the Primitive Compounding Contract in product work.

### Reused and promoted

`MediaTransport`

- first proven consumer: Admin Audio Review
- second proven consumer: Public Audio
- action: promote from `candidate` to `canonical`

`MediaTimeline`

- first proven consumer: Admin Audio Review
- second proven consumer: Public Audio
- action: promote from `candidate` to `canonical`
- second-consumer field learning: public playback needs reader-facing fallback labels instead of Admin/editorial terminology

### New learned primitive

`useMediaPlaybackController`

The Admin Audio Review and Public Audio detail surfaces need the same native Audio playback state and control behavior.

M1 extracts that repeated behavior only after the second real consumer exists. It remains authority-free and receives only duration/media identity from its consumers.

Because M1 introduces it with two real consumers, it enters the registry as `canonical` rather than as a speculative one-domain candidate.

### Deliberately domain-specific

The public Audio page composition remains Audio-specific. The route, Show/Season context, Transcript presentation, and Chapter layout do not become universal editor primitives.

## Files expected to change

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

Primitive compounding:

- `src/components/design-system/editorial/useMediaPlaybackController.ts`
- `src/components/design-system/editorial/MediaTimeline.tsx`
- `src/pages/admin/content/audio/detail/components/AudioReviewWorkspace.tsx`
- `scripts/control-plane/primitive-registry.json`

Contracts:

- `test/audio/phase-6b-m1-public-audio-read-route.test.ts`

## What M1 must not touch

- Audio publication commands
- immutable version creation
- Media upload or processing
- Transcript storage
- Review authority
- time-anchored review threads
- Credits/Citations mutation authority
- global Track player behavior
- RSS XML
- Corrections authority
- scheduling
- search indexing
- unrelated Admin Studio surfaces

## Acceptance

M1 is accepted only when:

1. the complete production migration baseline replays on a fresh disposable preview
2. the exact M1 migration applies once
3. the permanent read-only verifier passes
4. anonymous execution can call only the new intended Audio public read function
5. anonymous users still have no private Audio schema access
6. unpublished Audio returns no public payload
7. the resolver returns only the exact current published version
8. Media governance becoming unsafe makes public delivery fail closed
9. Chapter and Transcript identity remain bound to the exact published version
10. public Trust filtering matches the established Playlist-grade governance rules
11. the public route uses the service contract rather than direct Supabase/private-schema reads
12. `MediaTransport` and `MediaTimeline` are proven as second-surface primitives and promoted to canonical
13. Admin Audio Review keeps its behavior after playback-controller extraction
14. focused tests, primitive compounding, route-splitting audit, critical suite, build, and schema gates pass
15. preview-proven SQL bytes remain unchanged through promotion
16. production smoke succeeds against the real published Audio record

## Deployment classification

- SQL migration needed: Yes
- Supabase Edge Function deploy needed: No
- Readdy Finish update needed: No
- Frontend deploy needed: Yes, after production DB authority is proven
- PR needed now: No. Preview proof comes first
- Next test: fresh disposable Supabase replay, M1 apply, verifier, and behavior fixture
