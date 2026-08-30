# Phase 7A Video Publication Authority Schema Design

## Current Phase 7A resume state — 30 August 2026

The Resource-kernel detour is complete. See
`docs/engineering/phase-7a-kernel-closure-record.md`.

Do not reopen K0, K1, K4A, or K4C while resuming Video.

The finalized kernel gives Video canonical Resource Version identity, lifecycle
position, shared lifecycle/review event authority, and command concurrency
without typed lifecycle mirrors or a typed Video event ledger.

A bounded post-kernel hardening candidate is being accepted separately and does
not change the Video architecture.

The next Video product boundary is the governed editorial command/admin-read
surface required by the internal Video Editor. The later Video UI must reuse
canonical primitives and, where Video becomes the second real consumer of a
candidate primitive, promote/extend-or-promote it in the same milestone.


Status: PROPOSED IMPLEMENTATION CONTRACT

Design date: 26 August 2026

Repository design baseline: `8f6bd2be1f4159fb21a34b71290c8879931cdd49`

Production runtime application baseline: `dae3de2dc9fb021496eb0fe0c4d4f0338f676a88`

Production migration head: `20260825102000`

Production migration count: `50`

Governing audit:

`docs/engineering/phase-7a-video-authority-and-primitives-audit.md`

## Purpose

This document translates the locked Phase 7A audit into the smallest durable PostgreSQL contract for canonical Video publication authority.

No Phase 7A Video migration should be written until this contract is accepted in protected `main`.

The design deliberately does not copy Audio table-for-table. It reuses stable platform concepts and leaves Video-specific semantics typed.

## Locked architecture

The durable identity model is:

```text
editorial.resources
├── standalone_video
├── video_episode
├── show
└── show_episode
```

A standalone Video is independent.

A Video Episode is a typed Video publication bound to one existing shared `show_episode` identity.

There is no new canonical `video_series`, `video_show`, or `show_journey` authority.

The existing Phase 6B Show authority remains the cross-media collection model.

## Schema ownership

Canonical Video publication authority belongs in a dedicated `video` schema.

Reasons:

- Video is a typed domain, not a generic Media row
- anonymous clients must not read working Video authority directly
- Media files must remain owned by `media`
- shared Show identity must remain owned by `editorial`
- shared Credits, Citations, Discovery, Review meaning, Corrections, and provenance must remain outside Video-specific tables

The initial `video` schema is internal. Public Video read models belong to Phase 7B.

## Resource kinds

Add two enabled Resource kinds:

- `standalone_video`
- `video_episode`

Do not add:

- `video_series`
- `video_show`

`show` and `show_episode` already exist and are the canonical cross-media identities.

## Controlled vocabularies

### Video classifications

Create:

`video.publication_classifications`

Columns:

- `classification text primary key`
- `label text not null`
- `description text not null`
- `enabled boolean not null default true`
- `sort_order integer not null default 100`
- `created_at timestamptz not null default now()`

Initial values:

- `documentary`
- `interview`
- `performance`
- `explainer`
- `field_footage`
- `other`

A publication has one primary classification initially.

Do not create a generic arbitrary taxonomy substitute here. Shared Categories and Tags continue through version-bound Discovery authority.

### Video source providers

Create:

`video.source_providers`

Columns:

- `provider_key text primary key`
- `label text not null`
- `description text not null`
- `enabled boolean not null default true`
- `sort_order integer not null default 100`
- `created_at timestamptz not null default now()`

Initial provider rows:

- `youtube`
- `vimeo`

Native WAKILISHA Media is not a provider row. It is represented by `source_kind = 'native_media'`.

Provider capability behavior remains an application/service contract rather than mutable database truth in this first slice.

### Caption track kinds

Create:

`video.caption_track_kinds`

Columns:

- `track_kind text primary key`
- `label text not null`
- `description text not null`
- `enabled boolean not null default true`
- `sort_order integer not null default 100`
- `created_at timestamptz not null default now()`

Initial values:

- `captions`
- `subtitles`
- `forced_subtitles`

Transcript is not a caption-track kind.

## Immutable Video sources

### Table

