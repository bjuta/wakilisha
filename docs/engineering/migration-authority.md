# Database migration authority

## Authoritative directory

`supabase/migrations` is the only executable production migration directory.

A production schema change is incomplete until all of the following are true:

1. A new immutable SQL migration exists in `supabase/migrations`.
2. The migration has been applied to the linked production project.
3. `src/types/database.types.ts` has been regenerated from the live project.
4. `npm run schema:verify` reports no drift.
5. `npm run test:critical` passes.

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
