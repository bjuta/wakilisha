# MIZIZI canonical product, documentation reconciliation and Phase 1 authority
Date: 24 October 2026  
Status: owner-directed four-phase product programme. **Phase 1 reconciliation started; its acceptance is not complete.**  
Repository starting authority: protected `main@50bc5810add1d2f4e0e4c7cc109ee1af010fee40`. All counts and deployed observations below are **as observed** on 24 October, not permanent assertions.

## Decision and scope

MIZIZI is WAKILISHA's evidence-governed cultural intelligence and stewardship system, designed to be customer-portable under distinct legal, cultural, privacy and execution authorities. It is not a second Registry, an auto-approving chatbot, or an Admin review queue with a different skin. WAKILISHA remains the first operating environment. The existence of major labels, contractors, distributors, customers, contracts, source permissions, throughput or performance in HTML demonstrations is not evidence that those exist in Production.

The owner's newly provided **MIZIZI Design System v3** and unpacked workbook specify **M1–M13** for MIZIZI. This extends the older repository v3 document's **M1–M8** inventory. The latest owner-reviewed MIZIZI UI/UX governs the experience; shared Workbook v4 and its 22 October adoption boundary govern the joint design language; the accepted Registry, runtime, privacy, cultural and deployment contracts govern claims, permissions, operations and release. Do not import source HTML or fictitious examples into React or SQL. **Exclude the unrelated Distribution, payout and ingestion business screens** carried in the combined HTML.

Latest provided reference-file fingerprints, recorded for provenance (these *attachments are not yet stored byte-exactly in this repository*): `MIZIZI Design System v3.html` SHA-256 `8db1bf05bd6e24c2eff86ec4de5a5db7ef9e16420e67104fca8400a4d659f748`; `mizizi-workbook-unpacked-template.html` SHA-256 `bedd2ba31c8178438f1c16f541c0c70a6d200ec65cc04519cf141d9f490505b3`. These are **different source versions** from the earlier three October 17 `.dc.html` SHA-256 values preserved in `docs/design-system/wakilisha-workbook-v4-replacement-authority-20261017.md`. Do not silently replace or pretend the existing `.dc.html` files prove byte parity against the newer attachments. Obtain a reviewed, MIZIZI-only exact reference snapshot before claiming pixel-accurate final acceptance; until then the screen contract below is the authoritative interpretation.

## Product contract: five coupled operating loops

1. **Discovery**: lawful, cursor-based source and Registry observations; type each claim, scope, permitted use, time and original context.
2. **World memory**: keep separate Artist, Person, Recording, Release, Work, Contribution, Relationship, Rights Claim and Event identities; record source family, dependencies, contradictions, temporal context, alternative explanations, rejected hypotheses and explicit unknowns.
3. **Adaptive investigation**: investigate genuinely unfamiliar claims with permitted source reads, preserved uncertainty, bounded leased jobs, pause/reopen decisions and trusted source verification. Models cannot mint Registry grants or invent licence consent.
4. **Human judgment and independent learning**: freeze question/evidence revisions, consider genuinely distinct explanations, record independent assessment and conflicts, evaluate later outcomes against blinded adjudication and prospective holdouts, and keep adverse-error, drift and appeals evidence. Prior automatic predictions cannot judge themselves.
5. **Governed action and feedback**: reviewed decision is NOT permission to execute. Any Registry change requires the existing typed operation, exact grant, DB05 Hold enforcement, independent verifier and immutable receipt; delivery and downstream acknowledgement require separately authorized contracts. Valid conclusions include no change, unknown, contested, needs evidence or policy-prohibited.

The five evidence standings **Established, Supported, Unresolved, Contested, Unknown** are not case lifecycle, review status, grant state, workflow execution, or rights ownership. No score or green UI indicator substitutes for evidence authority.

## Live environment and release reconciliation, 24 October 2026

