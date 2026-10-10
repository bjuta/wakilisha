# MIZIZI Headquarters — Implementation Sequencing, Threat Proofs and Production Exit Contract V1

**Date:** 10 October 2026 | **Status:** Binding proposed engineering acceptance; documents only.  
**Architecture:** [system specification](mizizi-headquarters-product-architecture-v1-20261010.md)  
**Exact code register:** [file, schema and RPC targets](mizizi-headquarters-code-change-register-v1-20261010.md)  
**Target baseline:** `main@4381d6020b83e5b3b6781bb28003dee76618737d`; Production 216 migrations at `20261009181647`; open MIZIZI 149, recording reviews 92. Check current state anew at every promotion.

## 1. Architectural sequence: three serious delivery slices and one real exit gate

Do not create a PR-per-recording. Do not introduce a new framework to replace the accepted Registry. Do not ship a nominally "complete" headquarters whose cards are static fixtures or frontend status guesses. Engineering may split a slice into safe reviewable PRs grouped by schema/runtime/Edge/frontend **only** where the accepted deployment workflow requires separate promotion or a tightly bounded safety gate; the entire slice remains one coherent outcome.

### Slice 1 — Governance headquarters and durable case orchestration

**Objective:** one reusable case lifecycle for the existing WAKILISHA corpus, with operational controls and explicit decisions, backed by existing execution authority. No autonomous Production mutation is needed to accept this slice.

Required assets:
1. Accepted live-authority/privilege inventory of jobs, outbox, evidence, review, grant, source, actor, case and typed-operations schemas; machine-readable ownership/retirement map; canonical writer manifest exactness.
2. CLI-minted DB01–DB03 case/workspace extension and DB05 **minimal** hold/policy foundation, privilege and RLS verifiers. Existing WAKILISHA workspace must be a single seeded internal tenant; no external organizations admitted yet.
3. A shared pure `Finding → Core candidate → Case` adapter; provenance/source refs attach without duplication; durable idempotent case keys; queue stage events; case dependency DAG; plan snapshots with validity/fingerprint; no direct mutation authority.
4. Proven job/outbox bridge to `platform_private.jobs` with lease, retry and stage resume; operation receipt linking; request correlation; stuck state and dead-letter classification; per-scope backend Hold Writes with denied future admissions.
5. Genuine Headquarters Brief and Cores with actual current review cohort and per-case history, useful search, inspect/assign/hold/decide. The owner can view DESIRE, recorded human decision, open review and archived Artist alias blocker **in one place**; Ficha and Colors appear as finalized with exact receipts, not actionable.
6. A single task batch for human review with explicit answer and evidence freeze, not preapproved choices. Usability test against old #1094 three-page path; time-boxed workload selector and true Done for Now.
7. Operator audit export (authenticated and redacted), metrics compiled from real stage receipts and zero-authority readout from live kernel.

**Exit:** no custom #1094 URLs needed to understand/resume D1; repeated worker restart produces same case/event journal with no duplicate decision/operation; Hold Writes enforced in database/worker even with a stale browser; unmodified Ficha/Colors remain resolved; no Active grants; 100% reviewed migration and frontend gates.

### Slice 2 — Research, public Cores and creator participation

**Objective:** evidence-backed, public-safe provenance is useful even where MIZIZI deliberately does nothing.

Required assets:
1. DB04 research run/source lineage extension, provider contract inventory, OpenAI API server-side tool schemas/limits/privacy gate, scoped web/provider fetch, source retention and prompt-injection hardening.
2. Field-discriminating source strength: e.g., provider ID vs publisher feed vs witnessed studio evidence vs a creator response. Echo/derived-from links counted once, correlated org/person replies grouped; unknown independence remains unknown. Contradictions are shown as real opposing claims; no auto-resolution just because counts agree.
3. Structured claim dossiers, temporal scope, provenance of queries and decisions, "what would change this", explicit no-change/held/ask/contra reasons, alternative values, re-open triggers.
4. Real contributor evidence loop using existing `registry_contribution_attestations`, permission versions and `/credits` experiences. Invite/accept/decline/contest/restrict-publication paths; open answer prior to shown candidate when independent testimony is relevant. No cold unsolicited outreach.
5. DB06 read-safe public Core publications, Field projection, searchable/challengeable public receipts, scopes and redaction; public vs contributor vs org vs admin policy and source-use tests. All product pages require a published revision: never publish a raw private review case by default.
6. Ask MIZIZI must answer only from readable cited Core/source projections; explicit cannot-answer for rights, unpublished or unknown claims; no model-made canonical determination. Discovery/SEO/JSON-LD integration with source permitted and contested semantics.
7. Shadow and supervised `Licence` reporting backed by independent audited outcome samples, not the made-up accuracy curves of `mizizi.html`; public licence explanation clear that this is **governance permission, not music-rights licence**.

