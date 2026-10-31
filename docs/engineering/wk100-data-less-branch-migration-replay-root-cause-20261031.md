# WAKILISHA 100: data-less branch migration replay blocker

**Controlling work:** #1264, draft PR #1333. **Verified:** 31 October 2026. **Status:** blocking branch-baseline replay; not a release or a migration approval.

## Observed authority

- Production Supabase project `pgzizndxdyhqmtyywjmt`: **236** migrations. The last two are CLI-minted `20261030062819_retire_18_kenya_rnb_editions.sql` and `20261030095808_wk100_governed_publisher_v1.sql`. Both are already installed in Production.
- Production read-only counts: `platform_private.wk_chart_rnb18_retirement_rows_20261030` = **2,904** rows, exactly **one** sealed retirement receipt, and **zero** still-published `toprnb/KE` editions. The previously accepted historical retirement is intact.
- New temporary branch `jwpjstunpwqfcxnbwfvl` initially showed 89, then 160, 205, and finally 234 migrations as provisioning/rebase proceeded, then `MIGRATIONS_FAILED`. It lacked the publisher's approvals and staging tables at every checked point. The **exact failed SQL statement was not captured**, so do not pretend a missing branch log is a PostgreSQL error receipt.
- Old branch `wnohbdyblhlspowrzcbj` recorded 236 migrations but included pending `20261030180827` instead of installed publisher `20261030095808`, and also lacked publisher tables. It was not equivalent to Production.
- **Both** failed WK100 branches were deleted and a fresh branch-list readback showed only the Production/main project. No researcher bytes, migration, or fixture was deployed to either branch during this investigation.

## Deterministic historical replay blocker

Supabase branches are **data-less** by design: they do not inherit Production's rows. See [Supabase Branching](https://supabase.com/docs/guides/deployment/branching).

The already-applied `20261030062819` migration is a **one-time, data-specific retirement**, not a schema-only migration. Its first preflight explicitly demands exactly 18 historical `toprnb/KE` published editions, 1,800 chart entries, 58 artist decisions, 10 playback runs, 1,000 playback items, 18 linked ingest runs, 7,560 raw source rows, and 7,398 candidates. A data-less branch cannot pass this contract without reproducing historical Production data. The schema change that follows the historical preflight (including status `retired`) cannot be replayed through that migration on an empty branch.

This is a **proven deterministic incompatibility**, consistent with the branch stopping at migration 234. It is *not* a claim to know the exact first SQLSTATE from a deleted branch.

## Accepted corrective direction

1. **Preserve applied historical authority.** Do not rewrite, rename, re-time, or reapply either installed Production migration; do not manually edit `supabase_migrations.schema_migrations`. Do not manufacture 18 fake editions or copy Production's sensitive historical records into Preview.
2. **Do not rely on post-migration seeding.** Supabase branch seed files run after migrations, so `seed.sql` cannot repair a failure inside the 235th migration. [Supabase branch troubleshooting](https://supabase.com/docs/guides/deployment/branching/troubleshooting) and [local workflow](https://supabase.com/docs/guides/local-development/cli-workflows).
3. **Prove feature SQL separately on an isolated local Production-schema baseline:** use the authorized Supabase CLI schema-only export, no private data/role/secret export, and a private disposable PostgreSQL runtime. Verify the installed publisher's exact relational/function/privilege structures before applying pending `20261030180827` followed by CLI-minted `20261031194228`. Use SQL-level acceptance for 42501/23505, authenticated versus service-role finalize, immutable INSERT-only rows, truncate holds, transaction rollback, reservation retry, week freeze, exact raw digest. This proves target-schema compatibility but **does not replace proof of a clean historical migration replay**. Prefer the existing acceptance harness, not new permanent CI files.
4. **Resolve branch replay as a distinct release gate:** obtain an accepted, provenance-preserving baseline/migration strategy for data-less Preview that does not silently alter or skip applied Production history. Prove it from clean original main in a local disposable environment first; only then create one new paid Preview if final hosted parity is still required.
5. **Only after both gates:** secret-presence parity, JWT/capability, private Storage, real browser-shaped multipart and admin CAS, then independently governed weekly ranking/edit approval, and protected CI. Never claim research-only Shazam discovery counts are stream or scheduled collector evidence.

## Immediate authority holds

- PR #1333 source HEAD `f97de34178e20b14ef6d130ed78818a831a73609`: 140/140 focused source tests and application build previously accepted; pending SQL remains unapplied.
- No Production SQL, Edge, Storage, frontend Finish Update, merge, paid Preview, or WK100 Edition publication is authorized by this report.
- Project Deployment Workflow: on first unexplained failure switch to diagnosis; no repeat paid preview and no synthetic schema equivalence.
