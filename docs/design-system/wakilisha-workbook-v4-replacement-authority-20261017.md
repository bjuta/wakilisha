# WAKILISHA × MIZIZI — Brand Workbook v4 replacement authority

**Status:** design/documentation authority proposal, 17 October 2026. No runtime switch or release accepted by this document.

## Binding source hierarchy

| Source from owner | SHA-256 of exact uploaded source | Responsibility |
| --- | --- | --- |
| `MIZIZI WAKILISHA Brand Workbook.dc.html` | `b7c42a725f22576297daa34cc2769ceee200b3f1e8e7605eddc23dd3cea46533` | WAKILISHA masterbrand plus shared foundations |
| `MIZIZI Design System v3.dc.html` | `9f102c31a014c29f840620bdd890ea4b7f56e76c32c89aafd76231b69d1f9c70` | MIZIZI-specific pixel, component, eight-screen and evidence treatment |
| `MIZIZI Product v4.dc.html` | `b9dd8c2053fde07d6f14cb51579d59c6834b90e77d001ec9964d2850faf4c0cc` | Actual MIZIZI screen behavior, journeys and navigation |

The owner provided **editable .dc.html source**, not a screenshot-only reference. Preserve its values and authored hierarchy. The existing v5 `wakilisha-design-system-v5.html` documentation and old prototype CSS are historical only when contradicted by this workbook. The existing WAKILISHA custom logo remains authoritative, including uploaded Site Identity, never replace it with the workbook's typographic stand-in. Public MIZIZI always has WAKILISHA endorsement; inside Headquarters/Field it may stand alone.

**Conflict resolution:** Workbook sets joint foundations. MIZIZI Design System v3 sets specific MIZIZI visual dimensions and component exceptions. Product v4 sets interaction and domain behavior. Accepted engineering/security/runtime contracts remain the implementation and release boundary. Where mockup behavior would exceed authorized capabilities, do not emulate successful data, permissions, researchers, Registry operations or delivery. Present a truthful unavailable state; record the outstanding feature and acceptance proof.

## Foundation replacement (not another independent skin)

- Two brands, **one system**: WAKILISHA is dark-first, editorial, photo-led; MIZIZI Headquarters, Field and Contributions are light paper `#FCFCFB`, while public Record and artist-facing heroes inherit the dark image-first register.
- Exact shared families: **Figtree 400/500/600/700/800** for reading, **IBM Plex Mono 400/500** only for IDs, hashes, grades, revisions, timestamps and machine-exact strings. Keep actual locally licensed WOFF2 with CSP `font-src 'self'`, `font-display:swap`, subset/hash audits, do not reload third-party fonts.
- Colour: WAKILISHA green is **`#85C441` and no competing green**. Light text green `#4E7425`, tint `#EDF5E3`; dark base `#0B0B0B`, paper `#FCFCFB`, canvas `#ECEBE8`. Semantic five evidence standings are Established, Supported, Unresolved, Contested, Unknown. Their meanings and palettes belong to evidence only; workflow, validation, business delivery and Registry execution retain distinct meanings.
- Neutral-first surfaces. **4px spacing unit**, radii: artwork 8px, inputs/rows/tiles 12px, cards 16px, sheet/hero 24px, buttons/filters/segmented/nav 999px. At least 44px interaction targets; narrow-screen safe areas. No reliance on browser-native chrome for user-facing custom controls; keep real native semantics through React Aria.
- WAKILISHA public hero typography may use uppercase poster treatment; MIZIZI case titles use 34/700 sentence case and real names preserve original casing. Figtree for prose, Plex Mono only for exact data; record original-language quotation before clearly attributed translations.
- One shared overlay/menu, connected floating controls, consistent player and graph legend, reduced-motion alternatives, keyboard and touch parity. Never show dead informational numbers or uninspectable grades.
- Preserve source identity, culture-first register, privacy/disclosure decisions, provenance, evidence uncertainty, copyright, receipt-based approvals and accessibility. Design has no authority to bypass those controls.

## Existing system to replace across all delivery surfaces

