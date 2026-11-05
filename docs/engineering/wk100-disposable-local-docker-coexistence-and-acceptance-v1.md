# WK100: isolated local Supabase/Docker acceptance alongside existing projects

**Operational runbook v1 — 5 November 2026 (EAT).** Scope: WAKILISHA 100 Phase 1 disposable PostgreSQL 17 / GoTrue / PostgREST / private Storage acceptance on the operator's Mac. The established source of truth for the implementation remains PR [#1345](https://github.com/bjuta/wakilisha/pull/1345) and the accepted [deployment workflow](../../README.md) where applicable. This runbook explains *how to run an isolated temporary stack without interfering with any already-running or retained Docker resources*. It does not authorize hosted Preview mutations, provider collection, publication, Production deployment, CI green status or merge.

## Non-negotiable Docker ownership boundary

Multiple Supabase local projects **already coexist** on the Mac. On 5 November 2026, read-only Docker inventory included live project IDs `wk100bootyoaypdim` and `wk100pg239khx0jykp`, the older `wakilisha-supabase-deploy` database, and retained volumes for those and other projects. These resources are **not garbage**. Some are stopped, some are healthy, and their age does not establish deletion authority.

Never run `docker system prune`, `docker volume prune`, `docker container prune`, `supabase stop --all`, a global `docker rm`/volume loop, or `supabase stop --no-backup` against an existing project. Never reset a hosted Preview or Production project to run disposable acceptance. The earlier global guard that rejected the presence of *any* `supabase_*` container was **overbroad**; it was correctly replaced with checks scoped to one freshly created project. Do not revive it.

Read-only discovery, with no secrets printed:

```bash
docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}' | grep -E 'NAMES|^supabase_' || true
docker ps -a --format '{{.Names}}' | grep '^supabase_' |
while IFS= read -r name; do
  docker inspect --format 'container={{.Name}} project={{index .Config.Labels "com.supabase.cli.project"}}' "$name"
done
docker volume ls --format '{{.Name}}' | grep '^supabase_' || true
```

This inventory is **context**, not a list of objects to destroy or reuse.

## Tested isolated approach — preserve it for the next runner

The accepted 5 November local wrapper was `wk100_245_migration_disposable_acceptance_f0813440.sh`, SHA-256:

```text
066ca51046c5615e430a09c8472614ccc46a9cef5deb570b3a92d6aeca38a1f5
```

It fetched and strictly verified PR #1345 HEAD `f0813440c527f8861da1ca13dc9761ecd38c2ffd` before startup. The artifact was supplied to the Mac as an exact-hash-verified script; **it is an evidence-specific wrapper, not a permanent entrypoint**. A future runner must pin the *new* intended HEAD, compute its own SHA-256, and reverify its own expected migration file count and digest. Do not silently reuse the old pinned HEAD.

Preserve the following sequence when regenerating a runner:

