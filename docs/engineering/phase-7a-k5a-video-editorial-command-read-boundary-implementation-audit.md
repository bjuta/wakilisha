# Phase 7A K5A Video Editorial Command and Admin Read Boundary Implementation Audit

Status: PREVIEW ACCEPTED, AWAITING PROTECTED CI

Date: 30 August 2026

## Accepted base

Protected main:

`bd5cb925985c56b8e9f006c7b5b8151073cfe3d2`

Production baseline at preview creation:

- migration count: `65`
- head: `20260830082941_phase_7a_post_kernel_business_logic_and_historical_event_hardening`

K5A repository branch:

`phase-7a-k5a-video-editorial-command-read-boundary`

Current branch head when this audit was written:

`e45188dd4840d8c256293895d160415d0927fab0`

## Preview

Disposable Supabase branch:

- branch id: `8640a8df-fc38-4370-baad-dccfe5c1c44b`
- project ref: `rlgutjvtrcupuewemdxz`
- branch name: `phase-7a-k5a-video-editorial-command-read-boundary`
- baseline replay: PASS
- baseline migration count: `65`
- baseline head: `20260830082941`

K5A migration applied on preview:

`20260830094459_phase_7a_k5a_video_editorial_command_read_boundary`

Preview migration count after K5A:

`66`

The repository migration filename was aligned to the preview migration identity before PR. SQL content remained byte-identical to the transactionally rehearsed candidate.

Sealed migration Git blob:

`35277c0cef879509ee0dc1f5d48c814da85883b2`

## Transactional rehearsal

The complete K5A migration was compiled twice against production in a transaction with terminal rollback before it entered the repository.

Result:

`PHASE_7A_K5A_TRANSACTIONAL_REHEARSAL_PASS`

Production was not mutated.

## Permanent verifier

Verifier:

`scripts/control-plane/verify-phase-7a-k5a-video-editorial-command-read-boundary.sql`

Preview result after migration and again after fixture cleanup:

`PHASE_7A_K5A_VIDEO_EDITORIAL_COMMAND_READ_BOUNDARY_PASS`

Post-cleanup counts:

- Video publications: `0`
- Video sources: `0`
- Video Resource Versions: `0`

## Behavioral proof

A rollback-only authenticated editor fixture proved the governed command/read boundary.

Verified behavior:

1. standalone Video creation
2. provider Video source registration
3. provider source selection
4. valid chapter replacement
5. invalid chapter ordering rejection
6. Video workspace reconstruction for provider-backed Video
7. working Video snapshot through accepted K4B lifecycle authority
8. native exact Video Media source registration
9. native source selection
10. exact active `video_master` Media usage agreement
11. poster attachment through exact governed Media usage
12. transcript attachment through exact governed Media usage
13. English closed-caption attachment
14. non-caption Media rejection for a caption track
15. native Video workspace reconstruction
16. second immutable Video snapshot
17. Video Episode creation against an existing shared Show Episode
18. shared Show and Show Episode workspace reconstruction
19. no independent Video Show or Series authority

Behavioral proof result:

`PHASE_7A_K5A_BEHAVIORAL_FIXTURE_PASS`

Fixture transaction observations before rollback:

- Video publications: `2`
- Video sources: `2`
- active Video Media usages including version-bound copies: `8`
- Video publication versions: `2`
- Video Episode shared links: `1`

Fixture cleanup was automatic through terminal rollback.

Post-rollback preview counts:

- auth users: `0`
- Video publications: `0`
- Video sources: `0`
- Media assets: `0`
- Shows: `0`
- Show Episodes: `0`

## Security boundary

K5A preserves the private `video` schema.

No direct table access is granted to:

- `anon`
- `authenticated`
- `service_role`

Authenticated browser access is through narrow governed `SECURITY DEFINER` RPCs with explicit WAKILISHA capability checks.

Private Video helpers remain non-executable by application roles.

The permanent verifier proves this boundary.

## Media authority

K5A does not require a Video author to possess global Media administration authority.

The Video-scoped Media composition helper authorizes against the Video Resource and then preserves canonical Media behavior:

- current governance validation
- exact Media revision validation
- canonical `media.usage_links`
- canonical `media.events`
- exact stable usage roles
- archive-on-replacement semantics

