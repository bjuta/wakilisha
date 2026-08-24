# WAKILISHA Programme Status

Status date: 24 August 2026

Phase 6A production authority baseline: `fd0580e3a1a19e3d1f06a9c8466a37c84cd26a8b`

Phase 6B governance gate: PR #684, `Enforce primitive compounding and open Phase 6B`

Documentation closure gate: PR #699, `Reconcile Phase 6B milestone closure records`

Production runtime application baseline: `77cecd892c63c76ac79921eeb02278ab2b231d30`

Current production migration head: `20260824061359`

Current production migration count: `49`

## Status authority

This file is the current status overlay for `docs/institute/two-workspace-pilot-audit-and-build-plan.md`.

The long-form plan remains the architectural, product-doctrine, phase-scope, engineering-rule, and five-year durability authority.

Where the long-form plan's current phase, immediate next implementation, or completion status conflicts with this file, use this file.

The compact navigation view is `docs/roadmap/wakilisha-master-programme-map.md`.

## Current numbered work

**Phase 6B: Public Audio product**

Phases 0 through 5 are complete.

Phase 6A Audio publication and internal editorial authority is complete and closed in production.

See:

- `docs/engineering/phase-6a-closure-record.md`
- `docs/engineering/phase-6b-public-audio-kickoff.md`
- `docs/engineering/phase-6b-progress-closure-record.md`
- `docs/engineering/track-lyrics-review-provenance-closure-record.md`
- `docs/engineering/charts-public-source-accessibility-soak-wip.md`
- `docs/engineering/primitive-compounding-contract.md`

## Phase 5 closure

### Phase 5A: Canonical Playlist authority

Complete through PR #587 and PR #588.

### Phase 5B: Public Playlist product

Complete through the production acceptance sequence that followed the initial Phase 5B product shipment.

Evidence includes PR #590 through PR #599, including the first governed publication of `Top 50 Kenyan Songs Of 2025`, public product delivery, Registry canonicalization, lifecycle parity, exact version-bound Preview, and published-update review continuity.

The Phase 5 programme exit gate was:

> one real Playlist is reviewed and published end to end

That gate is satisfied.

## Post-Phase-5 Interlude

After the Playlist exit gate, WAKILISHA moved through adjacent product and platform work before returning to the numbered programme.

That accepted baseline includes:

- Registry-led onboarding
- universal Posts and the desktop application shell
- Community social graph
- Personal Playlists
- Track curation reach
- canonical Post Track and rich Link attachments
- Post Drafts and authored Threads
- canonical mentions and Notifications
- migration-history and public-read hardening
- Article Author to Person convergence
- governed account identity retirement
- Organization identity and public repertoire
- Article and Artist prerender reliability

The detailed ledger remains `docs/roadmap/post-phase-5-interlude-ledger.md`.

## Phase 6A closure

Phase 6A now provides the accepted internal Audio system:

- Show, Season, Episode, and Standalone Audio identity
- typed Resource bindings and Audio capabilities
- immutable Audio versions
- full-length governed Audio delivery
- exact master/revision binding
- Chapters and Transcript Media binding
- shared Credits and Citations
- Review and publication lifecycle
- stable GUID and enclosure identity
- canonical Audio Admin Studio collection and editor
- lifecycle History
- Audio Editorial Workbench
- canonical waveform and technical Media context
- time-point and time-range submitted-version review
- rich comments/replies and resolve/reopen workflow

PR #683 merged the final Audio Editorial Workbench. The migration `20260821095406_audio_editorial_workbench_time_anchored_review.sql` is live in production. Production closed at 37 migrations with zero pending repository migrations.

Authenticated browser acceptance passed, and the final disposable Supabase preview was deleted after closure.

Admin Studio convergence across Article, Playlist, and Audio is also accepted. Its reusable residue is now governed by the Primitive Compounding Contract.

## Phase 6B progress through 24 August 2026

### M1: published Audio public-read and route foundation

**CLOSED.**

PR #686 shipped the governed published-Audio read contract and `/audio/:slug` route, while integrating spoken Audio into the existing WAKILISHA Player under a media-first capability contract.

The M1 migration `20260821150000_phase_6b_m1_public_audio_read_route.sql` is live and permanently verified.

### M2: shared Show hierarchy + Audio RSS

**CLOSED.**

PR #687 established shared Show / Show Episode cultural identity and the canonical public grammar:

- `/shows/:showSlug`
- `/shows/:showSlug/:episodeSlug`
- `/shows/:showSlug/feed.xml`
- `/audio/:slug` for Standalone Audio
- `/audio/enclosures/:publicationId.mp3`

The production acceptance sequence also includes PR #688, PR #689, and PR #690, which closed Nginx route parsing, static Supabase upstream transport, and Audio ontology leaks discovered during acceptance.

