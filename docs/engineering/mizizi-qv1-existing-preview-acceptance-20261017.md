# MIZIZI QV1 — existing Preview acceptance checkpoint

**Date:** 17 October 2026. **Scope:** existing Supabase Preview `nkgfoppunmnkcumalxqp` only. No new preview branch, no reset/rebase, no Production SQL, no new source or question fixture on Preview.

## Authoritative provenance

- Base migration ledger: 234/head `20261016114918`, including DB04–DB06 from the [existing Slice 2 PR #1243](https://github.com/bjuta/wakilisha/pull/1243).
- The new migration `20261017185928_mizizi_question_assessment_authority_v1.sql` was minted with pinned Supabase CLI **2.107.0**: [run #39060478412](https://github.com/bjuta/wakilisha/actions/runs/39060478412).
- Clean disposable PostgreSQL + real GoTrue/JWT replay, including original 231 baseline and QV1: [run #39061267106](https://github.com/bjuta/wakilisha/actions/runs/39061267106) PASS (standalone precursor commit).
- Guarded native push to **that same** existing Preview: [run #39062464803](https://github.com/bjuta/wakilisha/actions/runs/39062464803) PASS. Three exact predecessor source checksums staged only on GitHub runner; CLI required exactly one pending migration. Before/after database fingerprints preserved existing case, research passes, membership, hold, job and receipt links.
- Independent connected Preview SQL verifier `scripts/control-plane/verify-mizizi-question-version-reader-v1.sql` executed read-only after push; no error. Separate read-only ACL verification: forced RLS true, two active immutable/fingerprint triggers, auth-only RPC `EXECUTE`, no direct private-table `SELECT`, no service-role insert.
- Pinned CLI generated exact `public,editorial` types from the existing Preview and checked the unchanged Preview state again in [one-shot run #39063794505](https://github.com/bjuta/wakilisha/actions/runs/39063794505), PASS. The workflow self-removed; only the generated type file, schema baseline and replay proof were committed.
- Verified new Preview ledger **235**, head `20261017185928`. Still exactly 1 case, 2 passes, 1 membership, 1 hold, 1 job, 0 question rows, 0 Registry Tracks. Nothing was backfilled from earlier research passes or promoted as accepted ACH evidence.
- Exact migration SHA-256 `2d0b34614173d274305b7ad01c4db1a4f52d36fb8caf40a7218d81d5a5231a08`; generated Preview types SHA-256 `52b79a1fe2c17395c20f10cd517dde5b838fb3e13729b3f20d3dce2bff6b16db`. These are independently recorded in `docs/engineering/replay-proofs/20261017185928_mizizi_question_assessment_authority_v1.sql.json` and `docs/engineering/live-schema-baseline.json`.

## Domain and release boundaries

This is **question and competing-hypothesis freezing plus read-only projection only**. No browser-accessible authoring RPC, no accepted source-family adjudication, no consent/custody grant, no recorded ACH assessment, no human review verdict, no Registry executor permission and no public publication. The `sources` and `assessments` JSON arrays remain deliberately empty.

PR #1248 is **stacked on PR #1243** for the three accepted October 16 predecessor migrations; #1243 still requires its own acceptance and promotion before #1248 can merge to `main`. The resulting Preview migration state does NOT mean either draft is Production-deployed.

Normal exact-head CI, supported deployment order, owner MIZIZI v3 visual acceptance, and release rollback gates remain mandatory. This checkpoint and its links are proofs of what was done, not permission to promote.
