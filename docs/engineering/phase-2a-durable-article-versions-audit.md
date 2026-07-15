# Phase 2A Durable Article Drafts and Immutable Versions Audit

## Status

Phase: Phase 2, PR 2A

Audit status: In progress

Implementation status: Contract established, current Article authority under audit

Production changed: No

## Authoritative objective

Make the Article domain the reference implementation for durable editorial
drafting and reconstructable versions.

Phase 2A must ensure that:

- drafts survive interruption
- stale clients cannot overwrite newer work
- every submitted version can be reconstructed

## Required build scope

Phase 2A includes:

- truthful autosave
- draft recovery
- revision pruning policy
- immutable review versions
- optimistic concurrency
- transactional save and revision creation
- normalized categories and tags
- ownership and edit scopes
- atomic slug and redirect handling
- migration of useful existing revisions

## Explicit exclusions

Phase 2A does not implement:

- review submission
- requested changes
- approval
- scheduling
- publication
- archive and restore
- publication snapshots
- public correction cases
- shared Sources
- shared Citations
- shared Credits
- Inquiry Mode
- Playlist, Audio, or Video version authority

Those belong to later programme slices.

## Authority rules

The Article domain remains the canonical authority for Article content.

Phase 2A must not create:

- a second Article editor
- a second Article content table
- client-owned revision identity
- mutable review snapshots
- JSON-only reusable taxonomy
- browser-orchestrated multi-request saves
- slug changes without redirect history
- revision rows that cannot reconstruct their Article state

## Audit questions

The audit must identify:

1. the current canonical Article table
2. the current Article editor route and save client
3. every existing Article revision or history table
4. every autosave and recovery mechanism
5. the current concurrency behaviour
6. current ownership and capability checks
7. category and tag authorities
8. current slug mutation and redirect behaviour
9. useful legacy revisions worth migrating
10. public and admin code coupled to mutable Article rows
11. lifecycle functions that already create snapshots
12. existing tests that claim revision or autosave coverage

## Required durable model

The implementation must resolve:

- stable Article identity
- mutable working draft state
- monotonic draft version or revision number
- expected-version writes
- immutable submitted review versions
- exact reconstructable Article snapshots
- author and editor ownership
- append-only slug history
- normalized category relationships
- normalized tag relationships
- bounded revision retention for non-submitted autosaves
- indefinite retention for submitted, approved, published, or corrected versions

## Required command behaviour

A save command must atomically:

1. verify the caller may edit the Article
2. verify the expected current draft version
3. reject stale writes
4. write the new draft state
5. create the required revision record
6. update the resource version pointer where appropriate
7. record slug history when the slug changes
8. update normalized taxonomy relationships
9. return the new version identity

The browser must not coordinate these writes independently.

## Required proof

Phase 2A must prove:

- a draft survives an interrupted editing session
- a recovered draft is byte-for-byte equivalent to the last accepted save
- two clients cannot silently overwrite each other
- a stale expected version receives a controlled conflict
- an immutable submitted version cannot be mutated
- the submitted version can reconstruct the complete Article
- later draft edits do not alter the submitted version
- a slug change and redirect record happen atomically
- category and tag relationships remain queryable
- unauthorized editors cannot modify the Article
- useful existing revisions remain available after migration

## Exit gate

Phase 2A closes only when:

- drafts survive interruption
- stale clients cannot overwrite newer content
- every submitted version can be reconstructed
- the implementation passes a rollback-only production-schema rehearsal
- one real Article proves recovery and concurrency behaviour
- the migration is reviewed and deployed
- the live schema baseline is refreshed
- no duplicate Article authority is introduced

## Audited current production authority

Audit date: July 15, 2026

### Canonical Article content

The current canonical Article content authority is:

- `public.wk_articles`
- admin editor route `/admin/content/articles/:slug`
- editor workspace `ArticleEditorWorkspace`
- browser service `articleAdminService`
- save RPC `public.update_article`

Phase 2A must preserve `public.wk_articles` as the canonical Article content
authority during the migration.

It must not introduce a second Article content table or a second Article
editor.

### Resource identity state

One production Article is currently registered in the Phase 1A resource
identity layer:

- Article slug `the-rise-of-music-playlists`
- Article ID `0d561d41-52dd-4d44-9e40-eb66e975fe02`
- Resource ID `b303153d-0800-4e8c-bbef-6ae819408df7`
- resource lifecycle state `published`
- resource visibility `public`

