# Phase 7A K5D Video Correction Target + Provenance Convergence Implementation Audit

Status: CANDIDATE — REPOSITORY IMPLEMENTED, PREVIEW ACCEPTANCE PENDING

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
