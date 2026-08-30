# Phase 7A Post-Kernel Business Logic and Historical Event Hardening

Status: PREVIEW ACCEPTED — PROTECTED CI AND PRODUCTION PROMOTION PENDING

Opened: 30 August 2026

Repository commit 1:

`79b26e4c8db83fe178459c4c497c8fbc8714bb2b`

Candidate migration:

`20260830082941_phase_7a_post_kernel_business_logic_and_historical_event_hardening.sql`

Kernel closure authority:

`docs/engineering/phase-7a-kernel-closure-record.md`

## Boundary

This is a bounded post-kernel closure pass. It does not reopen Phase 7A kernel convergence and adds no Video product scope.

It addresses:

1. Audio working-snapshot reuse across authority revisions
2. Article correction fingerprint continuity through review-submit/publish
3. stale ACL/policy exposure on retained historical typed event tables
4. mutation freezing for retained historical evidence
5. one final end-state kernel verifier
6. historical classification of earlier K1/P3/A3/AR3 checkpoint verifiers

## Production discovery

At 64/AR3:

- Resource Version authority exists
- shared lifecycle/review event authority exists
- Playlist typed pointer columns: 0
- Audio typed pointer columns: 0
- Video typed pointer columns: 0
- lifecycle pointer sync triggers: 0
- typed Playlist event writers: 0
- typed Audio event writers: 0
- live Article typed lifecycle dependencies: 0
- typed Video event tables: 0

Historical typed tables total only a few hundred kilobytes. The material risk was stale authorization and ambiguity, not storage size.

## Transactional rehearsal

The complete candidate SQL was executed against production inside one transaction with terminal `ROLLBACK`.

Acceptance marker:

`POST_KERNEL_CANDIDATE_TRANSACTIONAL_REHEARSAL_PASS`

Observed repaired function hashes in rehearsal:

- Audio snapshot: `4c0a15dbc5bb64741a6772117dd9981f`
- Article submit: `414fa3d92f21697bf4737a73e5b580bb`

No production mutation was retained.

## Required acceptance

Before production promotion:

1. exact 64/AR3 baseline replay in one disposable preview
2. exact candidate native apply
3. final kernel verifier PASS
4. Audio fixture proving same-content / newer-authority snapshot does not reuse a stale working version
5. Article correction fixture proving correction -> submit -> approve -> publish satisfies correction publication proof without manual fingerprint workaround
6. historical tables reject mutation
7. historical tables expose no app-role ACL/policy
8. all retained historical rows remain mapped to shared canonical history
9. security/performance advisor review
10. replay/schema seal
11. focused + critical + build gates
12. protected PR/CI
13. separate production promotion
14. independent production final-kernel verifier
15. preview cleanup

## Deployment classification

- SQL migration needed: Yes
- Edge Function deploy needed: No
- frontend deploy needed: No
- Readdy Finish update needed: No


## Preview acceptance — 30 August 2026

Preview branch:

- id: `666a8ad3-f939-4f5b-81b2-892a369f875d`
- project ref: `nwtsdoqkggyktyfdjmdd`
- hourly cost: `$0.01344`

Provisioning initially exposed a stale 63/AR2 replay. No candidate SQL was applied in that state. The branch was reset and then proved exact 64/AR3 before candidate application.

Baseline:

- migration count: `64`
- migration head: `20260830070752`
- AR3 checkpoint verifier: PASS

Candidate:

- apply: PASS
- preview migration count after apply: `65`
- Supabase preview-assigned migration version: `20260830084403`
- final-kernel verifier:
  `PHASE_7A_KERNEL_CLOSURE_PASS`

### Audio behavior fixture

A rollback-only governed fixture created a standalone Audio publication with a revision-1 working version, advanced only `authority_revision` to 2, then invoked the real working-snapshot RPC.

Observed:

- revision-1 versions: `1`
- revision-2 versions: `1`
- version identity changed
- `reused_existing_snapshot = false`
- result:
  `AUDIO_REVISION_SAFE_SNAPSHOT_FIXTURE_PASS`

### Article correction continuity fixture

A rollback-only governed Article fixture used the auto-provisioned Article Resource/baseline Version, inserted a correction working Version, then drove normal:

`submit -> approve -> publish`

Observed version kinds:

`baseline, correction, submitted, approved, published`

Distinct content fingerprints across the complete fixture:

`1`

Result:

`ARTICLE_CORRECTION_FINGERPRINT_CONTINUITY_FIXTURE_PASS`

This proves workflow-state changes no longer break corrected editorial content identity.

### Historical event hard freeze

Direct mutation attempts against each retained historical typed event table were rejected by the new freeze trigger.

Result:

`HISTORICAL_EVENT_HARD_FREEZE_FIXTURE_PASS`

Application policy/ACL checks also pass in the final-kernel verifier.

### Types and advisors

Generated TypeScript types:

- preview bytes: `618219`
- production bytes: `618219`
- exact equality: PASS

Advisor review produced no candidate-specific security/performance WARN/ERROR.

The deliberate security posture change is that the historical Playlist review table no longer has an authenticated participant-read policy and retained historical event stores no longer expose app-role data privileges.

## Remaining gates

- protected PR/CI
- merge
- separate production SQL promotion
- independent production final-kernel verification
- production business-logic smoke where safe
- preview deletion after production seal