**Exit:** DESIRE dossier explains alias/credit mismatch and source provenance; at least one supported public settled Core, one contested, one intentional hold and one permission-withheld Core pass exact privacy/SEO/claim tests. Source data copy/echo does not inflate evidence. Public anonymous calls and search cannot infer private Workspace or creator evidence. No autonomous canonical mutation granted solely by an LLM.

### Slice 3 — Governed end-to-end operations, partner deliveries and reliability

**Objective:** the headquarters can coordinate a case from investigation to verified disposition/delivery without a custom deployed page per case.

Required assets:
1. Generic policy-driven planning for every **supported** family, limited to existing `registry_operation_types` and proof-backed broker RPCs. Each operation uses an exact frozen plan, typed target/row ceiling, independent verifier, decision grant where required, domain finalizer and journal correlation; separate public publication and outbound delivery grants.
2. DB09 DESIRE redundant archived alias Track-credit reconciliation **only if** existing verified operations cannot safely do it. This must be a reusable operation with no hardcoded D1 UUIDs, exact credit list and source Artist supersession. No second Artist merge or silent deletion of provider credited-as spelling.
3. Generic human tasks and the permissions to decide by role, including maker/counterparty confirmation, appeal, conflict challenge, policy governor approvals and separating reviewers from licence-authorizers. Bulk review may batch tasks but **each decision remains individually linked to authority and frozen evidence**.
4. DB07 partner connections, restricted catalogues, provider-source terms, outbound DDEX/export/changeset adapters only as contracted; per-recipient delivery and acknowledgements with partial recovery. External workspaces limited by tenant RLS and own-source/allowed-canonical graph; no implicit access to WAKILISHA's private evidence.
5. DB08 audited calibration and earned licence workflow with per-family cohorts, sample sizes, error severity, staleness/rollback and provider drift. Licence lapse and manual emergency hold tested under real execution races; Never Licensed policy paths cannot be overridden.
6. Production worker scheduling, alerting, bounded quotas, retry caps, operation and cost metering, dead-letter, backpressure, on-call/audit reporting, retention and incident drill. Separate model/provider/offline budgets; no stealth global web crawling.
7. Public/partner correction receipts with truthful status: queued, dispatched, acked, rejected, superseded; historic/audit chain preserved even when downstream provider declines. Refresh current WAKILISHA readers (Charts, Artist, Track, Release, Community, search) through existing projection machinery, not duplicated tables.

**Exit:** DESIRE end to end or remains accurately **blocked for an explicitly proven external/legal/authority reason**, with no hidden override; broad real cohort classified by family; representative operations executed/verified where justified; no re-approvals/replays; at least one real consented partner delivery ACK or correctly classified permission refusal; all grants return to zero at rest; Incident Hold drills pass.

## 2. Case families and acceptance fixtures

