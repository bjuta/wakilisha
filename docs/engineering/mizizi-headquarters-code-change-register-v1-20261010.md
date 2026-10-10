# MIZIZI Headquarters — Exact Code Change Register and Interface Contracts V1

**Date:** 10 October 2026 | **Status:** Planned change authority; zero implementation changes in this PR.  
**Base:** `main@4381d6020b83e5b3b6781bb28003dee76618737d`; Production migration head `20261009181647`.  
**Parent:** [product and system architecture](mizizi-headquarters-product-architecture-v1-20261010.md).  
**Execution:** [production exit contract](mizizi-headquarters-implementation-exit-contract-v1-20261010.md).

## 0. Exact rule for this register

`EXISTING` means this path/function/table was inspected in the 10 Oct repository tree or live Production catalogue. `NEW` means a proposed implementation path, not a claim that it exists. `MODIFY` means preserve existing authority and extend at the seam. **None of these edits are authorized merely by this design PR.** Migration file names below are **logical stems**, not pre-minted timestamp files. At implementation, create SQL migrations only with Supabase CLI, after exact live-schema introspection and collision proofs.

Do not repurpose the temporary three #1094 Admin views into generic orchestration. They remain protected historical acceptance evidence until a separately tested transition retires them. Do not rewrite all older MIZIZI docs or assume September row counts describe current Production.

## 1. Domain / persistence changes (ordered, transactional boundaries)

| ID | Proposed migration stem and **owned schema** | Objects and must-prove invariants |
|---|---|---|
| DB01 | `mizizi_workspace_membership_foundation_v1` | `mizizi_private.workspaces`, `workspace_memberships`, `workspace_events`. Refer to existing Person/Organization authority by typed ref. Composite unique membership with valid time; invite/revoke event immutable. No Registry entity copy. RLS: deny anon, tenant-member bounded; privileged role only through typed RPC. |
| DB02 | `mizizi_case_orchestration_links_v1` | `mizizi_private.cases`, `case_events`, `case_dependencies`, `case_receipt_links`. FK to workspace and existing domain review/canonical references where typed IDs allow; subject_ref=(type,uuid), event_seq monotonic immutable; unique (workspace,case_key); parent/correlation; no second decision ledger. |
| DB03 | `mizizi_case_plan_snapshot_v1` | `case_snapshots`, `plan_versions`, `stage_leases` if current `platform_private.jobs` cannot support task stage leases. Immutable expected subject snapshots, operation targets, hash, rule/model/policy versions, expiry, plan status. Never store grants in JSON. |
| DB04 | `mizizi_research_provenance_v1` | `research_runs`, `research_step_receipts`, `case_evidence_links`; existing `registry_evidence_assertions` and provider observations remain source. Enforce source-use basis, observed_at, upstream lineage, SHA-256 and restricted scope; append-only. No unbounded raw copyrighted content. |
| DB05 | `mizizi_license_hold_policy_v1` | `stewardship_licenses`, immutable `license_events`, `write_holds`, immutable hold events, `policy_evaluations`. Narrow capability and actor refs; precedence global > workspace > claim/operation; deny at gateway, no workspace licence supersedes Registry prohibition. |
| DB06 | `mizizi_public_disclosure_revision_v1` | `public_disclosure_policies`, `core_publications`, `public_receipt_revisions`; **public read projections only** via reviewed view/RPC. Source attestation sharing snapshots, explicit publication decisions, withdraw/cache invalidation; no public select on private evidence. |
| DB07 | `mizizi_partner_delivery_foundation_v1` | `workspace_connections`, `delivery_batches/items/attempts/acknowledgements`. Links to existing `outbox_events` and Registry operation receipts. Endpoint + credential reference (not secret), licensing, per-destination withholding, idempotency and partial ACK; immutable attempt history. |
| DB08 | `mizizi_claim_family_accuracy_v1` | `claim_family_policy_versions`, `audit_samples`, `accuracy_windows` and `provider_drift_signals`. Separate ground-truth human adjudicator from model prediction. Unique sample IDs; cohort/selection version, CI interval and auto-lapse reason. |
| DB09 | `mizizi_registry_credit_alias_governed_reconcile_v1`, **only if missing after live-authority proof** | Reusable typed operation for redundant *Track credit* referring to an already-archived Artist alias, **not** a second Artist merge. Frozen prior alias/target credit IDs, same canonical Artist link evidence, credited-as provenance, other Artist credits, known primary count, exact row budget, independent verifier and rollback/fail closed. No D1 hardcoded IDs in reusable kernel. |
| DB10 | `mizizi_public_core_search_pagination_v1` | Public-safe paginated Core/Field read functions, deterministic source-group counts after redaction, cursor and revision, RLS/search-path and non-inference tests; avoid repeating Registry canonical search. |
| DB11 | `mizizi_external_partner_authority_v1` | Only after partner security and contract proof: narrow scoped workspace APIs, invite/representation authority and independent approval for high-impact policy changes; no default external `manage_registry` membership. |
| DB12 | `mizizi_legacy_view_retirement_v1` | Conditional, last: deprecate #1094 per-case links only after equivalent generic case path passed full D1/D2/D3 regression and independent Production acceptance. Never remove operation/decision source rows. |

