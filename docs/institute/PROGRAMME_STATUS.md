# WAKILISHA Programme Status

Status date: 21 August 2026

Repository baseline reconciled: `fd0580e3a1a19e3d1f06a9c8466a37c84cd26a8b`

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

## Immediate numbered programme work

Phase 6B owns the remaining public Audio product and the Phase 6 exit gate.

The first recommended slice is **M1: published Audio public-read and route foundation**.

Before building the whole public experience, prove a narrow public contract where:

- only the exact current published Audio version is public
- draft/review state cannot leak
- Show / Season / Episode / Standalone identity resolves canonically
- public route identity is deterministic
- full-length Audio delivery comes from canonical Media authority
- Chapters and Transcript identity remain version-bound
- Transcript public-safety rules remain enforced
- public Credits/Citations come from shared Trust authority
- stable GUID and enclosure identity survive the public boundary
- anonymous/public execution is narrowly granted and permanently verified

Then continue into public Show/Episode presentation, accessible playback, transcript navigation, RSS, Corrections, scheduling, search, SEO, caching, and global-player integration.

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
