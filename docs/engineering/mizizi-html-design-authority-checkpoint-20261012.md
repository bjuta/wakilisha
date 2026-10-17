# MIZIZI Headquarters HTML design authority checkpoint

> **Read first:** the 17 October 2026 Product v4 section at the end of this file is the current design authority. Earlier sections are dated history. Where an earlier sentence conflicts with v4, it is marked *[superseded 17 Oct]* and the v4 rule applies.

## Current Product Boundary: 15 October 2026

The original `mizizi.html` and 12 October screenshots remain **visual/interaction design evidence**, never enterprise account contracts, customer throughput, active licences, or completed external deliveries. The intended buyers now expressly include the three global majors and downstream labels, publishers, distributors, and other authorized catalogue operators. This does not establish a customer relationship or authorize cross-tenant access. See [enterprise product and current release authority](mizizi-enterprise-product-and-release-authority-20261015.md).

The live-design requirement remains **one evidence-backed Brief/Field/Cores/History/decision experience** *[names superseded 17 Oct: see the v4 naming map]*, not five independent backends. Current implementation includes genuine sourced review UI plus private case/hold operator controls on draft PR #1227; its newer source HEAD `733b8452` passed pre-doc protected CI. The new generic experience still needs deployed authenticated D1 blocked/D2-D3 completed evidence and final mobile/desktop acceptance. Preserve all 12 October owner screenshot decisions below as dated observations, not a substitute for Production acceptance.



Source: user-provided `mizizi.html`, SHA256 `ce05b3eb86b3e650292f8f1d3a1e2640e6f76a9f64da972fde9981bdb28035f3`, received 12 October 2026.

## Binding product-design direction

Preserve the source HTML's spatial and interaction principles, not its literal palette. The shipped WAKILISHA colour, typography, spacing and focus primitives take priority. *[superseded 17 Oct for MIZIZI routes only: v4 `--mz-*` tokens apply inside the route scope]* `src/pages/admin/review/mizizi/mizizi-html.css` is now a route-scoped layout adapter using existing `--wk-*` tokens, not the original broad HTML element resets. The supplied HTML is a design reference, not authority for facts, rights or writes.

This checkpoint ports the authenticated admin shell, real-queue Brief, and the Field's connected Canvas representation of authorized MIZIZI review and artist-credit IDs. The Brief root graphic must be a traceable classification graph, not a decorative status-driven root generator. Case selection and Cores inspection continue through the existing authenticated Registry review path. Original protected History and Decision Work remain distinct.

## Unchanged authority and explicit exclusions

The reference's client catalogues (Northline, Meridian, Kibo), review metrics, locations of graph clusters, fictional recordings/people, invented overnight activity, example evidence chains, confidence percentages, licence grants, hold toggle *[see 17 Oct: allowed only when backed by DB05]*, outbound deliveries, and approving or rolling back a batch are *demonstration* content. Do not emit them in live UI or give their interactive mock functions backend authority.

In this first visual checkpoint, graph clusters are positional only and **do not claim actual city/scene geography**, company grouping, rights, or identity merges. A linked credit is not a statement of rights. Every Brief root connector must correspond to an actual review membership edge and every terminal mark to one authorized review ID. Neither a random hash nor a status is sufficient to assert an event, lineage or causal sequence. No WebSocket, LLM or live work simulation is added.

Licences and Deliveries require their own evidenced operational substrate under the existing approved Slice 2/3 boundaries; do not create dummy cards, false completion, or automatic writes to match the screenshot.

## Remaining visual and product gates

- Owner review at identical desktop and 390px mobile viewports for Brief, Field, Cores, History, and governed Decision Work.
- Confirm mouse, keyboard, wheel, touch drag, and pinch behaviour and meaningful accessibility. Compare with HTML in the same viewport.
- Verify no stylesheet leaks to other admin/public screens and no RLS/authorization or exact-ID regression.
- The shipped WAKILISHA typography is intentional. Review spacing, focus, contrast and graphics against shared primitives, not a new font dependency. *[superseded 17 Oct: Figtree and IBM Plex Mono are required inside MIZIZI routes]*
- Do not merge PR #1227 or deploy Production until all original Slice 1 runtime, SQL, operator, and CI release gates pass.

