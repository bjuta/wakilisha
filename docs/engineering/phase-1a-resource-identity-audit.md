# Phase 1A Resource Identity and Domain Boundaries Audit

## Status

Phase: Phase 1, PR 1A

Audit status: Complete

Implementation status: Architecture decisions resolved, migration not yet written

Production changed: No

## Objective

Give supported cultural objects one stable WAKILISHA resource identity while
preserving each typed domain table as the authority for its own content.

The first proof must connect:

- one Article
- one Playlist
- one Registry record

The shared resource layer must reference these records without polymorphic
text guesses.

## Scope

This audit covers:

- canonical identifiers
- canonical tables
- resource kinds
- ownership
- visibility
- lifecycle state
- public routes
- aliases and redirects
- API exposure
- permissions
- cross-domain references

## Explicit exclusions

PR 1A does not build:

- command receipts
- idempotency
- jobs
- transactional outbox
- Sources
- Citations
- Credits
- Corrections
- Provenance
- Inquiry Mode
- new Institute workspaces
- a universal content table
- a generic privileged resource mutation API

## Production findings

### Article

Canonical table: `public.wk_articles`

Current stable identifier:

- `id uuid primary key`

Current route identity:

- `slug text unique`

Current lifecycle indicators:

- `wp_status`
- `published_at`
- `modified_at`

Current ownership representation:

- `author text`

Material gaps:

- no structured owner foreign key
- no shared resource identity
- no normalized platform lifecycle
- redirects point to slugs rather than a stable resource
- WordPress status remains mixed with platform lifecycle

### Playlist

Canonical table: `public.wk_playlists`

Current stable identifier:

- `id uuid primary key`

Current route identity:

- `slug text unique`

Current ownership representation:

- `created_by uuid references auth.users`

Current lifecycle:

- draft
- in progress
- submitted for review
- approved
- rejected
- published
- archived

Compatibility fields:

- `source_inquiry_id`
- `source_work_product_link_id`

Material gaps:

- no shared resource identity
- legacy Institute links remain embedded in the canonical row
- no resource-owned alias history
- no platform-wide visibility contract

### Registry

Initial canonical tables:

- `public.registry_artists`
- `public.registry_releases`
- `public.registry_tracks`

Current stable identifiers:

- domain UUID primary keys

Current Registry-wide read helper:

- `public.registry_entity_index`

Important boundary:

`registry_entity_index` remains a Registry read index. It must not become the
global resource authority.

Material gaps:

- no platform-wide resource identity
- lifecycle vocabulary differs from Article and Playlist
- ownership is not consistently represented
- Registry aliases are domain-specific
- release and track slugs are indexed but not globally unique

### Aliases and redirects

Current authorities include:

- `public.wk_slug_redirects`
- `public.registry_artist_aliases`

Material gaps:

- aliases do not target one stable resource identity
- redirect ownership is represented through text such as `entity_type`
- old and new slugs can outlive the canonical object without a direct resource
  foreign key
- different domains implement aliases differently

## Initial architecture direction

### Domain schemas

PR 1A should establish the first permanent domain boundaries without moving
existing content immediately.

Expected schemas:

- `editorial`
- `registry`
- `platform_private`

The exact names remain subject to migration rehearsal and API exposure
review.

### Resource-kind registry

A controlled registry should define supported kinds and their canonical
tables.

The first registered kinds should be limited to:

- article
- playlist
- registry artist

Do not register every future kind before the first vertical slice is proven.

### Global resource identity

The initial `editorial.resources` contract should provide:

- stable resource UUID
- registered resource kind
- canonical record UUID
- ownership
- visibility
- lifecycle state
- current public alias
- creation actor
- creation time

Domain content remains in:

- `public.wk_articles`
- `public.wk_playlists`
- the selected Registry canonical table

### Canonical pointer integrity

A resource must not rely only on:

- table name text
- entity type text
- slug text
- arbitrary JSON

The resource-kind registry must define the allowed canonical target.

A resource must be unique for its canonical record.

### Aliases

Resource aliases should point to `resource_id`.

An alias should record:

- resource
- route namespace
- path or slug
- whether it is canonical
- redirect status
- creation time
- retirement time
- replacement alias where applicable

Existing redirect tables remain available through a compatibility bridge
until public routes use the new identity safely.

### API boundary

The internal resource tables should not become an unrestricted browser write
surface.

Required principles:

- no anonymous writes
- no generic authenticated mutation access
- public reads only through an intentionally designed read contract
- RLS on any exposed table
- explicit grants
- no privileged public helper without a capability check
- no security-definer view

## Resolved architecture decisions

### Internal authority

`editorial.resources`, resource kinds, and resource aliases will live in the
non-exposed `editorial` schema.

They are permanent platform authorities and will not become unrestricted
browser tables.

### Public read boundary

Public resource reads will use a narrow `public` view created with
`security_invoker = true`.

The view will expose only fields required for route resolution and stable
cross-domain references.

PR 1A will not create a generic resource mutation RPC.

### Article ownership

The resource row will support a nullable structured `owner_id`.

The existing `wk_articles.author` text field remains the public byline and
will not be rewritten during PR 1A.

Structured Article ownership migration belongs to the Article authority
phase.

### First Registry proof

The first Registry vertical slice will use one active Registry artist.

Registry artists already have:

- UUID primary identity
- unique slugs
- an established public route
- an existing alias model
- active production usage

Registry releases and tracks remain future resource kinds because their slug
constraints and route scope require additional treatment.

### Alias representation

Resource aliases will store complete normalized public paths.

This supports:

- Article paths
- Playlist paths
- Registry artist paths
- future scoped release and track paths
- aliases that cannot be reconstructed safely from a single slug

Each path will belong to one resource.

### Existing redirects

`public.wk_slug_redirects` remains the active redirect authority during PR 1A.

The new alias layer will initially create canonical paths for the three proof
resources only.

PR 1A will not bulk migrate or retire existing redirects.

A later guarded compatibility migration may attach existing redirect rows to
resource identity after route resolution is proven.

### Playlist compatibility links

The following Playlist fields remain compatibility data:

- `source_inquiry_id`
- `source_work_product_link_id`

They will not be copied into the permanent resource identity contract.

They remain readable until the later Inquiry migration and legacy retirement
programme.

### Universal lifecycle

The first universal lifecycle vocabulary is:

- `draft`
- `active`
- `published`
- `archived`

Domain-specific review states remain in their canonical tables.

Initial mapping:

- published Article to `published`
- unpublished Article to `draft`
- published Playlist to `published`
- archived Playlist to `archived`
- other Playlist states to `active`
- active Registry artist to `active`
- draft or needs-review Registry artist to `draft`
- archived Registry artist to `archived`

### Visibility

The first visibility vocabulary is:

- `private`
- `internal`
- `public`

The proof resources will map as follows:

- published Article to `public`
- Playlist to `internal`
- active public Registry artist to `public`
- all other proof states to `internal`

Playlist remains internal because WAKILISHA does not yet have a canonical
public Playlist route. PR 1A must not invent one or treat a frozen Institute
route as permanent identity.

### First migration boundary

The first migration may create:

- `editorial.resource_kinds`
- `editorial.resources`
- `editorial.resource_aliases`
- a narrow public security-invoker read view
- exactly three proof resource rows
- exactly two canonical path aliases
- no Playlist alias until the canonical public Playlist product exists

The first migration must not:

- bulk backfill every Article
- bulk backfill every Playlist
- bulk backfill Registry
- replace `wk_slug_redirects`
- expose internal tables directly
- create generic browser write access
- introduce PR 1B command or job infrastructure

## Proposed first vertical slice

Use:

- Article: `the-rise-of-music-playlists`
- Playlist: `between-2018-and-2024-in-what-ways-did-sheng-function-inside-kenyan-gengeton-2`
- Registry artist: `khaligraph-jones`

The migration selects these records through stable, reviewable slugs.

Generated production UUIDs are not hardcoded into the migration.

## Required PR 1A tests

- resource kind cannot point to an unregistered canonical table
- one canonical record cannot receive two active resources
- one resource cannot change canonical domain silently
- alias uniqueness is enforced within its route namespace
- only one canonical alias exists per resource and namespace
- retired aliases remain resolvable
- anonymous users cannot mutate resources or aliases
- ordinary authenticated users cannot mutate resources without capability
- service and administrative writes remain auditable
- existing Article, Playlist, and Registry routes still resolve
- existing redirects continue to work
- rollback or forward repair preserves canonical domain records

## Exit gate

PR 1A closes only when:

- one Article has a stable resource identity
- one Playlist has a stable resource identity
- one Registry record has a stable resource identity
- shared systems can reference all three without polymorphic text guesses
- existing public routes remain functional
- production verification passes