This avoids granting broad `manage_media_usage` authority merely to edit an owned Video.

## Shared Show authority

Video Episode creation and rebinding use:

- `editorial.shows`
- `editorial.show_episodes`
- `editorial.video_episode_shared_links`

No `video_show`, `video_series`, or equivalent competing authority was added.

K5A therefore supplies real second-domain behavior for the existing shared Show and Show Episode authority.

## Shared lifecycle authority

K5A does not add a Video lifecycle/status ledger.

Existing K4B lifecycle commands remain canonical:

- `snapshot_video_publication_working_version`
- `submit_video_publication_for_review`
- `review_video_publication`
- `publish_video_publication_version`

Workspace reads use shared Resource event authority:

- `editorial.resource_lifecycle_events`
- `editorial.resource_review_events`

## Discovery

Shared Discovery now recognizes:

`video_publication_version`

The TypeScript union and parser both accept the same version type.

No Video taxonomy or SEO authority was created.

## Application service

New facade:

`src/services/video/videoAdminService.ts`

The service:

- is RPC-only
- does not query private Video tables
- resolves exact current Media revisions through `getAdminMediaAssetById`
- uses accepted K4B lifecycle RPCs
- exposes the future Video Editor one typed service boundary

## Primitive impact

K5A is intentionally pre-UI.

No UI primitive was promoted merely because a Video service now exists.

The following remain candidates for second-consumer proof in the Video Editor slice:

- `AdminModeComposer`
- `EditorialCommentEditor`
- `MediaTransport`
- `MediaTimeline`
- `EditorialCreditPicker`

Shared Show and Show Episode authority has now received behavioral second-domain proof at the database command boundary.

Provider-neutral Video Source remains a candidate until reuse outside canonical Video publication justifies wider promotion.

## Supabase advisors

K5A-specific security advisor observations are intentional:

- private Video tables have RLS enabled with no direct policies because application roles have no schema/table access
- authenticated K5A RPCs are `SECURITY DEFINER` by design and perform explicit WAKILISHA authority checks

Reference:

https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable

https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

K5A-specific performance observations are informational foreign-key/index notices on the existing K2 Video schema. K5A does not add new tables or foreign keys.

Reference:

https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys

No advisor result invalidated the K5A authority model.

## Schema types seal

Generated preview TypeScript schema:

- SHA-256: `8aea541cd224628e7a730b40fa8740b865c61d9caf21201a7f578e50c3fa2a51`
- generated `public,editorial` snapshot hash bound to the committed `database.types.ts` file

## Repository execution gate

This execution environment cannot clone GitHub directly, so it cannot truthfully claim a local `npm` run.

The branch includes a dedicated protected-CI gate:

`test/video/phase-7a-k5a-video-editorial-command-read-boundary.test.ts`

The Critical Control Plane workflow invokes that focused test and then the existing critical suites, live-schema checks, and application build.

A PR may open only after this preview acceptance record exists. CI remains the repository execution/build gate.

## Preview disposition

Preview authority is sealed.

Do not promote to production until:

1. protected PR CI is green
2. branch scope remains exact
3. PR is merged
4. production promotion occurs as a separate gate
5. production migration history advances exactly from 65 to 66
6. the merged permanent verifier passes independently on production
7. the disposable preview is deleted after production acceptance

## Exit statement

K5A preview acceptance proves:

> An authenticated WAKILISHA editor can operate and reconstruct complete working Video publication authority through governed commands without direct private-table access, while canonical Media, shared Resource lifecycle, and shared Show Episode authority remain singular.


## Replay contract seal

Replay proof:

`docs/engineering/replay-proofs/20260830094459_phase_7a_k5a_video_editorial_command_read_boundary.sql.json`

Migration SHA-256:

`a921c6c8f2522ce6891eb4a3e8b017e23a00dda1ef88c022e391fca9f383912d`

Committed `public,editorial` database types SHA-256:

`8aea541cd224628e7a730b40fa8740b865c61d9caf21201a7f578e50c3fa2a51`

The new RPC signatures were taken from the preview Supabase generator and spliced into the already sealed `public,editorial` type snapshot. Private `video` schema types remain intentionally outside that repository schema surface.
