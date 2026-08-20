# Phase 6A: Audio Publication Authority Audit

Date: 20 August 2026

## Status

Authority audit complete.

The first Phase 6A implementation boundary is defined from the current production system rather than from the pre-Phase-5 implementation assumptions.

Starting repository authority:

`8a395692e17eeda8f9c3f46b978391118293c65a Reconcile WAKILISHA programme roadmap (#666)`

Phase 5 is complete.

Phase 6 Audio is the current numbered programme phase.

## Programme requirement

The long-form programme defines Phase 6A Audio publication authority around:

- shows
- seasons
- episodes
- standalone Audio
- immutable episode versions
- Audio Editor
- master selection
- chapters
- transcripts
- Credits
- Citations
- RSS contract
- stable GUID and enclosure identity

Phase 6B later owns the public Audio product, including public show and episode presentation, transcript navigation, chapters, RSS delivery, provenance, Corrections, scheduling, search, and SEO.

This audit does not reduce that scope.

It identifies what the platform already provides and what Phase 6 must genuinely add.

## Finding 1: no Audio publication domain exists

Production has no canonical Audio, podcast, show, season, episode, or standalone Audio publication tables or command functions.

Current enabled Resource kinds are:

- `article`
- `correction_case`
- `media_asset`
- `organization`
- `person`
- `playlist`
- `playlist_item`
- `registry_artist`

There is no `audio_show`, `audio_season`, `audio_episode`, or `standalone_audio` Resource kind.

Phase 6 therefore begins with a clean publication-domain boundary rather than a half-built podcast system that needs migration.

## Finding 2: Media already owns the hard file problem

Phase 4B is substantially ahead of the original Phase 6 assumptions.

Production already provides:

- resumable large Audio master upload
- direct multipart transfer
- exact byte-size and SHA-256 verification
- immutable Media file objects and revisions
- protected preservation masters
- durable Media processing jobs
- filtered job claiming
- retry and dead-letter behavior
- expired-lease recovery
- FFmpeg and FFprobe processing
- waveform generation
- governed derivative registration
- canonical Media variant selection
- selected public derivative delivery
- protected-master delivery boundaries
- short-lived signed private delivery
- Cloudflare delivery for public immutable Media
- transcript as a canonical Media asset kind
- caption as a canonical Media asset kind
- Media Library Pause, Resume, Cancel, processing, and preview workflow

Phase 6 must reuse this authority.

It must not create another Audio uploader, storage authority, queue, processor, transcript file store, or delivery origin.

## Finding 3: full-length Audio delivery is still missing

The current Media processor `audio-v1` profile creates:

- `audio_preview`
- `waveform_data`

The `audio_preview` is deliberately limited to the first 30 seconds.

Current Media variant roles include `audio_preview` and `waveform_data`, but no governed full-length Audio publication derivative.

A real Audio episode therefore cannot use the current preview derivative as its publication enclosure or full listening source.

Phase 6 must add a full-length Audio delivery profile and variant while preserving `audio_preview` for preview use.

That extension should reuse the existing:

- Media processing command
- durable job authority
- immutable derivative path rules
- variant registration
- active variant selection
- CDN delivery
- retry and idempotency behavior

It should not create another processor service.

## Finding 4: transcripts and captions exist as Media, not as Audio editorial state

Phase 4B intentionally stopped at canonical transcript and caption file authority.

It did not create:

- transcript attachment to an Audio publication
- transcript version relationship
- transcript correction semantics
- chapter-to-transcript navigation
- public transcript presentation
- Audio publication review behavior

That boundary was deliberate.

Phase 6 should attach and govern existing Media records rather than storing transcript text as an unrelated Audio blob or inventing another transcript library.

## Finding 5: the global player is reusable but music-track-shaped

The existing WAKILISHA player already provides:

- HTML Audio playback
- persistent playback across navigation
- seek
- duration and progress
- volume
- queue
- previous and next
- repeat and shuffle
- full-player expansion
- Apple Music, YouTube, and SoundCloud provider adapters
- listening-history writes

