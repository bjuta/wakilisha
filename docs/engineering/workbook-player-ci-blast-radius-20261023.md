# Player UX and Critical CI blast-radius decision — 2026-10-23

## Accepted authority

- Production before this change: `f53c9064e6b585d483d76c5ad40a3a935fe2b95e`.
- Workbook: `MIZIZI WAKILISHA Brand Workbook (2).html`, §§14,17.
- Product owner approved the **frontend presentation-shell change only**. The existing authentication, Registry, media playback engines, provider connections, queue, transcript publication, timestamped comment API, and release workflow remain authoritative. **No whole-track comment mutation model or Auto theme was approved.**

## Scoped implementation

1. Preserve the routed content tree when opening/closing Now Playing. Phone: player overlays an inert, mounted base page; desktop: measured sidebar stays mounted and the player fills only the remaining area.
2. Desktop Lyrics, Queue, Transcript, Chapters and Comments mount into a stable inline React portal host. Only a single contextual panel is open at a time. Comments still use the accepted timestamped comment authority. The phone retains native-sized presentation sheets. No fake whole-track comments.
3. Keep player sessions inside the existing PlayerProvider and ProviderPlaybackCanvas. Pass only a **presentation panel selection** from desktop dock to expanded surface; no new backend effects.
4. Cache bounded per-track Lyrics and Transcript fetch promises while the full-player component is mounted. Retry failed reads, and keep publication/error semantics unchanged.
5. Expose the already-implemented guest Light/Dark theme and public Settings on both phone and desktop, with direct Sign In.
6. Restore Critical Core's previous `npm run performance:audit && npm run build:app` job and its strict verifier **byte-for-byte**, without touching the canonical Production `npm run build` or its runner.

## Test inventory and blast radius

- Eight workflows inspected: the universal protected Critical Control Plane, three production MIZIZI control planes, disposable MIZIZI and WK100 security workflows, a scheduled public runtime watch, and reviewed repository migration promotion.
- Protected Critical Core has 47 named workflow steps, 60 explicitly named `test:critical` files, and 44 direct test-file references across step commands (39 unique). 48/60 `test:critical` files read source using `readFileSync`; this is *not* a basis to discard them, because many contain independent SQL/authority and pure-logic assertions.
- Exact duplicate execution within Critical Core: Video V4A source suite runs 3×; Video V1, V2 and V4B suites each run 2×. That is 5 unnecessary re-invocations **candidate for consolidation only after verifying independent acceptance and timing**; their tests are still authoritative. A MIZIZI durable-case operator test runs once in `test:critical` and again in a dedicated step, with distinct contextual grouping.
- One full Production build redundantly audits responsive images inside and outside `performance:audit`. **Do not change the Production build** just to save this time.
- Existing browser and UI DOM gates are retained. Added only a fast component lifecycle test for mobile/desktop route identity across repeated player transitions, plus real guest theme clicks in the existing Playwright surface.
- Two obsolete static test expectations were repaired in-place: requiring baseLayout/full-player tree replacement and denying the quiet Preview line, and requiring the removed phone Account header button. No suite or test was removed.

## Acceptance before merge

- CI: existing required Critical Core + Critical Browser green on exact head **once**; CI uses restored fast Vite build.
- Runtime: switching mini→full→mini does not remount the routed page, lose entered form state, navigate or restart media; desktop sidebar remains present during full-player expansion; Lyrics→Queue→Comments changes only the requested panel.
- Guest: Light/Dark on mobile and desktop works in-place without auth, reload, or private route access.
- Layout: phone player covers the viewport (with safe areas); desktop dock floats within measured sidebar-adjusted content; expanded desktop retains sidebar with inline contextual panel.
- Existing security, chart identity, migration, RLS, controlled audio provider, and timestamped comment contracts remain fail-closed.
- No deploy until exact-head gates pass, no simulated Production result. Production deployment requires the existing canonical runner, not a new release process.

## Deferred decisions (do not infer approval)

- Whole-track comments and seek-bar discussion ticks require explicit agreement on retained data authority.
- Auto appearance requires theme-service behavior approval.
- Do not delete Video/Registry test bodies for speed. An independent CI consolidation PR would need measured wall-clock improvement, one-run coverage equivalence, and rollback proof.
