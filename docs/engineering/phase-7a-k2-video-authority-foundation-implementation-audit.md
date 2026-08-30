# Phase 7A K2 Video Authority Foundation — Implementation Audit

## Current-state reconciliation — 30 August 2026

**The kernel movement described in this document is closed.**

Current authority is recorded in
`docs/engineering/phase-7a-kernel-closure-record.md`.

The accepted kernel baseline is production **64/AR3**:
`20260830070752_phase_7a_k4c_ar3_article_cross_system_reader_convergence_typed_event_retirement`.

Playlist and Audio typed lifecycle pointer compatibility is physically retired.
Playlist/Audio typed event writers are retired.
Article typed lifecycle readers/writers are retired.
Video uses the shared Resource kernel directly and has no typed lifecycle/review ledger.

A bounded post-kernel hardening candidate at commit
`79b26e4c8db83fe178459c4c497c8fbc8714bb2b`
repairs two separately tracked business-logic defects and freezes retained typed
event tables as inaccessible historical evidence. It does **not** reopen this
kernel milestone.

Any older `Status`, `Current boundary`, `Next test`, production migration
count, or preview instruction below is historical evidence for that checkpoint,
not the current programme state.


Status: PREVIEW SEALED — LOCAL PRE-PR GATES PASSED

Implementation date: 26 August 2026

Accepted main baseline: `f8144a2fdc470196234a7b176653ce6993d8ac0b`

K1 production migration head before this candidate: `20260826161426_phase_7a_k1_resource_lifecycle_convergence`

## Purpose

K2 is the first schema implementation slice of canonical Video authority.

It makes Video the first new typed domain to consume the Phase 7A Resource Version and lifecycle primitives natively rather than inheriting the historical Playlist/Audio compatibility mirrors.

The candidate is intentionally schema/foundation work. It does not activate Video product routes, public Video reads, browser mutation APIs, Review event storage, or production playback behavior.

## Governing architecture

K2 preserves the accepted Video architecture:

- Resource is stable global identity.
- `standalone_video` and `video_episode` are the only new Video Resource kinds.
- `show` and `show_episode` remain canonical cross-media collection identity.
- Video does not create `video_series` or `video_show`.
- Media remains canonical file, revision, derivative, rights, governance, transcript-file, caption-file, and usage authority.
- Video owns typed publication meaning, source selection, caption/subtitle semantics, chapters, and immutable Video publication snapshots.
- Resource Version remains the global immutable version envelope.
- Resource lifecycle pointers remain the canonical current working/submitted/approved/published position.

## K1 ratchet: no new typed lifecycle mirrors

`editorial.video_publication_resources` is deliberately only:

- `resource_id`
- `resource_kind`
- `publication_id`

It must never gain:

- `current_working_version_id`
- `current_submitted_version_id`
- `current_approved_version_id`
- `current_published_version_id`

Video lifecycle position is stored only on `editorial.resources` and points through `editorial.resource_versions`.

This is the executable ratchet produced by K1. Playlist and Audio retain compatibility mirrors temporarily; new domains do not renew the duplication.

The K2 permanent verifier checks this absence as a platform invariant.

## Typed Video authority introduced

The candidate creates private schema `video` with controlled vocabularies for:

- publication classification
- external source provider
- caption/subtitle track kind

Initial classifications:

- `documentary`
- `interview`
- `performance`
- `explainer`
- `field_footage`
- `other`

Initial provider identities:

- `youtube`
- `vimeo`

Initial timed-text kinds:

- `captions`
- `subtitles`
- `forced_subtitles`

## Video Source

`video.sources` is immutable playback-source identity, not cultural-object identity.

Initial source kinds:

- `native_media`
- `external_provider`

Native source identity binds one canonical `video` Media asset and one exact verified asset revision.

Provider source identity binds one enabled provider, normalized provider object identity supplied by the future command layer, and one canonical HTTPS URL.

The database prevents duplicate normalized native revision identity and duplicate provider/object identity.

Source rows are immutable. Availability/takedown/health observations must not rewrite historical source identity.

## Working Video publication

`video.publications` stores mutable Video-domain working state:

- publication kind
- standalone slug/title/summary only when standalone
- one primary classification
- selected source
- authority revision
- metadata
- actor/timestamp fields

No generic Video lifecycle/status column is added.

Shared lifecycle state and current version positions already belong to Resource.

