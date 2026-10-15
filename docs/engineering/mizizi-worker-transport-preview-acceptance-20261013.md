# MIZIZI Headquarters Slice 1 — Preview Worker Transport 225 Acceptance

## Status Reconciliation: 15 October 2026

This file is the sealed **historical Preview migration 225** receipt. Later Preview migrations installed through **230** (`20261014182214`). The original worker transport, typed case/resource bridge, read-only research command registration, lease/retry/recovery, and real-JWT/disposable PostgreSQL contracts remain preserved and pass on pre-documentation source HEAD `733b8452`. The installed Preview currently has **zero** durable cases and **zero** `mizizi.case_research_v1` jobs, and the shared queue contains **no `registry.%` canonical writer command type**.

An available read-only worker contract is not a continuously scheduled Production research service, an independently learning model, a delivered customer integration, or evidence for original H37's queued mutating job. Do not backdate this 225 acceptance, rerun its applied migration, or claim million-scale throughput. See [enterprise product and current release authority](mizizi-enterprise-product-and-release-authority-20261015.md); Production is still at 216 migrations and PR #1227 remains draft.



- **Date:** 13 October 2026 (Africa/Nairobi)
- **Repository:** `bjuta/wakilisha` · draft PR #1227 · parent issue #1226
- **PR head at acceptance:** `036688762e1a36a02da2dbf5d6a8a825b216c100`
- **Target:** isolated Supabase Preview `nkgfoppunmnkcumalxqp`
- **Migration (Supabase CLI-minted):** `20261013071022_mizizi_case_research_worker_transport_v1.sql`
- **Final Preview-deployed SQL SHA-256:** `6b2f3b916550ed53b94f838290ad044941b6294b69dff69bdd75ef8791df7a6a`

## Accepted execution evidence

The owner-Mac v3 runner checked the exact Git checkout and Preview link; compared all 224 applied migration versions against the approved local migration set; confirmed exactly one pending migration, performed a CLI dry run, then applied that migration **once** through the approved linked CLI connection.

Observed terminal markers:

```text
PREVIEW_WORKER_PROMOTION_SELF_TEST=PASS
MIGRATION_GUARD_ONE_CLAUSE_PATCH=PASS
ORIGINAL_LOCAL_APPLIED_225_SOURCE_PRESERVED=PASS
MIGRATION_SOURCE_SHA256=6b2f3b916550ed53b94f838290ad044941b6294b69dff69bdd75ef8791df7a6a
PREVIEW_WORKER_SOURCE_AND_LINK=PASS
REMOTE_DRAFT_HEAD=PASS
PREVIEW_LEDGER_BEFORE=224|20261011095852
PREVIEW_LINKED_AUTHORITY=PASS
PREVIEW_FULL_LEDGER_224_VERSIONS=PASS
PREVIEW_EXACT_SINGLE_PENDING_225=PASS
PREVIEW_DRY_RUN_CLI_EXIT=PASS
PREVIEW_DRY_RUN_FILENAME_OBSERVED=1
PREVIEW_PRE_APPLY_AUTHORITY_RECHECK=PASS
PREVIEW_DRY_RUN_EXACTLY_ONE_MIGRATION=PASS
PREVIEW_PENDING_MIGRATION=20261013071022_mizizi_case_research_worker_transport_v1.sql
PREVIEW_CLI_FORWARD_APPLY=COMMAND_SUCCEEDED
PREVIEW_WORKER_INDEPENDENT_ACL=PASS
PREVIEW_WORKER_SECURITY_CHECKS=16
PREVIEW_LEDGER_AFTER=225|20261013071022
PREVIEW_WORKER_MIGRATION=PASS
PRODUCTION_SQL_APPLY=NOT_RUN
GIT_COMMIT=NOT_RUN
```

## Independent connected database checks

Following the owner-Mac run, connected read-only Supabase SQL returned **225** applied migrations with latest version `20261013071022`; the target version occurred **exactly once**.

All four `public` worker functions exist:

- `mizizi_claim_case_research_jobs_v1(text,integer,integer)`
- `mizizi_recover_expired_case_research_jobs_v1(integer,integer)`
- `mizizi_complete_case_research_job_v1(uuid,text,jsonb)`
- `mizizi_fail_case_research_job_v1(uuid,text,text,boolean,integer)`

