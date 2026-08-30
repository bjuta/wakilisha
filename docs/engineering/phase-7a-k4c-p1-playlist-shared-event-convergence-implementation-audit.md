# Phase 7A K4C-P1: Playlist Shared-Event Convergence Implementation Audit

## Current-state reconciliation — 30 August 2026

**The kernel movement described in this document is closed.**

Current authority is recorded in
`docs/engineering/phase-7a-kernel-closure-record.md`.

The accepted kernel baseline is production **64/AR3**:
`20260830070752_phase_7a_k4c_ar3_article_cross_system_reader_convergence_typed_event_retirement`.

Playlist and Audio typed lifecycle pointer compatibility is physically retired.
Playlist/Audio typed event writers are retired.
Article typed lifecycle readers/writers are retired.
Video uses the shared Resource kernel directly and has no typed lifecycle/review ledger.

A bounded post-kernel hardening candidate at commit
`79b26e4c8db83fe178459c4c497c8fbc8714bb2b`
repairs two separately tracked business-logic defects and freezes retained typed
event tables as inaccessible historical evidence. It does **not** reopen this
kernel milestone.

Any older `Status`, `Current boundary`, `Next test`, production migration
count, or preview instruction below is historical evidence for that checkpoint,
not the current programme state.


Status: IMPLEMENTATION CANDIDATE

Opened: 27 August 2026

Accepted main at implementation open:

`062985fb4dd0a67af688ee43285c67ddb4672574`

Accepted production migration head at implementation open:

`20260827125306_phase_7a_k4b_video_governed_lifecycle_commands`

Accepted production migration count at implementation open:

`55`

Design authority:

`docs/engineering/phase-7a-k4c-playlist-command-convergence-design.md`

## Scope

K4C-P1 retires Playlist typed review/lifecycle tables as new-write authority without deleting their historical rows or removing K1 lifecycle-pointer compatibility.

The implementation candidate:

- introduces internal shared Resource lifecycle/review append helpers;
- catches up any Playlist typed events written after the K4A backfill;
- moves Playlist submit to shared Resource lifecycle + review history;
- moves Playlist review decisions to shared Resource review history and lifecycle history where the transition is durable;
- routes the existing Playlist lifecycle append helper to shared Resource lifecycle history;
- moves rewritten submit/review/workspace paths to canonical Resource lifecycle pointers;
- moves Playlist content fingerprinting to the canonical Resource working pointer;
- preserves existing Playlist RPC signatures and browser JSON shape;
- explicitly preserves the accepted production RPC ACL perimeter;
- retains typed Playlist event tables as historical compatibility stores;
- leaves full Playlist pointer-writer retirement to K4C-P2 and pointer-column retirement to K4C-P3.

## Production evidence before implementation

At K4C-P1 open:

- typed Playlist review rows: 5
- typed Playlist lifecycle rows: 2
- typed Playlist review rows missing from K4A shared history: 0
- typed Playlist lifecycle rows missing from K4A shared history: 0
- latest typed Playlist review event: 2026-08-11T13:46:37.724538+00:00
- latest typed Playlist lifecycle event: 2026-08-11T13:48:23.488948+00:00
- Playlist Resource/typed pointer parity drift: 0
- production remained 55 migrations at K4B.

## Candidate construction

The WIP SQL candidate was constructed mechanically from accepted repository/live function bodies rather than reimplementing Playlist semantics from memory.

Sources:

- `submit_playlist_for_review` from the accepted Phase 5B published-update review migration;
- `review_playlist` from the accepted Phase 5A review lifecycle migration;
- `get_playlist_review_workspace` and `append_playlist_lifecycle_event` from the accepted Phase 5B lifecycle parity migration;
- `playlist_current_content_fingerprint` from the accepted Rich Editorial Canonical Primitives migration.

Guarded substitutions fail if expected source snippets are missing or ambiguous.

Current WIP candidate:

`docs/engineering/work-in-progress/phase-7a-k4c-p1-playlist-shared-event-convergence.sql`

The WIP path is temporary. The canonical migration filename must be minted through `supabase migration new` before replay seal.

## Shared Resource append helpers

The candidate introduces:

- `editorial.append_resource_lifecycle_event`
- `editorial.append_resource_review_event`

Both are:

- SECURITY DEFINER;
- fixed-search-path;
- non-executable by PUBLIC, anon, authenticated, and service_role directly;
- Resource-row locking before event-number allocation;
- command-receipt and correlation bound;
- idempotent against the K4A receipt uniqueness contract;
- semantic-identity checking on replay.

