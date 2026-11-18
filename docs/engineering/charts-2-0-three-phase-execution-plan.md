# Charts 2.0: Five-Source Kenya Top 100, three-phase execution plan

**Status:** Approved product direction; engineering implementation not started.  
**Decision date:** 18 November 2026 (EAT).  
**Target:** Existing Kenya `top100` programme and public chart routes.  
**Scope:** One repeatable consumption-led chart, one Admin operations workspace, one secure collector.  
**Out of scope:** Revival of WK100, new chart families, Spotify/Boomplay intake, retrospective reconstruction, and changes to `toprnb`.

## 1. Product contract and decisions already made

WAKILISHA's No. 1 song should primarily represent the song Kenyans are consuming most, while also reflecting cultural presence through actual, independently observed music activity. We will publish a **weighted composite of first-party Kenya-facing chart positions**, **not** a claim to know total streams or unique listeners across platforms.

The founder has committed to **Consumption-Led Cultural Presence v1** with these **fixed, source-specific weights**:

| First-party source | Behavior | Fixed share |
| --- | --- | ---: |
| YouTube Kenya Weekly Top Songs | Song-bearing audiovisual consumption | **30%** |
| Mdundo Kenya Top Songs | Music-service chart activity | **25%** |
| Apple Music Kenya Top 100 | Music-service chart activity | **20%** |
| Audiomack Kenya Weekly 100 | Music-service chart activity | **15%** |
| Shazam Kenya Top 200 | Music identification and discovery | **10%** |
| **Total** | **90% consumption-oriented, 10% discovery** | **100%** |

**No more weight-selection experiments are a prerequisite to implementation.** Do not silently rebalance sources, tune weights to particular songs, or infer Kenyan population shares from these percentages. A future weight change must be separately approved, versioned, and prospective.

The selected provider chart types must not be quietly replaced with Apple playlists, YouTube `mostPopular` video data, generic Audiomack global charts, Spotify editorial playlists, or third-party mirrors. The historical source archive is engineering reference material, not proof that today's unattended access, method, period, or original bytes are qualified.

## 2. Current repository and Production starting point

Verified at the Charts Reset closure and the subsequent current-main inspection:

- Protected `main` at documentation-planning baseline: `4a010e1611ebb8a1be92484c50b5533f3b1bc12f`.
- Public chart routes `/charts` and edition pages survive; their data client is `src/services/chartsPublic/*` (notably `v2Adapter.ts` and `client.ts`). Public pages live under `src/pages/charts/directory` and `src/pages/charts/edition`.
- Public database tables `wk_chart_programs_v2`, `wk_chart_editions_v2`, and `wk_chart_entries_v2` survive, as do `wk_chart_methodologies_v2` and `wk_chart_source_coverage_v2`. The shared publish guard calls `chart_assert_publishable_edition`.
- The `top100` programme currently exists with `chart_size=100`, `market_slug='KE'`, and the old `default_methodology_version='weighted_streaming_v1'`; `toprnb` also exists and must be preserved.
- Generic `chart_ingest_*`, `wk_chart_scoring_runs`, and related database objects survive, but the reset record states that no retained application code uses most of that pipeline. **Audit before reuse; do not assume these tables are active infrastructure.** Keep `chart_ingest_audit_events`, which still serves unrelated admin flows.
- The prior WK100 collectors, Edge Functions, Admin Charts engine, scheduler, ledgers, and raw-evidence Storage bucket have been retired. Production teardown and Storage deletion passed all nine canonical checks on 18 November 2026.
- Historical five-source research documented 100 Apple, 200 Shazam, 99 Mdundo, 100 YouTube, and 100 Audiomack positions for an earlier observation set. The retired capture originals were removed from Production as authorized. Historical source-method admissions and past private results are **not new-system collection permissions**.

