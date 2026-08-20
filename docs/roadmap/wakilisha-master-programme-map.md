# WAKILISHA Master Programme Map

Status date: 20 August 2026

Repository baseline reconciled: `5aa54cf445693e403d50e90f51dc2e3609498b3e`

## Purpose

This map keeps the long-running WAKILISHA programme visible while the product continues to evolve.

Detours are expected. Building one part of WAKILISHA naturally exposes adjacent product, identity, infrastructure, and reliability work. The purpose of the roadmap is not to prevent that work. It is to preserve orientation so that, after a detour, we can see what changed, what became part of the baseline, and where the numbered programme now continues.

For current phase status, this file and `docs/institute/PROGRAMME_STATUS.md` are the first references to read.

The detailed architectural and product doctrine remains in `docs/institute/two-workspace-pilot-audit-and-build-plan.md`.

## Current programme position

**Phase 5: Playlist is complete.**

Phase 5A established canonical Playlist authority.

Phase 5B shipped the public Playlist product and satisfied the real-work exit gate through the first governed production Playlist, `Top 50 Kenyan Songs Of 2025`.

The numbered programme therefore continues at:

**Phase 6: Audio**

The product, Community, identity, onboarding, and reliability work completed after Phase 5 is recorded as the **Post-Phase-5 Interlude**. That work remains part of the accepted WAKILISHA baseline. It does not need to be forced into the numbered programme to be legitimate.

## Programme map

| Phase | Programme area | Status | Main exit proof |
| --- | --- | --- | --- |
| 0 | Secure and control the existing estate | Complete | Security perimeter and engineering control plane accepted |
| 1 | Platform kernel | Complete | Stable Resource identity, commands, jobs, outbox, and concurrency authority |
| 2 | Article authority | Complete | Durable Article drafts, review, publication, and canonical editor |
| 3 | Trust infrastructure | Complete | Sources, Citations, Credits, Corrections, and provenance |
| 4 | Media platform | Complete | Media authority plus upload and processing pipeline |
| 5 | Playlist | Complete | One real Playlist reviewed and published end to end |
| 6 | Audio | Next numbered phase | One real podcast episode published, RSS validated, and transcript correction preserves history |
| 7 | Video | Planned | One real captioned video publishes across desktop and mobile |
| 8 | Field Capture | Planned | Weak-network capture survives intake, private review, and safe promotion |
| 9 | Public delivery, search, and SEO at scale | Planned | Public delivery no longer depends on giant read or whole-corpus build paths |
| 10 | Registry, Charts, and evidence consolidation | Planned | Shared Trust used without competing evidence authorities |
| 11 | Operational proof and production freeze | Planned | Scale proof, restoration drill, operator independence, and foundation freeze |
| 12 | Inquiry Mode | Planned | One real Inquiry connects Article, Playlist, and Registry work without weakening ordinary editors |

## Closed mainline record

### Phase 0: Secure and control the existing estate

- **0A Security perimeter:** closed through PR #452.
- **0B Engineering control plane:** closed through PR #453.

### Phase 1: Platform kernel

- **1A Resource identity and domain boundaries:** closed through PR #457.
- **1B Commands, idempotency, jobs, and outbox:** closed through PR #458 and PR #459.

### Phase 2: Article authority

- **2A Durable drafts and immutable versions:** closed through PR #460, PR #461, PR #463, and PR #464.
- **2B Review and publication lifecycle:** closed through PR #467, PR #469, PR #470, and PR #481.
- **2C Article Editor Workbench:** closed through PR #482 and PR #483.

The C slice was a quality and product closure inside Phase 2. It did not create a new top-level programme phase.

### Phase 3: Trust infrastructure

- **3A Sources, Citations, and Credits:** closed through PR #542.
- **3B Corrections and provenance:** closed through PR #557.

The Article Workspace North Star work remains an accepted quality layer around the Article and Trust foundations.

### Phase 4: Media platform

- **4A Media authority redesign:** closed through PR #580.
- **4B Upload and processing pipeline:** closed through PR #586.

### Phase 5: Playlist

#### 5A Canonical Playlist authority

Closed through PR #587 and PR #588.

Accepted authority includes:

- canonical Playlist Resource identity
- Playlist command and concurrency authority
- immutable Playlist versions
- review lifecycle
- atomic ordering
- Registry-first Track Intake
- provider playback validation
- Media cover authority
- shared Sources, Citations, Credits, Corrections, and provenance
- canonical Playlist admin workspace

#### 5B Public Playlist product

Closed through the real-work acceptance sequence.