No new SQL, Edge, JIT, grant, queue or production change accompanies this CSS/React checkpoint.


## 12 October 2026 signed-in visual review: primitive convergence

The owner's Field and Decision Work screenshots show cramped search chrome, dense labels and poor readability after broad source HTML CSS overrides. Remove the generic resets and return to the WAKILISHA theme. The Field reuses WkSearchField, WkViewportControls and a reusable WkGraphLegend. The page retains WkTabs, WkButton, WkIcon and governed split workspaces. Brief reuses WkStatusDistribution and WkRankedBars for exact source-reconciled counts.

The Canvas reads computed WAKILISHA theme tokens, redraws when the theme or viewport changes, supports wheel zoom, pointer pan, touch and selected-case focus. Only user-driven camera focus/fit is animated; prefers-reduced-motion disables its transition. The static root chart reflects exact current review statuses, not simulated time or agent actions. A bounded keyboard-accessible review list provides a non-Canvas path to the same authenticated cases.

### Slice 2 presentation boundary

Continue using exact typed identity references, scoped source projections and stable review/claim IDs. Add source-linked evidence edges and typed independent, copied, contradicted, withheld and unknown classifications only after audited immutable assertion data and disclosure policy exist. Admin evidence may not be redacted in the browser to create a public view. Creator participation requires the existing attestation and permission contracts. Graph geometry implies neither identity merge nor rights ownership.

### Slice 3 presentation boundary

Reuse semantic status tokens, accessible graph keys, split workspaces and source timestamps for future verified operations, calibration, stewardship licences and accountable delivery. Do not show mock license scores, Hold Writes switches *[superseded 17 Oct: a scoped Hold Writes draft is allowed only when backed by the DB05 hold RPC]*, partner names, live event feeds, grants or outbound ACKs. The Stewardship Licence is governance permission, not copyright licensing. Future delivery UI requires exact approved revisions, recipient/source permission, outbox receipts, idempotent partial acknowledgements and explicit denial states.

### Remaining acceptance

At desktop and 390px, check dark/light contrast, search icon clearance and label legibility, graph navigation, keyboard and screen-reader alternative, trackpad/wheel, touch pinch, reduced motion, source IDs, responsive panes, no CSS leakage, route splitting and protected CI. This first design adaptation does not close the approved Slice 1 operational exit gate or advance Slices 2/3 into Production.

## Objective MIZIZI roots: 12 October 2026 owner correction

**MIZIZI means roots.** The owner rejected the existing random-hash Canvas root illustration as abstract despite authentic review counts. Replace it completely with a source-reconciled membership view: Registry review inventory -> recorded review_type/workstream -> recorded entity_type/subject -> one exact Registry review ID per terminal mark, coloured and shape-coded by its recorded open/resolved/other status. Use the authenticated `HeadquartersQueueV2` read model only; every branch/category is produced by `projectMiziziReviewRootsV1` in `src/services/miziziReviewRoots.ts` and fails closed on count, membership, duplicate ID or source-status conflict.

The root visualization lives in `src/pages/admin/review/mizizi/MiziziReviewRoots.tsx`. The operator can select a workstream and inspect recent authorized members through the existing Cores handler; the grouped diagram is not a new backend authority. The graph remains a snapshot of **categorization**, NOT an operation execution graph or proof that evidence was gathered, verified, published or delivered. No arbitrary curves, seeded random branching, fake elapsed-time animation or fabricated jobs. The mobile view stacks genuine branches, with the same inspect path and accessible status counts. Shapes distinguish state without colour.

Once Slice 1 durable case/admission read evidence is genuinely accessible, extend the existing explicit edge model from reviewed case to immutable event/decision/receipt/operation/verification with source-qualified typed connections; independently authorized public-safe Core projections belong to Slice 2, and outward delivery ACKs/partner receipts belong to Slice 3. Never infer those links from review type, artist-name similarity, timing, or the number of records. No new backend read grants, RPC, SQL migration or deployment was made for this presentation correction.