1. **Preflight:** verify Docker daemon, Git checkout origin `bjuta/wakilisha`, Node/npm/Python/tar/shasum and the exact PR commit. Use `git fetch --no-tags origin refs/pull/1345/head`, verify `FETCH_HEAD` equals the separately frozen SHA, then use `git archive <exact-sha>` into a fresh `mktemp -d` directory. **Do not modify the user's existing checkout** or change its current branch.
2. **Eliminate remote-target authority:** clear `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_URL`, `SUPABASE_DB_URL`, `DATABASE_URL`, `GITHUB_ACTIONS` and `GITHUB_EVENT_NAME` from the test process. Set `SUPABASE_EXPERIMENTAL_STACK=0` for this accepted CLI 2.121.0 path. Never fake GitHub Actions context to bypass a CI guard. Require that the disposable source snapshot has **no** `supabase/.temp/project-ref`.
3. **Create a never-before-used local project identity:** `wk100accept` followed by 10 cryptographically random lowercase hexadecimal characters, e.g. `wk100accept3becb12cc3`. Reject collisions with **existing containers or volumes for that exact ID**. Set `project_id = "<unique-id>"` **only in the temporary snapshot's** `supabase/config.toml`; do not edit the tracked config. Reject changes to the committed config's expected baseline rather than replacing arbitrary existing keys.
4. **Give only the new stack dedicated ports:** select and check a free local API/DB/shadow-port triplet (the accepted Mac runner used a randomized adjacent triplet in the 35000–59500 range). Write `[api] port`, `[db] port` and `shadow_port` into the snapshot config; verify the actual local API URL afterwards. Never reuse the hosted Preview/Production URL or assume the default 54321 port is free.
5. **Pin tools without changing global installs:** use `npx --yes supabase@2.121.0` as a disposable `supabase` wrapper and `npx --yes node@22` for the real GoTrue/Storage acceptance runner. The Mac may still have global Supabase 2.107.0 and Node 26. Ignore the CLI's advisory to upgrade to a newer major release for this already-tested replay; changing the CLI version is a **new acceptance decision**. Install JavaScript dependencies in the temporary snapshot with `npm ci --ignore-scripts --no-audit --no-fund`.
6. **Start only the new stack:** from the temporary project root, use the pinned CLI with `supabase start -x realtime,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor`. Auth, REST, Storage and PostgreSQL must be running. Lines saying `Stopped services:` for the **new ID's excluded services** are expected; do not interpret them as existing projects being stopped.
7. **Independently bind ownership:** require the exact database container name `supabase_db_<new-id>`; check Docker label `com.supabase.cli.project` equals the new ID. Check `supabase status -o env` resolves `API_URL=http://127.0.0.1:<allocated-api-port>`. Do **not** select a database with an unbounded `name=^supabase_db_` filter when multiple local stacks exist.
8. **Run existing, scoped acceptance harnesses:** the exact-order entrypoints are `scripts/acceptance/run-wk100-two-session-disposable-ci.sh` and `scripts/acceptance/wk100-genuine-auth-storage-disposable-ci.mjs`. Use the following **explicitly local, no-provider-egress** environment for both, substituting the actual new ID/port; do not set `GITHUB_ACTIONS=true`:

```bash
export WK100_LOCAL_DISPOSABLE_ACCEPTANCE=true
export WK100_LOCAL_STACK_ID="<new-wk100accept-id>"
export WK100_LOCAL_API_PORT="<new-api-port>"
export WK100_LIVE_SOURCE_ACCEPTANCE=false
bash scripts/acceptance/run-wk100-two-session-disposable-ci.sh
npx --yes node@22 scripts/acceptance/wk100-genuine-auth-storage-disposable-ci.mjs
```

Both entrypoints must continue to check the exact owned Docker project and the local API URL; they must not turn on live source provider egress. The local fixture uses two *genuine GoTrue-issued* users **only inside the temporary Auth database**, so deletion of a hosted Auth identity is never necessary. The synthetic role assignments and source methods are local test data, not a real-world source admission.

9. **Cleanup on every outcome, including failure:** use an EXIT trap. First leave the work directory; then, **only after rechecking** `project_id` in the temporary config and ownership, run the pinned `supabase stop --no-backup` **from that exact temporary project directory**. Inspect containers and volumes by a suffix match for the *single newly generated ID*, not a global `supabase_*` match. If its resources remain or Docker is unavailable, print `ISOLATED_STACK_ID` / `ISOLATED_DIAGNOSTICS_DIR` and **STOP**; do not use a wider prune or claim cleanup. Remove the temporary directory only when its own resources are absent.

The pinned script did not use the experimental `supabase stack` multi-project API. Isolation was achieved by a **unique temporary project root, project_id and explicit ports** under the tested CLI 2.121.0. Do not switch approaches merely because `supabase stack` is available in later releases; a new stack mode would require its own verification and cleanup contract.

## Actual accepted evidence — 245 active migrations

The owner ran the SHA-verified wrapper on **5 November 2026**. Unique project ID: `wk100accept3becb12cc3`; local API port `41434`. The supplied terminal transcript reports:

```text
WK100_SOURCE_CONTROLLED_245TH_MIGRATION_AND_SHA=PASS
WK100_DISPOSABLE_EXACT_ACTIVE_MIGRATION_LEDGER=PASS
WK100_TWO_INDEPENDENT_POSTGRES_BACKENDS=PASS
WK100_TRUE_OVERLAP_AND_ROW_LOCK_WITNESSED=PASS
WK100_ONE_LEASE_SECOND_SQLSTATE_55P03=PASS
WK100_COLLECT_NOW_ACTIVE_245TH_MIGRATION_EXACT_SHA_SQL_AND_ACL=PASS
WK100_COLLECT_NOW_ANON_SIGNED_UNPRIVILEGED_AND_SERVICE_DENIED=PASS
WK100_COLLECT_NOW_GENUINE_JWT_REQUEST_REPLAY_SERVICE_READ_AND_DENIAL=PASS
WK100_COLLECT_NOW_SECOND_REAL_JWT_DENIED_AND_CROSS_ACTOR_REPLAY=PASS
WK100_COLLECT_NOW_REVOKED_JWT_AND_PAUSED_METHOD_FAIL_CLOSED=PASS
WK100_LOCAL_PRIVATE_SERVICE_BYTE_READBACK_SHA256=PASS
WK100_GENUINE_AUTHENTICATED_USER_PRIVATE_DOWNLOAD_AND_LIST_DENIED=PASS
WK100_ANONYMOUS_PRIVATE_DOWNLOAD_DENIED=PASS
WK100_DISPOSABLE_TWO_REAL_GOTRUE_USERS_COLLECT_NOW_STORAGE=PASS
WK100_ISOLATED_PROJECT_CLEANUP=PASS
```

These are **operator-provided terminal results**, recorded as such. The exit trap reported cleanup PASS; no independent post-run Docker inventory has been claimed. Exact migration under test: `supabase/migrations/20261105131250_wk100_collect_now_authorized_v1.sql`, whose bytes equal the frozen candidate `scripts/acceptance/wk100-collect-now-forward-candidate-v1.sql`, SHA-256 `d25c7912e47c7cafd16741a0f520081785dffd4e353d545a831ba3c7ec362fd5`.

This **passes actual-clock local disposable GoTrue/PG17/Storage acceptance at the pinned SHA**. It does **not** produce a GitHub Actions pull-request workflow run, prove ongoing hosted Preview signed-in/denied-role HTTP authorization, admit real external providers, prove any hosted original-byte receipt, perform two logical EAT weeks of full application orchestration, or permit scoring/publication.

## Source authority, CI budget and next gates

- Real harness code: `scripts/acceptance/run-wk100-two-session-disposable-ci.sh`, `scripts/acceptance/wk100-genuine-auth-storage-disposable-ci.mjs`; active migration above. CI uses `.github/workflows/wk100-disposable-security.yml`.
- Follow `docs/engineering/ci-budget-recovery-and-draft-gates-20261104.md`: draft PR jobs intentionally **skip**; skipped is not success. Ready-for-review triggers the full protected workflow only after stable local acceptance and budget authority.
- `docs/engineering/live-schema-baseline.json` and `docs/engineering/replay-proofs/` must **not** claim a 245-file successful GitHub PR workflow until a real, exact-head passing run exists. Never forge a `workflowRunId`, replay proof, migration digest or public-release approval.
- Keep hosted Preview collector and scheduler flags **OFF** until separately authorized; do not issue service scheduler/capture requests as a side effect of local tests. Production and the WAKILISHA frontend remain untouched by this procedure.
- Remaining Phase 1 gates: genuine hosted role acceptance with verified fixture lifecycle, approved real-source original-byte private SHA-256 readback, accelerated two-logical-EAT-week application-level acceptance, protected CI, review and subsequent explicit release authority.

**Recovery rule:** If the script encounters a port conflict, replay drift, wrong project ownership, missing tool version, or cleanup failure, preserve the STOP marker/diagnostics. Repair **the isolated runner** or exact source contract; do not stop, delete, rename or reuse someone else's Docker resources to force a green test.
