# Phase 4A Migration 4: Media Usage Authority and Read Models

## Status

Implementation blueprint for the fourth Phase 4A migration.

This package remains SQL-only. It does not change compatibility policies, current foreign keys, storage files, Edge Functions, frontend code, or Readdy.

## Accepted Authority

The binding authority is:

- `docs/engineering/phase-4a-media-authority-boundary-audit.md`
- `docs/engineering/phase-4a-media-schema-design.md`
- the deployed Migration 1, Migration 2, and Migration 3 contracts
- the accepted read-only Migration 4 discovery package under `/tmp/wakilisha-phase4a-m4-discovery`

## Live Baseline

The accepted production baseline is:

- 1,079 logical Media assets
- 1,079 governance versions
- 1,079 immutable legacy bridges
- 2,158 append-only Media events
- zero file objects
- zero asset revisions
- zero variants
- zero variant selections
- zero usage links
- nine deployed Migration 3 commands
- 14 external compatibility foreign keys
- compatibility asset fingerprint `f32e074f96b01549b5e597ad8b5f4324`
- compatibility foreign-key fingerprint `54274ae6a613d38c257c543ccf7050cc`

## Relationship Classification

The database foreign-key inventory is authoritative.

The 7,319 current references classify as:

- 987 real Media placements
- 6,332 archived Registry provenance records
- zero orphans

The 987 placement rows are:

- 2 Guide-page heroes
- 307 Artist portraits
- 170 Release artworks
- 306 Track artworks
- 202 Article heroes

Registry provenance rows are evidence about historical import relationships. They are not current content placements and must not become `media.usage_links`.

## Migration Scope

Create:

- `media.usage_role_requires_stability`
- `media.require_media_read_actor`
- `media.validate_usage_target`
- `public.attach_media_usage`
- `public.detach_media_usage`
- `public.archive_media_usage`
- `public.list_media_assets_v2`
- `public.get_media_asset_v2`
- `public.resolve_media_asset_delivery`

Backfill exactly 987 shadow usage links: 985 active and 2 archived because their existing Artist targets were already archived at discovery time. Record 987 `usage_attached` events plus 2 `usage_archived` events.

## Typed Target Authority

The validator accepts only these authority and kind pairs:

- `editorial/article`
- `registry/artist`
- `registry/author`
- `registry/release`
- `registry/track`
- `registry/highlight`
- `charts/chart_entry` through `public.chart_entries.id`
- `guides/guide`
- `guides/guide_page`
- `sources/source`

Target edit authority remains with the owning domain. `manage_media_usage` does not bypass Article, Registry, Chart, Guide, or Source authority. The text-keyed `public.wk_chart_entries_v2` compatibility table is not a typed UUID usage target.

Known usage roles are constrained to their typed targets:

- `article_hero` and `article_inline` → `editorial/article`
- `chart_artwork` → `charts/chart_entry`
- `artist_portrait` → `registry/artist`
- `author_avatar` and `author_cover` → `registry/author`
- `release_artwork` → `registry/release`
- `track_artwork` → `registry/track`
- `guide_hero` → `guides/guide` or `guides/guide_page`
- `highlight_artwork` → `registry/highlight`
- `source_attachment` → `sources/source`
- `other` remains the explicit extensibility role

New attachment commands reject missing, archived, deleted, withdrawn, rejected, unresolved, superseded, inactive, disabled, or trashed targets. The shadow backfill validates all 987 target identities, classifies 985 attachable relationships as active, and preserves the 2 already-archived Artist relationships as archived usage history instead of dropping or reactivating them.

## Usage Resolution

Publication-stable roles require:

- `exact_revision`, or
- `legacy_snapshot` while the immutable legacy bridge remains the only proven byte-era record

`current_revision` is allowed only for the `other` role, where drift is explicit.

The initial 987 shadow usages use `legacy_snapshot`. No canonical revision exists yet, and the immutable bridge captures the exact compatibility-era URL and metadata. The 2 archived usages carry usage revision 2, a deterministic Migration 4 system-actor snapshot, and the migration observation timestamp because the original archive actor and transition time are not available and must not be inferred.

## Read Authority

Canonical Media tables remain private.

Authenticated read functions expose allowlisted summaries. Internal governance reasons are visible only to Media governance reviewers or administrators.

The public resolver:

- grants no table access
- reads legacy delivery only from `media.legacy_asset_links`
- never reads the mutable compatibility URL
- resolves variants only through `media.variant_selections`
- rejects internal, blocked, restricted, archived, embargoed, unverified, or otherwise unsafe delivery
- returns only allowlisted delivery fields

## Validation

Before any commit or PR:

1. verify the accepted discovery artifact hashes
2. verify Migration 3 ledger synchronization
3. generate the three-file package
4. run repository control-plane checks
5. execute the complete Migration 4 migration against linked production inside one transaction that ends with `ROLLBACK`
6. confirm all runtime acceptance tests pass
7. confirm production still has zero usage links and zero Migration 4 functions after rollback
8. confirm the linked dry run lists only Migration 4
9. verify exact three-file scope

## Deployment

After review and merge:

- apply the SQL migration once
- verify the migration ledger
- run the dedicated read-only production verifier
- regenerate public and editorial database types
- reconcile the live-schema baseline in the same Phase 4A record flow

No Edge Function, frontend, or Readdy deployment is required.

## Rollback

Before production application, delete the uncommitted three-file package and reset the branch.

After production application, do not delete usage history or canonical Media rows. Use a forward migration that revokes new function grants and removes only the new function contracts after proving no consumer has cut over. The 987 shadow usage rows remain auditable records.