Acceptance is twofold: **exact source truth** (every mark/branch reconciles to the live authorized read, unknown states never hidden) and **visual comprehension** (a reviewer can answer which workstreams and subjects contain open work, select a real branch, inspect its recorded members, and tell that the picture is not operational runtime history). The pre-existing #1226 exit and PR #1227 draft status remain binding.
## 12 October 2026: Interaction-complete discovery without early writes

Owner provided full-sized Field screenshot, governed Decision Work modal screenshot, and prototype sessions for artist identity, grouped attestations and disputed producer credits. The screenshot proves visual/interaction intent; their candidate people, claims and human decisions are not authenticated WAKILISHA fixtures.

**Field:** Selecting a graph node must remain valid without search text and must not auto-redirect to Cores. The exact source-ID artist credit can be inspected as an entity in its own right; its recorded child review artifacts can be individually expanded to show recording/release, status, exact case ID, relevant artist-credit state and ISRC where recorded. From a child, the reviewer may enter Cores deliberately. A recording can similarly show all *recorded* credit IDs and navigate to an artist's in-place entity view, not merge identical-looking names. The graph's canvas edges remain read-only exact-ID associations, not provenance or rights proof. Mobile inspector and legend must never cover the same controls.

**Brief:** Each terminal leaf is keyboard and pointer-selectable. Selecting a leaf reveals the exact review ID, type, status and recorded timestamp where available, then allows an explicit Cores inspection. Subject branches themselves are selectable, and review listings expand in bounded groups rather than implying the first four are the entire workstream. A leaf mark is a discoverable review record, not a batch job or completed operational action.

**Five/fifteen/sixty-minute sessions:** The reference's focused one-question-at-a-time reading model is implemented with the canonical accessible Modal and the same three offered session sizes (3, 8, 24), progress for locally viewed steps, skip, previous/next and Done for Now. No clock countdown unless a real timer is running. No session-local skip becomes a canonical decision; it is not saved to the database. The source's fictional choices (e.g. producer names, grouped email threads, contradictory person clusters) cannot be emitted from the generic queue. Decisions remain governed, evidence-backed actions in Cores, never a modal shortcut from Brief or Field.

**Shared icon clearance:** the canonical Field primitive reserves icon space in its input using a higher-specificity `data-wk-search-input` / `data-wk-password-input` contract in the shipped Foundation CSS. This repairs overlapping placeholder/input text, search glyph and clear/reveal chrome wherever the primitives are used, without another route-specific reset or `!important`.

**Source/exit:** read-only registry snapshots, unchanged RLS/writer permissions, no new tables, no API, no delivery or release. CI covers source selection, action separation, primitive slots, and existing registry projections; operator screenshot checks must still prove Focus dialog, Field, root leaf expansion, 390px mobile, keyboard focus, and no shared primitive regressions before Slice 1 closure.

## 12 October 2026: WAKILISHA MIZIZI Case Reading Room, independent art direction

The owner's 13:00–13:03 EAT screenshots show that Cores and History were still bound to the HTML prototype's narrow repeating right sidebar. The sidebar's thin green status border, duplicate History and Next Step sections, pseudo-geological dots and rule stripes consumed attention without conveying an independently verifiable fact. Field's selected-record card likewise sat over the zoom controls. In Brief, all review marks were simultaneously visible, producing a field of static-looking colour even though they were clickable.

**Direction: stop illustrating the database. Design a place to read and act responsibly.**

