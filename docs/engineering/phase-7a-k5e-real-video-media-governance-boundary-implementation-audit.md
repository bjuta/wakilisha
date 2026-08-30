# Phase 7A K5E Real Video Media Governance Boundary Implementation Audit

Status: PRODUCTION AUTHORITY ACCEPTED — MIGRATION-HISTORY PARITY PR PENDING

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

PR #746 protected Critical Control Plane run #687 passed.

Accepted implementation main:

`ee902c6b06ee096b624f0a1fd778a06786deebb5`

## Production promotion

The accepted K5E Supabase preview was merged separately into production after PR #746 merged.

Production advanced exactly:

- migration count: `69 -> 70`
- prior head: `20260830144945_phase_7a_k5d_video_correction_provenance_convergence`
- accepted head: `20260830163814_phase_7a_k5e_real_video_media_governance_boundary`

Independent production verifier:

`PHASE_7A_K5E_REAL_VIDEO_MEDIA_GOVERNANCE_BOUNDARY_PASS`

Production K5E-specific advisor disposition remains clean:

- Security Advisor: no K5E-specific finding
- Performance Advisor: no K5E-specific finding

The production schema now matches the accepted preview authority. No frontend has been activated yet.

## Production schema seal

The repository TypeScript schema remains the accepted `public,editorial` snapshot with only the K5E RPC delta.

Production schema baseline:

- project ref: `pgzizndxdyhqmtyywjmt`
- migration count: `70`
- migration head: `20260830163814`
- TypeScript schema SHA-256: `97cd758416514afcf6b0e4f9bb140c2012074af4d38905ff5f4eae3cb80d17ce`

The first production-seal CI run correctly stopped because the K5E RPC type signature had the right semantics but the wrong native generator position/format. The repair moved only `get_media_asset_governance_admin(uuid)` to the exact generated location and shape. No SQL or runtime authority changed.

Production schema-seal PR #747 merged after protected Critical Control Plane #693 passed live schema/migration drift and the complete application build.

## Exact-main frontend activation

Accepted frontend main:

`eca91f58ed7b5aee000e01c1b2942177016e85e7`

Accepted production build:

- index SHA-256: `a88b96f32af01d33a882cd8a687b5d52bbeb8565d67c14e3c7faa3fbe5293fc8`
- entry: `assets/index-CSjTEG7Y.js`
- entry SHA-256: `a320700cb93b6813f14ac58e6b4f44b10c9dce64a4b9d09725a407e388a04329`
- CSS: `assets/index-BInaPbmW.css`
- CSS SHA-256: `3206bff9cb7fa3148d8146d28a0bf4fda025575e19a51f4ea0d01c324cfbf8d9`
- files: `4477`
- protected critical suite: `259 / 259` PASS
- K5B composition regression suite: `9 / 9` PASS
- production build: PASS
- remote checksum parity: PASS
- HTTPS home and Video Admin: `200`

The reused deployment runner retained historical K5B/K5C/K5D display labels. The exact deployment identity was the accepted K5E main above and the outer K5E wrapper completed successfully.

## Second real rendered failure

The same existing uploaded Media asset was selected again after K5E frontend activation. No duplicate upload was performed.

The rendered Video Editor then failed with a different message:

`Current Media governance does not permit the native Video source.`

That message originates from the older K2 `video.enforce_source_integrity()` trigger on `video.sources`.

The first K5E migration correctly removed premature public-governance checks from `video.assert_exact_media_revision`, but K2 still duplicated the same public-use decision at source-row insertion time.

The failed second attempt also left no partial Video authority:

- selected source: null
- current working version: null
- Video version count: 0
- active working `video_master` usage count: 0

The real Media remains active, verified, revision 1, and internal-only governance version 1.

## K5E native source integrity follow-through

This is the same K5E business-logic boundary, not a new generic Video milestone.

The follow-through changes only `video.enforce_source_integrity()` so native source registration requires:

