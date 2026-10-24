# MIZIZI QV3: question-scoped human source attestations

**Authority:** Issue #1247, existing Slice 2 #1239, and Product v4 source/evidence review. Stacked predecessor order: PR #1243, #1248, #1249, #1250. This branch has no independent Production promotion authority.

## Reuse, not another source repository

QV3 does **not** create source content, source versions, independent Registry claims, consent records, custody documents, review roles, or another worker. It joins existing immutable QV1/QV2 question versions to:

- `platform_private.registry_evidence_assertions`: exact subject, assertion UUID, immutable assertion fingerprint, source-use detail, and provenance lineage. An independence-group hint is **never proof**.
- `editorial.sources` and `editorial.source_versions`: currently approved source version, reviewed author/reviewer, live rights and consent status, sensitivity, and original content fingerprint.
- `editorial.source_registry_links`: exact approved version attached to the same Registry subject with role `subject`.
- DB02 cases, active internal workspace, Headquarters capability/membership checks, and DB05 global/workspace/operation Holds.

Existing `platform_private.registry_contribution_attestation_permission_versions` concerns contribution-attestation disclosure policy, not a general MIZIZI source ingestion licence. Do not repurpose it. MIZIZI stewardship licences are exact Registry execution grants, not publication or source-use licences.

## Human review contract

The only write entrypoint is `public.admin_mizizi_attest_question_source_v1`. A real, authenticated administrator with active reviewer, steward or owner workspace membership may attest only a frozen question at the exact current case revision. The reviewer must be distinct from the question author and from the original Editorial Source creator and approver. The Registry assertion and approved Editorial Source version must both match the case's exact subject.

The reviewer explicitly records why the Registry assertion corresponds to that Source, which source family it belongs to, and why it may or may not be treated as independent. This is a **human assertion with accountable provenance**, not model-generated independence proof. The asserted family key never comes from a model Boolean or `independence_group_hint`.

For positive attestation the existing Editorial Source must remain approved and active, on the exact approved version, with owned/licensed/public-domain rights and granted/not-required consent. High/extreme sensitivity is deliberately held out. Its approved version must be linked to the case Registry subject. The Registry assertion must have a separately recorded permitted source-use basis, nonempty use detail, a source reference, and a lineage key.

A client supplies a stable event UUID for idempotent retries. The SQL server generates the receipt fingerprint, serializes writers by locking the DB02 case, enforces version monotonicity, and denies changed-payload replay. Revocation appends a new event; it must match the previous source evidence and can still be recorded after a source is withdrawn. No UPDATE or DELETE is allowed. Only the existing authenticated writer can INSERT. Neither `service_role` nor `mizizi_executor` can bypass the table/RPC boundary.

## Read and truthful limitations

`public.admin_mizizi_question_source_attestations_v1` is a capability-checked metadata projection, not the unrestricted Editorial source viewer. It includes only source and assertion identifiers, reviewer decision state, family key, and immutable receipt fingerprint. It excludes raw content, excerpts, consent documents, contract terms, Registry claim payloads, private actor details, and proprietary source copies.

On revoked, withdrawn, unapproved, expired, or mismatched current-source authority, no positive current review may be claimed. Every QV3 projection explicitly returns:

- `independentlyVerifiedFamilies: 0`
- `achAssessmentsAllowed: 0`

A stored attestation does not compute CC/C/N/I/II, rank hypotheses, authorize a Registry verdict, or permit publication. A future independently validated family and custody decision and governed ACH ledger must establish that later boundary, rather than silently upgrading QV3's human assertion.

### Explicit excluded scope

- No new general-purpose Editorial Source ingestion or uploader.
- No independent legal advice, rights ownership or source-licence inference.
- No cross-organization customer access, public output or evidence text exposure.
- No model grading, ACH computation or automated Registry mutation.
- No activation of the Product v4 M1/M4 assessment interface merely because an attestation row exists.
- The first QV3 release supports case subjects `artist`, `track`, and `release` only. Other Registry relationship evidence still requires its own exact reviewed linkage.

## Acceptance and promotion

Migration was minted by accepted Supabase CLI 2.107.0 in isolated GitHub Actions run [#39070682622](https://github.com/bjuta/wakilisha/actions/runs/39070682622): `20261017212255_mizizi_source_family_attestation_v1.sql`.

The temporary no-credential local 237-migration replay is in [#39071112454](https://github.com/bjuta/wakilisha/actions/runs/39071112454). It proves isolated SQL replay and the permanent read-only QV3 SQL verifier. Both temporary mint/replay workflows are removed before release.

The existing two-job disposable PostgreSQL and genuine GoTrue/JWT acceptance workflow must preserve the historical 231 baseline, replay DB04 to DB06, QV1 (235), QV2 (236), then apply QV3 (237). Its existing operator test now exercises real signed-in human separation, anonymous and self-review denial, exact-source failure, replay/conflicting input, append-only revocation and zero ACH leakage. All containers and volumes must be destroyed.

After passing isolated runtime acceptance, use the existing governed single-preview native migration replay procedure, with exact one-file pending-set check, approved CLI path, independent ACL/ledger verifier, typegen, and source-fingerprint schema seal. **Do not run any QV3 migration or synthetic fixture on Production or copy local sources into the shared Preview.** Production remains on 231 until a separately authorized promotion.

The URL-identity temporary JIT-access-at-rest failure is an independent Production release blocker. Do not weaken it to merge this branch.

### Rollback boundary

Before Production promotion, delete/rebase the draft branch without touching any database. After promotion, do not drop event records or rewrite history. Disable QV3 application admission through the existing policy boundary and apply only a reviewed forward repair if needed. Existing question, Editorial Source and Registry authorities remain authoritative.
