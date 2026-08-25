# Phase 6B Progress and Milestone Closure Record

Status: PHASE 6B CLOSED; M1 CLOSED; M2 CLOSED

Status date: 25 August 2026

Production runtime application baseline: `dae3de2dc9fb021496eb0fe0c4d4f0338f676a88`

Documentation closure gate: PR #699, `Reconcile Phase 6B milestone closure records`

Current production migration head: `20260825102000`

Current production migration count: `50`

## Purpose

This record reconciles the Phase 6B programme after M1, M2, and the adjacent convergence work they exposed.

It exists so the roadmap does not regress to "start M1" after the product has already moved materially beyond M1 and M2.

Phase 6B is not closed. Its first two numbered milestones are closed.

## M1 closure: published Audio public-read + route foundation

Status: CLOSED

Primary implementation: PR #686, `Open Phase 6B with public Audio and a media-first player`.

Merged main after PR #686: `f47d08049fafd852e7b3f5cf4cbaf3fc91e5fbd0`.

Production migration:

`20260821150000_phase_6b_m1_public_audio_read_route.sql`

Accepted result:

- exact current published Audio version is the public read boundary
- draft/review Audio state remains private
- immutable publication snapshot and current Media safety are rechecked
- Chapters and Transcript remain version-bound
- public Credits/Citations use shared Trust authority
- stable GUID and enclosure identity survive the read boundary
- `/audio/:slug` resolves public Standalone Audio
- spoken Audio enters the existing persistent WAKILISHA Player
- compact and expanded playback follow media-first, capability-driven presentation
- provider/backend implementation state is not the default listener hierarchy

M1 closed in production at migration count 38 / head `20260821150000`.

## M2 closure: shared Show hierarchy + Audio RSS

Status: CLOSED

Primary implementation: PR #687, `Add shared Show identity and Audio RSS delivery`.

Production acceptance corrections:

- PR #688: Nginx enclosure-regex syntax
- PR #689: static Supabase upstream for production Nginx transport
- PR #690: Audio ontology closure discovered through browser acceptance

Production migrations:

- `20260822131500_phase_6b_m2_shared_show_hierarchy_rss.sql`
- `20260822131600_phase_6b_m2_audio_canonical_show_paths.sql`
- `20260822173446_phase_6b_m2_audio_ontology_closure.sql`

Accepted result:

- Show and Show Episode are shared WAKILISHA cultural identity
- Season remains Audio-specific
- canonical paths are `/shows/:showSlug` and `/shows/:showSlug/:episodeSlug`
- RSS is `/shows/:showSlug/feed.xml`
- Standalone Audio remains `/audio/:slug`
- branded enclosure identity remains `/audio/enclosures/:publicationId.mp3`
- `audio-public-delivery` Edge transport is production-proven
- repo-owned Nginx transport is production-proven
- stable GUID and enclosure identity remain Audio authority
- Audio publication/version, Media, Transcript, Chapters, Trust, Review, RSS enclosure and playback remain Audio-domain authority

M2 closed in production at migration count 41 / head `20260822173446`.

## Accepted post-M2 convergence baseline

The work after M2 is not a reason to keep M1 or M2 open. It is accepted programme baseline discovered while using the product.

### Editorial identity and primitive convergence

PR #691 through PR #693 established and production-hardened shared Editorial Credit identity.

PR #694 added the first shared rich-editorial canonical primitive layer for Audio and Playlists, including version-bound taxonomy/discoverability authority and shared Discovery workspace semantics.

### Player and editorial authority convergence

PR #695 closed a player/editorial correction sprint:

- hardened global playback arbitration
- restored distinct music vs spoken-Audio capability semantics
- converged canonical Admin Record Actions
- added governed Audio Archive/Restore
- added governed published Track Lyrics authority

### Player/mobile/public discovery convergence

PR #696:

- converged persistent Player and mobile chrome around shared responsive interaction primitives
- added public Audio index authority
- added governed Lyrics contribution intake
- added governed public Artist search
- made Queue, Lyrics, Transcript, Chapters, and More share one responsive player-sheet grammar

### Track Lyrics review/provenance closure

PR #697 and PR #698 closed governed Lyrics review/provenance and the visual-acceptance defects found after deployment.

The permanent record is:

`docs/engineering/track-lyrics-review-provenance-closure-record.md`

## Final Phase 6B boundary

**Phase 6B closed on 25 August 2026.**

The closure decision accepts the production Audio authority already proved through M1, M2, their production acceptance repairs, and the post-M2 convergence baseline through PR #706.

It deliberately changes one earlier programme rule: the real-podcast exercise is no longer a blocker for advancing the numbered roadmap. This record does **not** state that the exercise was completed. Production audit at closure showed:

- Show: `The Sounds of Nairobi`
- Season 1: `Tuko Works Mzeiya`
- Episode: `Monday Morning in September`
- episode state: `draft`

That episode can still be used for a future operational acceptance exercise.

## Accepted Phase 6B closure authority

The closed phase leaves production with:

- public Standalone Audio, Show, and Episode route authority
- shared Show / Show Episode cultural identity
- RSS delivery at `/shows/:showSlug/feed.xml`
- branded enclosure delivery at `/audio/enclosures/:publicationId.mp3`
- stable GUID and enclosure identity
- exact current-published-version public safety
- persistent Player integration for spoken Audio
- desktop/mobile public Audio behavior
- public Audio discovery
- version-bound Transcript and Chapters
- shared Credits, Citations, Trust, Review, Corrections, and provenance
- Audio archive/restore and editorial workbench authority
- governed Track Lyrics contribution, review/provenance, and structured stanza preservation

Production closure baseline:

- repository main: `dae3de2dc9fb021496eb0fe0c4d4f0338f676a88`
- migration count: `50`
- migration head: `20260825102000`
- frontend entry: `assets/index-COVa-f0y.js`

## Retained non-blocking Audio operational acceptance

Useful follow-up remains:

- publish one real podcast episode through the governed workflow
- validate its RSS through an external client/validator
- record stable GUID/enclosure continuity before and after a controlled update
- exercise desktop/mobile listening against that real episode
- verify public Credits/Trust presentation on that episode
- perform a controlled transcript correction and prove prior version history remains reconstructable

These are ongoing Audio product acceptance tasks, not Phase 6B reopening criteria.

## Programme handoff

The numbered programme advances to:

**Phase 7A: Video publication authority**

Canonical kickoff:

`docs/engineering/phase-7a-video-publication-authority-kickoff.md`

## Deployment classification

This closure is documentation/programme governance only.

- SQL migration needed: No
- Supabase Edge Function deploy needed: No
- Readdy Finish update needed: No
- Frontend deploy needed: No
- production runtime change needed: No
