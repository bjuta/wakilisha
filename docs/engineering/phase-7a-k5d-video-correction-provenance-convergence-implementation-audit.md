# Phase 7A K5D Video Correction Target + Provenance Convergence Implementation Audit

Status: PREVIEW ACCEPTED — AWAITING PROTECTED CI

Date: 30 August 2026

Accepted base:

`413b0a738a60b1bad6ac1d7712c8d7d7200f1d6e`

Production baseline:

- migrations: `68`
- head: `20260830124903_phase_7a_k5c_video_version_trust_convergence`
- K5C Video Version Trust Convergence: closed and production accepted

## Problem layer

The shared Correction case, evidence, decision, event, related-resource, notification, and workspace authority already exists.

The target boundary is still implementation-locked to Article:

- `editorial.correction_targets.target_resource_kind` accepts only `article`
- target versions FK directly to `editorial.article_versions`
- `public.triage_correction_case` validates only current published Articles

That blocks Video from reusing shared Corrections/provenance and ignores the accepted K0 Resource Version kernel.

## Bounded scope

K5D:

- moves Correction target version integrity onto `editorial.resource_versions`
- preserves Article as the first existing consumer
- admits `standalone_video` and `video_episode` only with `video_publication_version`
- keeps typed Article and Video resource-binding validation
- keeps primary targets bound to the exact current published Resource Version
- records the exact target content fingerprint during triage
- exposes a narrow Video correction-provenance read
- composes read-only correction provenance into the existing Video Editor

K5D does not add:

- Video correction application
- public Video correction notes
- Video-owned correction cases/events
- Registry mutation
- rich Video review comments
- public Video product

## Primitive impact

No interaction primitive is promoted in K5D.

The reusable residue is authority convergence: shared Correction targeting moves onto the canonical Resource Version kernel.

`EditorialCommentEditor` remains candidate and Audio-only.

## Acceptance path

1. repository static contract
2. disposable preview from exact production 68
3. K5D migration
4. rollback-only authenticated Video publication + correction-target fixture
5. permanent verifier
6. security/performance advisors
7. generated TypeScript schema seal
8. migration replay proof
9. protected PR/CI
10. merge
11. separate production SQL promotion through the native deployment workflow
12. independent production verifier and parity
13. exact merged-main frontend activation
14. authenticated rendered Video correction-provenance smoke
15. closure record and preview deletion

## Deployment classification

- SQL migration needed: Yes
- Supabase Edge Function deploy needed: No
- Readdy Finish update needed: No
- frontend deploy needed: Yes, after production SQL acceptance


## Preview acceptance

Disposable Supabase preview:

- branch id: `b03fdb3f-834f-4d28-bca1-6a2a0b4e92b0`
- project ref: `npnlsdzjvtnecnxrrdhc`
- branch name: `phase-7a-k5d-video-correction-provenance-convergence`
- cost: `$0.01344/hour`

The branch initially replayed only 21 migrations despite reporting `FUNCTIONS_DEPLOYED`. K5D was not applied to that stale state. The preview was rebased and K5D proceeded only after exact production prestate was proved:

- migration count: `68`
- head: `20260830124903_phase_7a_k5c_video_version_trust_convergence`

Accepted K5D migration identity:

`20260830144945_phase_7a_k5d_video_correction_provenance_convergence`

Migration SHA-256:

`c5d9da12cc6702b92e703b3efae88980385fbcafd10f441af6932c44130f721b`

Preview migration count after K5D: `69`.

Permanent verifier:

`PHASE_7A_K5D_VIDEO_CORRECTION_PROVENANCE_CONVERGENCE_PASS`

Rollback-only authenticated behavior proof:

`PHASE_7A_K5D_VIDEO_CORRECTION_PROVENANCE_BEHAVIOR_PASS`

The fixture proved:

1. canonical standalone Video creation
2. provider-backed Video source selection
3. working, submitted, approved, and published Video Resource Versions
4. shared internal Correction case creation
5. triage against the exact current published Video Resource Version
6. exact target Resource kind and `video_publication_version` pairing
7. challenged-version content fingerprint preserved at triage
8. governed Video correction-provenance read
9. the same provenance composed into the existing Video admin workspace
10. terminal `ROLLBACK`

The first fixture attempt intentionally exposed a private-schema proof mistake: the authenticated fixture tried to read `editorial.resource_versions` directly and received `42501`. The corrected fixture resolves the published fingerprint through the governed Video workspace instead. No failed-fixture residue persisted.

Post-rollback residue is zero across auth users, Video publications/versions, Correction cases/targets, and Video Correction targets.

### Advisor disposition

K5D adds one expected Security Advisor warning: authenticated execution of `public.get_admin_video_correction_provenance(uuid)` as a `SECURITY DEFINER` RPC.

That RPC is intentionally the capability-checked browser read boundary. It separately requires Video visibility and Correction visibility. Direct Correction-table browser authority remains absent.

K5D adds no new performance advisor finding.

### Schema seal

Committed `public,editorial` TypeScript snapshot SHA-256:

`75ae8e38975db6adc9e8239f87b2cc9c7211da1a7ef4ce0e109e17e743eb6a04`

Schema baseline:

- migration count: `69`
- head: `20260830144945`
- source preview: `npnlsdzjvtnecnxrrdhc`
- base main: `413b0a738a60b1bad6ac1d7712c8d7d7200f1d6e`

Replay proof:

`docs/engineering/replay-proofs/20260830144945_phase_7a_k5d_video_correction_provenance_convergence.sql.json`

## Preview disposition

Keep the preview alive through protected CI, merge, separate production promotion, independent production verification, exact-main frontend acceptance, and K5D closure.

Delete it only after production closure merges.