| Authority | Verified state | Boundary |
| --- | --- | --- |
| GitHub `main` | `50bc5810add1d2f4e0e4c7cc109ee1af010fee40`; Workbook v4 shared PR #1246 **merged**, protected UI rollout has separate accepted production release receipts | Main's source has the existing MIZIZI Admin/Registry panels, not integrated M1–M13 v4 |
| Production Supabase `pgzizndxdyhqmtyywjmt` | **234** applied migrations, head `20261020072800`; **16** `mizizi_private` tables; 1 case, 2 events, 1 observation, 1 workspace, 1 membership, 1 receipt link, 0 Holds | Production case is in Research with epistemic state unknown, no proved new final adjudication or learning |
| Hosted Supabase Preview `nkgfoppunmnkcumalxqp` | **237** applied migrations, head `20261017212255`; **19** `mizizi_private` tables; 1 case, 1 event, 2 research passes, 0 observations, 0 frozen question versions, 0 source-attestation events, 1 Hold (recorded released), 1 workspace/member/receipt link | Historical isolated runtime, not a fresh clone or exact-current migration superset of Production |
| Preview Edge | Deployed `mizizi-research-runner` v23 with JWT verification in prior accepted read-only inventory | A deployed worker and stored passes do not prove an autonomous source research service or verified adaptive learning |
| Draft source dependencies | #1243 research → #1248 QV1 → #1249 source review preflight → #1250 governed freeze → #1251 QV3 correspondence; #1244 UI draft | Not merged/Production authorized. QV3 is human correspondence metadata, **not** independent source-family or ACH grade authority |
| Historical Registry #1094 | DESIRE blocked; Ficha and Colors original reviewed repairs verified | Do not replay old operations or backdate their receipts |
| Enterprise | Internal one-workspace proofs; no contracted customer, independently accepted cross-customer delivery, model-autonomy credential or million-scale benchmark | C17 genuine two-workspace and H37 queued canonical writer under Hold remain explicit unresolved Slice 3 tests |

### Completed Phase 1 nonmutating migration version-set comparison

Live read-only SQL compared the **entire shared version prefix** in both databases: exactly **231 entries** through `20261015091718`, with matching ordered-version MD5 `40d4cdaf839f0940b121c587fad96a2f`. These are ledger-version identities only, not a guarantee of row/data/runtime parity.

| Only on Production (merged main) | Only on Preview (unmerged MIZIZI stack) |
| --- | --- |
| `20261019152307_wk_chart_observation_receipts_v1` | `20261016064245_mizizi_research_pass_memory_v1` |
| `20261019203244_wk_chart_private_raw_evidence_v1` | `20261016092731_mizizi_external_wikidata_research_intake_v1` |
| `20261020072800_wk_chart_capture_runtime_v1` | `20261016114918_mizizi_research_job_retry_budget_v1` |
| | `20261017185928_mizizi_question_assessment_authority_v1` |
| | `20261017202800_mizizi_governed_question_freeze_v1` |
| | `20261017212255_mizizi_source_family_attestation_v1` |

All three Production-only migrations are present in merged `main` source/proof tree; all six Preview-only migrations are **absent from merged `main`**. This proves a **branched migration history**, not a three-version lead. **Version-set diff: PASS; forward-safe replay, schema/type parity, security and secrets/HTTP equivalence: NOT RUN**. Before Phase 2 promotion, review and preserve the existing draft migration lineage, prove all nine changes commute or need reviewed reordering, run clean disposable native replay from current main, produce authentic schema seals, verify exact auth/RLS/DB05 and runtime dependencies, and then authorize only the necessary non-destructive Preview update. No reset, retroactive migration renaming, historical replay, Production SQL or new paid branch is approved by this inventory.

## MIZIZI UI and UX screen contract (owner's M1–M13)

