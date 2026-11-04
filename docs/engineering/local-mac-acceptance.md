# Mac local verification migration — supervised review

4 November 2026 (Africa/Nairobi). Audited PR #1345 head:
`0ae76e4595083505a208a5e4b834675b28563810`.
Observed current main: `24ec5400327a70a9d5610d350a4ca487f28c1e13`.

Current policy: supervised review of the exact-commit local evidence; no signing
key is required. Main review protection is enabled on the now-public repository.
Earlier account-plan observations below are historical. Production release is a
separate supervised action.

This record supersedes the hosted-execution recommendations in
`ci-budget-recovery-and-draft-gates-20261104.md`. This branch is an isolated
implementation candidate published for review; it has not been merged.

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

The selected rollout uses explicit human review of local evidence. No signing
key or GitHub App is required for this supervised process. Before approving a
merge, the reviewer must compare the current candidate and main SHAs to the
batch, check all eight scope results and their evidence hashes, confirm real
SQL/Auth/Storage/browser coverage and successful scoped cleanup, and review the
actual diff. Any executable change or changed base requires fresh verification.
A documentation-only follow-up must be separately reviewed against the tested
commit and must not be described as having run the original batch itself.

GitHub enforces PR review, stale-review dismissal, resolved conversations, admin
enforcement, no force pushes and no deletion. It does not automatically enforce
the local test results. No old hosted check is marked successful and no new
required automated status is fabricated. The existing hosted historical replay
proof contracts remain unchanged; local evidence is separately identified and
cannot be passed off as a hosted receipt. Any future automated acceptance system
needs its own reviewed trust design; the optional signature verifier is not a
prerequisite for this manual review process.

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
3. Review the exact-head local evidence under the supervised process above.
   Verify the enabled GitHub review protection before merging.
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

## Superseding implementation after disk recovery

The empty-Docker-host limitation above is resolved in the local candidate.
Every disposable run now has a private ownership manifest bound to its temporary
checkout, a unique project ID, separately allocated local service ports, and an
exact anchored container-name filter. The helper rejects malformed manifests,
remote authority and links. No local execution claims a GitHub identity. The
runner requires a local Unix Docker endpoint and CLI 2.121.0; cleanup uses an
explicit `--project-id`, verifies both names and labels, and requires preservation
of all pre-existing container IDs/names and volume names. Existing stacks can
coexist and are not selected by broad legacy queries. Each full SQL replay and
authentication test remains real, not mocked.

`wk100` now runs the original `npm run test:critical` against real local Auth,
REST and PostgreSQL before loading the lease/Storage fixtures. This retains the
anonymous insert-denial tests without attempting writes against Production.
`critical-security` is also available as an independent diagnostic lane.
`schema-read` runs the existing native schema/history verifier (local link,
migration list, native dry-run and schema reads), with no promotion or JIT toggle.
`public-runtime` uses only an enabled anonymous/publishable key, verifies the
exact project URL, and retains the public data, Edge and live browser probes.
It does not run the privileged production control planes or install a schedule.

The historical replay validator bug is corrected: earlier receipts must bind
their actual replay commit's migration set, types and count, remain ancestors,
and cover an unchanged current migration prefix. The newest receipt must still
bind the entire current migration set/types/head and the baseline seal. Tests
reject forged historical counts, changed migration bytes, a stale newest replay,
and changed current types. Historical Actions URLs/run identities and successful
real replay markers remain mandatory; no local receipt is substituted into an
old hosted proof mode.

The public runtime test no longer demands artificial nonempty legacy Edition
data. Read-only Production and anonymous reads confirmed that surface is empty.
The test now requires a successful public read and absence of the exact 18
retired IDs from the canonical preserved RNB18 SQL. Nonempty Guide, Release
relationships and adjacent Registry checks remain. No historical rows are
manufactured and no Production state is changed.

The exact-head batch entry point is `scripts/local/run-batch.mjs`. It locks its
candidate and base logically by rechecking them before every lane, runs all eight
required scopes, retains individual reports, and refuses an unsigned receipt if
any scope fails, is stale/missing, or has changed evidence files. Cleanup or
unrelated-resource preservation failure stops the batch. It does not create
trusted keys, publish checks, merge, deploy or promote migrations.

`scripts/local/receipt.mjs` verifies a detached Ed25519 operator signature against
an independently pinned public-key fingerprint and exact head/base. Preparation
hashes each report, step log and evidence bundle, enforces eight distinct scopes,
and requires real disposable cleanup/isolation. Receipt tampering, unsigned or
untrusted keys, stale heads/bases, missing scopes and failed cleanup are rejected.
If automated signature verification is selected in future, the private signing
key must be controlled by a trusted operator outside this
repository and outside the agent's signing authority. The fingerprint must come
from that operator's established policy, not from this repository or a generated
assistant key. An operator must independently reproduce or audit the execution;
blindly signing a JSON file does not establish independent verification.

A verified development receipt expressly grants **no** Production deployment
permission. Human merge review and production JIT/preflight,
exact-main/pending-set, promotion, frontend deployment and postflight gates remain
separate. The earlier account-plan limitation was resolved when the owner made the
repository public; main review protection is enabled. Production launchers remain
on hold pending the separate deployment process. The batch produces a concrete review package, not a fabricated green
GitHub-hosted check or a self-signed release approval.

## Selected supervised review policy — 4 November 2026

The owner selected ordinary review of saved Mac test evidence. Digital signatures
are optional future tooling, not a merge prerequisite. All eight scopes passed
at commit `2486898b9722e2d2e9300f3ce710970909ce5c09` against main
`24ec5400327a70a9d5610d350a4ca487f28c1e13`. This policy follow-up changes
documentation only; it does not rerun or relabel that evidence. A reviewer must
inspect this documentation diff as well. Approval of development verification
does not authorize production changes or source admission.
