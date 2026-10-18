# WAKILISHA × MIZIZI — Four-phase design and product closure

**Adopted scope:** 18 October 2026. **Status:** executable engineering programme, not approval to merge or deploy. **Starting delivery branch:** existing Workbook v4 PR #1246. This document travels with #1246 until its protected merge, then remains on main. No new parallel programme PRs.

## Authority and exclusions

Order: (1) WAKILISHA × MIZIZI Brand Workbook v4 for the two-brand shared system, (2) MIZIZI Design System v3 for exact M1–M8 component/geometry exceptions, (3) MIZIZI Product v4 for journeys and behaviors; (4) accepted Registry, permissions, security, runtime and deployment authority for what may actually be read, written or disclosed. Existing design reference SHA-256s are recorded in docs/design-source/20261017/README.md and docs/design-system/wakilisha-workbook-v4-replacement-authority-20261017.md. #1245 merged the design precedence. Reconcile the supplied sources; do not import or execute prototype HTML, demo people, fabricated evidence, fictional receipts or fake organizations in runtime.

The approved WAKILISHA logo and Site Identity remain the logo. Masterbrand public surfaces are dark-first and editorial; MIZIZI Headquarters/Field/Contributions are paper/light-first with an endorsed brand relationship, and public Record inherits WAKILISHA's image-first treatment. One design system, not independently forked component trees. Figtree is people-facing; IBM Plex Mono serves exact machine/record strings. WAKILISHA green #85C441 is immutable; #4E7425 is its approved light-mode legibility variant, not a new brand color. Separate five evidence standings from workflow statuses, rights, case lifecycle, approval, and execution. A result that lacks lawful source authority is unavailable/unknown, not silently blank or assumed approved.

This programme closes **both jobs**, not merely the reference implementation, and is limited to four phases. Scope ownership, evidence and business logic remain in existing domain services. Do not invent twenty additional milestones, a generic executor or new permanent CI workflows.

## Starting state (live observation, 18 October 2026)

- main is still the accepted public/production source; no Workbook v4 or MIZIZI Product v4 PR is merged.
- #1246 (feat/wakilisha-workbook-v4-global-foundation-20261017; draft): Figtree/Plex local fonts and their licensed hash audit, shared source/package tokens, theme/accent separation, Appearance screens and design-system metadata. Exact prior head bd69604d Critical Control Plane #39057608808 passed. Major-route consumer migration, old font face/preload retirement and screenshot parity are incomplete.
- #1244 (ui/mizizi-orion-workbench-20261017; draft): real React Headquarters and source-backed cases/holds/journal, question view/freeze and human-source metadata; exact prior head 8e7fe6b Critical Control Plane #39099675130 passed. Existing page is an intermediate visual; no pixel-accurate v3 acceptance and no completed full M1–M8 journeys.
- Backend draft dependency chain: #1243 → #1248 → #1249 → #1250 → #1251. QV3 source-family correspondence is human review metadata, NOT independent verified families/ACH authority. Last #1251 metadata-only head b0e3956 had action-required GitHub checks; prior functional head green is not a substitute for exact-head approval.
- Isolated Supabase Preview nkgfoppunmnkcumalxqp has 237 migrations. Production pgzizndxdyhqmtyywjmt has 231. Production temporary-access-at-rest has a separately observed blocker, requiring established control-plane remediation and fresh verification. No permission to bypass.
- The prior localhost login was not a product acceptance. Never ask the owner to test with an unverified Preview operator login; no Production authentication fallback or account/password resets.

These are state observations, not immutable estimates. Recheck at each phase exit and annotate the actual commit, CI, tested deployment and reviewer acceptance.

## Phase 1 — Shared foundations and primitives (starts in #1246)

**Ship:** the Workbook v4 **replacement** design system, shared by WAKILISHA and MIZIZI.