M2 production authority is live through migration `20260822173446_phase_6b_m2_audio_ontology_closure.sql`.

### Accepted post-M2 convergence baseline

The work between M2 and the current baseline is accepted and no longer an unrecorded detour:

- PR #691 through PR #693: shared Editorial Credit identity and production acceptance repairs.
- PR #694: rich editorial canonical primitives M1.
- PR #695: global player/editorial authority convergence plus governed Track Lyrics authority.
- PR #696: player/mobile/public discovery convergence, public Audio index authority, Lyrics contribution intake, and public Artist search authority.
- PR #697: governed Track Lyrics review/provenance, immutable contribution history, shared editorial decisions, and public attribution.
- PR #698: final Lyrics visual-acceptance corrections for pending-work priority and truthful History semantics.

The production runtime baseline is `77cecd892c63c76ac79921eeb02278ab2b231d30`, with 49 migrations and head `20260824061359`.

## Tracked adjacent WIP: Kenya Charts public-source durability proof

**WIP / PENDING 7-DAY DURABILITY PROOF.**

This work is intentionally tracked outside the numbered Phase 6B milestone sequence. It is not M3 and must not be treated as programme advancement.

The research is testing whether WAKILISHA can operate a long-lived Kenya-first chart from public or ordinary developer-accessible music evidence without requiring privileged DSP data relationships.

Empirical access probes on 24 August 2026 established successful Kenya-specific public access for Apple, YouTube, Mdundo, Audiomack, Boomplay, and Shazam. Spotify remains optional/non-core because the tested public Kenya CSV route returned an HTML shell rather than a proved chart dataset.

A seven-day unattended durability soak is now running locally across:

- Apple
- YouTube
- Mdundo
- Audiomack
- Boomplay
- Shazam

The soak began at `2026-08-24T13:52:43Z` / 16:52:43 EAT, runs approximately every six hours, and should complete after 31 August 2026 at approximately 16:52:43 EAT. Its first observation was 6/6 successful with depths of 100, 100, 100, 100, 100, and 200 respectively.

Do not forget this work while other WAKILISHA work proceeds. Do not close or redesign the chart methodology before the seven-day evidence bundle is analyzed.

Known follow-up already identified by the read-only production audit: raw observations can prove the same recording across multiple source records and providers while downstream candidate `source_count` still resolves to `1`. Repair independent observation-source identity through the existing ingestion/scoring pipeline before changing the scoring formula.

Provider genres remain non-authoritative. WAKILISHA Registry genre authority must continue to decide cultural classification and chart eligibility.

Canonical WIP record:

- `docs/engineering/charts-public-source-accessibility-soak-wip.md`

The WIP closes only after the soak bundle is analyzed into a Green / Amber / Red viability decision, source qualification grades, single-source-loss degradation behavior, evidence-plumbing repairs, and the recommended Kenya chart source constitution.

## Immediate numbered programme work

Phase 6B remains open, but **M1 and M2 are closed**.

There is no agreed Phase 6B M3 contract in the repository yet. Do not invent one merely to advance numbering.

The next numbered slice should be defined from the remaining Phase 6 exit gate and the production runtime baseline. It must not reopen M1/M2 or rebuild authority already accepted during the post-M2 convergence interval.

The remaining Phase 6 exit proof still requires one real podcast episode to:

- move through the governed Audio workflow
- publish publicly
- have valid RSS
- preserve stable GUID and enclosure identity
- work on desktop and mobile
- expose the required Credits and Trust presentation
- prove that a transcript correction preserves prior history

## Primitive compounding rule

Phase 6B is the first numbered phase that begins with the Primitive Compounding Contract already active in CI.

Every milestone must record whether it:

- reuses an existing primitive
- creates a candidate primitive from a real need
- promotes a candidate after a second-domain proof
- extends an existing primitive from new field learning
- deliberately retains domain-specific implementation

Do not build a universal screen. Do not rebuild a concept WAKILISHA has already learned.

## Phase 6 exit gate

Phase 6 remains open until one real podcast episode:

- moves through the governed Audio workflow
- publishes publicly
- has valid RSS
- preserves stable GUID and enclosure identity
- works on desktop and mobile
- exposes the required Credits and Trust presentation
- proves that a transcript correction preserves prior history

## Programme continuity

The roadmap is an orientation tool, not a prohibition on detours.

If building Phase 6B exposes adjacent work that is better solved first, that work can be done. When it settles, reconcile the map so the project continues with a shared understanding of what changed and what remains.

## Deployment state of this status correction

- SQL migration needed: No
- Supabase Edge Function deployment needed: No
- frontend deployment needed: No
- Readdy Finish update needed: No
- production runtime change needed: No