Each is owned by `postgres`, has `SECURITY DEFINER`, sets `search_path=pg_catalog`, grants `EXECUTE` to `service_role`, and denies `EXECUTE` to `anon`, `authenticated`, and `mizizi_executor`.

An independent SQL attempt to invoke the claim function without an authorized service-role JWT context failed as expected with **SQLSTATE 42501**, `Service-role access is required`. This verifies the negative internal guard, **not** the positive authenticated service-role HTTP route.

A subsequent read-only query found **zero** MIZIZI cases. The Preview database contained no source-backed test case when the migration was accepted.

## Accepted actual Preview HTTPS/JWT acceptance

The owner ran SHA-pinned `wk_mizizi_preview_worker_http_auth_20261013_v2.mjs` using existing authenticated Supabase CLI to obtain the legacy Preview `anon` and `service_role` keys **in memory only**. The runner performed actual HTTPS requests to each of the four REST RPC routes. Exact observed markers:

```text
WORKER_HTTP_AUTH_SOURCE_AND_LINK=PASS
WORKER_HTTP_AUTH_PREVIEW_QUEUE_EMPTY=PASS
WORKER_HTTP_AUTH_LEGACY_KEYS=IN_MEMORY_ONLY
WORKER_HTTP_ANON_DENIED_mizizi_claim_case_research_jobs_v1=PASS
WORKER_HTTP_ANON_DENIED_mizizi_recover_expired_case_research_jobs_v1=PASS
WORKER_HTTP_ANON_DENIED_mizizi_complete_case_research_job_v1=PASS
WORKER_HTTP_ANON_DENIED_mizizi_fail_case_research_job_v1=PASS
WORKER_HTTP_AUTH_PRE_SERVICE_QUEUE_EMPTY=PASS
WORKER_HTTP_SERVICE_mizizi_claim_case_research_jobs_v1=PASS
WORKER_HTTP_SERVICE_mizizi_recover_expired_case_research_jobs_v1=PASS
WORKER_HTTP_SERVICE_mizizi_complete_case_research_job_v1=PASS
WORKER_HTTP_SERVICE_mizizi_fail_case_research_job_v1=PASS
WORKER_HTTP_AUTH_POST_STATE_UNCHANGED=PASS
WORKER_HTTP_AUTH_GATE=PASS
AUTHENTICATED_USER_JWT_NEGATIVE=NOT_RUN
CASE_JOB_LIFECYCLE=NOT_RUN
PREVIEW_MIGRATION_APPLY=NOT_RUN
PRODUCTION_SQL_APPLY=NOT_RUN
GIT_COMMIT=NOT_RUN
```

Anonymous calls required HTTP 401/403 with SQLSTATE `42501`, rejecting route-not-found responses as insufficient. Service-role empty-queue claim returned HTTP 200 `[]`; lease recovery returned HTTP 200 `0`; complete/fail for a nonexistent job reached the typed worker guard and returned SQLSTATE `55000`. Preview ledger and empty queue were verified unchanged after all requests. This is **real service-role and anonymous HTTP boundary acceptance**; authenticated *signed-in user* denial remains open.

A permanent independent read-only worker verifier subsequently returned `MIZIZI_WORKER_TRANSPORT_INDEPENDENT_VERIFIER=PASS` against deployed Preview. It checks the 225th migration, private-schema USAGE denial, all four RPC identities, owner, search paths, EXECUTE permissions and overload cardinality. No job fixture was added.

## Release distinction and outstanding work

The previously accepted local migration 225 used source SHA-256 `a9eb37336a309cb4eac3645cc79fe5a7c5df323fbbb65eed13fdc22396e495ef`. Its PostgreSQL identity preflight required direct `postgres` login. The final Preview-applied migration changed only this guard to permit `session_user='cli_login_postgres'` *when* the effective role is still `postgres` and PostgreSQL confirms SET membership. The prior local proof does not constitute a byte-identical final-source replay. This limitation must remain explicit.

Outstanding gates at initial Preview acceptance (later closures are recorded in the follow-up below):