| Existing locus | Replacement responsibility | Migration note |
| --- | --- | --- |
| `src/design-system/wakilisha.tokens.css` | Canonical CSS token implementation | Replace v5 colours, typography, dimensions and motion, not merely append a competing `--mz-*` layer |
| `packages/design-system/src/wakilisha.tokens.css` | Package/distribution mirror | Enforce byte/token parity with canonical source; do not diverge |
| `src/styles/wakilisha-fonts.css`, `public/assets/fonts`, `index.html` | Self-hosted font/CSP audit | Admit authentic Figtree and Plex, retire old font dependencies only when every consumer is mapped |
| `src/components/design-system/theme/*` | Mode/accent contract | Existing adjustable accent cannot silently override fixed canonical brand green or semantics; migrate saved prefs deliberately |
| `src/components/design-system/primitives/*` | Reusable buttons, fields, sheets, radio, menus, tabs and status | Preserve React Aria keyboard/focus/form operation; WAKILISHA consumes MIZIZI-first replacements where appropriate |
| `src/design-system/designSystemSpec.ts` and `designSystemManifest.ts` | Documented/admin design vocabulary | Supersede v5-only prohibitions; maintain historical references without treating them as normative |
| `src/pages/admin/design-system/*` | Browsable source-driven inspector and visual parity | Two-brand/two-mode specimens, version/hash traceability, no mocked acceptance |
| `src/components/design-system/music/*`, `player/*`, public/editorial components | WAKILISHA consumer adoption | Dark/photographic/edge-to-edge rules; preserve existing player contracts, playback events, editor accessibility |
| `src/pages/admin/review/mizizi/*` | MIZIZI consumer of shared system + domain additions | Follow MIZIZI v3 pixels and Product v4 interactivity; no new Registry writers from presentation |
| Screens outside these locations | Route-wide audit and acceptance | Inventory component imports and bespoke CSS before changing each surface; include 390/480/768/1024/1280/1440 viewports |

Current `main` before this documentation effort is `aed0323cb3baa34313dede0d5d08b8af35c4f7a7`; MIZIZI UI draft PR #1244 and research PR #1243 remain separate drafts. The previous MIZIZI colour/token work on PR #1244 is a **candidate needing update against v3** (not a completed exact match).

## Delivery order and clean gates

**Release slice A — shared brand infrastructure (must precede global activation):** versioned source snapshots, token mirror, local font licence/hash checks, global theme/accent policy, primitive and admin design-inspector updates. Run unchanged security/player/browser and CSS audit gates; reject unexpected font loading or regressions. Do not merge a global token change without major-route screenshot and functionality parity.

**Release slice B — MIZIZI case-first integration:** exact v3/ v4 shell; real case selector; question and hypothesis model; recorded evidence lineage and graded ACH; one-question frozen review; source inspector, Orion graph/list, evidence queue, Outcomes, Hold receipts. Reuse recorded case, review, Registry and worker transport. Build missing *domain authority* only after its review, privacy and evidence contracts are proved.

**Release slice C — contribution, capture, public Record, customer workspace:** controlled consent/custody and recoverable Field capture; verified personal/representative/estate mandates; bilingual redacted public Cores/Record; customer requests, scoped Changesets, exact downstream delivery/ACK. Keep enterprise customer boundaries, Registry execution, hold semantics and public publication distinct. Existing Slice 2 #1239 governs independent lawful research and adjudicated learning; do not open a redundant research programme.

### Independent acceptance gates

1. Source SHA/asset provenance and audited changes to both canonical token copies; no unapproved WAKILISHA logo substitutions or green variants.
2. Keyboard/focus/touch/reduced motion, responsive and design-reference screenshot diffs for each specified viewport and all eight MIZIZI v3 screens; actual fonts installed and loaded under CSP.
3. Read/access denied for nonmembers, privacy/redaction, stale case revision, interrupted/denied capture, no fake evidence grades/rights.
4. Real question/source/family lineage and verified evidence inspection, independent adjudication, explicit hold and release receipts, Registry operations separate from decisions.
5. No Production SQL, Edge, auth or frontend activation without exact-head CI, owner visual acceptance and standard deployment rollback evidence.

**No global migration or Production approval is asserted by this document.**