The core model is currently `PlayerTrack` and assumes music-specific fields such as:

- Registry Track identity
- artist
- album
- Track route identity
- Add to Playlist

Listening history is also Track-route-shaped.

Phase 6 should not create a second player.

The public Audio phase should evolve or adapt the existing player so a playable item can be a Track or an Audio publication with its own canonical URL and secondary presentation label.

Track-only actions such as Add to Playlist must remain Track-only.

This player generalization is not required for the first Audio identity migration.

## Finding 6: shared Trust storage is already suitable for Audio

The shared Trust layer is Resource-based.

`editorial.resource_citations` and `editorial.resource_credits` already target stable Resource identity and explicit target version identity.

Existing Credit roles already include Audio-relevant roles such as:

- producer
- host
- guest
- interviewer
- editor
- researcher
- audio
- translator
- contributor
- reviewer
- fact checker

Existing Citation locator types already include:

- timestamp
- timestamp range
- chapter
- transcript range

The storage model therefore does not need an Audio-specific Citation or Credit system.

However, current mutation functions are domain adapters for Article and Playlist versions.

Phase 6 will need Audio version attachment adapters that write through the same shared Trust authority.

## Finding 7: Corrections is generic at case level but not yet at Audio application level

Correction cases, targets, evidence, decisions, and related-resource review can address generic Resource identity.

The actual correction application command and public Article note presentation remain Article-specific.

Phase 6 can reuse generic Correction case authority once Audio Resource identities exist.

Audio-specific correction application and public correction presentation should be added when the Audio publication lifecycle and public product are ready for them.

Do not create another correction system.

## Finding 8: Review is shared doctrine, not one universal SQL command

Article and Playlist both follow the shared Review lifecycle, immutable version doctrine, command receipt model, and publication integrity rules.

Their concrete Review and Publish RPCs remain domain-specific.

The Playlist implementation explicitly avoided pretending the Article Review RPCs were universal.

Audio should follow the same pattern:

- reuse command receipts and outbox
- reuse expected-version concurrency
- reuse immutable version rules
- reuse Review state semantics
- add Audio-specific Review and publication adapters

Do not build a new generic mega-review abstraction simply to make Audio fit.

## Finding 9: generic Resource version pointers are Article-specific

This is a critical implementation constraint.

The generic `editorial.resources` columns:

- `current_working_version_id`
- `current_submitted_version_id`
- `current_approved_version_id`
- `current_published_version_id`

still carry foreign keys to `editorial.article_versions`.

Playlist correctly avoids writing Playlist version UUIDs into those columns. Playlist keeps domain version pointers in `editorial.playlist_resources`.

Audio must follow that proven pattern.

Audio version UUIDs must never be written into the Article-only generic Resource pointers.

Audio needs typed Resource binding records with Audio-specific current version pointers.

## Finding 10: Resource binding integrity must explicitly learn Audio kinds

`editorial.assert_resource_binding_integrity()` currently supports:

- Article
- Playlist
- Playlist Item
- Registry Artist
- Correction Case
- Media Asset
- Person
- Organization

Unknown Resource kinds raise an exception.

Adding Audio Resource kinds therefore requires typed Audio bindings and an exact extension of the shared binding-integrity function.

## Finding 11: the capability model can be extended without redesign

Playlist already established a useful role pattern:

- administrators, editors, and reviewers can view internal Playlist work
- administrators, editors, authors, and writers can edit owned Playlist work
- administrators and editors can edit others' Playlist work
- administrators and editors can publish and perform destructive Playlist administration

Audio should establish a dedicated Audio capability vocabulary using the same role model unless real Audio workflow proves a different requirement.

Audio must not depend on Institute capability.

## Finding 12: shared command primitives are ready

The permanent command substrate already provides:

- authenticated actor resolution
- request fingerprinting
- idempotency keys
- command receipts
- accepted, success, failure, and retry event vocabulary
- transactional outbox
- result replay
- expected-version concurrency patterns