1. Inventory actual use of canonical src/design-system/wakilisha.tokens.css and packages/design-system/src/wakilisha.tokens.css, package exports, src/styles/wakilisha-fonts.css and workbook font faces, index.html preload policy, route-specific CSS, existing primitives, and major consumer classes. Require token parity and no conflicting competing runtime authority.
2. Finish self-hosted Figtree (400–800) and IBM Plex Mono (400/500) delivery, source/licence/SHA audits, CSP and correct critical preloads. Keep legacy font faces only for *named unmigrated consumers*; retire them as those consumers move rather than duplicate preloading forever. Preserve culturally and linguistically correct glyph fallback.
3. Converge mode/accent, fixed brand green, evidence standings, spacing (4px base), radii (artwork 8, controls 12, cards 16, sheets/heroes 24, actions full pill), 44px touch size and reduced motion across the canonical CSS and TS/package surface.
4. Consolidate reusable React Aria-backed navigation, buttons, fields, segmented controls, menus, sheets, modal/focus, tabs, status/unknown, player dock and graph legend. Prevent route-specific unscoped CSS from overriding shared semantics; preserve existing public/admin behavior.
5. Complete working two-brand/two-mode specimens in existing admin design-system inspector. Inspect real font loading, theme switching, input alignment and mobile overflow, including 390/480/768/1024/1280/1440 viewports.

**Exit:** source/package token parity, current CI + browser security/playback, no third-party font loads, responsive/keyboard/focus/contrast checks and actual comparable owner-reviewed design renders. All affected consumers are enumerated and their migration outcome documented; no unsafe site-wide activation. Close/merge existing #1246 once this is achieved, not at token compilation alone.

## Phase 2 — WAKILISHA-wide design convergence and shipped refactor

**Ship:** current WAKILISHA functionality with Workbook v4 visual/interactions across public, account and admin surfaces, not a subset of photogenic routes.

- Audit the actual route manifest; assign all live routes to a shared shell or a documented domain-specific exception. Prioritize home/music/search, charts, artist/recording/releases, player, editorial/articles, profile/social/messages, onboarding/settings/forms and admin operations.
- Move surfaces to Phase 1 navigation, type, tokens, imagery rules, controls, status meanings and responsive layouts. Preserve original logo and music credit statuses. Retire redundant v5/one-off styling after each caller migrates.
- Preserve playback quality/captions, search and current Registry API behavior, permissions, uploads and existing user data. No opportunistic backend rewrite under a style PR.
- Verify accessibility, language, major flows and visual parity across accepted viewports. Audit performance and critical player/browser behavior; keep existing regression suites consolidated.

**Exit:** the complete audited WAKILISHA route inventory matches Workbook v4, or has a narrowly documented product exception. Actual authenticated and public routes render and interact correctly; deploy frontend via existing process with rollback and Production check. WAKILISHA redesign can be closed independently of unfinished MIZIZI domain work.

## Phase 3 — MIZIZI Headquarters M1–M5 and lawful decision engine

**Ship:** a real, case-first Headquarters experience matched to MIZIZI v3 screens and Product v4, using #1244 and its already-open backend chain.

- M1 Workbench: the precise 248px v3 rail, 64px toolbar, responsive collapse, case switcher, source-true 5:8 artefacts, real immutable questions, hypotheses and sources, case/history, explicit evidence standings, credible per-question read model and DB05 Hold.
- M2 Review: authenticated one-question-at-a-time assessment, frozen exact revisions, competing choices, human independence and adverse-impact/undo analysis, recorded decision/operation distinction. Never assert real ACH grades, verified families, verdicts or rights without new independently accepted authority.
- M3 Orion: pan/zoom graph and text/list alternative from *typed recorded edges*, inspect exact IDs and source-specific links, with accessibility/keyboard/touch parity. Neither proximity nor a name match proves credit ownership or rights.
- M4 Evidence: real attention queue, consent/use basis, source families, custody and translation controls, reviewed items and revocation without displaying private material on public routes.
- M5 Outcomes: source-backed state transitions, remaining uncertainties, immutable outcome receipts, calibration from real historical data only and approved publication requests. No fabricated percent, consumer, audit or delivery.
- Consolidate/land existing #1243 → #1248 → #1249 → #1250 → #1251 only in approved dependency order. Complete missing independent ACH adjudication with the existing human authority, not automatic source hints. Rebase/reconcile #1244 with Phase 1 shared primitives before integration.

**Exit:** signed-in authorized member can go case → question → recorded evidence assessment → governed review → outcome, and nonmember/stale/revoked/held actions fail closed. Real v3 M1–M5 desktop/mobile parity and keyboard/touch acceptance; exact-head protected CI and resolved Production security status before deployment. Authenticated preview must be verified first, without borrowing Production passwords. Merge and deploy correct SQL/Edge/frontend surfaces in normal order; actual Production confirmation before marking delivered.

