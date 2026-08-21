# Phase 6A M4 - Audio Editor Closure

Status: CLOSED

Historical milestone date: 20 August 2026

Final Phase 6A closure: 21 August 2026

## Reconciliation note

M4 closed the internal Audio Editor authority described below. Its original runtime evidence correctly recorded that production was unchanged **at the time of M4 preview acceptance**.

Phase 6A subsequently completed Admin Studio convergence and the Audio Editorial Workbench, promoted the remaining Audio migration to production, activated the exact tested frontend, passed authenticated browser acceptance, and deleted the final disposable preview.

The authoritative final Phase 6A state is now `docs/engineering/phase-6a-closure-record.md`.

Phase 6B is open at `docs/engineering/phase-6b-public-audio-kickoff.md`.

## Purpose

This milestone completed the internal Audio editorial product that sits on top of the M1 identity/version authority, M2 exact master/delivery authority, and M3 Review/publication identity authority.

## Adds

- Canonical Admin Studio Audio index and Audio Editor under `/admin/content/audio`.
- Governed chapter replacement with immutable chapter snapshots on Audio versions.
- Exact Transcript Media attachment using the existing unified Media system and a typed `audio_transcript` usage role.
- Transcript asset/revision identity frozen into immutable Audio versions.
- Transcript Media public-safety revalidation at publication time.
- Narrow Audio adapters over shared `editorial.resource_citations` and `editorial.resource_credits`.
- Immutable Trust copying from working to submitted to approved to published Audio versions.
- Audio working-version Trust revision counters and optimistic concurrency.
- Admin-only read models for Audio list/workspace data while the `audio` schema remains non-exposed.
- Permanent read-only verifier for the complete internal Phase 6A Audio authority.

## Preserves

- Generic `public.attach_media_usage` remains closed and unchanged.
- Generic `media.validate_usage_target` remains closed and unchanged.
- Article-only generic Resource version pointer columns remain null for Audio.
- Existing Article and Playlist Trust tables remain the canonical Citation/Credit system.
- M3 stable GUID and enclosure identity are unchanged.
- M2 full-length Audio delivery remains the publication source.

## Deliberately deferred to Phase 6B

- Public show and episode routes.
- Public Audio playback and transcript navigation.
- RSS XML generation/delivery.
- Public Corrections presentation and scheduling.
- Public Audio search, SEO, caching, and read models.
- Global-player integration.

These remain Phase 6B scope and are no longer described as a future unnamed phase.

## M4 acceptance

M4 acceptance required a disposable preview replayed from the exact production migration baseline, successful execution of the M4 migration, behavior fixtures covering Chapters + Transcript + Trust + Review/publish immutability, the permanent verifier, Supabase advisors, focused Audio tests, critical suite, and production build. Promotion required exact preview-proven migration bytes.

## Runtime acceptance evidence

Final corrected M4 migration SHA-256:

`d0319fcac2a7c826e33023d449425eb7de4775d70cfb20ff1c57aeeaf9ddadd4`

A fresh disposable production-equivalent preview was created from accepted M3 main and verified at migration head `20260820160500` before M4 applied.

Corrected M4 then applied once at migration `20260820180000`.

Runtime acceptance exercised the actual authenticated administrator command path inside one transaction that ended with `ROLLBACK`. It proved:

- Audio publication creation through the governed command path
- exact Transcript Media asset and revision attachment
- Chapter replacement with ordered start times
- shared Citation attachment through the Audio version Trust adapter
- shared Credit attachment through the Audio version Trust adapter
- creation of a new immutable working Audio version after content changes
- frozen Transcript Media identity on the new working version
- frozen Chapters on the new working version
- copied Citation and Credit attachments on the new working version
- copied Citation and Credit Trust revision numbers
- canonical admin Audio workspace reading the accepted state
- anonymous execution remained closed on M4 editor mutation RPCs
- an authenticated user without Audio authority could not read the admin Audio workspace
- Article-only generic Resource version pointers remained null for Audio

The behavioral fixture initially exposed an actual PL/pgSQL ambiguity in M4. The affected runtime queries were corrected by qualifying `publication_id`, `publication_version_id`, `citation_revision`, and `credit_revision` references with explicit table aliases. The focused M4 contract remained green after that correction.

Post-rollback residue was verified as zero for Audio publications, Media assets, Citations, Credits, and command receipts.

The disposable preview used for M4 runtime acceptance was deleted after verification. Production was unchanged by that preview exercise.

## Final disposition

M4 is closed and should not be reopened for public Audio work.

The later Audio Editorial Workbench is also closed in production. Phase 6B now owns public Audio delivery, RSS XML, public playback, transcript navigation, public search delivery, scheduling, SEO, Corrections presentation, and the remaining Phase 6 exit gate.