They write only K4A shared Resource ledgers.

## Compatibility catch-up

Before writer convergence, P1 imports any typed Playlist events that appeared after K4A and remain unmapped.

The catch-up:

- preserves source UUID as canonical event UUID;
- preserves exact source Resource / Resource Version identity;
- preserves action, status, note/reason, metadata, actor, receipt, correlation where historically present, and timestamp;
- records exact `legacy_source_authority` and `legacy_source_event_id`;
- appends deterministic canonical event numbers after existing shared history;
- never mutates the source typed event row.

Current production requires zero catch-up rows, but the migration remains safe against compatibility-window drift.

## Playlist submit convergence

`public.submit_playlist_for_review` keeps its accepted business rules and return contract.

Authority changes only:

- locks and consumes the canonical Resource row;
- reads current working/published position from Resource pointers;
- moves submitted/approved Resource pointers directly;
- records shared lifecycle `submitted`;
- records shared review `submitted`;
- uses one command correlation across both events;
- writes no typed Playlist event.

K1 reverse synchronization keeps typed pointer mirrors equal until K4C-P3.

## Playlist review convergence

`public.review_playlist` preserves:

- `start_review`
- `request_changes`
- `approve`

It now targets the exact canonical Resource submitted pointer.

Event semantics:

- start review -> shared review `review_started` only;
- request changes -> shared review + shared lifecycle `changes_requested`;
- approve -> shared review + shared lifecycle `approved`.

Approval/changes move canonical Resource approved position.

## Playlist lifecycle adapter

The existing internal signature `editorial.append_playlist_lifecycle_event` remains for untouched Playlist publication commands.

Its implementation now:

- validates Playlist Resource binding;
- resolves correlation from explicit metadata or command receipt request/result payload;
- fails closed if correlation identity cannot be established;
- writes through the shared Resource lifecycle helper;
- returns the canonical shared event UUID;
- never writes `editorial.playlist_lifecycle_events`.

This converges schedule/publish/unpublish/archive/restore history without rewriting those business commands in P1.

## Workspace and fingerprint

`public.get_playlist_review_workspace` now reads:

- shared Resource review history;
- shared Resource lifecycle history;
- canonical Resource current pointers.

Its existing JSON keys remain unchanged.

`editorial.playlist_current_content_fingerprint` now consumes the canonical Resource working pointer while retaining the typed Playlist binding only for stable Resource identity.

## Public RPC execution perimeter

The disposable replay branch exposed a replay-only security drift: after function replacement, Supabase advisors reported anonymous EXECUTE on:

- `submit_playlist_for_review`
- `review_playlist`
- `get_playlist_review_workspace`

Production already had the intended stricter ACL:

- PUBLIC: no execute
- anon: no execute
- authenticated: execute
- service_role: execute

The candidate now applies that production perimeter explicitly and verifies it migration-locally and permanently.

After the ACL repair, K4C-P1-relevant sandbox security-advisor findings match production exactly: only the intentional authenticated SECURITY DEFINER warnings remain for the three browser RPCs.

No K4C-P1-relevant performance-advisor findings were reported.

## Disposable sandbox proof

Sandbox branch:

- branch ID: `f2e4c612-dcf2-467a-ad4e-58ba5c6a86d8`
- preview project ref: `huxyudabwpwzeewlcfjy`
- persistent: false
- production data copied: false
- hourly price confirmed: $0.01344

Baseline replay:

- migration count: 55
- head: `20260827125306_phase_7a_k4b_video_governed_lifecycle_commands`
- status: healthy
- baseline repair required: no

The exact WIP candidate applied successfully in one migration transaction.

Independent structural proof after apply:

- live typed Playlist event writers: 0
- submit uses shared event authority: true
- review uses shared event authority: true
- workspace uses shared Resource history: true
- Playlist pointer parity drift: 0
- typed compatibility rows unmapped: 0

The branch has no copied production rows, so typed/shared Playlist event row counts are naturally zero there before fixtures.

## Rollback-only governed review proof

A synthetic authenticated Editor actor and a minimal active Registry Track were created inside a transaction using the repository's accepted Auth fixture pattern.

The proof exercised:

