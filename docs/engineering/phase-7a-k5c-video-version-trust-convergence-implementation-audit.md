# Phase 7A K5C Video Version Trust Convergence Implementation Audit

Status: PREVIEW ACCEPTED — AWAITING PROTECTED CI

Date: 30 August 2026

Accepted base:

`88988e687f19b9a8e9d00d7a03cf77e59b0c18fe`

Production baseline:

- migrations: `67`
- head: `20260830102151_phase_7a_k5b_video_editor_shared_show_catalog`
- K5B Video Editor Composition: closed and production accepted

## Problem layer

K5B proved the purpose-built Video Editor but deliberately deferred Credits and Citations because Video had no governed exact-version Trust attachment boundary.

The shared Trust identity already exists in:

- `editorial.credits`
- `editorial.citations`
- `editorial.resource_credits`
- `editorial.resource_citations`

Article, Playlist, and Audio already attach those shared identities to exact domain versions through governed commands.

K5C converges Video onto that same authority.

## Bounded scope

K5C adds:

- Video eligibility to the shared Resource Credit/Citation attachment constraints
- optimistic Trust revision metadata for exact Video publication versions
- governed replace commands for the current working Video version
- exact Trust copy authorization into immutable Video history
- Trust preservation when a new working snapshot replaces an older working snapshot
- Trust preservation through submitted, approved, and published Video copies
- governed Video Trust candidate reads
- current working Trust in the existing Video admin workspace read
- Video Trust composition in the existing Video Editor
- genuine second-consumer promotion of `EditorialCreditPicker`

K5C does not add:

- Video-owned Credit identity
- Video-owned Citation identity
- a second Source system
- Corrections
- Registry relationship authoring
- time-anchored review comments
- public Video delivery

## Primitive impact

`EditorialCreditPicker` moves from candidate to canonical only because Video becomes its second real domain consumer after the database authority exists.

Consumers:

- `admin:audio`
- `admin:video`

`EditorialCommentEditor` remains candidate with Audio only.

## Acceptance path

1. repository static contract
2. disposable preview from exact production 67
3. K5C migration
4. rollback-only authenticated Trust fixture
5. permanent verifier
6. security/performance advisors
7. generated TypeScript schema seal
8. migration replay proof
9. protected PR/CI
10. merge
11. separate production promotion 67 -> 68
12. independent production verifier and parity
13. exact merged-main frontend activation
14. authenticated rendered Video Trust smoke
15. closure record and preview deletion

## Deployment classification

- SQL migration needed: Yes
- Supabase Edge Function deploy needed: No
- Readdy Finish update needed: No
- frontend deploy needed: Yes, after database authority is production accepted


## Preview acceptance

Disposable Supabase preview:

- branch id: `841a0cc5-bedf-4845-b8fa-9e226676a9eb`
- project ref: `vlddstensgmaccioldqp`
- branch name: `phase-7a-k5c-video-version-trust-convergence-v2`
- cost: `$0.01344/hour`

The replacement preview initially provisioned a stale 20-migration state despite reporting `FUNCTIONS_DEPLOYED`. It was rebased before K5C was applied. K5C proceeded only after the prestate was exactly 67 migrations with head `20260830102151_phase_7a_k5b_video_editor_shared_show_catalog`.

Accepted K5C migration identity:

`20260830124903_phase_7a_k5c_video_version_trust_convergence`

Migration SHA-256:

`76710d5f6e6ef5ec7899ae4968b4fad00004758cc29d1813ea2ee8139f7a4343`

Preview migration count after K5C: `68`.

Permanent verifier:

`PHASE_7A_K5C_VIDEO_VERSION_TRUST_CONVERGENCE_PASS`

Rollback-only authenticated behavioral proof:

`PHASE_7A_K5C_VIDEO_TRUST_BEHAVIOR_PASS`

The fixture proved governed public-safe Source/Citation and Credit identity, exact working Video Trust replacement, current-workspace reads, copy into a distinct replacement working snapshot, copy into submitted/approved/published immutable versions, and immutable mutation rejection. Each of the five version identities carried one exact Credit and one exact Citation. The fixture ended in `ROLLBACK`.

Post-rollback residue is zero across auth users, Sources, contributors, Video publications/versions, Video Trust revisions, and Video Credit/Citation attachments.

### Advisor disposition

K5C introduces no candidate-specific performance WARN/ERROR.

Security Advisor reports the expected governed-RPC warnings for the three authenticated `SECURITY DEFINER` functions. They are intentionally the capability-checked browser API boundary. Direct private-table authority remains revoked.

The new Trust revision metadata table reports `RLS Enabled No Policy` at INFO by design.

### Schema seal

Committed `public,editorial` TypeScript snapshot SHA-256:

`82cc6bbacce519b62c5c7b5cf0725ddaf4c143f158da422427c2268a6ec7339b`

Schema baseline:

- migration count: `68`
- head: `20260830124903`
- source preview: `vlddstensgmaccioldqp`
- base main: `88988e687f19b9a8e9d00d7a03cf77e59b0c18fe`

Replay proof:

`docs/engineering/replay-proofs/20260830124903_phase_7a_k5c_video_version_trust_convergence.sql.json`

## Preview disposition

Keep the preview alive through protected CI, merge, separate production promotion, independent production verification, production/preview parity, and any required frontend acceptance.

Delete it only after K5C production closure.