**Schema validation required per migration:** exact columns, null rules, typed constraints, unique keys, FK targets and delete behavior, permitted index predicates, row-owner, retention, grants/RLS, `SECURITY DEFINER SET search_path` hardening, view security_barrier/security_invoker choice, audit trigger, migration replay compatibility, generated TypeScript schema parity and independent SQL verifier. Use current logical FK constraints before final naming; this register is not pretending all cross-domain UUID FKs exist today.

### 1.1 Case table contract and invariants

Case must carry `case_id uuid PK`, `workspace_id uuid`, `subject_type text`, `subject_id uuid`, `claim_family_key text`, `claim_key text`, `case_key text`, `case_state text`, `current_stage text`, `epistemic_state text`, `mutation_state text`, `publication_state text`, `delivery_state text`, `active_plan_version int`, `last_observation_fingerprint text`, `policy_ruleset_version text`, `risk_class text`, `next_action_at timestamptz`, `created_at/updated_at timestamptz`. Check positive versions, valid enums, active scope, unique replay key, immutable subject binding once created. Existing `registry_review_items.id` may be attached through `case_receipt_links` with typed relation; never require every case to have an Admin review record immediately. All transitions CAS on prior revision; server constructs immutable audit events. Public response never exposes internal row number/authorization fields.

### 1.2 Case receipt-link contract

`case_receipt_links(case_id, relation_type, authority_schema, authority_object_type, authority_id, authority_fingerprint, linked_at)` permits `registry_evidence_assertions`, `registry_review_cases/events`, `registry_review_items`, `registry_canonicalization_decisions`, `registry_execution_grants`, `registry_mutation_operations`, `registry_operation_write_events`, `registry_identity_lineage`, `registry_contribution_attestations`, `platform_private.outbox_events` and external delivery ACKs. FK/trigger verify against supported typed authority; do not permit arbitrary string references without existence proof. Never copy private payloads into public event snapshots.

### 1.3 Typed operation/claim family policy

An executable policy has `family_key` (e.g. `recording_identity_same_v1`), `evidence_contract_version`, `applicable_subject_types`, `precondition_predicate_key`, `operation_type_version`, `risk_tier`, `required_human_role` or exact pre-approved licence version, `max_targets/max_rows/max_cost`, `required_verifier_key`, `public_disclosure_rule`, `reopen_triggers`, and explicit prohibited inferences. Registry operation type is the maximum authority; per-workspace licence cannot expand it. Family policy versions are immutable after activation; new version must shadow-test before admission. Every family receives a negative fixture.

## 2. Existing source edits and newly proposed source files

Every path in the following list is an implementation target, **not** an already merged change.

### 2.1 Rule/mind/worker/runtime: preserve existing single stewardship agent