## Repository Evidence: Article authority

### `wk_articles`

```text
src/types/database.types.ts:10073:      wk_articles: {
src/types/database.types.ts:10142:            foreignKeyName: "wk_articles_hero_image_id_fkey"
src/pages/LegacyArticleRedirect.tsx:46:        .from("wk_articles")
src/pages/admin/settings/email-briefings/components/ContentPicker.tsx:205:    .from("wk_articles")
src/pages/admin/institute/inquiry-interface/useWakilishaRecordSearch.ts:526:    source: "wk_articles",
src/pages/admin/content/publishing/page.tsx:37:        supabase.from("wk_articles").select("id, slug, title, wp_status, author, published_at, modified_at, created_at").order("created_at", { ascending: false }).limit(100),
src/pages/admin/content/articles/detail/components/ArticleInternalLinks.tsx:60:          .from("wk_articles")
src/pages/admin/content/pages/page.tsx:28:        .from("wk_articles")
src/pages/admin/dashboard/page.tsx:19:  Articles: "wk_articles",
src/pages/admin/dashboard/page.tsx:48:        "wk_articles",
src/pages/admin/media/broken/page.tsx:25:  { table: "wk_articles", column: "hero_image_id" },
src/pages/admin/media/missing/page.tsx:77:    table: "wk_articles",
src/pages/artists/detail/components/ArtistTaggedArticles.tsx:57:      .from("wk_articles")
src/services/wordpressConnectService.ts:537:    articles: "wk_articles",
src/services/articles/articleAdminService.ts:144:    .from("wk_articles")
src/services/articles/articleAdminService.ts:191:    .from("wk_articles")
src/services/articles/articleAdminService.ts:273:    .from("wk_articles")
src/services/articles/articleAdminService.ts:303:    .from("wk_articles")
src/services/articles/articleAdminService.ts:320:    .from("wk_articles")
src/services/articles/articleAdminService.ts:372:      .from("wk_articles")
src/services/articles/articleAdminService.ts:606:      .from("wk_articles")
src/services/articles/articleAdminService.ts:626:    .from("wk_articles")
src/services/articles/articleAdminService.ts:664:    .from("wk_articles")
src/services/articles/articleAdminService.ts:730:      .from("wk_articles")
src/services/mediaService.ts:175:  { table: "wk_articles", column: "hero_image_id", id_column: "id", label_column: "title" },
supabase/migrations/202607020005_create_institute_article_draft_rpc.sql:44:  while exists (select 1 from public.wk_articles where slug = candidate_slug) loop
supabase/migrations/202607020005_create_institute_article_draft_rpc.sql:49:  insert into public.wk_articles (
scripts/security/verify-public-read-perimeter.sql:31:  has_table_privilege('anon', 'public.wk_articles', 'select')
scripts/security/verify-public-read-perimeter.sql:32:    as wk_articles_public_read,
scripts/security/verify-phase0a-privileged-utility-rpc-lockdown.sql:176:  if not has_table_privilege('anon', 'public.wk_articles', 'select')
scripts/charts/repaired-content-details-api.ts:931:  if (await hasTable("public.wk_articles")) {
scripts/charts/repaired-content-details-api.ts:934:      from public.wk_articles a
scripts/charts/repaired-content-api.ts:518:    if (await hasTable("public.wk_articles")) {
scripts/charts/repaired-content-api.ts:521:        from public.wk_articles
scripts/content/import-raw-content.ts:12:  "wk_articles.csv",
docs/supabase-preliminary-data-audit.md:9:| `wk_articles` | 217 |
docs/permissions-audit-2026-06-17.md:7:The `wk_articles` INSERT policy checks `current_user_has_capability('edit_own_articles')`, which runs as:
docs/permissions-audit-2026-06-17.md:23:INSERT → wk_articles INSERT policy
docs/permissions-audit-2026-06-17.md:32:Result: Even a correctly-assigned administrator hits permission denied on `wk_articles` INSERT.
docs/permissions-audit-2026-06-17.md:103:### `wk_articles`
```

### `wk_article_revisions`

```text
src/types/database.types.ts:10022:      wk_article_revisions: {
src/pages/admin/content/articles/detail/components/ArticleRevisionHistory.tsx:125:        .from("wk_article_revisions")
src/services/articles/articleAdminService.ts:717:      .from("wk_article_revisions")
docs/permissions-audit-2026-06-17.md:191:| LOW | Audit other direct-insert pages for same RLS pattern | `wk_articles`, `wk_article_revisions` |
```

## Repository Evidence: Playlist authority

### `wk_playlists`

```text
src/types/database.types.ts:11507:            referencedRelation: "wk_playlists"
src/types/database.types.ts:11526:      wk_playlists: {
src/types/database.types.ts:11580:            foreignKeyName: "wk_playlists_source_inquiry_id_fkey"
src/types/database.types.ts:11587:            foreignKeyName: "wk_playlists_source_work_product_link_id_fkey"
src/services/institute/institutePlaylistBridgeService.ts:142:    .from("wk_playlists")
src/services/institute/institutePlaylistBridgeService.ts:596:    .from("wk_playlists")
src/services/institute/institutePlaylistBridgeService.ts:641:    .from("wk_playlists")
supabase/migrations/202607050003_create_playlist_schema.sql:1:create table if not exists public.wk_playlists (
supabase/migrations/202607050003_create_playlist_schema.sql:38:  playlist_id uuid not null references public.wk_playlists(id) on delete cascade,
supabase/migrations/202607050003_create_playlist_schema.sql:87:create index if not exists wk_playlists_status_idx
supabase/migrations/202607050003_create_playlist_schema.sql:88:  on public.wk_playlists(status);
supabase/migrations/202607050003_create_playlist_schema.sql:90:create index if not exists wk_playlists_source_inquiry_idx
supabase/migrations/202607050003_create_playlist_schema.sql:91:  on public.wk_playlists(source_inquiry_id);
supabase/migrations/202607050003_create_playlist_schema.sql:108:drop trigger if exists wk_playlists_set_updated_at on public.wk_playlists;
supabase/migrations/202607050003_create_playlist_schema.sql:109:create trigger wk_playlists_set_updated_at
supabase/migrations/202607050003_create_playlist_schema.sql:110:before update on public.wk_playlists
supabase/migrations/202607050003_create_playlist_schema.sql:118:alter table public.wk_playlists enable row level security;
supabase/migrations/202607050003_create_playlist_schema.sql:121:drop policy if exists wk_playlists_public_published_read on public.wk_playlists;
supabase/migrations/202607050003_create_playlist_schema.sql:122:create policy wk_playlists_public_published_read
supabase/migrations/202607050003_create_playlist_schema.sql:123:on public.wk_playlists
supabase/migrations/202607050003_create_playlist_schema.sql:128:drop policy if exists wk_playlists_institute_read on public.wk_playlists;
supabase/migrations/202607050003_create_playlist_schema.sql:129:create policy wk_playlists_institute_read
supabase/migrations/202607050003_create_playlist_schema.sql:130:on public.wk_playlists
supabase/migrations/202607050003_create_playlist_schema.sql:140:drop policy if exists wk_playlists_institute_insert on public.wk_playlists;
supabase/migrations/202607050003_create_playlist_schema.sql:141:create policy wk_playlists_institute_insert
supabase/migrations/202607050003_create_playlist_schema.sql:142:on public.wk_playlists
supabase/migrations/202607050003_create_playlist_schema.sql:150:drop policy if exists wk_playlists_institute_update on public.wk_playlists;
supabase/migrations/202607050003_create_playlist_schema.sql:151:create policy wk_playlists_institute_update
supabase/migrations/202607050003_create_playlist_schema.sql:152:on public.wk_playlists
supabase/migrations/202607050003_create_playlist_schema.sql:166:drop policy if exists wk_playlists_institute_delete on public.wk_playlists;
supabase/migrations/202607050003_create_playlist_schema.sql:167:create policy wk_playlists_institute_delete
supabase/migrations/202607050003_create_playlist_schema.sql:168:on public.wk_playlists
supabase/migrations/202607050003_create_playlist_schema.sql:184:    from public.wk_playlists p
supabase/migrations/202607050003_create_playlist_schema.sql:238:grant select on public.wk_playlists to anon, authenticated;
supabase/migrations/202607050003_create_playlist_schema.sql:239:grant insert, update, delete on public.wk_playlists to authenticated;
supabase/migrations/202607050004_create_institute_playlist_draft_rpc.sql:68:  while exists (select 1 from public.wk_playlists where slug = candidate_slug) loop
supabase/migrations/202607050004_create_institute_playlist_draft_rpc.sql:73:  insert into public.wk_playlists (
supabase/migrations/202607050004_create_institute_playlist_draft_rpc.sql:189:  update public.wk_playlists
scripts/security/verify-public-read-perimeter.sql:49:  has_table_privilege('anon', 'public.wk_playlists', 'select')
scripts/security/verify-phase0a-privileged-utility-rpc-lockdown.sql:185:     or not has_table_privilege('anon', 'public.wk_playlists', 'select')
```

