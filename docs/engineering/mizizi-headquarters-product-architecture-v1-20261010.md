# MIZIZI Headquarters — Complete Product and System Architecture V1

**Date:** 10 October 2026  
**Status:** Architecture specification for engineering review; **docs-only, no new runtime authority**  
**Baseline:** Protected `main@4381d6020b83e5b3b6781bb28003dee76618737d`; Production Supabase project `pgzizndxdyhqmtyywjmt`, migration head `20261009181647` (216 migrations).  
**Product reference:** owner-supplied `mizizi.html`, 10 October 2026, 1,671 lines; exploratory sample, **not** live product or licensed evidence.  
**Companion:** [exact change register](mizizi-headquarters-code-change-register-v1-20261010.md); [delivery/exit contract](mizizi-headquarters-implementation-exit-contract-v1-20261010.md).

## A. Product decision, boundaries and governing authorities

MIZIZI is **a headquarters for cultural knowledge governance and provenance**. It is not an all-autonomous wizard, a replacement Registry, a generalized chatbot that can mutate tables, or simply an Admin review queue. The same governed cultural record supports four differentiated access modes: (1) WAKILISHA operators and policy stewards, (2) scoped organizational catalogue workspaces, (3) creator/contributor participation, and (4) public read-only provenance. Every surface uses the same claim/evidence/decision/authority/history identities, with explicit per-audience disclosure projections. WAKILISHA's canonical Registry remains owner of canonical cultural entities; MIZIZI governs investigations and the permitted transitions around them.

**Source-derived non-negotiables** from `docs/registry/REGISTRY_KNOWLEDGE_CONTRACT.md`, `docs/engineering/mizizi-registry-primitive-convergence-map.md`, `docs/engineering/music-provenance-mizizi-binding-execution-scope-20260929.md`, `docs/engineering/registry-reviewed-admission-spine-and-mizizi-stewardship-design-20261002.md`, `docs/engineering/provider-identity-registry-mizizi-jurisdiction-contract-20261006.md`, WAKILISHA Cultural Operating Layer Doctrine, and Language & Tone Bible:

- **Do not primitive the culture; primitive the governance.** Artist, Person, Recording/Track, Release, Work, Contribution, Relationship, Rights Claim and Event retain distinct semantic authorities. Artist name matching, a similarity score, or ISRC alone never means two people or two recordings are identical.
- An observation is not an accepted fact; a performance credit is neither rights ownership nor proof of songwriting; an Artist persona is not automatically a Person. Historical source spelling and context cannot be erased by canonicalization.
- Provider adapters observe; independent evidence and exact reviewed plans justify; typed Registry operations execute; independent verifiers and finalizers accept. No AI-generated SQL or service-role canonical DML.
- The Registry is the reusable canonical knowledge authority. Institute research, Magazine editorial work, Charts measurement, Community contributions, and MIZIZI are distinct consumers/workflows, not new truth stores.
- **No write authority at rest:** system actor principal, capability grant, exact target-scoped execution grant, enabled operation window, and ephemeral database login each remain separately controlled. A GUI "Hold Writes" flag alone is insufficient.
- Creator permissions constrain display and sharing; organizational access and public disclosure can never override a creator's more restrictive valid permissions or source licence.
- Human judgment is first class and must **not** be preselected or presented as though it was explicitly given. Reviewed decisions are durable and never re-requested because execution resumed.
- Human discretion includes "do not change", "not enough evidence", "two claims remain in disagreement", "ask an involved person", "separate identities", and "same identity" as appropriate to the claim family. A no-change disposition is a successful recorded outcome, not an invisible failure.

### Current proved substrate (read-only audit 10 October)

**Reuse, do not recreate:** `platform_private.jobs` (leases/retries), `platform_private.outbox_events` (delivery/dispatch), `platform_private.registry_evidence_assertions` (immutable evidence and lineage), `platform_private.registry_review_cases` and `registry_review_events`, `public.registry_review_items` and `registry_canonicalization_decisions` (existing Admin-review/public-music-identity decisions), `platform_private.registry_operation_types`, `registry_execution_grants` and `registry_execution_grant_targets`, `registry_mutation_operations` and `registry_operation_write_events`, `system_actor_capability_grants`, `system_actors`, `public.registry_identity_lineage`, `registry_external_identifier_assertions`, `registry_provider_sources`, `provider_field_observations`, `registry_rights_claims`, `registry_track_provider_links`, `registry_track_artists`, `registry_track_contributions`, `registry_works` and `registry_work_contributions`, `platform_private.registry_contribution_attestations`, invitations and permission versions. Keep `public.get_public_track_provenance_v1` and `src/services/musicProvenance.ts`.

