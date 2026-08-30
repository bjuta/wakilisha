# Phase 7A K5E Real Video Media Governance Boundary Implementation Audit

Status: LOCAL CANDIDATE — REAL EXIT-GATE GAP PROVED IN PRODUCTION

Date: 30 August 2026

Accepted base:

`6fc86e38f360372bd394ac68b9603e8ce7e0b354`

Production baseline:

- migrations: `69`
- head: `20260830144945_phase_7a_k5d_video_correction_provenance_convergence`
- K5D: closed
- disposable previews: none

## Real production failure

The Phase 7A real Video exit-gate instrument uses:

`Monday Morning in September`

Publication id:

`114618c2-2246-4503-9202-4a6631159d96`

The real source file `IMG_0133.MOV` uploaded successfully through the governed resumable Media path.

Accepted uploaded Media identity:

- asset id: `f35f5416-920a-45f1-995b-65492a48a144`
- current revision: `678e502b-c049-4b1b-81b1-08d4399868ff`
- file verification: `verified`
- MIME: `video/quicktime`
- bytes: `34974764`
- delivery processing: ready in the rendered picker

The native Video source selection then failed with:

`Current Media governance does not permit this Video usage.`

No Video source was selected and no Video version was created.

## Diagnosis

K5A's private `video.assert_exact_media_revision` currently combines two separate decisions:

1. exact verified Media eligibility for mutable working composition
2. public-use rights, consent, protection, retention, embargo, and safety clearance

That means a newly uploaded verified internal master cannot even be attached to a draft Video until it is already cleared for public publication.

The K4B lifecycle already owns the correct public gate through:

- `video.assert_publishable_media_revision`
- `video.assert_publishable_publication_version`
- `public.publish_video_publication_version`

Audio also separates working composition from public review/publication readiness.

The real Video exercise therefore exposed a business-logic boundary bug, not a bad upload.

## Bounded K5E scope

K5E:

- makes `video.assert_exact_media_revision` enforce exact identity, active lifecycle, expected Media kind, and verified immutable bytes only
- preserves all public governance enforcement in the existing K4B publish boundary
- exposes one governed current Media governance read for reviewers
- reuses existing `public.create_media_governance_version` as the only write authority
- surfaces canonical governance review in the existing Media editor
- keeps Video Editor as a consumer of canonical Media rather than creating Video-owned rights/governance state

K5E does not:

- auto-approve user uploads
- infer copyright ownership
- infer consent
- weaken publish-time Media governance
- create Video-owned governance tables
- create a second Media editor
- promote a new interaction primitive
- publish the real Video by itself

## Primitive impact

No primitive promotion.

This is shared authority reuse plus a missing canonical Media control surface.

## Acceptance path

1. focused static contract
2. exact changed-file review
3. one fresh disposable preview from production 69
4. baseline replay proof
5. K5E migration apply
6. permanent verifier
7. rollback-only behavior proving internal verified Media passes working exactness while public publishability remains blocked
8. governed Media governance read/write proof
9. advisors
10. generated TypeScript schema seal
11. focused + critical + build gates
12. PR / protected CI
13. merge
14. separate production SQL promotion
15. production verifier
16. exact-main frontend activation
17. retry the same uploaded `IMG_0133.MOV` through native source selection
18. create the first real immutable working Video snapshot

## Deployment classification

- SQL migration needed: Yes
- Supabase Edge Function deploy needed: No
- Readdy Finish update needed: No
- frontend deploy needed: Yes, after production SQL acceptance
- production content mutation before acceptance: No additional mutation
