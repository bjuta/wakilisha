# Database migration authority

## Authoritative directory

`supabase/migrations` is the only executable production migration directory.

A production schema change is incomplete until all of the following are true:

1. A new immutable SQL migration exists in `supabase/migrations`.
2. The migration has been applied to the linked production project through the repository's canonical promotion path.
3. `src/types/database.types.ts` has been regenerated from the live project.
4. `npm run schema:verify` reports no drift.
5. `npm run test:critical` passes.

## Canonical production promotion

Repository migrations must be promoted to production with:

```bash
bash scripts/control-plane/promote-repository-migrations.sh
```

That script requires exact merged `main`, runs the native Supabase dry-run, applies the repository migration files with `supabase db push --linked`, and verifies zero pending migrations afterward.

For CI-hosted promotion, the only standing launcher is
`.github/workflows/repository-migration-production-promotion.yml`. It is
`workflow_dispatch` only and must remain serialized under
`repository-migration-production-promotion`. A dispatch is valid only when it
binds:

- the exact current protected-main SHA; and
- the exact canonical migration filenames expected to be pending.

Do not synthesize disposable promotion workflows merely because a newly
triggered run is not immediately visible. GitHub Actions enqueue visibility is
eventually consistent. Reconcile repository-wide runs before any retry or
alternate trigger. There must never be two live promotion launchers for the
same pending migration set.

Do not use connector or API helpers that create a new migration record from raw SQL for a migration that already exists in `supabase/migrations`. In particular, repository migrations must not be promoted with a connector `apply_migration` action, because that path may assign a generated migration version instead of the filename's canonical version.

The migration ledger version in production must therefore be the numeric prefix of the exact repository filename. Ledger rewriting is an incident-repair action, not a normal promotion step.

## Archived SQL

Historical trees are retained beneath `archive/legacy-migrations` for archaeology and rollback research only. They are not an alternative migration chain.

SQL beneath `scripts`, `reports`, and the repository root is a verifier, audit, fixture, report, or manually reviewed support artifact. It must not be treated as a production migration.

## Drift contract

The committed database types are the live public-schema baseline. CI regenerates the types from production and fails when they differ.

Repository controls also fail when:

- another executable migration directory appears
- a Supabase migration version is duplicated
- the committed type baseline hash is stale
- the legacy migration package writes into a deployable path
- the canonical repository migration promotion script is removed or loses its exact-main, native dry-run, native push, or zero-pending safeguards