`video.sources`

### Purpose

One immutable exact playback-source identity that may be selected by a Video publication version.

A source is not the Video cultural object.

### Columns

- `id uuid primary key default gen_random_uuid()`
- `source_kind text not null`
- `provider_key text`
- `provider_object_id text`
- `canonical_url text`
- `media_asset_id uuid`
- `media_asset_revision_id uuid`
- `source_metadata jsonb not null default '{}'::jsonb`
- `created_by uuid`
- `created_at timestamptz not null default now()`

### Source kinds

Initial values:

- `native_media`
- `external_provider`

### Native-source integrity

For `native_media`:

- `media_asset_id` is required
- `media_asset_revision_id` is required
- provider fields are null
- asset kind must be `video`
- revision must belong to that asset
- original file object must be verified
- current Media governance must permit editorial use

A later replacement master creates a new immutable Media revision and therefore a new immutable Video source row. Published Video versions continue pointing to the old source.

### Provider-source integrity

For `external_provider`:

- `provider_key` is required
- provider must be enabled
- `provider_object_id` is required
- `canonical_url` is required
- Media asset/revision fields are null

Initial supported providers:

- YouTube
- Vimeo

Provider object id is normalized before insertion.

### Uniqueness

Create unique partial indexes for:

- `(media_asset_id, media_asset_revision_id)` where source kind is native
- `(provider_key, provider_object_id)` where source kind is external provider

This permits one normalized source identity to be reused by a proper Video publication and, later, by Article/provider compatibility adapters without duplicating provider identity.

### Immutability

Direct update and delete are blocked after source creation.

Availability, takedown, or provider-health observations must not mutate historical source identity. A future operational health model may reference the immutable source.

## Working Video publication

### Table

`video.publications`

### Purpose

Current editable Video-domain state.

### Columns

- `id uuid primary key default gen_random_uuid()`
- `publication_kind text not null`
- `standalone_slug text`
- `standalone_title text`
- `standalone_summary text`
- `classification text not null`
- `selected_source_id uuid`
- `authority_revision bigint not null default 1`
- `metadata jsonb not null default '{}'::jsonb`
- `created_by uuid`
- `updated_by uuid`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### Publication kinds

- `standalone`
- `episode`

### Standalone integrity

A standalone Video requires:

- standalone slug
- standalone title
- no shared Show Episode binding

Standalone slug must use the existing canonical slug grammar.

### Episode integrity

A Video Episode requires:

- one shared Show Episode binding
- standalone slug/title/summary fields to be null

Canonical Episode slug/title/summary/number belong to `editorial.show_episodes`, not to a duplicate Video-series hierarchy.

The Video Editor resolves those shared fields through the binding.

### Why working status is not duplicated

Do not add another generic Video publication-status column in the initial design.

Shared lifecycle and current-version pointers already live in `editorial.resources`:

- lifecycle state
- current working version
- current submitted version
- current approved version
- current published version

Video-specific readiness is derived from typed Video validation, not another generic lifecycle state.

## Video Resource binding

Create:

`editorial.video_publication_resources`

Columns:

- `resource_id uuid primary key`
- `resource_kind text not null`
- `publication_id uuid not null unique`
- `current_working_version_id uuid`
- `current_submitted_version_id uuid`
- `current_approved_version_id uuid`
- `current_published_version_id uuid`

Allowed Resource kinds:

- `standalone_video`
- `video_episode`

The binding mirrors the shared Resource pointers for exact integrity checks and compatibility with existing Article/Playlist/Audio patterns.

Resource binding creation is transactional with Video publication creation.

Extend `editorial.assert_resource_binding_integrity()` so both Video Resource kinds require exactly one `editorial.video_publication_resources` binding.

## Video Episode to shared Show Episode binding

Create:

`editorial.video_episode_shared_links`

Columns:

- `video_publication_id uuid primary key`
- `show_episode_resource_id uuid not null unique`
- `created_at timestamptz not null default now()`

The link exists only for `video.publications.publication_kind = 'episode'`.

The linked shared Resource must be kind `show_episode`.

One Video Episode publication binds to one shared Show Episode.