The production resource row currently has no owner:

- `owner_id` is null
- `created_by` is null

The Phase 1A resource table does not yet contain current-version or
published-version pointers.

Phase 2A must decide version-pointer ownership explicitly rather than
assuming those columns already exist.

### Existing save behaviour

The browser calls `public.update_article` with:

- Article UUID
- mutable JSON payload
- expected `updated_at`

This provides a timestamp-based stale-write check when the expected timestamp
is supplied.

The current editor can bypass the stale-write guard by:

1. reloading the latest Article
2. passing a null expected timestamp
3. overwriting the newer server state

This behaviour does not satisfy the Phase 2A exit gate.

Phase 2A must remove ordinary force-overwrite behaviour.

A rejected stale write must remain rejected until the editor intentionally
reconciles the competing versions.

### Existing revision behaviour

`public.wk_article_revisions` exists and the revision interface is present in
generated database types and the admin UI.

The production client service does not implement revision persistence:

- `createRevision` returns without writing
- `getLatestRevision` always returns null
- `pruneRevisions` returns without pruning

The editor therefore displays revision and recovery capability that does not
exist operationally.

### Existing autosave behaviour

The editor starts a ten-second autosave interval.

The interval calls the no-op `createRevision` service.

The interface may display an autosave timestamp even though no durable
revision was written.

Current autosave is therefore not truthful.

A browser crash, tab closure, network interruption, or device change can lose
unsaved work.

### Existing recovery behaviour

The editor checks for a revision newer than the Article row.

Because `getLatestRevision` always returns null, recovery never finds a
durable draft.

The current recovery interface does not satisfy the Phase 2A recovery
requirement.

### Existing revision UI

The revision history component queries `public.wk_article_revisions`
directly from the browser.

It supports:

- revision listing
- version comparison
- restoration into the local editor state

The component does not itself guarantee that:

- revisions were created transactionally with Article saves
- revision numbers are race-safe
- revisions are immutable
- submitted versions are retained indefinitely
- restored content is protected from concurrent overwrite

Phase 2A must preserve the useful comparison and restoration interface while
moving revision authority into server-side commands.

### Existing ownership behaviour

The editor determines ownership by comparing:

- the Article `author` display string
- the current administrator display name

It also accepts partial string matches.

This is not a durable ownership boundary.

Phase 2A must authorize edits using:

- `editorial.resources.owner_id`
- authenticated user identity
- explicit Article capabilities
- administrator authority

The human-readable Article author field remains editorial credit. It must not
remain the authorization identity.

### Existing taxonomy behaviour

The taxonomy UI loads canonical term records using:

- `get_taxonomy_terms`
- `create_taxonomy_term`

The editor then converts selected term names back into JSON objects and stores
them in:

- `wk_articles.categories`
- `wk_articles.tags`

The relationship between an Article and a taxonomy term is therefore not
normalized.

Term creation also has a plain-string fallback when canonical term creation
fails.

Phase 2A must create normalized Article-to-category and Article-to-tag
relationships.

Legacy JSON may remain temporarily for compatibility, but it must not remain
the canonical relationship authority.

### Existing slug behaviour

Slug collision checking occurs separately in the browser.

The Article save and slug redirect insertion are separate requests.

Redirect insertion is treated as non-blocking and failures are swallowed.

The current workflow can therefore commit a new slug without committing its
redirect history.

Phase 2A must move slug change and redirect creation into the same database
transaction as the accepted Article save.

### Existing lifecycle overlap

The current editor can directly change Article status to:

- draft
- pending
- future
- publish
- trash

It can also call Institute publication synchronization after the Article save.

Phase 2A does not redesign the full review and publication lifecycle.

Phase 2A must therefore:

- preserve existing lifecycle compatibility
- stop new draft-version work from silently changing published content
- introduce immutable submitted versions needed by Phase 2B
- avoid completing Phase 2B review and publication scope prematurely

### Existing automated test coverage

The codebase contains references to Article revisions, autosave, and stale
updates.

The audit found no dedicated tests proving:

- durable autosave
- interruption recovery
- immutable submitted versions
- revision reconstruction
- stale-client rejection
- concurrent revision numbering
- atomic Article and redirect updates
- normalized Article taxonomy relationships