Relevant references: [Charts Reset](charts-reset-2026-11-17.md), [archived WK100 source-access register](https://github.com/bjuta/wakilisha/blob/charts-archive-2026-11-17/docs/engineering/wakilisha-100-source-access-admission-register-v1.md), and [Charts Reset closure issue #1338](https://github.com/bjuta/wakilisha/issues/1338).

## 3. Phase 1: Source collection and immutable evidence

**Working outcome:** One restricted collector accepts five provider-specific methods and produces real, independently inspectable source receipts. No scoring or public publication is enabled.

### Build order

1. **Retained-system audit:** inventory the `chart_ingest_*` tables, grants/RLS, shared Registry helpers, existing API calls, and surviving logging. Keep what is compatible; introduce the **smallest** new source/capture/observation model needed. Do not build a second Registry identity authority.
2. **Source contracts:** define five immutable adapter contracts: provider chart key, exact first-party surface, KE market, ranked depth, native metric type, source identity fields, parser version, transport/method authority, capture cutoff, and source-native period classification. Each must distinguish `provider_period`, `provider_updated_at`, and WAKILISHA `observed_at`.
3. **One worker, five adapters:** implement a server-side `chart-collector` (provisional name) with source-specific retrieval/parse modules. Source methods must be independently verified for intended unattended execution; a successful old parser does not grant access. An approved researcher-origin upload remains possible if a specific autonomous method is not qualified.
4. **Private evidence:** use a new private Storage bucket and minimally scoped tables for source runs, immutable original-object keys/digests, parsed ranked observations, parser outcomes, operator actions, and exact-source freshness. Reject original replacement, checksum mismatch, duplicate positions, and mismatched market. Do not put raw rosters or privileged credentials in the public repository or browser.
5. **Operational controls:** implement authenticated `collect`, `import supported original`, `review result`, and `retry failed attempt` server actions. Each source attempt is independent and idempotent; retries preserve earlier receipts rather than overwriting evidence. Keep automatic scheduling **off** in this phase.

### Provider-specific completion conditions

| Adapter | Required facts and failure behavior |
| --- | --- |
| Apple Music Kenya Top 100 | Genuine observed ranked positions 1-100; correct first-party storefront/chart identity; daily observation time recorded, not backdated into a whole provider week. |
| Mdundo Kenya Top Songs | Record only observed positions. A genuine 99/100 response is `partial_depth`, never fabricated position 100. |
| Audiomack Kenya Weekly 100 | Verify provider-owned Kenya list, 100 ranked records where actually present, and genuine provider update timestamp; playlist update time is not invented consumption-week bounds. |
| YouTube Kenya Weekly Top Songs | Preserve the actual **song chart**, native song-view metric, provider-stated period/end date, and unresolved recording IDs without fabricated video IDs. Do not substitute the general video trending API. |
| Shazam Kenya Top 200 | Preserve the 200-position source depth and provider date/window if supplied. Recognitions are not audio streams, and missing provider recording IDs remain explicitly unresolved. |

### Phase 1 acceptance and delivery

**Acceptance:** All five sources have current, authentic first-party observations or explicit, inspectable `HOLD` outcomes identifying the exact blocking method/data. A phase cannot be reported as five-source **PASS** while any source is held. Verified originals are retrievable by authorized server operations with recomputed hashes; rank integrity, clock truthfulness, cross-source isolation, idempotency, private-access boundaries, and source failure recovery pass.

**Delivery:** One focused Phase 1 PR with adapter interfaces, necessary CLI-generated forward migrations, private Storage/RLS policies, source runtime, targeted existing-contract extensions, and operating notes. Production collector deployment may be disabled, but no unattended timer or public edition is activated.

## 4. Phase 2: Versioned scoring and one Admin Charts Studio

**Working outcome:** An authorized editor can prepare an edition from qualified receipts, calculate an explainable Top 100, resolve genuine exceptions, and freeze an immutable review candidate entirely in Admin.

### Build order

1. **Methodology authority:** define a versioned `consumption_led_cultural_presence_v1` methodology record and server-side configuration with fixed percentages. Integrate with `wk_chart_methodologies_v2` after auditing its current constraints. Do **not** change the live `top100` default or publisher in this phase.
2. **Rank mathematics:** normalize within each observed native list depth and multiply by the source's share. Proposed initial ordinal credit: `contribution = weight_points * (depth - rank + 1) / depth` for a genuine observed rank. Therefore Shazam rank 200 uses depth 200 and never earns more than **10** points, while YouTube never earns more than **30**. Use exact numeric arithmetic and keep each observed record tied to its source receipt. A source is one vote at most per genuine identified recording; repeated snapshots do not multiply its weight.
3. **Completeness and comparability:** distinguish `not_observed`, `partial_depth`, `unknown_provider_period`, `source_failed`, and `unresolved_identity`. Missing observations contribute no awarded position credit, **not a fabricated measured zero**. A missing/failed source does not redistribute its share. A weekly WAKILISHA compilation must clearly label as-of observations and never claim five synchronized provider consumption weeks unless proven.
4. **Recording identity and eligibility:** use Registry/MIZIZI's existing track, version, provider-link, and artist authority. Strong unique provider IDs and corroborated recording evidence are usable; title/artist similarity alone is a review clue, not a canonical match. Do not create synthetic ISRCs or force duplicate Registry records to fill the Top 100.
5. **Deterministic frozen ranking:** persist exact source receipt set, eligibility and identity decisions, methodology revision, score breakdown, rank ordering, unresolved-issue summary, freeze digest, and actor audit. Exact ties must use one predeclared deterministic rule; no alphabetical or favored-song manual ranking overrides after results are visible. No score-bearing editorial adjustment is permitted.
6. **One Admin workspace:** add a focused Charts Studio route (proposed `/admin/charts/studio`, subject to route collision check), backed by real server actions and WAKILISHA custom design components. The workspace contains **Source Health**, **Collect/Retry**, **Evidence Details**, **Top 100 Preview**, **Review Queue**, **Freeze/Approval**, and **History**. Provide accessible desktop/mobile and light/dark modes. No dummy buttons, browser-local authority, or second legacy Ingest UI.
7. **Security:** enforce existing actor capabilities and least-privilege checks for research/review/approval; server authorization, immutable audit, optimistic concurrency, and clean denial of stale or unauthorized actions. Keep the publication capability separate.

### Phase 2 acceptance and delivery

**Acceptance:** A genuinely qualified five-source input set yields a reproducible, versioned, 100-position **private** edition candidate; the same receipts and decisions yield the same ordering. The Admin workflow can create, review, investigate, and freeze it. Incomplete inputs, conflicting identities, forged metrics, stale revisions, and unauthorized approvals fail closed with readable reasons. A `HOLD` is not a fabricated PASS. The founder reviews the working Admin experience, not another weight-selection exercise.

**Delivery:** One Phase 2 PR for scoring, necessary persisted review/approval contracts, and Admin interface. The public chart remains untouched until Phase 3.

## 5. Phase 3: Controlled publication and repeatable weekly operation

**Working outcome:** One founder-approved public Top 100, followed by independently repeatable weekly editions using Admin and unattended collection. Routine weekly operation requires no GitHub, Terminal, SQL, or new deployment.

### Build order

1. **Publisher bridge:** connect the frozen private proposal to the retained `wk_chart_editions_v2`, `wk_chart_entries_v2`, `wk_chart_source_coverage_v2`, and existing `chart_assert_publishable_edition` integrity contract. Validate the exact schema and server-side invariants before any writes. Preserve historical programme identities and editions.
2. **Prospective programme version:** update only the Kenya `top100` programme's methodology reference from `weighted_streaming_v1` to the versioned new methodology through a CLI-generated forward migration; do not edit `toprnb` or retroactively relabel older editions.
3. **Publication commands:** implement permission-separated `approve frozen candidate`, `stage exact edition`, and `publish exact edition`. Require expected edition/week/digest, actor audit, idempotency, and explicit publisher confirmation. Disallow bypass through direct browser SQL, weak admin flags, or generic legacy `commit_run` actions.
4. **Public read path:** verify existing `/charts/top100`, `/charts/top100/:edition`, chart directory, API, and artist chart history where applicable. Display real artist/title/recording and edition information, correct movement only when prior editions exist, and a plain-language source methodology description. Avoid imaginary listening totals.
5. **One scheduler:** run one narrowly privileged schedule controller against per-source verified refresh windows, EAT edition cutoff, idempotent receipts, and source health. It prepares a draft only; **it does not auto-publish** a failed, incomplete, or unapproved edition. Failures create actionable Admin incidents without rebalancing weights.
6. **End-to-end release:** protected CI; exact merged-main acceptance; disposable Supabase Preview replay, secret-name and authorization parity, actual server/Storage/browser behavior; canonical Production migration promotion; restricted Edge activation; public frontend activation; verified public browser readback; recovery and rollback; remove billed Preview and temporary fixtures.
7. **Second-week proof:** an authorized Admin starts the next real edition, reuses approved source/methodology configuration, obtains fresh genuine receipts, reviews and publishes through the browser with no engineering operations.

### Phase 3 acceptance and delivery

**Acceptance:** Exactly 100 genuinely qualified published entries, the expected methodology version and evidence-bound edition, functioning public desktop/mobile pages, and first-publication approval by the founder. Confirm duplicate-proof publication, source holds, worker restart, immutable historical editions, next-week Admin operation, and final Production readback. The published WAKILISHA Top 100 must not claim raw aggregate streams that the five sources do not disclose.

**Delivery:** One Phase 3 PR, necessary reviewed migrations, restricted worker/scheduler activation, and final operations/runbook documentation. No launch declaration based only on green CI or a synthetic fixture.

## 6. Release control and scope

**Execution unit:** One parent Charts 2.0 issue, three phase milestones, one primary PR per phase where practical. A discrete repair PR is allowed if accepted control-plane or migration replay demands it. Do not create a 20-stage programme or grow CI just to memorialize implementation steps.

**For every phase:**
- Start from exact clean protected `main`; audit affected code and Production read-only first.
- Generate migration filenames with the repository-approved pinned Supabase CLI. Never invent timestamps, execute untracked Production schema edits, or rewrite applied history.
- Reuse existing durable domain/security/CI contracts; expand only where an independent regression boundary warrants it.
- Prove source-native/evidence behavior in the correct runtime; synthetic fixtures do not certify current provider collection.
- Check affected secrets, service identity, RLS, Storage, Edge functions, and server/browser capability restrictions without exposing credentials.
- Use protected PR review/CI and independent Preview when relevant. Merge only after the required gates pass; perform Production SQL, Edge, and frontend release steps separately and verify their actual outcomes.
- Avoid routine founder Mac/Terminal involvement. Escalate only genuine external authentication/access or founder product approval.

**Non-goals and protections:** Do not reinstate WK100 code, cron, or its broad service-role JWT; do not delete surviving generic chart tables without a separate usage audit; do not change or hide old playlist `top100`/`toprnb` content without explicit authorization; do not construct a new Registry identity system; do not introduce a licensing or partnership programme merely to research public facts. Actual unattended access conditions must still be verified source by source.

## 7. Concrete handoff to Phase 1

**First scoped implementation task:** Confirm current `main` and schema inventory, map existing Registry provider-identity helpers and chart public reader, then implement the five adapter contracts plus the shared collector's exact receipt structure. Make the minimum schema/Storage choices only after that audit.

**First visible engineering proof:** Five independent source execution reports, including authentic ordered positions and checksummed originals where a method is qualified; any genuinely blocked source has a specific non-fabricated hold reason. That is the data foundation for Phase 2.

**Status at documentation commit:** PLAN ONLY. No collector, Admin Chart Studio, new schema, Storage bucket, timer, published edition, or Production activation is claimed by this document.