A shared Show Episode may therefore have:

- one Audio publication binding
- one Video publication binding

without either media domain owning Show identity.

No standalone Video may have a row in this table.

## Working poster authority

Do not add poster asset columns to `video.publications`.

Use canonical `media.usage_links` with a new role:

- `video_poster`

Requirements:

- target Video publication
- exact Media revision
- Media asset kind `image`
- one active poster usage per Video publication
- governance permits use

A future poster replacement archives/detaches the old usage and attaches the new exact revision through a Video-owned command using Media authority.

## Native master authority

Do not add master asset/revision columns to `video.publications`.

A native selected source points to exact Media asset/revision in `video.sources`.

The Video publication must also carry governed Media usage with role:

- `video_master`

This records the exact relationship between the Video Resource and the Media asset/revision.

The selected source and active `video_master` usage must agree.

Provider-backed Video has no `video_master` Media usage because WAKILISHA does not own provider bytes merely because it embeds them.

## Transcript authority

Do not create a second transcript store.

Use canonical Media asset kind `transcript` and Media usage role:

- `video_transcript`

Initial contract permits at most one active transcript usage per working Video publication.

The usage must bind an exact Media revision.

Language/label metadata may be carried in governed placement data initially. If real multilingual transcript production proves a richer need, Video may gain a typed transcript relation later without moving file identity out of Media.

## Working caption/subtitle tracks

### Table

`video.caption_tracks`

### Purpose

Typed editorial meaning for selectable timed-text tracks.

The file remains Media; the semantic relationship belongs to Video.

### Columns

- `id uuid primary key default gen_random_uuid()`
- `publication_id uuid not null`
- `media_asset_id uuid not null`
- `media_asset_revision_id uuid not null`
- `language_tag text not null`
- `track_kind text not null`
- `label text not null`
- `is_default boolean not null default false`
- `display_order integer not null default 0`
- `authority_revision bigint not null default 1`
- `created_by uuid`
- `updated_by uuid`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### Integrity

- Media asset kind must be `caption`
- exact Media revision must belong to the asset
- file object must be verified
- track kind must be enabled
- language tag must be non-empty and normalized
- label must be non-empty
- display order must be non-negative
- authority revision must be at least 1
- at most one default track per Video publication
- one publication may not attach the same exact caption revision twice with the same track meaning

The command layer also creates/maintains a governed exact Media usage role:

- `video_caption`

Do not encode language/kind/default semantics only inside Media `placement_data`; those semantics require typed Video constraints.

## Working chapters

Chapters remain Video-domain semantics.

Create:

`video.publication_chapters`

Columns:

- `id uuid primary key default gen_random_uuid()`
- `publication_id uuid not null`
- `chapter_number integer not null`
- `start_seconds numeric not null`
- `title text not null`
- `description text`
- `created_by uuid`
- `updated_by uuid`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Requirements:

- chapter numbers are contiguous from 1
- start time is non-negative
- start times strictly increase
- title is non-empty

End time is derived from the next chapter or duration rather than duplicated.

Do not create a generic universal timed-marker table in this first slice.

## Immutable Video publication versions

### Table

`video.publication_versions`

### Purpose

Immutable submitted/approved/published Video snapshot identity.

### Columns

- `id uuid primary key default gen_random_uuid()`
- `resource_id uuid not null`
- `publication_id uuid not null`
- `version_number bigint not null`
- `version_kind text not null`
- `source_authority_revision bigint not null`
- `publication_kind text not null`
- `show_resource_id uuid`
- `show_episode_resource_id uuid`
- `slug_snapshot text not null`
- `title_snapshot text not null`
- `summary_snapshot text`
- `classification text not null`
- `source_id uuid not null`
- `metadata jsonb not null default '{}'::jsonb`
- `content_fingerprint text not null`
- `created_by uuid`
- `created_at timestamptz not null default now()`

### Snapshot identity

For standalone Video:

- show fields are null
- slug/title/summary snapshot from working standalone fields

For Video Episode:

- show and show-episode ids are required
- slug/title/summary snapshot from shared `editorial.show_episodes`

