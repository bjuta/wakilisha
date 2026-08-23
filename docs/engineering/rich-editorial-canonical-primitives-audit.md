# Rich Editorial Canonical Primitives — Authority Audit and Build Plan

Status: active implementation audit

Base: `58325e457e6eae4097c4f2fcfbfb3c02363c0293`

## Why this work exists

Phase 0–6 established durable security, Resource identity, versioning, Trust, Media, Playlist and Audio authorities. Browser acceptance in Phase 6B then exposed a different class of debt: several editorial concepts are still stranded inside the domain where they were first implemented.

Article is currently the richest reference implementation. It has governed author/byline handling, Categories, Tags, hero Media, SEO/discoverability, previews, revisions and publication tooling. Playlist and Audio already have equally serious lifecycle/version authorities, but their workspaces expose only subsets of the same editorial preparation grammar.

The goal is not to copy Article fields into Audio or Playlist. The goal is to extract the shared editorial platform that Article happened to demonstrate first, then let each domain compose it with its own specialist tools.

## Governing rule

A publishable editorial canonical is one coherent versioned editorial object. Content, presentation, taxonomy, attribution and discoverability must travel through review and publication together.

Domain-specific authority remains domain-specific:

- Article owns body editing.
- Playlist owns ordering, Registry track identity and playback validation.
- Audio owns master Media, transcript, chapters and time-based review.

Cross-domain editorial authority is shared:

- Credits and Citations
- Categories and Tags
- featured/cover Media usage
- SEO and discoverability
- review/publication state
- preview/history/corrections

## Findings

### Credits are already the correct shared authority

Phase 3 `editorial.credits` + `editorial.resource_credits` already model a Person/Organization participating in an exact Resource version under a semantic role. The Phase 6B Credit picker proved the interaction over canonical Person/Organization identity. No new author/contributor system should be created.

### Media is already the correct shared authority

Phase 4 `media.usage_links` already supports exact Media revisions, semantic usage roles, target version identity, placement data, alt text, caption and credit snapshots. `article_hero`, `playlist_cover`, `audio_master`, `audio_transcript`, `release_artwork`, `track_artwork` and related roles are semantic uses of one Media authority.

The current reusable picker still contains image-specific action language (`Use This Image` / `Replace Image`) even when the caller explicitly requests Audio or Transcript Media. That is interaction debt, not a need for a new Media system.

### Taxonomy is normalized but still Article-local

The registry term authority is `public.registry_taxonomy_terms`, but current editorial attachment authority is `editorial.article_taxonomy_terms`. Production currently has hundreds of Article category attachments and more than a thousand Article tag attachments, while Playlist and Audio have no equivalent Resource/version attachment authority.

Article immutable versions already carry `category_snapshot` and `tag_snapshot`. Those snapshots prove taxonomy is publication-affecting metadata and therefore belongs to exact editorial versions.

### Registry taxonomy slug identity is too broad

`registry_taxonomy_terms_slug_unique_idx` currently enforces global slug uniqueness. Public taxonomy reads already resolve by `(taxonomy, slug)`, and `create_taxonomy_term` also checks `(taxonomy, slug)`. Historical Article snapshots prove that the same lexical slug can legitimately occur in different taxonomies: `film` exists as a Category while an Article version also records `Film` as a post tag.

The durable key is therefore `(taxonomy, slug)`, not `slug` alone. This must be corrected before shared taxonomy backfill so historical version meaning is not silently discarded.

### SEO/discoverability is still Article-local

Article versions carry `seo jsonb`; Playlist and Audio do not have a shared version-level discoverability authority. Production Article versions demonstrate real use of title, description, keywords and focus keyword. These fields affect publication/discovery and must remain bound to the reviewed version.

### Existing Playlist and Audio lifecycle functions can be composed rather than rewritten wholesale

Audio snapshot/copy functions already carry exact Media, chapters and Trust between working/submitted/approved/published versions. Playlist snapshot/copy functions already carry items, exact cover Media and Trust.

The shared editorial metadata layer should attach to exact version IDs and propagate with small, governed version-copy hooks. It should not fork or replace the domain lifecycle machinery.

## Milestone 1 — Shared Editorial Preparation Authority

### Database authority

Create private, version-bound shared editorial metadata:

1. `editorial.resource_version_taxonomy_terms`
   - Resource identity
   - exact target version identity
   - taxonomy (`category` / `post_tag`)
   - Registry taxonomy term
   - display order
   - immutable identity validation

2. `editorial.resource_version_editorial_metadata`
   - Resource identity
   - exact target version identity
   - SEO title
   - SEO description
   - SEO keywords
   - focus keyword
   - metadata revision for optimistic editor writes

The first supported version families are:

- Article → `article_version`
- Playlist → `playlist_version`
- Standalone Audio / Audio Episode → `audio_publication_version`

Shared Show/Show Episode identity remains eligible for the same authority once those identities gain their own reviewed version authority; do not invent a parallel unversioned metadata store merely to move faster.

### Article convergence

Article remains the compatibility writer in M1. Existing Article version snapshots are backfilled into the shared read authority. A version-insert mirror keeps future Article versions synchronized from `category_snapshot`, `tag_snapshot` and `seo`.

The old Article UI is not immediately rewritten in the same migration. This preserves Phase 2 behavior while establishing one cross-domain read model.

