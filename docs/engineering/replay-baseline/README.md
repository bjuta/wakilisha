# WAKILISHA Replay Baseline Repair

Prepared from production code base:

- Git base: `259f50967b0c5eba81dce5baa861672f7132e78a`
- Production migration rows before repair: `254`
- Production migration head before repair: `20260814201000`
- New schema baseline: `20260814202000_wakilisha_production_baseline.sql`
- New bootstrap authority: `20260814202500_wakilisha_bootstrap_authority.sql`
- M6 remains next: `20260814203000_artist_launch_tools_analytics.sql`

## Authority boundary

The schema baseline is a schema-only dump of the current WAKILISHA-owned schemas:

`public,private,editorial,media,platform_private,wakilisha_bridge,wakilisha_raw,wakilisha_repaired`

The bootstrap migration contains platform/reference authority only. It intentionally excludes production users, Artists, Tracks, Releases, Articles, follows, analytics events, and imported taxonomy/content.

The repository's complete 277-file historical migration SQL directory remains
preserved under `docs/engineering/replay-baseline/legacy-migrations/` with a
SHA-256 manifest. The exact 254-row pre-repair production migration ledger is
preserved separately in `production-migration-ledger-before-repair.json`.
Neither archive is active replay authority.

Production migration history has since been cut over to exactly
`20260814202000_wakilisha_production_baseline` and
`20260814202500_wakilisha_bootstrap_authority` without executing those replay
files against the production application schema.

Production application schema, content counts, Storage/Auth authority, and M6
absence were verified across the history-only cutover; the application schema
dump remained byte-identical before and after.

## Application extension authority

The production schema depends on four explicitly enabled application extensions
whose extension declarations are not reconstructed by the custom-schema-only
baseline dump:

- `fuzzystrmatch` in `public`
- `pg_trgm` in `public`
- `vector` in `public`
- Supabase-managed `pg_net`, verified through the callable `net.http_get` and
  `net.http_post` API surface rather than extension metadata namespace

The production baseline migration creates the required extensions, verifies the
three WAKILISHA-owned extension namespaces, and verifies the `pg_net` API before
any dumped table, index, or function can depend on them.
## Bootstrap dependency order

Bootstrap authority is inserted in stable foreign-key-safe order.

The production FK graph contains three internal bootstrap dependencies:

- `editorial.resource_kinds` before `editorial.publishing_content_kinds`
- `public.role_definitions` before `public.role_capabilities`
- `public.capability_definitions` before `public.role_capabilities`

The only external FK is
`private.registry_onboarding_config.updated_by -> auth.users.id`; the frozen
bootstrap row has `updated_by = NULL`, so no Auth user is copied or required.

The 24 bootstrap tables have no non-internal insert/update triggers.

## Legacy repository archive versus production ledger

The replay repair preserves two distinct historical authorities:

- `legacy-migrations/` is the complete SQL migration directory from locked base
  commit `259f50967b0c5eba81dce5baa861672f7132e78a` and contains 277 SQL files.
- `production-migration-ledger-before-repair.json` is the exact pre-repair
  production migration ledger and contains 254 applied history rows.

Production membership is resolved by exact migration `(version, name)` identity,
which maps to `VERSION_NAME.sql`. Numeric version alone is not sufficient because
the locked repository contains duplicate-version migration files.

The 23-file difference is intentional and is recorded in
`archive-only-migrations-before-repair.json`. Those exact file identities existed
in the locked repository base but were absent from the frozen production ledger.
Some may share a numeric version with a different migration that production did
record; that relationship is preserved in the classification record.

Preserving an archive-only file does not claim it was production-applied.

`legacy-migrations.sha256` covers all 277 archived repository SQL files.

## Historical migration source readers

Tests and security verifiers that assert the source contract of a historical
migration read that byte-identical source from `legacy-migrations/`.

They do not read historical SQL from `supabase/migrations/`, because that
directory now contains only active replay authority:

- `20260814202000_wakilisha_production_baseline.sql`
- `20260814202500_wakilisha_bootstrap_authority.sql`

Control-plane tooling that intentionally reasons about the active migration
chain continues to use `supabase/migrations/`.


## Post-baseline retired active migrations

A migration can leave active replay authority when all of the following are true:

- its production effect is already complete,
- it is not an enduring schema or bootstrap contract,
- replaying it on a fresh database would incorrectly require production-only data, and
- no current runtime, verifier, or test depends on replaying it.

Retired post-baseline migrations are preserved byte-identically under
`retired-active-migrations/`. They are historical receipts only and are not
active replay authority.

Production migration-history retirement is performed with Supabase
`migration repair --status reverted`. That operation changes only
`supabase_migrations.schema_migrations`; it does not undo the SQL or mutate the
production application schema or data.

`20260816202232_correct_valle_release_featured_credit.sql` was retired under
this rule because it was a one-off production data correction for one Release,
not an enduring WAKILISHA database contract.
