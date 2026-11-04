# Mac local verification migration — staged, not release accepted

4 November 2026 (Africa/Nairobi). Audited PR #1345 head:
`0ae76e4595083505a208a5e4b834675b28563810`.
Observed current main: `24ec5400327a70a9d5610d350a4ca487f28c1e13`.

This record supersedes the hosted-execution recommendations in
`ci-budget-recovery-and-draft-gates-20261104.md`. This branch is an isolated
implementation candidate. Do not publish or merge it as a completed rollout.

## Complete hosted workflow inventory

All eight original workflows used `ubuntu-latest`; none used a self-hosted runner.
The originals, including every gate, trigger/path filter, timeout and mutation
intent, are preserved byte-for-byte in `ops/local/workflows`. Their parsed job
plans and SHA-256 digests are in `ops/local/workflow-plan.json`. Those copies
are reference material, outside GitHub's executable workflow directory.

| Workflow | Original trigger | Replacement / disposition |
| --- | --- | --- |
| Critical Control Plane | PR, main push, manual | `core`, `browser`, `source-preflight`; live security/schema still blocked |
| WK100 Disposable SQL Concurrency and Signed-in Storage ACL | path-filtered PR | `wk100`: genuine SQL race, Auth/Storage ACL, real source acceptance for #1345 |
| MIZIZI Slice 1 Disposable PostgreSQL Proof | path-filtered PR | `mizizi-sql`, `mizizi-auth`: SQL corpus, concurrent claims, genuine JWT/browser/H38 |
| Public Runtime Watch | hourly, manual | Live public HTTP/browser probes retained in reference plan; local scheduling not activated |
| MIZIZI Release Production Control Plane | scoped PR, intent push, manual | Existing JIT broker and reviewed apply remain unchanged; execution blocked here |
| MIZIZI Track Production Control Plane | scoped PR, intent push, manual | Existing preflight/review/apply intent and exact-main constraints retained; blocked here |
| MIZIZI URL Identity Production Control Plane | scoped PR, intent push, manual | Existing single-trigger delta and Batch A constraints retained; blocked here |
| Repository Migration Production Promotion | explicit manual inputs | Exact-main, exact pending set, native dry-run/promotion/postflight retained; blocked here |

In the candidate executable YAMLs automatic triggers are removed and every job
has `if: ${{ false }}`. Manual dispatch also cannot allocate a runner. No workflow
was dispatched, and these local changes have not altered the remote repository.
No persistent Actions runner is registered on the laptop: arbitrary PR code must
never inherit the Mac's user credentials through a self-hosted runner service.

## Local implementation and evidence

Use Node 22, npm's committed lock, Ruby (for independent YAML/plan comparison),
Docker, Python, curl, unzip, xmllint and sha256sum. The terminal is native Darwin
arm64. Default Node was 26.3.1; Node 22 is installed at
`/opt/homebrew/opt/node@22/bin/node`. Docker server is 29.6.2. Supabase installed
CLI is 2.107.0; disposable acceptance requires a separate 2.121.0 binary on PATH.
Do not upgrade the independently pinned production CLI.

The entry point is `scripts/local/verify.mjs`. Its `audit` mode checks all eight
retirements and compares local plans to the original YAML. Scope names are in
the table; append `--plan` to inspect exact translated commands without running.
Execution requires a committed clean candidate. Each lane uses a private fresh
clone with no copied `.env` or Supabase link, a restricted environment, a bound
HEAD and base, a private report, per-step exit codes, hashes, and retained browser
captures before subsequent invocations overwrite test-results. A PASS belongs
only to that lane. Every report declares release acceptance blocked.

Disposable lanes acquire a common lock, reject ANY pre-existing Supabase
container or volume, require CLI 2.121.0, create a unique project ID and use the
existing genuine acceptance suites. The local guard accepts only an explicitly
marked fresh temporary directory, no GitHub identity, no database authority,
and no link. Historical GitHub execution remains distinguishable. Cleanup is
limited to the newly created project via `supabase stop --no-backup`, with owned
resource checks. Existing resources are never stopped or deleted. Retained scratch
clones and private evidence are not automatically erased.

## Release and merge safety — hard blockers

The exact-head GitHub checks observed for #1345 were all **skipped**: critical-core,
critical-browser, critical, disposable-worker-sql, disposable-operator-jwt,
disposable-two-session-and-signed-in-acl, and Supabase Preview. None is acceptance.
Both branch protection and rulesets endpoints returned 403: "Upgrade to GitHub
Pro or make this repository public to enable this feature." This is a plan/access
blocker; do not infer that protection is enforced or delete required contexts.
Private-repository protected branches require a qualifying GitHub plan:
https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches

A safe rollout needs an owner-controlled independent verifier identity, e.g. a
restricted GitHub App that publishes **new** `mac-local/*` checks only after it
verifies signed, complete receipts against current PR head AND base, required
scope coverage, command/source/lock digests, actual test results, cleanup and
reviewer identity. Re-query head/base before publishing and invalidate on either
change. Keep PR review, stale-review dismissal, conversation resolution,
no-force-push/no-deletion, strict current-base validation and admin enforcement.
Only then replace obsolete hosted required contexts with App-bound local contexts.
Never write success to old `critical*` or pretend the Mac is GitHub Actions.
No statuses, rules, review decisions or merges are changed by this implementation.

Existing replay-proof validation still requires authentic hosted receipt identity.
It has deliberately NOT been weakened to accept a hand-written JSON or fake URL.
New local replay evidence must be signed by the independent verifier, bind the
complete migration ledger and bytes, generated types, candidate/base, genuine
Auth/Storage/race markers, and cleanup before adding a separate proof mode.
Historical proof formats and signatures must remain valid for their own bytes.
Until this trusted verifier/proof mode exists, new local reports cannot authorize
migration merge or production release.

Production preflight is not harmless: the existing Release broker temporarily
PUTs JIT access/roles even in preflight mode. It was inspected, not executed,
because this task excludes production mutation. Production SQL, Edge deployment,
frontend deployment and JIT operations remain blocked. The canonical frontend
runner and native migration promotion scripts are unchanged. Any future supervised
production release must retain exact merged main, reviewed pending migration set,
preview/disposable proof, original broker admission and cleanup, dry-run, actual
promotion, zero-pending postflight, frontend runner and live browser/runtime gates.
No local acceptance flag bypasses these gates.

## Rollout order

1. Review this isolated branch and complete local verification; resolve failures.
2. Resolve laptop stack isolation and use the correct disposable CLI. The audit
   found multiple existing local Supabase stacks and volumes, so destructive or
   broad-container acceptance must not be attempted on them. Use a dedicated
   Docker context/VM or an owner-reviewed resource reconciliation; do not stop them
   unattended. Existing tests hardcode localhost:54321 and broad DB discovery.
3. Establish trusted verifier/provenance and verifiable merge protection. Keep the
   release hold while any of these is missing.
4. Land the zero-minute workflow retirement only with a complete reviewed local
   gate replacement. Do not ready the PR under the current remote workflows:
   that would still trigger billable Actions before this candidate is merged.
5. Activate hourly runtime monitoring only on a supervised, credential-scoped Mac
   schedule with sleep/offline detection and failure notification. A sleeping
   laptop provides no hourly service guarantee. No scheduler is installed here.
6. Production execution remains separately supervised and subject to the original
   deployment contract. This change grants no production mutation authority.

## Validation record

See `local-mac-validation.md` for actual results and limitations. Core/browser/
disposable success must never be inferred from plan generation or syntax checks.