**MODIFY**
- `scripts/registry/agents/mizizi/core.ts`: extract typed finding, evidence-lineage clustering, rule identifiers and existing deterministic record analysis to importable package seams without changing accepted rule hashes or semantics. Keep `analyzeTrackIdentity`, `analyzeReleaseIdentity`, `analyzeChartIdentity` and provenance analyzers. Add contract adapter from existing finding to Claim/Case classification. No model/tool access inside pure analyzer.
- `scripts/registry/agents/mizizi/run.ts`: keep legacy CLI `audit/review/apply` contract for historical proofs; new interactive/scheduled orchestration is a **new entrypoint into the same shared kernel**. No wholesale CLI rewrite; apply still gated by original confirmation, no standing privileged login.
- `scripts/registry/agents/mizizi/artist-origin-broker.ts`: wrap with a typed capability adapter, not a second origin executor.
- `scripts/control-plane/mizizi-production-jit-runtime.mjs`: reuse audited transient transport and restore/zero-at-rest logic; do not create another long-lived pg connection, locally stored production secrets or new recurring GitHub workflow per review.
- `scripts/control-plane/primitive-registry.json`, `registry-privileged-writer-manifest.json`: register every new privileged function, operation family and RLS writer in established machine verification inventories.

**NEW**, under `scripts/registry/agents/mizizi/runtime/` or an already-proven shared runtime package after the first slice:
`types.ts`; `case-adapter.ts`; `case-state-machine.ts`; `case-journal.ts`; `scheduler.ts`; `claim-jobs.ts`; `leases.ts`; `resumption.ts`; `policy-evaluator.ts`; `claim-family-registry.ts`; `operation-compiler.ts`; `plan-freezer.ts`; `capability-broker.ts`; `verification-router.ts`; `hold-controller.ts`; `incident-classifier.ts`; `metrics.ts`; `outbox-adapter.ts`; `receipt-linker.ts`.
The orchestrator uses `platform_private.claim_jobs/complete_job/fail_job` where supported. Audit the existing job `resource_id` reference constraints; if incompatible, adapt the shared jobs schema rather than create duplicate MIZIZI queues. Scheduling must be durable/lease-safe and limited to approved infrastructure, not a perpetual browser worker.

**Data contracts:** `CaseInputV1`, `ObservationEnvelopeV1`, `FindingV1`, `ResearchRequestV1`, `ResearchResultV1`, `FrozenPlanV1`, `PolicyDecisionV1`, `HumanDecisionTaskV1`, `ExecutionIntentV1`, `VerifierReceiptV1`, `PublicCoreV1`, `DeliveryEnvelopeV1`; schema-versioned types validated server side and pinned at operation boundaries. All cross-module dynamic JSON validates before persistence.

### 2.2 Source/provider/OpenAI research

**REUSE/MODIFY**
- `src/services/registry/provider-adapters/apple-music-adapter.ts`, `spotify-adapter.ts`: retain metadata source evidence, adapter-specific capabilities and provider-native IDs; never grant canonical write access.
- `supabase/functions/_shared/provider-identity.ts` and `provider-candidate-evidence.ts`: canonical provider vocabulary/candidate evidence; add only typed source references and lineage metadata where missing.
- `supabase/functions/provider-intake-api/`, `registry-artist-provider-fetch/`, `registry-discography-provider-fetch/`, `music-work-resolver/`: use existing managed egress/auth contracts. No broad new scraping service.
- `docs/engineering/provider-identity-adapter-capability-contract-v1-20261006.md`: maintain versioned provider contract without rewriting unrelated providers.

**NEW** `supabase/functions/_shared/mizizi/research/` (or shared internal TypeScript package if CLI and Deno bridge justified):
`source-policy.ts`, `source-registry.ts`, `query-budget.ts`, `research-orchestrator.ts`, `openai-planner.ts`, `tool-schema.ts`, `provider-retriever.ts`, `web-evidence.ts`, `structured-findings.ts`, `lineage-deduplicator.ts`, `claim-scoring.ts`, `privacy-minimizer.ts`, `model-audit.ts`, `cache.ts`, `drift-evaluator.ts`.
One Edge endpoint `supabase/functions/mizizi-research-worker/index.ts` **only if** it passes approved Edge-runtime dependency, timeouts, secret comparison, client class and provider-terms tests; otherwise use an existing bounded worker. API secret only in server secret authority; never in Vite client. Tools are read-only/research-only and allowlisted; no model-driven SQL, arbitrary URL fetch or capability issue. Structured output includes evidence assertion refs, conflict flags and "insufficient evidence".

### 2.3 Backend API / typed RPC command layer

**NEW proposed** `supabase/functions/mizizi-workspace-api/index.ts` (authorized tenant API façade), `supabase/functions/mizizi-public-read/index.ts` (public read with safe cache), `supabase/functions/mizizi-delivery-worker/index.ts` (outbox transport), all contingent on proving need versus existing `admin-router`, `public-query-v1` and source-specific RPCs.