### `wk_playlist_items`

```text
src/types/database.types.ts:11429:      wk_playlist_items: {
src/types/database.types.ts:11504:            foreignKeyName: "wk_playlist_items_playlist_id_fkey"
src/types/database.types.ts:11511:            foreignKeyName: "wk_playlist_items_registry_release_id_fkey"
src/types/database.types.ts:11518:            foreignKeyName: "wk_playlist_items_registry_track_id_fkey"
src/services/institute/institutePlaylistBridgeService.ts:151:    .from("wk_playlist_items")
src/services/institute/institutePlaylistBridgeService.ts:214:    .from("wk_playlist_items")
src/services/institute/institutePlaylistBridgeService.ts:270:    .from("wk_playlist_items")
src/services/institute/institutePlaylistBridgeService.ts:283:    .from("wk_playlist_items")
src/services/institute/institutePlaylistBridgeService.ts:324:    .from("wk_playlist_items")
src/services/institute/institutePlaylistBridgeService.ts:357:    .from("wk_playlist_items")
src/services/institute/institutePlaylistBridgeService.ts:364:    .from("wk_playlist_items")
src/services/institute/institutePlaylistBridgeService.ts:371:    .from("wk_playlist_items")
supabase/migrations/202607050003_create_playlist_schema.sql:35:create table if not exists public.wk_playlist_items (
supabase/migrations/202607050003_create_playlist_schema.sql:93:create index if not exists wk_playlist_items_playlist_position_idx
supabase/migrations/202607050003_create_playlist_schema.sql:94:  on public.wk_playlist_items(playlist_id, position);
supabase/migrations/202607050003_create_playlist_schema.sql:96:create index if not exists wk_playlist_items_registry_track_idx
supabase/migrations/202607050003_create_playlist_schema.sql:97:  on public.wk_playlist_items(registry_track_id)
supabase/migrations/202607050003_create_playlist_schema.sql:100:create index if not exists wk_playlist_items_provider_idx
supabase/migrations/202607050003_create_playlist_schema.sql:101:  on public.wk_playlist_items(provider_key, provider_track_id)
supabase/migrations/202607050003_create_playlist_schema.sql:104:create index if not exists wk_playlist_items_isrc_idx
supabase/migrations/202607050003_create_playlist_schema.sql:105:  on public.wk_playlist_items(isrc)
supabase/migrations/202607050003_create_playlist_schema.sql:113:drop trigger if exists wk_playlist_items_set_updated_at on public.wk_playlist_items;
supabase/migrations/202607050003_create_playlist_schema.sql:114:create trigger wk_playlist_items_set_updated_at
supabase/migrations/202607050003_create_playlist_schema.sql:115:before update on public.wk_playlist_items
supabase/migrations/202607050003_create_playlist_schema.sql:119:alter table public.wk_playlist_items enable row level security;
supabase/migrations/202607050003_create_playlist_schema.sql:176:drop policy if exists wk_playlist_items_public_published_read on public.wk_playlist_items;
supabase/migrations/202607050003_create_playlist_schema.sql:177:create policy wk_playlist_items_public_published_read
supabase/migrations/202607050003_create_playlist_schema.sql:178:on public.wk_playlist_items
supabase/migrations/202607050003_create_playlist_schema.sql:185:    where p.id = wk_playlist_items.playlist_id
supabase/migrations/202607050003_create_playlist_schema.sql:190:drop policy if exists wk_playlist_items_institute_read on public.wk_playlist_items;
supabase/migrations/202607050003_create_playlist_schema.sql:191:create policy wk_playlist_items_institute_read
supabase/migrations/202607050003_create_playlist_schema.sql:192:on public.wk_playlist_items
supabase/migrations/202607050003_create_playlist_schema.sql:202:drop policy if exists wk_playlist_items_institute_insert on public.wk_playlist_items;
supabase/migrations/202607050003_create_playlist_schema.sql:203:create policy wk_playlist_items_institute_insert
supabase/migrations/202607050003_create_playlist_schema.sql:204:on public.wk_playlist_items
supabase/migrations/202607050003_create_playlist_schema.sql:212:drop policy if exists wk_playlist_items_institute_update on public.wk_playlist_items;
supabase/migrations/202607050003_create_playlist_schema.sql:213:create policy wk_playlist_items_institute_update
supabase/migrations/202607050003_create_playlist_schema.sql:214:on public.wk_playlist_items
supabase/migrations/202607050003_create_playlist_schema.sql:228:drop policy if exists wk_playlist_items_institute_delete on public.wk_playlist_items;
supabase/migrations/202607050003_create_playlist_schema.sql:229:create policy wk_playlist_items_institute_delete
```

## Repository Evidence: Registry authority

### `registry_artists`

```text
src/types/database.types.ts:5972:            referencedRelation: "registry_artists"
src/types/database.types.ts:5986:            referencedRelation: "registry_artists"
src/types/database.types.ts:6286:            referencedRelation: "registry_artists"
src/types/database.types.ts:6363:            referencedRelation: "registry_artists"
src/types/database.types.ts:6370:            referencedRelation: "registry_artists"
src/types/database.types.ts:6435:            referencedRelation: "registry_artists"
src/types/database.types.ts:6590:            referencedRelation: "registry_artists"
src/types/database.types.ts:6597:            referencedRelation: "registry_artists"
src/types/database.types.ts:6662:      registry_artists: {
src/types/database.types.ts:6737:            foreignKeyName: "registry_artists_public_image_id_fkey"
src/types/database.types.ts:12158:      admin_merge_registry_artists: {
src/types/database.types.ts:12184:      admin_safe_merge_registry_artists: {
src/types/database.types.ts:12194:      admin_search_registry_artists: {
src/components/admin/registry/artist-discography/ArtistDiscographyIntakeDrawer.tsx:202:          .from("registry_artists")
src/hooks/useTrackSearchData.ts:126:            .from("registry_artists")
src/hooks/useArtistSearchData.ts:26:          .from("registry_artists")
src/hooks/useRelatedEntities.ts:25:  artist: { table: "registry_artists", name_col: "display_name" },
src/hooks/useArtistSearchSuggestions.ts:47:          .from("registry_artists")
src/hooks/useGenreSearchData.ts:94:              .from("registry_artists")
src/pages/admin/settings/email-briefings/components/ContentPicker.tsx:228:  let request = supabase.from("registry_artists").select("id, slug, display_name, bio, public_image_url, metadata").eq("status", "active").order("display_name").limit(20);
src/pages/admin/institute/inquiry-interface/useWakilishaRecordSearch.ts:255:    source: "registry_artists",
src/pages/admin/institute/inquiry-interface/useWakilishaRecordSearch.ts:685:    .from("registry_artists")
src/pages/admin/institute/inquiry-interface/useWakilishaRecordSearch.ts:1008:      .from("registry_artists")
src/pages/admin/charts/artist-resolution/page.tsx:497:          .from("registry_artists")
src/pages/admin/charts/artist-resolution/page.tsx:511:            .from("registry_artists")
src/pages/admin/charts/artist-resolution/page.tsx:697:      const { data, error: searchError } = await supabase.rpc("admin_search_registry_artists", {
src/pages/admin/charts/artist-resolution/page.tsx:811:        const { data, error: searchError } = await supabase.rpc("admin_search_registry_artists", {
src/pages/admin/content/articles/detail/components/ArticleInternalLinks.tsx:70:          .from("registry_artists")
src/pages/admin/dashboard/page.tsx:22:  Artists: "registry_artists",
src/pages/admin/dashboard/page.tsx:43:        "registry_artists",
src/pages/admin/registry/artist-aliases/decouple/page.tsx:1149:      const { data, error } = await supabase.rpc("admin_search_registry_artists", {
src/pages/admin/registry/artist-aliases/decouple/page.tsx:1211:      const { data, error } = await supabase.rpc("admin_search_registry_artists", {
src/pages/admin/registry/artist-aliases/decouple/page.tsx:1258:        const { data, error } = await supabase.rpc("admin_search_registry_artists", {
src/pages/admin/registry/artist-aliases/decouple/page.tsx:1306:      const { data: searchData, error: searchError } = await supabase.rpc("admin_search_registry_artists", {
src/pages/admin/registry/artist-aliases/decouple/page.tsx:1372:        p_source_table: "registry_artists",
src/pages/admin/registry/artist-aliases/page.tsx:198:          registry_artists!inner(slug, display_name)
src/pages/admin/registry/artist-aliases/page.tsx:206:        const artist = (row.registry_artists as Record<string, unknown>) ?? {};
src/pages/admin/registry/artist-aliases/page.tsx:374:      const { data, error } = await supabase.rpc("admin_search_registry_artists", {
src/pages/admin/registry/artist-aliases/page.tsx:452:      const { data, error } = await supabase.rpc("admin_safe_merge_registry_artists", {
src/pages/admin/registry/artists/intake/page.tsx:42:  registry_artists?: RegistryArtistHit | null;
```

