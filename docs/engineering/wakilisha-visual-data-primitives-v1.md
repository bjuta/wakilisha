# WAKILISHA — Visual Data Primitives v1

**Status:** Site-wide engineering and product design specification. Implementation is staged; names below are proposed contracts, not claims of shipped components.
**First proving ground:** MIZIZI Headquarters inside the shipped Admin Studio shell.
**Reusability:** Registry, Artist Studio, Charts, People, Events, Venues, Community, Payments, editorial and future enterprise.
**Authority:** Built WAKILISHA product and its data/permission contracts; the supplied \`mizizi.html\` is an interaction reference, not a design-token, mock-data or source-code dependency.

## 1. Product objective: meaning before reading

An operator should be able to see **what changed, what needs attention, who/what it affects, why, and what happens next** in three seconds without deciphering paragraphs or technical IDs. Longer copy remains available when someone asks for explanation.

Every data graphic has a visual answer at glance and a precise accessible answer on inspection:

- Shape tells the kind of thing (person, recording, release, claim, event, payment).
- Position and connection tell relationship and sequence; **no edge without a verified relationship**.
- Size or length tells a comparable magnitude, with the denominator and unit visible.
- Hue tells a category or operational state, never the sole signal: shapes, patterns or labels must also distinguish states.
- Motion tells **a real change in data**, not a fake 'working' pulse; reduced motion and static fallbacks are mandatory.
- Interaction reveals source/provenance and actions; no graphic can grant rights or silently change a governed case.
- Media depicts the real associated recording/release/artist only when approved source imagery exists. No inferred or AI-fabricated cover.

**Do not** port prototype ochre/soil palette, typography, decorative roots, client names, fictitious licences, made-up accuracy numbers, generated graph edges, simulated deliveries, pseudo-real activity bursts, or native browser chrome.

## 2. Existing platform inventory (verified in repo)

- React 19, react-aria-components 1.21.1: keyboard, overlays, custom controls.
- Recharts 3.2.0 already powers charts in Admin Analytics: reuse chart mechanics instead of adding another generic chart dependency.
- Current WAKILISHA components: WkSurface, WkButton, WkTabs, WkSelect, WkSearchField, WkDateTimePicker, WkIcon.
- Registry has real track/release artwork_url fields, and current track-search services fetch them. An artwork URL does **not** by itself prove a licence to redistribute an image; preserve the current product media/permission rules.
- Authenticated Registry/MIZIZI review source already returns real counts and case IDs; exact source payloads vary by case type. DESIRE carries recording-peer evidence; many other Release public-identity conflicts carry a specific currentValue slug instead.
- Current code has route-splitting, performance, UI DOM, and real-browser CI acceptance. Visual charts/graphs must remain lazy and under the same controls.

**Authority ordering:** current product -> typed operational data -> verified evidence -> reusable presentation layer -> page composition. Existing design-system code is a starting toolbox, not the final UI authority.

## 3. Shared architecture: five layers

1. **Source adapters**: read only from authorized existing Registry/analytics/media/services. Preserve source identifier, permissions, timestamps, status, scope, and evidence links. No direct unscoped client SQL inside a generic visual primitive.
2. **Semantic projections**: map each domain into presentation-safe types. Maintain 'unknown', 'unverified', 'withheld', 'stale', 'empty' and 'denied' separately from a genuine zero. No fabricated fields. Do not conflate claim confidence with truth or case status with licensing.
3. **Vector building blocks**: small SVG/React accessible components in a new shared module such as src/components/data-viz/. Avoid canvas by default for simple charts/marks. Token-driven, dark/light-aware, CSS-variable styling. React Aria for interactions.
4. **Composed visualizations**: domain-independent legends, timelines, plots, network viewport, chart viewport, map viewport and artwork rows built atop the blocks. Recharts behind adapters where useful. Optional canvas renderer only for dense networks if measured and fallback exists.
5. **Domain compositions**: MIZIZI, Charts, Artist Studio, finance, etc supply statuses, narratives, source adapters and allowed actions; they do not fork graph engines or invent semantic colours.

### Proposed shared minimal contracts

- VizEvidenceRef: source entity type and ID, source kind, observedAt, verifiedAt (optional), permitted evidence destination. Never use a display label as proof of identity.
- VizDataState: ready | loading | empty | withheld | forbidden | stale | error | partial. Unverified remains explicit where it describes evidence rather than load state.
- VizCategoryKey: stable domain-provided key + human label + optional icon/pattern; semantic palette role not arbitrary per-component hex.
- VizMetric: finite numeric value + unit + denominator if ratio + comparison basis/window + exact/as-of timestamp + source ref.
- VizSeries: ordered time-zone-aware instants and values with aggregation type (sum/count/snapshot/rate), sampling interval, gaps, uncertainty and source refs.
- VizNode: stable typed entity ID and label (person/artist/recording/release/claim/event/venue/organization/etc) + provenance/access. No guessed coordinates.
- VizEdge: stable ID + verified from/to node IDs + relationship type, status, evidence ref, valid-time interval if known; NEVER infer ownership from performer/credit edges.
- VizGeoPoint: documented coordinate, precision, geocode source and semantics (venue, event, reported region etc); don't silently place scene labels on literal maps.
- VizArtwork: authorized URI, media kind, rights/display authority, canonical entity ID, alt text, optional size/srcset/fallback.
- VizTimeWindow: UTC instants, IANA zone, granularity, display locale, source freshness, update cadence; no local-wall-time arithmetic for DST boundaries.
- VizInteraction: selected IDs, hovered IDs, user-visible filters, zoom, pan, focus, inspect and reset. All controlled/persistable by domain composition; selection does not mutate data.
- VizAction: verb, required capability, source authority, confirmation/reversibility and resulting receipt. Visual components NEVER authorize actions themselves.

All zero/unknown/denied/pending data states have their own intentional artwork-free and number-free fallbacks. All chart-series arithmetic is performed by a tested projection rather than silent convenience formatting inside a component.

## 4. Primitive catalogue and public names

**Key:** A = shared foundation to implement first; B = common composition; C = domain-dependent, ship only with verified data.

### 4.1 Identity and semantic marks

| Primitive | Level | Meaning / rule |
|---|---|---|
| WkEntityGlyph | A | Shape for recording, release, artist, person, organization, claim, event, venue, transaction. Distinguishable without hue. |
| WkStateMark | A | Compact icon + shape + accessible state name; operational statuses mapped explicitly by domain. |
| WkStateKey | A | Legend explaining every visible mark, including unknown/stale. Keyboard-readable, not colour alone. |
| WkSeverityMark | A | Urgency separate from workflow state; do not signal 'blocked' as generic 'high priority'. |
| WkEvidenceMark | A | Source present, independently corroborated, contradicted, copied/echo, unverified, or withheld (only if actually proven). |
| WkFreshnessMark | A | Last confirmed, stale, scheduled, failed load. No 'Live' indication without real renewal. |
| WkChangeGlyph | A | Added, removed, changed, unchanged; before/after semantics with accessible labels. |
| WkSourceCount | B | Count *independent verified sources*, not raw duplicate records. |
| WkMetricReadout | A | Numeric + unit + denominator/as-of and honest 0 vs unknown states. |
| WkProgressTrack | A | Determinate 0–100 only with authoritative total, otherwise indeterminate labelled status. |
| WkRatioRing | B | Compact progress/ratio for one valid numerator+denominator (SVG with textual equivalent). |
| WkDeltaMark | B | Signed value/movement with comparison window; never rely on arrows without numeric meaning. |

### 4.2 Charts and quantitative vectors

| Primitive | Level | When to use |
|---|---|---|
| WkSparkline | A | Tiny real ordered trend; no invented intermediate points. |
| WkBarChart | A | Comparable quantities, horizontal for longer labels. |
| WkStackedBar | A | Parts within a shared total or a sequence of discrete states. |
| WkDonutChart | A | Two–five mutually exclusive parts; show values and total outside arc. |
| WkPieChart | B | Few clearly distinct proportions; use bars if comparison or small differences matter. |
| WkLineChart | B | Same-unit ordered trend, real time axis, visible gaps. |
| WkAreaChart | B | Genuine cumulative/volume series, not arbitrary emphasis. |
| WkThresholdChart | B | Measured metric vs an authoritative, date-scoped threshold. |
| WkTrendBand | B | Trend plus sample/uncertainty or permitted confidence range, not invented precision. |
| WkDotPlot | B | Small comparative ranked/ordered groups. |
| WkHistogram | B | Distribution of numeric values with disclosed binning. |
| WkScatterPlot | B | Two meaningful measured numeric variables, selection and brushing. |
| WkHeatmap | B | Calendar/time buckets, cohorts, matrix categories, missing-day semantics. |
| WkBumpChart | C | Chart rank movement with dated ranking editions and tie treatment. |
| WkFunnel | C | Real sequential conversion stages with explicit denominators. |
| WkWaterfall | C | Reconciled movements of money/counts; start/end tie to ledger. |
| WkFinancialSeries | C | Currency-aware series, FX/source/rate/date rules; no fake financial projections. |
| WkRangeTimeline | B | Event/duration segments, ongoing/uncertain interval appearance. |

### 4.3 Network, geography, relationships, evidence

| Primitive | Level | Meaning / rule |
|---|---|---|
| WkGraphNode | A | Shape, label and selection focus for typed cultural entity. |
| WkGraphEdge | A | Explicit verified relationship with directional/temporal semantics. |
| WkGraphLegend | A | Entity shapes + relation types + meaning keys + count of hidden/filtered nodes. |
| WkGraphViewport | B | Pan/zoom/fit/reset/focus controls, keyboard/touch interaction, scale bounds. |
| WkGraphCluster | B | Aggregated node count with drilldown and an explicit 'clustered' label. |
| WkRelationshipGraph | B | Authorized multi-hop Registry links. Must not imply inferred identity. |
| WkProvenanceLayers | B | Evidence categories/layers, corroboration vs copies, expandable source receipts. |
| WkClaimComparison | B | Side-by-side candidates, identifier/audio metadata comparisons, undecided state. |
| WkDecisionPath | B | Reviewed stages and checkpoints, clear blocked and pending nodes. |
| WkDependencyMap | B | Shows real blocked-by vs related-to relations and affected scope. |
| WkGeoPoint | A | Actual geo coordinates with documented precision and attribution. |
| WkGeoClusterMap | C | Venue/event/place map backed by real coordinates; not an imaginary 'cultural scene' map. |
| WkDistributionFlow | C | Sankey-like directional totals where links really exist and conservation is checked. |
| WkEventLane | B | Swimlanes for case/job lifecycle, source-time and received-time distinction. |

### 4.4 Media, time and cross-visual controls

| Primitive | Level | Meaning / rule |
|---|---|---|
| WkRecordingArtwork | A | Canonical artwork thumbnail, true source/alt/ownership, bounded sizes, lazy loading, neutral fallback. |
| WkMediaEntityRow | A | Artwork + title + verified artist context + status + selected action without wordy repetition. |
| WkMediaComparison | B | Two actually distinct media candidates with real duration/ISRC/artwork provenance. |
| WkWaveform | C | Real audio waveform only with media-derived peaks; no decorative/random bars posing as audio. |
| WkChartLegend | A | Custom visual/shape keys; clickable toggles with selected values retained and accessibility. |
| WkChartTooltip | A | Source/time/value/unit/denominator with honest data caveats, keyboard equivalent. |
| WkChartSelector | A | Custom segmented/filter/scope controls via React Aria; no browser-native select chrome. |
| WkZoomControls | A | Accessible zoom in, zoom out, fit, reset, actual level, keyboard shortcuts. |
| WkFocusLens | B | Selected node/point inspector with keyboard accessible open/close and deep-link. |
| WkTimeRangeBrush | B | Interactive range selection that preserves exact UTC window and zoom state. |
| WkZonedTimestamp | A | Instant from source shown in chosen IANA zone, with explicit zone abbreviation and source absolute time. |
| WkZonedClock | B | Actual time now, updated at a bounded cadence, pause when hidden; not fake live telemetry. |
| WkTimeZoneSelector | A | Branded searchable IANA selector, persisted only with appropriate user authority. |
| WkLiveStatus | A | Streaming/polling/offline/as-of state only according to real connection/refresh success. |
| WkChartEmptyState | A | Exact 'no matching data', 'no authorized access', 'not collected', 'error', 'stale' states. |
| WkDataTableFallback | A | Accessible equivalent for chart data, downloadable only if export authority permits. |

### 4.5 Shared compositions, not primitive reimplementations

- WkDashboardSummary: dense but readable status overview + metric readouts + distribution + next action.
- WkWorkstreamOverview: ranked bars/chips/presentation of permitted workstreams with direct drilldown.
- WkAuditActivityTimeline: real, timestamped lifecycle events and user actions; time-zone selectable.
- WkEvidenceWorkbench: entity title/media, provenance layers, verified relation graph and next governed action.
- WkRecordingTaskQueue: artwork-aware list with semantic mark, stable source ID, useful short title, filters and keyboard selection.
- WkTemporalStatusBoard: scheduled/running/failed/waiting jobs with state + freshness, real source updates.
- WkRightsScopeBoard: only when actual rights/licence grant source, scope, expiry and action authority exist.
- WkDeliveryDiff: only when an actual delivery artifact/receipt exists, with before/after and safe rollback authority.

## 5. Visual grammar: token mapping, not a second theme

Keep WAKILISHA's shipped typography, spacing, shell, light/dark surfaces, contrast/focus behaviour. Introduce a small semantic *mapping layer* of state roles such as verified, open, blocked, disputed, pending, stale, neutral and unknown. Roles may reuse existing brand/positive/caution/danger/info tokens. **No literal HTML-prototype colours**, no hard-coded arbitrary palette per chart.

Colour keys must satisfy:
- A recorded state has one meaning regardless of feature route. Shape or stroke pattern communicates the same meaning in greyscale.
- Entity kind and operational status use **different visual channels**, e.g. square recording node + outlined amber-style blocked halo (actual shipped tokens, not mandated amber).
- Distinguish confirmed vs disputed vs missing vs 'not measured'. Missing is not a zero, and 'blocked' is not a measurement.
- Contrast and active selection meet the current WAKILISHA accessibility bar.
- For charts with many categories, repeat a deterministic category-key -> assigned stroke/pattern mapping across graph, key, tooltip, export.
- Never express provenance authority or legal ownership by decorative color.

## 6. Data truth: examples in MIZIZI

**What is already demonstrable from the currently authorized Registry queue**:
- Open and resolved counts (current owner screenshot: 225 open, 76 resolved; these are time-scoped, not constants).
- Open workstreams (same screenshot: 149 Music Identity & Credits, 49 Chart Links, 27 Chart Labels).
- Exact #1094 DESIRE decision already recorded but blocked on archived Lilmaina Artist credit; Ficha and Colors verified complete via existing independent receipt verifier.
- Distinct recording title + artist reference for DESIRE where recorded peer evidence corroborates it.
- Other Release public-identity cases have their source currentValue slug; do **not** invent a Release title/cover from slug.
- Exact review timestamps; only present lifecycle lines for timestamps actually recorded.

**Not yet proven as a product source and therefore NOT SHIPPABLE as an active graphic**:
- An 'overnight MIZIZI did X' animated history, without verified structured operational events and ingestion window.
- Cross-catalogue artist–recording topology from fabricated people/credit links.
- Licence accuracy sparkline/automated grants without signed grant/risk measurement events.
- Client outbound delivery success/rollback without actual outbound receipts.
- Track waveform without authorized source audio and actual extracted amplitude data.
- A thumbnail inferred from an entity name or remote search instead of a source-authorized media record.
- A running/live indicator that animates despite no fresh server events.

### Suggested first MIZIZI screen conversion

1. Top: compact visual status distribution, open vs resolved, explicit totals and snapshot time; no full-screen copy block.
2. Next: three ranked workstream bars (149/49/27 in current snapshot) and one **short** line of operator interpretation.
3. Session choices: 5 / 15 / 60 remain large custom affordances; selection opens visual progress rail and one recording-centric case at a time.
4. Worth Knowing: three compact case rows with entity glyph / artwork where available, clear distinct blocked or complete state mark, and one-click Cores.
5. Cores: media-first bounded list (artwork only when canonical and permitted), real evidence relations and provenance layers; selected case not a generic copy paragraph.
6. Field: only actual Registry relation graph and known coordinates if applicable; otherwise honest workstream network/chart. Pan, zoom and fit available only when graph data exists.
7. History: exact lifecycle event lanes with zone/time source and gap reporting, not generated activity traces.

## 7. Chart interactions, accessibility, performance

- All interactive graphics support pointer, touch, keyboard, screen reader, high contrast and prefers-reduced-motion. An accessible chart table/list alternative is always present or reachable.
- Never trap focus in an SVG/canvas. React Aria controls own actual inputs, menus, selectors and inspectors; visible chrome is WAKILISHA custom.
- Graph selection is URL-deep-linkable if authorized, with deterministic focus and selection restoration; private entity keys are not exposed publicly.
- Zoom/drag have explicitly visible plus/minus/Fit/reset controls, touch targets, boundaries and shortcuts. Panning never hijacks page scroll without a clear focused viewport.
- Only fetch necessary rows and columns. Aggregate heavy graph datasets server-side where authorized. No per-node N+1 source calls.
- Lazy-load complex graph and chart code by route or view. Prefer SVG for smaller visualizations and measure before adding canvas/WebGL; cap, cluster and simplify large graphs.
- Charts handle zero values, nulls, skipped time bins, outliers, DST, animation off, browser resize, offline, partial and denied data without silently joining gaps.
- Every plotted mark is backed by a stable source ID or aggregate definition and offers inspect/evidence. Do not add 'Export', 'Approve', 'Undo', 'Grant', 'Pause Writes' or 'Live' controls without real authority.
- Visual regression at desktop/tablet/390px, axe keyboard and colour-blind/greyscale pass, event/relationship projection unit tests, source provenance checks, latency/memory and bundle checks, protected CI, signed-in owner acceptance.

## 8. Engineering slices: three, not dozens

### Slice V1 — Trustworthy visual vocabulary and MIZIZI brief
Ship A-level status/entity marks, deterministic status/legend mapping, distribution/stacked bar, count readout, progress rail, source-aware artwork thumbnail, zoned timestamp/selector, chart empty/table fallback and complete tests. Replace repeated Brief copy with visual summary and workstream comparison **using currently authorized data**. No source-schema migration. Accept mobile before moving on.

**Exit:** 3-second glance differentiates open, resolved and blocked without reading paragraphs; status remains accessible without colour, record counts reconcile to queue, thumbnail fallback never fabricates media, source timestamp is explicit, no new eager admin bundle, owner confirms on actual screen.

### Slice V2 — Evidence relationships and interactive investigation
Ship graph node/edge/legend/viewport/zoom/fit, provenance layers and decision path. First use on a strictly bounded, real Cores subset with known source relationships; do not invent edges for unverified claims. Show selected recording/media and verified evidence. Add keyboard and touch graph acceptance.

**Exit:** every edge is attributable, first case selection/read is accurate, no case cross-contamination, no private graph leaks, fallback works when evidence relationships are unavailable; 390px/desktop and protected CI green.

### Slice V3 — Temporal analytics, media and cross-site adoption
Ship real activity lane/trend/heatmap, additional Recharts wrappers (donut/pie/line/area/scatter), time-range brush and zoned operational clock, then apply shared components progressively to Chart pages, Artist Studio and other routes. Only unlock workstream-specific licensing, money, media and delivery visuals after actual source authority is audited.

**Exit:** each migrated route retains existing task authority, independent source counts reconcile, no synthetic live data, no regressions in dark mode, SEO/performance, responsive, role boundaries or accessibility.

**Release control:** Maintain PR #1227 as a draft until its existing MIZIZI runtime, visual, JIT and security gates pass. Do not extend its database scope. Prefer a separately reviewed, reusable visualization slice for shared platform code; integrate MIZIZI through small, auditable import changes. No Production write, Edge deploy or merge merely because this specification exists.

## 9. Definition of done for each shipped primitive

1. Typed public props and data contract documented; reusable outside MIZIZI without importing Registry-private logic.
2. Visual meaning demonstrated with **source-backed** example and legitimate empty, error, loading, partial and denied states.
3. Accessible name/description and keyboard path; non-colour encoding; mobile and dark mode.
4. No fake live status, made-up coordinates, manipulated precision, invented album art, unsupported ownership, implicit grant/approval or side effect.
5. Focus/zoom/filters have deterministic state and cleanup; no timers or event listeners leak.
6. Unit + DOM + relevant real-browser testing; performance, route splitting, and source/permission checks green.
7. Current shipped-product visual comparison and product-owner acceptance before reusing broadly.

**Product test:** If a person cannot tell *what matters and why* from the visual structure before reading supporting copy, the primitive or composition is not ready.