**NEW SQL functions**, each under a CLI-minted, verifier-backed migration:
- `mizizi_private.ensure_case_v1(workspace,subject,claim_key,review_ref,idempotency)`: returns stable case, no canonical mutation.
- `mizizi_private.record_case_transition_v1(case_id,expected_revision,event,actor,reason)`: CAS, immutable event, write-role constrained.
- `mizizi_private.freeze_case_plan_v1(case_id,policy_version,evidence_ids,targets,expected_fingerprint)`: immutable plan and state; requires operation-specific admissibility evidence.
- `mizizi_private.evaluate_stewardship_policy_v1(case_id,actor,plan)`: deterministic policy/hold/licence result; no grant mint.
- `mizizi_private.issue_case_operation_grant_v1(case_id,plan_id,approval_ref)`: **delegates only to existing** grant issuer, never broad actor or token, short TTL and exact target.
- `mizizi_private.attach_operation_receipt_v1(case_id,existing_operation_id)`: join/validate, cannot fabricate success.
- `mizizi_private.verify_case_completion_v1(case_id)`: checks all domain verifiers, linked review finalizers, pointer postconditions and no active exact grants; cannot mark success based on task status alone.
- `public.mizizi_get_workspace_brief_v1(workspace_id,cursor)`, `public.mizizi_get_case_v1(case_id)`, `public.mizizi_list_decisions_v1(workspace_id,time_budget,cursor)`, `public.mizizi_record_human_decision_v1(task_id,value,evidence_version)`, `public.mizizi_set_write_hold_v1(scope,reason)` with **explicit** existing principal/capability checks and non-enumerating errors.
- `public.mizizi_get_public_core_v1(core_id,revision)`, `public.mizizi_list_public_cores_v1(cursor,filters)`, `public.mizizi_get_public_field_v1(bounds,cursor)`, `public.mizizi_submit_challenge_v1(core_id,evidence_ref,reason,idempotency)`: public-safe projections with rate/abuse limits.
- `public.mizizi_set_creator_sharing_v1(...)` if and only if existing `public.set_my_music_credit_permission_v1` lacks requested scope; otherwise call the existing permission contract.
- `public.mizizi_get_delivery_receipt_v1(public_receipt_id)`, `public.mizizi_get_workspace_delivery_v1(workspace_id,delivery_id)`; no secret/other tenant leakage.

**Do not bypass** `public.admin_record_public_music_identity_track_review_decision_v1`, `public.admin_preview_registry_track_duplicate_repair`, `public.admin_apply_registry_track_duplicate_repair`, `public.admin_finalize_public_music_identity_track_review_v1`, `platform_private.execute_registry_track_duplicate_repair_v1` or the existing approval/review/grant/verifier semantics. Wrap them in typed case orchestration. New case command RPCs cannot impersonate an authenticated reviewer.

### 2.4 Frontend and design-system: exact route and component boundaries

**EXISTING preserve:** `src/router/config.tsx`, `src/router/lazyAdmin.tsx`, `src/router/lazyPublic.tsx`; `src/pages/admin/review/mizizi/page.tsx` and `issue1094*.tsx`; `src/pages/admin/review/queue/page.tsx`; `src/pages/admin/relationships/duplicates/page.tsx`; `src/pages/tracks/detail/page.tsx`; `src/pages/tracks/detail/components/TrackCreditsSection.tsx`; `src/pages/artists/detail/components/ArtistMusicProvenance.tsx`; `src/pages/releases/detail/components/ReleaseMusicProvenance.tsx`; `src/pages/people/detail/components/PersonMusicCredits.tsx`; `src/pages/credits/page.tsx`, `src/pages/credits/invite/page.tsx`; `src/services/musicProvenance.ts`; `src/services/adminReviewCommandCenter.ts`. Audit original route count/splitting authority before adding routes; no duplicate admin content chrome, no native browser modal/select controls when WAKILISHA design system provides alternatives.

