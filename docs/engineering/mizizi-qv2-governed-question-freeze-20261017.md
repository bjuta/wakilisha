# MIZIZI QV2 — governed human question freeze

**Scope:** one user-driven, append-only command. Authenticated Headquarters **steward or owner** only. Reuses QV1 case-question table, its trigger, immutable SHA-256 fingerprint and QV1 reader. Never a competing Registry or ACH authority.

## Mutation rules

`public.admin_mizizi_freeze_case_question_v1` accepts the DB02 case ID and expected revision, a caller-stable question UUID, the exact expected question revision (0 for first creation), bounded question text, two to twelve competing hypotheses, and a meaningful reason. It calls existing `assert_headquarters_operator_v1('steward')` and DB05 `assert_registry_admission_not_held_v1` before writing. The global/workspace Hold advisory lock is reused without registering any Registry operation or grant. A same-case `FOR UPDATE` lock serializes concurrent revision writes; QV1's insertion trigger validates hypothesis IDs, uniqueness and immutable fingerprint.

A byte-for-byte identical retry by the **same human** at the same case revision returns `outcome:replayed`, not a duplicate version. A conflicting payload or stale case/question revision fails closed. A new question is limited by the reader's 100-question bound and revisions are limited to 20. No source evidence, conclusion, publication, custody grant or ACH rating is accepted as input.

## Acceptance

The SQL verifier is read-only. Disposable local JWT tests must prove a genuine steward/owner creation and replay, stale mismatches, reviewer-only and nonmember denial, anonymous/service-role denial, active global/workspace Hold refusal and zero ACH assessment leakage. Preserve original 231 local replay and prior 235 research/QV1 fixtures in exact order; QV2 must be the **236th** migration.

The existing shared Preview has 235 migrations with one original case and two research passes; no QV2 has been applied here. No fixture or case write may occur on that Preview without a separate approved plan. Preview replay evidence, generated types and manifest must not be rewritten or guessed. Production remains on 231.

**Not in scope:** source-family/custody attestations, human ACH grades, verdict or Registry mutation. PR #1243 → #1248 → #1249 are prerequisite drafts. No frontend activation and no Production modification.