Episode identity is represented through `editorial.video_episode_shared_links` to the existing shared `editorial.show_episodes` primitive.

Deferred integrity requires:

- every Video Episode to have exactly one shared Show Episode link
- every standalone Video to have none
- publication kind and Resource kind to agree exactly

## Captions/subtitles and chapters

Working timed-text meaning lives in `video.caption_tracks`.

The file remains canonical Media. Video stores:

- exact Caption Media asset/revision
- language tag
- semantic track kind
- human label
- default selection
- ordering
- authority revision

The same exact semantic snapshot is copied into `video.publication_version_caption_tracks` by future snapshot commands.

Working chapters live in `video.publication_chapters` and immutable chapter snapshots in `video.publication_version_chapters`.

Deferred integrity requires chapter numbers contiguous from 1 and start times strictly increasing.

No generic universal timed-marker table is introduced.

## Immutable Video publication versions

`video.publication_versions` remains typed content/snapshot authority.

It stores:

- exact Video Resource and publication identity
- version number and lifecycle kind
- source authority revision
- publication kind
- shared Show/Show Episode snapshot when episodic
- immutable slug/title/summary snapshots
- classification
- exact immutable Video Source
- metadata
- content fingerprint
- historical creator UUID snapshot

Allowed version kinds in this slice:

- `working`
- `submitted`
- `approved`
- `published`

The version row, caption-track snapshot rows, and chapter snapshot rows are immutable.

A Video Episode version must snapshot the exact shared Show and Show Episode identity currently bound to the publication at insertion time.

## K0 Resource Version integration

K2 registers:

`video_publication_version`

as a new global Resource Version type sourced from:

`video.publication_versions`

Allowed Resource kinds:

- `standalone_video`
- `video_episode`

Every inserted typed Video version is registered through the existing `editorial.register_typed_resource_version()` adapter.

The invariant remains:

`editorial.resource_versions.id = video.publication_versions.id`

Typed Video content does not move into the global envelope.

## Resource Version resolver decision

K2 does **not** replace `editorial.resolve_resource_version_identity()` with a global `editorial.resource_versions` lookup.

That refactor looked attractive but was rejected during implementation review.

Existing Article version Discovery materialization can execute before the K0 registration trigger because PostgreSQL orders same-event triggers by trigger name. The current typed resolver remains safe in that ordering because it reads the typed version table directly.

K2 therefore extends the typed resolver with a fourth branch for `video_publication_version` and preserves the three existing domain branches.

A future convergence may move all domains to the global envelope only after trigger ordering/registration semantics are deliberately ratcheted first.

## Shared Discovery storage

K2 extends the existing version-bound Discovery storage constraints to accept:

`video_publication_version`

It adds a small Video adapter that materializes the same shared Discovery metadata row for every Video version and copies prior Video Discovery metadata/taxonomy through the existing shared copy primitive when a lifecycle predecessor exists.

K2 does not add:

- `video_seo`
- `video_tags`
- a second taxonomy store
- public Video Discovery read/write RPCs

Those public command/read surfaces belong to a later Video command milestone.

## Media extension

New Media usage roles:

- `video_master`
- `video_poster`
- `video_caption`
- `video_transcript`

All target:

- authority `video`
- kind `video_publication`

All require exact Media revisions.

Role-to-asset-kind integrity:

- `video_master` -> Media kind `video`
- `video_poster` -> Media kind `image`
- `video_caption` -> Media kind `caption`
- `video_transcript` -> Media kind `transcript`

Master, poster, and transcript are singleton active roles per Video target/version. Caption usages may be plural.

The generic Media target validator is extended so Video becomes a normal governed Media consumer rather than repeating Audio's historical direct-usage bypass.

## Native source / Media usage invariant

A selected native Video source and active working `video_master` usage must agree exactly on:

- Media asset
- exact Media revision
- Video publication target
- exact-revision resolution mode

The invariant is deferred and observed from both `video.publications` and `media.usage_links`, so future governed commands can change source + Media relationship transactionally in either order.

Provider-backed Video must have no active native `video_master` usage.

This is a cross-table authority invariant, not UI validation.

## Media `target_version_kind` compatibility finding

Live production currently has zero Media usage rows with non-null target-version identity.

The historical generic Article/Playlist validator interprets `media.usage_links.target_version_kind` as a lifecycle kind such as `working` or `published`.