**NEW route modules**, exact proposed paths:
- `src/pages/admin/mizizi/page.tsx` + ``/case/[id]` if current router is path-config, implement matching route in config (not filesystem routing); Headquarters workspace view.
- `src/pages/mizizi/page.tsx` (public introduction/Brief), `src/pages/mizizi/cores/page.tsx`, `src/pages/mizizi/cores/detail/page.tsx`, `src/pages/mizizi/field/page.tsx`, `src/pages/mizizi/receipts/detail/page.tsx`, `src/pages/mizizi/challenges/page.tsx`.
- `src/pages/mizizi/workspaces/page.tsx`, `src/pages/mizizi/workspaces/detail/page.tsx` with auth guard and member scope.
- `src/pages/mizizi/my-claims/page.tsx`/`src/pages/mizizi/sharing/page.tsx` only where extension of existing `/credits` is insufficient. No separate creator identity management.
- `src/components/mizizi/`: `MiziziShell.tsx`, `RootHorizon.tsx`, `BriefSummary.tsx`, `ActivityTimeline.tsx`, `TimeBoxedDecisionPicker.tsx`, `CaseQueue.tsx`, `DecisionCard.tsx`, `FieldCanvas.tsx`, `FieldListAlternative.tsx`, `CoreStrata.tsx`, `SourceLineageGroup.tsx`, `ContestedClaimPanel.tsx`, `ClaimHistory.tsx`, `WhatWouldChange.tsx`, `LicenceLedger.tsx`, `LicenceCurve.tsx`, `WriteHoldControl.tsx`, `DeliveryLedger.tsx`, `DeliveryDiff.tsx`, `SourceDisclosureBadge.tsx`, `ChallengeForm.tsx`, `WorkspaceSwitcher.tsx`, `AskMizizi.tsx`, `CaseActions.tsx`.
- `src/services/mizizi/`: `types.ts`, `client.ts`, `publicCore.ts`, `workspace.ts`, `decisionTasks.ts`, `field.ts`, `licences.ts`, `deliveries.ts`, `receipts.ts`, `challenges.ts`, `queryKeys.ts`, `permissions.ts`; typed adapters only, no policy decisions trusted to UI.

**UI responsibilities by permission:**
- Brief: last-run facts and actionable bounded tasks, hold/incident controls for permitted governor.
- Field: correct typed graph and accessible alternative, detail links.
- Cores: public-safe strata vs private/source-authorized detail; explanation/version/contradiction and challenge path.
- Licences: view for public (policy explanation only), scoped operator/grant authority for secure console; separate policy approval.
- Deliveries: private per-org diff/receipt/ack state; public receipt only where approved. Not a generic CSV download of private evidence.
- Creator: personal evidence/attestation, representation, invitation/consent and sharing on existing `/credits` surfaces wherever possible.
- Search or ask: retrieve sourced Core projections and phrase a bounded answer; never explain a private Core to anon or make uncited identity determinations.

**Routing and SEO:** public MIZIZI route, public Core canonical URL and appropriate index/noindex by publication state; updates to ``src/router/lazyPublic.tsx`, metadata/prerender/sitemap pipeline `scripts/seo/`, JSON-LD compatible provenance/citation semantics without implying disputed claims as facts; tests for 404 vs withheld inference, protected workspace noindex, data-driven sitemaps, lazy route bundles and fallback on JS failure. Internal Admin route lazy boundary, existing `scripts/performance/audit-admin-route-splitting.mjs` and public counterpart must remain green.

### 2.5 Integration and event adapters

- Registry: typed entity index and `registry_identity_lineage` lookup; source of canonical IDs and supersession; **no MIZIZI cloned Artist/Track tables**.
- Creator participation: `registry_contribution_attestations`, attestation events/permission versions, `get_my_music_credits_v1`, `get_public_person_music_credits_v1`, invite/transition RPCs.
- Rights: `registry_rights_claims` is separate authority; no rights guess from credit, no delivery of rights claim beyond its disclosure contract.
- Provider: `provider_field_observations`, `registry_provider_sources`, `registry_external_identifier_assertions`, typed provider adapter sources; no direct canonical provider-link write from research.
- Charts: `wk_chart_entries_v2` current canonical pointers plus observed historical chart evidence, planned impact before mutation; historical frozen data not silently rewritten.
- Community: saves, threads, activity and contributor relationships; preserve event history, relocate only current pointers via approved operation with verifier.
- Institute/Editorial: reusable source evidence, not duplicate authoritative claim rows; editorial rights/publisher approval remains separate.
- Outbound: use existing outbox; DDEX ERN standards adapter remains independently versioned; webhooks per partner allowlist/HMAC and ack contract; delivery failure does not roll back verified canonical truth.

