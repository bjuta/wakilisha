# MIZIZI Headquarters Slice 1 — accepted local clean migration replay

**Acceptance date:** 11 October 2026 (owner Mac, Africa/Nairobi)  
**Owner evidence:** terminal output of checksum-pinned `wk_wakilisha_local_clean_216_then_223_recovery_v2.sh`  
**Runner SHA-256:** `cf6b89dba93ec4c398d2d2d92c39ecbc3f85c989a0db763a8df3bb52cd2a0e0a`  
**Production baseline:** accepted protected `main@cff8e57222ac735b5c2e8c3b7a17ee50c49da3dd`  
**Candidate source:** draft `integration/mizizi-headquarters-slice1@811c0275c6b0823c5101cd6e15ad203199a602b8` (pinned by Mac script when executed)  
**CLI version:** Supabase 2.107.0  
**Local reset authority:** explicit `WK_ALLOW_DISPOSABLE_LOCAL_DB_RESET=YES`, established `~/Desktop/wakilisha-supabase-deploy` stack only. No remote deploy.

## Exact execution evidence

1. An earlier local-only reset reached `Initialising schema...` and failed before migration application. Its incomplete local database had no migration ledger. The v2 recovery runner fail-closed on that exact `NOT_INITIALIZED` state and retried reset only once, with private debug logging.
2. Runner verified original #1094 branch/HEAD and untracked migration checksum, protected backup checksum, exact main SHA, exact PR SHA, exact SQL delta **216 main + seven candidate SQL files**, and hashes for each candidate.
3. Only the **216 accepted main SQL** files were staged; unrelated untracked #1094 migration excluded. `supabase db reset --local --no-seed --debug` succeeded from clean local state. Console markers:
   - `LOCAL_SUPABASE_INIT_RETRY=PASS`
   - `BASELINE_MIGRATIONS_REPORTED=216`
   - `CLEAN_216_BASELINE_LEDGER=216|20261009181647`
   - `LOCAL_MIZIZI_CLEAN_216_BASELINE_REPLAY=PASS`
   - The runner compared the complete ascending 216-version database ledger byte-for-byte against accepted main migration filenames.
4. The exact seven canonical MIZIZI SQL files were then staged and applied in order using `supabase migration up --local`: `20261010082702`, `20261010091606`, `20261010093509`, `20261010100017`, `20261010122222`, `20261010161101`, `20261010174145`.
   - `CLEAN_223_CANDIDATE_LEDGER=223|20261010174145`
   - `LOCAL_MIZIZI_CLEAN_223_CANDIDATE_REPLAY=PASS`
   - The runner compared the complete ascending 223-version database ledger against exact PR migration filenames.
5. All seven existing permanent, independent SQL verifiers were executed on the resulting local database and each returned its exact pass marker:
   - `MIZIZI_DB01_VERIFIER=PASS`
   - `MIZIZI_DB02_PERMANENT_VERIFIER=PASS`
   - `MIZIZI_DB03_PERMANENT_VERIFIER=PASS`
   - `MIZIZI_DB05_PERMANENT_VERIFIER=PASS`
   - `MIZIZI_CASE_GATEWAY_INDEPENDENT_VERIFIER=PASS`
   - `MIZIZI_CASE_SHARED_JOBS_SCHEMA_VERIFIER=PASS`
   - `MIZIZI_RESEARCH_LEASE_RECOVERY_SCHEMA_VERIFIER=PASS`
6. Final owner Mac exit seals:
   - `LOCAL_MIZIZI_CLEAN_216_BASELINE_REPLAY=PASS`
   - `LOCAL_MIZIZI_CLEAN_223_CANDIDATE_REPLAY=PASS`
   - `LOCAL_MIZIZI_SEVEN_PERMANENT_VERIFIERS=PASS`
   - `ORIGINAL_1094_WORKTREE_RESTORED=YES`
   - `LOCAL_ONLY_NO_PREVIEW_OR_PRODUCTION_SQL=YES`

## Scope and release boundaries

This is **actual clean-from-initialized-local-stack 216 baseline + seven candidate migration replay**. It supersedes the earlier *forward-only* 188→216→223 upgrade as proof of full historical migration replay. It does **not** claim cloud Preview was recreated from an empty database; existing Preview had separately passed all seven SQL verifiers and candidate applications at 223 migrations.

The debug log remains private on the owner Mac at `~/Downloads/wk_mizizi_existing_stack_preservation_Fj1x6C/clean_replay_debug.sWQoYb/local-reset-debug.log`; it may contain credentials and must not be committed. Original local #1094 worktree and untracked migration were restored. No Supabase Edge Function, Production SQL, Production frontend, Git merge or Preview deletion occurred.

**Replay-proof interpretation:** the seven matching `docs/engineering/replay-proofs/*.sql.json` files' `baseline_replay` fields are now evidence-backed as `pass` by this one complete clean local history. Their older `candidate_apply`, `verifier`, Preview/project refs, schema snapshot, recorded hashes and timestamps remain separately supported by earlier linked Preview verification. These replay proofs are not permission to merge PR #1227 or deploy Production: authenticated operator browser flows, trusted executor/lease and hold-negative fixture acceptance, product exit D1/D2/D3 and protected CI remain independent requirements.

**Tracking:** [Headquarters parent issue #1226](https://github.com/bjuta/wakilisha/issues/1226); [draft implementation PR #1227](https://github.com/bjuta/wakilisha/pull/1227).
