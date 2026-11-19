# Charts 2.0 Phase 2, Take 3: Immutable Private Freeze

**State (19 Nov 2026):** Implemented in PR #1401, Production-deployed with protected CI and exact-main frontend acceptance. The **freeze mechanism** is accepted; a **real actor-approved 100-recording freeze has not occurred**. Founder-approved bounded identity review is recorded in the 19 November amendment to the three-phase execution plan. This is a private freeze contract, not a public edition.

## Hard boundary

The frozen candidate is an **immutable, 100-position private review record**, not a WAKILISHA public chart. The existing `wk_chart_editions_v2`, `wk_chart_entries_v2`, `top100`, and `toprnb` are untouched. No scoring, collection, or publication job is scheduled.

The five genuine Phase 1 private original receipts are input evidence. A receipt preserves its exact source, native rank, SHA-256 original, original time, and provider-declared period if the provider supplied one. Shazam's 200 are **discovery observations**, not audio stream counts. Apple, Mdundo, and Shazam do not receive invented provider-week dates.

## One accepted, versioned calculation

`consumption_led_cultural_presence_v1` / `charts2-private-ordinal-v1` uses these locked weights: YouTube Kenya 30, Mdundo Kenya 25, Apple Music Kenya 20, Audiomack Kenya 15, and Shazam Kenya 10.

`credit_units = weight * (200 / source_depth) * (source_depth - native_rank + 1)`.

All math is exact integer math at 200 units per point, and ranks are sorted by descending credit units followed by canonical Track UUID ascending. Missing source appearances never become fabricated listening counts or zero-valued observations. An unresolved source observation remains visible in the review queue; it earns no credit.

A Registry Track can earn a position only through an existing active canonical provider link created by the accepted, human-reviewed Registry broker. The link must be `matched`, `manual`, confidence 1, with the same official provider identity and exact source-specific immutable receipt proof, independent HTTPS recording evidence, and a 40-character review rationale. Ordinary title/artist matches, fuzzy matches, raw candidate provider IDs, and missing Shazam IDs cannot award points.

Unresolved observations are expected when providers do not disclose enough identity. They are not silently dropped from source health. **A freeze requires 100 distinct genuinely qualified Track UUIDs and zero canonical identity conflicts**, not 600 artificially resolved source rows.

## Persisted private freeze

Pinned Supabase CLI 2.107.0 minted the new forward migration `20261119111655_charts2_private_freeze_authority_v1.sql` in workflow [#44513371361](https://github.com/bjuta/wakilisha/actions/runs/44513371361). Temporary mint workflow is removed.

`platform_private.charts2_private_freezes_v1` holds the immutable private ranking and five exact source receipt identities. It records: immutable candidate UUID; methodology and score policy; the input snapshot SHA-256; ordered ranking SHA-256; 100 ranks and exact per-source credits with Registry link references; unresolved observation count; real authenticated approver; and approval time. A unique input digest makes duplicate approval idempotent. Update/delete triggers reject mutation. Private RLS and revoked Data API table privileges prevent direct browser reads and writes. `can_publish=false` is a database invariant.

The service-role-only `charts2_private_freeze_preflight_v1()` reads the accepted private snapshot, validates the exact five sources and native depths, and independently recomputes scores against the existing Registry ledger. It provides the expected input SHA-256, the candidate ranking SHA-256, the 100-track eligibility gate, identity conflicts, and the latest private freeze UUID. It does **not** create a freeze.

The authenticated-only `charts2_freeze_private_candidate_v1(expected_digest, expected_previous, explicit_ack)` uses `auth.uid()`, **both** current `manage_charts` and `manage_registry` authority, and a transaction-scoped advisory lock. It recomputes the entire input and ranking from database-held evidence. It rejects missing sources, inadequate depth, unresolved 100-track eligibility, identity conflicts, stale input SHA, stale previous-freeze UUID, and changed method weights. It accepts no browser-provided ranking, track IDs, or scores. A duplicate identical input returns the existing immutable freeze, never a second candidate.

## Studio gate

The existing JWT-verified `charts2-capture` Edge worker re-downloads and rehashes all five private originals before any Studio preview. It then checks that PostgreSQL's independent ranking agrees with the same five receipts and Registry links scored by the pure JS kernel. Any discrepancy is an explicit blocking error, never a silent reweighting. The `studio_freeze` action invokes the authenticated actor's **own** JWT RPC after explicit confirmation, never a service-role mutation.

Admin Charts Studio includes a **Private Freeze** work area. It shows eligible Track count, unresolved evidence, identity conflicts, exact input digest, and immutable freeze history. The Freeze action stays disabled until the database confirms 100 genuine qualified tracks, the operator has `manage_registry`, and the human expressly approves freezing that exact private candidate. The resulting record is private. Publication controls do not exist in this workspace.

## Acceptance proof, limits, and next action

The existing unlinked disposable PostgreSQL replay proves the forward migration, private ACLs, immutable trigger, genuine actor-bound RPC grants, and deterministic 100-rank SQL recomputation. Its synthetic fixture has 100 exact, independently reviewed Apple provider links and 500 unresolved observations across the other sources. It runs inside a transaction that rolls back all fixtures and never touches Production.

This proves the implementation, **not a real 100-song candidate**. Production currently has five genuine first-party receipts and zero approved strong provider-ID links for those 600 observations. The single Apple title/artist link is insufficient. Human review using genuine recording evidence is required before the database can legally freeze 100. Desktop/mobile **Source Health** screenshots and an independent Production read-only SQL/Edge readback are now accepted. Signed-in interactive acceptance of Identity Review, Top 100 Preview, Receipt History and Private Freeze remains outstanding as a **Phase 3 launch gate**, not a claim that those workflows have been exercised.

**No deployment or closure claim** follows from synthetic fixtures, even if all CI is green. Under the 19 November bounded-identity scope amendment, **Phase 2 engineering implementation can close despite the unchanged operational freeze HOLD**. Phase 3 engineering may implement the guarded publication bridge, but **no public edition write, staging, publication or scheduling activation** is allowed until 100 genuine actor-reviewed canonical tracks yield an immutable private freeze and the full remaining Production/browser/security release gates pass. Phase 3 alone may bridge the real frozen private candidate into a public WAKILISHA Top 100 edition.
