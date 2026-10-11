# MIZIZI Headquarters — local acceptance of 224th gateway repair

**Date:** 11 October 2026. **PR:** #1227. **Issue:** #1226.
**Scope:** Existing Mac local Supabase stack only; Production and paid Preview untouched.

## Defect and repair

The actual positive SQL fixture against migration 221's `mizizi_private.admit_case_research_job_v1` uncovered PL/pgSQL output-name ambiguity in three `ON CONFLICT` inference targets. The previously applied SQL file `20261010161101_mizizi_case_resource_jobs_bridge_v1.sql` remains immutable. The new CLI-minted forward migration fixes precisely those targets using existing named constraints; its contents match audited Git blob `b27143802c833281e828126b583b39952d9d2669` byte for byte. The static regression contract pins the exact changes.

## Owner's observed real local positive execution

The owner executed SHA256-pinned `wk_mizizi_local_forward_repair_223_to_224_v1.sh` (runner SHA256 `f716788695b514df0c0fd3c1c6feb08add58b6067daad96f4e97654417ba5fe0`) with Supabase CLI **2.107.0**, exact protected main `cff8e57222ac735b5c2e8c3b7a17ee50c49da3dd`, exact candidate PR source `72b006435796bccc9f2ccf43834b398e98ad565e`, and established local `supabase_db_wakilisha-supabase-deploy`.

- CLI minted `20261011095852_mizizi_case_research_conflict_target_repair_v1.sql`.
- Exact migration SHA256 `b30744d3419436a0a7f4053cba30b2cfe4a1ec49b3298afc7ed39360ad34dc40` was verified, and the artifact retained in Downloads.
- `LOCAL_LEDGER_BEFORE=223|20261010174145`; native `supabase migration up --local` applied exactly one new migration, yielding `LOCAL_LEDGER_AFTER=224|20261011095852`. The full historical 224-version list matched the exact source set.
- Permanent independent verifier: `MIZIZI_CASE_RESEARCH_CONFLICT_REPAIR_VERIFIER=PASS`.
- Actual positive PostgreSQL tests against the **permanently installed function**: `LOCAL_RESEARCH_JOB_ADMISSION=PASS`, `LOCAL_RESEARCH_JOB_IDEMPOTENT_REPLAY=PASS`, `LOCAL_RESEARCH_JOB_FIRST_CLAIM=PASS`, `LOCAL_RESEARCH_EXPIRED_LEASE_RECOVERY=PASS`, `LOCAL_RESEARCH_JOB_RESTART_RECLAIM=PASS`, `LOCAL_RESOURCE_RECEIPT_OUTBOX_INTEGRITY=PASS`.
- Fixtures were rolled back: `LOCAL_JIT_JOB_FIXTURE_ROLLBACK=PASS`, `ORIGINAL_1094_WORKTREE_RESTORED=YES`, `LOCAL_ONLY_NO_PREVIEW_OR_PRODUCTION_SQL=YES`.
- The CLI artifact is deliberately identical to the pre-existing reviewed SQL source; its opening source-only comment remains for byte identity, despite the now-minted filename.

## Release boundary

Existing isolated Preview `nkgfoppunmnkcumalxqp` remained at 223 after this local acceptance. Production `pgzizndxdyhqmtyywjmt` remains at 216. **Preview native migration apply, independent Preview verifier, updated migration replay proof and protected CI are separate pending gates.** Local session authorization and transactional worker SQL do not prove cloud JIT authentication or deployed end-to-end worker restart. No merge or Production promotion authorized.