### Playlist and Audio become first active shared writers

A governed idempotent command saves Categories, Tags and discoverability atomically against the exact current working version. It must:

- require authentication;
- derive/validate Resource and exact version identity;
- require the domain edit capability;
- reject submitted/approved/published targets;
- use optimistic metadata revision checks;
- validate Registry term taxonomy/state;
- keep all tables private from `anon` and `authenticated` direct access;
- expose only the bounded RPC surface.

### Version propagation

New Playlist/Audio lifecycle versions inherit shared editorial metadata from the correct predecessor:

- working/submitted ← current working metadata
- approved ← current submitted metadata
- scheduled/published Playlist ← current approved metadata
- published Audio ← current approved metadata

Article version inserts materialize directly from their own immutable snapshots.

### Fingerprints

Playlist and Audio current-content fingerprints must include normalized shared editorial metadata from the current working version. A taxonomy or SEO change is therefore a material editorial change and cannot silently bypass published-update/review logic.

## Milestone 1 — Interaction primitives

Create a canonical, consumer-owned `EditorialMetadataWorkspace` used by at least Audio and Playlist. It receives data and callbacks only; it does not import services or Supabase.

It owns interaction semantics for:

- Category search/selection/removal
- Tag search/selection/removal
- optional governed term creation
- SEO title
- SEO description
- SEO keywords
- focus keyword
- save/revision feedback

Service authority remains outside the primitive.

Audio adds a `Prepare → Discovery` workspace view alongside Credits & Citations.

Playlist gains the same Discovery primitive without copying Article's `ArticleMetaPanel`. Its Tracklist remains domain-specific.

Article adoption is a subsequent convergence slice once the shared writer can replace the existing Article-local picker without changing Article publication semantics.

## Media-selection semantic correction

The generic Media picker must stop assuming every selected asset is an image.

Selection language is supplied/derived semantically by the caller:

- Master Audio → `Use Master Audio`
- Transcript → `Use Transcript`
- Playlist cover → `Use Cover Art`
- Article hero → `Use Featured Image`

The same MediaLibrary remains underneath. No domain-specific picker is created.

## Follow-on milestones

1. Article writer convergence to shared Editorial Metadata authority.
2. Shared Featured Media field/presentation primitive over `media.usage_links`.
3. Playlist workspace-shell convergence with the shared workflow rail and preparation surfaces.
4. Public Record Hero + semantic primary/secondary/overflow action grammar across Track, Release, Artist, Genre, Label, Playlist, Show and Audio.
5. Expand governed Credit role taxonomy only from proven cross-domain editorial evidence.

## Acceptance invariants

- No Article-only taxonomy attachment implementation is copied into Audio or Playlist.
- No SEO JSON blob is independently added to Audio or Playlist domain rows.
- No new image/cover storage system is introduced.
- No canonical Person/Organization identity is reconstructed from browser fixture maps.
- No mutable shared metadata can change a submitted/approved/published version.
- Shared metadata changes participate in review/publication fingerprints.
- Existing published Article, Playlist and Audio versions remain byte/meaning stable through backfill.
- Public/anonymous Data API access is not widened.
- The primitive registry proves canonical cross-domain consumption instead of allowing new page-local pickers.

## Milestone 1 Local Candidate

Status: local candidate prepared and focused gates passed. Supabase preview authority is still pending.

The local candidate now contains:

- version-bound Categories and Tags for Article, Playlist, and Audio,
- immutable taxonomy label and slug snapshots so later Registry edits cannot rewrite old versions,
- version-bound search metadata with optimistic metadata revision,
- taxonomy identity corrected to `(taxonomy, slug)`,
- historical Article snapshot backfill with fail-closed preservation checks,
- explicit shared metadata rows for every existing Playlist and Audio version,
- automatic Discovery propagation across new working, submitted, approved, scheduled, and published versions,
- Playlist and Audio fingerprints that include semantic Discovery content while empty Discovery preserves old fingerprint meaning,
- immutable successor working versions for Discovery saves rather than mutation of existing version rows,
- a narrow Playlist working-successor Trust copy that proves frozen Playlist content is unchanged,
- preservation of older Audio fingerprint history while current editable Audio must satisfy the current canonical fingerprint,
- bounded authenticated read and save RPC authority,
- one consumer-owned `EditorialMetadataWorkspace` used by Audio and Playlist,
- semantic Media-picker actions for Master Audio, Transcript, and Cover Art,
- primitive-registry enforcement against new page-local taxonomy pickers.

This milestone is not preview-proven, merged, or production-active yet. The next gate is full migration-history replay in one disposable Supabase preview before this migration is applied there.

## Milestone 1 Preview Hardening

The first M1 preview passed migration replay, the permanent verifier, and transactional behavior fixtures. A targeted preview schema inspection then found one M1-specific database hygiene defect before replay proof was sealed: the `resource_version_taxonomy_terms.taxonomy_term_id` foreign key had no left-prefix index.

The candidate now adds `resource_version_taxonomy_terms_taxonomy_term_idx` on `taxonomy_term_id`. The permanent verifier requires that index, and the structural contract test requires the migration to declare it.

The first preview remains evidence for the pre-hardening candidate only. Promotion proof must use the hardened migration bytes after the disposable preview is returned to the accepted production migration head and M1 is applied again.