## Phase 4 — MIZIZI Field, Contributions, Public Record, Organization and final closure

**Ship:** the full MIZIZI v4 product beyond Headquarters, reusing proven WAKILISHA and Registry primitives.

- M6 Field: source capture, real custodian permissions, offline/on-device resumability, immutable originals, provenance hashes, retry/recovery, private metadata and supervisor review. Never claim successful upload from a simulated local preview.
- M7 Contributions: individual, group representative and estate capacities; identity/mandate validation; original-language statement, checked translation/custody, controlled disclosure, correction and withdrawal/revocation.
- M8 Public Record: WAKILISHA-endorsed, bilingual, accessible source-redacted canonical revision; only human approved/publishable findings and change history, with removal/revocation reflected exactly.
- Organization: customer-authorized catalogue requests, members, scoped Changesets, independent rights/tenant permissions and real downstream outbox/ACK/correction receipts. No invented customer, licences, partner access or outbound delivery. External dependencies must be identified as conditional, not certified by mock data.
- Verify Field → Contributions → Headquarters → approved public Record and Organization as applicable with exact IDs and receipts. Consolidate documentation/tests, clean disposable artefacts, close superseded issues/branches, execute individually approved deployment steps and the normal Production Finish Update when appropriate.

**Exit:** every MIZIZI v3 M1–M8 surface plus Product v4 Organization has real responsive UI and permitted interaction paths, with no unsupported evidence or rights claims. Real authenticated/denied/offline/stale/accessibility/translation/security tests pass. All intended public and private surfaces are deployed and independently verified; no critical unresolved release blocker, orphaned draft or unsupported feature is described as finished.

## Operating rules and proof, across all four phases

- **No phase inflation:** these are four product objectives, not four guaranteed PRs. Reuse #1246 and #1244 and existing domain PRs. No new PR unless an actual missing code ownership boundary requires it.
- **No duplicate gates:** reuse the protected Critical Control Plane, real browser, SQL/JWT and release controls. Tests are consolidated into existing contracts; no permanent milestone-only workflow and no growing fake-data fixtures.
- **No green by inheritance:** verify the exact commit. A previous head's successful checks do not establish a later head. Draft PRs stay draft until ready.
- **No user Mac delegation:** GitHub-connected read/edit and existing CI are default. If access really requires the owner's machine, explain a single specific, necessary action, only after remote options are exhausted.
- **No conflating environments:** code committed ≠ PR approved ≠ Preview SQL migrated ≠ frontend deployed ≠ Production accepted. Report all separately.
- **No fabricated acceptance:** source-authenticated fixtures, source use and cultural consent are verified, not generated from an example HTML. Product v4 samples are fictional reference contents.
- **No global silent overrides:** comprehensive route inventory and precise feedback before replacing browser/user settings, artwork, visual assets or legacy behavior.
- **No fake “complete”:** a phase is closed only when functions and design work are both real, accepted and deployed to the stated surface.

## Living delivery ledger

| Phase | Start state | Current branch/PR | Next required real work | Exit |
| --- | --- | --- | --- | --- |
| 1 | IN PROGRESS, shared token/font base coded, consumer/preload debt | existing #1246 | eliminate legacy critical font preload conflict; inventory shared primitives, CSS and consumers; real parity | NOT MET |
| 2 | NOT STARTED as comprehensive site-wide replacement | reuse WAKILISHA route ownership | full route inventory/migration and Production acceptance | NOT MET |
| 3 | IN PROGRESS, case/holds/questions available in draft, end-to-end absent | #1244 + #1243/#1248–#1251 | complete source-true ACH, M1–M5 exact UI, authenticated full journey | NOT MET |
| 4 | DOMAIN FOUNDATIONS ONLY | reuse MIZIZI/WAKILISHA authorities | M6–M8, Organization and full release closure | NOT MET |

**Scheduling:** original broad planning envelope 13–21+ dedicated senior engineering weeks overall (not a deadline), subject to actual consumer inventories and external Organization dependencies. Reduce calendar time through parallel independent domain work, not by omitting acceptance.

**Immediate action:** finish Phase 1's critical font-preload mismatch within #1246, update the same font audit and preserve old faces for named unmigrated consumers. Then continue the shared-primitives/consumer inventory. Do not open another workstream merely to record progress.
