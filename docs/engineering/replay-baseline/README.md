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

### August 19 replay retirement

Phase 6A preview rehearsal exposed two additional post-baseline migrations that
combine enduring authority with production-only reconciliation:

- `20260819124500_article_author_person_convergence.sql`
- `20260819203000_organization_identity_foundation.sql`

Their exact production-applied SQL is preserved under
`retired-active-migrations/`.

Replay-safe forward replacements retain only the authority a fresh database
must reconstruct:

- `20260820102000_article_author_person_replay_authority.sql`
- `20260820102100_organization_identity_replay_authority.sql`

The cutover is intentionally two-stage. The forward replacements land and are
applied first while the original production migration rows remain active.
A follow-up history-retirement change then removes the two production-data-bound
files from active replay authority and marks their migration-history rows
`reverted`. This keeps protected CI aligned with production at each reviewed
checkpoint.

The canonical WAKILISHA Organization is replayed with its accepted Resource UUID
`97d2dd8c-ff4d-48a0-95a7-5167f5e378d9`, so its institutional identity is stable
across production and fresh controlled environments.

### August 27 default-privilege replay parity repair

A fresh zero-data Supabase preview exposed a replay-only authority difference
that was not present in production.

Fresh Supabase projects begin with broader `postgres` default privileges in the
`public` schema than the accepted WAKILISHA production database. The active
schema baseline recreated the captured object grants but did not first normalize
those fresh-project defaults. As a result, replay inherited additional EXECUTE
authority even though production did not have it.

The repair is source-only replay authority. It does not execute against the
production application schema and does not change the production migration
ledger.

The baseline now:

- revokes fresh-project `PUBLIC`, `anon`, and `authenticated` default EXECUTE
  before WAKILISHA functions are created;
- normalizes fresh-project table and sequence defaults before application
  objects are created;
- restores the captured production grants already present later in the baseline;
- removes the exact 34 replay-only `service_role` function EXECUTE grants proven
  by effective-privilege comparison against production.

The final zero-state replay was proven at migration count `56`, head
`20260827165416`, with:

- `884/884` governed routines at zero effective privilege mismatch;
- `374/374` governed relations at zero effective privilege mismatch;
- `5/5` governed sequences at zero effective privilege mismatch;
- the exact production set of `80` anonymous-executable `SECURITY DEFINER`
  routines;
- zero new Supabase Advisor security or performance `WARN`/`ERROR` findings;
- Phase 7A K1 compatibility and K4C-P1 shared-event helper definitions
  byte-identical to production;
- Playlist lifecycle pointer parity drift `0`;
- typed Playlist event writers `0`.

This repair was discovered while preparing Phase 7A K4C-P2. K4C-P2 remains a
separate sealed candidate and is not part of this replay-baseline repair.