| Fixture / class | Minimum expected evidence and outcome | Negative / antifragile proof |
|---|---|---|
| DESIRE (#1094) | One approved survivor `afbe3f47-62af-4b68-8d54-527f04987ebe`, duplicate `f30846f0-8cf1-4df6-8875-38fa7a763e7b`, redundant `lilmaina` archived-Artist primary source credit, canonical `lil-maina` and Nikita Kering’ featured preserved, 17 Chart pointers, one provider link, SUMBUA Release membership, Community thread | No alias credit moves to survivor as second live primary; no rights invented; no lost credited-as; cross-case stale plan blocks |
| Ficha (#1094) | Existing exact human decision + verified duplicate operation + resolved review; survivor `80642d87-769c-4949-8ecd-b3b9f6835486`, 6 Chart rows, 1 provider, 1 primary | A retry never rearchives, moves rows again or reopens review |
| Colors (#1094) | Existing exact decision+operation+finalizer, survivor `bec6a6de-3001-44a7-8241-df1cd8b932ac`, 17 Chart pointers and one provider link (8 moved from source, 9 originally survivor) | Partial/out-of-order operation cannot lose Chart positions or duplicate Apple link; earlier data survives historical reads |
| Legitimate alternate recording | Real Live/Remix/Acoustic distinct evidence and versioning, two stable identities; no automatic merge | Title/Artist/ISRC similarity does not collapse genuinely distinct audio |
| Same-named people | Person identity requires direct provenance and disambiguating evidence; may remain two people | Never Licensed rule denies name-only merge even at high AI confidence |
| Claimed collaborator credit | Creator or representative attestation with method/prompt provenance, permission and independent validation | Showing candidate first does not masquerade as unaided independent evidence |
| Disputed producer credit | Distributor versus studio/creator evidence retained concurrently; no fact published as settled | Three copies of same feed do not count as three independent sources |
| Writer/Work attribution | Work vs Track roles and ISWC/ISRC remain distinct; raw "Traditional" is not accepted writer identity | Rights/ownership never inferred from producer/writer/performer credit |
| Missing provider ID | Discovery can propose candidate, freeze at identity/admission policy, reject unsupported identifier | Provider API outage/reformatted response cannot create a new canonical ID |
| Public Core publication | Accepted safe sources/citations and history published only with permission revision | Withdraw permission invalidates caches, files, partner outputs per contractual limits; no data through counts |
| Partner export | Explicit recipient permissions, schema format, idempotent ACK and withheld elements | Retry/timeout doesn't double-send, wrong tenant data denied, rejected rows remain visible |
| Human review | Explicit decision, who/when/evidence snapshot, bounded time box and skip | Default action cannot silently approve; concurrent reviewers race and second CAS is refused |
| Earned licence | Truly audited labelled sample across cohorts, lower reliability bound, allowed blast radius | Drift/breach expires licence immediately; Never Licensed still denied |
| Hold all writes | Server transaction checks global/workspace/operation hold, active execution window | Queued or delayed worker cannot bypass hold; research may continue as allowed |
| Identity history | Retired source ID retains successor lineage, old permalink policy and event history | No physical deletion of historically referenced Track/Artist/source evidence |

The accepted test corpus is not merely "three tracks": add 30–50 varied **de-identified/synthetic** provider/creator/tenant fixtures plus read-only actual anonymized/authorized cases per family; retain all historical #1094 exact receipts. The 149 open snapshot must first be classified, not treated as 149 automatic mutations. Correctly unresolved cases count as governed outcomes.

## 3. Versioned release gates (every runtime-bearing change)

1. **Authority audit:** fetch exact latest protected main; inspect live migration ledger and function ACL; identify remaining debt and old/active scopes. Diff existing operation inventory, privileged writers, provider adapters and RLS. Record current counts and expected blast radius.
2. **Migration design:** use Supabase CLI minted files; explicit schema/table/function ownership; no chained raw private DML. Retained source and migration SHA proof. Add permanent SQL verifier and negative security contracts first.
3. **Isolated Preview parity:** exact migration baseline, replay from canonical source, generated types diff, constraints/RLS grants, reusable operation preview/verifier, source and cross-stack fixtures, assert no untrusted actor can bypass a contract. Verify preview Edge secrets and upstream connectivity separately.
4. **Backend/Edge runtime:** preflight actual Edge dependency graph and secrets presence parity (never print values); test browser-shaped CORS/proxy and OAuth/vendor tokens, allowlist/SSRF, provider outage/rate limits; staged deployment only after SQL proof.
5. **Frontend:** build + critical browser tests + WAKILISHA custom chrome/route splitting + public metadata/SEO/responsive audit and iOS/small mobile accessibility; test authenticated vs public vs creator vs partner real browser.
6. **Protected repo:** PR only after local/Preview evidence; files/permissions bounded; critical CI and required domain control planes green; guarded head-SHA merge with exact main; no auto-merge inference. Docs-only PR may merge without Production deploy if CI green.
7. **Production SQL:** after merge, separate approved migration promotion and independent read-only verifier, zero active grants and exact ledger head; no data mutation piggybacked in migration.
8. **Production Edge:** separately deploy changed Edge function(s), exact merged source, secret names/proxy/CORS/role preflight and direct + routed smoke. No unrelated functions.
9. **Production frontend:** separately deploy exact merged SPA with canonical Lightsail runner, checksums local/stage/live, rollback snapshot, nginx/HTTPS and real-browser acceptance. No "PR merged = live".
10. **Cohort execution:** reviewed policy window, exact frozen targets, recorded human decisions where needed, operation grant and verifier, domain finalizer, source/recipient publication checks, no standing authority after every burst. Read-only SQL checks independent of worker success.
11. **Exit:** evidence-backed sign-off from actual Production, update issues/docs, no retries of already-completed operations, incidents/held cases logged, next slice open only after full gates.

## 4. Always-on security and privacy threat test matrix

Each test must run against exact auth role and tenant scope, not just mocked UI:

| Attack/failure | Denial proof |
|---|---|
| Anonymous fetch private source/attestation | RLS/view allowlist denies; public response no source ID, existence signal or confidential count |
| Partner A requests Partner B case or delivery by ID | Membership + source permissions deny, same safe error envelope/timing class |
| Creator withdraws public display after publication | New permission revision makes public Core/SEO/search cache stop displaying withdrawn content; historical internal provenance retained under legal policy |
| Attacker prompts model to call write/grant/HTTP internal host | Tool allowlist has no write and URL policy blocks private/metadata addresses and redirect hop |
| Duplicate provider feeds counted independently | Lineage clustering combines same upstream origin; unknown means unknown |
| Model claims rights based on performing | Rights classification rejects unsupported inference regardless of confidence |
| Reviewer preselected "approve" without choice | Explicit decision field/input required; default absent; no receipt created by simply opening card |
| Two users apply conflicting decisions concurrently | CAS/version check, one successful receipt, other stale denied |
| Worker retry after DB transaction succeeded but HTTP timed out | Receipt/idempotency lookup returns original operation; no repeated DML |
| Grant expires between preview and execution | Executor refuses; no partial canonical change |
| Kill switch engaged during queued execution | Backend denies queued new mutations/egress; in-flight transaction follows documented semantics |
| Provider/LLM unavailable mid case | Durable case held/retry without inventing evidence or resetting human state |
| Evidence source publicly suppressed by licence/embargo | Public Core group/counters computed on cleared entries, not side-channel leak |
| Competing creators disagree | Case remains disputed; no majority-vote identity resolution |
| Delivery receiver sends partial ACK then times out | Acknowledged rows remain recorded; only unacked rows retried |
| External API redirection changed by attacker | DNS/pinned allowlist and SSRF defense; no internal egress |
| Malicious uploaded/cited file | Content treated as data; size/MIME/malware checks; no execution, no privileged document prompt |
| CI green but Production secrets absent | Runtime parity fails before fixture/data and before deployment |
| Critical core hits transient linked CLI auth | Classify transport with evidence, selective bounded retry **only**, no code/authority workaround |
| Immutable event edit/retarget | Trigger/test rejects change and logs incident |
| License revoked between check and grant issue | Atomic current policy/hold/operation validation denies |
| Admin session lacks correct review capability | Server-side role check denies, even if browser renders a button |
| SEO/publisher exposes unreviewed rights claim | Schema.org JSON-LD and public page exclude claim or explicitly label as disputed per safe publishing contract |
| Cost/resource exhaustion | Per-tenant rate/cost/row ceilings and backpressure, no unbounded model or provider searches |
| Backup restore causes stale projection | Reconstruct from immutable receipts and replay checkpoints, detect divergence before write resumes |

## 5. Nonfunctional service-level thresholds: initial engineering targets, not proven measurements

Proposed targets to validate on realistic corpus and adjust with Product/SRE approval: 99.9% of admitted internal command attempts return a durable stage receipt; **zero** undetected duplicate canonical mutations in deterministic fault injection; zero unauthorised private evidence disclosures; zero standing execution grants after run; zero illegal rights inference; 100% of mutation operations have independent verifier and finalizer relationship. P95 Headquarters Brief read under 2 seconds on measured representative connection with warm cache, Core page under 2 seconds, accessible Field/list first useful interaction under 3 seconds; typical research job follows provider availability/cost budget, **not** a hard promise of model accuracy or latency. Every missed objective results in an incident/hold or an explicitly scheduled correction rather than changing numbers on the dashboard.

Resource quotas start conservative, per claim family/workspace: max read depth, graph page size, model tokens/steps, external requests, sources per Core, job attempts, execution rows, outgoing delivery batches. Load-testing covers multi-tenant isolation and large catalogues, not just 149 currently open cases.

## 6. Public/provenance release-specific acceptance

- Public Core shows accepted/disputed/held meaning and the independent/echo source structure, without exposing private evidence even via query/filter cardinality. "What would change this" derives from saved claim rule and sourced evidence, not a hallucinated freeform explanation.
- "Left alone on purpose" includes recorded reason, version, next revisit evidence trigger and visible history. A deliberate hold never impersonates acceptance or lack of monitoring.
- A public assertion of a creator's role requires eligible source-use/licence, claim publication and permission where relevant; **public data is not simply the Admin dossier with a field removed**.
- Public user can lodge a structured challenge and get a case reference; private claimant identity and evidence not broadcast. Accepted challenge follows evidence/review pipeline, no instant edit.
- Group/person graph distinguishes person identity, stage persona, collective membership, direct recording participation and historical collaboration.
- Cores and Field have accessible non-canvas alternative. Contrast/motion and color-blind tests, reduced-motion via CSS and animation loop suppression. Mobile/desktop independent checks and clean focus control.
- Rights/legal: the word "Licence" is explained as MIZIZI operational permission wherever copyright licences are also in scope. No inaccurate copyright ownership claims.
- Search, SEO, metadata, sitemap, Article/Track/Artist/Person projection invalidation and cache keys match actual published revision; no unreviewed disclosure by pre-render fallback or stale CDN.
- Public claim and receipt endpoints have rate limits, anti-scraping/personal-data protections and revision/citation identifiers stable across reasonable UI redesigns.

## 7. Partner/organization exit-specific acceptance

- Onboarding dry run with no writes; explicitly scoped workspace memberships; no duplicated canonical Registry.
- Contract/source licence check per provider, per field and per destination. Creator permission and org permission **both** required when appropriate; neither overrides the other.
- Secure connection credential rotation and revocation without revealing secrets to operator UI, logs or OpenAI.
- A consented test partner receives a real versioned correction file/API payload, validates signature/receipt, ACKs per row and can report rejection. Duplicate delivery attempted under retry results in no duplicate accepted changes.
- Two partner workspaces with partially overlapping canonical Tracks cannot see each other's private source packets or private decisions.
- Versioned standards adapter DDEX ERN (where actually available), CSV/API contract tests for character encodings/artist credited-as spelling, ID mapping, corrections/withdrawal, regional terms and schema validation.
- Third-party delivery cannot claim deletion of recipient's old dataset; follow-up compensation or supersession recorded.

## 8. Licences and autonomy graduation gates

A **claim family** can progress `research-only → shadow-evaluated → supervised → eligible-earned` only when:
- source/evidence schema is stable and verified across represented catalogue/source cohorts;
- independent adjudications represent errors, hard negatives and geographic/provider strata; sample size and uncertainty bounds recorded;
- false-merge, wrong-attribution and private-data leakage risks assessed, worst-case blast radius within ceiling;
- a typed operation and independent verifier already exist and are effective for that exact scope;
- a different authorized governor signs the licence, ruleset version frozen, duration/capacity bounded;
- model/API/provider drift monitor and automatic lapse hold are tested;
- emergency hold proven on same operation class, never just frontend disabled state.

T4/`Never Licensed` inferences cannot earn automatic final adjudication regardless of published hit rate. An "Earned" badge is an operational status backed by verifiable metrics, not marketing text. Earned licences should be measurable against regular blind spot-check decisions, retractions, disputes and independent incident review.

## 9. Production work-queue operational exit

1. Enumerate the exact live open `registry_review_items` census by rule and authority, partition into case classes and linked duplicate reviews without creating duplicate cross-domain work.
2. Create one stable MIZIZI case per eligible claim, preserving existing decision/review/operation receipts. Identify already-finalized records before any worker trigger. DESIRE, Ficha, Colors must all appear as truthful history.
3. First run **read-only research and dry-run plans**, with independent scrutiny of ambiguous identities, source licensing, unknown data and missing operation family. No blanket queue approval.
4. Human tasks contain only judgments no machine can make, evidence context and resulting impact. Review batches are time-budgeted, skip-safe and resume automatically after authorized decision.
5. Execute selected deterministic operations through exact grants/verifiers and only authorized policy windows; record clean downstream pointers and finalizers.
6. Report disposition per case: `resolved`, `no_change`, `awaiting_creator`, `disputed`, `held_for_evidence`, `not_supported`, `policy_prohibited`, `failed_safe`, `delivery_pending`, `delivered/acknowledged`. A queue with legitimately pending cases **can pass** if every case is truthful and actionable.
7. Re-run read-only invariants and public/regional projections. Assert zero at-rest actor grants, exact grants and enabled emergency windows, no lost Chart/Community/provider/Release/credit pointers, safe creator disclosures.
8. Publish a transparent per-class evidence report with the number of non-terminal cases and why; record cost/latency and incident notes. Issue closure follows its own scoped exit criteria, not merely a decreasing queue count.

## 10. Must-not-do list

- No case-specific Admin components, hardcoded DESIRE UUIDs in general engines, or fresh code deployment per standard decision.
- No autonomous human impersonation, no "I clicked" claims or GitHub issue comment as a database decision.
- No fabricated/animated results, sample organization as real partner or prototype numeric accuracy as a policy licence.
- No grant widening through service_role, long-lived PostgreSQL access or trigger-only hold control without backend enforcement.
- No source-copied-as-independent source counting or AI-generated source citations without actually observed references.
- No identity/rights attribution from names, embeddings, common ISRC or majority votes alone.
- No private creator testimony by default in public metadata/sitemap/LLM.
- No new duplicate Registry tables, generic music-entity god table, MIZIZI-only second execution journal or second publisher-owned canonical system.
- No migration bundled with Edge/frontend changes for convenience, no guessed secret/config and no broad Production replay.
- No close of DESIRE/#1094 merely because two other cases resolved; issue scope and remaining 39-slug programme gates stay separately authoritative.
- No sweeping public external services launch before partner legal/source terms, consent and privacy are reviewed.

## 11. Handoff into implementation

This documentation pass is complete when three architecture files are on protected main, **docs-only diff confirmed**, CI green/accepted, no SQL/Edge/frontend changes, and the repository holds an exact next-slice opener. The first implementation job is **not** to invent the entire architecture anew: start Slice 1 by refreshing the authority inventory from live Production, freezing DB01/02 columns/constraints/FKs/privileges against actual shared job/outbox and existing Organization model, then implement only the durable MIZIZI case/decision/hold contract and its verifiers. Do not schedule other slices until their predecessors meet acceptance. The owner does not need a Mac for this documentation-only PR.

**Required developer deliverable at each future slice:** exact base SHA; changed-file list and ownership; migration type/name and SHA; Preview proof; independent SQL verifier; critical/browser CI; merge SHA; separate Production SQL/Edge/frontend receipt as applicable; live postconditions; outstanding unresolved cases; next executable issue. The product must reduce operator effort rather than outsource engineering work to the owner.
