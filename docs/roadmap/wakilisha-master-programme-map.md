# WAKILISHA Master Programme Map

Status date: 21 August 2026

Phase 6A production authority baseline: `fd0580e3a1a19e3d1f06a9c8466a37c84cd26a8b`

Phase 6B governance gate: PR #684, `Enforce primitive compounding and open Phase 6B`

## Purpose

This map keeps the long-running WAKILISHA programme visible while the product continues to evolve.

Detours are expected. Building one part of WAKILISHA naturally exposes adjacent product, identity, infrastructure, reliability, and primitive work. The purpose of the roadmap is not to prevent that work. It is to preserve orientation so that, after a detour, we can see what changed, what became part of the baseline, and where the numbered programme now continues.

For current phase status, this file and `docs/institute/PROGRAMME_STATUS.md` are the first references to read.

The detailed architectural and product doctrine remains in `docs/institute/two-workspace-pilot-audit-and-build-plan.md`.

## Current programme position

**Phase 6A: Audio publication authority and internal editorial product is complete.**

The numbered programme now continues at:

**Phase 6B: Public Audio product**

The current kickoff is `docs/engineering/phase-6b-public-audio-kickoff.md`.

The Phase 6A closure record is `docs/engineering/phase-6a-closure-record.md`.

The Primitive Compounding Contract is now part of the engineering control plane and applies to Phase 6B onward.

## Programme map

| Phase | Programme area | Status | Main exit proof |
| --- | --- | --- | --- |
| 0 | Secure and control the existing estate | Complete | Security perimeter and engineering control plane accepted |
| 1 | Platform kernel | Complete | Stable Resource identity, commands, jobs, outbox, and concurrency authority |
| 2 | Article authority | Complete | Durable Article drafts, review, publication, and canonical editor |
| 3 | Trust infrastructure | Complete | Sources, Citations, Credits, Corrections, and provenance |
| 4 | Media platform | Complete | Media authority plus upload and processing pipeline |
| 5 | Playlist | Complete | One real Playlist reviewed and published end to end |
| 6A | Audio publication authority and internal editorial product | Complete | Governed Audio authority, Admin Studio workbench, submitted-version review, and production acceptance |
| 6B | Public Audio product | Current | One real podcast episode published, RSS validated, and transcript correction preserves history |
| 7 | Video | Planned | One real captioned video publishes across desktop and mobile |
| 8 | Field Capture | Planned | Weak-network capture survives intake, private review, and safe promotion |
| 9 | Public delivery, search, and SEO at scale | Planned | Public delivery no longer depends on giant read or whole-corpus build paths |
| 10 | Registry, Charts, and evidence consolidation | Planned | Shared Trust used without competing evidence authorities |
| 11 | Operational proof and production freeze | Planned | Scale proof, restoration drill, operator independence, and foundation freeze |
| 12 | Inquiry Mode | Planned | One real Inquiry connects Article, Playlist, and Registry work without weakening ordinary editors |

## Closed mainline record

### Phase 0: Secure and control the existing estate

- 0A Security perimeter: closed through PR #452.
- 0B Engineering control plane: closed through PR #453.

### Phase 1: Platform kernel

- 1A Resource identity and domain boundaries: closed through PR #457.
- 1B Commands, idempotency, jobs, and outbox: closed through PR #458 and PR #459.

### Phase 2: Article authority

- 2A Durable drafts and immutable versions: closed through PR #460, PR #461, PR #463, and PR #464.
- 2B Review and publication lifecycle: closed through PR #467, PR #469, PR #470, and PR #481.
- 2C Article Editor Workbench: closed through PR #482 and PR #483.

The C slice was a quality and product closure inside Phase 2. It did not create a new top-level programme phase.

### Phase 3: Trust infrastructure

- 3A Sources, Citations, and Credits: closed through PR #542.
- 3B Corrections and provenance: closed through PR #557.

The Article Workspace North Star work remains an accepted quality layer around the Article and Trust foundations.