1. **Cores is a case reading room.** The authenticated left index stays for finding work. Its right-hand content becomes one wide reading surface, with a strong case title, plain-language description, a horizontal *Current Standing* decision strip, one explicitly governed review action, and full-width two-column evidence rows. Removed the layered rocks, decorative markers, empty label columns, redundant right sidebar, and status-colour border. The Registry evidence is textually labelled, not presented as multiple independent proofs. Peer evidence remains visible only when the source actually records peers. Open, resolved and verified retain distinct meanings.
2. **History is a dated record, not a duplicate Core.** After the shared title and standing it leads with only source dates, such as review opened and changed. Resolved cases may show exact recorded decision and verified operation references in a separate receipts block. These references are *not* a generated activity stream or partner-delivery receipt. Original source evidence is reachable through the existing accessible disclosure primitive, not permanently jammed into a narrow parallel column. No invented timestamps or sequence claims.
3. **Field is spatial; a selection is intentional.** A selected artist or artifact uses a proper right-side inspector lane occupying the same location as the unselected graph key. The key disappears while the inspector is visible; viewport controls stay separate at the bottom. At mobile widths the inspector becomes a lower, independently scrollable pane. The loaded source-ID child graph, inspected records, and explicit Cores handoff remain unchanged.
4. **Brief roots are progressive.** Show actual workstreams and their precise open/resolved counts up front. Expand a workstream, then a subject, to reveal up to 24 individually selectable real review marks; reveal more on demand. Existing real record inspection and case list continue working. No ornamental trunk lines or pseudo-branches. Every visible mark represents one exact Registry review. No line suggests an execution graph until real receipts are available.

The art direction is WAKILISHA's own: generous editorial typography, deliberate whitespace, accessible WAKILISHA primitives, and meaning-bearing status accents. Colour must never be used to suggest source validity or writer authority. No new data access, operation grant, SQL, Edge function, delivery writer or Production deployment belongs to this UI convergence. Required acceptance: source reconciliation and policy gates, keyboard/focus/contrast, desktop and 390px snapshots, Cores/History/Field interaction, no overlay overlap, and exact draft-head protected CI. Do not merge or claim release acceptance before the owner's Mac signed-in run.


## 12 October 2026, 14:10 signed-in owner screenshot acceptance

Owner's actual local screenshots show the Cores DESIRE page, the resolved Ficha History page, expanded Brief, and Field selecting Suna (Da Africa Deep Afrikan Remix) with recorded credits Kato Change, Winyo and Suraj. These are screenshot observations, not live data queries.

**Accepted structurally for continued work:** the Cores right pane is no longer a second nested sidebar; history has a dated record and real operation references; Field's inspector and zoom controls no longer intersect at the shown desktop viewport. This is not final visual or mobile acceptance.

**Corrections demanded by the evidence:** (1) A resolved or History case must not offer a primary CTA labelled `Open Governed Review` when the operator is reading its history. Use `View Governed Record` and a subdued action style, preserving the exact existing route; open Cores reviews keep their governed action. (2) The Field's recorded artist credits are clickable but do not visually communicate that. Add explicit, accessible same-ID artist navigation affordances with clear directional icons, improve focused source-edge contrast while keeping unrelated edges subdued, and never infer rights or identities from their proximity. (3) The Brief's individually selectable review marks used tiny 14px targets; widen the interactive area, keep separate shape-coded markers, and preserve exact ID selection and bounded paging. (4) The Cores label `Recorded Peer Evidence` sounded like independent corroboration even for DESIRE listed in its own review. Display `Related Source Records` and explicitly state that the listing does not establish independent corroboration.

No changes to the authenticated facts, field graph topology, admin role, review state, case writer, SQL, Edge Functions, or original Slice 1 exit gates. The new screen-specific fixes require protected CI, owner desktop and 390px screenshots, keyboard focus/touch hit testing, and actual Cores/History/Field click-through acceptance before PR #1227 can leave draft.


## 17 October 2026: Product v4 Superseding Design Authority and Repository Reconciliation

### Authority and source files

| Item | Value |
| --- | --- |
| Bundled reference | `MIZIZI Product v4.html`. The owner's copy `MIZIZI Product v4 (1).html` is the same file with a browser duplicate-download suffix. |
| SHA-256 of the bundle | `f2ac32fbc3929ba89d6c98d1e100cf8fd95435235ee3b6c56a0e4aa6a81ed549` (verified identical for both names) |
| Editable source | `MIZIZI Product v4.dc.html`. Read structure, copy and states from this file, never from the compiled bundle. |
| Method rationale | `MIZIZI v4 Practice Brief.md` |
| Design system | `MIZIZI Design System.html` (standalone) and the token files `tokens/colors.css`, `fonts.css`, `typography.css`, `spacing.css`, `shape.css`, `motion.css`. These are available and are the source for pixel parity. The earlier note that the Design System "was not available" is withdrawn. |

