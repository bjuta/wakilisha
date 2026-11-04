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
  paths or Actions-run provenance URLs (`ops/local/reference-audit.json`), each
  classified with an explicit preservation, retirement or blocking disposition. These
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

Approved browser run bound to `9bab14a623f1362579f5d2b9ebfd70626123fcce`,
base `24ec5400327a70a9d5610d350a4ca487f28c1e13`, Node `v22.23.2`:
process exit 0, **154 passed, 1 flaky, 3 skipped** in the full interaction suite;
**3 passed** in the separate isolated authoring fixture suite. The three skips
are not counted as passes. Real Chromium and mobile WebKit viewport/audio
projects ran. The one flaky test was the subscriber private-preview denial test,
which encountered `ENOSPC` before passing on the configured retry. This is a
qualified suite result, not a clean release gate.

Evidence: `artifacts/local/wakilisha-local-aiTPKx/report.json`, hashed logs `3.log`
and `4.log`, and 48 retained screenshot files. Run time: 20:28:35–20:36:32 EAT.
The preflight installed Chromium; the required WebKit revision 2359 was already
installed and used. Future browser runs explicitly install both engines.

Focused confirmation after disk cleanup: the exact subscriber-denial test
passed **1/1 with retries disabled**, against the same isolated checkout and
same local-server runner. It completed in 8.3 seconds with exit code 0.
The original disk-related flake remains in the full-run record; the focused
confirmation does not rewrite that history or qualify the entire release.

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

## Superseding results after Desktop cleanup

These scoped results replace the earlier blockers where explicitly stated; they
are not yet a single final-head acceptance bundle.

| Scope | Candidate | Report directory | Actual result |
| --- | --- | --- | --- |
| MIZIZI SQL/corpus/concurrency | `fc6094b9` | `wakilisha-local-fFy2sD` | PASS, full replay, SQL corpus, W31 concurrency, cleanup, pre-existing resources preserved |
| MIZIZI genuine JWT/operator browsers/H38/O25 | `c82a0341` | `wakilisha-local-iskdND` | PASS, full replay, real clients, cleanup, pre-existing resources preserved |
| WK100 and critical security | `4aefdada` | `wakilisha-local-wuxLVU` | PASS; critical suite: 677 Vitest tests + 48 Node tests; genuine lease/Auth/Storage/live-source tests; cleanup and existing resources preserved |
| Core/build | `17429fbb` | `wakilisha-local-9RTmZY` | PASS, all 35 steps; 481 Vitest test executions + 152 Node test executions (includes repeated contract suites); authoritative DDEX conformance and build |
| Public-source diagnostic preflight | `fc6094b9` | `wakilisha-local-rOhU1e` | Process PASS; source statuses retain qualification limits below |
| Public data/Edge/live browser | `01a71cb7` | `wakilisha-local-GqDmP2` | PASS, 8 integration tests and complete public browser runtime watch |
| Canonical native schema/history | `2da29ba2` | `wakilisha-local-ThJ8T5` | PASS, pinned native CLI list/link/dry-run/schema reads; no apply, JIT toggle or deploy |

All directories above are under `artifacts/local`, with commit/base/command-plan
binding, hashed step logs and evidence inventories. None represents a hosted
GitHub check. Later independent receipt tests reject cross-head aggregation;
these scoped results must not be relabeled as a final-head release receipt.

The public preflight process passing does not mean all sources are collector
qualified. Apple (100), Shazam (200), Mdundo (100) and Audiomack public HTML (100)
were parsed as research-only with unknown native period. YouTube public bytes
were captured with the decoder still pending; its separate internal candidate
observed view rows but had no admitted period. Four Spotify editorial originals
were captured without rank validation. The Audiomack playlist API candidate
returned 401 and remains unqualified. No source admission, publisher activation,
scoring or Production capture was granted by these diagnostics.

The replay failure was traced to a validator defect, not invalidating the
historical successful replay itself: the 243-migration receipt exactly matches
its replay tree, and the latest 244-migration receipt exactly matches its tree.
The corrected validator preserves both identities and requires the newest
receipt to cover the current full schema. A fresh Git-history regression test
rejects historical snapshot tampering, changed SQL, stale latest replay and
current-type mismatch. Existing 19 replay contract tests pass unchanged in their
security assertions. No receipt URL, run result, SQL or database type was forged.

The public runtime failure was an obsolete nonempty-row expectation for the
retired legacy Edition surface. A read-only transaction confirmed zero rows;
anonymous HTTP reads returned 200 with zero rows. The revised gate requires
successful public access and absence of all 18 canonical retired IDs, while
preserving the populated adjacent Registry/Guide/Release checks. The rerun passed.

The DDEX server returned HTTP 522 in one core attempt (`wakilisha-local-rCD0Yh`);
this failure was retained. A subsequent independent-gate core run passed the
unchanged authoritative checksum/XSD gate and all remaining checks. Core now
collects independent gate failures for diagnosis and keeps its aggregate failed
if any gate fails; it never turns a failed prerequisite into release success.

A read-only Production ledger observation found 236 applied migrations, head
`20261101210335`, versus 244 canonical local files, eight pending and zero
remote-only filenames. Exact filenames are in
`artifacts/local/live-migration-ledger.json`. This observation did not apply,
repair or reconcile any ledger entry. Canonical native schema verification also
passed afterward. The pending set still requires separately authorized exact-main
native promotion; it is not permission to deploy this candidate.

The local receipt protocol and final-head batch are now implemented. Six tests
cover orchestration, ownership, historical replay and detached signature trust,
including rejection of missing/untrusted keys, stale head/base, incomplete scopes,
failed cleanup and tampering. No production operator key was generated or used.
The account-plan protection 403, independent trusted verifier identity, final-head
batch/signature and separately authorized production operations remain rollout
requirements. Production control planes remain on hold.