## 3. Capability/operation gaps (complete supported initial list)

| Claim family | Existing evidence/rule path | Existing mutation/finalization | New work required |
|---|---|---|---|
| Track title/slug packaging | `analyzeTrackIdentity`, MIZIZI review | `registry.track_slug.canonicalize/v1` (disabled at rest, preapproved window only) | Case adapter, policy window, provenance Core and safe link |
| Release taxonomy/packaging | `analyzeReleaseIdentity` | `registry.release_taxonomy.repair/v1` and `registry.release_slug.canonicalize/v1` (disabled at rest) | Review-case join, policy gating, replay, delivery |
| Chart canonical identity drift | `analyzeChartIdentity` | `registry.chart_track_slug.synchronize/v1` (disabled at rest) | Exact current vs historical pointer planner, public source explanation |
| Same-recording duplicate Track | `track_recording_identity_conflict`, `admin_record_public_music_identity_track_review_decision_v1` | `registry.track.duplicate_repair/v1` with existing preview, grant, verifier and finalizer | Generic case orchestration, human decision reuse, postcondition contracts, delivery |
| DESIRE archived-Artist alias | Existing canonical Artist merge lineage; credit rows | **No existing exact redundant historical Track credit retirement authority proved** | DB09 after surgical contract proof; then same proven duplicate path |
| Provider identifier/link conflict | Provider adapters, `external_identifier_assertions` | Existing reviewed reconciliation/provider-link admission families | Source capability/rate policies, confidence and isolation, case binding |
| Artist ambiguity/alias | Registry Artist and resolution lineage | `registry.artist.merge/v1` and `registry.artist.decouple/v1`, narrowly governed | Policy prohibit name-only merge, maker/creator participation, case adapter |
| Contribution/Work credit | Immutable creator attestations and evidence | `registry.track_contribution.admit/v1`, `registry.work_contribution.admit/v1`, `registry.track_work_link.admit/v1` | Human provenance/permission and public Core, open-answer-first |
| Rights/ownership | `registry_rights_claims` + evidence | `registry.rights_claim.reviewed_reconcile/v1` disabled at rest | Separate human/legal permission and NEVER infer ownership; source-use safe |
| Public claim display/challenge | Existing `get_public_track_provenance_v1` and creator permissions | Approved source publication only, not a generic write path | Public Core projection, challenge intake, publishing policy |
| Partner delivery | `outbox_events` and receipts | Existing outbox mechanism; domain-specific exports | Delivery adapter, ACK/reject contract, recipient permission and receipt |
| Licence/evidence drift | Existing system actor grants, verifier stats and source lineage | Grant window and immutable operation journal | Measured licence policy, calibration, audit sampling, lapser, write hold |
| Cultural provenance graph | Entity/identity/relationship index + attestation data | Typed Registry relationship authority | Field index/limited reads, temporal/source-scoped edge disclosures |

The initial capability catalogue is limited to what the current Registry proves. No new authority is introduced by ticking a UI licence or entering an OpenAI prompt. Each expanded claim family must have a separate operation contract and acceptance matrix.

## 4. End-to-end APIs and command envelopes

**Read** `GET workspace brief`: workspace UUID from membership authority, page cursor, window, evidence freshness/revision; results bucket counts and linked case IDs, not raw tables. `GET case`: case state, claim/core, permitted evidence summaries, human tasks, approved plan, exact receipt/status timeline. `GET public Core`: revisioned disclosed claim, grouped source references and copy count, "what would change", public history and permissions-safe challenge path. `GET Field`: bounded spatial/subject filters, cursor, typed visible nodes/edges, stable pagination. `GET deliveries`: per-recipient scope; redact private source fields in all diffs.

**Write** `POST research`: case/workspace, allowed source domains, max tools/budget, idempotency, actor; **no mutation**. `POST decision`: case/task, explicit chosen option, reviewer context, evidence version, idempotency; rejects stale evidence. `POST prepare plan`: type, evidence refs, exact targets and expected state hash; returns freeze receipt. `POST apply`: frozen plan ID plus existing approved decision/licence and second-factor/confirmation for high-risk, no direct model command. `POST hold`/`resume`: scope/reason/idempotency, privileged policy actor. `POST challenge`: public/contributor limited input with abuse controls, no canonical change. `POST approve delivery`: recipient scope, approved projection version, sender authority and idempotency; uses existing outbox.

