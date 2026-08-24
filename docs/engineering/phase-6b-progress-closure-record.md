# Phase 6B Progress and Milestone Closure Record

Status: PHASE 6B OPEN; M1 CLOSED; M2 CLOSED

Status date: 24 August 2026

Current production main: `77cecd892c63c76ac79921eeb02278ab2b231d30`

Current production migration head: `20260824061359`

Current production migration count: `49`

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

## Current Phase 6B boundary

Phase 6B remains open.

There is no repository-approved M3 contract yet.

The next numbered slice must be defined from the remaining Phase 6 exit proof, not from stale M1/M2 kickoff text.

## Remaining Phase 6 exit gate

One real podcast episode must:

- move through the governed Audio workflow
- publish publicly
- have valid RSS
- preserve stable GUID and enclosure identity
- work on desktop and mobile
- expose the required Credits and Trust presentation
- prove that a transcript correction preserves prior history

Only after that proof should Phase 6 itself be considered for closure or the programme advance to Phase 7.

## Deployment classification

This record is documentation only.

- SQL migration needed: No
- Supabase Edge Function deploy needed: No
- Readdy Finish update needed: No
- Frontend deploy needed: No
- production runtime change needed: No
