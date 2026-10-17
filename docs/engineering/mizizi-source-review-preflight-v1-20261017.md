# MIZIZI QV1 source review preflight (17 October 2026)

## Verified source state

The connected existing WAKILISHA Preview at `nkgfoppunmnkcumalxqp` (235 migrations, including QV1) has **zero** `platform_private.registry_evidence_assertions`, **zero** `platform_private.registry_review_cases`, and **zero** `mizizi_private.case_question_versions`. It retains the existing case, two research passes and one case receipt link. These numbers were checked read-only, not constructed as sample case facts.

The accepted Registry assertion model contains a source reference, assertion fingerprint, upstream source and lineage key, independence-group **hint**, verification method and declared source-use basis. Those fields do not establish a consent decision, source independence or permission to assess and publish evidence. The research `SourceAuthorityV1` is reused as a bounded **candidate**, not converted into an authenticated judgement.

## Code added

`scripts/registry/agents/mizizi/runtime/question-source-review-v1.ts` is a **pure, server-side preparation function**. It checks case/workspace/subject identity, Registry assertion correlation, exact content fingerprint, source use consistency, source expiry/revocation, internal retention and common-origin collisions. It outputs a minimal, private attention queue with identifiers and blocker codes. It never exports source excerpts, custody documents, user details or raw Registry assertions.

Every structurally valid source still has `needs_independent_human_review`. The projection always returns `independentlyVerifiedFamilies: 0` and `achAssessmentsAllowed: 0`. The old Registry `independence_group_hint` is deliberately not proof. No ACH matrix, grade, verdict, source-family attestation, upload, public disclosure, Registry mutation or database table is created.

Existing research test file `test/registry/mizizi-research-worker-cycle.test.ts` owns the consolidated negative tests for missing Registry assertions, privacy restrictions, mismatched hashes, source-family collisions, scope mismatch, duplicate source ID and temporal invalidity.

## Remaining authority before ACH

A separately reviewed append-only **source-family/custody/use attestation** with revocation, source-level disclosure and independent reviewer is required. Its writer must be SQL-gated by current membership, real signed-in identities, DB05 Holds, exact question revision and an independently verified Registry evidence assertion and source-use authority. Only after this does a separately governed human ACH assessment ledger make sense. No client-supplied `familyVerified` or model `independentlyVerified` flag may grant it.

This branch is stacked on unmerged #1248 (which is stacked on #1243). No new migration is minted; therefore no Supabase Preview changes, generated type changes or schema seal changes are appropriate here. Real source/custody fixtures are impossible on the current live Preview without creating new reviewed evidence. Do not simulate them and call this production acceptance.

**Release:** read-only contract and tests only. Run exact-head Critical CI. No merge until predecessors pass independent release gates and the independent Production access security issue is resolved.