Phase 2A requires database contract tests and editor service tests for these
behaviours.

## Phase 2A authority decision

### Canonical mutable draft

`public.wk_articles` remains the canonical mutable working Article record.

It receives a monotonic draft version column.

The draft version changes only through the Phase 2A Article save command.

`updated_at` remains useful metadata but is no longer the canonical
concurrency token.

### Canonical immutable versions

Phase 2A will establish immutable Article version records in the Editorial
domain.

Each immutable version must contain a complete reconstructable snapshot,
including at minimum:

- Article identity
- Resource identity
- version number
- version kind
- title
- slug
- excerpt
- content HTML
- editorial author display value
- owner identity
- hero image reference or URL
- SEO metadata
- lifecycle state at capture time
- publication date value at capture time
- normalized category snapshot
- normalized tag snapshot
- creator identity
- creation timestamp
- source draft version
- content fingerprint

Version kinds must distinguish at minimum:

- autosave
- manual save
- submitted

Autosave and manual-save versions may be pruned under an explicit retention
policy.

Submitted versions are immutable and retained indefinitely.

### Version pointers

Phase 2A will add explicit version pointers to the global resource identity
where their meaning is universal:

- current working version
- current submitted version

The published-version pointer remains a Phase 2B publication concern unless
the migration needs a nullable compatibility column now.

No pointer may reference a version owned by another resource.

### Optimistic concurrency

The canonical concurrency token is a monotonic integer draft version.

Every save command must require the expected draft version.

A stale expected version must return a structured conflict and make no
changes.

A null expected version is allowed only for controlled creation or
administrative migration, never for an ordinary editor overwrite.

### Transactional save command

Phase 2A will replace browser-coordinated Article writes with one server-side
transaction.

The transaction must:

1. authenticate the caller
2. load the Article resource
3. enforce owner or capability authority
4. lock the current Article draft
5. verify the expected draft version
6. validate the bounded payload
7. normalize taxonomy identities
8. update the mutable Article draft
9. increment the draft version
10. create the immutable version record
11. update Article taxonomy relationships
12. create slug history when required
13. update the relevant resource version pointer
14. return the new draft and version identities

Any failed step must roll back the entire command.

### Autosave contract

Autosave uses the same concurrency and permission boundary as manual save.

Autosave must return a durable version identity before the interface claims
that work was saved.

Autosave may avoid rewriting the mutable Article row when only preserving
unsaved local work, but its recovery semantics must be explicit and tested.

An autosave must never overwrite a newer accepted draft.

### Recovery contract

Recovery must load the latest recoverable autosave belonging to the Article
and editor context.

Recovery must compare the autosave source draft version with the current
Article draft version.

Recovery must not silently replace newer Article content.

Applying a recovered autosave creates a new accepted draft version through
the transactional save command.

### Revision retention

The initial retention policy is:

- retain all submitted versions indefinitely
- retain all versions referenced by a resource pointer indefinitely
- retain the latest 20 autosave versions per Article and editor
- retain the latest 20 manual-save versions per Article
- never prune a version required to reconstruct review, publication,
  correction, or provenance history
- execute pruning server-side after a successful version write
- pruning failure must not corrupt the accepted save

The exact background-pruning mechanism may remain deferred if synchronous
bounded pruning is safe for the first Article slice.

### Normalized taxonomy

Phase 2A will establish Article taxonomy join records using canonical taxonomy
term identities.

The save command accepts canonical term IDs, not browser-generated slugs.

Compatibility JSON in `wk_articles` may be updated transactionally during the
migration period for existing public readers.

The join records become the canonical Article taxonomy authority.

### Ownership and edit scope

The resource owner UUID is the canonical Article ownership identity.

Authorization rules are:

- administrators may edit
- callers with `edit_others_articles` may edit
- the resource owner may edit with `edit_own_articles`
- other authenticated callers may not edit
- anonymous callers may not execute Article mutation commands
- editorial author text does not grant authority

Existing Article resources with null owners require an explicit migration
policy and must not be assigned by display-name guessing.

### Slug history

Article slug changes are performed only through the transactional save
command.

The command must:

- validate the new slug
- reject active collisions
- preserve the exact old public path
- preserve the exact new public path
- create one permanent redirect record
- update the Article slug
- update the resource alias contract where appropriate

The Article slug update and redirect history either both commit or both roll
back.

### Migration strategy