A published Video version therefore remains reconstructable even if a later working Show Episode title or summary changes.

### Source identity

`source_id` references immutable `video.sources`.

Switching from YouTube to native delivery, or from one native master revision to another, creates a new source selection in a later Video version without rewriting history.

### Version kinds

Use the platform lifecycle vocabulary already proved by the current domains. Do not invent Video-specific names for submitted/approved/published meaning.

The exact allowed version-kind set must match the shared Resource pointer contract and current review lifecycle before implementation.

### Immutability

Direct update and delete are blocked after insertion.

Version creation happens only through trusted snapshot/review commands.

## Immutable caption-track snapshots

Create:

`video.publication_version_caption_tracks`

Columns:

- `publication_version_id uuid not null`
- `track_number integer not null`
- `media_asset_id uuid not null`
- `media_asset_revision_id uuid not null`
- `language_tag text not null`
- `track_kind text not null`
- `label text not null`
- `is_default boolean not null`
- primary key `(publication_version_id, track_number)`

The snapshot records exact Media asset/revision identity plus the Video track semantics.

Direct update/delete are blocked.

## Immutable chapter snapshots

Create:

`video.publication_version_chapters`

Columns:

- `publication_version_id uuid not null`
- `chapter_number integer not null`
- `start_seconds numeric not null`
- `title text not null`
- `description text`
- primary key `(publication_version_id, chapter_number)`

Direct update/delete are blocked.

## Version-bound Media usage

When a Video version is snapshotted, exact active working Media relationships required for reconstruction are copied into version-bound `media.usage_links` using:

- target authority `video`
- target kind `video_publication`
- target version kind `video_publication_version`
- target version id = exact immutable Video version id

Roles include:

- `video_master` for native source only
- `video_poster`
- `video_caption`
- `video_transcript`

The version snapshot must never use `current_revision` resolution. Publication-stable usages require exact revisions.

## Media foundation extension

Extend existing controlled Media usage authority rather than bypass it.

### New usage roles

Add:

- `video_master`
- `video_poster`
- `video_caption`
- `video_transcript`

### Target storage vocabulary

Add target kind:

- `video_publication`

### Generic target validation

Extend `media.validate_usage_target()` to understand:

- target authority `video`
- target kind `video_publication`
- working publication identity
- `video_publication_version` identity when supplied
- Video edit authority for the actor

This is intentionally different from the Audio M2 compatibility bypass. Video should become a normal consumer of the generic Media usage command.

### Usage-role matching

Extend `media.usage_role_matches_target()` so Video roles match only Video publication targets.

### Stability

All Video publication roles require exact revision stability.

## Discovery authority

Do not create Video category, tag, or SEO tables.

Extend the existing shared version-bound Discovery authority to recognize:

- target version type `video_publication_version`
- Video Resource kinds `standalone_video` and `video_episode`

Extend `editorial.resolve_resource_version_identity()` and related guards rather than copying Discovery logic.

## Credits and Citations

Do not create Video Credit or Citation tables.

Video versions and Resources use the shared editorial Credit/Citation authority.

The Video Editor should consume the canonical `EditorialCreditPicker` interaction once implementation reaches the frontend slice.

## Review/lifecycle storage decision

The audit proved that Playlist and Audio already repeat materially the same review-event meaning.

This first Video authority migration must **not** introduce a new `video.review_events` table.

The first schema candidate stops at immutable version foundation and Resource lifecycle pointer compatibility.

Before Video submit/approve/publish commands ship, a dedicated convergence design must choose between:

1. a shared Resource review-event authority with adapters for existing domains
2. a narrow compatibility strategy that still prevents a fourth independently defined review-event meaning

This keeps the first migration focused while making duplication impossible by contract.

The interaction layer already has canonical `EditorialDecisionWorkspace`; database lifecycle convergence is the remaining authority decision.

## Video capabilities

Add Video capability definitions consistent with existing editorial domains:

- `view_video`
- `edit_own_video`
- `edit_others_video`
- `publish_video`
- `delete_video`

Initial role assignments should mirror the current Audio editorial boundary unless the role audit finds a real semantic reason to differ.