1. Permanent source, SQL verifier and focused tests integrated into draft PR #1227, final amended migration replay evidence and matching migration replay proof; updated schema types and snapshot seal; protected CI.
2. Actual signed-in `authenticated` user JWT denial over HTTPS; `anon` denial and positive `service_role` HTTPS/JWT acceptance have PASSED and must not be repeated.
3. One real source-bound Registry review-to-case admission, typed shared job/receipt/outbox, claim, complete/fail, expired lease/restart, concurrency, Hold Writes and audit history with independent verification. No fabricated canonical records or forged receipts.
4. Signed-in Headquarters operator acceptance, scoped production rollout, then separately audited Production/Edge/frontend promotion if required. PR is draft and unmerged; **no Production change authorized**.

Do not retry migration 225 in Preview, rerun accepted executor authentication, or merge PR #1227 based solely on this gate.

## Subsequent acceptance — 13 October 2026 (source commit, protected CI, final-byte local transaction replay)

**Authoritative source:** committed draft PR head `bb338a98099d39a5df6347e8893d1fa8d2607b98`. The committed migration has SHA-256 `6b2f3b916550ed53b94f838290ad044941b6294b69dff69bdd75ef8791df7a6a`. This section supersedes the initial outstanding-gates inventory above without erasing its historical state.

**Repository and CI:** Owner Mac completed 55/55 focused Vitest tests across four suites, committed eight scoped files and pushed to the draft PR. [GitHub Critical Control Plane run #38377822444](https://github.com/bjuta/wakilisha/actions/runs/38377822444) completed successfully on this exact SHA: `critical-core`, `critical-browser` (97 browser tests), and aggregate `critical` all passed. The migration replay contract, repository schema seal and live migration-history checks were green. No merge or Production promotion followed.

**Final amended migration delta replay: PASS, with transactional rollback.** The owner executed the SHA-256-pinned local-only runner `wk_mizizi_final_225_local_transaction_replay_20261013.sh` (runner SHA-256 `3e17c070e30ca0c51769a6437e72440eee6e69ba7a3d0beeba0a922154ca6296`). It verified the exact approved source and local authority, temporarily reconstructed the 224 predecessor inside one PostgreSQL transaction, executed the **final committed amended migration** and the permanent SQL verifier, then `ROLLBACK` restored the previously accepted local 225 installation. The pre/post catalog fingerprint and ledger matched. Observed owner-Mac markers:

```text
FINAL_225_REPO_SOURCE_AND_LOCAL_IDENTITY=PASS
FINAL_225_INSTALLED_LOCAL_BASELINE=PASS
FINAL_225_TRANSACTION_ONLY_STREAM=PASS
MIZIZI_WORKER_TRANSPORT_INDEPENDENT_VERIFIER=PASS
FINAL_225_AMENDED_SOURCE_EXECUTED_AND_VERIFIED=PASS
FINAL_225_LOCAL_ROLLBACK_RESTORED=PASS
FINAL_225_LOCAL_CATALOG_AND_LEDGER_UNCHANGED=225|20261013071022
FINAL_225_TRANSACTIONAL_REPLAY=PASS
FINAL_FULL_CLEAN_REPLAY=NOT_RUN
PREVIEW_SQL_APPLY=NOT_RUN
PRODUCTION_SQL_APPLY=NOT_RUN
GIT_COMMIT=NOT_RUN
```

**Evidence boundary:** This is a real PostgreSQL **final-source transactional delta replay** and independent SQL verification. It is **not** a fresh clean 216→225 migration-history replay; the earlier historical clean 216→223 and local 224/225 evidence remains separate and must not be relabelled. The source deployed to Preview and the source in the draft PR are byte-matched by the committed SHA-256. PostgreSQL rollback preserved the local installed state, and the replay made no Preview/Production SQL or Git mutation.

**Still OPEN:** actual signed-in `authenticated` user JWT denial over HTTPS; authentic Registry-brokered review and source-bound Headquarters case/typed job lifecycle (claim, complete/fail, lease expiry, restart, concurrency and Hold Writes); signed-in operator acceptance. Isolated Preview had zero Auth users, Registry Tracks, reviews, cases and research jobs at the preceding inventory; no test identity or review fixture is assumed to exist. Keep the PR draft/unmerged. Production SQL, Edge and frontend remain untouched.

