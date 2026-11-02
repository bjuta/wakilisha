# RNB18 Stage 2 — governed history-only retirement

## Release prerequisites (actual)
- Stage 1 PR #1335 squash merged to main: `a0a02cd57f548468a6a9c51e5ff56175ccd89448`.
- Native governed Production promotion [run 41399050636](https://github.com/bjuta/wakilisha/actions/runs/41399050636) succeeded at that exact main commit.
- Independent read-only Production postflight: 237 migration rows, head `20261101210335`, historical `20261030062819` present once, forward `20261101210335` present once, 2,904 archive rows, one immutable receipt. Exact `verify-rnb18-stage1-replay-authority.sql` passed.
- Original retirement SQL is preserved under `docs/engineering/replay-baseline/retired-active-migrations/` using the exact original Git blob `b3c2b412ea8bb594d22f61858fb40c5c4a6553f5`.
- Genuine hosted Stage 2 zero-data Preview: project `uummbxewahdozsjkubez` / branch `c00bfe1e-fcc8-4a10-86b3-c2af1d249776`, 236 migrations and head `20261101210335`, zero archive rows and receipts. Provider native check and read-only verifier passed. Preview was deleted after evidence capture.
- Canonical `public,editorial` types SHA256 `eed74587624364062f6d4cee1d2b0a16d530aa86865d2493476994061e8a9cf6` from official CLI 2.107.0. The exact immutable hosted receipt was committed in source at `905455ba985b25814a6ad45b9b92229510a2abe4` and preserved in Git history.

## Single authorized Production mutation, NOT executed by this PR

After exact branch and ledger acceptance, run `bash scripts/control-plane/retire-replay-migration-history.sh 20261030062819` **through authenticated native Supabase CLI linked only to Production**. The script requires the original SQL to be absent from the active source and its archived receipt present once. It uses `supabase migration repair 20261030062819 --status reverted --linked`, which changes solely the version's migration-history ledger entry and does not run an inverse data migration.

**Required preflight:** 237 applied; original version exactly once; forward version exactly once; 2,904 archive rows; one immutable receipt; exact main and stage-2 source Git SHAs. Confirm no other version pending and no other repository changes.

**Required postflight:** 236 applied, head `20261101210335`, original version **absent**, forward version present once, 2,904 archive rows and one immutable receipt. Run the exact committed read-only RNB18 verifier again. Do not delete the archival business rows, alter forward migration SQL or mark a different history version reverted.

Keep Stage 2 PR #1336 **draft and unmerged** until native repair is complete and final exact-head Critical Control Plane, WK100, MIZIZI and real-browser tests are green. No Edge/frontend/Registry deploy or WK100 publishing activation.
