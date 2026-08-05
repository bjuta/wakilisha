# Phase 4A Migration 1 Media Authority Foundation Implementation Blueprint

## Status

This document defines the implementation boundary for Phase 4A Migration 1.

It is not a migration and does not change production.

Migration SQL and its dedicated verifier must not be written until this blueprint passes repository review.

## Accepted authority

This blueprint is subordinate to:

- `docs/engineering/phase-4a-media-authority-boundary-audit.md`
- `docs/engineering/phase-4a-media-schema-design.md`

Accepted document identities:

- authority boundary: `6cfa7391fdb5d41af99f1a435e5766682aa572ac30a16e2afa3422f46f4790f3`
- schema contract: `0c9bc9062faaea9935a13f0fb682360a2e3bc1a97d66dbca5777d8d3f7b35616`

Repository base:

- `4948999629e9259d1d048021b6921e6cbd7d82e4`

Implementation branch:

- `feature/phase4a-m1-media-authority-foundation`

## Read-only implementation preflight

The accepted preflight proved:

- production transaction was read-only
- 187 local migrations match the linked ledger
- latest migration is `20260804163000_phase_3b_public_notes_contributor_follow_up.sql`
- Phase 4A Migration 1 SQL does not already exist
- canonical `media` schema does not already exist
- Phase 4A capability definitions do not already exist
- production contains 1,079 compatibility assets
- all 1,079 compatibility assets remain active
- 13 compatibility assets record `lightsail-media`
- 1,066 compatibility assets have neither storage bucket nor storage path
- all 1,079 compatibility assets retain `unknown` rights
- 14 direct foreign keys still reference `public.registry_media_assets`
- production was not changed

Preflight artifact identities:

- SQL: `6aa69f762adfa9b5201042b327f2f1bd07b7d87836404146c6fa759da08d6fbb`
- output: `cfeff5e54e5fb24c6cb8fb1d8d56efdd2b8da825579ce021f1d2dbf1d940d46a`
- linked ledger: `bb959f1f76415f23dbe8071eba781c0db9ec2e221281ef39990c2ee008e302aa`
- repository contract: `4dc46b3594e356927206762b5d4c611edfcab001583435754d3cd6f1b2621bc2`

## Migration identity

Planned migration:

`supabase/migrations/20260805110000_phase_4a_media_authority_foundation.sql`

Planned verifier:

`scripts/control-plane/verify-phase-4a-m1-media-authority-foundation.sql`

Planned blueprint:

`docs/engineering/phase-4a-m1-media-authority-foundation-implementation-blueprint.md`

The migration timestamp is reserved by this blueprint.

No other migration may use `20260805110000`.

## Migration purpose

Migration 1 creates the empty canonical Media authority foundation.

It creates:

- the dedicated `media` schema
- eight Phase 4A capability definitions
- conservative initial role assignments
- five controlled-vocabulary tables
- nine canonical authority tables
- constraints
- indexes
- immutable-row protection
- pointer and relationship integrity triggers
- RLS and grants
- comments required to preserve authority meaning

It does not:

- backfill any compatibility asset
- create any logical asset row
- create any file object
- create any asset revision
- create any variant
- create any variant selection
- create any governance version
- create any usage link
- create any legacy bridge row
- create any Media event
- change `public.registry_media_assets`
- change `public.media_folders`
- change existing Media policies
- change existing foreign keys
- change public Media rendering
- change storage objects
- create transactional public commands
- create public or internal Media read models
- begin upload or processing work
- deploy an Edge Function
- change frontend code

## Existing compatibility authority

Migration 1 must preserve these existing authorities exactly:

- `public.registry_media_assets`
- `public.media_folders`
- `public.capability_definitions`
- `public.role_definitions`
- `public.role_capabilities`
- `public.user_role_assignments`
- `public.current_user_has_capability(text)`
- `public.current_user_is_administrator()`

The migration must not issue any of these statements against `public.registry_media_assets` or `public.media_folders`:

- `alter table`
- `drop table`
- `truncate`
- `insert`
- `update`
- `delete`
- `create policy`
- `drop policy`
- `grant`
- `revoke`

Static verification must reject such statements.

## Bound live authority baseline

