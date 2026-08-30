# Phase 7A K5E Real Video Media Governance Boundary Implementation Audit

Status: PREVIEW ACCEPTED — AWAITING PROTECTED CI

Date: 30 August 2026

Accepted base:

`6fc86e38f360372bd394ac68b9603e8ce7e0b354`

Production baseline:

- migrations: `69`
- head: `20260830144945_phase_7a_k5d_video_correction_provenance_convergence`
- K5D: closed
- disposable previews before K5E: none

Accepted K5E preview:

- branch id: `bc5e0a19-cf27-4940-8aa5-aeeda160e4cd`
- project ref: `kqmxcluhahxvqjnjggoy`
- branch name: `phase-7a-k5e-real-video-media-governance-boundary`
- cost: `$0.01344/hour`
- accepted preview prestate: `69` migrations
- accepted preview prestate head: `20260830144945_phase_7a_k5d_video_correction_provenance_convergence`

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

## Preview acceptance

Repository migration:

`20260830163814_phase_7a_k5e_real_video_media_governance_boundary.sql`

Migration SHA-256:

`3253a5b4b85cd0e1dc36a9e3a97004b21d9db4e012be90edc5cda477586b6042`

Preview migration result:

- migrations: `70`
- head: `20260830163814_phase_7a_k5e_real_video_media_governance_boundary`
- pending repository migration mismatch: none after aligning the repository filename to the accepted preview history

Permanent verifier:

`PHASE_7A_K5E_REAL_VIDEO_MEDIA_GOVERNANCE_BOUNDARY_PASS`

Permanent verifier SHA-256:

`9edfe6770669fa3662292e1fc30f2bf4ff5947d9bb915e2538b6837839136a35`

Rollback-only behavior proof:

`PHASE_7A_K5E_REAL_VIDEO_MEDIA_GOVERNANCE_BEHAVIOR_PASS`

The rollback proof demonstrated all of the intended separation on one fixture:

- exact active verified internal Video Media passes the working exact-revision guard
- that same internal Media remains blocked by the existing public publishability guard
- the governed current Media governance reader returns the internal state
- the existing canonical `create_media_governance_version` command appends a new public-use governance version
- the same exact Media revision then passes the unchanged public publishability guard
- the entire fixture transaction rolls back

The first proof attempt stopped safely on a wrong fixture storage-provider key. The second stopped safely when forcing all deferred constraints immediate triggered unrelated Person provisioning integrity. The accepted proof corrected only those fixture assumptions and did not change K5E runtime code.

Advisor disposition:

- no K5E-specific Security Advisor finding for `get_media_asset_governance_admin`
- no K5E-specific Performance Advisor finding
- unrelated baseline advisor noise remains outside K5E scope

Schema type seal:

- preview schema: `public,editorial`
- preview TypeScript schema SHA-256: `baab022f1fd3329a77dbeb7cf72e71d9cd418b4f4ba5459d26e57e1ce3db7ae1`
- the connector's unfiltered generator omitted the repository's `editorial` schema surface, so it was not accepted as a whole-file replacement
- the committed seal preserves the accepted 69-migration `public,editorial` snapshot and adds only the newly generated public RPC signature for `get_media_asset_governance_admin(uuid)`

## Protected CI gate

Pending.

## Deployment classification

- SQL migration needed: Yes
- Supabase Edge Function deploy needed: No
- Readdy Finish update needed: No
- frontend deploy needed: Yes, after production SQL acceptance
- production content mutation before acceptance: No additional mutation