Phase 2A must inspect existing `wk_article_revisions` rows before migration.

Useful existing revisions may be migrated only when:

- the Article still exists
- the snapshot fields can be reconstructed
- revision ordering can be determined
- malformed rows can be reported without blocking valid rows

The migration must report:

- total legacy revisions
- migrated revisions
- skipped revisions
- affected Articles
- Articles with ambiguous revision order
- Articles with no recoverable revision data

No legacy revision is silently discarded.

## Phase 2A implementation slices

### Slice 1: Durable database authority

Build:

- Article draft version counter
- immutable Article versions
- normalized Article taxonomy joins
- ownership enforcement
- transactional Article save command
- transactional slug history
- revision retention rules
- migration report for useful legacy revisions
- RLS and grants
- database contract tests

### Slice 2: Editor adoption

Build:

- typed Article save client
- durable autosave
- truthful autosave state
- conflict response handling
- removal of ordinary force overwrite
- recovery interface backed by durable data
- revision history backed by immutable versions
- normalized taxonomy payloads
- owner-aware editor permissions
- frontend tests

### Slice 3: Production proof

Prove with one real Article:

- accepted manual save
- durable autosave
- interruption recovery
- stale-client rejection
- immutable submitted version
- later draft edit without submitted-version mutation
- atomic slug redirect
- normalized taxonomy relationships
- unauthorized editor rejection
- live schema and type refresh

## Immediate implementation boundary

The next change is the Phase 2A database migration and its rollback-only
production-schema rehearsal.

No frontend code should change until the database authority and command
contract pass structural and lifecycle tests.

## Live Article baseline

Production observation date: July 15, 2026

### Article estate

The live Article estate contains:

- 216 total Articles
- 207 published Articles
- 7 draft Articles
- 1 pending Article
- 0 scheduled Articles
- 1 trashed Article
- 216 Articles with category JSON present
- 216 Articles with tag JSON present
- 215 Articles with non-empty author text

### Resource identity coverage

The Phase 1A identity layer currently contains:

- 1 Article resource relationship
- 1 distinct Article identity
- 1 distinct resource identity
- 1 Article resource with null `owner_id`
- 1 Article resource with null `created_by`

Phase 2A must establish a safe resource-identity backfill strategy for the
remaining Article estate.

Existing Articles must not be assigned owners by comparing display-name
strings.

### Legacy revision data

`public.wk_article_revisions` currently contains:

- 0 revision rows
- 0 Articles with revisions
- no first revision timestamp
- no latest revision timestamp

There is therefore no useful legacy revision content to migrate.

The existing table is an unused schema shell rather than a production revision
authority.

Phase 2A may replace or supersede it without losing revision history, provided
the migration verifies that the row count remains zero before destructive
replacement.

### Existing revision shell

The unused revision table currently includes:

- UUID identity
- Article UUID
- integer revision number
- title
- excerpt
- content HTML
- author text
- category JSON
- tag JSON
- SEO JSON
- publication timestamp
- WordPress status text
- creator text
- creation timestamp

It does not provide:

- resource identity
- stable authenticated creator identity
- explicit version kind
- draft concurrency source
- immutable-state enforcement
- content fingerprint
- retention protection
- submitted-version protection
- resource version pointers

### Existing Article redirects

The live redirect table currently contains:

- 0 Article redirect rows
- 0 Article redirects with exact old paths
- 0 Article redirects with exact new paths
- 0 permanent Article 308 redirects

Phase 2A therefore does not need to reconcile conflicting existing Article
redirect history before introducing atomic slug changes.

## Phase 2A rollback rehearsal proof

Production rehearsal date: July 15, 2026

The Phase 2A migration was executed inside an explicit rollback-only
transaction against the linked production schema.

The rehearsal completed successfully.

The rollback verification returned:

- `editorial.article_versions`: null after rollback
- `public.save_article_versioned(uuid,jsonb,bigint,text,uuid[])`: null after rollback

This proves the migration can build the Phase 2A database authority and that the
rehearsal left no persistent production objects behind.

The rehearsal also fixed and verified these migration defects before commit:

- `extensions.digest` must be schema-qualified because `digest` lives in the
  `extensions` schema.
- Article resource backfill must be deterministic row-by-row, not joined by
  timestamps.
- Backfill `created_by` null values must be cast to UUID where the destination
  column is UUID.
