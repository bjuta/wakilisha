# RNB18 Stage 2 — governed history-only retirement

## Release prerequisites (actual)
- Stage 1 PR #1335 squash merged to main: `a0a02cd57f548468a6a9c51e5ff56175ccd89448`.
- Native governed Production promotion [run 41399050636](https://github.com/bjuta/wakilisha/actions/runs/41399050636) succeeded at that exact main commit.
- Independent read-only Production postflight: 237 migration rows, head `20261101210335`, historical `20261030062819` present once, forward `20261101210335` present once, 2,904 archive rows, one immutable receipt. Exact `verify-rnb18-stage1-replay-authority.sql` passed.
- Original retirement SQL is preserved under `docs/engineering/replay-baseline/retired-active-migrations/` using the exact original Git blob `b3c2b412ea8bb594d22f61858fb40c5c4a6553f5`.
- Genuine hosted Stage 2 zero-data Preview: project `uummbxewahdozsjkubez` / branch `c00bfe1e-fcc8-4a10-86b3-c2af1d249776`, 236 migrations and head `20261101210335`, zero archive rows and receipts. Provider native check and read-only verifier passed. Preview was deleted after evidence capture.
- Canonical `public,editorial` types SHA256 `eed74587624364062f6d4cee1d2b0a16d530aa86865d2493476994061e8a9cf6` from official CLI 2.107.0. The exact immutable hosted receipt was committed in source at `905455ba985b25814a6ad45b9b92229510a2abe4` and preserved in Git history.

## Historical pre-merge Production procedure (completed; retained for audit)

After exact branch and ledger acceptance, run `bash scripts/control-plane/retire-replay-migration-history.sh 20261030062819` **through authenticated native Supabase CLI linked only to Production**. The script requires the original SQL to be absent from the active source and its archived receipt present once. It uses `supabase migration repair 20261030062819 --status reverted --linked`, which changes solely the version's migration-history ledger entry and does not run an inverse data migration.

**Required preflight:** 237 applied; original version exactly once; forward version exactly once; 2,904 archive rows; one immutable receipt; exact main and stage-2 source Git SHAs. Confirm no other version pending and no other repository changes.

**Required postflight:** 236 applied, head `20261101210335`, original version **absent**, forward version present once, 2,904 archive rows and one immutable receipt. Run the exact committed read-only RNB18 verifier again. Do not delete the archival business rows, alter forward migration SQL or mark a different history version reverted.

**Historical hold, now satisfied:** PR #1336 was kept draft and unmerged until the native history repair and exact-head Critical Control Plane, WK100, MIZIZI and real-browser tests were accepted. No Edge/frontend/Registry deploy or WK100 publishing activation was included.

## Final RNB18 closure — Production verified 2026-11-02

**Outcome: the governed two-stage replay repair is deployed and its migration-history retirement is complete.** This retrospective record supersedes the pre-merge instructions above. It does not authorize or require a second application of either the forward migration or the history repair.

| Authority checkpoint | Accepted evidence |
| --- | --- |
| Stage 1 merge | [PR #1335](https://github.com/bjuta/wakilisha/pull/1335), squash `a0a02cd57f548468a6a9c51e5ff56175ccd89448` |
| Stage 1 native Production promotion | [GitHub Actions #41399050636](https://github.com/bjuta/wakilisha/actions/runs/41399050636), exact one-pending native Supabase CLI, 237 applied afterwards |
| Stage 2 native history repair | SHA-guarded detached-worktree Mac runner v2, accepted CLI 2.107.0 output `Repaired migration history: [20261030062819] => reverted`, `REPLAY_MIGRATION_HISTORY_RETIREMENT_PASS`, `RNB18_STAGE2_NATIVE_HISTORY_ONLY_RETIREMENT=PASS` |
| Stage 2 final source | [PR #1336](https://github.com/bjuta/wakilisha/pull/1336), squash `3df36b9c2d929b68927758c89350ecbb8e28baf7` |
| Hosted zero-data replay | Accepted 236 active SQL files, head `20261101210335`, no historical Edition fixture; [PR source proof](replay-proofs/20261101210335_rnb18_stage1_archive_replay_authority_v1.sql.json) and canonical `public,editorial` types SHA-256 `eed74587624364062f6d4cee1d2b0a16d530aa86865d2493476994061e8a9cf6` |
| Stage 2 exact-head security CI before merge | [Critical #41400057952](https://github.com/bjuta/wakilisha/actions/runs/41400057952), [WK100 #41400057951](https://github.com/bjuta/wakilisha/actions/runs/41400057951), [MIZIZI #41400057954](https://github.com/bjuta/wakilisha/actions/runs/41400057954): all **SUCCESS** |
| Post-merge Critical Core | [Main #41404283102](https://github.com/bjuta/wakilisha/actions/runs/41404283102): **PASS** |
| Post-merge real-browser/aggregate | **SUCCESS** — both critical-browser and the aggregate critical gate completed successfully |

**Independent Production readback after Stage 2 squash merge:** `pgzizndxdyhqmtyywjmt` contains **236** applied `supabase_migrations.schema_migrations` rows, head `20261101210335`, original retired version `20261030062819` **absent**, replacement version `20261101210335` **present once**, and exact version-and-name equality with all **236** active `supabase/migrations/*.sql` files on final `main`. The original historical SQL remains byte-identical in `docs/engineering/replay-baseline/retired-active-migrations/` (Git blob `b3c2b412ea8bb594d22f61858fb40c5c4a6553f5`). Private recovery archive remains **2,904 rows and one sealed receipt**. The unchanged `scripts/control-plane/verify-rnb18-stage1-replay-authority.sql` (Git blob `84cf60621d59f0e2bd61e3e6a618fd61d1dd1098`) was executed **read-only after merge** against Production, returning `WK_RNB18_POSTMERGE_MAIN_VERIFIER_PASS`. No historical business-data rollback or recreation.

**Boundaries:** This repaired RNB18 migration replay and Production migration-history authority; it did **not** deploy new Edge Functions, frontend, Registry changes or WK100 publishing activation. The temporary hosted Supabase Preview was deleted after its accepted proof was recorded, leaving no additional Preview branch. There is **no pending RNB18 database migration** and **no further history repair to perform**.
