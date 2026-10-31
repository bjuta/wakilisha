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

## Recovered local historical replay receipts (31 October, Mac read-only inspection)

The owner's checksum-pinned `wk100_historical_replay_evidence_readonly_nested_fix_20261031.sh` found **all 12 original nested receipts uniquely** in the private `Phase2CleanHistoryReplay-20261030.7Vao7nGg` archive, without opening Docker or a database. The earlier 'missing' error was caused by a mistaken top-level-only lookup, not missing evidence.

- `stop-reason.txt`: `STOP: Could not identify exactly one isolated DB container for local assigned port`. This is a **container-identification stop**, not a PostgreSQL SQLSTATE or proof that either migration failed.
- `migration-235-up.log`: reports `Applying migration 20261030062819_retire_18_kenya_rnb_editions.sql` followed by `Local database is up to date.`
- `migration-236-up.log`: reports `Applying migration 20261030180827_chart_full_filter_decision_execution_v1.sql` followed by `Local database is up to date.`
- `final-ledger.txt` and `final-expected.txt` have **identical SHA-256** `b252fd937fc32695d580eefe3a8f2ea1153a28df8759a99aa303689261816b86` and both include `20261030062819` and `20261030180827`. This supports the **historical retirement plus Phase 2** replay path, not current publisher parity.
- `retirement-receipt.txt`: `1|18|1800|2904`; `retired-editions.txt`: `0`; `provider-link-policy.txt`, `transaction-invoker.txt`, and `local-connect.txt`: each `1`; `structural-fingerprint.txt`: `14|450|2418899d6ff56a1e4a049d0cc1d4ad2e8d3e8ab533948860dcb3846efee10ac3`.
- **Neither** the publisher `20261030095808` **nor** the researcher ledger `20261031194228` appears in the accepted local replay's final ledger, and the local DB container that replay used could not be uniquely identified. Do not reuse its old `Local database is up to date` text to attest these untested migrations.
- The running `supabase_db_wakilisha-supabase-deploy` is a **different, shared 225-migration development baseline** (PostgreSQL 17.6) and lacks publisher/Phase 2/research tables. Never apply WK100 acceptance migrations to its `postgres`, `_supabase`, or `storage_vectors` databases.

**Next safe action:** locate the preserved, exact **historical isolated replay runner / container and ledger contracts**. In a newly dedicated, disposable local database, reproduce the independently accepted historical state without altering the shared Docker DB. Then apply the already-installed-in-Production publisher SQL `20261030095808` as the precondition, followed by pending `20261030180827` and `20261031194228`; test security and rollback against the actual fresh database. The old replay's original order had retirement → Phase 2; do not silently mistake it for publisher → Phase 2 → research. A partial local result cannot close clean data-less hosted Preview replay parity.

## Local 238-migration acceptance closure (31 October 2026)

**Local PostgreSQL acceptance PASS; hosted acceptance OPEN.** The owner executed SHA-256-pinned `wk100_pr1333_verify_238_postgres_rollback_receipt_20261031.sh`, expected checksum `5fd4ff3f4ad5e47438a5c8144c0f1313bd8a5a1d6dcdb30f99d836a64c8b36fc`, against the preserved private Docker stack `supabase-work-ab063a8b6677` and source-tested code commit `f97de34178e20b14ef6d130ed78818a831a73609`. Evidence retained privately at `~/PrivateResearch/WK100/PublisherResearch238-20261031.3IRB7mWr`. This was **not** Production or the shared 225-migration Docker DB.

- **Native clean historical replay 238/238 PASS:** 234 upstream migrations, synthetic-only retirement fixture followed by exact, unchanged retirement `20261030062819` at position 235, publisher `20261030095808` at 236, Phase 2 `20261030180827` at 237, research ledger `20261031194228` at 238. Exact installed migration ledger verified.
- **Exact source manifest and SQL probe PASS:** `EXACT_238_SQL_MANIFEST_AND_ORIGINAL_PROBE=PASS`; preserved 128-line SQL probe SHA-256 `4ff2435bf88eb7b148c1a3147ce53cf44dff860163195b10780047e1fe7ab300`.
- All five original SQL probe markers appeared **exactly once** in the preserved receipt: `RESEARCH_DDL_GRANT_RLS_TRIGGER_CONTRACT=PASS`, `MISSING_ACTOR_RESERVATION_DENIED=PASS`, `SERVICE_FINALIZE_RETRY_AND_GAPPED_RANK_DENIAL=PASS`, `IMMUTABILITY_AND_FAILED_FINALIZE_ATOMICITY=PASS`, and `RESEARCH_LEDGER_SYNTHETIC_PROBE_ROLLBACK=PASS`. The earlier wrapper-only `grep -Fx` failure was a PostgreSQL aligned-output whitespace mismatch; the guarded recovery inspected, rather than reexecuted, the original SQL test.
- Independent **read-only database** verification: all six publisher/Phase2/research tables present, 238-version migration ledger at `20261031194228`, **zero retained research reservation/native-row/verification test records**, original ledger readback PASS, read-only session confirmed. The private experimental Docker stack was **stopped with its data preserved**. `WK100_POSTGRES_TRANSACTION_AND_PRIVILEGE_PROBE=PASS` and `WK100_FULLCHAIN_LOCAL_238_SQL_ACCEPTANCE=PASS`.
- Independent connected GitHub/Supabase readback afterwards: PR #1333 stays open, draft, unmerged; source HEAD `c115dfbb421e1399f05de44800ac5825fe9c0228` (the two latest commits are documentation-only), **zero CI workflows/statuses** for that head; Supabase Production still has **236 migrations**, latest `20261030095808`, no research ledger and **zero objects** in `wk-chart-raw-evidence-v1`. Branch list includes only Production/main, with **no paid Preview branches**.

**Classification:** This closes only the *local native 238-migration replay, transaction/privilege/rollback gate*. Synthetic fixtures are explicitly test-only; no real Shazam source was inserted. It does **not** attest a real hosted Preview with equivalent secrets, live signed browser JWT/session revocation, authenticated Edge invocation, Storage write/readback, restricted CORS, Admin UI, approved source admission, ranking review, protected CI, or Production migration. Do not claim the entire PR or WK100 launch accepted. Keep the independent data-less hosted Preview replay blocker open until an approved deployment strategy has been proven; do not create another paid branch as a reflex.

## Immediate authority holds

- PR #1333 source HEAD `f97de34178e20b14ef6d130ed78818a831a73609`: 140/140 focused source tests and application build previously accepted; pending SQL remains unapplied.
- No Production SQL, Edge, Storage, frontend Finish Update, merge, paid Preview, or WK100 Edition publication is authorized by this report.
- Project Deployment Workflow: on first unexplained failure switch to diagnosis; no repeat paid preview and no synthetic schema equivalence.