| Screen | Product action and UI contract | Proven reuse | Missing / gated |
| --- | --- | --- | --- |
| **M1 Workbench** | Case-first paper shell, 248px open rail, 64px case toolbar, 44px targets, 34px case title, genuine 5:8 artefacts, four recorded summary cells, evidence-backed question rows and honest standing | Existing durable cases, Holds, journal, review inventory | No authentic persisted Preview question/source-grade data; do not show fabricated weighted ACH |
| **M2 Review** | One frozen question/revision at a time; distinct options, provenance/independence, harm and reversibility, defer/skip separate from a durable decision | Existing admin human Registry decisions, DB02 transitions and DB05 hold | True one-question reviewed assessment snapshot, independent reviewer and nonexecuting decision receipt |
| **M3 Orion** | Actual typed identity/review-credit graph, filter/search, pan/zoom, inspected provenance, keyboard/list parity; credit link never implies rights | `MiziziReviewField`, `miziziCaseField`, graph primitives | Better typed edge semantics and epistemic/workflow separation |
| **M4 Evidence** | Evidence inspector with Summary/Raw/Custody, original-language excerpt, consent, provenance, source-family dependence, independent grades | Registry evidence assertions, evidence workbench, QV3 draft | Accepted source attestation and grading ledger with durable custody/withdrawal |
| **M5 Outcomes** | Verified changes, no-change, reopen conditions, challenged decisions, versions and prospectively measured calibration | Case event/operation receipts, redacted audit | Blinded adjudication, actual method-version comparison, delivery/ACK evidence |
| **M6 Field phone** | Offline-first field collection with consent, exact custody, resumable transfer and no phantom upload success | Existing WAKILISHA media/upload primitives | Field workflow and offline/custody proof |
| **M7 Contributions phone** | Person/group/estate contribution capacity, statement, authorization, withdrawal and case-specific questions | Existing creator claims/attestations and permission versions | Scoped MIZIZI contributor flows |
| **M8 Record phone** | Dark-first bilingual approved public source record and challenge path | Public Registry provenance and editorial/media | Redacted, human-published revisions and original source disclosures |
| **M9 Field desktop** | Field queue, custodian checks, sync status, inspect/recover captures | Shared UI/files | Real supervised and device-to-desktop integration |
| **M10 Contributions desktop** | Authorized self/group/estate workspace, mandates, case requests and lawful disclosures | Existing claimant/artist authority | Capacity-specific dashboard and revocation |
| **M11 Record desktop** | Artefact-led historical/public narrative, source trace, standing explanation and revision history | Registry/public pages | True public-safe projection and publication/withdrawal |
| **M12 Reviewer profile** | Real method scope, reviewer authority, recusal/conflict, assignments and independently measured calibration | Existing signed-in roles/capabilities | Tested real conflict policy and reviewer outcome measurements |
| **M13 Settings** | Workspace and Field settings, languages, privacy, lockable review-method controls | Shared app settings and roles | Real MIZIZI authority-backed preferences and disabled states |

**Naming correction:** `Orion` is graph exploration; `Field` is real-world/offline evidence collection. The existing `MiziziReviewField` code is Orion-class functionality; do not retain a second Field meaning. Workbench should open the focused Review in context rather than navigating to an unrelated Admin subapplication. Status and standing must be visually and semantically distinct.

Design: Figtree human copy; IBM Plex Mono **only** exact technical values; green `#85C441`, legible paper green `#4E7425`, pale tint `#EDF5E3`; paper `#FCFCFB` for HQ/Field/Contributions, WAKILISHA dark `#0B0B0B` for public Record; genuine tokens, accessible custom controls, no decorative evidence colour. WAKILISHA Language and Tone Bible governs every surfaced label. The workbook mock phrase implying approved review "runs unless held" **does not override** typed grant, independent verification and exact mutation windows.

## Phase 1 implementation inventory: preserve / refactor / retire / build