### `registry_releases`

```text
src/types/database.types.ts:7804:            referencedRelation: "registry_releases"
src/types/database.types.ts:7851:      registry_releases: {
src/types/database.types.ts:7923:            foreignKeyName: "registry_releases_artwork_image_id_fkey"
src/types/database.types.ts:7930:            foreignKeyName: "registry_releases_label_id_fkey"
src/types/database.types.ts:8397:            referencedRelation: "registry_releases"
src/types/database.types.ts:11514:            referencedRelation: "registry_releases"
src/hooks/useReleaseSearchData.ts:26:          .from("registry_releases")
src/hooks/useLabelSearchData.ts:43:            .from("registry_releases")
src/hooks/useTrackSearchData.ts:147:            .from("registry_releases")
src/hooks/useRelatedEntities.ts:27:  release: { table: "registry_releases", name_col: "title" },
src/pages/admin/settings/email-briefings/components/ContentPicker.tsx:245:  let request = supabase.from("registry_releases").select("id, slug, title, release_type, release_date, artwork_url").eq("status", "active").order("release_date", { ascending: false }).limit(20);
src/pages/admin/institute/inquiry-interface/useWakilishaRecordSearch.ts:388:    source: "registry_releases",
src/pages/admin/institute/inquiry-interface/useWakilishaRecordSearch.ts:718:      ? supabase.from("registry_releases").select("id, slug, title, release_type, release_date, artwork_url, status").in("id", releaseIds)
src/pages/admin/institute/inquiry-interface/useWakilishaRecordSearch.ts:747:    .from("registry_releases")
src/pages/admin/institute/inquiry-interface/useWakilishaRecordSearch.ts:1041:        ? supabase.from("registry_releases").select("id, slug, title, release_type, release_date, artwork_url, status, metadata").in("id", releaseIds).limit(40)
src/pages/admin/institute/inquiry-interface/useWakilishaRecordSearch.ts:1126:        ? supabase.from("registry_releases").select("id, slug, title, release_type, release_date, artwork_url, status, metadata").eq("id", releaseId).maybeSingle()
src/pages/admin/institute/inquiry-interface/useWakilishaRecordSearch.ts:1160:      .from("registry_releases")
src/pages/admin/institute/inquiry-interface/useWakilishaRecordSearch.ts:1291:      .from("registry_releases")
src/pages/admin/content/articles/detail/components/ArticleInternalLinks.tsx:79:          .from("registry_releases")
src/pages/admin/content/articles/detail/components/ArticleRegistrySearch.tsx:55:        .from("registry_releases")
src/pages/admin/imports/page.tsx:101:            Connects to WordPress MySQL database, reads <strong>wp_wkcharts_release_shells</strong>, <strong>wp_wkcharts_tracks</strong>, and artist/track relationships, then populates <code className="text-[11px] font-mono bg-wk-bg-subtle px-1 rounded">registry_releases</code>, <code className="text-[11px] font-mono bg-wk-bg-subtle px-1 rounded">registry_tracks</code>, <code className="text-[11px] font-mono bg-wk-bg-subtle px-1 rounded">registry_release_artists</code>, and <code className="text-[11px] font-mono bg-wk-bg-subtle px-1 rounded">registry_release_tracks</code>.
src/pages/admin/dashboard/page.tsx:24:  Releases: "registry_releases",
src/pages/admin/dashboard/page.tsx:45:        "registry_releases",
src/pages/admin/registry/releases/detail/page.tsx:116:      const query = supabase.from("registry_releases").select(
src/pages/admin/registry/releases/detail/page.tsx:250:    const { error } = await supabase.from("registry_releases").update(payload).eq("id", release.id);
src/pages/admin/registry/releases/detail/page.tsx:262:      .from("registry_releases")
src/pages/admin/registry/page.tsx:62:    { entity: "releases", table: "registry_releases", label: "Releases", icon: "Disc", fields: [
src/pages/admin/registry/page.tsx:182:      table: "registry_releases",
src/pages/admin/registry/page.tsx:238:    { table: "registry_releases", type: "release", nameField: "title", icon: "Disc" },
src/pages/admin/media/broken/page.tsx:27:  { table: "registry_releases", column: "artwork_image_id" },
src/pages/admin/media/missing/page.tsx:57:    table: "registry_releases",
src/pages/magazine/article/components/ArticleReleaseEmbeds.tsx:210:      .from("registry_releases")
src/pages/magazine/article/components/ArticleReleaseEmbeds.tsx:377:    .from("registry_releases")
src/pages/magazine/article/components/ArticleTrackEmbeds.tsx:132:      .from("registry_releases")
src/services/wordpressConnectService.ts:534:    releases: "registry_releases",
src/services/publicContent/client.ts:914:    .from("registry_releases")
src/services/publicContent/client.ts:1225:      .from("registry_releases")
src/services/publicContent/client.ts:1392:      source: "registry_releases",
src/services/publicContent/client.ts:1395:      artworkSource: releaseRow.artwork_url ? "registry_releases" : "generated",
src/services/publicContent/client.ts:1507:    .from("registry_releases")
```

### `registry_tracks`

```text
src/types/database.types.ts:8188:            referencedRelation: "registry_tracks"
src/types/database.types.ts:8262:            referencedRelation: "registry_tracks"
src/types/database.types.ts:8312:      registry_tracks: {
src/types/database.types.ts:8387:            foreignKeyName: "registry_tracks_artwork_image_id_fkey"
src/types/database.types.ts:8394:            foreignKeyName: "registry_tracks_release_id_fkey"
src/types/database.types.ts:11521:            referencedRelation: "registry_tracks"
src/components/admin/registry/RegistryEntityEditorDrawer.tsx:201:                .from("registry_tracks")
src/hooks/useTrackSearchData.ts:67:          .from("registry_tracks")
src/hooks/useRelatedEntities.ts:26:  track: { table: "registry_tracks", name_col: "title" },
src/pages/admin/institute/inquiry-interface/useWakilishaRecordSearch.ts:315:    source: "registry_tracks",
src/pages/admin/institute/inquiry-interface/useWakilishaRecordSearch.ts:700:    .from("registry_tracks")
src/pages/admin/institute/inquiry-interface/useWakilishaRecordSearch.ts:1038:        ? supabase.from("registry_tracks").select("id, slug, title, artwork_url, preview_url, status, metadata").in("id", trackIds).limit(40)
src/pages/admin/institute/inquiry-interface/useWakilishaRecordSearch.ts:1112:      .from("registry_tracks")
src/pages/admin/institute/inquiry-interface/useWakilishaRecordSearch.ts:1224:        ? supabase.from("registry_tracks").select("id, slug, title, artwork_url, preview_url").in("id", trackIds)
src/pages/admin/institute/inquiry-interface/WakilishaRecordWorkspace.tsx:367:                Loaded from registry_release_tracks and registry_tracks.
src/pages/admin/imports/page.tsx:101:            Connects to WordPress MySQL database, reads <strong>wp_wkcharts_release_shells</strong>, <strong>wp_wkcharts_tracks</strong>, and artist/track relationships, then populates <code className="text-[11px] font-mono bg-wk-bg-subtle px-1 rounded">registry_releases</code>, <code className="text-[11px] font-mono bg-wk-bg-subtle px-1 rounded">registry_tracks</code>, <code className="text-[11px] font-mono bg-wk-bg-subtle px-1 rounded">registry_release_artists</code>, and <code className="text-[11px] font-mono bg-wk-bg-subtle px-1 rounded">registry_release_tracks</code>.
src/pages/admin/dashboard/page.tsx:23:  Tracks: "registry_tracks",
src/pages/admin/dashboard/page.tsx:44:        "registry_tracks",
src/pages/admin/registry/releases/detail/page.tsx:168:              .from("registry_tracks")
src/pages/admin/registry/tracks/detail/page.tsx:78:        .from("registry_tracks")
src/pages/admin/registry/tracks/detail/page.tsx:136:    const { error } = await supabase.from("registry_tracks").update(payload).eq("id", track.id);
src/pages/admin/registry/tracks/detail/page.tsx:150:      .from("registry_tracks")
src/pages/admin/registry/page.tsx:56:    { entity: "tracks", table: "registry_tracks", label: "Tracks", icon: "Music", fields: [
src/pages/admin/registry/page.tsx:162:      table: "registry_tracks",
src/pages/admin/registry/page.tsx:172:      table: "registry_tracks",
src/pages/admin/registry/page.tsx:237:    { table: "registry_tracks", type: "track", nameField: "title", icon: "Music" },
src/pages/admin/media/broken/page.tsx:28:  { table: "registry_tracks", column: "artwork_image_id" },
src/pages/admin/media/missing/page.tsx:67:    table: "registry_tracks",
src/pages/magazine/article/components/ArticleReleaseEmbeds.tsx:247:          .from("registry_tracks")
src/pages/magazine/article/components/ArticleReleaseEmbeds.tsx:439:        .from("registry_tracks")
src/pages/magazine/article/components/ArticleTrackEmbeds.tsx:96:    .from("registry_tracks")
src/services/wordpressConnectService.ts:532:    tracks: "registry_tracks",
src/services/publicContent/client.ts:710:    .from("registry_tracks")
src/services/publicContent/client.ts:1260:    .from("registry_tracks")
src/services/chartsPublic/playbackEnrichment.ts:102:        .from("registry_tracks")
src/services/chartsPublic/playbackEnrichment.ts:149:          .from("registry_tracks")
src/services/seoGrowthActions.ts:307:        ? supabase.from("registry_tracks").select("*").in("id", trackIds).limit(80)
src/services/registry/admin/entitySchemas.ts:138:  table: "registry_tracks",
src/services/mediaService.ts:178:  { table: "registry_tracks", column: "artwork_image_id", id_column: "id", label_column: "title" },
src/services/legacyImport/wordpress/mappings.ts:19:  { sourceKind: "chart_entry", legacyField: "title", targetTable: "registry_tracks", targetField: "title", required: true },
```

