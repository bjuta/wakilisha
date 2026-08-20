# WAKILISHA Programme Status

Status date: 20 August 2026

Repository baseline reconciled: `5aa54cf445693e403d50e90f51dc2e3609498b3e`

## Status authority

This file is the current status overlay for `docs/institute/two-workspace-pilot-audit-and-build-plan.md`.

The long-form plan remains the architectural, product-doctrine, phase-scope, engineering-rule, and five-year durability authority.

Where the long-form plan's **current phase**, **immediate next implementation**, or **completion status** conflicts with this file, use this file. The long-form plan was last reconciled before the Phase 5B real-work acceptance sequence and therefore understates the programme's actual progress.

The compact navigation view is `docs/roadmap/wakilisha-master-programme-map.md`.

## Current numbered phase

**Phase 6: Audio**

Phases 0 through 5 are complete.

## Phase 5 closure

### Phase 5A: Canonical Playlist authority

Complete through PR #587 and PR #588.

### Phase 5B: Public Playlist product

Complete through the production acceptance sequence that followed the initial Phase 5B product shipment.

Evidence:

- PR #590 shipped the public Playlist product and recorded production acceptance for the first public surface and Registry contribution path.
- PR #591 seeded the first real Phase 5B Playlist intake.
- PR #592 completed the first Playlist Registry canonicalization.
- PR #593 recorded the first real governed publication of `Top 50 Kenyan Songs Of 2025`.
- The PR #593 verifier required exact published state, submitted, approved, and published immutable versions, durable review events, a durable publication snapshot, 50 public tracks, 50 playable tracks, 50 artist-linked tracks, 50 Registry-linked tracks, and 50 editor notes.
- PR #597 added Playlist editorial lifecycle parity.
- PR #598 added exact version-bound Playlist Preview.
- PR #599 proved published-update review continuity and recorded production acceptance through published Version 8.

The Phase 5 programme exit gate was:

> one real Playlist is reviewed and published end to end

That gate is satisfied.

## Work completed after Phase 5

After the Playlist exit gate, the project naturally moved through adjacent product and platform work before returning to the numbered programme.

That work included:

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

This work is recorded in `docs/roadmap/post-phase-5-interlude-ledger.md`.

It is part of the accepted platform baseline. It does not need to be retrofitted into a new numbered phase.

## Immediate numbered programme work

The next numbered programme phase is Phase 6 Audio.

The next engineering activity should begin with a diagnostic against the current codebase before assuming the original Phase 6 scope still maps one-to-one onto present implementation.

Audit:

- current Audio tables, routes, services, and admin surfaces
- Media audio ingest, preservation masters, derivatives, transcripts, and captions
- global player capabilities and Audio-specific gaps
- Resource identity support for shows, seasons, episodes, and standalone Audio
- Review lifecycle reuse
- Sources, Citations, Credits, Corrections, and provenance reuse
- command, receipt, job, outbox, and concurrency support
- RSS or feed infrastructure
- stable GUID and enclosure identity
- public read models
- search and SEO integration

The diagnostic should determine the smallest honest PR 6A slice.

## Programme continuity

The roadmap is an orientation tool, not a prohibition on detours.

If building Phase 6 exposes adjacent work that is better solved first, that work can be done. When it settles, reconcile the map so the project continues with a shared understanding of what changed and what remains.

## Deployment state of this status correction

- SQL migration needed: No
- Supabase Edge Function deployment needed: No
- frontend deployment needed: No
- Readdy Finish update needed: No
- production runtime change needed: No