The accepted Video design uses the field as typed immutable version identity:

`video_publication_version`

K2 does **not** silently migrate or reinterpret the older Article/Playlist API contract.

For Video only, version-bound usage requires exactly `video_publication_version` and the version UUID must belong to the target Video publication.

The historical overloaded column semantics remain explicit convergence debt for a later Media primitive milestone.

## Capability boundary

K2 adds:

- `view_video`
- `edit_own_video`
- `edit_others_video`
- `publish_video`
- `delete_video`

Role assignment mirrors the already-proved editorial Audio pattern.

Internal Video permission helpers are `SECURITY DEFINER`, fixed-search-path functions with direct execution revoked from application roles.

No public Video mutation RPC is created in K2.

## Command vocabulary reserved

K2 registers command-type vocabulary for the later governed Video command layer:

1. `video.source.register`
2. `video.publication.create`
3. `video.publication.metadata.update`
4. `video.publication.source.set`
5. `video.publication.show_episode.bind`
6. `video.publication.poster.set`
7. `video.publication.captions.replace`
8. `video.publication.transcript.set`
9. `video.publication.chapters.replace`
10. `video.publication.version.snapshot_working`

K2 registers vocabulary only. It does not expose those commands as public RPCs yet.

Review submit/decision/publish commands are intentionally deferred until the shared review/lifecycle-event convergence decision is implemented.

## Security posture

All `video` tables have RLS enabled as defense in depth.

No direct table privilege is granted to:

- PUBLIC
- `anon`
- `authenticated`
- `service_role`

The two editorial Video binding tables also have RLS enabled and no application-role table grants.

New privileged internal helpers use fixed `search_path` and direct execution is revoked from application roles.

Shared functions modified with `CREATE OR REPLACE FUNCTION` retain their pre-existing ACL contract rather than broadening it.

## Existing authority preserved

The migration records fingerprints/counts before schema work and proves before commit that K2 did not mutate pre-existing:

- Resource identity/lifecycle rows
- global Resource Version rows
- Media usage rows
- shared Discovery metadata/taxonomy rows

Vocabulary and schema extension are expected; existing domain data mutation is not.

## Explicit non-goals for K2

K2 does not create:

- `video_review_events`
- Video-specific Credits/Citations stores
- Video-specific transcript file authority
- Video-specific upload/file/processing authority
- `video_series`
- `video_show`
- Video lifecycle/status duplication
- typed Video lifecycle-pointer mirrors
- public Video editor commands
- public Video read models/routes
- frontend Video editor UI
- adaptive streaming/HLS authority
- user Video ingress policy
- Article embed migration

## Required proof before PR

K2 is not accepted until all normal gates complete:

1. clean branch from accepted main
2. native `supabase migration new` migration identity
3. focused static contract test
4. Primitive Compounding audit
5. `git diff --check`
6. `npm run build:app`
7. exact changed-file scope inspection
8. one disposable Supabase preview
9. baseline migration replay proof before K2
10. exact K2 migration applied only to healthy preview
11. permanent K2 verifier pass
12. rollback-only behavior fixtures for critical invariants
13. fresh replay proof / migration-history ratchet
14. focused + critical suites and schema parity
15. byte-identity proof for preview-sealed K2 SQL
16. only then commit, push, PR, protected CI, merge
17. separate production SQL promotion and verification

Until those gates pass, this document describes a local candidate, not deployed authority.

## Preview parser finding and repair

The first exact K2 preview push reached PostgreSQL and failed transactionally before migration history advanced.

PostgreSQL rejected one multi-function `REVOKE EXECUTE` statement because the object class keyword `FUNCTION` was repeated after a comma. The valid grammar names `FUNCTION` once and then lists subsequent function signatures directly.

The failed migration transaction rolled back completely. Independent preview checks confirmed:

- migration history remained at K1
- the `video` schema did not exist
- no Video Resource kinds, Resource Version type, Media roles, capabilities, or commands persisted

K2 was repaired in place without changing the native migration identity. A focused static regression test now rejects `, FUNCTION ...` inside multi-function ACL lists. The corrected grammar was also proven directly by PostgreSQL inside a rollback-only temporary-function fixture before the candidate was resealed.

## Preview semantic finding: Video Media storage vocabulary

The repaired K2 migration applied successfully to the disposable preview and exposed a semantic mismatch that static function-level checks had not caught.