Existing code: `scripts/registry/agents/mizizi/core.ts` (rule, evidence lineage and deterministic analysis), `run.ts` (audit/review/apply CLI), `artist-origin-broker.ts`, `scripts/control-plane/mizizi-production-jit-runtime.mjs`, MIZIZI Release/Track/URL GitHub control planes, `src/services/adminReviewCommandCenter.ts`, `src/pages/admin/review/mizizi/page.tsx` and the three temporary `issue1094*.tsx` task implementations, provider adapters under `src/services/registry/provider-adapters/` and `supabase/functions/_shared/provider-identity.ts`. Existing `registry.track.duplicate_repair/v1` and `public.admin_finalize_public_music_identity_track_review_v1` are proven for Ficha and Colors. Exact ongoing migration/operation availability must be reread before any subsequent writes: a type existing or `enabled=true` is **not** a standing authorization.

Production baseline: **149 open MIZIZI reviews**, **92 open recording-identity reviews**; Ficha and Colors reviewed duplicate operations verified and reviews resolved; DESIRE decision recorded but source still needs_review with an archived-Lilmaina alias primary-credit conflict. This snapshot is a planning fixture, **not** a promised future count or proof all reviews fall within #1094.

## B. Five coherent product places, not five backends

### 1. Brief — headquarters and truthful activity

- Workspace-specific account of observed facts, researched claims, settled outcomes, deliberate holds, creator questions, contradictory evidence, human decisions due, deadlines, reviews completed, execution/retry states, delivery state, and costs. No auto-conflation of "checked" with "resolved", "sent" with "accepted", or "model answered" with "verified".
- "How long do you have?" opens five-/fifteen-/sixty-minute prioritized decision sets. Time estimates are grounded, optional and adjustable. Save/resume atomically; skip and undo must use real reversible decision commands with provenance rather than undoing raw tables.
- Night-growth/horizon animations read **actual** durable case events and aggregates (bounded/windowed queries), with disabled/reduced-motion alternatives. Never synthesize work or pulse as if a backend wrote something.
- Always distinguish: researched, held intentionally, waiting for a contributor, sources disagree, human decision due, approved plan, executing, verified, finalized, delivery pending, and delivery accepted. WAKILISHA language bible applies to all labels.
- Global and workspace **Hold Writes** status visible. Hold has reason, actor, scope, timestamp, expiry/review, audit trail and acknowledgement by the authority gateway; research/read work may continue. Unhold cannot override a security incident, expired licence or another actor's higher-priority hold.

### 2. Field — cultural relationships as a navigable, accountable graph

- Person, Artist persona, Group, Track/Recording, Release, Work, Credits, Source, and Place/Scene projections with typed, effective-dated, provenanced edges; clear legend for accepted/proposed/disputed/historical. Scene labels never inferred from names or unsupported stereotypes.
- Interactive canvas for discovery only; keyboard/list/table accessible alternative, scalable spatial index, progressive tiles/clusters, zoom bounds, semantic search and filters. No live graph-edge DML from dragging. A node opens its Core; edge reveals basis and source-access scope.
- Search by canonical UUID, title, credited-as name, provider URI/ID, ISRC/UPC/ISWC and alternate spellings; returned identities carry quality/status and disambiguation. Public search only on approved public projections.

### 3. Cores — **the claim**, not the Track row, is the review/provenance unit

