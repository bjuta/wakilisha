# WAKILISHA 100: Four-Phase Delivery and Final Admin Handoff

**Status:** controlling delivery plan, not implementation acceptance or permission to deploy or publish.  
**Date:** 2 November 2026 (EAT).  
**Delivery issue:** [#1338](https://github.com/bjuta/wakilisha/issues/1338).  
**Source and editorial authority:** [#1264](https://github.com/bjuta/wakilisha/issues/1264).  
**Accepted code baseline:** [PR #1333](https://github.com/bjuta/wakilisha/pull/1333), merged as `561a323503a21184a36c8e5453c0024d329b8abc`.

## 1. Product Contract

Deliver **one** Admin-operated, multi-source weekly WAKILISHA 100 chart of music consumption and discovery in Kenya. The complete path is:

**Qualified source -> automatic original-evidence collection -> recording deduplication -> MIZIZI and Registry reconciliation -> full eligibility evaluation -> human metadata correction and deterministic re-evaluation -> reproducible private Top 100 -> independent editorial approval -> explicit per-week publication.**

The Admin is an editor and decision-maker, not a weekly downloader, file uploader, developer, or database operator. Regular weeks must work without GitHub, SQL, Supabase Dashboard, CLI, secrets changes, code patches, or engineer-authored source files.

These are **four acceptance phases inside one existing delivery issue**, not four products, new tracking issues, or automatic permission to add permanent CI tests. Parallelize independently testable work when safe, while retaining the exit gates and final handoff.

**No surprise flagship:** collection, scoring, CI, merge, deployment, staging, and green health checks never authorize public release. A first public WAKILISHA 100 Edition needs a separate, explicit founder launch instruction. Later Editions still need an authorized, auditable Admin decision for their exact frozen EAT week. Do not implement automatic public publication.

## Workbook Design-to-Engineering Authority

**Binding interpretation, 2 November 2026:** the founder's final `Charts Ingest Workbook.html.zip` is the detailed **Admin UI and UX specification**, and this four-phase plan is the **engineering, integration, and acceptance programme for that same product**. They are not parallel workstreams or alternative designs. The existing WAKILISHA architecture provides the implementation substrate and its actual data, permission, Registry, and publication authority. The final workbook fingerprints, exclusions, and page mapping are recorded in [#1338](https://github.com/bjuta/wakilisha/issues/1338#issuecomment-6583961265). This section makes their relationship binding across all four phases.

### Authority and fidelity

1. **Workbook specifies what the operator sees and does.** Preserve its component geometry, shapes, spatial hierarchy, proportions, spacing, border treatments, density, tables, navigation, controls, drawers, dialogs, state transitions, and interaction semantics. Do not reduce it to loose visual inspiration or replace distinctive layouts with convenient generic cards. Study the **actual final ZIP and its HTML/CSS/JS interactions**, not a reconstructed screenshot or an obsolete earlier workbook. If the exact source artifact is unavailable, record the fidelity check as *unproven*, not passed.
2. **Four-phase plan specifies how to make those interactions real.** Every action requires genuine server authority, correct source/Registry/methodology lineage, durable state, safe permissions, and appropriate failure and recovery behavior. Simulated prototype success never counts as operational acceptance. A pixel-matched screen with an inert, invented, or unsafe backend is incomplete; a green backend that abandons the approved interface is equally incomplete.
3. **WAKILISHA supplies the native implementation.** Translate the workbook into our React/TypeScript application, existing Admin shell, shared font family, semantic token system, and parent light/dark themes. Do **not** ship, import, embed, refer to from application code, or depend on the workbook HTML, support scripts, runtime, assets, fonts, or prototype component library. This is a faithful **port**, not an iframe, copy/paste runtime, or wholesale redesign. WAKILISHA is not dark-first.
4. **Componentize once for the wider product.** Before each screen, audit existing WAKILISHA primitives and extend them where appropriate. Promote repeatable workbook structures and behaviors to small reusable WAKILISHA primitives, then compose pages from those primitives. Preserve domain distinctions: shared data table/inspector/decision patterns can be reused while source admission, recording identity, eligibility, and publication stay governed by their own authorities. Avoid duplicate libraries, premature universal abstractions, and separate handcrafted copies on every page.
5. **Source truth outranks example values.** Workbook example providers, names, Edition IDs, ranks, methodology weights, actors, timestamps, badges, and publication-ready flags are illustrative until independently verified by the real system. Never render mock values as live facts or invent backend endpoints and capability contracts to make the design appear functional. If a designed action lacks an accepted implementation, show a truthful unavailable/blocked state with the missing contract identified.

### Workbook screen ownership across engineering phases

| Engineering delivery | Workbook surfaces to faithfully translate | Operational ownership and exit evidence |
| --- | --- | --- |
| **Phase 1: Collect** | W1 Weekly Overview; W2 Source Registry; W2A Add Source; W3 Collection and Incidents; shared W0 interaction foundations | Qualified source research and governed configuration, automated original-byte collection, accurate provider-native periods and metrics, source health, safe incidents/retries, and accelerated verification of two successive logical EAT-week cycles. The UI cannot fabricate admission, metrics, or collection. |
| **Phase 2: Identify and Qualify** | W4 chart-facing Recording Review; W5 Eligibility Workbench; W5C Correction Editor; W6 Re-evaluation | Existing Registry/MIZIZI reconciliation, real applicable full-filter matrix, all-candidate review and evidence-backed corrections, concurrency-safe impact preview, deterministic re-evaluation without re-fetching original source evidence. |
| **Phase 3: Rank and Publish** | W7 Methodology; W8 Ranking; W8S Score Explanation; W8B Incomplete Ranking; W9 Readiness Inspection; W9B Stale Evidence; W10 Stage/Publish; W10C Confirmation; W10O Outcomes; W11 Edition History | Reviewed versioned methodology, reproducible private Top 100, genuine source/identity/policy lineage, server-authorized readiness, staging and explicit week-specific publication, correction/withdrawal. Reconcile existing backend editorial sign-off semantics with the founder's rejected fictional handoff chain without weakening real authorization. |
| **Phase 4: Acceptance and Handoff** | W12 Operational Audit and Recovery, plus all prior pages and interactions | Complete responsive/theme/keyboard/security acceptance; two accelerated end-to-end logical weekly cycles, isolation/cleanup proof, controlled deployment, private/public separation, real Admin runbook, founder acceptance. This phase verifies polish and capability implemented throughout earlier phases; it does not postpone mobile or dark-mode implementation until the end. |

**Navigation remains a five-stage Admin experience:** **Collect -> Identify -> Qualify -> Rank -> Publish**. The four numbered engineering phases are delivery gates, not replacement navigation tabs. The shared week, evidence revision, blocked status, safe next action, and return path must remain coherent between pages.

### Founder exclusions and governing safety

- **Exclude W1S entirely.** Retain the principal W1 Weekly Overview. Do not create a replacement weekly-review screen.
- **Reject workbook-invented role-holder approval chains.** No fictional preparer/Reviewer B/publisher relay or arbitrary sign-off. W9 is actionable evidence and readiness inspection. Actual capability checks, audited decisions, server-side constraints, integrity verification, stale-revision rejection, and deliberate publication remain mandatory. Phase 3 must consciously reconcile the pre-existing publisher's independent editorial approval contract with the founder's simpler Admin flow; merely hiding buttons is not an implementation.
- **Reject the workbook's MIZIZI product design.** Preserve appropriate W4 chart-side candidate inspection and return flows, but use existing governed MIZIZI and canonical Registry paths for identity and origin. A suggested match or metadata assertion never becomes a silent canonical write.
- **No surprise flagship.** No collection, CI, private ranking, stage, merge, deployment, or passing screenshot ever authorizes the inaugural public Edition. First launch requires separate explicit founder instruction, and subsequent weeks require a valid exact-Edition publish action.
- **Correct evidence, not history.** Preserve immutable original provider evidence, original native metrics/periods, source identity and audit trails. Run-level corrections, canonical Registry revisions, and methodology/policy changes are distinct.

### Definition of a finished workbook port, per screen and phase

A page is not accepted until all of these have evidence:

1. **Design:** comparison against the exact final workbook of its layout, shapes, density, interactions and significant normal, loading, empty, partial, blocked, denied, conflict, and failure states. Note each authorized departure and why.
2. **Native reuse:** inspect the shared library, reuse or add fit-for-purpose WAKILISHA primitives, with no shipped prototype references/dependencies and no duplicate component implementation.
3. **Theme and responsive:** existing font/tokens; proper light and dark modes; approximately 1440, 1024, 768, and 390 px behaviors; mobile interaction, keyboard focus, and accessible dialogs.
4. **Authority:** identify real data sources, actor capability checks, command/server validation, safe error result, persistence, audit write, freshness/revision handling, downstream invalidation, and recovery path for every consequential action. No pretend action is enabled.
5. **Verification:** focused existing contracts, appropriate genuine-browser or isolated-runtime tests, source/evidence checks where relevant, CI consolidation review, and the phase's published exit gates. Synthetic UI tests prove interaction behavior only, not live source collection or Production acceptance.

**Acceptance is conjunctive:** workbook fidelity **and** native reusable WAKILISHA implementation **and** genuine governed product behavior **and** phase-specific operational proof. Neither a screenshot nor green CI alone satisfies all four.

### Current implementation baseline and immediate next sequence

- [PR #1340](https://github.com/bjuta/wakilisha/pull/1340) extended the existing candidate collector with bound Apple catalog chart parsing and transport guards; it did **not** admit or activate a source.
- [PR #1341](https://github.com/bjuta/wakilisha/pull/1341) merged the Phase 1 native W1/W2/W2A/W3 interface foundation and shared operations primitives. Its source-health backend is read-only and not deployed to Production. Its Add Source review does **not** persist a source. Its isolated browser tests do **not** establish pixel-perfect all-state acceptance or genuine collection.
- **Continue Phase 1 inside #1338, not a new phase issue:** inspect existing immutable candidate-capture schema and publisher/Registry authority; implement approved durable Admin source enrollment/configuration as a *separately governed* authority rather than editing historical receipts; connect it to the existing bounded service collector; add approved scheduling/health/retry contracts; qualify actual Kenya provider methods and native periods; and prove two consecutive EAT-week-equivalent cycles through the real scheduler and collector code under an isolated injected clock, corroborated by independent current-clock PostgreSQL/Storage acceptance and a real approved-source original-byte acquisition sample, without waiting fourteen calendar days. Keep Production and publication activation held until their separate gates are satisfied.

No section here creates publication permission, source-method admission, deployment authorization, or an exemption from any earlier gate.

## 2. Audited Starting Point (not release authority)

On 2 November 2026, current merged `main` and independent read-only Production checks established:

- Production `pgzizndxdyhqmtyywjmt` held **236 migrations**. The three forward WK100 migrations `20261102084046`, `20261102084049`, `20261102084052` had not been applied. Recheck exact live state before any deployment.
- Legacy ingest had **21 runs, 10,216 raw observations**, and predominantly Spotify/Apple playlist sources. These are historical, **not** a current qualified WK100 observation period.
- Existing Registry Artists and Tracks and the MIZIZI chart broker provide real reuse value. They are not permission to mint canonical identities from uncertain provider rows.
- `chart-ingest-api`, `chart-provider-fetch`, and `wk-chart-capture` have been deployed; WK100 capture contracts, capture attempts, captured rank rows, and weekly freezes were **zero**.
- The guarded WK100 publisher SQL exists in Production, including source admission, replay attestation, independent editorial approval, staging, publication and identity-link controls. The associated private ledgers were **all empty**. Deployed SQL does not prove a working Admin publication path.
- WK100 had **zero Editions and zero published entries**.
- WK100 generic dry-run and publish actions are intentionally blocked in the old Ingest UI. The frozen full-filter stage is review-only and does not authorize scoring. The current preview displays only 20 flagged rows.
- Eligibility profile, market scope and methodology definitions have browser-local persistence in the legacy path. A shared, reviewed server-side version must become authoritative for WK100.
- The existing `origin_iso2` queue and reset of downstream eligibility/scoring stages are the pattern to generalize, not rebuild.
- Critical merged-main checks were green at this accepted SHA. That is not end-to-end source, operator, or Production acceptance.

**Never promote historical documentation or a passing isolated test to current Production authority.**

## 3. Authority and Reuse Map

| Boundary | Reuse | Do not create or bypass |
| --- | --- | --- |
| Original source collection | `wk-chart-capture`, private Storage, capture receipts, EAT kernel and existing parsers | A second collector or source evidence ledger |
| Provider enrichment | Existing Apple/Spotify discovery and metadata logic where current access is verified | Assumed public playlist availability or obsolete API guarantees |
| Recording identity | Legacy candidate normalization, MIZIZI-governed Registry Artist, Track, credit and origin operations | Automatic recording merge from similar title/lead Artist |
| Eligibility | Frozen policy snapshot, full-filter evaluator and review-only stage | Another partial filter engine, or invented claims of 104 executed rules |
| Corrections | Artist-origin review/reset, audit events, governed Registry broker | Destructive provider-evidence edits or silent published-Edition reset |
| Ranking | WK100 private evidence and replay kernel | Generic playlist occurrence counts treated as comparable weekly streams |
| Publication | Installed WK100 governed admission, attestation, approval, staging and publish RPCs | Direct V2 writes, service-key exposure, or generic `publishImmediately:true` |
| Admin experience | Existing Charts Ingest, Review, No Match, Artist Resolution and Editions surfaces | Fragmented developer-dependent steps for a normal week |

The binding cultural model is **assertion -> evidence -> review / reconciliation -> canonical fact**. Editorial decisions are not Registry facts, and a Kenya chart appearance does not imply an Artist's `origin_iso2`.

## Phase 1. Multi-Source Collection and Automated Research

**Research is not waiting for collector admission.** Public chart observation, first-party publicly offered exports, and WAKILISHA's researcher-directed analysis are valid ongoing research activities under the existing [Independent Research and Source Qualification](wakilisha-100-independent-research-source-qualification-v1.md) contract. Do not equate them with prohibited scraping merely because an internal tool helps. Do not demand speculative source partnerships or signed licences as a prerequisite to observe and record openly reported chart facts. Address actual restrictions on a precise access method when demonstrated. A separate unattended service has runtime, provenance, privacy and publication controls, but those are not barriers to factual research. See the [current first-party research checkpoint](wakilisha-100-source-access-admission-register-v1.md).

**Goal:** qualified, replayable Kenyan music evidence is captured every week without ordinary manual downloads/uploads.

**Work:**

1. Implement one durable **Admin-managed Source Registry**, covering provider, exact Kenya surface and ID, operator identity, method, permitted access evidence, metric class, native period, rank depth, parser revision, credential reference, EAT cadence, refresh budget, and qualification/health status.
2. Investigate and qualify **YouTube, Spotify, Boomplay, Apple Music, Mdundo, and Shazam**, plus representative optional services including Audiomack and genuine airplay where demonstrably useful. Each named core provider must have an independently verified usable method or a documented unqualified state. Provider count does not equal chart credibility.
3. Extend `wk-chart-capture` and current native parsers/adapters. Prefer provider API, offered export fetched on the server, or separately qualified public-page observation method. A playlist listing is not a stream count; a YouTube playlist is not the weekly YouTube chart metric; Shazam recognition/discovery is not audio streaming. Reverify actual Spotify endpoint/access behavior. Public-fact research does **not** automatically require a negotiated partnership, but unattended collection must respect the verified source-specific method and concrete restrictions.
4. Record original private bytes, SHA-256, provider response, observed timestamp, native reporting period, territory, rank/count meaning, provenance and attempt identity. Do not manufacture a native week from the capture time.
5. Schedule collection, detect corrupt/schema-drifted payloads, quarantine bad sources, expose source health, and support bounded idempotent retry. The ordinary Admin never downloads and uploads CSVs. Manual original-byte upload is an exceptional, validated recovery route.

**Phase 1 exit, all required:**

- [ ] Six named core platforms explicitly assessed; YouTube and Spotify actively addressed, not dropped for convenience.
- [ ] Founder-approved qualified source constitution supports credible Kenyan consumption/discovery coverage with a real, reproducible observation sample.
- [ ] Two successive **logical** EAT weeks exercise the real scheduler and collector orchestration, slot rules, distinct simulated private-byte storage/readback, immutable fixture receipts, failures, retries, pause/revocation, and nonpublication under a controlled clock **without touching a hosted database**. Independently prove the production PostgreSQL/Storage receipt/lease/role boundaries in the unlinked disposable stack at the database's actual time. Correlate both proofs; never claim the database itself ran two simulated weeks.
- [ ] At least one source genuinely qualified under a founder-approved constitution is acquired by the real service from the approved provider endpoint at real wall-clock time. Its original bytes, SHA-256, market/source identity, honest native metric and independently supported native period (or explicit blocked unknown) survive private readback; the Admin can inspect and recover. This live acquisition cannot be replaced by a fixture or a historical soak.
- [ ] Malformed, missing, duplicate, unauthorized or stale source evidence is held or quarantined, and retry cannot fabricate an independent observation.
- [ ] Collection alone cannot publish, score unapproved evidence, or mutate Registry facts.

**Output:** private, versioned source evidence and explicit gaps for identity review.

### Phase 1 accelerated two-cycle acceptance (founder revision, 3 November 2026)

The requirement for **two elapsed calendar weeks is removed as a Phase 1 release gate**. Waiting for a fourteen-day soak is disproportionate after the long-standing earlier soak and does not increase the evidence produced by a deterministic, isolated two-cycle test. This revision changes the duration of the proof, **not** the truth standard for live provider observations.

1. **Two real software cycles without real calendar delay.** Advance an injected **application test clock** through two adjacent Monday–Sunday EAT week identities in the existing scheduler/collector code with fixture-backed provider responses and isolated storage/ledger adapters. Verify due slots, weekly rollover, distinct original bytes/digests, idempotence, wrong-period quarantine, pause/role revocation and zero score/publish. **Separately** run the unmodified PostgreSQL reservation/receipt, private Storage, signed GoTrue and concurrent lease checks in the existing unlinked disposable full stack at actual database time. This is a paired boundary proof, not a claim that the real database executed two fabricated calendar weeks. The Production RPC `wk_chart_runtime_reserve_v1` intentionally enforces PostgreSQL `now()` and a 20-minute acquisition window; **never introduce a synthetic-clock bypass into deployable SQL**. Fixture receipts remain explicitly synthetic. Do not enable mock clocks in hosted Preview or Production, or label fixtures as observed Kenyan charts.
2. **Immediate research now; separate real service evidence.** Continue first-party public-chart research and researcher-directed offered exports immediately, without a speculative provider-partnership or licence precondition. Record observed source, time, provider-declared metric, rank, and any uncertainty honestly. For the separate runtime acceptance, use one reviewed exact source route through the existing governed service at a valid EAT slot, with credentials only when needed and concrete method restrictions respected. Verify its original bytes and SHA-256 against private Storage and the immutable receipt. A source-native period must come from provider evidence; an unknown period remains explicitly unknown and cannot become weekly scoring authority. A successful parser or historical soak is not a newly acquired service receipt. No collector or publisher is enabled simply to satisfy a test.
3. **Pass/fail boundary.** Phase 1 can close when both independent gates above and all other Phase 1 requirements pass: the six named provider evaluations, a credible founder-approved Kenya source constitution, live original-byte provenance, Admin-owned automatic operation, and deliberate fail-closed nonpublication. **No two-week wall-clock wait**. The first live slot and the two isolated logical weeks must not be presented as the same kind of evidence. If no real source method qualifies, Phase 1 remains open for that substantive reason, not because a clock has not elapsed.
4. **Longer observation is optional operational monitoring, not a hidden precondition** to Phase 1 or the later final handoff. Historical soak data remain historical. Any future real multiweek reliability study must be separately named, assessed for cost, and justified by a concrete risk; it cannot silently reinstate the fourteen-day gate.


## Phase 2. MIZIZI, Registry, Full Eligibility and Admin Corrections

**Goal:** identify real recordings, resolve false filter flags, and safely recompute affected results.

**Work:**

1. Converge existing Ingest, No Match, Artist Resolution, Review Queue and MIZIZI workflows into one searchable **Filter Review and Correction Workbench**. Use verified ISRC/provider links and governed canonical recording identity. Similar titles are match candidates, not authority to merge originals, remixes, acoustic, live, re-recorded or remastered versions.
2. Inventory the **approximately 104 founder-referenced filters** against real profiles and executable predicates. The count is an estimate, not a verified exact contract. Map every applicable filter to field, evidence, disposition, correction or policy authority, dependencies, and regression acceptance.
3. Evaluate each predicate as `ELIGIBLE`, `EXCLUDED`, `REVIEW_REQUIRED`, or `CONFLICTED` with reason codes. No incomplete rule silently passes. Replace the review-only downstream hold **only after** independent source period, Registry completeness, authorization and full-filter enforcement pass.
4. Support Admin corrections to factual metadata including Artist attribution, primary/featured credits, version/remix flags, release dates/types, genres, languages, explicit metadata, ISRC/provider IDs, and `origin_iso2`. Keep factual correction separate from an audited exclusion and from a proposed **week-wide policy revision**.
5. Preserve original provider values, evidence, proposer, reviewer, reason, old/new value, policy digest and timestamp. MIZIZI may suggest evidence; it must not self-approve or overwrite canonical Registry values. Use governed Artist/Track/credit/origin authority, retaining accepted facts for subsequent weeks.
6. Implement **Apply Corrections and Re-evaluate**, with version/digest conflict checks and before/after impact preview. Invalidate affected filter, score, shortlist, review and approval states. Recompute from existing original observations **without refetching or uploading**. Preserve manual exclusions and audit history. Committed/published Editions use a separately governed revision, not a destructive reset.
7. Give the Admin a complete searchable/paginated queue, batch review with justified shared values, and explainable stale/conflicting edit rejection.

**Phase 2 exit, all required:**

- [ ] All applicable filters have explicit executed outcomes, evidence and correct/review/exclude/policy-revision dispositions. No arbitrary first-20 review limit.
- [ ] Realistic cases for false remix labels, Artist misattribution, credits, missing/conflicted `origin_iso2`, recording versions, release/explicit fields, language/genre, provider collisions and unknown evidence produce correct outcomes.
- [ ] Single and batch correction/re-evaluation are deterministic, idempotent, audit-preserving, and never duplicate source evidence or canonical Registry entities.
- [ ] Denied roles, stale versions, simultaneous Admin corrections, and interrupted updates fail safely.
- [ ] Independent scoring/publication blocks remain in effect until proven cleared.

**Output:** source-bound, correctly reconciled or explicitly provisional candidates with audited eligibility decisions.

## Phase 3. Reproducible Ranking, Editorial Governance and Publisher

**Goal:** generate a defensible private Top 100 and connect it to the existing protected publisher.

**Work:**

1. Converge WK100 private ranking and eligibility decisions with the accepted Phase 1 source constitution and Phase 2 identity. Keep native source metrics and periods distinct. Avoid counting duplicate same-operator observations as independent corroboration.
2. Make methodology, eligibility profile, source weights and market scope **server-side reviewed, versioned and immutable once frozen for an Edition**, not browser-local authority. Preserve input, method and source digests, coverage, uncertainty, ranking score contributions and rejected candidates.
3. Compute a reproducible private Top 100. If fewer than 100 qualified entries have sufficient evidence, block staging; never pad with invented candidates. Provisional observations cannot create fictitious multi-source identity corroboration.
4. Reuse the installed WK100 governed SQL publisher. Complete trusted server-side raw-byte replay, source admission, signed-in role checking, attestation, independent editorial approval and private staging from the Admin UI. Do not build a second publisher.
5. Implement the explicit progression: **Draft -> Evidence Verified -> Identity and Eligibility Reviewed -> Private Ranked Candidate -> Independent Approval -> Private Staged -> Explicit Publish**. Changing accepted source evidence, methodology or identity invalidates stale approvals.
6. Support Admin-owned idempotent publication, revision, correction and withdrawal with immutable history, current database role checks, exact-week/digest binding and existing legacy programme guards intact.

**Phase 3 exit, all required:**

- [ ] Same sealed evidence and methodology replay to the same exact private ranking and explanation.
- [ ] A genuine-source-lineage private candidate of exactly 100 is independently verifiable; unresolved evidence does not receive fictional measurements.
- [ ] Independent approval and private staging operate through the existing authority. Revoked users, forged approvals, changed scores, stale digests and second conflicting publications are denied.
- [ ] Publish, correction and withdrawal contracts pass in an isolated environment. **Do not publish an actual flagship Edition as a test.**
- [ ] Automatic collection, private ranking and deployment cannot publish by themselves.

**Output:** complete Admin-operated private Edition lifecycle, ready for full operational acceptance.

## Phase 4. Accelerated Two-Cycle Acceptance, Controlled Production Deployment and Handoff

**Goal:** demonstrate ordinary weekly operation without engineers, deploy the accepted integrated product once, and stop implementation.

**Work:**

1. Verify **two consecutive logical EAT-week cycles** across the real application scheduler/collector and week-dependent workflows under an isolated injected clock, then independently exercise protected PostgreSQL, GoTrue, Storage and browser paths at the unlinked database's actual time. Prove the correlation of these tests in one acceptance run instead of waiting fourteen days; do not weaken the deployable SQL reservation clock or call synthetic weeks live provider observations. Exercise valid and missing sources, malformed payloads, retries, duplicate and remix conflicts, missing Artist origin, correction, policy change, re-evaluation, independent editorial approval, rejected roles and default-no-publication.
2. Separately prove genuine current-source qualification and evidence. Synthetic two-week rehearsal proves workflow mechanics, not Kenyan consumption facts.
3. Consolidate existing critical/domain/SQL/real-browser tests. No automatic extra permanent suite or new milestone scaffolding. Verify real fixture lifecycle: tracked IDs, always-run teardown, stopped-container and volume absence, independently verified zero residue, including interrupted paths. **Never create disposable test Admins or immutable test receipts in accepted Preview/Production.** The founder is never a cleanup mechanism.
4. Audit exact merged-main migrations and generated filenames, SQL postflight, source-method admission, secrets/role/CORS/runtime dependencies, real browser acceptance, CI, and production regression risk. Every new dependency must be proven rather than guessed.
5. Only after complete green acceptance and **separate founder deployment approval**, promote exact-main Production SQL via the repository workflow, deploy only required JWT-gated Edge functions, build and activate the merged-main frontend, then execute nonpublishing smoke/canary checks. Keep collector and research intake OFF until separately authorized. Confirm all public WK100 editions remain absent after deployment.
6. Deliver the role-specific Admin runbook: source configuration/health, Monday week, MIZIZI match and credits, origin corrections, all filters, re-evaluation, private ranking, editorial approval, intentional publishing, safe revision/withdrawal and recovery. Verify operator permissions and one normal next-week walkthrough without code, SQL, CLI, GitHub or provider downloads.
7. On founder acceptance, **handoff is final and engineering stops for ordinary weekly editions**. A provider's genuinely breaking external change is a distinct maintenance authorization, not a reason to rebuild weekly.

**Phase 4 exit, all required:**

- [ ] Two successive accelerated logical weekly cycles, all correction/approval/error paths, and independent automatic fixture cleanup pass, without requiring two weeks of elapsed wall-clock time.
- [ ] Genuine evidence/qualification and frozen ranking are verified separately from synthetic tests.
- [ ] Exact-head CI, SQL/Edge/frontend deployment controls, real-client and publisher denial/rollback checks pass.
- [ ] Production canary proves **zero unauthorized public WK100 Editions**, preserved unrelated programmes and no unwanted data mutations.
- [ ] An authorized Admin runs the next week completely through Admin, with no developer actions.
- [ ] Founder accepts the working operational walkthrough and runbook, with deployment and handoff receipts in #1338.

### Phase 1 candidate checkpoint — versioned Admin source proposals (2 November 2026)

The Phase 1 branch proposes a **source configuration proposal** foundation, not source
qualification, method admission, collection, or a completed Source Registry.
`supabase/migrations/20261102191805_wk100_source_proposals_v1.sql` was minted by the
accepted CLI and is a separate append-only, capability-gated proposal ledger.
Each provider may have multiple separately identified source surfaces, each with
an independent audit/revision counter and fail-closed optimistic concurrency.
The original immutable capture contracts, capture scheduler, and Edition publisher
are unchanged. Proposal saves never set `canCollect`, `canScore`, or `canPublish`.

**Local candidate evidence:** eight domain contracts, six Chromium source-workspace
tests, native Vite build, and real isolated PostgreSQL 17 append/role/immutability,
per-source concurrency, same-provider identity, rollback, and revocation checks
passed. These are not hosted-production or provider-source qualification proofs.
The existing WK100 disposable CI harness is extended in place to prove full
migration-chain replay, read-only SQL authority, genuine signed-in GoTrue JWT,
multiple-source revision semantics, revocation with the same JWT, and complete
fixture/volume destruction. No separate CI workflow, duplicate migration, or new
test suite is introduced. These CI proofs are **pending until recorded on the
exact PR head**; this paragraph is not a claim that CI has run.

**Remaining gates:** native Edge deployed to a migration-equivalent, secret-inventoried
isolated target and tested with an actual authorized browser/client, source-method
qualification and credentials governance, scheduler integration with accepted
capture receipts, accelerated dual-week acceptance with separate genuine live original-byte proof, and separate founder authorization for any
Production promotion or public flagship publication. This branch must not be
interpreted as Phase 1 exit or permission to activate collection.

## 4. Cardinal Cross-Phase Rules

1. **One owner per authority:** extend existing capture, Registry, filter, ranking, and publisher systems. No competing implementation.
2. **Truthful measurements:** playlist appearance is not stream count; Shazam discovery is not streaming; provider-native periods cannot be invented; Kenya observation does not establish Artist `origin_iso2`.
3. **Evidence survives correction:** never rewrite provider originals; separate facts, policy choices, editorial exceptions, canonical identity and published revision.
4. **Security survives convenience:** use caller-scoped JWT/role authority, RLS and private source/score provenance; MIZIZI suggestions are not autonomous canonical writes.
5. **No fixtures left behind:** use isolated local integration stack and independent automated whole-lifecycle teardown; no manual founder cleanup.
6. **No false PASS:** native/static, local integration, real browser, hosted ingress, Production SQL and genuine source evidence prove different gates.
7. **No accidental flagship:** the inaugural public Edition requires explicit separate founder authorization after deployment; every later Edition needs its exact-week governed Admin publish action.
8. **No phase or CI sprawl:** retain unique protective tests, retire redundant assertions, and track one implementation delivery under #1338.
9. **No routine engineering after handoff:** source roster and ordinary eligibility/editorial choices live in Admin. Unexpected provider breakage must quarantine safely.

## 5. Release Decision Register

| Decision | Authority as of this plan |
| --- | --- |
| Write implementation code | Begin only upon a new implementation instruction after this plan is accepted |
| Add Producer / Source contracts in Production | Not authorized by this document |
| Apply the three pending WK100 Production migrations | Not authorized |
| Activate WK100 unattended capture or research intake | Not authorized |
| Publish the first public WAKILISHA 100 Edition | Not authorized; requires separate founder launch instruction |
| Run a final Production deployment | Only after the four phase gates pass and founder approves |
| Publish normal later weekly Editions | Separate authorized Admin action against each frozen and approved week |

## 6. Referenced Contracts

- [Final implementation issue #1338](https://github.com/bjuta/wakilisha/issues/1338), [source and editorial programme #1264](https://github.com/bjuta/wakilisha/issues/1264), and [merged foundation #1333](https://github.com/bjuta/wakilisha/pull/1333).
- [Integrated capture runtime](wakilisha-100-integrated-capture-runtime-v1.md), [independent research/source qualification](wakilisha-100-independent-research-source-qualification-v1.md), [source admission register](wakilisha-100-source-access-admission-register-v1.md), and [weekly evidence kernel](wakilisha-100-weekly-evidence-kernel-v1.md).
- [Private ranking](wakilisha-100-private-ranking-preview-v1.md), [governed Edition publisher](wk100-governed-edition-publication-contract-v1.md), [MIZIZI chart materialization closure](mizizi-slice2-chart-materialization-production-closure.md), and [Artist-origin authority](mizizi-slice2-chart-origin-and-artist-creation-design.md).
- Binding WAKILISHA Project language/tone, cultural operating doctrine, collaboration, and deployment workflow documents. Exact current deployed state takes precedence over stale historical checkpoints.

**Final definition of done:** WAKILISHA collects qualified Kenya-source evidence automatically, reconciles recordings through MIZIZI, lets Admin correct every correctable filter fact and re-evaluate without recollection, privately ranks truthfully, and publishes only through explicit human authority. Two-week operational proof, one controlled Production deployment, and founder-accepted Admin handoff close implementation.