The live authority extraction is authoritative for Migration 1 implementation.

Extraction artifacts:

- SQL SHA-256: `ad51ae5e105093c5806bf86a56db8c7bd37eef01473336d9765a720e4cd36b4b`
- output SHA-256: `5aab940ddfe51c5c0ff55883c75bfc69772e83d7b3b8d33b206e2079ee00179f`

The extraction ran with `transaction_read_only = on`.

### Capability storage contract

`public.capability_definitions` has:

- primary key: `capability_key`
- `capability_key text not null`
- `label text not null`
- `description text`
- `domain text not null default 'admin'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Migration 1 inserts Phase 4A capabilities with `domain = 'media'`.

It does not alter the table, its primary key, or its existing grants.

### Role storage contract

`public.role_definitions` has 24 existing role keys.

Required Phase 4A target roles already exist:

- `administrator`
- `media_editor`
- `editor`
- `reviewer`
- `registry_editor`

Sorted live role-key fingerprint:

`c1e2f8e7d56dfdaf2e5991b38d5ff2ba`

The fingerprint algorithm is:

- sort all `role_key` values
- join with newline
- calculate MD5

Migration 1 does not create, update, or delete role definitions.

### Role-capability storage contract

`public.role_capabilities` has:

- primary key: `(role_key, capability_key)`
- role foreign key with `on delete cascade`
- capability foreign key with `on delete cascade`
- `created_at timestamptz not null default now()`

There are 23 existing compatibility Media role-capability assignments.

Sorted compatibility Media assignment fingerprint:

`1a71dddc0f7dab4a260f85977873a000`

The fingerprint algorithm is:

- filter to `upload_media`, `manage_media_library`, `view_missing_images`, `view_broken_links`, and `view_media_migration`
- sort `role_key || '|' || capability_key`
- join with newline
- calculate MD5

Migration 1 adds exactly 22 Phase 4A role-capability assignments.

It does not remove or rewrite any compatibility assignment.

### Capability helper contract

`public.current_user_has_capability(text)` is:

- security definer
- stable
- configured with `search_path=public`
- definition MD5: `c274e080cdfc7c5df1f9240d3e1b3321`

`public.current_user_is_administrator()` is:

- security definer
- stable
- configured with `search_path=public`
- definition MD5: `7141fac0df104b995bff1a99f56ed563`

Migration 1 must not replace either function.

### Existing capability-table privilege contract

The live privilege set across:

- `public.capability_definitions`
- `public.role_definitions`
- `public.role_capabilities`

contains 63 rows.

Sorted privilege fingerprint:

`08c6a19c6d1a64020c17c05b1e18cf14`

The fingerprint algorithm is:

- sort `table_name || '|' || grantee || '|' || privilege_type || '|' || is_grantable`
- join with newline
- calculate MD5

Migration 1 must not grant, revoke, or normalize privileges on these existing tables.

### Compatibility runtime fingerprints

Compatibility asset rows:

`f32e074f96b01549b5e597ad8b5f4324`

The asset-row fingerprint algorithm is:

- convert each `public.registry_media_assets` row to JSONB text
- sort by asset UUID text
- join with newline
- calculate MD5

Compatibility policy count:

- 9

Compatibility policy fingerprint:

`9f56b431209ef2b152e7f701240cca4a`

Direct compatibility foreign-key count:

- 14 existing foreign keys from schemas outside `media` that reference `public.registry_media_assets`

The canonical `media.legacy_asset_links` foreign key created by Migration 1 is excluded from this compatibility baseline.

Direct compatibility foreign-key fingerprint:

`54274ae6a613d38c257c543ccf7050cc`

Migration 1 assertions and the dedicated verifier must compare these exact fingerprints before and after schema creation.

A mismatch stops implementation.

## Capability authority

Create these capability definitions in domain `media`:

1. `view_media_records`
2. `register_media_files`
3. `verify_media_files`
4. `manage_media_assets`
5. `manage_media_usage`
6. `review_media_governance`
7. `archive_media_assets`
8. `approve_media_retention`

Capability rows must use `insert ... on conflict ... do update` so labels, descriptions, and domain remain authoritative.

Conflict updates may change only:

- `label`
- `description`
- `domain`
- `updated_at`

`created_at` is preserved.

`updated_at` changes only when label, description, or domain is distinct from the accepted value.

### Initial role assignments

`administrator` receives all eight capabilities.

`media_editor` receives:

- `view_media_records`
- `register_media_files`
- `manage_media_assets`
- `manage_media_usage`
- `archive_media_assets`

`editor` receives:

- `view_media_records`
- `register_media_files`
- `manage_media_assets`
- `manage_media_usage`

`reviewer` receives:

- `view_media_records`
- `review_media_governance`

`registry_editor` receives:

- `view_media_records`
- `register_media_files`
- `manage_media_usage`

No initial role other than `administrator` receives:

- `verify_media_files`
- `approve_media_retention`

No new Phase 4A capability is assigned to:

- `author`
- `writer`
- `viewer`
- chart-editor roles

Existing compatibility capabilities remain unchanged.

Expected new Phase 4A assignment count:

- 22

The migration-local assertion and dedicated verifier must compare the exact 22-pair assignment set, not only its row count.

## Controlled-vocabulary authority

Create these reference tables:

1. `media.asset_kinds`
2. `media.asset_purposes`
3. `media.storage_providers`
4. `media.variant_roles`
5. `media.usage_roles`

All reference tables must:

- use text primary keys
- contain label and description
- contain `enabled boolean not null default true`
- contain deterministic sort order where defined
- contain `created_at timestamptz not null default now()`
- have RLS enabled
- allow capability-gated authenticated read
- deny authenticated writes
- allow service-role administration

### Asset kinds

Exact initial values:

- `image`
- `document`
- `audio`
- `video`
- `archive`
- `other`

Expected row count:

- 6

### Asset purposes

Exact initial values:

- `general`
- `article_hero`
- `article_inline`
- `chart_artwork`
- `artist_photo`
- `release_artwork`
- `track_artwork`
- `downloadable`
- `press_kit`
- `brand_asset`
- `profile_media`
- `social_card`
- `system`

Expected row count:

- 13

### Storage providers

Exact initial values:

- `lightsail_media`
- `supabase_storage`
- `external_url`
- `legacy_unknown`

Expected row count:

- 4

Only provider metadata declares whether verification is supported.

Provider identity is not logical asset identity.

### Variant roles

Exact initial values:

- `thumbnail`
- `responsive_width`
- `crop`
- `web_optimized`
- `social_card`
- `poster_frame`
- `audio_preview`
- `video_transcode`
- `preservation_copy`
- `other`

Expected row count:

- 10

### Usage roles

Exact initial values:

- `article_hero`
- `article_inline`
- `chart_artwork`
- `artist_portrait`
- `author_avatar`
- `author_cover`
- `release_artwork`
- `track_artwork`
- `guide_hero`
- `highlight_artwork`
- `source_attachment`
- `other`

Expected row count:

- 12

## Canonical object creation order

The migration must use this dependency-safe order:

1. create schema `media`
2. create controlled-vocabulary tables
3. seed controlled vocabularies
4. create `media.assets` without active pointer foreign keys
5. create `media.file_objects`
6. create `media.asset_revisions`
7. create `media.variants`
8. create `media.variant_selections`
9. create `media.asset_governance_versions`
10. create `media.usage_links`
11. create `media.legacy_asset_links`
12. create `media.events`
13. add `media.assets.current_revision_id` foreign key
14. add `media.assets.current_governance_version_id` foreign key
15. create integrity functions and triggers
16. create indexes
17. enable RLS
18. apply grants and policies
19. insert capability definitions and role assignments
20. add comments
21. run migration-local assertions

## Logical asset authority

Create:

`media.assets`

Required columns:

- `id uuid primary key default gen_random_uuid()`
- `asset_kind text not null`
- `asset_purpose text not null default 'general'`
- `title text not null`
- `lifecycle_state text not null default 'active'`
- `compatibility_folder_id uuid`
- `current_revision_id uuid`
- `current_governance_version_id uuid`
- `authority_revision bigint not null default 1`
- `created_by uuid`
- `updated_by uuid`
- `archived_by uuid`
- `archived_at timestamptz`
- `archive_reason text`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Required foreign keys:

- asset kind to `media.asset_kinds`
- asset purpose to `media.asset_purposes`
- compatibility folder to `public.media_folders` with `on delete set null`
- created and updated actors to `auth.users` with `on delete set null`
- current revision to `media.asset_revisions` with `on delete restrict`
- current governance version to `media.asset_governance_versions` with `on delete restrict`

`archived_by` remains a historical UUID snapshot without a foreign key.

Required checks:

- trimmed title is non-empty
- authority revision is at least 1
- lifecycle state is one of `active`, `archived`, `retention_pending`, `purged`
- archived state requires archive actor, timestamp, and non-empty reason
- active state carries no archive metadata
- no migration-local seed or assertion creates a purged asset

Required indexes:

- asset kind, lifecycle state, updated time descending
- asset purpose, lifecycle state, updated time descending
- partial compatibility-folder lookup
- partial current-revision lookup
- partial current-governance lookup

Migration 1 leaves this table empty.

## Immutable file-object authority

Create:

`media.file_objects`

Required columns, checks, foreign keys, and indexes must match the accepted schema contract.

Migration 1 locks file objects completely against update and delete.

Migration 3 may replace that protection with a narrow verification transition that:

- can change only verification fields
- requires trusted command authority
- does not expose a general bypass
- preserves storage locator and byte identity

Required verification states:

- `unverified`
- `verified`
- `failed`
- `unreachable`

Required locator uniqueness:

- unique partial index on storage provider, normalized namespace, and storage path
- applies only where storage path is non-null

No global unique constraint is added to SHA-256.

Migration 1 leaves this table empty.

## Asset-revision authority

Create:

`media.asset_revisions`

Required integrity:

- revision number is at least 1
- unique asset and revision number
- unique asset and original file object
- replacement reason is non-empty
- revision 1 has no previous revision
- later revisions require the immediately previous revision
- previous revision belongs to the same asset
- update and delete are blocked

The asset current-revision pointer may activate only:

- a revision belonging to the asset
- a revision whose original file object is verified

Migration 1 leaves this table empty.

## Variant authority

Create:

- `media.variants`
- `media.variant_selections`

Variants are immutable.

Variant selection is a governed mutable pointer.

Required variant integrity:

- source and derived file objects differ
- asset revision belongs to asset
- source and derived file objects are verified
- selected source is the revision original or an explicitly supported source variant
- transformation specification is a JSON object
- duplicate relationship identity is rejected
- registration does not activate delivery

Required selection integrity:

- primary key is asset revision and variant role
- selection revision is at least 1
- selected variant belongs to the same asset revision
- selected variant has the same role
- selected variant resolves to a verified derived file object
- authenticated direct mutation is denied
- no timestamp or UUID ordering selects a variant

Migration 1 leaves both tables empty.

## Governance authority

Create:

`media.asset_governance_versions`

Exact controlled states must match the accepted schema contract for:

- rights
- consent
- sensitivity
- embargo
- source protection
- preservation
- retention
- public safety

Required integrity:

- version number is at least 1
- unique asset and version number
- scheduled or active embargo requires a release timestamp
- publicly approved governance cannot use restricted rights
- publicly approved governance requires suitable consent where consent applies
- confidential source protection cannot be public
- ordinary governance creation cannot create a purged retention state
- update and delete are blocked
- current governance pointer belongs to the same asset

Migration 1 leaves this table empty.

## Usage authority

Create:

`media.usage_links`

Migration 1 establishes structural and lifecycle integrity only.

Typed target existence validation remains Migration 4 work.

Required resolution modes:

- `current_revision`
- `exact_revision`
- `legacy_snapshot`

Required usage states:

- `active`
- `detached`
- `archived`

Required structural integrity:

- display order is non-negative
- usage revision is at least 1
- placement data is a JSON object
- target-version kind and ID are both null or both present
- current revision mode has no asset revision
- exact revision mode has an asset revision
- legacy snapshot mode has no asset revision
- bound revision belongs to the asset
- non-active state requires reason, actor, and timestamp
- direct delete is blocked
- immutable identity fields cannot change
- only lifecycle fields may change through trusted authority
- duplicate active usage identity is rejected with a normalized placement fingerprint

Migration 1 does not create `media.validate_usage_target(...)`.

Migration 1 leaves this table empty.

## Legacy bridge authority

Create:

`media.legacy_asset_links`

Required integrity:

- one legacy asset maps to one logical asset
- one logical asset maps to at most one legacy asset
- legacy asset references `public.registry_media_assets` with `on delete restrict`
- canonical asset references `media.assets` with `on delete restrict`
- mapping reason is non-empty
- legacy snapshot is a JSON object
- update and delete are blocked

Migration 1 performs no bridge backfill.

The table remains empty.

## Event authority

Create:

`media.events`

Exact initial event types:

- `asset_created`
- `legacy_asset_mapped`
- `file_object_registered`
- `file_object_verified`
- `file_object_verification_failed`
- `file_object_unreachable`
- `asset_revision_created`
- `asset_revision_activated`
- `variant_registered`
- `variant_activated`
- `usage_attached`
- `usage_detached`
- `usage_archived`
- `governance_version_created`
- `asset_archived`
- `asset_restored`
- `retention_requested`
- `retention_approved`
- `physical_purge_completed`

Required integrity:

- at least one canonical object identity is present
- prior and resulting states are null or JSON objects
- update and delete are blocked
- authenticated insert is denied
- actor remains a historical UUID snapshot
- canonical object foreign keys use `on delete restrict`

Migration 1 leaves this table empty.

## Reusable protection functions

Create reusable internal functions with `set search_path` locked to trusted schemas.

Required functions:

1. `media.protect_immutable_row()`
2. `media.enforce_asset_pointer_integrity()`
3. `media.enforce_asset_revision_integrity()`
4. `media.enforce_variant_integrity()`
5. `media.enforce_variant_selection_integrity()`
6. `media.enforce_governance_integrity()`
7. `media.enforce_usage_link_integrity()`
8. `media.protect_usage_link_identity()`
9. `media.enforce_legacy_asset_link_integrity()`
10. `media.enforce_media_event_integrity()`

Function naming may change only if the verifier is updated in the same review.

All trigger functions must be non-public internal functions.

Migration 1 creates no browser-callable `public` command.

## Trigger contract

Apply immutable-row protection to:

- `media.file_objects`
- `media.asset_revisions`
- `media.variants`
- `media.asset_governance_versions`
- `media.legacy_asset_links`
- `media.events`

Use deferrable constraint triggers where cross-row pointer ownership must be valid at transaction end.

The verifier must confirm trigger names, tables, timing, event type, deferrability, and backing function.

Migration-local assertions must prove from catalog structure:

- every required trigger exists on the correct table
- trigger timing and event coverage match the contract
- required constraint triggers are deferrable where specified
- every trigger uses the expected internal function
- immutable-row protection covers every required table
- pointer, revision, variant, selection, governance, usage, bridge, and event integrity functions are installed
- compatibility tables are untouched
- canonical data tables remain empty

Migration 1 must not insert canonical fixtures to test behavior.

Behavioral negative tests run only after migration application in a disposable validation transaction that is rolled back completely.

## RLS and grant boundary

Create schema privileges deliberately.

### Anonymous role

`anon` receives:

- no schema usage
- no table privileges
- no sequence privileges
- no function execution

### Authenticated role

`authenticated` receives:

- schema usage only where required to read controlled vocabularies
- select on the five controlled-vocabulary tables
- no canonical object-table select
- no canonical object-table insert
- no canonical object-table update
- no canonical object-table delete
- no sequence privileges for canonical mutations
- no direct trigger-function execution

Reference-table select policies require:

- `public.current_user_has_capability('view_media_records')`

### Service role

`service_role` receives:

- schema usage
- required privileges on reference and canonical tables
- required sequence privileges

Service-role grants do not create browser authority.

### Public role

`public` receives no privileges on the `media` schema.

Every Media table has RLS enabled.

Canonical object tables have no authenticated policies in Migration 1.

No public read model is created.

## Idempotence and partial-application safety

The migration must be additive.

Required patterns:

- `create schema if not exists`
- `create table if not exists`
- `create index if not exists`
- `create or replace function`
- deterministic reference seeding with `on conflict`
- deterministic capability seeding with `on conflict`
- deterministic role-capability insertion with `on conflict do nothing`
- explicit `drop trigger if exists` followed by exact trigger creation
- constraint creation guarded through catalog checks where PostgreSQL lacks `if not exists`

Idempotence must not hide an incompatible pre-existing object.

Migration-local assertions must compare existing object structure to the accepted contract and stop on mismatch.

## Migration-local assertions

The migration ends with assertions confirming:

- `media` schema exists
- all five reference tables exist
- all nine canonical authority tables exist
- exact controlled-vocabulary counts are 6, 13, 4, 10, and 12
- all eight capability definitions exist
- the exact 22 Phase 4A role-capability assignments exist
- no forbidden Phase 4A role assignment exists
- the 24-role key fingerprint remains `c1e2f8e7d56dfdaf2e5991b38d5ff2ba`
- the 23 compatibility Media assignment fingerprint remains `1a71dddc0f7dab4a260f85977873a000`
- the capability-table privilege fingerprint remains `08c6a19c6d1a64020c17c05b1e18cf14`
- both capability helper definitions retain their accepted MD5 values
- all ten required internal integrity functions exist with locked search paths
- all required trigger bindings match their expected tables, timing, events, functions, and deferrability
- all canonical object tables contain zero rows
- all canonical tables have RLS enabled
- authenticated has no canonical direct writes
- anon has no Media privileges
- 1,079 compatibility assets remain
- compatibility asset rows retain fingerprint `f32e074f96b01549b5e597ad8b5f4324`
- compatibility policies retain fingerprint `9f56b431209ef2b152e7f701240cca4a`
- 14 direct foreign keys still reference `public.registry_media_assets`
- direct compatibility foreign keys retain fingerprint `54274ae6a613d38c257c543ccf7050cc`
- no compatibility row was added, updated, or deleted by the migration

The migration must not assert compatibility values by updating them.

## Dedicated verifier contract

Create:

`scripts/control-plane/verify-phase-4a-m1-media-authority-foundation.sql`

The verifier runs read-only.

It must emit one final JSON object with:

- `verification`
- `media_schema_exists`
- `reference_table_count`
- `canonical_table_count`
- `asset_kind_count`
- `asset_purpose_count`
- `storage_provider_count`
- `variant_role_count`
- `usage_role_count`
- `phase4a_capability_count`
- `phase4a_role_assignment_count`
- `forbidden_phase4a_role_assignment_count`
- `role_key_fingerprint`
- `compatibility_media_role_assignment_fingerprint`
- `capability_table_privilege_fingerprint`
- `current_user_has_capability_definition_md5`
- `current_user_is_administrator_definition_md5`
- `canonical_row_count`
- `rls_enabled_table_count`
- `authenticated_canonical_write_grant_count`
- `anonymous_media_privilege_count`
- `direct_registry_media_asset_fk_count`
- `direct_registry_media_asset_fk_fingerprint`
- `compatibility_asset_count`
- `compatibility_active_asset_count`
- `compatibility_asset_row_fingerprint`
- `compatibility_policy_count`
- `compatibility_policy_fingerprint`
- `migration_scope`

Expected values:

- verification: `PASS`
- Media schema exists: true
- reference tables: 5
- canonical tables: 9
- asset kinds: 6
- asset purposes: 13
- storage providers: 4
- variant roles: 10
- usage roles: 12
- Phase 4A capabilities: 8
- Phase 4A role assignments: 22
- forbidden Phase 4A role assignments: 0
- role-key fingerprint: `c1e2f8e7d56dfdaf2e5991b38d5ff2ba`
- compatibility Media assignment fingerprint: `1a71dddc0f7dab4a260f85977873a000`
- capability-table privilege fingerprint: `08c6a19c6d1a64020c17c05b1e18cf14`
- `current_user_has_capability(text)` definition MD5: `c274e080cdfc7c5df1f9240d3e1b3321`
- `current_user_is_administrator()` definition MD5: `7141fac0df104b995bff1a99f56ed563`
- canonical rows: 0
- RLS-enabled Media tables: 14
- authenticated canonical write grants: 0
- anonymous Media privileges: 0
- direct compatibility foreign keys: 14
- direct compatibility foreign-key fingerprint: `54274ae6a613d38c257c543ccf7050cc`
- compatibility assets: 1,079
- compatibility active assets: 1,079
- compatibility asset-row fingerprint: `f32e074f96b01549b5e597ad8b5f4324`
- compatibility policies: 9
- compatibility policy fingerprint: `9f56b431209ef2b152e7f701240cca4a`
- migration scope: `schema_only`

The verifier must fail before Migration 1 and pass after Migration 1.

It must also verify:

- exact columns, defaults, nullability, and data types
- exact primary keys
- exact foreign keys and delete actions
- exact check constraints
- exact indexes and predicates
- exact triggers and backing functions
- exact trigger timing, events, and deferrability
- exact function security mode and locked search path
- exact RLS enablement
- exact grants
- exact reference values
- exact capability assignments
- exact Phase 4A role-capability assignments
- existing compatibility Media assignments are unchanged
- existing role definitions are unchanged
- existing capability helper definitions are unchanged
- existing capability-table privileges are unchanged
- canonical tables are empty
- no browser-callable Media command exists
- compatibility policies are unchanged
- compatibility rows are unchanged
- compatibility foreign keys are unchanged

The verifier must not mutate data.

## Static migration checks

Before any database application, shell verification must reject:

- compatibility-table DDL
- compatibility-table DML
- compatibility-policy changes
- changes to existing capability helper functions
- grants or revokes on existing capability and role tables
- role-definition changes
- removal or rewriting of compatibility Media role assignments
- public Media command creation
- backfill statements into canonical tables
- storage-object changes
- Edge Function changes
- frontend changes

The migration may insert only:

- controlled-vocabulary rows
- capability definitions
- role-capability assignments

The migration may not insert into any canonical authority table.

## Local validation sequence

Before production:

1. verify migration and verifier syntax
2. run static scope checks
3. apply the full authoritative migration chain to a fresh local database
4. run the dedicated verifier
5. open one disposable write-test transaction
6. insert the minimum canonical fixtures required for negative tests
7. run immutable-row negative tests
8. run pointer-integrity negative tests
9. run variant-selection and usage-identity negative tests
10. run grant and RLS negative tests
11. roll back the disposable write-test transaction completely
12. rerun the dedicated verifier
13. confirm canonical tables remain empty
14. regenerate local types only for inspection
15. run schema verification
16. run engineering control-plane verification
17. run critical tests
18. run linked migration dry-run
19. inspect exact diff and migration scope
20. open the implementation PR
21. wait for green CI
22. merge only after exact review

## Production application sequence

After the implementation PR is accepted:

1. synchronize clean `main`
2. recheck linked migration ledger
3. run linked migration dry-run
4. apply exactly one migration
5. verify ledger records the migration
6. run the dedicated read-only verifier
7. confirm all canonical object tables are empty
8. confirm compatibility runtime is unchanged
9. regenerate committed public-schema types
10. update the live-schema baseline
11. run schema verification
12. run engineering control-plane verification
13. run critical tests
14. record the live-schema reconciliation in a separate PR

## Rollback boundary

Before any canonical rows exist, rollback may drop the new `media` schema objects and remove only the new Phase 4A capabilities and role assignments.

Rollback must not:

- change compatibility assets
- change compatibility folders
- change existing policies
- change storage objects
- change public Media rendering

After canonical rows exist, schema deletion is no longer an acceptable rollback.

## Implementation PR scope

The first implementation PR should contain exactly:

- this blueprint
- one Phase 4A Migration 1 SQL file
- one dedicated Phase 4A Migration 1 verifier

It should not contain:

- generated production types
- live-schema baseline changes
- Edge Functions
- frontend files
- Media service changes
- backfill SQL
- command SQL
- read-model SQL
- upload or processing code

## Exit condition

Migration 1 is ready for implementation review when:

- the blueprint is accepted
- migration SQL follows this object order
- verifier SQL follows this verifier contract
- static checks prove schema-only scope
- fresh and upgrade-path validation pass
- canonical tables remain empty
- authenticated direct mutation is denied
- compatibility assets, foreign keys, policies, and runtime remain unchanged
- production has not changed