- Stable Core ID maps a typed `subject_ref`, `predicate/claim_key`, claim value/role/temporal scope, competing candidates, accepted/current disposition, supporting/refuting evidence, source family/lineage, claimant and decision authority, changeset, operation receipts, publication clearance, re-open policy, and historical revisions. One Track may have many Cores.
- Evidence layers: independent support, creator/direct witness, contradiction, raw/unverified, echo/derived-from, disputed, withheld/private, awaiting answer. Actual assertion lineage from existing immutable `registry_evidence_assertions` is primary. Unknown independence is **unknown**, not automatically independent.
- Display precisely what the public can know, why, and what evidence would change it. Source link when legally/publicly allowed; privacy-safe citation when contents cannot be exposed; never leak inaccessible source via count, timing, search results, API errors or excerpts.
- Claims need time validity, competing values, resolution history and re-open triggers; never overwrite a claim to rewrite history. New credible counterevidence opens dispute/review without pretending the old conclusion never existed.
- Core decisions distinguish epistemic determination ("we have enough evidence") from **operational mutation** ("we may change these canonical relationships") and **publication** ("we may show this evidence").

### 4. Licences — earned authority for defined **claim families**

- UI term "Licence" means **MIZIZI governance permission**, **not** copyright/content licensing and **not** rights ownership. Technical domain identifier: `stewardship_license` to avoid collision with `registry_rights_claims` or partner distribution contracts.
- Each licence binds exactly: versioned claim family + action family + workspace scope + subject/resource filters + evidence preconditions + sources allowed + independent adjudication requirements + minimum audit sample + observed reliability statistics (sample size, confidence interval, strata, false-positive severity) + ceilings (rows, operations, per-day, cost) + permissible hours + supervising principal + start/end/review-by + immutable policy version.
- States: proposed → shadow-measured → supervised → earned → suspended/lapsed/revoked; re-earning requires new evidence and authorization. A score never overrides **Never Licensed** prohibitions.
- Runtime compiles entitlement to existing **capability/grant/operation gateway**, **not** direct model discretion. Licences cannot grant broader capabilities than the underlying Registry type allows; revoking licence invalidates future admission and active admission windows as defined, with atomic deny at execution.
- Mandatory shadow sample, stratified human audits, replay-safe drift detection, provider-format drift, source-dependence recalculation, creator challenge rate, incident rate, per-family calibration, hysteresis and fail-closed suspension. Never Licensed: same-named people automatically merged; shared-band membership implies recording performance; credit implies rights ownership; copied feeds treated as independent; embedding similarity treated as proof; unidentified raw composer text treated as verified writer.

### 5. Deliveries — accountable propagation of verified knowledge

- Outbound change sets to WAKILISHA consumers, participating creator, authorized partner or standards-format export (e.g. DDEX ERN only when corresponding authority and format mapping are proven). Each delivery links immutable approved claim revisions and canonical operation receipts, source/recipient permissions, projection version, before/after diff, destination capability, idempotency key and replay policy.
- States: drafted → validated → authorized → queued → dispatched → acknowledged/rejected/expired, optionally withdrawn or superseded with another event. "Sent" ≠ partner acceptance. Per-row partial acknowledgements and exception ledgers are required.
- Use existing `platform_private.outbox_events` and `command_receipts` conventions. Produce signed/scoped verifiable receipts with redaction and reproducible hashes, not an unqualified "proof" claim. Partner webhook/API, secure export, creator correction packet and internal materialized read refresh are **adapters**, never a new canonical truth store.
- Revocation/reversal is a **new compensating governed correction**, not deletion of the prior observation or a promise that third-party copies can be recalled. Public receipts show only safe diff detail.

## C. Actors, organization/workspace tenancy and access

**Principal classes:** anonymous public reader; authenticated creator/contributor; creator representative (proof of authority, scope, expiry); WAKILISHA reviewer; WAKILISHA policy governor; WAKILISHA operations administrator; external organization workspace owner; external scoped reviewer/operator; scoped integration service principal; MIZIZI System Actor; restricted provider adapter/worker. Existing WAKILISHA `manage_registry` checks remain intact; do **not** implicitly grant it to an external workspace member.

**Workspace** is a governance/visibility boundary, not a duplicate Registry. WAKILISHA internal and partner catalogues share canonical IDs only where separately admitted. A workspace gets source observations, memberships, review packets, policy/entitlements, delivery endpoints, private annotations, and per-subject visibility references; no copy of `registry_tracks`, no workspace-prefixed alternate canonical Track table.