Key evidence:

- PR #590 shipped the Phase 5B public Playlist product.
- PR #591 seeded the first real Phase 5B Playlist intake.
- PR #592 completed the first Playlist Registry canonicalization.
- PR #593 recorded the first governed publication of `Top 50 Kenyan Songs Of 2025`.
- The PR #593 verifier required published state, submitted, approved, and published immutable versions, durable review events, a durable publication snapshot, 50 public tracks, 50 playable tracks, 50 artist-linked tracks, 50 Registry-linked tracks, and 50 editor notes.
- PR #597 added Playlist editorial lifecycle parity.
- PR #598 added exact version-bound Playlist Preview.
- PR #599 proved published-update review continuity and recorded production acceptance through published Version 8.

That satisfies the Phase 5 exit gate: **one real Playlist reviewed and published end to end**.

Playlist remains an active product. Future Playlist work can continue naturally where real use exposes needs. Phase 5 does not need to stay administratively open for that to happen.

## Post-Phase-5 Interlude

After the Playlist exit gate, WAKILISHA expanded several adjacent foundations and products before returning to the numbered programme.

This included:

- Registry-led onboarding
- universal Posts and the desktop application shell
- Community social graph
- Personal Playlists
- broader Track curation reach
- canonical Post Track and rich Link attachments
- Post Drafts and authored Threads
- canonical mentions and notification preferences
- dedicated Notifications
- public-read and migration-control hardening
- Article Author to Person convergence
- governed account identity retirement
- canonical Organization identity
- Organization public repertoire
- Article and Artist prerender reliability

See `docs/roadmap/post-phase-5-interlude-ledger.md` for the detailed record.

The lesson is not that detours should stop. The lesson is that the roadmap should be reconciled after them.

## Phase 6: Audio

Phase 6 is the next numbered programme phase.

### PR 6A: Audio publication authority

Build:

- shows
- seasons
- episodes
- standalone audio
- immutable episode versions
- canonical Audio Editor
- preservation-master selection
- chapters
- transcripts
- Credits
- Citations
- RSS contract
- stable GUID and enclosure identity

Reuse the foundations already built for Resource identity, Media, Trust, Review, Corrections, provenance, Registry links, commands, jobs, and outbox.

### PR 6B: Public Audio product

Build:

- public show and episode routes
- accessible audio playback
- transcript navigation
- chapters
- RSS delivery
- public review and provenance presentation
- Corrections
- scheduling
- search
- SEO
- cached public read models

### Phase 6 exit gate

One real podcast episode must:

- move through the governed Audio workflow
- publish publicly
- have valid RSS
- preserve stable GUID and enclosure identity
- work on desktop and mobile
- expose the required Credits and Trust presentation
- prove that a transcript correction preserves prior history

## Later programme

### Phase 7: Video

Build canonical Video publication authority, then the public Video product. Exit through one real captioned Video publication across desktop and mobile.

### Phase 8: Field Capture

Build safe mobile intake, then newsroom triage and promotion. Exit through a weak-network capture that reaches private review and becomes a safe draft without losing provenance.

### Phase 9: Public delivery, search, and SEO at scale

Move public reads toward stable versioned domain contracts, cursor pagination, maintained search documents, incremental indexing, cache invalidation, sharded sitemaps, and publication-driven SEO updates.

### Phase 10: Registry, Charts, and evidence consolidation

Bring Registry and Charts onto shared Trust adapters without replacing their domain authority. Consolidate competing evidence paths and scale hygiene.

### Phase 11: Operational proof and production freeze

Prove representative scale, recovery, observability, operator independence, and restoration. Freeze foundations only after the evidence supports doing so.

### Phase 12: Inquiry Mode

Build Inquiry as a capability across canonical editors, then the public Inquiry product and legacy Institute retirement.

## Orientation principles

- The cultural output remains the centre.
- One canonical authority remains preferable to duplicate authorities.
- Shared Trust, Media, Review, Corrections, and provenance should be reused rather than rebuilt per format.
- Real cultural work remains the strongest acceptance test.
- Public and admin capability should meet at the actual product outcome.
- Detours are part of building. Record what they changed and return to the map when the work settles.
- The roadmap is a navigation instrument, not a ban on discovering better work.

## Immediate next step

Before writing Phase 6A code, audit the current Audio, Media, player, transcript, RSS, Review, Trust, Corrections, Resource, job, command, and public-route authorities against the Phase 6 contract.

That diagnostic should tell us what Phase 6A actually needs, rather than assuming the 9 August plan still describes the present codebase exactly.
