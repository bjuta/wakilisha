# Local Mac validation — 4 November 2026

This is a staged implementation, not release acceptance. No GitHub Actions run,
remote status write, push, merge, deployment, production SQL or JIT mutation was
performed. Native Mac shell access was verified (`Darwin arm64`); this does not
claim that the GUI Terminal app or arbitrary unsandboxed access is granted.
Network, Docker socket and browser access used explicit desktop approvals.

Repository: `bjuta/wakilisha` (private, default `main`, authenticated account has
admin permission). Existing checkout discovered at
`/Users/macbookair15/Desktop/wakilisha-supabase-deploy`, with many linked worktrees.
The task used a separate shared-object clone under this project's
`local-mac-migration` directory; original checkouts were not edited.
Branch: `local/mac-verification`.
PR #1345 remains draft at `0ae76e4595083505a208a5e4b834675b28563810`;
base/main was `24ec5400327a70a9d5610d350a4ca487f28c1e13` on recheck.

## Passed

- All eight retired executable workflows and their original job plans audited.
  Every original hosted workflow used Ubuntu. All automatic triggers are removed
  in this candidate and every job is unconditionally disabled. No remote workflow
  was changed. The reference inventory covers 28 tracked text files with workflow
  paths or Actions-run provenance URLs (`ops/local/reference-audit.json`). These
  historical references are preserved, not rewritten into fictitious local proof.
- Four local orchestration/negative-context tests pass, including after the final
  disk-space and WebKit prerequisite corrections.
- 31 replay/Release/URL-identity regression tests pass.
- 162 affected notifications, post UI, steward and ERN adapter regression tests pass.
- Shell syntax checks for all three modified SQL/concurrency runners, JavaScript
  syntax checks for all three modified Auth/H38/Storage adapters, and diff
  whitespace checks pass. The shebang-placement error found during validation was
  corrected before this record.
- Core candidate `ea05e539374637d565afeb90ace1894895990e5f`, Node `v22.23.2`,
  base as above, plan SHA-256
  `4712b459c70620794f85d68aee2b1f393b00e7e7b59019c181c22f50fc00e452`:
  runtime identifiers, checksum-pinned authoritative DDEX ERN XSD conformance,
  canonical production frontend runner **self-test**, UI chrome, viewport,
  admin overlays, and all **55 DOM interaction tests** passed.
  Evidence: `artifacts/local/wakilisha-local-syqbtQ/report.json` and hashed logs.
  This is scoped evidence for that commit; it is not exact-head release approval
  for later runner/documentation commits.

## Failed or blocked

- Core correctly stops at the migration replay contract. Exact messages:
  `disposable CI migration filename set changed since replay` and
  `disposable CI proof does not bind current types and active migration head`.
  The same two errors were reproduced independently on pristine PR head
  `0ae76e4595083505a208a5e4b834675b28563810` against the current base.
  Later core steps, build, live security and schema gates are NOT claimed passed.
- WK100 candidate `9bab14a6` correctly rejects the existing Supabase containers and
  volumes before start, SQL, Auth, cleanup or deletion. Evidence:
  `artifacts/local/wakilisha-local-UylEdP/report.json`. No real disposable SQL,
  race, JWT, Storage ACL or MIZIZI browser acceptance is claimed from that refusal.
- Installed CLI is 2.107.0; disposable lanes require separately pinned 2.121.0.
  Existing localhost:54321 stacks and broad legacy DB discovery need an isolated
  Docker context/VM. Existing stacks and volumes were not stopped or deleted.
- GitHub branch-protection and ruleset reads both returned plan-related 403,
  despite repository admin permission. All six Actions checks and Supabase Preview
  on the PR head were skipped, providing no release evidence.
- Replay-proof identity still requires authentic Actions evidence. It was not
  relaxed. Independent signed local provenance and App-bound merge contexts remain
  unimplemented prerequisites for release rollout.
- Production broker preflights temporarily modify JIT state/roles. They were not
  executed. Production promotion, frontend deployment and hourly runtime scheduling
  remain disabled/unactivated, retaining their original contracts for supervised
  rollout after all blockers are resolved.
- A source-preflight attempt exhausted free disk during dependency setup and failed
  with `ENOSPC` before producing a valid report or source acceptance. This is not a
  source-probe failure or success. Five task-created npm dependency copies were
  removed with explicit approval (about 2.4 GB); sources, reports, databases and the
  active browser run were preserved. Future lanes refuse to start below 3 GiB free.
- The first core attempt hit sandbox DNS restrictions; the approved network rerun
  passed the DDEX gate. The first browser prerequisite attempt was stopped after it
  stalled behind the desktop boundary. Superseding browser results are recorded
  below; neither failed prerequisite attempt is acceptance.

## Browser outcome

Pending final result from the approved local browser run bound to `9bab14a6`.
No browser success is claimed until its report records all real browser steps.

## Scope and next decisions

This candidate retires billable execution and implements local development lanes.
It does not yet supply a trusted complete release-acceptance replacement. Do not
publish/merge it until the rollout sequence and blockers in
`local-mac-acceptance.md` are resolved. No required check was deleted or spoofed.
The canonical production scripts and hosted historical proof validator have zero
diff against the original PR head.

The Supabase changelog checked during implementation announces CLI v3 changes on
4 November; the existing v2 pins are intentionally retained. See the official
[CLI notice](https://supabase.com/changelog/supabase-cli-v3) and
[local-stack CLI reference](https://supabase.com/docs/reference/cli/supabase-start).