Principal authorization intersection for *every* operation/read:
`authenticated identity ∩ workspace membership/role ∩ subject relationship/representation ∩ capability/licence/hold ∩ resource disclosure/consent ∩ operation exact grant`. Public and partner RLS are deny-by-default and tenant-scoped; sensitive private tables are not exposed to PostgREST. Admin vs workspace vs contributor authority remains distinct. Changes to workspace membership must not expose cached/private projections retroactively.

Onboard partner workspace only after invite, legal/service agreements, provider/source licence checks, domain/actor verification, rate limits and first-run **read-only** impact report. Separation of duties: reviewer cannot silently grant own high-impact licence, execute disallowed class or alter the independent verifier. Policy changes require an independent eligible approver for critical classes; emergency hold is always available to authorized operators. Break-glass is short-lived, separately recorded and alerted; never a persistent role exception.

## D. Domain seams and minimum new durable model (reuse-first)

**No single god-table.** Existing evidence, review, journal, provenance and credit stores remain authoritative. Add only the missing product-orchestration/policy/visibility links as versioned, RLS-protected extensions after collision and FK audit. Proposed **new** schema: `mizizi_private` for orchestration, policy snapshots and private processing, with `public` read projections exposed through security-reviewed view/RPC; if this conflicts with existing `mizizi_private` function schema, extend it rather than introduce another.

1. `mizizi_workspaces` — `id`, organization/owner type/ref, display settings, status, quota/retention policy, created_at; external organization binding to existing identity authority; no standalone "company truth".
2. `mizizi_workspace_memberships` — workspace_id, user_id/organization authority reference, role, scope, grant source, valid interval, revoked_at and history.
3. `mizizi_cases` — stable case_id, workspace_id, subject type/UUID, claim family/key, source review links, disposition state, current_stage, priority, risk, policy/version, current plan/version, last_seen_fingerprint, owner team, next_due_at, created/updated/completed. Unique scoped idempotent case key; never use title/slug as identity.
4. `mizizi_case_events` — append-only event_seq, case_id, event type, actor/principal, correlation/causation IDs, source IDs, exact authority receipt references, payload digest, occurred_at; partial-failure recovery. **Not a replacement** for `registry_review_events` or operation journal. Events are an index/pointer to domain receipts, not second decision authority.
5. `mizizi_case_dependencies` — case to case, operation dependency or external response, typed dependency and readiness condition. Detect cycles and require explicit dependency-break decisions.
6. `mizizi_case_claim_links` — case/core -> existing immutable evidence assertion IDs, typed relation (supports, contradicts, echo-of, supersedes, unknown), source disclosure policy ref and evidence-query version. Do **not** copy original copyrighted/private source material into claim fields.
7. `mizizi_case_snapshots` / `mizizi_plan_versions` — immutable evaluated predicate state, rule version, exact expected row counts/IDs, immutable proposed steps, plan hash, expiration and typed preview/verifier linkage. Version and supersede; never mutate old plan.
8. `mizizi_research_runs` and `mizizi_research_step_receipts` — input scope, user/actor, provider/model version, prompt/tool schema hash, source URLs/observed-at, structured output hash, per-source independence assessment, tokens/cost, cache/retention, redactions and refusal/safety reasons. Model thoughts/hidden reasoning are not evidence.
9. `mizizi_stewardship_licences` and immutable `mizizi_licence_events` — bounded policy/metrics/actions, proposed/earned/suspended state, scope, grant and independent reviewer references; subordinate to existing system-actor capabilities.
10. `mizizi_write_holds` — scope (global/workspace/claim/operation), issuer, reason, precedence, valid time, override rules, immutable history. Backend gateway checks it in the **same admission/execution transaction** wherever possible.
11. `mizizi_public_disclosure_policies` and immutable `mizizi_core_publications` — source and claim visibility, publisher decision, permission snapshot, public revision, disclosure reason, cache purge revision. Raw source evidence stays private.
12. `mizizi_delivery_batches` / `mizizi_delivery_items` / `mizizi_delivery_attempts` / `mizizi_delivery_acknowledgements` — bound to existing outbox events; exact row projection and partner receipts, scope/time-limited verification, correction/supersession.
13. `mizizi_case_metrics_snapshots` / accuracy audit samples — windowed precomputed aggregations, sample selection and adjudication result IDs; accuracy source is **audited human judgments** not self-reported model certainty.
14. `mizizi_provider_workspace_connections` — **references** to encrypted external integration credentials in existing approved secret authority, not secret values; scope, terms, capability inventory, expiry, endpoint allowlist and health.

