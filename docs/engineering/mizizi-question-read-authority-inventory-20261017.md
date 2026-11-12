# Issue #1247: live schema inspection and question read-model checkpoint

Read-only catalog inspection, 17 October 2026. The live database has
`mizizi_private.cases`, `case_events`, `case_observations`,
`case_receipt_links` and `case_snapshots`, plus
`platform_private.registry_evidence_assertions` and
`registry_review_cases`. **`mizizi_private.research_passes` is absent**
from the deployed live schema: that is still draft PR #1243, not released.

## Actual boundaries
- DB02's workspace/case/revision, journal and typed receipt links are
  durable source identity, not a question/hypothesis ledger.
- Case observations retain independent finding fingerprints but do not
  supply reviewed question grades.
- Registry evidence assertions contain source references, fingerprints,
  upstream source and lineage keys, verification method,
  source-use basis and an **independence-group hint**. A hint is
  **not** independent proof, consent or an accepted ACH grade.
- DB03 case snapshots freeze expected case states for operation plans.
  They do **not** freeze a question-specific set of source assessments.
- Draft #1243 research passes are lease-scoped investigation memory,
  not an adjudicated, discloseable Registry evidence library.

## This bounded code addition

`src/services/miziziQuestionRead.ts` validates a future **permission-scoped
versioned server read**. It checks: exact workspace/case/revision; unique
questions, competing hypotheses and source IDs; independence and source-use
flags; disclosure; reviewed ACH cells with matching source fingerprint and a
human review receipt. It does not calculate an evidence standing,
write a verdict, publish, mutate a case, or authorize a server action.

**Important:** the parser is not a permission gate. The server MUST
independently verify all rights; an arbitrary client field such as
`familyVerified:true` never creates authority. No new read RPC or
migration has been added. No M1 question cards are populated.

## Next acceptance gate

Implement the smallest append-only question/source assessment authority
using DB02 identities and Registry evidence lineage, with RLS,
source-use/revocation checks, workspace membership, immutable revision
fingerprints, independent human receipt, DB05 Hold denial and an exact
authenticated read RPC. Prove nonmember, stale, withheld and duplicate
source-family denial in a disposable preview before wiring a real
M1 question card and M2 one-question frozen review.

No Production SQL, Edge Function, frontend activation, credentials or
Registry writer changed. Revert this commit for code rollback.
