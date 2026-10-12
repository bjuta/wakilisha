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
