# WAKILISHA Phase Reconciliation Audit

Status: Active project-control record.
Date: 2026-07-18.
Repository baseline: `180aa4a Merge pull request #470 from bjuta/fix/phase-2b-governed-review-closure`.

## Purpose

This audit reconciles the live repository against the governing WAKILISHA project plan before any new implementation work begins.

The governing plan remains:

`docs/institute/two-workspace-pilot-audit-and-build-plan.md`

The root-level `project_plan.md` is stale and is removed by this reconciliation.

## Current Truth

WAKILISHA is not at Phase 0 or Phase 1 anymore.

The repository and production environment have already moved through:

- Phase 0A security perimeter work.
- Phase 0B engineering control plane work.
- Phase 1A resource identity foundation work.
- Phase 1B command, job, and outbox foundation work.
- Phase 2A durable Article versioning work.
- Major Phase 2B review, publication, snapshot, schedule, archive, restore, Edge read, and preview foundation work.

Phase 2B is active. It is not closed.

## Why Phase 2B Is Not Closed

Phase 2B has shipped important foundations:

- Immutable Article versions exist.
- Review lifecycle tables and RPCs exist.
- Publication snapshots exist.
- Public reads use publication snapshots.
- Scheduled publication infrastructure exists.
- Archive and restore infrastructure exists.
- Version-bound preview links exist.
- Production preview renders immutable pending Article content.
- Production SQL, Edge Functions, and frontend are aligned through PR #470.

Phase 2B still has closure gaps:

- The current Article Editor does not expose the full governed reviewer workflow.
- Pending Review should show Request Changes and Approve Version.
- Draft should clearly show Submit for Review.
- Publish should not be the obvious action before approval.
- Publishing must be restricted to an approved immutable version.
- Lifecycle history must be visible in the editor.
- The old Institute Article editor had review affordances that should be preserved as product knowledge, not copied blindly.
- A real Article must complete the full lifecycle in production before Phase 2B closes.
- Public published pages must be checked after later draft edits to prove they do not change silently.

## Phase Status

| Phase | Status | Evidence |
|---|---|---|
| Phase 0A | Closed | Security perimeter closure record and merged PR #452 |
| Phase 0B | Closed | Engineering control plane record and merged PR #453 |
| Phase 1A | Closed | Resource identity audit and merged PR #457 |
| Phase 1B | Closed | Command, job, and outbox audit plus merged PRs #458 and #459 |
| Phase 2A | Closed | Phase 1B | Closed | Command, job, and outbox audit plus merged PRs #458 and #459 |
| Phase 2A | Closed | Durable Article versioning closure record and production editor proof |
| Phase 2B | Active | PRs #467, #469, and #470 shipped foundations, but governed review closure remains |
| Phase 3 | Blocked | Starts only after Phase 2B closure |
| Phase 4 to Phase 12 | Blocked | Remain governed by the long-range plan |

## Stale Planning Documents

Removed:

- `project_plan.md`

Reason:

The root plan represented an older June release backlog. It now competes with the governing five-year WAKILISHA editorial production plan and can mislead agents into reopening completed work or starting the wrong next phase.

Kept:

- `docs/institute/two-workspace-pilot-audit-and-build-plan.md`

Reason:

It remains the governing plan, but this reconciliation updates stale sections so it points to the real next implementation.

## Next Implementation

The next implementation is not Phase 3.

The next implementation is:

**Phase 2B governed review closure.**

Scope:

- Restore the missing reviewer-facing workflow in the current Article Editor.
- Use the old Institute Article editor as evidence of product behavior, not as a target architecture.
- Add Request Changes and Approve Version controls for Pending Review.
- Make Submit for Review clear for Draft.
- Restrict Publish to approved versions.
- Show lifecycle history.
- Run a full production lifecycle smoke with one real Article.

## Non-Goals For The Next PR

Do not touch:

- Phase 3 trust infrastructure.
- Playlist.
- Audio.
- Video.
- Media platform redesign.
- Registry or Charts consolidation.
- Inquiry Mode.
- Public Article visual layout except where preview or lifecycle status requires it.
- Existing publication snapshots, except for verification.

## Closure Rule

Phase 2B can close only when a real Article proves the full lifecycle in production:

Draft, submit for review, request changes, revise, submit again, approve, publish, edit later draft, verify public published page remains unchanged, archive, and restore.