| Current code / domain | Decision | Phase 1 work or next operational owner |
| --- | --- | --- |
| `src/pages/admin/review/mizizi/page.tsx` + `mizizi-html.css` | **Refactor** | Integrate shared Workbook foundation and new case-first routing; remove historical review-first composition after verified replacement |
| `MiziziDurableCasesPanel.tsx`, `src/services/miziziDurableCases.ts` | **Preserve backend; refactor presentation** | Keep genuine DB02/DB05 RPC, roles, stale CAS, holds and audit |
| `MiziziHeadquartersBrief.tsx`, `src/services/miziziHeadquartersBrief.ts` | **Retain as triage/intake, not top-level case truth** | Registry review count is not durable-case count |
| `MiziziReviewField.tsx`, `src/services/miziziCaseField.ts` | **Refactor to Orion** | Preserve exact-ID graph, gestures and list fallback; retest associations vs rights |
| `MiziziEvidenceWorkbench.tsx` | **Extend** | Source-grade/consent/custody must be authoritative, not computed client-side |
| `MiziziReviewRoots.tsx`, `src/services/miziziReviewRoots.ts` | **Preserve as recorded categorization, contextualize** | Never conflate rooted visual grouping with causal lineage or execution |
| `issue1094.tsx`, `issue1094RepairGate.tsx`, `issue1094Finalize.tsx`, `miziziIssue1094Brief.ts` | **Retire UI after safe migration; preserve receipts/tests** | Move to general case/operation viewers only after D1/D2/D3 exact parity |
| `src/services/miziziRedactedAudit.ts` | **Preserve** | Scoped immutable redacted export, no source/tenant leaks |
| `scripts/registry/agents/mizizi/core.ts`, `benchmark.ts`, `run.ts` | **Preserve governed analytic foundations; correct autonomy semantics** | Fixture benchmark is not earned Production autonomy |
| `scripts/registry/agents/mizizi/runtime/*` | **Preserve existing case/job authority** | No second queue, universal executor or extra model stack |
| `src/components/design-system/primitives/*`, fonts/tokens/navigation from merged #1246 | **Reuse** | One design system; no parallel `--mz-*` skin |
| Draft #1243, #1248–#1251 | **Rebase/reconcile before promotion** | Security, source rights, frozen questions, independent grades and signed-in proofs |
| Draft #1244 | **Refactor/rebase, not abandon** | Source-backed v3 screen behavior and genuine Preview browser QA |
| Field capture, real ACH grade ledger, reviewer recusal, publication, tenancy, deliveries | **Build where absent** | Separate typed ownership and acceptance in Phases 2/3 |

`main` inventory at the audited ref: 10 Headquarters UI files, 7 MIZIZI service files, 16 agent/runtime files, 30 MIZIZI-named migrations and 22 MIZIZI Registry test files. Draft branch contents must not be represented as merged `main` or deployed Production code.

## Phase 1 source comparison: real MIZIZI UI drift