### Phase 4: Media platform

- 4A Media authority redesign: closed through PR #580.
- 4B Upload and processing pipeline: closed through PR #586.

### Phase 5: Playlist

#### 5A Canonical Playlist authority

Closed through PR #587 and PR #588.

Accepted authority includes canonical Playlist Resource identity, command and concurrency authority, immutable Playlist versions, review lifecycle, atomic ordering, Registry-first Track Intake, provider playback validation, Media cover authority, shared Trust and Corrections, and the canonical Playlist admin workspace.

#### 5B Public Playlist product

Closed through the real-work acceptance sequence.

Key evidence includes PR #590 through PR #599, including the first real governed publication of `Top 50 Kenyan Songs Of 2025`, exact version-bound Preview, editorial lifecycle parity, and published-update review continuity.

That satisfies the Phase 5 exit gate: one real Playlist reviewed and published end to end.

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

### Phase 6A: Audio publication authority and internal editorial product

**Closed 21 August 2026.**

Accepted Phase 6A now includes:

- Shows
- Seasons
- Episodes
- Standalone Audio
- typed Resource bindings and Audio capabilities
- immutable Audio versions
- full-length governed Audio delivery
- exact Media master/revision binding
- Chapters
- Transcript Media attachment
- Credits
- Citations
- governed Review and publication lifecycle
- stable GUID and enclosure identity
- canonical Audio Admin Studio collection and editor
- lifecycle/version History
- Audio Editorial Workbench
- canonical Media waveform and technical facts
- time-point and time-range review bound to exact submitted versions
- rich comments, replies, and resolve/reopen lifecycle

The final Audio Editorial Workbench merged through PR #683 at `fd0580e3a1a19e3d1f06a9c8466a37c84cd26a8b`.

Production closed at migration `20260821095406`, 37 migrations total, zero pending repository migrations. Authenticated production acceptance passed and the final disposable preview was deleted.

See `docs/engineering/phase-6a-closure-record.md`.

### Phase 6B: Public Audio product

**Current numbered work.**

Build:

- public Show and Episode routes
- public Standalone Audio routes where required
- accessible Audio playback
- transcript navigation
- Chapters
- RSS delivery
- public Credits, Citations, provenance, and Corrections presentation
- scheduling
- search
- SEO
- cached or stable public read models
- global-player integration

The recommended first slice is a narrow published-Audio public-read and route foundation before the whole product is built.

See `docs/engineering/phase-6b-public-audio-kickoff.md`.

### Phase 6 exit gate

One real podcast episode must:

- move through the governed Audio workflow
- publish publicly
- have valid RSS
- preserve stable GUID and enclosure identity
- work on desktop and mobile
- expose the required Credits and Trust presentation
- prove that a transcript correction preserves prior history

Phase 6A is closed. Phase 6B owns this remaining exit gate.

## Primitive compounding doctrine

From Phase 6B onward, repeated product work must compound platform learning.

The rule is:

> Solve the domain problem completely, then preserve the reusable residue. Never flatten the domain merely to manufacture reuse, and never allow the next domain to quietly rebuild a concept WAKILISHA has already learned.

The machine-enforced contract is documented in `docs/engineering/primitive-compounding-contract.md` and enforced by Critical Control Plane.

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
- Shared Trust, Media, Review, Corrections, provenance, and learned primitives should be reused rather than rebuilt per format.
- Real cultural work remains the strongest acceptance test.
- Public and admin capability should meet at the actual product outcome.
- Purpose-built domain workspaces may remain different while sharing the same meaning for shared concepts.
- Detours are part of building. Record what they changed and return to the map when the work settles.
- The roadmap is a navigation instrument, not a ban on discovering better work.

## Immediate next step

Begin Phase 6B M1 from protected `main` after PR #684.

Audit only the exact public-read and route seams needed for the smallest published-Audio contract, declare primitive impact, and then build the narrowest preview-proven slice. Do not reopen Phase 6A or rebuild authority that production already owns.