**Error taxonomy**: `INSUFFICIENT_AUTHORITY`, `WORKSPACE_SCOPE_DENIED`, `EVIDENCE_STALE`, `SOURCE_USE_RESTRICTED`, `PROVIDER_UNAVAILABLE`, `CLAIM_DISPUTED`, `HUMAN_DECISION_REQUIRED`, `PLAN_EXPIRED`, `WRITE_HOLD_ACTIVE`, `CAPABILITY_NOT_EARNED`, `OPERATION_DISABLED`, `GRANT_INVALID`, `VERIFIER_FAILED`, `DOWNSTREAM_POINTER_CONFLICT`, `PUBLICATION_WITHHELD`, `DELIVERY_PARTIAL`, `RETRY_LATER`. Safe user copy maps internal code to language bible; never reveal hidden existence by differing 403/404 bodies.

**Idempotency**: choose stable fingerprint from workspace+case+stage+explicit input schema/version+evidence+targets; unique per stage. Never recycle completed operation key to mutate another subject. Retried API must read existing authoritative receipt first, return original result if exact match, reject retargeted key. User confirmation is durable explicit evidence of one action, not reusable broad consent.

## 5. Security, privacy, ownership and lifecycle matrix

| Concern | Owner / proof |
|---|---|
| Canonical entity create/update | Existing typed Registry broker + executor + verifier; no MIZIZI generic SQL writer |
| Human truth determination | Appropriate creator/reviewer authenticated decision, existing review event/canonicalization decision |
| Earned autonomy | MIZIZI policy governor + independent shadow metrics + existing actor capability grant intersection |
| External workspace | Membership/org authority + RLS + consent + partner source contract + no cross-tenant caches |
| Provider fetch | Provider adapter egress allowlist and rate/source-use budget; immutable observation |
| Model query | Server-only scoped research worker, schemas/trace redaction, no write/grant privilege |
| Creator source/evidence | Permission/attestation versions; ability to retract sharing without rewriting historical internal proof |
| Public Core | Publication/disclosure revision authority, redacted source links, withheld/contested explicit state |
| Corrections and appeals | New disputed/reopened case and immutable revision/superseding correction; no mutable overwrite |
| Delivery | Existing outbox plus recipient-specific policy/ACK, no implicit external authorization |
| Hold incident | Server-side immediate admission denial, event history, notified operators, authorized recovery |
| Metrics | Immutable adjudication and origin-group calibration; no self-scored accuracy promotion |
| Retention | Source licence, jurisdiction, contributor permission and policy; immutable minimal hashes where lawful, deletion/export workflows for allowed private artifacts |
| Accessibility | WAKILISHA UI controls, keyboard alt for canvas, reduced motion, focus and screen-reader tests |
| Performance | Cursor-limited graph and evidence, materialized/windowed counts, stable reads and cache invalidation |
| Observability | Correlation ID, case_id, receipt refs, job/outbox trace, structured redacted logs, alert on grant leakage or staleness |

## 6. Exact CI and control-plane code inventory

**MODIFY existing tests**: `test/registry/mizizi-cultural-data-steward.test.ts`, `mizizi-admin-workspace.test.ts`, `music-provenance-slice1-authority.test.ts`, `provider-identity-*.test.ts`, `test/security/rls-policies.test.ts`, `test/institute/evidence-reader.test.ts`. Retain accepted `test/registry/mizizi-1094-focused-decision-link.test.ts` and #1094 terminal proofs through retirement. Update `package.json` critical contract **only when permanent new verifiers are ready**, never simply suppress existing checks.

