# MIZIZI Preview/Production forward-convergence evidence — 25 October 2026

**Status:** read-only compatibility diagnostics; forward migration replay and signed-in browser acceptance remain **OPEN**. No SQL, Edge, secret, Registry, Preview, or Production write was made while gathering this record. Current four-phase programme authority: `docs/engineering/mizizi-product-phase1-reconciliation-20261024.md` merged via PR #1306 at `216f142f22fe4b55532e8944e4e2758ac5357ca5`.

## Exact migration lineage

Both live Supabase migration ledgers contain the same **231 ordered versions** at and before `20261015091718`; ordered-version MD5 `40d4cdaf839f0940b121c587fad96a2f`. These are **version identities**, not independently verified statement/body hashes.

| Production-only (in current merged main) | Preview-only (on open MIZIZI draft stack) |
| --- | --- |
| `20261019152307_wk_chart_observation_receipts_v1` | `20261016064245_mizizi_research_pass_memory_v1` |
| `20261019203244_wk_chart_private_raw_evidence_v1` | `20261016092731_mizizi_external_wikidata_research_intake_v1` |
| `20261020072800_wk_chart_capture_runtime_v1` | `20261016114918_mizizi_research_job_retry_budget_v1` |
| | `20261017185928_mizizi_question_assessment_authority_v1` |
| | `20261017202800_mizizi_governed_question_freeze_v1` |
| | `20261017212255_mizizi_source_family_attestation_v1` |

**Observed totals:** Production 234, Preview 237. All three newer Chart migrations are in `main` source and deployed to Production, not this Preview; all six MIZIZI preview-only migrations are absent from merged `main`. The six belong to existing #1243 and #1248–#1251; their historic Preview applications must be preserved and never renamed to trick migration discovery.

## Read-only schema / RPC evidence

Catalog queries on both databases found:

| Contract | Result | Limitation |
| --- | --- | --- |
| `mizizi_private` base tables | 16 Production / 19 Preview; **all 16 shared table column seals identical** using ordered name/type/nullability/default descriptions | Does not assert trigger function definition and row-data identity |
| Private-table RLS | Both have `relrowsecurity=true` and `relforcerowsecurity=true` on every listed MIZIZI table, including Preview's three extra `research_passes`, `case_question_versions`, `question_source_attestation_events` | Does not replace a real JWT nonmember/invalid-token test |
| Public `admin_mizizi_*` RPCs | Eight Production, twelve Preview; **all eight common RPC signatures, result types and `pg_get_functiondef` MD5s match exactly**, with `SECURITY DEFINER` true | Source-def equality is not a dynamic authorization proof |
| Common RPC explicit privileges | All eight common RPC `proacl` seals identical; `anon` EXECUTE **false**, `authenticated` **true**, `service_role` **false** per catalog privilege check | Privilege checks are role-level, not an authentication/tenant/jwt/recusal end-to-end assertion |
| Preview-only RPC authority | `admin_mizizi_attest_question_source_v1`, `admin_mizizi_case_questions_v1`, `admin_mizizi_freeze_case_question_v1`, `admin_mizizi_question_source_attestations_v1`; each reports `anon` EXECUTE false, `authenticated` true, `service_role` false | A callable authenticated RPC must still enforce role/workspace/hold/CAS conditions internally |
| Edge Function manifest | Both environments returned 42 registered functions. Preview has `mizizi-research-runner` v23 ACTIVE with JWT verification; Production has `wk-chart-capture` v1 ACTIVE with JWT verification | Function-count equality says nothing about bundle, custom secrets, ingress, role resolution, allowed external source or runtime readiness |

Source-read inspection of all **nine** migration files identifies separate Chart capture tables under public/private and separate MIZIZI question/research objects under `mizizi_private`/public, with reuse of baseline job/evidence sources. This reduces obvious collision risk but **does not prove** migration commute, dependency resolution or correct shared Postgres grants.

## Mandatory unclosed gates before Preview mutation or promotion

1. **Exact effective migration source**: assemble from current merged main plus the original six draft SQL files in dependency order, without rewriting already-applied Preview migration version or historical receipt. Inspect all nine statement dependencies, triggers, roles and shared functions for collisions.
2. **Native disposable combined replay**: execute current canonical migration replay in an isolated test database, check all nine seals/constraints, verify forward-only replay order, prove idempotent non-reapplication for Preview's existing six versions, and obtain machine-readable results. **Not executed here.**
3. **Live Preview config/security readiness**: compare **names/presence** of required custom Edge secrets in Production/Preview, external provider access, source-use authority, JWT/CORS/ingress, real operator and unauthenticated/nonmember denials, DB05 held and stale conflicts. Never print secret values or assume branch inheritance. **Not executed here.**
4. **Genuine UI acceptance**: signed-in case backed by lawful source, source-family attestation, reviewed question and independent grade (still missing), 390–1440 responsive parity and device/focus behavior. No fake accepted source, self-graded answer or phantom Registry changes.
5. **Protected exact-head CI and change ownership** on existing PR chain, then separately approved Preview release; no Production runtime release implied.

**Decision:** maintain existing Preview, current Production, historic #1094 receipts, and draft dependency chain untouched. Do not reset, rename migration versions, invent Secrets, run a real source fixture, or issue a general Registry grant to shortcut acceptance. `main` has a separate chart runtime release and cannot be replaced with the Preview migration count.