### `registry_entity_index`

```text
src/types/database.types.ts:11848:      registry_entity_index: {
supabase/migrations/20260711134904_resolve_registry_relationship_endpoint_rpc.sql:14:  v_entity public.registry_entity_index;
supabase/migrations/20260711134904_resolve_registry_relationship_endpoint_rpc.sql:35:  from public.registry_entity_index
supabase/migrations/20260711134849_registry_relationship_endpoint_resolution_queue.sql:19:  from public.registry_entity_index i
supabase/migrations/20260711134849_registry_relationship_endpoint_resolution_queue.sql:38:  from public.registry_entity_index i
supabase/migrations/20260714190000_canonicalize_remaining_numbered_tracks.sql:502:  join public.registry_entity_index idx
supabase/migrations/20260714203000_delete_rhumba_mali_safi_for_reingest.sql:179:    join public.registry_entity_index idx
supabase/migrations/20260714203000_delete_rhumba_mali_safi_for_reingest.sql:184:      'A target track remains in registry_entity_index';
supabase/migrations/20260714173000_consolidate_wanavokali_tequila.sql:218:  from public.registry_entity_index
supabase/migrations/20260714173000_consolidate_wanavokali_tequila.sql:233:    from public.registry_entity_index
supabase/migrations/20260714173000_consolidate_wanavokali_tequila.sql:248:    from public.registry_entity_index
supabase/migrations/20260714173000_consolidate_wanavokali_tequila.sql:693:  from public.registry_entity_index
supabase/migrations/20260714173000_consolidate_wanavokali_tequila.sql:710:    from public.registry_entity_index
supabase/migrations/20260711133829_registry_entity_relationship_creation_rpc.sql:22:  v_source public.registry_entity_index;
supabase/migrations/20260711133829_registry_entity_relationship_creation_rpc.sql:23:  v_target public.registry_entity_index;
supabase/migrations/20260711133829_registry_entity_relationship_creation_rpc.sql:58:  from public.registry_entity_index
supabase/migrations/20260711133829_registry_entity_relationship_creation_rpc.sql:68:  from public.registry_entity_index
supabase/migrations/20260711130644_registry_canonical_entity_index_view.sql:1:create or replace view public.registry_entity_index
supabase/migrations/20260711130644_registry_canonical_entity_index_view.sql:23:comment on view public.registry_entity_index is
scripts/registry/verify-registry-relationship-endpoint-resolution.sql:32:    select 1 from public.registry_entity_index i
scripts/registry/verify-registry-relationship-endpoint-resolution.sql:41:    select 1 from public.registry_entity_index i
scripts/registry/verify-registry-canonical-entity-index.sql:19:from public.registry_entity_index
scripts/registry/verify-registry-canonical-entity-index.sql:29:from public.registry_entity_index;
scripts/registry/verify-registry-canonical-entity-index.sql:35:  to_regclass('public.registry_entity_index') is not null as registry_entity_index_exists;
```

## Repository Evidence: Aliases and redirects

### `wk_slug_redirects`

```text
src/types/database.types.ts:11595:      wk_slug_redirects: {
src/pages/LegacyArticleRedirect.tsx:12: * Also respects wk_slug_redirects [em dash] if an article's slug was changed
src/pages/LegacyArticleRedirect.tsx:34:        .from("wk_slug_redirects")
src/services/slugRedirects.ts:90:    .from("wk_slug_redirects")
src/services/articles/articleAdminService.ts:526:    await supabase.from("wk_slug_redirects").insert({
src/services/articles/articleAdminService.ts:542:    .from("wk_slug_redirects")
src/services/articles/articleAdminService.ts:723:      .from("wk_slug_redirects")
supabase/migrations/20260713235900_path_aware_scoped_slug_redirects.sql:9:-- wk_slug_redirects_old_path_unique.
supabase/migrations/20260713235900_path_aware_scoped_slug_redirects.sql:21:    and tablename = 'wk_slug_redirects'
supabase/migrations/20260713235900_path_aware_scoped_slug_redirects.sql:22:    and indexname = 'wk_slug_redirects_scoped_entity_unique';
supabase/migrations/20260713235900_path_aware_scoped_slug_redirects.sql:26:      'STOP: Expected wk_slug_redirects_scoped_entity_unique to exist';
supabase/migrations/20260713235900_path_aware_scoped_slug_redirects.sql:41:      and tablename = 'wk_slug_redirects'
supabase/migrations/20260713235900_path_aware_scoped_slug_redirects.sql:42:      and indexname = 'wk_slug_redirects_old_path_unique'
supabase/migrations/20260713235900_path_aware_scoped_slug_redirects.sql:50:    from public.wk_slug_redirects
supabase/migrations/20260713235900_path_aware_scoped_slug_redirects.sql:63:    from public.wk_slug_redirects
supabase/migrations/20260713235900_path_aware_scoped_slug_redirects.sql:74:drop index public.wk_slug_redirects_scoped_entity_unique;
supabase/migrations/20260713235900_path_aware_scoped_slug_redirects.sql:77:  wk_slug_redirects_scoped_path_unique
supabase/migrations/20260713235900_path_aware_scoped_slug_redirects.sql:78:on public.wk_slug_redirects (
supabase/migrations/20260713235900_path_aware_scoped_slug_redirects.sql:87:comment on index public.wk_slug_redirects_scoped_path_unique is
supabase/migrations/20260713235900_path_aware_scoped_slug_redirects.sql:96:      and tablename = 'wk_slug_redirects'
supabase/migrations/20260713235900_path_aware_scoped_slug_redirects.sql:97:      and indexname = 'wk_slug_redirects_scoped_entity_unique'
supabase/migrations/20260713235900_path_aware_scoped_slug_redirects.sql:107:      and tablename = 'wk_slug_redirects'
supabase/migrations/20260713235900_path_aware_scoped_slug_redirects.sql:108:      and indexname = 'wk_slug_redirects_scoped_path_unique'
supabase/migrations/20260713235900_path_aware_scoped_slug_redirects.sql:120:      and tablename = 'wk_slug_redirects'
supabase/migrations/20260713235900_path_aware_scoped_slug_redirects.sql:121:      and indexname = 'wk_slug_redirects_old_path_unique'
supabase/migrations/20260712213000_scoped_entity_slug_redirects.sql:3:alter table public.wk_slug_redirects
supabase/migrations/20260712213000_scoped_entity_slug_redirects.sql:10:alter table public.wk_slug_redirects
supabase/migrations/20260712213000_scoped_entity_slug_redirects.sql:11:  add constraint wk_slug_redirects_redirect_status_check
supabase/migrations/20260712213000_scoped_entity_slug_redirects.sql:15:  wk_slug_redirects_article_slug_unique
supabase/migrations/20260712213000_scoped_entity_slug_redirects.sql:16:on public.wk_slug_redirects (
supabase/migrations/20260712213000_scoped_entity_slug_redirects.sql:24:  wk_slug_redirects_scoped_entity_unique
supabase/migrations/20260712213000_scoped_entity_slug_redirects.sql:25:on public.wk_slug_redirects (
supabase/migrations/20260712213000_scoped_entity_slug_redirects.sql:33:  wk_slug_redirects_old_path_unique
supabase/migrations/20260712213000_scoped_entity_slug_redirects.sql:34:on public.wk_slug_redirects (
supabase/migrations/20260712213000_scoped_entity_slug_redirects.sql:40:  wk_slug_redirects_scoped_lookup_idx
supabase/migrations/20260712213000_scoped_entity_slug_redirects.sql:41:on public.wk_slug_redirects (
supabase/migrations/20260712213000_scoped_entity_slug_redirects.sql:47:comment on column public.wk_slug_redirects.scope_slug is
supabase/migrations/20260712213000_scoped_entity_slug_redirects.sql:50:comment on column public.wk_slug_redirects.old_path is
supabase/migrations/20260712213000_scoped_entity_slug_redirects.sql:53:comment on column public.wk_slug_redirects.new_path is
supabase/migrations/20260712213000_scoped_entity_slug_redirects.sql:56:comment on column public.wk_slug_redirects.redirect_status is
```