v4 supersedes earlier prototype navigation, naming, tokens and interaction design wherever they conflict. Earlier observations in this file remain dated history. The v4 reference is an interactive prototype, **not Production authority** for facts, rights, permissions or writes.

**Repo source:** accepted `main@aed0323cb3baa34313dede0d5d08b8af35c4f7a7`; active draft PR #1244 (case-first UI); active draft PR #1243 (research); existing Slice 2 #1239. This reconciliation is scoped to the current draft and is not a Production acceptance. Repo and CI tests prove specific contracts, not completed cross-surface v4 functionality.

### Naming map (binding)

Earlier sections use names that v4 reassigns. "Field" in particular means two different things. Use only the v4 names in new code, copy and tests.

| Earlier name in this file | v4 name | Location in v4 | Repo source |
| --- | --- | --- | --- |
| Cores (case reading room) | **Workbench** | Headquarters › Workbench | `MiziziEvidenceWorkbench.tsx`, `MiziziDurableCasesPanel.tsx` |
| History | **History tab** inside a Workbench case | Headquarters › Workbench › case | Same as above |
| Field (spatial credit graph) | **Orion** | Headquarters › Orion | `MiziziReviewField.tsx`, `miziziCaseField.ts` |
| Brief (roots overview) | Case index and **Overview** at the top of Workbench | Headquarters › Workbench | `MiziziReviewRoots.tsx`, `miziziReviewRoots.ts` |
| Decision Work / focus session | **Review** (one question at a time) | Headquarters › Review | `page.tsx` decision forms |
| (none) | **Evidence**, **Outcomes**, **Hold Writes** | Headquarters | `miziziDurableCases.ts` (DB05 hold) |
| (none) | **Field**: research-push capture | Top-level surface | No accepted runtime |
| Your Credits | **Contributions** | Top-level surface | Registry attestation foundations |
| Public Cores | **Record** | Top-level surface | Public Track/Registry surfaces |
| Enterprise | **Organization workspace** | Reached by organization sign-in | Enterprise planning contracts |

Top-level surfaces, in order: Headquarters, Field, Contributions, Record. Headquarters navigation, in order: Workbench, Orion, Review, Evidence, Outcomes.

### Final HTML to existing code and authority matrix