K2 extended `media.validate_usage_target(...)` and the Media role vocabulary to accept Video, but the underlying `media.usage_links` storage checks still rejected:

- `target_authority = 'video'`
- `target_kind = 'video_publication'`

This made governed Video Media usage unwriteable despite the validator claiming support.

The correction keeps Media as the canonical file/usage authority and extends only the existing storage vocabulary:

- `usage_links_target_authority_check` now includes `video`
- `usage_links_target_kind_check` now includes `video_publication`

The intended fix was proven on preview with a rollback-only native Video fixture that satisfied exact verified Media revision, governance, active `video_master` usage, and caption Media identity. The permanent K2 verifier now checks that the storage constraints and validator agree.

## Fresh preview seal and advisor disposition

The final K2 candidate was re-proven on a fresh disposable Supabase preview after the parser and Media-storage repairs.

Fresh preview project:

`pnvngdtizuxrhsadnnqw`

Exact sealed identities:

- migration: `20260826184252_phase_7a_k2_video_authority_foundation.sql`
- migration SHA-256: `edc2d722a3b2dd8e71acec1c6faeb0b843533cbaa562bcded708eaea979a13fa`
- permanent verifier SHA-256: `0d5f798777051a79b995dbb4c5af147050645ccb32a01736d65a1c54c9201841`

Native preview proof established:

- the preview first reached the accepted K1 baseline
- native `db push --dry-run` showed exactly one pending migration: K2
- the exact sealed K2 SQL applied successfully
- native post-push `db push --dry-run` reported the remote database up to date
- preview migration history contains 53 migrations and ends at `20260826184252_phase_7a_k2_video_authority_foundation`
- the exact permanent verifier returned `PHASE_7A_K2_VIDEO_AUTHORITY_FOUNDATION_PASS`

Rollback-only behavior proof then covered three critical branches:

1. external-provider Video publication authority
2. native verified Media source + active exact-revision `video_master` + Caption Media authority
3. Video Episode binding to the shared Show / Show Episode hierarchy

Each fixture completed inside an explicit transaction and rolled back. A separate residue check confirmed no fixture Video, Media, Auth/profile, or shared Show rows remained.

### Production-untouched parity

Production remained on 52 migrations with head:

`20260826161426_phase_7a_k1_resource_lifecycle_convergence`

Independent production queries confirmed K2 had not created or registered any of the following there:

- `video` schema
- Video publication tables
- `standalone_video` / `video_episode` Resource kinds
- `video_publication_version`
- Video capabilities
- Video command types
- Video Media usage roles

This is the explicit production-non-mutation gate for K2 preview work.

### Security advisor disposition

The fresh preview security advisor reports 12 Video-attributable `INFO` notices of type `rls_enabled_no_policy`.

These are intentional for this foundation slice. The affected Video authority tables have RLS enabled as defense in depth but deliberately expose no direct application-role table policies or grants. K2 does not yet create public Video read/mutation APIs. The relevant Supabase lint reference is:

`https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy`

The advisor also surfaced preview-only warnings on pre-existing public `SECURITY DEFINER` functions. Those warnings are not attributable to K2. An exact ACL comparison of every pre-existing function K2 replaces showed identical execution privileges on preview and production. Every new K2 Video `SECURITY DEFINER` helper is non-executable by `anon`, `authenticated`, and `service_role`.

No K2-attributable security `WARN` remains open.

### Performance advisor disposition

The fresh preview performance advisor reports 20 Video-attributable `INFO` suggestions for foreign keys without covering indexes, plus two `unused_index` notices on the empty Video foundation.

K2 does not blanket-index every governance actor, vocabulary, or integrity foreign key merely to silence the advisor. The schema is not yet serving public Video traffic, and read/write command access paths are intentionally deferred to the next Video product/command milestone. Purposeful indexes already present for known K2 invariants remain part of the sealed candidate.

The unindexed-FK suggestions are therefore recorded as explicit follow-up performance debt, not hidden or misclassified as a correctness/security failure. The relevant Supabase lint reference is:

`https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys`

The empty-preview `unused_index` notices are expected before Video traffic exists:

`https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index`

K2 is accepted for pre-PR promotion only after the local focused suite, Primitive Compounding gate, `npm run test:critical`, and `npm run build:app` all pass against the same sealed migration/verifier bytes.