Before minting any table, inventory existing `platform_private.jobs`, `outbox_events`, `registry_review_cases/events`, `registry_contribution_attestations`, `provider_field_observations` and `registry_identity_projection_lineage`. If one already enforces the invariant, create only a foreign-key link/read adapter. Every new table must have an owner, columns/types/FKs/checks, immutable-history policy, role grants, indexes, lifecycle and retirement path reviewed in its DDL slice.

### Core projection contract

A Core is a **stable read composition** around a typed claim, not an editable claim row: `core_id`, subject_ref, claim_key, value (possibly withheld), state, contested alternatives, evidence_groups[], independent_count and unknown_count, accepted decision ref, "what would change this", event timeline refs, public_disclosure_revision, version. Public responses are assembled from allowed evidence and existing operation events. Redact private creator contact, confidential source identifiers, raw correspondence, private workspace identifiers, internal execution paths, grant IDs, and unpublished claims as policy dictates. Reject inference of hidden claims through search counts, error differentiations or timing.

## E. Case lifecycle and human decision semantics

A durable MIZIZI case is a state machine, not a checklist in the UI:

`observed → classified → researching → evidence_ready → policy_evaluation → (held | source_disagreement | waiting_for_creator | awaiting_human | shadow_only | approved_plan) → freezing → applying → verifying → (verified | failed_safe | compensating) → finalizing → (resolved | no_change | published_private | published_public) → delivering → delivery_accepted/partial/rejected`.

- **Orthogonal axes**, not one ambiguous status: epistemic status (unknown/disputed/supported/settled), workflow status (queued/running/waiting/blocked/closed), mutation status (none/planned/executed/verified/compensating), publication status (private/pending/public/withdrawn), delivery status. Legacy `registry_review_items` status remains its own authoritative domain review state.
- Each transition has typed input schema, expected prior state/version, actor type, precondition fingerprint, capability policy, idempotency key, exact receipt, postcondition verifier, expiry, retry semantics and error category; optimistic compare-and-swap or transaction lock at final command boundary. Partial batch execution resumes by inspecting receipts.
- States with evidence ambiguity **never** promote a canonical fact by default. The human decision takes an explicit value and basis and can opt for defer/request evidence. Human batches are not pre-approved and must be scoped to recognized authorized roles; independent audit-sampling decisions must be blind where possible (avoid showing suggested answer first).
- A claim may be **held intentionally** with reason and revisit trigger. Reopened case creates new evidence/plan revision, preserving old conclusion and public history where publication permits.
- Guard rails for stale sources, missing provider licence, revoked creator permission, disputed identity, restricted geography, source drift, rights uncertainty, disconnected partner, failed verifier, unearned stewardship licence, and kill switch.
- Last-write-wins is forbidden for domain facts and human adjudications. Related case changes invalidate frozen plans and require refreeze.

## F. Research and inference pipeline (OpenAI as bounded analyst)

Adapter source inventory: approved Apple Music/Spotify provider adapters and shared provider-identity kernel, standards adapters (DDEX ERN where implemented), `provider_field_observations`, `registry_provider_sources`, external identifier assertions, contributor attestations, Institute/editorial material under permitted sharing scope, and approved web research. **No general scraping of copyrighted/private content beyond allowed access; no guessed provider secrets.**

Pipeline: `case claim/question → source eligibility/consent and rate budget → deterministic local evidence/identifier fetch → provider capability/schema validation → web search where allowed → immutable source observation or permitted reference → provenance/echo clustering → contradictions/temporal context → structured finding with source refs + uncertainty → deterministic rule/policy evaluator → human task or exact operation plan → existing grant/executor/verifier/finalizer`.