| v4 element | Intended behaviour (as built in v4) | Existing source | Actual authority | Proven state | Required correction | Acceptance test |
| --- | --- | --- | --- | --- | --- | --- |
| Workbench | Case header on the shelf ground with a stats row (questions decided, evidence count, next due date, research running or paused). Expandable questions. Overview, Evidence, Next evidence and History tabs. | `MiziziDurableCasesPanel.tsx`, `MiziziEvidenceWorkbench.tsx`; DB02 case RPC | Authenticated case membership plus governed Registry review; research-pass memory only on draft #1243 | Partial; v4 question model unverified | Ground each question and counter-hypothesis in versioned permitted source records. Do not ship v4's example three-question dossier. | One real case with all same-ID reads, uncertainty, counter-evidence, denied membership and mobile |
| Evidence-against-hypotheses grid (ACH) | Per question: rows are sources, columns are hypotheses. Cells use the ratings CC, C, N, I, II. Each row shows its source grade and whether it tells the hypotheses apart. A footer gives the weighted conflict per hypothesis and marks the least-conflict one. Copied sources count once. | None | Reviewer judgment recorded per cell, with author and revision | Prototype-only | Store each cell as a reviewer assertion against an exact evidence ID and hypothesis ID. Compute totals; never enter them by hand. Show "No evidence yet" when a column is empty. | Ratings persist per revision; changing a grade recomputes totals; no total without cited cells |
| Source grade (Admiralty) | Two-character grade: reliability A–F (A completely reliable … F can't be judged) and credibility 1–6 (1 confirmed … 6 can't be judged). Conflict weights: A 1.0, B 0.9, C 0.7, D 0.5, E 0.3, F 0.5. | None | Reviewer-assigned, per evidence item, versioned | Prototype-only | Add grade and rationale to the evidence record. A grade is a reviewer judgment, never computed from source type. | Grade history visible; ungraded evidence shown as F6 with a prompt to grade |
| Source lineage | Copies of one origin collapse to one, shown as "×3 → 1" | Slice 2 source-lineage branch | Immutable lineage edges | Partial | Derive the collapse from recorded lineage (for example a shared DDEX MessageId), never from matching text | Three feeds sharing one MessageId count once in the grid and the totals |
| Evidence drawer | Grade card plus Summary, Raw and Custody tabs. Raw shows the record as received. Custody shows the SHA-256 and each hand-off. | Existing Registry readers; ERN 4.3.2 parser `src/services/musicStandards/ern/v432/` | Immutable evidentiary receipts, source permissions, RLS | Partial | Raw must render the stored original (ERN XML, time-coded transcript, transcription), not a paraphrase. v4's caption says "DDEX ERN 4.3"; the repo adapter is **ERN 4.3.2**, so label it 4.3.2. Custody entries come from the receipt log only. | Hash matches at every hand-off; withheld items show the restriction, not the content |
| Review (Decision Work) | One question at a time at a frozen revision (v4 example: revision 7). Options, an evidence pane, an "Ask a question" thread that can hold the decision until answered. "If this is wrong" block: who is harmed, whether it can be undone, the bar for this decision, whether the bar is met, and the method version. Irreversible changes (paid splits) use a higher bar. | `page.tsx` decision forms and reviewer receipts | Registry review decision and exact operation receipts | Governed review exists; v4 focus/freeze model unverified | Freeze inputs per question; record the threshold and method version with the decision; keep execution receipts separate | Pre-decision snapshot; stale or revoked denial; bar-not-met blocks approval; human adjudication proof |
| Orion | Graph and List modes. Filters: All, Recordings, People, Releases, Open cases. Zoom 50–200 %, fit, drag to move, wheel to zoom. Floating key when nothing is selected; floating 380 px inspector on selection, with the selected node centred in the free area to its left. Inspector lists recorded links (name plus relation only) and "Open in Workbench". | `MiziziReviewField.tsx`, `miziziCaseField.ts` | Authorized Registry credit and review reader, not rights adjudication | Partial | Verified node and edge types only; no proximity inference; state "Lines are recorded credits. Nearness means nothing." | Exact typed edge to source; keyboard List alternative; no inferred identity or ownership |
| Evidence (library) | Needs attention and Library modes | Registry readers; Slice 2 lineage | Immutable receipts, permissions, RLS | Partial | Reuse lineage and disclosure decisions; no unrestricted central blob store | Source-family dedup; missing consent, withheld source and unchecked translation stay limited |
| Outcomes and calibration | Outcome filters: All, Corrected, Unresolved, Protected, Follow-up, Declined. Calibration panel: decisions revisited, reversed, harmful corrections, current method version, and reversal rate per method version. | `MiziziDurableCasesPanel.tsx`, `miziziDurableCases.ts` | Case journal and Registry execution boundary | Not implemented | Calibration numbers must be computed from recorded decisions and later reversals; show "Not enough decisions yet" below a minimum count | Counts reconcile to decision records; method version stored on every decision |
| Hold Writes | Scoped draft (operation, case or workspace) with a reason | DB05 workspace hold RPC | DB05 only | Workspace hold available; granular scopes unproven | Offer only scopes the RPC supports; no second-approval hold shown as active | Hold receipt and release; revoked operator; zero Registry write bypass |
| Human and Machine view | One case, two representations. v4's machine pane shows illustrative object names (`mizizi.case`, `mizizi.decision`, `mizizi.evidence`, `mizizi.hold`, `mizizi.outcome`, `mizizi.capture`, `mizizi.contribution_claim`, `mizizi.cores_record`). | Draft #1244, `projectHeadquartersCaseMachineReadV1` | Same permission-scoped DB02 projection | Candidate on draft | Replace v4's illustrative object names with the real projection names; no pseudo-APIs | Same IDs and revision in both modes; denied role sees neither |
| Field | Research pushes list with status (In progress, Paused, Submitted, Assessed). One push holds Photo, Audio, Video and Note items. A default caveat for the push with per-item overrides and batch apply. Item editor: name, language, caveat, capture record (SHA-256, time, place to about 1 km, device), community protocol. Review checklist warns on default names and **blocks** submission on missing consent. Pause and resume. Offline queue. After submission: rename keeps the earlier name; a stricter caveat applies at once; a looser one needs the custodian's consent again. | No accepted capture runtime | Consent, custodian control, Storage/RLS, recoverable client sync | Prototype-only | Reuse upload and attestation primitives where fit is proven; otherwise show an honest unavailable state | Real interruption, reload and retry; hash at capture equals hash at upload; consent block cannot be bypassed |
| Community protocol (Local Contexts) | Separate from "who may see it". Shows TK Labels only when a community's Local Contexts project is linked; v4 example labels TK Attribution and TK Non-Commercial. | None | The community, through the Local Contexts Hub | Prototype-only | MIZIZI displays labels as received and never assigns them. Linking needs the community's project ID. | No label without a linked project; labels never change access rules |
| Contributions | Hero (cover band, avatar, verified mark, counts). "Answering as" cards: Yourself; group Spokesperson with a mandate (v4 example: 4 of 5 members); estate Administrator with letters pending, which can send only personal testimony. Each request is tagged "About you" or "For [group or estate]" and lists what you can and can't say. Send button names the capacity. | Claimant, attestation and contribution foundations | Identity, mandates, statement permissions, independent reconciliation | Foundation partial; v4 journey unverified | Verify mandates separately from participation and rights | Expired or withdrawn mandate; estate without letters cannot confirm; original-language statement; no automatic canonical write |
| Record (public) | Public findings with provenance-safe revisions, English and Kiswahili | Public Track/Registry surfaces | Canonical Registry, publication authorization, disclosure policy | Prototype-only | Publish from an accepted revision with redacted provenance, never from a proposal | Private witness never disclosed; rejected revisions never published; translation status shown |
| Organization workspace | Overview, catalogue, changesets, requests, members and access, receipts | Enterprise planning contracts | Customer approval, C17 isolation, H37 execution, DDEX adapter/ACK where supported | Prototype-only, Slice 3 gated | Reuse organization foundations after real customer authorization | Cross-tenant deny; delivery vs acknowledgement; revocation |
| Adaptive research | Independent lawful source investigation, repeatable passes, adjudicated learning | Draft #1243; typed jobs; DB04 research memory | Leased job, legal source-use basis, independent human adjudication | Partial on draft | Finish Slice 2 #1239 with a legally approved source and blinded verdict | Source lineage, model-permission gates, lease/retry, cost metering, independent holdout |

