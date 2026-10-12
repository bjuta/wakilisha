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

## Operator acceptance interruption — 12 October 2026, 18:33 EAT

The owner ran the hash-verified local acceptance runner on exact draft commit `280c362e1e86e28175740439e3e8ddb396d80951`. It safely reached Vitest but stopped at `test/registry/admin-review-desk-presentation.test.ts`: 44 assertions/tests passed, one presentation test failed. This exposed a coverage hole: existing protected Critical Control Plane did not execute the newly added `admin-review-desk-presentation.test.ts` and `admin-review-desk-v2.test.ts` even though that run was green. A green CI run therefore did **not** establish complete acceptance for the new Review Desk.

**Cause:** one assertion incorrectly expected six groups from six distinct reviews. The pure helper legitimately returns five *display buckets*: `a1` and `a2` share their issue template/status/priority/source table and remain two source records in a two-record bucket (which does **not** render as an expandable issue group because the threshold is three). The other four records retain separate buckets by status, source table, meaningful title or priority. This is not a dropped Registry ID, nor an operational permission failure.

**Correction:** update the test to assert the exact five-bucket membership with all six immutable IDs in order. Add a nine-record invariant checking that 3 open-normal, 3 open-high and 3 resolved-normal reviews form three distinct display groups without conflating authority or losing IDs. Register both new Review Desk test files in the existing `npm run test:critical` command that the protected Critical Control Plane already runs, rather than introducing another CI workflow. Do not claim the fixed head green until that actual protected CI job completes; do not re-run owner visual acceptance until a pinned passing head is verified.

No application production code, SQL, Edge Functions, source review records, writer permissions, or deployments are changed by this correction.


## Owner signed-in desktop acceptance: MIZIZI Single review repetition (12 October 2026, 18:44 EAT)

The owner supplied a two-page, full-page local capture of the corrected Review Desk after the previous test repair. The first record was opened and a long run of other recorded reviews all shared the exact visible template `MIZIZI found a Single public-identity conflict`. The default Open view showed 225 open, 198 high-priority, and 18 of 225 records loaded. The underlying review IDs were not duplicates. **The previous grouping targeted only fallback chart-import titles** and left authoritative MIZIZI templates as an unhelpful wall of repeated text. The screenshot is a failure of operator legibility, not a reason to merge cases or automate human decisions.

**Source authority:** `supabase/migrations/20260925082706_public_music_identity_slice3_release_single_alignment_v1.sql` generates this exact title for an open, high-priority, `mizizi_data_hygiene` Release review against `registry_releases` with `source_payload.ruleId=release_single_identity_conflict` and `ruleVersion=1.4.0`. Each record also has exact `source_id` for the Release, recorded current slug in `source_payload.currentValue`, a `programmeCandidate` with current/proposed paths, and a candidate proposed slug. A proposed slug is not verified as a current public identity.

**Correction:** Treat that exact source template as an issue-first display group in the same pure helper as the chart fallback. Group only records matching every authoritative review type, entity type, source table, rule ID, rule version, title, status and priority. These are loaded-record **presentation groups only**, with three-record threshold and bounded expansion. Show current recorded Release slug on each child where present, otherwise the exact Release ID. Never substitute the proposed slug for a missing current slug. Current and proposed slugs may be inspected independently in each exact review's expanded source evidence, with the original issue title retained for audit. Single Release rows with different rules, versions, priorities, statuses, entity kinds or source tables must never share an issue group. All IDs and governed per-review decisions are preserved.

The page's original two-column record preview is retained for the exact selected review. Its issue heading should not be presented as evidence that cases have the same cause or that a batch decision is allowed. Registry read/write authority, SQL, Edge Functions, grants, deployment and Slice 1/2/3 boundaries are unchanged. Existing Review Desk tests are required by the protected critical command; new adversarial source-grouping tests must pass on exact draft head before owner acceptance.

## Operator evidence and Release decision authority block: 12 October 2026, 19:33 EAT

Owner supplied two desktop screenshots of the expanded Single Releases With Identity Conflicts group and its selected Release decision modal, plus a two-page full-page capture of the page before opening the modal. The expanded group now PASSes its source-identity navigation gate: 17 distinct loaded Release records, six independently browseable children, one exact reviewed case with current slug `roses-feat-tellaman-remix`, proposed slug `roses-remix`, original issue, Registry review ID, and per-record inspection. Next loaded-row expansion and mobile acceptance remain separate.

**Severe failure in the original generic decision modal:** the generic form renders `Source artist text/slug: Missing` for a Release identity case even though the accepted source stores Release and Track slug candidate evidence. It presents raw candidate/source JSON before guiding source verification and exposes artist-primary and featured-artist split actions that are semantically unrelated to `release_single_identity_conflict`. Its quick presets also prefill decision notes claiming `Verified` or `Authoritative evidence proves` without the operator supplying such evidence. Most importantly, the generic `recordRegistryReviewDecision` method inserts a generic record then marks the Registry review resolved, including for a `needs_more_research` decision. The accepted Release Single review programme is review-only until governed resolution; this legacy generic path would misstate canonical closure without an independent verified repair. The existing Public Music Identity Track writer is a different, rule-specific authority and is not permission to apply the Track contract to these Releases.

**Scoped correction:**
- Fail closed in the shared service for `mizizi_data_hygiene` Release reviews bearing `source_payload.ruleId=release_single_identity_conflict`, irrespective of display title or rule version, before generic decision insertion or review-status mutation.
- Route those reviews, including direct `?review=id` inspection attempts, to the existing read-only record modal instead of mounting the generic decision writer. Keep all source IDs, explicit current vs unapproved proposed slug, rule/version, recorded reason codes and raw candidate/source payload disclosure visible. Explain that a separately governed MIZIZI Release decision is required.
- Keep unrelated supported review modalities and Public Music Identity Track authority unchanged. No new Release writer, privilege grant or fake resolution action is introduced.
- Remove all canned notes from quick-decision presets. Selecting or changing a decision type resets notes, and the Record Decision button requires nonempty operator-entered notes in addition to existing writer validation. Selecting a preset is not attestation and cannot bypass source verification.
- The UX change and service guard are covered by permanent `admin-review-desk-v2.test.ts` source contracts already enrolled in protected `test:critical`. The UI must still undergo authenticated operator visual inspection after protected CI.

No SQL, migration, Edge Function, canonical mutation, execution grant, or Production release is authorized by this draft correction. Do not mark the entire Review Desk, MIZIZI Slice 1 or Slice 2/3 accepted until the appropriate governed Release decision contract and signed-in mobile acceptance are verified.
