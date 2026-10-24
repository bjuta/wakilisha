# MIZIZI × WAKILISHA Chart migration lineage collision — Phase 1 evidence

**Date:** 25 October 2026 (Africa/Nairobi)  
**Status:** **HARD BLOCK / NO REMOTE MUTATIONS / NOT APPROVED FOR MERGE OR DEPLOYMENT**  
**Authority:** owner-approved [MIZIZI four-phase product contract](./mizizi-product-phase1-reconciliation-20261024.md), merged through #1306. This proof belongs to existing MIZIZI QV3 PR #1251, not a new programme or Production release.

## Scope and exact evidence

GitHub Actions [#40141609137](https://github.com/bjuta/wakilisha/actions/runs/40141609137), at commit `c7ee815a3563e2b1f96f8d581aa64feb9933e310`, added two **disposable** forward-only replays to the *existing* `mizizi-slice1-disposable-postgres.yml` workflow. Each checkout was pinned to exact MIZIZI QV3 PR head and accepted `main@216f142f22fe4b55532e8944e4e2758ac5357ca5`, verified no linked Supabase project/access token, and compared **all 231 shared original migration SQL files byte for byte**. The migration preflight used local Supabase CLI 2.121.0 and disposable Docker Postgres. Local data and volumes were destroyed afterward.

The two starting histories are:
- **Production / merged main:** 231 common through `20261015091718` + three chart capture migrations dated 19–20 October = **234**.
- **Hosted MIZIZI Preview / PR stack:** same 231 common + six MIZIZI research/question/source-attestation migrations dated 16–17 October = **237**.

Both have historical applied migration versions. Do **not** describe the second as three migrations ahead of the first. The original six Preview SQL files and the original three Production SQL files were **not edited** to run this proof.

| Forward-only attempt | Actual result | Fail-closed cause |
| --- | --- | --- |
| Production-first 234 → append six original MIZIZI migrations | **BLOCKED.** Replayed the 234 initial migrations, then stopped applying MIZIZI DB06 | `20261016114918_mizizi_research_job_retry_budget_v1.sql` asserts existing migration **count = 233** and **max(version) = 20261016092731** plus exact function SHA256. With already-applied later Chart migrations, this historical precondition is false; `STOP_MIZIZI_RESEARCH_RETRY_BUDGET_BASELINE_DRIFT`. |
| Preview-first 237 → append three original Chart migrations | **BLOCKED.** Replayed the 237 initial migrations, then stopped applying WK100 first Chart migration | `20261019152307_wk_chart_observation_receipts_v1.sql` asserts existing migration **count = 231**, **max(version) = 20261015091718** and exact missing capture objects. With already-applied MIZIZI migrations this fails: `STOP: WK100 receipt substrate expects exact accepted 231-migration baseline`. |

The earlier first attempt of the test [#40141352868](https://github.com/bjuta/wakilisha/actions/runs/40141352868) additionally encountered a CI-only unbraced Bash log variable after successfully starting the Preview-first 237 database. That log-expression error was corrected without SQL edits before the more authoritative paired results above. Docker Hub `toomanyrequests` warnings on one runner did not cause the recorded SQL preflight failures.

**Independent observation:** Chart's two other accepted migrations also check exact historical ledger prerequisites (the original 232/233 steps), and MIZIZI QV1/QV2/QV3 retain guarded source/role contracts. Updating one count or globally bypassing preflights is not a valid fix.

## Decision and security boundary

These guards are doing what their authors intended: preventing unexpected history from being misrepresented as accepted. The failure is an **integration architecture issue caused by independently accepted, non-linear migration histories**. It is **not** proof of a duplicate table/object collision and not a reason to reset either environment.

**Prohibited shortcuts:**
- Do not edit SQL bytes of a migration already applied in Preview or Production under the same historic version without formal supersession and audit authority.
- Do not delete, spoof, backdate, or temporarily remove rows from `supabase_migrations.schema_migrations` to trick existing preflights.
- Do not mark a missing migration as applied without equivalent verified effects and an explicitly reviewed and recorded migration reconciliation; no casual `supabase migration repair`.
- Do not use a newly provisioned paid Preview, clone, or Production cutover as an unreviewed escape hatch.
- Do not promote research QV3 or claim authentic independent ACH learning on the strength of a worker pass or field existence.

## Required resolution proposal — not yet approved as executable SQL

1. **Freeze and verify both ancestries.** Preserve exact original nine SQL SHA256s, live migration ledger versions, affected table/function/trigger/ACL policies, DB05 Holds and existing data. All work remains read-only until an approved implementation exists.
2. **Design a reviewed forward-only reconciliation** that produces the **same effective schema** from each existing environment without pretending the histories were linear. The design must state how the canonical migration runner will handle already-applied version IDs *and* how original preflight and source immutability will remain auditable. A new numbered compatibility migration or explicitly controlled historical-source supersession may be evaluated, but neither is implicitly authorized by this document.
3. **Test both directions with exact source and real dispositions.** Local clean 231+9 replay alone is insufficient; independent 234→converged and 237→converged disposable tests must pass with identical result-type/function/DDL/RLS/ACL seals, deny-lists, exact grants, origin secrets presence checks (names only), and no retries that rewrite history.
4. **Only then** plan a separately authorized, non-destructive **hosted Preview** update preserving its one real case and two research-pass records. Keep Production SQL unchanged unless another independently scoped production release is explicitly reviewed and accepted.
5. **Retain this red compatibility gate** until the recorded solution passes; do not merge draft #1251/#1243 chain or declare Phase 1 migration acceptance merely because their original isolated 231→237 proof is green.

### Remaining Phase 1 gates

The M1 responsive shell on PR #1244 and the UI acceptance suite are a separate independent workstream. They do not resolve this database history fork. The current product programme Phase 1 cannot close with this divergence unaddressed.