### Visual tokens (exact, from the token files)

Scope every rule to MIZIZI routes (for example `[data-mz-surface]`) so nothing leaks into WAKILISHA screens. Inside that scope these values replace `--wk-*`.

- **Fonts:** `--mz-font-sans` Figtree 400/500/600/700; `--mz-font-mono` IBM Plex Mono 400/500.
- **Type scale:** display 600 40/1.05, −0.02em; h1 600 34/1.15, −0.015em; h2 600 24/1.3; h3 600 21/1.3; h4 600 17/1.35; body 400 15/1.55; body-sm 14/1.55; caption 13/1.5; micro 12/1.4; label mono 500 11/1.3, uppercase, 0.08em; id mono 400 13/1.3. Page titles on Field and Contributions use 700 30px, −0.02em.
- **Ground:** `--mz-canvas` #ECEBE8, `--mz-paper` #FCFCFB, `--mz-surface` #FFFFFF, `--mz-shelf` warm artefact ground oklch(0.965 0.003 70). Neutrals `--mz-ink` to `--mz-ink-5`, lines `--mz-line-strong`, `--mz-line`, `--mz-line-soft`.
- **Evidence standings (the only chromatic system):** token keys `established`, `supported`, `uncertain`, `contested`, `unknown`, each with base, `-bg` and `-fg` (unknown also has `-border`). Display labels: Established, Supported, **Unresolved** (token key `uncertain`), Contested, Unknown. Workflow chips (open, proposed, requested, accepted, protected, available, denied, acknowledged) are a separate domain and must never reuse standing colours to imply evidence strength.
- **Spacing:** 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80 px. Gutter 40 px (20 px mobile). Panel 420 px. Frame 1280 px. Breakpoints 480, 768, 1024, 1280.
- **Radii:** artefact 8, control 12, card 16, sheet 24, pill 999. Every button, segmented control, filter chip and nav item is a full pill. Search fields are filled pills 44 px high. Inputs and rows use 12.
- **Shadows:** card `0 1px 2px rgba(0,0,0,.04), 0 4px 16px rgba(0,0,0,.04)`; modal `0 4px 12px rgba(0,0,0,.06), 0 24px 64px rgba(0,0,0,.16)`. Images never cast shadows (inset 1px hairline only).
- **Motion:** ease cubic-bezier(0.2,0.7,0.2,1); 120 / 200 / 320 / 420 ms. Reduced motion removes transitions.
- **Icons:** Lucide 0.460, 2px stroke, 12 / 14 / 16 / 20 px.
- **Image ratios:** cover 1/1, document 1/1.4142, J-card 5/8, photo 3/2, still 16/9.
- **Targets:** 44 px minimum. Check at 1440, 1024, 768, 480 and 390 px, with keyboard and reduced motion.

