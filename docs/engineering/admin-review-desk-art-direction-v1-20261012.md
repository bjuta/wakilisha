# All Reviews: A governed review desk, not a legacy dashboard

**Date:** 12 October 2026
**Status:** Draft PR design correction, not Production release authority
**Evidence:** Owner-supplied three-page full-page screenshot of `/admin/review/queue` at 14:17 EAT, and signed-in Field and History screenshots at 14:28-14:29 EAT.

## Why the old page fails

The main All Reviews page made nine migration workstreams and seven sample panels compete for attention. The default review list occupied roughly half the useful width and rendered 18 highly repetitive mini-cards, each carrying priority, status, type, heuristic readiness, missing artist text/slug fields and source UUIDs. Its first view was more of an engineering inventory than an operator decision desk.

The `loadStagingSummary()` service currently returns `[]`. The page rendered staging and other legacy counters as 0, creating misleading completion impressions. `loadReviewCommandCenter()` also loaded the first 18 newest Registry reviews without the active Open filter. That could put resolved rows under an Open-selected interface, undermining trust.

## New art direction

The page presents one meaningful activity at a time. It now has a confident editorial header, two **source-counted Registry workload figures**, a succinct writer-authority boundary, and one full-width review queue.

A review is a concise, human-readable line. It expands in place into the recorded issue, available source fields and exact review reference. Only the deliberate `Review Evidence and Decide` action enters the existing governed modal. Closed reviews show `Read Governed Record` and cannot obtain a new decision from the list.

The existing seven historical source panels and migration workstream links remain available in an accessible `WkDisclosure` below the active work. Historical import counts whose loaders return unavailable values no longer appear as authoritative zero-health metrics.

The design reuses `WkSearchField`, `WkSelect`, `WkDisclosure`, existing WAKILISHA button/status tokens, and the currently authorised Registry API. The visual system is information-led, not bordered KPI noise. The dedicated `review-desk.css` is fully scoped to `[data-wk-review-desk]`, uses only WAKILISHA tokens, and implements mobile/keyboard and reduced-motion behaviour.

## Strict authority contract

- Registry queue first-page fetch includes `status: "open"`. Initial total comes from the exact open Registry count, not from the first summary entry. Historical and non-Registry zeros remain out of the primary operator view.
- For Registry count failures, fail the page load instead of converting a query error into a reassuring zero.
- Search, status, priority, entity, and workstream filters call the existing exact-count paginated Registry read. Latest-request-wins avoids earlier slow responses rewriting newer choices. Page loads deduplicate by exact review ID.
- Each review retains its immutable source ID. Its view is not a new decision or evidence verification. Heuristic source-readiness tags have been removed from the list and never imply established truth.
- Decisions continue to call the existing `recordRegistryReviewDecision` writer and current public Track context/fingerprint requirements. No new writer, grant, queue table, SQL, Edge Function, or external delivery is added.
- Resolved MIZIZI History links now use `?record=<review_uuid>`, resolving through the exact existing authorised read. Open Cores actions retain `?review=<review_uuid>` and its open-only, decision-gated contract. The read-only modal has no writer callback.
- Do not confuse this interface-only change with Slice 1's remaining runtime/operator exit gates or advance Slice 2 public disclosure and Slice 3 partner-delivery powers prematurely.

## Acceptance gates

Protected CI: source contract, migration/schema drift, browser design-system debt, TypeScript build, security/lifecycle and real-browser core suites. Owner local desktop and 390px checks: default Open rows, workstream filters, multiple source previews, exact review-route, read-only resolved deep link, historical source disclosure, keyboard focus, scroll, and no lost data. Keep draft until all are proven.

## Owner acceptance follow-up — 12 October 2026, 15:01–15:03 EAT

The owner supplied a 2-page desktop full-page screenshot and an 8-page mobile screenshot from the signed-in local Review Desk v2. This evidence verifies the core page hierarchy, 225 open Registry reviews, 198 high-priority, Chart Labels filter with 27 matching and 18 loaded, and the bottom historical-source disclosure. It also rejects any claim of visual acceptance: all 18 loaded Chart Label entries repeated essentially the same technical fallback title, and mobile rendered that duplication across long consecutive pages. The floating AdminShell hamburger partially covered the header eyebrow.

**Root cause:** `scripts/registry/phase4a6-chart-provisional-registry-writes.ts` generates `Chart provisional <entity> from <source table>` when the source row has no recognised title, artist or label. The `wkcharts_track_label_missing_reference_queue` review population is built from exact per-source `md5(row_to_json(src)::text)` source hashes. Matching titles are NOT evidence of duplicate records, nor can they be safely batch resolved.

**Product correction:** Group three or more **loaded** rows only when they share the same generic chart title, review type, source table and recorded status. Grouping is a purely client-side inspection affordance, not a new Registry entity or decision state. Default to the issue heading grounded in the source-table contract (e.g. `Chart tracks missing label references`), the single source summary, and the number of **loaded** distinct review records; expand to see the first six, then reveal six at a time. Every record remains independently identified by immutable Registry review UUID and exact source hash, with its own evidence preview, eligibility check and governed decision path. Server pagination remains in place; no group ever claims to cover un-fetched reviews, and there is no batch approval. Where `candidate_payload.evidence` has a recognised nonempty title, label, artist, slug or source ID, display that exact recorded value. Otherwise show a clearly labelled **source fingerprint** from the recorded source hash instead of repeating the technical table name as a consumer-facing title. The exact original technical fallback remains available inside record details for audit traceability.

**Mobile art-direction correction:** reserve the AdminShell hamburger lane at narrow widths, make the two real current-work figures compact side-by-side, reduce non-actionable governance-copy height, keep meaningful results and identity visible early, and ensure group/child disclosure controls are keyboard-and-touch accessible. Never compensate for eight pages of identical rows by deleting source rows or hiding them from available filters.

**Tests:** extract pure issue-grouping and source-label functions into `reviewDeskPresentation.ts` and test source ID preservation, status/table separation, no automatic grouping of informative titles, genuine recorded evidence precedence, and three-record threshold. Extend existing review desk source contract assertions. Hold PR #1227 draft until protected CI, desktop and 390px signed-in owner acceptance have passed for the exact head. No new database, writer, decision type, migration or Production deploy.
