# WAKILISHA Master Programme Map

## Current production reconciliation - 2 September 2026

Latest production-accepted application main:

`75b42377a8bc676ae78588c588356ab4a6995bd4`

Production is at 79 migrations through `20260901170500_community_track_registry_identity.sql`.

The accepted frontend entry is `assets/index-CIyckr53.js` with SHA-256 `66d5d645025d048693d4d8b24809bfbb9f30ffaf68be3dac376b6d4bd13ce93e`.

Phase 7B remains the current numbered phase. The September Release taxonomy, one-track public identity, Community Track Registry identity, sitemap-authority, and MIZIZI work is an accepted adjacent Registry/public-delivery detour, not a new numbered phase.

Accepted Release taxonomy:

- Single: exactly 1 resolvable active Track
- EP: 2 through 6 resolvable active Tracks
- Album: 7 or more resolvable active Tracks

A Single remains a Release in the Registry and in public collections, but its public detail destination is its one Track rather than a duplicate Release page.

Historical MIZIZI Track identity apply is production accepted:

- 440 canonical Track repairs
- 66 blocked review items
- 857 MIZIZI-created permanent redirects
- fresh post-apply Track audit: 561 findings
- separate historical Release taxonomy apply: still unrun

Current acceptance records:

- `docs/engineering/release-taxonomy-membership-integrity-closure-record.md`
- `docs/engineering/community-track-registry-identity-production-closure-record.md`
- `docs/engineering/mizizi-historical-track-production-closure-record.md`

## Phase 7A closure reconciliation - 31 August 2026

**Phase 7A Video publication authority is CLOSED and production accepted.**

The real exit-gate Video `Monday Morning in September` completed the canonical internal workflow through immutable working v5, submitted v6, approved v7, and published v8 after the original published v4 remained intact in history.

Final Phase 7A production authority:

- accepted production/frontend main: `a8e10350dccd5a5b1cd5b49001a4cf8839a76bd9`
- production migration count: `75`
- production migration head: `20260831080826_video_caption_language_private_use_tags`
- production frontend entry: `assets/index-S6v7xwyD.js`
- production frontend entry SHA-256: `e878fec7815bfd014c50d3f3273259f5f74e5aeb63a3f918060bb1f0eb16ae74`

The final published v8 carries one governed Sheng closed-caption track using exact Media revision `49427742-501d-44a0-951e-da56e51992ae` with language tag `und-x-sheng`.

The real workflow exposed and closed bounded Media governance, native source integrity, deferred Resource-binding integrity, post-publication revision UI, post-publication review action lineage, and private-use caption language-tag gaps without creating competing authority.

Canonical Phase 7A closure record:

- `docs/engineering/phase-7a-closure-record.md`

The numbered programme now advances to **Phase 7B: Public Video product**.

Status date: 31 August 2026

Phase 7A closure migration head: `20260831080826`

Phase 7A closure migration count: `75`

## Purpose

This map keeps the long-running WAKILISHA programme visible while the product continues to evolve.

Detours are expected. Building one part of WAKILISHA naturally exposes adjacent product, identity, infrastructure, reliability, and primitive work. The purpose of the roadmap is not to prevent that work. It is to preserve orientation so that, after a detour, we can see what changed, what became part of the baseline, and where the numbered programme now continues.

For current phase status, this file and `docs/institute/PROGRAMME_STATUS.md` are the first references to read.

The detailed architectural and product doctrine remains in `docs/institute/two-workspace-pilot-audit-and-build-plan.md`.

## Current programme position

**Phases 6A, 6B, and 7A are complete.**

The numbered programme now continues at:

**Phase 7B: Public Video product**

Phase 6B closed on 25 August 2026 by explicit programme decision after its production authority and post-M2 convergence baseline were accepted through PR #706. The former real-podcast exercise remains useful non-blocking Audio operational acceptance; it is not represented as completed.

Current references:

- `docs/engineering/phase-6b-closure-record.md`
- `docs/engineering/phase-7a-video-publication-authority-kickoff.md`
- `docs/engineering/primitive-compounding-contract.md`

Phase 7A opened from production runtime baseline `dae3de2dc9fb021496eb0fe0c4d4f0338f676a88`, migration count `50`, head `20260825102000`.

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
| 6B | Public Audio product | Complete | Public Audio authority accepted; former real-podcast exercise retained as non-blocking operational acceptance |
| 7A | Video publication authority | Complete | Real Video reached immutable published v8 with governed Sheng captions and preserved prior publication history |
| 7B | Public Video product | Current | One real captioned Video publishes across desktop and mobile |
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

**Closed 25 August 2026.**

Accepted production authority includes published Audio public reads, Show/Episode identity and routes, RSS, stable GUID/enclosure identity, persistent Player integration, public Audio discovery, shared Trust presentation, and the post-M2 convergence baseline through PR #706.

The former real-podcast exercise is retained as non-blocking Audio operational acceptance rather than a programme-numbering prerequisite.

Canonical record:

`docs/engineering/phase-6b-closure-record.md`

### Phase 6 handoff

Phase 6 is complete and the numbered programme advances to Phase 7A.

## Primitive compounding doctrine

From Phase 6B onward, repeated product work must compound platform learning.

The rule is:

> Solve the domain problem completely, then preserve the reusable residue. Never flatten the domain merely to manufacture reuse, and never allow the next domain to quietly rebuild a concept WAKILISHA has already learned.

The machine-enforced contract is documented in `docs/engineering/primitive-compounding-contract.md` and enforced by Critical Control Plane.

## Later programme

### Phase 7A: Video publication authority

**Closed 31 August 2026.** Canonical internal Video authority is production accepted. The real exit-gate Video reached immutable published v8 with exact governed Media source and Sheng caption authority, governed review and approval, replacement publication, and preserved prior published history. See `docs/engineering/phase-7a-closure-record.md`.

### Phase 7B: Public Video product

**Current.** Compose the public Video experience over the accepted 7A authority. Exit Phase 7 through one real captioned Video publication across desktop and mobile.

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

Continue **Phase 7B: Public Video product** from the production-accepted V1-through-V3 baseline and subsequent public Video corrections.

Do not reopen Phase 7A.

The September Registry/public-identity detour is accepted adjacent baseline:

- Release taxonomy and one-track public identity are accepted
- Community Track Registry-ID-first identity is accepted
- historical MIZIZI Track identity apply is closed at 440 repairs / 66 blocked reviews / 857 MIZIZI redirects
- the remaining 66 Track slug candidates are governed review work, not permission to invent identity
- the separate historical Release taxonomy apply remains unrun with the accepted 32-candidate set
- the 18 bad active Release-membership relationships across 13 active Releases remain preserved evidence

Canonical adjacent closure records:

- `docs/engineering/release-taxonomy-membership-integrity-closure-record.md`
- `docs/engineering/community-track-registry-identity-production-closure-record.md`
- `docs/engineering/mizizi-historical-track-production-closure-record.md`

Phase 7B product work can continue independently while the remaining Registry review and Release taxonomy mutation stay separately governed.