- active Media asset
- asset kind `video`
- exact revision belongs to that asset
- exact revision's file object is verified

Public-use rights, consent, source protection, retention, embargo, and public safety remain enforced by the unchanged K4B publication gate.

No frontend change is required for this follow-through.

## Native source follow-through preview acceptance

Accepted follow-through migration:

`20260830173011_phase_7a_k5e_native_source_integrity_convergence.sql`

Migration SHA-256:

`e922509d9c151b889038112ec479f792184d5d48afba680c389d1cc9569b9f32`

Accepted preview state:

- project ref: `kqmxcluhahxvqjnjggoy`
- branch id: `bc5e0a19-cf27-4940-8aa5-aeeda160e4cd`
- migration count: `71`
- head: `20260830173011_phase_7a_k5e_native_source_integrity_convergence`

Permanent verifier:

`PHASE_7A_K5E_NATIVE_SOURCE_INTEGRITY_CONVERGENCE_PASS`

Permanent verifier SHA-256:

`1eb4b76f2ed0d00ea1d449860b09ac346f835588f98364a5cfc1375e5b031480`

Rollback-only behavior proof:

`PHASE_7A_K5E_NATIVE_SOURCE_INTEGRITY_BEHAVIOR_PASS`

The accepted rollback proof demonstrated:

- one active internal Video Media asset with one exact verified revision can now be inserted as a native Video source
- the same internal-only Media remains blocked by `video.assert_publishable_media_revision`
- no public-use governance gate moved earlier into source registration
- the fixture rolls back completely

The first follow-through fixture attempt stopped safely because the fixture omitted the verification actor required by the existing Media file verification constraint. The corrected fixture added only the required rollback-only actor identity. Runtime code was unchanged.

Advisor disposition:

- no follow-through-specific Security Advisor finding
- no follow-through-specific Performance Advisor finding

Schema/type disposition:

- no browser RPC or TypeScript database surface changes
- committed production `public,editorial` type seal remains unchanged
- preview schema baseline advances only migration count/head to 71 / `20260830173011`

## Follow-through protected CI

Pending.

## Deployment classification

- SQL migration needed: Yes
- Supabase Edge Function deploy needed: No
- Readdy Finish update needed: No
- frontend deploy needed: Yes, after production SQL acceptance
- production content mutation before acceptance: No additional mutation


## Production follow-through promotion

PR #748 passed protected Critical Control Plane #695 and merged at:

`b4415ddd59f987f1c221c1e515cefd4c0a7f2675`

The accepted preview merge recorded production migration `20260830173011`, but the first independent production verifier still saw the older K2 source-integrity body. A subsequent direct production application of the already-accepted K5E follow-through body corrected the live function and recorded a second migration-history timestamp:

`20260830173552_phase_7a_k5e_native_source_integrity_convergence`

Production then had:

- migration count: `72`
- migration head: `20260830173552`
- `video.enforce_source_integrity()`: converged
- permanent K5E native-source verifier: PASS

No user content was mutated by either production promotion step.

The second timestamp is a migration-history duplication of the same idempotent `CREATE OR REPLACE FUNCTION` authority. It created no duplicate table, trigger, function, policy, or application authority.

## Migration-history parity repair

Production history cannot be left ahead of repository history.

The repository therefore records:

`20260830173552_phase_7a_k5e_native_source_integrity_convergence.sql`

as an intentional no-op parity migration. Fresh replay applies the real authority once at `20260830173011`; the later parity timestamp does nothing because the production second application did not change the final schema beyond reapplying the same function body.

The existing paid K5E preview was reset to exact production history through `20260830173552` and reverified:

`PHASE_7A_K5E_NATIVE_SOURCE_INTEGRITY_CONVERGENCE_PASS`

No TypeScript database surface changed. The production `public,editorial` type seal remains:

`97cd758416514afcf6b0e4f9bb140c2012074af4d38905ff5f4eae3cb80d17ce`

No frontend redeploy is required because the follow-through is SQL-only.