Ordinary community users do not receive these admin capabilities merely because future user upload is planned.

Future user-created Video will use a governed consumer ingress policy and ownership lifecycle, not broad Admin Video capability grants.

## Command substrate

All critical Video mutations use the existing resource-command/idempotency substrate.

The first implementation candidate should register command types for at least:

- `video.publication.create`
- `video.publication.update`
- `video.source.create`
- `video.source.select`
- `video.poster.set`
- `video.transcript.set`
- `video.caption.attach`
- `video.caption.update`
- `video.caption.detach`
- `video.chapters.replace`

Each command must:

- resolve authenticated actor
- enforce Video and/or Media capability
- accept expected authority revision where mutating working state
- use idempotency and correlation ids
- fail on stale writes
- execute transactionally
- return a command receipt

The first migration does not need to expose every command publicly if a smaller command set is enough to prove the authority. It must not create an alternate ungoverned write path.

## RLS and exposure

Canonical `video` tables:

- enable RLS
- revoke direct access from `public`, `anon`, and `authenticated`
- grant trusted service access only where required

Authenticated editors use narrow governed functions/commands.

Anonymous public Video reads do not ship in 7A's first authority slice.

## Source provider normalization

Application/service normalization must produce stable provider identity before `video.sources` insertion.

Initial rules:

### YouTube

Normalize accepted YouTube/watch/embed/short URL forms to:

- provider key `youtube`
- stable 11-character provider object id
- one canonical provider URL

### Vimeo

Normalize supported Vimeo URL forms to:

- provider key `vimeo`
- stable numeric provider object id
- one canonical provider URL

Do not store raw iframe HTML as Video source authority.

Legacy Article HTML remains untouched during the compatibility period.

## Provider capability contract

The TypeScript Video Source adapter should expose a provider-neutral capability shape such as:

- can play
- can seek
- can report current time
- can report duration
- can change playback rate
- can expose provider captions
- can accept WAKILISHA caption overlay
- can expose poster/thumbnail
- requires iframe/CSP origin

The exact TypeScript shape is an implementation detail, but provider capability must be centralized.

The existing YouTube IFrame playback service is reusable implementation evidence, not a reason to hard-code YouTube concepts into Video publication tables.

## Adaptive rendition boundary

The first authority migration does not implement HLS.

It must leave Video source and version identity independent of one particular transcode role.

A later Media-processing slice may introduce adaptive variant roles/manifests without changing Video publication identity.

Internal Video review may initially use the existing selected `video_transcode` where available.

Phase 7B remains responsible for the complete public adaptive player.

## Shared Show authoring boundary

The existing shared Show tables are cross-media but Audio currently acts as the first writer through Audio adapter commands.

Phase 7A should not create `video.shows`.

The first implementation candidate may bind Video to an existing shared Show Episode.

Before the Video Editor offers independent Show creation/editing, shared Show command authority should be promoted so the shared Show is no longer conceptually writable only through Audio.

That promotion is a shared editorial authority improvement, not a new Video series model.

## Seasons

Do not create Video Season authority in the first candidate.

Audio Season remains Audio-owned.

A future shared or Video Season object is justified only if real Video Show work needs season-owned metadata, artwork, lifecycle, Credits, or routes.

## Public route implication for Phase 7B

This schema intentionally supports:

- standalone Video public identity later under a Video route
- Show Episode public identity under the existing shared `/shows/:showSlug/:episodeSlug` route

Where one shared Show Episode has both Audio and Video bindings, Phase 7B can present Watch / Listen without creating separate Episode identities.

No public route is added by this first schema candidate.

## Existing published Video/embed compatibility

The first migration must not:

- rewrite Article HTML
- replace current `VideoOverlay`
- remove current Artist Videos
- change YouTube playback/CSP behavior
- change public Audio Show routes
- change RSS
- change current Media URLs

Provider-backed Video migration occurs after canonical source authority exists and can be proved safely.

## First migration scope

The smallest acceptable first SQL candidate should create the authority foundation only.

It should include:

1. `video` schema and controlled vocabularies
2. Resource kinds `standalone_video` and `video_episode`
3. Video capability definitions/initial role assignments
4. immutable `video.sources`
5. working `video.publications`
6. `editorial.video_publication_resources`
7. `editorial.video_episode_shared_links`
8. working caption-track authority
9. working chapter authority
10. immutable Video version, caption, and chapter snapshot tables
11. Video Media usage roles
12. generic Media target/version validator extension
13. shared Discovery version-type extension
14. integrity and immutability guards
15. narrow internal read/verifier helpers required for acceptance

It should not include:

- public Video read API
- Video Editor frontend
- Review decision storage convergence
- public routes
- HLS processing
- user Video upload
- Field Capture

## Permanent verifier contract

A merged permanent read-only verifier for this first migration must prove at minimum:

- required Video tables and controlled vocabularies exist
- forbidden competing Show authorities do not exist
- Resource kinds are enabled
- Video capability definitions exist
- native Video source constraints require exact verified Video Media revision
- external provider source constraints reject Media fields and require provider identity
- source rows are immutable
- standalone Video requires standalone identity and rejects shared Episode binding
- Video Episode requires shared Show Episode binding and rejects duplicate standalone identity
- Media usage roles exist and generic target validation accepts Video normally
- Video version rows are immutable
- caption-track kinds and default-track integrity are enforced
- caption Media must be exact `caption` asset revision
- version caption/chapter snapshots are immutable
- shared Discovery resolver accepts `video_publication_version`
- existing shared Show/Audio authority remains intact
- existing Article/Playlist/Audio version resolution still succeeds

The verifier itself must not mutate durable state.

## Preview acceptance proof

The disposable preview should exercise temporary fixtures that prove:

1. create standalone Video Resource/publication
2. create native Video source from a fixture canonical Video Media revision
3. select native source and exact `video_master` Media usage
4. attach poster
5. attach transcript
6. attach English closed-caption track
7. create chapters
8. snapshot one immutable Video version
9. verify version Media/caption/chapter identity
10. reject stale authority revision
11. reject invalid caption Media kind
12. reject provider row missing provider id
13. create a Video Episode and bind it to one shared Show Episode
14. prove the same shared Show Episode can retain its existing Audio binding
15. prove standalone Video has no Show dependency
16. delete all temporary fixtures cleanly

No production data should be used as a mutation fixture.

## Primitive impact

### Reused foundations

- Resource identity
- command/idempotency substrate
- Media asset/file/revision/governance
- Media usage links
- shared Show / Show Episode identity
- Discovery
- Credits/Citations
- Corrections/provenance foundation

### Foundation extended

- generic Media usage target/version validation
- shared Resource binding integrity
- shared Discovery version identity resolution

### New authority candidate

- immutable Video Source identity/resolution

### Existing authority candidate gaining second-domain proof

- shared Show / Show Episode identity

### Intentionally Video-specific

- working Video publication
- Video classification
- caption/subtitle track semantics
- Video chapters
- immutable Video publication snapshots

### Deliberately deferred convergence

- shared Resource review-event/lifecycle event storage

## Deployment workflow

After this design is merged, the first SQL candidate follows the established WAKILISHA workflow exactly:

- exact clean milestone branch from accepted main
- smallest local candidate
- focused static tests
- exact changed-file scope
- one disposable Supabase preview
- full existing migration-history replay before candidate SQL
- candidate apply only on healthy baseline
- permanent read-only verifier
- fixture behavior proof and cleanup
- preview-proven SQL byte-identical through promotion
- focused + critical suites and build as applicable
- commit, push, PR, green protected CI, merge
- production SQL separately
- exact migration-history verification and zero-pending dry run
- independent merged production verifier
- frontend/Edge only after database authority
- production smoke
- cleanup while retaining intentional rollback evidence

## Deployment classification

This design document changes no runtime.

- SQL migration needed now: No
- Supabase Edge Function deploy needed: No
- Readdy Finish update needed: No
- Frontend deploy needed: No
- production runtime change needed: No

## Next action

Merge this design contract through protected CI, then implement the smallest first Video authority migration, permanent verifier, and focused contract tests byte-for-byte from the accepted design.