- OpenAI API is a **server-only** researcher and typed planner, not a principal permitted to issue DB grants. Tool calling uses fixed, versioned allowlisted read/research functions. Structured output is schema validated, limits applied, all URLs SSRF/redirect/DNS defended, prompt injections in provider/web content are treated as inert data. No unrestricted browser/SQL/network or hallucinated source citation.
- Record model/version, schema version, prompt template hash, tool/result IDs, token/cost budget, consent source and retrieval timestamps. Avoid storing private chain-of-thought and raw confidential sources in model traces. Never send partner or creator restricted data to model without agreed processing basis and minimization.
- Deterministic identity matching first (scoped identifiers, provider IDs, canonical historical lineage, disambiguating relationships), then similarity as candidate only; provenance independence discount echoes; model may propose questions, not assert rights or identities absent authority.
- Provider reliability by field, geography, catalogue provenance, time, format version; independent truth samples/calibration. Provider change triggers shadow-only circuit breaker and affected-case rescan, never silent batch repricing or authority expansion.
- Creator outreach only through authorized WAKILISHA/partner channels, opt-in/representation proof, frequency caps and disclosure; ask open-ended questions before showing suggestions when independent testimony matters. Allow corrections and withdrawals.

## G. Execution, security and failure-recovery plane

Use existing audited `registry_operation_types` and brokers. The orchestrator submits **typed intent**; policy interpreter decides risk/licence; preview freezes operation target set, approved evidence IDs, expected impact and State SHA; eligible human reviewer grants decision if necessary; executor issues short-lived exact grant, executes narrowly, writes `registry_mutation_operations` receipt and invokes independent verifier; finalizer resolves domain review only if all terms match. Exposed Admin RPC remains authenticated; MIZIZI worker never forges a user or piggybacks on a human SQL session.

Reuse `platform_private.jobs` lease/claim/complete/fail and `outbox_events` **only after** proving their current resource/command FK constraints support MIZIZI scope; if resource ID is editorial-bound, implement a **minimal typed adapter/compatibility migration**, not a duplicate queue. Worker process initially scheduled through proven GitHub/Edge/runtime contract; **no new always-on infrastructure** until runtime dependency/lease budgets demonstrate the need. Job retry categories: deterministic stale fingerprint (do not retry), absent human decision (wait), upstream throttling (backoff), transient network (bounded retry), verifier failure (quarantine/alert), partial delivery acknowledgement (resume unsent rows), incident hold (stop writes). Dead-letter cases visible in Brief; operator can inspect and resume safely.

Global Hold Writes checks: governor policy state + scope + enabled operation + grant validity inside executor; in-flight work finishes/rolls back by transaction semantics and must not accidentally resume after hold. Read-only research may continue if policy allows; queued deliveries have separate egress hold. Outage/circuit breaker means **freeze change, preserve evidence**.

All audits are correlated `case_id → evidence IDs → review decision → grant → operation/verifier → domain finalizer → publication revision → delivery attempts/acknowledgement`. Sensitive payloads are redacted in public logs; retention, partitioning, backups, compensating correction and incident process documented before rollout.

## H. Public, contributor and organizational APIs and disclosure

**API shape (contracts, not deployed routes):**
- Public: `GET /mizizi` (public Brief, never private tenant data), `GET /mizizi/cores/:coreId`, `GET /mizizi/field` (paged graph), `GET /mizizi/people/:personRef` (permitted core index), `GET /mizizi/receipts/:publicReceiptId` (redacted proof), `POST /mizizi/challenges` (rate-limited logged-intake, never direct correction).
- Authenticated creator: existing `/credits` + invites and claimed identity surfaces; `/mizizi/my-claims`, `/mizizi/challenges/:id`, `/mizizi/sharing` composed with existing attestation and permission RPCs.
- Authorized organization: `/mizizi/workspaces/:workspaceId` Brief/Field/Cores/Licences/Deliveries; strict membership/representation & information-flow enforcement, invitation management, connection setup and dry-run.
- WAKILISHA Headquarters: integrate protected Admin route `/admin/mizizi` with case details, evidence, review, policy/licence admin, hold incident control, connector health, deliveries, audit search and exception triage. Do not expose arbitrary SQL or raw grant minting.
- Backend: only exposed public read RPC/Edge façade per existing conventions, authenticated `SECURITY DEFINER` functions with fixed search path and explicit role checks, private deterministic worker broker for orchestration. JSON schemas contract-tested; cursor pagination and ETag/revision; no public private-table select and no bulk export of embargoed data.

