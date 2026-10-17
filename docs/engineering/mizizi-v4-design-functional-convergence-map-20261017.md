# MIZIZI v4 exact-interface to existing-authority convergence map

**Source references:** Brand Workbook v4, MIZIZI Design System v3 (screens M1–M8), Product v4; hashes in `docs/design-system/wakilisha-workbook-v4-replacement-authority-20261017.md`. Status: scope/proof design, not accepted runtime. Original design's `Pwani ya Upendo`, `MZ-0212`, `Amani Otieno`, `8 sources`, `0 of 3`, running model badges, deliveries, customer firms and populated outcomes are **illustrative prototype contents** and must never appear as actual case facts without authorized backing records.

## Required first-class product functions (reuse vs missing)

| Surface and v3 reference | Reuse that already exists in repo | Missing or not independently accepted | Source-of-authority gate |
| --- | --- | --- | --- |
| Shared shell (M1–M8) | `WkTabs`, `WkButton`, `WkSearchField`, `Sheet`, `ThemeProvider`; PR #1244 prototype convergence | v3 248px open navigation, responsive collapse, 64px case toolbar, trustworthy case search, unified mode switch and contextual action bar | Accessible real routes/permissions; counts from scoped reads, no seeded profiles |
| Workbench M1 | `MiziziDurableCasesPanel`, `miziziDurableCases.ts` DB02 cases and DB05 holds; case journal; `miziziHeadquartersBrief.ts` queue | Versioned question objects, hypothesis membership, per-source truth and consent, independent-source family, graded source and working ACH cells/totals, actual per-question standing | Separate case stage vs evidence standing; no computed standing without real source grades |
| Review M2 | Governed `recordRegistryReviewDecision`; `MiziziEvidenceWorkbench`; case/journal receipts and existing decision modal | Freeze one question + evidence revision, mutually exclusive choices, adverse-impact/undo analysis, reviewer questions, per-question verdict and operation request mapping | No approval = execution; independent reviewer authority and stale-fingerprint/hold denial |
| Orion M3 | `MiziziReviewField` + `miziziCaseField.ts`, `WkGraphLegend`, typed source IDs/credit links | Interactive filtered pan/zoom graph and equivalent list + inspected typed edges and source-specific provenance | Similar names and spatial proximity never establish rights or new edges |
| Evidence/Outcomes M4–M5 | Registry review readers, real review/evidence inspection, redacted case journal and exact operation receipts | Evidence attention queue, consent/translation/source-family controls, independent grade and publication/custody policy, outcomes calibration, traceable publishable results | Private/prohibited evidence never leaks; outcome distinct from Registry execution |
| Field M6 | Shared upload trigger, accessible form, existing media/upload assets on other WAKILISHA routes | Field-specific custodian consent, source capture, resumable on-device transfer, offline persistence/recovery, attribution and supervisor attestation | Browser/WAF real client, custody/replay/failure tests, no simulated upload receipt |
| Contributions M7 | Existing claimant intake, provenance attestation, `TrustAttachmentPicker`, governed review | Role-capacity mandate (self/group representative/estate), original-language protected statement, translation-verification trail, revoke/withdraw | Identity/mandate/statement rights distinct from canonical credit |
| Public Record M8 | Public Registry/canonical identity, disclosure/editorial and accessibility primitives | Bilingual public Core revision, approved source excerpts, findings and source timeline, revocation, versioned redacted publication | Human review + publication consent + exact revision, no draft findings public |
| Organization | Existing organization/enterprise planning foundations and scoped concepts; no accepted v4 customer runtime in PR #1244 | Customer-authorized requests, catalogues, Changesets, members, delivery vs ACK, independent permissions | C17 tenant isolation, H37 executor, genuine downstream contract |
| Adaptive investigation | Existing shared MIZIZI job/lease/research transport and separate draft PR #1243 | Lawful unfamiliar source adapter, permission checks, real model credential, blinded independent human adjudication and measured improvement | Existing Slice 2 issue #1239, no synthetic research truth |

## Explicit geometry and interaction acceptance

MIZIZI Design System v3 is the exact screen-reference authority for M1 Workbench, M2 question Review, M3 Orion, M4 Evidence, M5 Outcomes, M6 Field, M7 Contributions, M8 Record. On M1 at **1280×860** the open rail is **248px**, with **44px** rows, paper/case shelf, 34px/700 title, a 4-cell evidence/decision row and source-linked question grid. Its record-identity artwork retains real ratios (J-card **5:8**). No invented thumbnail gradient may be represented as authentic artwork. The documented graph/text alternatives, sheet measurement, keyboard labels and reduced-motion behavior are actual exit criteria. Public Record uses the masterbrand's dark image-first treatment; Headquarters/Field/Contributions use paper.

Product v4 includes a 220px navigation prototype for its own shell, whereas MIZIZI v3 specifies 248px on M1. **Follow v3's 248px visual measurement**, preserve v4's behavior and correct its responsive rules rather than copying 220px blindly. Existing PR #1244's horizontal tabs and extra paper-card layout are intermediate, not pixel-accepted v3.

## API and ownership rules

- Shared design primitives may be **MIZIZI-first** and consumed across WAKILISHA, but not the reverse of domain authorization: permission- and revision-scoped services stay with their owning domain.
- Reuse `src/services/miziziDurableCases.ts`, `miziziHeadquartersBrief.ts`, `miziziCaseField.ts`, and existing WAKILISHA shared UI/accessibility/media. Reuse `WkGraphLegend`, actual Registry reader and Review Data API.
- Build one versioned domain read model per missing object before React UI. `case`, `question`, `hypothesis`, `source`, `source_family`, `grade`, `evidence_assessment`, `verdict`, `publication_revision`, `field_custody` and `organization_changeset` must have typed boundaries rather than embedding prototype JSON. Do not add all at once; scope only the first real need and its denial tests.
- Existing Case/Registry write APIs, DB05 holds, and worker lease/cost/permission gates remain the only mutation paths until a specific reviewed extension exists. No second generic executor.

## Practical implementation order (existing three slices, not 22 phases)

A. Global source/tokens/theme/fonts, shared primitives and reference QA (WAKILISHA and MIZIZI); keep logo. Split documentation-only change from actual globally affecting implementation.
B. Exact MIZIZI M1 layout/navigation + real case reader, then true question/evidence engine, then M2 reviewed verdict, M3 Orion, M4 Evidence, M5 Outcomes. Rebase PR #1244 after shared primitives land; finish PR #1243's independent research acceptance separately.
C. M6 Field and M7 Contributions with real consent; M8 bilingual public Record, then verified enterprise workspace/customer delivery. Promote only individually accepted functionality.

**Release truth:** A green UI compilation is not real case acceptance. Signed-in preview with an actual authorized membership and a nonmember denial is required, plus precise responsive visual comparison. Production remains unchanged by a documentation-only merge.