Read-only inspection compared actual `main` and the source in draft `ui/mizizi-orion-workbench-20261017` (PR #1244, head `8e7fe6bb883564b68311814abb222bd0b0ac706f`). These are source-level findings; no real signed-in visual parity has been inferred.

| Observed current code | Phase 1 decision |
| --- | --- |
| `main` uses `WkTabs` with `Field` as a graph tab; draft #1244 renames the graph tab `Orion`, and adds a separate **disabled** Field capture tab | Preserve Orion rename, preserve truthful disabled Field capture until M6/M9 backend and custody exist, eliminate duplicate top-button/tab after real navigation acceptance |
| Draft page still composes historical Registry review list, `MiziziHeadquartersBrief` and `WkSplitWorkspace` under a horizontal tab bar | Not final v3 248px rail / 64px case-toolbar M1. Design and navigation need a deliberate layout refactor, not another layer on the old review page |
| `main` `mizizi-html.css` uses `Figtree` fallbacks; draft CSS still contains `Inter` fallbacks in the MIZIZI workspace and wordmark | Rebase draft on merged WAKILISHA Workbook fonts/tokens; retire legacy Inter fallback rather than relying on incidental global CSS |
| `main` CSS `.mz-rootband` uses a brand/info/warning decorative linear gradient; draft retains the same pattern | Do not use semantic evidence/status colours decoratively. Review for replacement after reference screenshot comparison |
| The real route/component home is `src/pages/admin/review/mizizi/page.tsx` | Preserve real route and deep-link/permission contract until any intentional router change is separately accepted; file-path routing assumptions are stale |
| `MiziziReviewField` graph has exact-ID Registry links, gestures and accessible review list | Reuse within Orion, keep the credit-not-rights disclaimer, and separate review status from five evidence standings |

**Disposition:** source mismatch inventory captured, not fixed or accepted as a visual release. Actual build/browser validation, exact layout and responsive comparisons remain an open Phase 1 gate. Any corrective MIZIZI frontend work should rebase/integrate the existing #1244 branch and existing protected browser checks, never a parallel fake-data UI.

## Four phases, and what constitutes closure

### Phase 1: source/design and environment convergence

- Reconcile **all docs by authority class** using the [documentation authority index](./mizizi-documentation-authority-index-20261024.md), preserving dated historical evidence.
- Confirm latest owner's **M1–M13** screen and exclusion contract, compare actual shared fonts/components/geometry/route ownership, and publish component- and capability-level preserve/refactor/retire/build matrix.
- Preserve the **completed exact version-set diff** above and independently verify migration dependency/replay compatibility, types, permissions, and runtime secrets without mutating either environment. Determine safe onward Preview acceptance environment and exact draft-PR lineage.
- Use existing protected CI/design screenshots for meaningful acceptance; no new permanent CI workflows or gratuitous Phase-1-only test suites.
- **Exit** only after exact source snapshot/interpretation, UI/UX mapping at 390/480/768/1024/1280/1440, route/permission inventory, non-destructive migration reconciliation, and approved clean implementation gate. **As of this document, these exits remain OPEN.**

### Phase 2: Headquarters M1–M5 and authentic intelligence

Complete case-first UI, lawful unfamiliar-source investigation, question/hypothesis ledger, reviewed sources and independent ACH assessment, frozen one-question decision, Orion, Outcomes and calibration. Reuse the existing safe writer and worker. **Exit:** real authenticated case from lawful original evidence to independent adjudication and verified outcome/no-change with stale, nonmember, revoked, held and unknown negatives; real responsive visual acceptance; exact-head CI and separately approved runtime release.

### Phase 3: Field/Contributions/Record M6–M13 and organization boundaries

Complete recoverable offline custody, representation/consent and original-language contribution, bilingual redacted public Record, reviewer recusal and Settings, and genuinely isolated organizational requests/changesets/delivery/ACK. **Exit:** end-to-end source/consent/identity proof, lawful publication and withdrawal, genuine two-workspace isolation and user-facing device/a11y acceptance. No fictional commercial relationships.

### Phase 4: integrated Production acceptance and closure

Accept Field → contribution → governed investigation → reviewed action/no-change → public disclosure/outcome; independently verify privacy, performance, queues, cost, failures, releases and rollback, at exact merged source. Retire only verifiably superseded code/branches and update issues/receipts. **Exit:** Production actually verified on live user journeys, not source green, mock screenshots or Preview-only SQL.

**Four delivery goals, not four automatically new branches or dozens of micro-phases.** Existing #1243–#1251 and #1244 remain owned workstreams. Source-ready, merged, Preview applied, Production applied, frontend deployed, signed-in accepted and Phase closed are separate truth claims.

## Phase 1 execution receipt and outstanding actions

On 24 October 2026 the following **read-only** Phase 1 steps were performed:
- Exact GitHub `main` tree enumerated: **878 files under `docs/`, 345 Markdown/MDX/TXT files**, including 60 MIZIZI-named prose files and 497 immutable replay-proof/replay-baseline entries. Existing repo code ownership inventoried as above.
- Current PR states verified: #1246 merged; #1243, #1244 and #1248–#1251 draft/unmerged. The existing shared four-phase programme is retained and corrected, not multiplied.
- Both Supabase environments read without writes. Counts and migration heads are recorded in the live authority table above. The exact migration version-set diff **was completed read-only**; forward-native replay, schema/type and runtime secret parity, and authenticated UI browser acceptance are **not performed** by this docs pass.
- New owner-provided source SHA fingerprints and M1–M13 contract recorded without copying Distribution into product scope.
- No SQL, Edge, JIT toggle, Registry, Production frontend, preview reset, historical replay or admin privilege change.

**Open Phase 1 gates:** (1) exact current uploaded MIZIZI-only design snapshot stored and reviewed; (2) live route/device design comparison (not authenticated in this docs-only pass); (3) forward-safe native replay, type, runtime-secret and auth parity after the completed version-set diff; (4) reviewed decision on stale legacy UI/components; (5) protected CI of the actual code release before implementation claim. These must be completed within Phase 1, not silently waived or deferred to Phase 4.
