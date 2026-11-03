# WK100 Phase 1 founder-workbook structural fidelity audit

**Date:** 3 November 2026 (EAT)  
**PR:** [#1345](https://github.com/bjuta/wakilisha/pull/1345)  
**Controlling source:** Founder-supplied `Charts Ingest Workbook.html`, size **315,560 bytes**, SHA-256 `91ded11f49ef0531f02b69d3c2ee73126eaa4af5625e34ae97527446c043ed96`. File identity has been reverified from the actual attachment.  
**Authoritative exceptions:** [Issue #1338, workbook design authority](https://github.com/bjuta/wakilisha/issues/1338#issuecomment-6583961265). Do **not** implement W1S, fictional role-holder approvals, mock MIZIZI routes, fake rankings or declared provider qualifications. Keep existing light/dark semantic tokens and real permission/capture/publication boundaries.

## Scope and evaluation limits

This is a **direct structural and interaction mapping** of the exact founder HTML sections `#W0`, `#W1`, `#W2`, `#W2A`, and `#W3` against the current existing Admin Charts React shell. The workbook is a 1440-pixel static `x-dc` template referencing `./support.js`, which was **not supplied**. Therefore it is not executable deployable UI and this audit **does not** assert pixel-perfect rendered parity. The workbook itself does not specify independent 1024/768/390 or dark-mode frames; those are implemented from WAKILISHA design-system rules and must be tested separately. Sample WK100-M 0.4, counts, roles, scoring, methods and timestamps are illustrative only.

## Component and screen mapping

| Founder design reference | Repository implementation | Verified structure / remaining differences |
| --- | --- | --- |
| **W0** common status, stage rail, permission/lock states, revision and EAT labels | `WkWorkflowRail`, `WkStateBadge`, `WkOperationsHero`, `WkReadinessList`, server-owned `week` and Edition revision | Shared primitives and explicit EAT week present. True capability is rechecked by protected SQL/Edge functions; placeholders and fictional Reviewer B have no authority. No separate W1S. |
| **W1** left Next Action + Readiness, right This Week + Activity, all under the named week | `wk100-operations/page.tsx` overview | This change restores the two-column hierarchy at desktop, stacked at narrow widths. Four counts remain actual contract/review/receipt/failure projections; weekly stage and locked publication remain visible. New browser contract asserts both viewport compositions. |
| **W2** compact source roster with filters, independently visible **Qualification** and **Health**, and a source Configuration / Qualification / History inspector | `wk100-operations/page.tsx` sources | Proposal-only entries and actual enrolled contracts are co-visible in one source-key roster; no proposal is counted as a receipt or constitutional qualification. A 480px maximum right inspector and independent tabs are implemented. The secondary October research archive sits below the working roster and stays labeled research-only. The current table has additional candidate-timing and method-review fields; do not falsely claim identical pixel geometry. |
| **W2A** three-step Add Source workflow: provider/method → surface and cadence → confirm | `SourceProposalForm.tsx` plus `wk100-source-admin-proposals` and server CAS | Provider-specific research warnings are shown but **not** offered as approved unattended collectors. A saved proposal is inert; current method review and an exact candidate contract require distinct server decisions. No custom credential or endpoint fields are given to browser operators. The workbook's implied approved-method inventory is not evidence of any actual verified provider access. |
| **W3** collection coverage, latest attempts, failures, incident detail, recovery and provenance | `wk100-operations/page.tsx` collection; `SourceRecoveryDialog.tsx`; `wk100-source-admin-read` | Actual receipt/attempt counters, week-native period warning, retry-window limits, coverage missingness decisions, and private SHA-256 original readback exist. The incident inspector now shares its governed content between an **in-layout right-hand detail region (maximum 480px at desktop)** and the existing accessible **right-hand Sheet on narrow screens**. Layout is conditional on the viewport, so no duplicate editor or unauthorized command is mounted. Existing collection/readback/recovery semantics remain unchanged; responsive visual parity and live signed-in acceptance remain separately test-gated. No cross-week substitution or automatic reweighting. |

## Non-negotiable acceptance before Phase 1 closes

1. **Design:** preserve real W1/W2/W2A/W3 interactions, focus, labels, search, selection, responsive and light/dark behavior. Run current-head browser suites and founder-side visual inspection of the authenticated Admin Preview; this static source alone does not prove actual deployed CSS parity.
2. **Authority:** six-platform dispositions must distinguish first-party research from a permitted exact unattended method, a native metric, native period and actual credential availability. Neither this design nor public chart visibility constitutes an admitted collector.
3. **Originals and runtime:** one genuine service-collected private raw original, create-only Storage hash/bytes verified by signed-in Admin readback; all ACL, stale revision, retry lease, no-data, negative authorization and paused/failure cases pass with the **real client class**.
4. **Two logical EAT weeks:** deterministic accelerated source/scheduler/collector proof and separate real-clock disposable PostgreSQL/Auth/Storage behavior; never reinterpret this as two observed live provider weeks. Avoid unnecessary fourteen-day waiting, but do not manufacture live evidence.
5. **Release:** no Production SQL, Edge, frontend Finish Update, collector/cron enablement, scoring, first Edition publication, merge, or Phase 2 opening without the actual Phase 1 closure gates and release authority.

## Engineering decision

The exact workbook removes the **reference-file availability** blocker. It does not independently close signed-in hosted acceptance, source admission or true private-original proof. Keep one draft PR #1345 and one tracker #1338. No additional phases or fictional approval relays.