### `registry_artist_aliases`

```text
src/types/database.types.ts:6235:      registry_artist_aliases: {
src/types/database.types.ts:6283:            foreignKeyName: "registry_artist_aliases_canonical_artist_id_fkey"
src/pages/admin/institute/inquiry-interface/useWakilishaRecordSearch.ts:1019:      supabase.from("registry_artist_aliases").select("alias_slug, alias_display_name, confidence, source, notes, provider_type, provider_id, provider_uri, status").eq("canonical_artist_id", artistId).eq("status", "active"),
src/pages/admin/registry/artist-aliases/page.tsx:194:        .from("registry_artist_aliases")
src/pages/admin/registry/artist-aliases/page.tsx:348:      const { error } = await supabase.from("registry_artist_aliases").delete().eq("id", id);
supabase/migrations/20260711144100_registry_endpoint_work_queue_classification.sql:1:create or replace view public.registry_relationship_endpoint_work_queue with (security_invoker = true) as select u.relationship_id,u.missing_side,u.missing_entity_type,u.legacy_slug,u.relationship_type,u.relationship_role,u.source_entity_id,u.target_entity_id,count(a.canonical_artist_id)::integer as alias_match_count,min(a.canonical_artist_id::text)::uuid as alias_candidate_id,case when count(a.canonical_artist_id)=1 then 'ready_to_resolve' when count(a.canonical_artist_id)>1 then 'ambiguous_alias' else 'missing_entity' end as endpoint_work_state from public.registry_unresolved_relationship_endpoints u left join public.registry_artist_aliases a on u.missing_entity_type='artist' and a.alias_slug=u.legacy_slug and coalesce(a.status,'active')<>'rejected' group by u.relationship_id,u.missing_side,u.missing_entity_type,u.legacy_slug,u.relationship_type,u.relationship_role,u.source_entity_id,u.target_entity_id;;
supabase/migrations/202606240007_chart_artist_alias_resolution.sql:43:    join public.registry_artist_aliases a
supabase/migrations/202606240007_chart_artist_alias_resolution.sql:157:  update public.registry_artist_aliases a
supabase/migrations/202606240007_chart_artist_alias_resolution.sql:170:    insert into public.registry_artist_aliases (
supabase/migrations/202606240015_fix_origin_queue_and_rerun.sql:87:    left join public.registry_artist_aliases a
supabase/migrations/20260711150836_registry_accept_missing_artist_intake_rpc.sql:17:update public.registry_artist_aliases set canonical_artist_id=artist_id,alias_display_name=btrim(s.title),confidence=100,source='manual_intake',notes=btrim(p_review_reason),status='active' where lower(alias_slug)=lower(slug);
supabase/migrations/20260711150836_registry_accept_missing_artist_intake_rpc.sql:18:if not found then insert into public.registry_artist_aliases(alias_slug,canonical_artist_id,alias_display_name,confidence,source,notes,status) values(slug,artist_id,btrim(s.title),100,'manual_intake',btrim(p_review_reason),'active'); end if;
supabase/migrations/202606240008_allow_service_role_chart_artist_alias_resolution.sql:45:  update public.registry_artist_aliases a
supabase/migrations/202606240008_allow_service_role_chart_artist_alias_resolution.sql:58:    insert into public.registry_artist_aliases (
supabase/migrations/202606250008_fix_safe_artist_merge_alias_timestamp.sql:1:-- Hotfix: registry_artist_aliases does not consistently have updated_at.
supabase/migrations/202606250008_fix_safe_artist_merge_alias_timestamp.sql:74:  update public.registry_artist_aliases
supabase/migrations/202606250008_fix_safe_artist_merge_alias_timestamp.sql:87:    insert into public.registry_artist_aliases (
supabase/migrations/202606250008_fix_safe_artist_merge_alias_timestamp.sql:109:  update public.registry_artist_aliases
supabase/migrations/202606240019_registry_artist_manual_merge.sql:137:  update public.registry_artist_aliases
supabase/migrations/202606240019_registry_artist_manual_merge.sql:150:    insert into public.registry_artist_aliases (
supabase/migrations/202606240019_registry_artist_manual_merge.sql:171:  update public.registry_artist_aliases
supabase/migrations/202606250007_safe_artist_alias_merge_preview.sql:162:      from public.registry_artist_aliases a
supabase/migrations/202606250007_safe_artist_alias_merge_preview.sql:239:  update public.registry_artist_aliases
supabase/migrations/202606250007_safe_artist_alias_merge_preview.sql:252:    insert into public.registry_artist_aliases (
supabase/migrations/202606250007_safe_artist_alias_merge_preview.sql:274:  update public.registry_artist_aliases
supabase/migrations/202606250001_artist_credit_decouple.sql:598:  update public.registry_artist_aliases a
supabase/migrations/20260711144129_registry_alias_endpoint_resolver.sql:1:create or replace function public.resolve_registry_relationship_endpoint_from_alias(p_relationship_id uuid,p_endpoint_side text,p_reason text) returns public.registry_entity_relationships language plpgsql security definer set search_path=public,auth as $$ declare v_relationship public.registry_entity_relationships; v_slug text; v_candidate_id uuid; v_match_count integer; v_result public.registry_entity_relationships; begin if not (auth.role()='service_role' or public.current_user_has_capability('manage_registry') or public.current_user_has_capability('manage_review_queue') or public.current_user_is_administrator()) then raise exception 'You do not have permission to resolve Registry relationship endpoints.'; end if; if p_endpoint_side not in ('source','target') then raise exception 'Endpoint side must be source or target.'; end if; if nullif(btrim(p_reason),'') is null then raise exception 'A resolution reason is required.'; end if; select * into v_relationship from public.registry_entity_relationships where id=p_relationship_id for update; if not found then raise exception 'Registry relationship not found.'; end if; v_slug:=case when p_endpoint_side='source' then v_relationship.source_slug else v_relationship.target_slug end; select count(*)::integer,min(a.canonical_artist_id::text)::uuid into v_match_count,v_candidate_id from public.registry_artist_aliases a where a.alias_slug=v_slug and coalesce(a.status,'active')<>'rejected'; if v_match_count=0 then raise exception 'No active canonical artist alias match was found.'; end if; if v_match_count>1 then raise exception 'The artist alias is ambiguous and requires manual review.'; end if; select public.resolve_registry_relationship_endpoint(p_relationship_id,p_endpoint_side,'artist',v_candidate_id,p_reason) into v_result; return v_result; end; $$; revoke all on function public.resolve_registry_relationship_endpoint_from_alias(uuid,text,text) from public,anon; grant execute on function public.resolve_registry_relationship_endpoint_from_alias(uuid,text,text) to authenticated,service_role;;
supabase/migrations/202606240010_chart_run_integrity_gates.sql:85:    left join public.registry_artist_aliases a
supabase/migrations/202606240014_chart_origin_resolution_queue.sql:101:    left join public.registry_artist_aliases a
supabase/migrations/202606240009_chart_integrity_hard_gates.sql:84:    left join public.registry_artist_aliases a
supabase/migrations/202606240011_chart_candidate_origin_report.sql:81:    left join public.registry_artist_aliases a
```

### `slugRedirect`

```text
src/pages/tracks/lyrics/contribute/page.tsx:6:import { resolveScopedSlugRedirect } from '@/services/slugRedirects';
src/pages/tracks/detail/page.tsx:5:import { resolveScopedSlugRedirect } from "@/services/slugRedirects";
```

### `slug_redirect`

