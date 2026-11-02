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


## PG239 managed Storage dependency and failed local replay (1 November 2026)

**Classification: an assistant-authored acceptance-environment failure, not evidence of a product SQL defect.** These tests must not be retried until managed Supabase Storage is verified independently of application migrations.

### Exactly observed failed local attempt

- The first fresh local project `wk100pg239tuczr84f` was created at `~/PrivateResearch/WK100/Pg239IsolatedReplay-20261101.tUCzr84f` from **234** byte-matched historical application SQL files. Supabase CLI **2.107.0** rejected the generated `[db.shadow]` configuration before PostgreSQL startup. That unsupported local configuration key was the runner's defect.
- After replacing it with the documented `[db] shadow_port`, the second attempt **did** start the isolated PostgreSQL database, initialize its base schema and roles, and execute a prefix of historical application migrations. It stopped at `20261019203244_wk_chart_private_raw_evidence_v1.sql` with **SQLSTATE 42703**, `storage.buckets.versioning_status` missing. Saved original log `local-start-234-after-shadow-fix.log` contains the exact statement and error. It does **not** attest a completed 234, 238 or 239 database ledger.
- The runner's hard-coded `supabase start -x` excluded **`storage-api`**, although historical migration 233 relies on Storage-managed schema changes. Its Postgres-image-only preflight was not a sufficient dependency or version check. Merely removing the exclusion is **not** an accepted fix, because Supabase applies application migrations during `start`, and the required Storage-managed migration ordering and image versions have not been tested on this new local project. The exact failed Stack's Storage image/version was not captured, so do not invent it.
- The newer HTML migration is an **already CLI-minted private file**, `20261101074119_wk100_html_research_ledger_v1.sql` at `~/PrivateResearch/WK100/HtmlForwardMint-20261101.66BTV65c`, SHA-256 `4e9086bd3a550cf9d814f1ae82ebe8c9092c412d4391c2b3e1e24663cb09924c`. It was **not executed**. All prior 238 app SQL files were compared byte-for-byte against this private mint. Do not mint a replacement or change existing historical files.
- Both assistant-authored PG239 startup/resume scripts are **withdrawn as executable acceptance instructions**. The failed isolated project's database or volume might contain a partial migration history; keep it for forensics. Do not reset, remove or reuse it as an accepted baseline.

### Read-only production and upstream authority verified on 1 November

The accepted Production Supabase project `pgzizndxdyhqmtyywjmt` was checked through **SELECT-only catalog/managed-migration metadata queries**, with no user records, secrets, Storage bytes or DDL read or changed:

| Required managed Storage authority | Live Production result |
| --- | --- |
| `storage.buckets.versioning_status` | Present, `text`, NOT NULL |
| `storage.buckets.lifecycle_configuration` | Present, `jsonb`, nullable |
| `storage.buckets.file_size_limit` | Present, `bigint` |
| `storage.buckets.allowed_mime_types` | Present, `ARRAY` |
| `storage.migrations` | Present; 74 entries, maximum `id=73` |
| Storage migration `62` | `object-versioning-core` |
| Storage migration `68` | `bucket-lifecycle-configuration` |
| Storage migration `73` | `revoke-grants-to-unused-operations` |

Production's Storage-managed migration ledger is **not** WAKILISHA's `supabase_migrations.schema_migrations` application ledger. Never manually alter either ledger.

Source `supabase/migrations/20261019203244_wk_chart_private_raw_evidence_v1.sql` (Git blob `7e2e185e2855df25580fd622609d4c6c81ba53a5`) explicitly uses **both** managed `storage.buckets` columns and verifies bucket policies/RLS. The contract cannot be bypassed by a fake `ALTER TABLE storage.buckets` or a compatibility shim. The upstream [Supabase Docker 0.8.3 release from 2026-10-16](https://github.com/supabase/supabase/blob/master/docker/CHANGELOG.md) identifies `supabase/storage-api:v1.81.0` and its one-way Storage migrations, including object versioning. This is version-capable upstream evidence; it does **not** prove which Storage image was cached or which migrations ran in the failed local project.

### Accepted next environment contract, before any application SQL

1. **Inventory dependencies independently, not through another speculative full startup.** Establish a dedicated, never-linked project and an explicit, internally compatible Supabase CLI, Postgres and Storage image/version set; verify the exact image digests and local availability. Do not upgrade the shared developer stack globally. Official documentation: [CLI start and exclusions](https://supabase.com/docs/reference/cli/global-flags), [Supabase Docker release](https://github.com/supabase/supabase/blob/master/docker/CHANGELOG.md).
2. **First bootstrap the managed platform schema with zero WAKILISHA application migrations staged.** Its Storage initialization must be verified against the dedicated database: `storage.migrations` includes the vendor-authorized versions `62` and `68`, and `storage.buckets` has `versioning_status` and `lifecycle_configuration` with expected types. Confirm Storage policy and schema constraints still match the historical 233 preflight. **Do not add compatibility SQL to `storage`.** If this cannot be demonstrated with supported version-matched components, stop without replay.
3. **Only then stage the unchanged 234 historical application migrations.** Execute them on that same dedicated database, verify their exact `supabase_migrations.schema_migrations` versions, and compare schema/Storage-policy evidence with accepted Production authority. Do not take the old 238 test receipt as proof of this new instance.
4. Introduce only the existing sealed **synthetic** pre-retirement fixture on the dedicated 234 baseline. Execute the original 235 retirement, 236 governed publisher, 237 Phase 2 full filter, 238 Shazam research ledger and private CLI-minted 239 HTML ledger **in that order**, verifying each ledger boundary and source blob. Never copy historical Production user rows or fabricate live provider source receipts.
5. With 239 executed, prove the actual SQL semantics: ordinary/revoked caller denial `42501`, authenticated dual capability checks, service-only finalization, duplicate and conflicting retry handling `23505`, native 100 contiguous rows, append-only UPDATE/DELETE/TRUNCATE denials, failed finalize transaction rollback, week freeze, and **zero retained test rows after rollback**. Capture exact PostgreSQL SQLSTATE and durable read-only receipts.
6. Only after local DB acceptance, advance to **separate** real signed-JWT/Supabase gateway, private Storage create-only upload/download plus unauthorized read denial, Admin browser and hosted parity gates. A local Storage schema or a passing HTML parser does not prove the hosted end-to-end feature.

**Operational hold:** never apply or rewrite historical Production migrations 233–238, manually repair app or managed Storage migration ledgers, touch the shared 225-migration Docker DB or leftover Edge-only volumes, deploy a paid Preview, expose source HTML, deploy Edge/frontend, perform Production Finish Update, merge draft PR #1333 or publish WK100 on these receipts. Preserve the tested code authority `39853ebf5790c17a992e3367749a758f4b842301` and all prior acceptance evidence separately from this documentation correction.