### Canonical copy (use verbatim)

- Caveats, strictest first: **Reviewers only** · **MIZIZI only** · **Customer reference** · **Public record may cite**. v4 still shows the older label "Cores may cite" in the item editor and item chips; that is a prototype defect. Use "Public record may cite" everywhere.
- Consistency ratings: CC strongly fits · C fits · N neutral · I conflicts · II strongly conflicts.
- Orion key footer: "Lines are recorded credits. Nearness means nothing."
- Field after submission: "Rename any item" · "Make a caveat stricter" · "Make a caveat looser" (needs the custodian to agree again) · "Add more to this push".

### State domains and demo data

- Keep these domains independent: evidentiary standing, case lifecycle, provenance, disclosure, review, Registry operation, delivery and synchronization. Unknown is not zero. Approved is not executed. Sent is not acknowledged.
- All v4 people, cases, catalogue counts, media, hashes, grades, ratings, custody logs, calibration figures, Local Contexts links, model activity, receipts and delivery events are **illustrative**. None is source proof.
- v4's weighted-conflict totals are derived numbers, not confidence percentages. The earlier ban on confidence percentages still applies.
- Do not copy v4's bundler runtime, fake integrations or seeded content into the React 19 / React Aria product. Existing `Wk*` primitives keep their behaviour; they take `--mz-*` values inside the MIZIZI scope.
- Where permission, custody, publication or customer authority is missing, show a truthful unavailable state, never a simulated success.

### Three existing slice responsibilities and next proof

1. **Current UI convergence, draft #1244:** apply the naming map and tokens; carry the real case-first record through v4's navigation; first addition is the read-only Human/Machine view on the DB02 projection. Next: evidence grade field and the ACH grid backed by stored per-cell assertions. Protected CI and signed-in desktop and mobile acceptance are required before release.
2. **Slice 2 #1239 and draft #1243:** lawful unfamiliar source, versioned lineage, source family, frozen model prediction, blinded human verdict, prospective improvement, and the Raw and Custody tabs. Earlier preview passes are not a completed adjudication.
3. **Slice 3:** customer separation, authorized request and catalogue scope, versioned changesets, real delivery and acknowledgement, C17/H37 safeguards. No fabricated pilot tenant and no universal writer.

No new implementation phase, universal agent endpoint, parallel Registry or permanent CI workflow is authorized by this checkpoint. No Production SQL, Edge Function or frontend activation occurred. Merge stays blocked on exact-head tests, mobile and signed-in owner acceptance, then the accepted release procedure.