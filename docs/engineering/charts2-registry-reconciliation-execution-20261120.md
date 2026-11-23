# Charts 2.0 — Recording Identity / Registry Convergence Delivery Contract

**Owner direction:** 20 November 2026, WAKILISHA Engineering Archive  
**Implementation base:** protected `main@4b0079668ba2503927815929539a2bf28a3cb8ea`, Charts 2.0 private Studio frontend Production finish accepted.  
**Programme:** [#1406](https://github.com/bjuta/wakilisha/issues/1406). This contract supplements [Charts 2.0 three-phase execution plan](charts-2-0-three-phase-execution-plan.md) and does not authorize a public chart publication.  
**Status:** APPROVED DELIVERY PLAN; implementation/acceptance must be recorded separately per PR.

## Founder-observed product defects (production screenshots, 20 Nov 2026)

1. `Review Matches` leaves `Choose The Recording` below the review queue rather than opening a contextually anchored review surface. CSS grid is not a drawer.
2. Apple Music observations display `Artist not given`; the exact-ID Apple catalog enrichment is currently consumed only in the Top 100 tab, not in the identity-review surface. The original Apple chart receipt contains no artist; do **not** overwrite it with enriched data.
3. `Find The Recording To Keep` appears dead: its server query searches active Registry Tracks by title/UUID only, caps at 10, gives no search-in-progress or zero-results notice, and does not use the established Track Intake search/credit/ISRC evidence.
4. Checkbox, labels, submit action and footer spacing fail responsive product acceptance.
5. The unscoped `Open existing Registry track authority` URL loses chart receipt, position, selected observation and return context. An unscoped link is not a bridge.
6. The client-only fuzzy/alias pairwise connected-components algorithm may transitively group unrelated recordings via an observation with missing artist; suggestion is not authority.
7. Charts Studio duplicates review/reconciliation capabilities that Registry, Track Intake, Artist Intake, Artist Aliases, MIZIZI Duplicate Repair and Review Desk already own.

## Accepted architecture and invariants

- **Single chain:** immutable source observation → provider-neutral candidate evidence → explicit, reviewed Artist and recording identity → typed Registry operations → independent verifier/receipt → private Charts read/freeze. Charts never becomes a canonical writer.
- The governed [Reviewed Registry Admission Spine](registry-reviewed-admission-spine-and-mizizi-stewardship-design-20261002.md) and [Provider Identity / Registry / MIZIZI jurisdiction contract](provider-identity-registry-mizizi-jurisdiction-contract-20261006.md) remain controlling. Do not introduce a second identity queue, canonical table, lineage store, alias subsystem, generic CRUD broker, or new scoring policy.
- Distinguish: source claim, provider enrichment, external identifier assertion, candidate similarity, approved canonical Artist/Track/credit, and canonical provider link. Title/artist equality and ISRC on their own do not authorize promotion. Unknown is never a fabricated identity.
- Use caller-bound `manage_registry` for canonical human actions, not service-role writes; server checks original receipt SHA and state; no preselected decisions, no implicit partial-batch atomicity.
- Five-source weights remain YouTube 30, Mdundo 25, Apple 20, Audiomack 15, Shazam 10. Preserve genuine depth, observed period and all immutable originals. No public publication, scheduler, or topRNB changes. Charts 1.0 workbook remains design reference only, never a runtime integration.

## PR 1 — Live Charts Studio UI / read-only evidence convergence (start here)

**Scope:** existing Charts Studio and helper, exact-ID Apple review enrichment, existing `charts2-capture` read-only search mode, consolidated existing test suite; no SQL or canonical write extension.

**Tasks:**
1. Replace the inline, after-list `Choose The Recording` form with the existing `src/components/design-system/primitives/Modal.tsx` on selected source row or candidate group. Keyboard / focus restore, mobile vertical scroll, dismiss without mutation, cancel during pending save only where safe, and stable return to the source row.
2. Preserve raw receipt `artist=null`; show `Source artist: not supplied` beside `Apple catalogue artist: [verified exact ID]` where available. Use existing `loadVerifiedAppleChartSongs` with captured native IDs, not title search, and make failure explicit without changing ranking/source evidence.
3. Make Registry discovery search title, ISRC, active Track↔Artist credit, and legitimate provider-link identifiers, with bounded results, clear loading/no-result/error messages and stale-query handling. Show Track ID, ISRC, Artist credits and existing links; flag collisions or status ineligible. Reuse existing Track Intake search principles and accepted Registry readers rather than a second match authority.
4. Group only defensible **review leads**: restrict missing-Artist pair bridges/transitive chains; separate disjoint artist identities and version distinctions; never preselect source links. Show per-source receipt + rank + original credit.
5. Repair text wrapping, checkbox/CTA alignment and responsive spacing. Remove the misleading unscoped Registry link (replacement is PR 2 context-bound bridge).
6. Extend `test/registry/charts2-private-scoring-v1.test.ts` and existing real-browser suite, consolidate redundant snapshots, and independently verify source-original/score/freeze invariants remain unchanged.

**Exit evidence:** signed-in desktop and mobile selection opens correctly; keyboard and focus work; Apple displays provenance-labelled artist or explicit absence; title/artist/ISRC/provider search returns genuine candidate or understandable zero-result; duplicate group not over-merged; non-manager/stale/failed API handled; no canonical mutation or public publication; protected Critical Control Plane green. **Do not merge/deploy before the signed-in gate is observed, unless founder explicitly authorizes a recorded exception.**

**Delivery classification:** SQL NO; Supabase Edge `charts2-capture` YES if search endpoint changed; frontend Finish YES. Use current accepted Lightsail/SEO snapshot and runner, not a new wrapper.

## PR 2 — Context-bound Chart → Registry reviewed workflow

**Scope:** smallest necessary CLI-minted forward migration / backend / UI to extend *existing* governed review entrypoints; no new parallel intake. Requires clean Preview SQL replay, JWT permission/denial, and receipt-state proof.

1. Bind context `source_key, receipt_id, original_sha256, rank, provider_track_id|null, selected review identity` server-side to a review reference and return destination. Validate against immutable source originals, current methods and permission.
2. Extend Track Intake's **source-origin contract** (currently only `playlist_editor | public_contribution | artist_submission`) to include genuine `chart_studio` evidence, with reviewed Artist-credit roles, status, finalization and idempotency. Do not reuse playlist IDs, forge a submitted track, or sneak through an existing origin.
3. Connect missing Artist to existing reviewed Artist identity creation and enrichment; connect alias to `admin_set_registry_artist_alias_v1`; connect primary/featured/co-primary decisions to reviewed credit reconciliation, without guessing artist roles from separators.
4. New Track goes through typed Track create → exact credits → evidence-backed metadata → activate → intake finalize. Existing Track goes through reviewed evidence reconciliation and finalization; all return the canonical Track UUID.
5. Existing duplicate canonical Tracks go to `admin_preview_registry_track_duplicate_repair` and `admin_apply_registry_track_duplicate_repair` with existing typed `registry.track.duplicate_repair/v1`, exact impact preview and lineage. No Charts merge implementation.
6. Contextual links: `Review Artist`, `Review Track`, `Review Credits`, `Review Duplicate`; each returns to original observation after current-state revalidation. Avoid bare unscoped Registry links.

**Exit evidence:** Bien missing Track and Mejja alias/existing Track real-data handoffs, multi-credit example, valid/invalid artist origin, exact role changes, duplicate preview (no unapproved apply), interrupted review resume, no false success for draft/unverified outcomes, complete operation/journal/verifier receipts.

**Delivery classification:** bounded SQL YES if present constraints require; Edge only for actual bridge; frontend YES. No permanent workflow proliferation.

## PR 3 — Source identity resolutions, bulk review and private-freeze acceptance

1. Keep `admin_admit_registry_track_provider_link_v1` for observations with real native IDs, one verified source link per human-reviewed source action.
2. For Shazam's absent provider IDs, design a bounded **chart observation → canonical Track** review authority keyed to exact receipt+rank+SHA; prove no existing accepted primitive can represent this before adding a table/RPC. Never invent a Shazam provider Track ID or turn a title clue into proof.
3. Human decisions are exhaustive for the reviewed selection, never preselected. Different recordings/versions remain separate. Source observation evidence and historic receipts remain unchanged.
4. Reliable per-item success, conflict and retry states; accepted operations survive partial failure; current Registry state rereread before next action; no browser claim of atomic batch.
5. Recompute exact private weighted candidates using the existing server scoring and freeze CAS. Freeze only if genuine 100 eligible Track identities / receipt integrity / five-source coverage pass. Remain unpublished pending separate founder approval.

**Exit evidence:** real Bien/Mejja/collaboration/Shazam/no-ID cases, source collision and distinct-version denials, stale user/permission, interruption-resume, original hash/no-network-rewrite, protected tests and signed-in cross-viewport checks, true 100-candidate private freeze or clearly documented HOLD with exact blockers.

## Production and test controls

- Repo checks: existing Charts domain contract, Registry provider-identity/Track Intake/Artist Intake/duplicate-repair contracts, critical-core, critical-browser and full build. Consolidate tests; no milestone-only permanent CI.
- Runtime: inspect full Edge config/auth/secret/CORS and Preview-vs-Production parity before tests. Any SQL runs in clean Preview first with exact replay and independent verifier; all mutating tests ledger their IDs; failure → diagnose → surgical resume.
- Before Production: merge approved, exact-base CI, SQL (if applicable) → Edge (if applicable) → accepted canonical Lightsail frontend Finish. Do not infer live release from merge.
- Production acceptance: signed-in desktop 1440, tablet 768 and mobile 390; keyboard focus/scroll/overflow; real five-source data; authorized and unauthorized review; no source/Registry writes unless expressly and specifically approved.
- Record PR head, merge SHA, Edge/SQL versions, signed-in proof, exact Production deployed commit and rollback in programme #1406. No silent release.

## Read-only audit snapshot, 20 Nov 2026 (not release authorization)

Live: 600 observations, 400 provider IDs, 200 Shazam no-ID; 2,484 Registry Tracks / 2,122 active; 2,347 Tracks with ISRC; 4,100 active Track↔Artist credits; 1,227 Artists / 632 active; 19 active Artist aliases; 332 canonical provider links (mostly existing Apple exact title/artist); 210 external identifier assertions, 1,131 provider-field observations, 212 provider evidence links, 571 Registry review cases.

Example: active Track **Mboka** ISRC `QZQAY2651792`; **Mejja Genge** is not presently a governed Artist Alias. Bien's **I'll Be Okay** has source observations but no matching active Registry Track. Apple chart source lacks the Artist field; exact Apple catalogue enrichment is independent observation. These are review cases, not approved canonical resolutions.

## Current gate

This plan records the target. **PR 1 in progress. PR 2 and PR 3 not implemented. Production unaffected by this plan.** A successful test is evidence, not human approval of source-to-Registry matches.