**Disclosure matrix:**
- Public: approved value (or explicit withheld/unresolved status), evidence summaries/publisher-approved citations, counted-independent vs echo groups where safe, historical accepted revisions, public receipt ID and challenge link.
- Contributor: their own attestation, editable future permissions, invitation-response status, scoped evidence excerpts and reviews touching their claims.
- Organization: only its catalogues/agreements + deliverable permissions; cannot see other client sources/creator secrets. Public identity may be global while tenant provenance is private.
- WAKILISHA reviewers: full allowed case dossier; sensitive source documents via audited, time-limited access. Separation of reviewer and policy grant approver for elevated action.
- Worker/provider: minimal read by task, no arbitrary user-data search, secrets managed in existing platform secret authority.

Web publication requires a **separate approved disclosure decision**, evidence permission snapshot, cache purge/invalidation, safe SEO/canonical/JSON-LD and challenge/redaction behavior. Public Cores may show contested claims as contested without presenting them as accepted, and must distinguish confirmed recording contribution from claimed rights.

## I. Operational measures, failures and quality

Success is **correctly governed dispositions**, not artificially empty queue. Metrics by claim family and workspace: cases observed/classified/researched/reviewed/held/settled; verified operations; human time per accepted decision; reviewer recontact; idempotent retries; provider error cost and source coverage; shadow-audit accuracy with confidence intervals and false-merge severity; appeal/rollback rate; outbox delivery accepted/rejected; missing lineage; private leak tests; time to notice/hold incidents; grants-at-rest. Avoid ranking cultural traditions/places or people by an unsupported truth-score.

Risk tiers: T0 pure read/investigate; T1 deterministic audited no-identity read/projection; T2 narrowly scoped reversible metadata correction if licensed; T3 Track/Artist/Work identity, credited person, provenance publication or partner delivery (explicit human/typed authority as policy requires); T4 rights, contributor impersonation, contested ownership or irrecoverable merge (**human + separate legal/rights authority; no earned AI permission**). Admission policy versioned and tested; licence automation never bypasses T3/T4 human prohibitions.

Privacy/security: cross-tenant RLS, hidden-public inference, token exfiltration, external content prompt injection, compromised webhook, revocation races, TOCTOU between preview and apply, concurrent human decisions, provider downtime, accidental rights conflation, content removal, stale public cache, source licence expiry, backup restoration and key rotation. Incident drill verifies hold and recovery.

## J. What the user-supplied HTML establishes—and what it does not

**Preserve** the `MIZIZI by WAKILISHA™` identity, light "surface" over dark "soil", roots/horizon, geological Cores, five tabs, claims with independent/echo/contradictory layers, "Left alone" disposition, "Never Licensed", time-boxed human decisions, Hold Writes, sourced Ask, workspace switching, and correction Deliveries.

The HTML's Northline/Meridian/Kibo organizations, ~460 invented recordings, accuracy figures, source links, nightly counters, licence grants, prototype undo, export CSV, provider processing and animation are **simulation fixtures**. Do **not** treat them as Production authority, real measured accuracy, actual receipt-backed activity, live workspace tenancy, working source licences, external deliveries or a safe server-side kill switch.

Accessibility/UX additions: clear focus management, reduced motion, keyboard navigation, mobile accessible Field alternative, true loading/empty/error states, consistent WAKILISHA custom controls (avoid native browser chrome where branded controls apply), safe confirmation on irreversible changes, WCAG audits, localization, Source/Creator term clarity, typography/gamut/contrast checks against both light/dark palettes. User-facing copy must pass Language & Tone Bible.

## K. Architectural acceptance: ready to build, not built

Architecture approval requires: cross-stack change register with exact paths/migrations/contracts, tenancy/threat matrix, provenance and source-use policy, domain semantic test fixtures, capability matrix by existing vs missing, versioned API schema, narrow DDL sequencing, human-task/consent rules, external delivery contract, public projection privacy proofs, smoke/soak and incident drills, and minimal-grant lifecycle. Implementation remains **not started** by this document. No schema/Edge/frontend/GitHub workflow was changed here.
