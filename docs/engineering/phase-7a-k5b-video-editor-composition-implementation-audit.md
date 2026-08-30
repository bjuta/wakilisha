# Phase 7A K5B Video Editor Composition Implementation Audit

Status: PREVIEW ACCEPTED, AWAITING PROTECTED CI

Date: 30 August 2026

## Accepted base

Protected main:

`ccc25f7dd5c3b9887a6488819d03ea424ba19f4a`

Production baseline at K5B open:

- migration count: `66`
- head: `20260830094459_phase_7a_k5a_video_editorial_command_read_boundary`
- K5A command/admin-read boundary: production accepted

K5B branch:

`phase-7a-k5b-video-editor-composition`

## Problem layer

K5B is primarily a frontend/admin product-composition milestone.

It does not reopen:

- Resource identity
- Resource lifecycle
- Resource review-event authority
- canonical Media authority
- canonical Show / Show Episode authority
- K4B Video lifecycle commands

One bounded read-boundary gap was discovered during composition: K5A could bind a Video Episode to an existing shared Show Episode, but the governed Video admin index did not expose available shared Shows and Show Episodes for the UI to select.

K5B therefore adds one narrow `CREATE OR REPLACE` migration for the existing Video admin index.

## Disposable preview

Supabase preview:

- branch id: `f3f49379-2c6e-4b13-b769-dc8890baee42`
- project ref: `hmgmvxzbxrksrbcibwiw`
- branch name: `phase-7a-k5b-video-editor-composition`

Baseline replay:

- result: PASS
- baseline migration count: `66`
- baseline head: `20260830094459`

K5B migration:

`20260830102151_phase_7a_k5b_video_editor_shared_show_catalog`

Preview migration count after K5B:

`67`

Migration SHA-256:

`20481ae632785b419cc05a21f067be7376a50f5a64835f5a10f4c0cb99a80883`

The repository filename is aligned to the migration identity recorded by the accepted preview.

## K5B shared Show catalog

The existing governed RPC:

`public.list_admin_video_publications()`

now also returns canonical:

- `editorial.shows`
- `editorial.show_episodes`

Show Episode entries include the current `video_publication_id` when already bound through:

`editorial.video_episode_shared_links`

This allows the Video collection to offer only unbound shared Show Episodes without direct table reads and without creating a competing Video series model.

No new table, schema, role, capability, lifecycle ledger, Show authority, or Video-owned series authority was introduced.

## Permanent verifier

Verifier:

`scripts/control-plane/verify-phase-7a-k5b-video-editor-shared-show-catalog.sql`

Result:

`PHASE_7A_K5B_VIDEO_EDITOR_SHARED_SHOW_CATALOG_PASS`

The verifier is transactionally read-only.

## Behavioral proof

A rollback-only authenticated editor fixture proved the complete shared-identity selection path:

1. create a canonical shared Show fixture
2. create a canonical shared Show Episode fixture
3. call the governed Video admin index
4. confirm the Episode is visible and unbound
5. create a Video Episode through `create_video_publication`
6. call the governed Video admin index again
7. confirm the Video publication resolves the same shared Show / Show Episode identity
8. confirm the Show Episode catalog now reports the bound Video publication
9. terminal rollback

Result:

`PHASE_7A_K5B_SHARED_SHOW_CATALOG_BEHAVIOR_PASS`

Fixture counts before rollback:

- Shows: `1`
- Show Episodes: `1`
- Video publications: `1`
- Video Episode shared links: `1`

Post-rollback preview counts:

- auth users: `0`
- Shows: `0`
- Show Episodes: `0`
- Video publications: `0`
- Video Episode shared links: `0`

## Schema types

K5B replaces an existing JSON-returning RPC without changing its signature.

Therefore the committed `public,editorial` TypeScript snapshot does not change.

Committed schema types SHA-256:

`b51ab962c300453655f1e9e1a56382609d49da888899c92f4c684b4c0ac57c90`

The Supabase-generated production and K5B-preview type surfaces were also compared directly and were byte-identical.

## Video Admin Studio composition

New governed surfaces:

- `src/pages/admin/content/video/page.tsx`
- `src/pages/admin/content/video/detail/page.tsx`
- `src/pages/admin/content/video/detail/VideoEditorWorkspace.tsx`

The Video collection supports:

- standalone Video creation
- Video Episode creation from an existing unbound shared Show Episode
- classification selection
- lifecycle filtering
- search
- governed navigation into the Video Editor

The purpose-built Video Editor supports:

- standalone metadata editing
- shared Show Episode identity presentation for Episode Video
- native canonical Media source registration and selection
- external provider source registration and selection
- native Video playback
- poster selection
- transcript selection
- caption / subtitle / forced-subtitle track composition
- chapter composition
- shared Discovery metadata on the exact working Video version
- immutable working snapshots
- review submission
- request changes
- approval
- publication
- reconstructable version and lifecycle History

The editor consumes `videoAdminService.ts` rather than querying private Video tables.

## Client capability convergence

K2 already introduced the canonical database capabilities:

- `view_video`
- `edit_own_video`
- `edit_others_video`
- `publish_video`

K5B converges the stale client-side `Capability` vocabulary and fallback role map to those existing authorities. It does not introduce new permissions.

Video is mounted in the existing Content & Editorial shell, router, lazy loader, navigation, and command palette.

## Primitive impact

### Promoted to canonical

K5B provides the required second real domain consumer for:

- `AdminModeComposer`
- `MediaTransport`
- `MediaTimeline`

Each remains consumer-owned and imports no Video service or Supabase authority.

The machine registry now records both:

- `admin:audio`
- `admin:video`

for these primitives.

### Reused canonical primitives

K5B also reuses:

- `AdminCollectionHeader`
- `AdminRecordHeader`
- `AdminRecordActions`
- `AdminStatusBadge`
- `AdminSaveState`
- `AdminWorkspaceSection`
- `EditorialWorkflowRail`
- `EditorialDecisionWorkspace`
- `EditorialMetadataWorkspace`

### Deliberately not promoted

`EditorialCommentEditor` remains a candidate.

K5A does not yet expose governed Video time-anchored review-thread commands. K5B does not create transient local comments merely to claim reuse.

`EditorialCreditPicker` remains a candidate.

K5A does not yet expose governed Video Resource-Version Credit attachment commands. K5B does not attach Credits through Audio-specific commands or local-only state.

These deferrals are authority gaps, not UI omissions to paper over.

## Media semantics

Native Video, poster, transcript, and caption selections continue to resolve exact current canonical Media revisions through `getAdminMediaAssetById`.

Picker kinds are constrained semantically:

- native source: `video`
- poster: `image`
- transcript: `transcript`
- caption/subtitle track: `caption`

The server remains final authority for exact Media kind, revision, governance, and usage validation.

## Deployment checklist

- SQL migration needed: **Yes**, the bounded shared Show catalog extension
- Edge Function deployment needed: **No**
- Readdy Finish update needed: **No**
- Frontend deployment needed: **Yes, only after merged-main acceptance**
- PR needed now: **After focused static gate and replay seal**
- Next test: **K5B focused test, primitive compounding, critical suites, live-schema contract, application build**

## Local execution constraint

This environment cannot resolve GitHub from the local container, so it cannot truthfully claim a local `npm` test or build.

Protected GitHub CI is therefore the repository execution/build gate after the preview and static repository gates are sealed.

## Preview disposition

Preview authority for the K5B SQL extension is accepted.

Do not promote to production until:

1. K5B focused CI is green
2. primitive compounding is green
3. critical security/lifecycle suites are green
4. application build is green
5. exact branch scope remains bounded
6. PR merges
7. production SQL promotion advances history exactly from 66 to 67
8. the permanent K5B verifier passes independently on production
9. the merged-main live-schema/build run is green
10. the disposable preview is deleted only after production acceptance

## Acceptance statement

K5B preview evidence supports the following statement:

> WAKILISHA can compose a purpose-built Video Admin Studio over the accepted Video service boundary while preserving canonical Media, Resource lifecycle, and shared Show Episode authority, and while promoting only interaction primitives proven by real second-domain use.