```text
src/types/database.types.ts:11595:      wk_slug_redirects: {
src/pages/LegacyArticleRedirect.tsx:12: * Also respects wk_slug_redirects [em dash] if an article's slug was changed
src/pages/LegacyArticleRedirect.tsx:34:        .from("wk_slug_redirects")
src/services/slugRedirects.ts:90:    .from("wk_slug_redirects")
src/services/articles/articleAdminService.ts:526:    await supabase.from("wk_slug_redirects").insert({
src/services/articles/articleAdminService.ts:542:    .from("wk_slug_redirects")
src/services/articles/articleAdminService.ts:723:      .from("wk_slug_redirects")
supabase/migrations/20260713235900_path_aware_scoped_slug_redirects.sql:9:-- wk_slug_redirects_old_path_unique.
supabase/migrations/20260713235900_path_aware_scoped_slug_redirects.sql:21:    and tablename = 'wk_slug_redirects'
supabase/migrations/20260713235900_path_aware_scoped_slug_redirects.sql:22:    and indexname = 'wk_slug_redirects_scoped_entity_unique';
supabase/migrations/20260713235900_path_aware_scoped_slug_redirects.sql:26:      'STOP: Expected wk_slug_redirects_scoped_entity_unique to exist';
supabase/migrations/20260713235900_path_aware_scoped_slug_redirects.sql:41:      and tablename = 'wk_slug_redirects'
supabase/migrations/20260713235900_path_aware_scoped_slug_redirects.sql:42:      and indexname = 'wk_slug_redirects_old_path_unique'
supabase/migrations/20260713235900_path_aware_scoped_slug_redirects.sql:50:    from public.wk_slug_redirects
supabase/migrations/20260713235900_path_aware_scoped_slug_redirects.sql:63:    from public.wk_slug_redirects
supabase/migrations/20260713235900_path_aware_scoped_slug_redirects.sql:74:drop index public.wk_slug_redirects_scoped_entity_unique;
supabase/migrations/20260713235900_path_aware_scoped_slug_redirects.sql:77:  wk_slug_redirects_scoped_path_unique
supabase/migrations/20260713235900_path_aware_scoped_slug_redirects.sql:78:on public.wk_slug_redirects (
supabase/migrations/20260713235900_path_aware_scoped_slug_redirects.sql:87:comment on index public.wk_slug_redirects_scoped_path_unique is
supabase/migrations/20260713235900_path_aware_scoped_slug_redirects.sql:96:      and tablename = 'wk_slug_redirects'
supabase/migrations/20260713235900_path_aware_scoped_slug_redirects.sql:97:      and indexname = 'wk_slug_redirects_scoped_entity_unique'
supabase/migrations/20260713235900_path_aware_scoped_slug_redirects.sql:107:      and tablename = 'wk_slug_redirects'
supabase/migrations/20260713235900_path_aware_scoped_slug_redirects.sql:108:      and indexname = 'wk_slug_redirects_scoped_path_unique'
supabase/migrations/20260713235900_path_aware_scoped_slug_redirects.sql:120:      and tablename = 'wk_slug_redirects'
supabase/migrations/20260713235900_path_aware_scoped_slug_redirects.sql:121:      and indexname = 'wk_slug_redirects_old_path_unique'
supabase/migrations/20260712213000_scoped_entity_slug_redirects.sql:3:alter table public.wk_slug_redirects
supabase/migrations/20260712213000_scoped_entity_slug_redirects.sql:10:alter table public.wk_slug_redirects
supabase/migrations/20260712213000_scoped_entity_slug_redirects.sql:11:  add constraint wk_slug_redirects_redirect_status_check
supabase/migrations/20260712213000_scoped_entity_slug_redirects.sql:15:  wk_slug_redirects_article_slug_unique
supabase/migrations/20260712213000_scoped_entity_slug_redirects.sql:16:on public.wk_slug_redirects (
supabase/migrations/20260712213000_scoped_entity_slug_redirects.sql:24:  wk_slug_redirects_scoped_entity_unique
supabase/migrations/20260712213000_scoped_entity_slug_redirects.sql:25:on public.wk_slug_redirects (
supabase/migrations/20260712213000_scoped_entity_slug_redirects.sql:33:  wk_slug_redirects_old_path_unique
supabase/migrations/20260712213000_scoped_entity_slug_redirects.sql:34:on public.wk_slug_redirects (
supabase/migrations/20260712213000_scoped_entity_slug_redirects.sql:40:  wk_slug_redirects_scoped_lookup_idx
supabase/migrations/20260712213000_scoped_entity_slug_redirects.sql:41:on public.wk_slug_redirects (
supabase/migrations/20260712213000_scoped_entity_slug_redirects.sql:47:comment on column public.wk_slug_redirects.scope_slug is
supabase/migrations/20260712213000_scoped_entity_slug_redirects.sql:50:comment on column public.wk_slug_redirects.old_path is
supabase/migrations/20260712213000_scoped_entity_slug_redirects.sql:53:comment on column public.wk_slug_redirects.new_path is
supabase/migrations/20260712213000_scoped_entity_slug_redirects.sql:56:comment on column public.wk_slug_redirects.redirect_status is
```

## Repository Evidence: Lifecycle and ownership

### `published_at`

```text
src/types/database.types.ts:1085:          published_at: string | null
src/types/database.types.ts:1112:          published_at?: string | null
src/types/database.types.ts:1139:          published_at?: string | null
src/types/database.types.ts:1358:          published_at: string | null
src/types/database.types.ts:1385:          published_at?: string | null
src/types/database.types.ts:1412:          published_at?: string | null
src/types/database.types.ts:2486:          published_at: string | null
src/types/database.types.ts:2518:          published_at?: string | null
src/types/database.types.ts:2550:          published_at?: string | null
src/types/database.types.ts:4161:          published_at: string | null
src/types/database.types.ts:4186:          published_at?: string | null
src/types/database.types.ts:4211:          published_at?: string | null
src/types/database.types.ts:4243:          published_at: string | null
src/types/database.types.ts:4262:          published_at?: string | null
src/types/database.types.ts:4281:          published_at?: string | null
src/types/database.types.ts:9075:          published_at: string | null
src/types/database.types.ts:9093:          published_at?: string | null
src/types/database.types.ts:9111:          published_at?: string | null
src/types/database.types.ts:9316:          published_at: string | null
src/types/database.types.ts:9331:          published_at?: string | null
src/types/database.types.ts:9346:          published_at?: string | null
src/types/database.types.ts:10032:          published_at: string | null
src/types/database.types.ts:10048:          published_at?: string | null
src/types/database.types.ts:10064:          published_at?: string | null
src/types/database.types.ts:10086:          published_at: string | null
src/types/database.types.ts:10108:          published_at?: string | null
src/types/database.types.ts:10130:          published_at?: string | null
src/types/database.types.ts:10255:          published_at: string | null
src/types/database.types.ts:10282:          published_at?: string | null
src/types/database.types.ts:10309:          published_at?: string | null
src/types/database.types.ts:11042:          published_at: string | null
src/types/database.types.ts:11067:          published_at?: string | null
src/types/database.types.ts:11092:          published_at?: string | null
src/types/database.types.ts:11324:          published_at: string | null
src/types/database.types.ts:11349:          published_at?: string | null
src/types/database.types.ts:11374:          published_at?: string | null
src/types/database.types.ts:11536:          published_at: string | null
src/types/database.types.ts:11553:          published_at?: string | null
src/types/database.types.ts:11570:          published_at?: string | null
src/types/database.types.ts:12956:          p_published_at?: string
```

### `wp_status`

