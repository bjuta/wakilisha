# GitHub Actions budget recovery and draft PR release gates

**Recorded:** 4 November 2026. **Scope:** WAKILISHA repository CI execution. This is a safety and operating-process correction, not a relaxation of test coverage.

## Failure mode

Rapid commit updates to the draft WK100 PR caused repeated Critical Control Plane, WK100 Disposable, and MIZIZI Disposable runs. A cancelled run can still consume runner minutes already spent. The owner's included allowance was exhausted in the first four days of November. The GitHub billing ledger, not this document, is the authority for exact billed usage.

## Corrective execution contract

- **Draft PR:** the three existing workflows remain defined, but their runner-backed jobs must not start. Critical Control Plane's aggregate `critical` job must also stay skipped, not fail because its dependencies are intentionally skipped. A draft PR is not mergeable, and skipped checks are not release evidence.
- **Ready for review:** the `ready_for_review` PR event triggers full protected validation. The normal `synchronize` event continues to revalidate any subsequent commit while the PR is ready. `converted_to_draft` cancels in-progress runs through the existing concurrency groups and returns the workflows to runner-free draft mode. Already-used minutes are not refunded.
- **Main:** Critical Control Plane continues to run on `push` to `main` and by manual dispatch. No Production or migration promotion trigger is changed.
- **Path-sensitive disposable suites:** preserve the existing WK100 and MIZIZI PR branch/path filters, runner isolation, real GoTrue/PostgreSQL/Storage tests, cleanup, and timeouts.
- **Operational sequence:** work in a draft branch; inspect changed scope; run targeted local tests; batch the stable acceptance candidate; mark ready only when prepared for a full CI run. After a new failure, diagnose before changing or retrying anything. If substantive changes are required, move back to draft for further work.
- **Release rule:** never merge from skipped, pending, stale, billing-blocked, or failed checks. When relevant, require exact-head Critical Core, real-browser, aggregate `critical`, WK100 Disposable, and MIZIZI Disposable success, plus the existing runtime and Production promotion gates. Do not use `[skip ci]`, manually create green statuses, disable required checks, or claim success from a draft-only run.

## Billing and limitation

This gate prevents draft-push runner allocation. It does not refund November usage or bypass account-level GitHub billing restrictions. The private account Billing and Licensing usage ledger and any GitHub Support credit decision require account-owner access. If no allowance is restored, continue safe offline work without merging or deploying unverified changes. Do not spend additional money until the trigger policy and budget are controlled.

## Scope

Only the three existing CI workflow YAMLs, an added assertion in the **existing** migration replay contract test file, and this record change. No database, Edge Function, Production frontend, permission, or deployment mutation.