Audio commands should register with and reuse that substrate.

Do not create another command ledger or outbox.

## Finding 13: current Audio Media rows are technical fixtures

Production currently contains only the Phase 4B Audio acceptance assets used to prove Media upload, processing, resume, retry, and CDN behavior.

They are infrastructure evidence, not cultural Audio publications.

They may support technical verification, but Phase 6 cannot close by promoting a Phase 4B test fixture and calling it cultural acceptance.

The Phase 6 exit gate still requires real Audio work.

## Finding 14: no Audio admin or public product exists

There is no canonical Audio publication list, Audio Editor, show route, episode route, or Audio public collection in the current application.

Admin search contains no Audio publication workspace.

Phase 6A therefore owns the internal product once the authority foundation is stable.

Phase 6B owns the public Audio product.

## Domain placement recommendation

Audio is a new canonical domain.

Unlike Playlist, it does not need to inherit an older `public.wk_*` table family for compatibility.

The recommended permanent home is a dedicated non-exposed `audio` schema for canonical Audio domain state, with controlled public RPC adapters in `public` where browser access is required.

This follows the long-term modular-monolith architecture more closely than placing new canonical Audio tables directly in the exposed `public` schema.

The first implementation should verify that this remains compatible with Supabase migration replay, generated types, control-plane checks, and the existing API exposure boundary.

## First implementation boundary

The first Phase 6A implementation slice should establish identity and working-version authority before combining Review, Media processing changes, and UI.

### M1: Audio identity and working-version foundation

Build:

- canonical Audio Show identity
- canonical Audio Season identity
- canonical Audio Episode identity
- canonical Standalone Audio identity
- stable global Resource identity for each
- typed Resource bindings
- explicit Resource binding integrity
- owner and visibility authority
- Audio capability definitions
- governed create and metadata-update commands
- expected-revision stale-write protection
- immutable working-version snapshots for playable Audio publications
- permanent read-only verifier
- focused contract tests

M1 does not need to publish Audio.

It does not need public Audio routes.

It does not need to redesign the global player.

It does not need to create another Media workflow.

### Following Phase 6A work

After M1 is proven, the next coherent work should establish:

- full-length governed Audio Media delivery derivative
- exact master/revision binding to an Audio publication version
- Audio Review submission and decisions
- approved-version publication authority
- stable podcast GUID and enclosure identity
- Audio-specific Trust attachment adapters
- chapter and transcript attachment authority
- Audio Editor product

The exact grouping can change as implementation exposes real dependencies.

The roadmap is an orientation tool, not a prohibition on natural detours.

## M1 acceptance target

M1 should be considered accepted only when a disposable production-equivalent preview proves:

1. production baseline replay passes before the new migration is applied
2. all four Audio Resource kinds exist and are enabled
3. each Audio object receives exactly one stable typed Resource binding
4. no Audio version UUID is written into Article-only generic Resource version pointers
5. Resource binding integrity accepts all Audio kinds and still rejects unsupported or incomplete bindings
6. Audio ownership and visibility are explicit
7. capability grants match the intended editorial role boundary
8. create commands are idempotent
9. metadata updates reject stale authority revision
10. an Audio Episode can create an immutable working version
11. a Standalone Audio publication can create an immutable working version
12. replay creates no duplicate Resource, domain object, command receipt, or version
13. Article, Playlist, Media, Trust, Person, Organization, Community, and migration control-plane tests remain green
14. production remains unchanged until preview authority is sealed

## Immediate next engineering action

Build the smallest M1 migration, verifier, contract tests, and implementation audit against this boundary.

Do not open the implementation pull request until:

- focused local tests pass
- the exact changed scope is inspected
- a disposable Supabase preview replays the accepted production baseline successfully
- the exact M1 migration applies in preview
- the permanent verifier passes in preview
- preview behavior proves idempotency and stale-write rejection
- preview cleanup is complete
