# GitHub Actions budget recovery and draft PR release gates

**Recorded:** 4 November 2026. **Scope:** WAKILISHA repository CI execution. This is a safety and operating-process correction, not a relaxation of test coverage.

## Superseding decision — permanent offline-first acceptance (5 November 2026)

**The owner has confirmed that GitHub-hosted CI budget will not be restored on any planning horizon.** The canonical, current policy is [offline-first acceptance and release authority](./offline-first-acceptance-and-release-authority-20261105.md). **Do not treat paid GitHub Actions, self-hosted runners, restored allowances or a future billing event as prerequisites for development, validation, acceptance or an otherwise authorized merge.** Keep the existing workflows as optional/historical checks, with draft jobs skipped to avoid spending money; a skipped check is never green.

The 4 November workflow budget strategy below is retained as the record of how excessive spend was stopped. Its "ready-for-review → paid protected CI → merge" and "no allowance → no merge" requirements are **superseded**. In their place, use exact-head offline source/build/test/isolated database/Auth/Storage/browser acceptance, independently recorded evidence, explicit review, applicable hosted safety checks and owner-authorized release. Do not fabricate CI statuses, bypass tested product behavior or silently change branch protection. A repository ruleset conflict is a governance/configuration issue to be addressed explicitly, not permission to buy CI or to falsify a check.

## Failure mode

Rapid commit updates to the draft WK100 PR caused repeated Critical Control Plane, WK100 Disposable, and MIZIZI Disposable runs. A cancelled run can still consume runner minutes already spent. The owner's included allowance was exhausted in the first four days of November. The GitHub billing ledger, not this document, is the authority for exact billed usage.

## Historical hosted-CI runner controls (partially superseded on 5 November)

- **Draft PR:** the three existing workflows remain defined, but their runner-backed jobs must not start. Critical Control Plane's aggregate `critical` job must also stay skipped, not fail because its dependencies are intentionally skipped. A draft PR is not mergeable, and skipped checks are not release evidence.
- **Ready for review:** the `ready_for_review` PR event triggers full protected validation. The normal `synchronize` event continues to revalidate any subsequent commit while the PR is ready. `converted_to_draft` cancels in-progress runs through the existing concurrency groups and returns the workflows to runner-free draft mode. Already-used minutes are not refunded.
- **Main:** Critical Control Plane continues to run on `push` to `main` and by manual dispatch. No Production or migration promotion trigger is changed.
- **Path-sensitive disposable suites:** preserve the existing WK100 and MIZIZI PR branch/path filters, runner isolation, real GoTrue/PostgreSQL/Storage tests, cleanup, and timeouts.
- **Operational sequence:** work in a draft branch; inspect changed scope; run targeted local tests; batch the stable acceptance candidate; mark ready only when prepared for a full CI run. After a new failure, diagnose before changing or retrying anything. If substantive changes are required, move back to draft for further work.
- **Release rule:** never merge from skipped, pending, stale, billing-blocked, or failed checks. When relevant, require exact-head Critical Core, real-browser, aggregate `critical`, WK100 Disposable, and MIZIZI Disposable success, plus the existing runtime and Production promotion gates. Do not use `[skip ci]`, manually create green statuses, disable required checks, or claim success from a draft-only run.

## Historical billing and limitation (not a future release dependency)

This gate prevents draft-push runner allocation. It does not refund November usage or bypass account-level GitHub billing restrictions. The private account Billing and Licensing usage ledger and any GitHub Support credit decision require account-owner access. If no allowance is restored, continue safe offline work without merging or deploying unverified changes. Do not spend additional money until the trigger policy and budget are controlled.

## Scope

Only the three existing CI workflow YAMLs, an added assertion in the **existing** migration replay contract test file, and this record change. No database, Edge Function, Production frontend, permission, or deployment mutation.

## WK100 local Docker coexistence — 5 November 2026 addendum

A real Mac acceptance run independently exercised the 245-migration replay, two genuine GoTrue identities, PostgreSQL lease contention, private Storage ACLs, and project-scoped cleanup without stopping the operator's other active or retained Supabase Docker projects. The **supported reusable procedure and exact operator-reported PASS markers** are documented in [WK100 isolated local Docker coexistence and acceptance](./wk100-disposable-local-docker-coexistence-and-acceptance-v1.md). Always consult it before preparing another local runner. It is not permission to remove old containers/volumes, bypass hosted authorization or fabricate a successful pull-request CI replay. This remains the accepted disposable local execution method. The later 5 November offline-first release authority supersedes the budget-restoration dependency while preserving this execution contract.