**NEW tests**:
`test/mizizi/case-state-and-replay.test.ts`; `evidence-independence.test.ts`; `claims-and-contra.test.ts`; `human-decision-explicitness.test.ts`; `policy-licence-calibration.test.ts`; `hold-write-atomicity.test.ts`; `plan-freeze.test.ts`; `plan-revocation-races.test.ts`; `worker-leases-recovery.test.ts`; `openai-tool-boundary.test.ts`; `provider-rate-drift.test.ts`; `tenant-isolation.test.ts`; `creator-permission-publication.test.ts`; `public-core-redaction.test.ts`; `public-graph-visibility.test.ts`; `delivery-ack-replay.test.ts`; `delivery-permission-change.test.ts`; `historic-provenance-preservation.test.ts`; `desire-archived-alias-credit.test.ts`; `source-rights-semantics.test.ts`; `accessibility-keyboard-field.test.ts`; `brief-real-receipt-counts.test.ts`; `earned-licence-lapse.test.ts`; `incident-drill.test.ts`; `public-seo-noindex.test.ts`; `performance-and-scale.test.ts`.

**NEW permanent SQL verifiers** under `scripts/control-plane/verify-mizizi-*.sql` by domain migration: RLS/privileges and security-definer ownership; append-only immutability; case replay uniqueness; no phantom review decisions; governed policy/holds; public disclosure noninterference; join to actual receipts; exact provider/Chart/Community pointers; per-workspace grant isolation; zero-at-rest after all runs; publication/export withdrawal. Add JS machine audits to `scripts/control-plane/` for new privileged writer manifest, route/splitting/read/export lists.

**Critical workflow** `.github/workflows/critical-control-plane.yml` must run matching permanent tests; same browser-class UI checks, SQL preview replay and stable schema comparison. New deployment workflow only if existing canonical Supabase/GitHub/Lightsail paths cannot express runtime; do not add parallel bespoke MIZIZI Production workflow for every case. Respect existing separate gates: migrations → Edge worker(s) → frontend → public/partner smoke.

## 7. Build slices mapped to PR classes (no 22-phase fragmentation)

**Slice 1 — Groundwork/Headquarters:** exact DB01–DB05 compatible schema/link authority; server-side case lifecycle, deterministic rules reuse, jobs/outbox adapter, explicit human task, policy/hold/licence read; initial protected Headquarters Brief/Cores and D1 read-only case. Proof: durable pause/resume and no new writer.

**Slice 2 — Research/Creator/Public trust:** DB04/DB06 and provider/OpenAI gated research, independence/contradiction, public Core+Field read, challenge, creator permission reuse; shadow licences and separate disclosure decisions. Proof: real DESIRE research dossier, contributor participation and public withheld/contested state, no cross-scope leak.

**Slice 3 — Governed execution/Partners:** DB07–DB11 only where earned, generic typed action planner, exact command/finalization/delivery/ACK, accuracy-based licence gates, partner scoped workspace; DESIRE alias capability gap closed through reusable credited-as provenance operation if necessary; queue operationalization. Proof: D1 full loop plus representative cases across all existing relevant families, reliable resumability without bespoke page/deployment.

**Exit — Production cohort and authority closure:** retained D2/D3 replay fixtures, remaining real corpus classified, invited human evidence where required, legal/source privacy, public real evidence, partner sample delivery and ack, outage/security drill, exact grants at rest, clean WAKILISHA routes. No assumption all 149 reviews can be automatically cleared. All build classes separately reviewed/Preview-proven/merged/Production-promoted.

## 8. Known unknowns that require opening implementation gates, not guesses

- Does shared `platform_private.jobs` FK/resource binding permit a Registry case? Audit before DB02.
- Which existing Organization/representative roles can legally administer external catalogue workspaces? Need exact RLS/actor graph, not a parallel organization ledger.
- Which public Core evidence items can legally be disclosed? Source/creator policy inventory before public launch.
- What is the current approved OpenAI/provider-secret placement, cost, latency and privacy regime? Dependency/secret-parity gate before worker.
- Can any existing governed credit operation retire **only** the redundant archived alias credit on D1 without wholesale credit-set replacement? Prove behavior before DB09.
- Which delivery recipients and standards are contractually authorized? No simulated partner transmissions.
- Does existing editorial source authority permit source reuse under public MIZIZI Cores? Check rights/citation and publication policies.
- Exact incoming provider formats and field-specific credibility: require contract tests, not model guessing.
- Current public route/pre-render/SEO/security standards and admin route split baseline must be re-proved at implementation, not deduced from this document.
- Legal privacy and territory obligations for a multi-institution provenance product need review before accepting real external private catalogues.