```text
src/types/database.types.ts:10037:          wp_status: string | null
src/types/database.types.ts:10053:          wp_status?: string | null
src/types/database.types.ts:10069:          wp_status?: string | null
src/types/database.types.ts:10094:          wp_status: string | null
src/types/database.types.ts:10116:          wp_status?: string | null
src/types/database.types.ts:10138:          wp_status?: string | null
src/types/database.types.ts:12040:          wp_status: string | null
src/types/database.types.ts:12056:          wp_status?: never
src/types/database.types.ts:12072:          wp_status?: never
src/types/database.types.ts:12968:          wp_status: string
src/pages/LegacyArticleRedirect.tsx:49:        .neq("wp_status", "trash")
src/pages/admin/settings/email-briefings/components/ContentPicker.tsx:207:    .eq("wp_status", "publish")
src/pages/admin/content/publishing/page.tsx:37:        supabase.from("wk_articles").select("id, slug, title, wp_status, author, published_at, modified_at, created_at").order("created_at", { ascending: false }).limit(100),
src/pages/admin/content/publishing/page.tsx:38:        supabase.from("wk_guides").select("id, slug, title, wp_status, created_at, updated_at").order("created_at", { ascending: false }).limit(50),
src/pages/admin/content/publishing/page.tsx:49:          status: a.wp_status,
src/pages/admin/content/publishing/page.tsx:50:          wpStatus: a.wp_status,
src/pages/admin/content/publishing/page.tsx:64:          status: g.wp_status,
src/pages/admin/content/publishing/page.tsx:65:          wpStatus: g.wp_status,
src/pages/admin/content/articles/detail/components/ArticleRevisionHistory.tsx:20:  wp_status: string | null;
src/pages/admin/content/articles/detail/components/ArticleRevisionHistory.tsx:126:        .select("id, revision_number, created_at, created_by, title, content_html, excerpt, author, categories, tags, seo, wp_status, published_at")
src/pages/admin/content/articles/detail/components/ArticleRevisionHistory.tsx:346:                  <span className="uppercase">{rev.wp_status || "draft"}</span>
src/pages/admin/content/articles/detail/components/ArticleRevisionHistory.tsx:367:                    <p className="text-wk-text mt-0.5 uppercase">{rev.wp_status || "draft"}</p>
src/pages/admin/content/articles/detail/components/ArticleRevisionHistory.tsx:439:                    wpStatus: showConfirm.wp_status,
src/pages/admin/content/articles/detail/components/ArticleInternalLinks.tsx:62:          .eq("wp_status", "publish")
src/pages/admin/content/articles/detail/ArticleEditorWorkspace.tsx:516:    const expectedStatus = (extraFields.wp_status as string | undefined) ?? currentArticle.wpStatus;
src/pages/admin/content/articles/detail/ArticleEditorWorkspace.tsx:571:    const newStatus = (extraFields.wp_status as string | undefined) ?? currentArticle.wpStatus;
src/pages/admin/content/articles/detail/ArticleEditorWorkspace.tsx:593:      if (typeof extraFields.wp_status !== "undefined") {
src/pages/admin/content/articles/detail/ArticleEditorWorkspace.tsx:677:    const ok = await saveToSupabase({ wp_status: "draft" });
src/pages/admin/content/articles/detail/ArticleEditorWorkspace.tsx:700:      wp_status: isScheduled ? "future" : "publish",
src/pages/admin/content/articles/detail/ArticleEditorWorkspace.tsx:720:    const ok = await saveToSupabase({ wp_status: "draft" });
src/pages/admin/content/articles/detail/ArticleEditorWorkspace.tsx:737:    const ok = await saveToSupabase({ wp_status: newStatus });
src/pages/admin/content/articles/detail/ArticleEditorWorkspace.tsx:752:    const ok = await saveToSupabase({ wp_status: "pending" });
src/pages/admin/content/articles/new/page.tsx:76:          wp_status: "draft",
src/pages/admin/content/guides/page.tsx:13:  wp_status: string | null;
src/pages/admin/content/guides/page.tsx:29:        .select("slug, title, content, wp_status, created_at, updated_at")
src/pages/admin/content/guides/page.tsx:48:    const matchesStatus = statusFilter === "all" || g.wp_status === statusFilter;
src/pages/admin/content/guides/page.tsx:128:              key: "wp_status",
src/pages/admin/content/guides/page.tsx:131:              render: (row) => <StatusBadge status={row.wp_status} />,
src/pages/admin/content/pages/page.tsx:13:  wp_status: string | null;
src/pages/admin/content/pages/page.tsx:29:        .select("slug, title, raw_meta, wp_status, created_at, updated_at")
```

### `created_by`

```text
src/types/database.types.ts:236:          created_by: string | null
src/types/database.types.ts:265:          created_by?: string | null
src/types/database.types.ts:294:          created_by?: string | null
src/types/database.types.ts:2040:          created_by: string | null
src/types/database.types.ts:2048:          created_by?: string | null
src/types/database.types.ts:2056:          created_by?: string | null
src/types/database.types.ts:2469:          created_by: string | null
src/types/database.types.ts:2470:          created_by_email: string | null
src/types/database.types.ts:2501:          created_by?: string | null
src/types/database.types.ts:2502:          created_by_email?: string | null
src/types/database.types.ts:2533:          created_by?: string | null
src/types/database.types.ts:2534:          created_by_email?: string | null
src/types/database.types.ts:3714:          created_by: string | null
src/types/database.types.ts:3730:          created_by?: string | null
src/types/database.types.ts:3746:          created_by?: string | null
src/types/database.types.ts:3780:          created_by: string | null
src/types/database.types.ts:3800:          created_by?: string | null
src/types/database.types.ts:3820:          created_by?: string | null
src/types/database.types.ts:3936:          created_by: string | null
src/types/database.types.ts:3952:          created_by?: string | null
src/types/database.types.ts:3968:          created_by?: string | null
src/types/database.types.ts:4301:          created_by: string | null
src/types/database.types.ts:4319:          created_by?: string | null
src/types/database.types.ts:4337:          created_by?: string | null
src/types/database.types.ts:4551:          created_by: string | null
src/types/database.types.ts:4561:          created_by?: string | null
src/types/database.types.ts:4571:          created_by?: string | null
src/types/database.types.ts:4600:          created_by: string | null
src/types/database.types.ts:4619:          created_by?: string | null
src/types/database.types.ts:4638:          created_by?: string | null
src/types/database.types.ts:4675:          created_by: string | null
src/types/database.types.ts:4696:          created_by?: string | null
src/types/database.types.ts:4717:          created_by?: string | null
src/types/database.types.ts:4873:          created_by: string | null
src/types/database.types.ts:4891:          created_by?: string | null
src/types/database.types.ts:4909:          created_by?: string | null
src/types/database.types.ts:4939:          created_by: string | null
src/types/database.types.ts:4961:          created_by?: string | null
src/types/database.types.ts:4983:          created_by?: string | null
src/types/database.types.ts:5081:          created_by: string | null
```

### `source_inquiry_id`

```text
src/types/database.types.ts:11538:          source_inquiry_id: string | null
src/types/database.types.ts:11555:          source_inquiry_id?: string | null
src/types/database.types.ts:11572:          source_inquiry_id?: string | null
src/types/database.types.ts:11580:            foreignKeyName: "wk_playlists_source_inquiry_id_fkey"
src/types/database.types.ts:11581:            columns: ["source_inquiry_id"]
supabase/migrations/202607050003_create_playlist_schema.sql:24:  source_inquiry_id uuid references public.institute_inquiries(id) on delete set null,
supabase/migrations/202607050003_create_playlist_schema.sql:90:create index if not exists wk_playlists_source_inquiry_idx
supabase/migrations/202607050003_create_playlist_schema.sql:91:  on public.wk_playlists(source_inquiry_id);
supabase/migrations/202607050004_create_institute_playlist_draft_rpc.sql:79:    source_inquiry_id,
```

### `source_work_product_link_id`

```text
src/types/database.types.ts:11539:          source_work_product_link_id: string | null
src/types/database.types.ts:11556:          source_work_product_link_id?: string | null
src/types/database.types.ts:11573:          source_work_product_link_id?: string | null
src/types/database.types.ts:11587:            foreignKeyName: "wk_playlists_source_work_product_link_id_fkey"
src/types/database.types.ts:11588:            columns: ["source_work_product_link_id"]
supabase/migrations/202607050003_create_playlist_schema.sql:25:  source_work_product_link_id uuid references public.institute_work_product_links(id) on delete set null,
supabase/migrations/202607050004_create_institute_playlist_draft_rpc.sql:190:  set source_work_product_link_id = new_work_product_link_id
```

## Phase 1A final validation record

Validated on July 15, 2026.

- Production migration history contained 147 authoritative versions.
- The repository contained those 147 versions plus Phase 1A version `20260715054810`.
- No production-only versions, filename drift, or duplicate versions remained.
- Phase 1A was exercised against the real production schema and pinned production proof data inside a rollback-only transaction.
- The Article proof record was `the-rise-of-music-playlists`.
- The Playlist proof record was `between-2018-and-2024-in-what-ways-did-sheng-function-inside-kenyan-gengeton-2`.
- The Registry artist proof record was `khaligraph-jones`.
- Three stable resources and two canonical public aliases were created during rehearsal.
- The internal Playlist resource remained without a public route.
- Resource IDs and resource kinds could not be retargeted.
- Typed Article, Playlist, and Registry artist bindings could not be retargeted.
- All editorial tables had row level security enabled.
- Trigger functions were not executable by `anon` or `authenticated`.
- `public.wk_resource_index` used security-invoker semantics.
- The public resource index excluded `owner_id` and `created_by`.
- Anonymous and authenticated reads excluded the internal Playlist.
- The transaction rolled back successfully.
- Production migration history and persistent database objects remained unchanged.
- No preview branch or billable rehearsal environment remained active.

Fresh-branch replay remains affected by historical migrations that assume production-only relations exist. That portability repair is separate infrastructure work and is not part of the Phase 1A resource identity scope.