1. governed Playlist create
2. governed Registry Track add
3. immutable working snapshot
4. submit
5. shared lifecycle submitted
6. shared review submitted
7. identical idempotent submit replay
8. start review
9. shared review_started with no lifecycle event
10. request changes with required reason
11. shared review + lifecycle changes_requested
12. governed metadata edit
13. new working snapshot
14. resubmit immutable revised state
15. approve exact revised submitted version
16. shared review + lifecycle approved
17. canonical Resource submitted/approved pointers
18. K1 typed pointer mirror parity
19. review workspace shared-history composition
20. zero typed Playlist event growth

A deliberately invalid first resubmit attempt was rejected by the pre-existing immutable Playlist Trust rule because unchanged working content reused an older source-authority revision. No residue remained. The corrected proof performed a real governed edit and new working snapshot before resubmit, preserving the accepted Trust invariant.

Expected review sequence proved:

- submitted
- review_started
- changes_requested
- submitted
- approved

Expected lifecycle sequence proved:

- submitted
- changes_requested
- submitted
- approved

All fixture state rolled back.

## Rollback-only publication adapter proof

A second independent transaction proved the untouched publication commands through the rerouted lifecycle helper:

1. approved Playlist
2. schedule
3. unschedule
4. publish
5. unpublish
6. archive
7. restore

Canonical lifecycle sequence proved:

- submitted
- approved
- scheduled
- unscheduled
- published
- unpublished
- archived
- restored

All schedule/publish/archive-family shared lifecycle events retained non-null command receipt and correlation identity.

Typed Playlist review/lifecycle row counts did not increase.

All fixture state rolled back.

## Residue

Independent post-fixture checks found zero:

- fixture auth users
- fixture role assignments
- fixture Registry tracks
- fixture Playlists
- fixture command receipts
- fixture shared review events
- fixture shared lifecycle events

## Security and performance

Sandbox advisors after K4C-P1 proof:

- K4C-P1 performance findings: none
- anonymous SECURITY DEFINER execution for touched RPCs: closed
- remaining authenticated SECURITY DEFINER warnings for the three public Playlist RPCs: identical to production and intentional browser boundaries with internal authentication/capability checks
- shared append helpers: no application-role EXECUTE

Unrelated pre-existing advisor findings are not part of K4C-P1.

## Canonical preview seal

The native migration is:

`supabase/migrations/20260827165416_phase_7a_k4c_p1_playlist_shared_event_convergence.sql`

Migration SHA-256:

`ff1dbaaf1c19f1932af67ba5e4e98df6f601d4180a25e1cdf43d0e5303ef0b53`

Canonical disposable preview:

- project ref: `lejttbbzasfkkrqdsguy`
- branch id: `8b833072-befc-4792-b2db-015f9ad537ae`
- baseline migration count: 55
- baseline head: `20260827125306_phase_7a_k4b_video_governed_lifecycle_commands`
- baseline K4B permanent verifier: PASS
- post-apply migration count: 56
- post-apply head: `20260827165416_phase_7a_k4c_p1_playlist_shared_event_convergence`
- zero pending after native apply: PASS
- K4C-P1 permanent verifier: PASS
- governed review lifecycle rollback proof: PASS
- publication adapter rollback proof: PASS
- fixture residue: 0
- Playlist pointer parity drift: 0
- K4C-P1 performance advisor findings: 0
- touched RPC anonymous execution: closed
- remaining authenticated SECURITY DEFINER warnings: expected and identical to production

The canonical replay-proof artifact and preview-sealed schema/types are generated from that exact preview authority before commit.

## Final local gates

The final candidate passes:

- focused K4C-P1 contract
- K1/K4A/K4B Phase 7 ratchets
- Primitive Compounding
- critical control-plane suite
- app build
- forward-only production migration-history verification
- preview-sealed repository schema verification
- exact migration byte identity

An unrelated accepted-main Playlist admin UI test still expects the literal `Start Review` while accepted main renders `Open Review`. K4C-P1 does not touch that UI or baseline test and does not fold that pre-existing mismatch into this milestone.

## Deployment boundary

Current candidate phase:

- SQL migration needed: Yes, canonical K4C-P1 migration ready for PR
- canonical migration filename minted: Yes
- Supabase Edge Function deploy needed: No
- Readdy Finish update needed: No
- frontend deploy needed: No
- production mutation: No
- PR ready: Yes after exact-scope commit and push

Production remains untouched until protected CI merges the exact candidate and a separate production SQL promotion gate is run.
