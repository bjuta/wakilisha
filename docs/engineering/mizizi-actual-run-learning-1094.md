# MIZIZI actual-run learning: #1094

Status: **Production-observed baseline, not a new mutation authority.** Captured 9 October 2026 from read-only Registry queries against Production `pgzizndxdyhqmtyywjmt`. This document records what happened, not what a future runner is permitted to skip.

## Run class A: completed safe Track slug canonicalization

- Governing slice: [#1094](https://github.com/bjuta/wakilisha/issues/1094).
- Reviewed trigger merged through [#1210](https://github.com/bjuta/wakilisha/pull/1210), main `01170a6111f89cb3237324aa1807b68169807001`.
- Typed operation: `registry.track_slug.canonicalize`, version 1.
- On 2026-10-09, **12 operations succeeded and 12 independent operation verifiers passed**. Completion times span **11:46:51.052011 to 11:46:55.480969 UTC**.
- The associated 12 safe-slug human decisions have resolved Admin review rows (separately confirmed in the earlier #1094 Production census).
- Current grant census after the run: **1,680 consumed; zero active or other grant statuses**, as observed by grouping `platform_private.registry_execution_grants` by status. Independent post-run checks also found `registry.track_slug.canonicalize/v1` disabled, and the system-actor capability grants partitioned into 11 expired / 1 revoked / 0 active. Thus exact grants, broader capability grants, and the typed operation were all at rest at capture time.
- The run did **not** need a new duplicate executor, redirect writer, or bypassed review resolver.

### One fully joined example

| Authority stage | Observed receipt |
|---|---|
| Human decision | `4775a232-4c9f-4e35-a2f3-41f565013da4` |
| Exact Admin review | `00aafb96-d519-45ed-b367-16879ee36bc8`, **resolved** |
| Verified operation | `2728796c-189b-4fa6-8057-87da27ca389f`, **succeeded / verifier passed**, 1 affected row |
| Execution grant | `7b6ee00e-ebfa-4b95-b7da-5a70b81ef4e7`, **consumed** |
| Plan fingerprint | `e534fccf4c847a53013808b96d6f4e3871bfe1ba4d758a1055be34864afb196d` |
| Target-set fingerprint | `43d7ce8402f5b82d875aa9aec1b6d369d6a97405170352d764160e89ef179b1c` |
| Grant lifetime | Issued 11:46:50.598449 UTC, consumed 11:46:51.052011 UTC, configured expiry 11:51:50.598449 UTC |
| Finalization link | Decision metadata `verifiedOperationId` equals the operation ID; `reviewResolved=true` |

This is a real closed loop: decision → review → exact grant → bounded mutation → independent verification → finalization → consumed grant. Preserve these identifiers as joinable evidence rather than manufacturing a new report-only ID.

### Evidence gaps not to conceal

This capture did not independently replay the full current redirect, Chart, Community and capability-enable census. It does not prove those other exit gates by itself. Keep the accepted #1094 and MIZIZI audits as independent gates.

## Run class B: same-recording duplicate repair (D1–D3)

**Not yet executed.** Human judgments and exact survivor/peer Track IDs are recorded in #1094. Read-only Production joins show no `registry_canonicalization_decisions` or `registry_review_items` for any of those six Track IDs. The surviving Tracks are active and their clean-slug peers are `needs_review`. The established Admin decision RPC accepts only an existing open slug/credit review on an active source Track, while the installed MIZIZI review broker's 1.1.0 admission path is feature-slug specific. Consequently the three D cases **cannot truthfully be recorded as completed MIZIZI loops**.

The next implementation must admit these exact synthetic collision cases through governed review authority, authenticate and bind the approved human same-recording judgment, preserve the active survivor UUID, then execute the existing `registry.track.duplicate_repair/v1` operation and independent verifier. It must reconcile Chart, Community, provider, release and credit pointers before slug canonicalization. Do not treat a GitHub issue comment as a completed authenticated Registry decision.

## Run class C: recording-distinction finalization and credit correction

**Not yet captured as a completed loop.** The seven historical distinct-recording decisions already exist. Their linked recording reviews remain a separate finalization debt. The current `admin_finalize_public_music_identity_track_review_v1` resolves the passed slug review only; it does not also close a distinct, linked recording review. The 12 B credit-required decisions are explicitly non-terminal and their reviews remain open until governed credit reconciliation is complete.

## Requirements for the next MIZIZI iteration

1. Emit one machine-readable receipt per governed candidate, composed from **existing** decision, review, grant, operation, verification, and finalizer IDs. Do not introduce a competing ledger.
2. Allow replay-safe resumption by inspecting the current durable stage before taking the next step, never rerunning a mutation from the beginning on timeout.
3. Make linked-review terminal reconciliation part of the accepted finalization contract, not a manual review-status update.
4. Support review admission for evidenced synthetic-identity collisions through a narrowly typed, fail-closed MIZIZI rule, without automatic duplicate inference from slugs or ISRC.
5. Report zero-at-rest separately for exact grants, broader actor grants, and enabled operations.
6. Only label a class `COMPLETE` after its independently verified journal, finalizer, pointer audit, and zero-at-rest evidence are all present.

Source: live read-only Production queries performed 2026-10-09 in this implementation session. No Registry writes were made to create this document.

## 9 October 2026 follow-up: synthetic-review admission failure

Protected-main reviewed MIZIZI Track review attempt #1217, Actions run `37967989910`, failed during the review-only broker call with `Recording-identity conflict is no longer live.` Its preflight and independent audit completed; the JIT database transport was restored to zero at rest. No new synthetic-pair review or canonical Track repair was completed.

Direct read-only Production evidence for D1 DESIRE, D2 Ficha, and D3 Colors confirms the exact narrow defect. Each clean-base peer is `needs_review`; its principal Artist credit is also `needs_review`. The corresponding approved synthetic-suffix survivor remains `active`, with matching `active` principal credit. The former broker predicate required `target_credit.status='active'` for the source peer, so the old predicate fails all three. A narrowly conditioned `needs_review` source-credit allowance, only when the source Track is itself `needs_review`, matches all three without relaxing the active survivor, exact same-Artist, matching-title, and one-synthetic-peer requirements.

CLI-minted candidate: `20261009181647_public_music_identity_synthetic_review_principal_credit_admission_v1.sql`. The candidate replaces only the already-accepted private review broker's function definition, retains MIZIZI executor assertion, and performs no review or canonical Registry mutation upon migration apply. Its permanent verifier is the existing reviewed-duplicate verifier. All three D decisions still require authenticated Admin capture, exact duplicate operation grants, independent verification, finalization, and a separate clean-slug canonicalization. A successful review admission is **not** a completed duplicate repair.


## 15 October 2026 independent historical D1/D2/D3 Production read-only audit

**Scope and chronology:** This is a **newer observational supplement** to the 9 October baseline above, not a rewrite of what was true on 9 October. Exact current Production project `pgzizndxdyhqmtyywjmt`: **216 migrations**, head `20261009181647`. Query-only: no SQL mutation, operation issue, grant, admin review resolution, Edge/frontend promotion, or historical replay. Source authority: the original #1094 fixed Track/review UUIDs, existing accepted Headquarters implementation exit contract, and independently queried live `public.registry_*`, `platform_private.registry_*`, `public.wk_chart_entries_v2`, `public.community_threads` tables. This audit is **Production source-of-truth inspection**, not new Production execution acceptance for Headquarters.

| Exact class | D1 DESIRE | D2 Ficha | D3 Colors |
|---|---|---|---|
| Approved survivor Track | `afbe3f47-62af-4b68-8d54-527f04987ebe`, **active**, `desire-2a895a` | `80642d87-769c-4949-8ecd-b3b9f6835486`, **active**, `ficha-1d71c1` | `bec6a6de-3001-44a7-8241-df1cd8b932ac`, **active**, `colors-1672b8` |
| Reviewed duplicate peer | `f30846f0-8cf1-4df6-8875-38fa7a763e7b`, **needs_review** | `a708a142-dc2b-4fd2-9dbb-d780b666667c`, **archived** | `aa2793e6-ed18-40a7-9654-dfd56769fcbe`, **archived** |
| Exact review UUID/status | `2b8b2d52-6c5e-4397-914d-60c8bf0e34d2`, **open** | `6c521cd1-0438-44e7-b6b0-6b737096774b`, **resolved** | `49ec3921-3f3e-46d3-8c3a-62f826957dfd`, **resolved** |
| Recorded human decision | `829342ba-c6ab-47e2-b48a-ac8d7de254d5`; true duplicate, intended survivor exactly matches | `dcc44187-cc0e-4c55-be4c-5a0eeb0604fa`; true duplicate, survivor matches | `ff660681-6062-4268-a11f-a86788cf7ba9`; true duplicate, survivor matches |
| Decision's verified operation ID | **null**, `reviewResolved=false` | `60919a4e-9e75-482c-a5e5-29a5def99414`, `reviewResolved=true` | `539815a6-8df4-45e0-94d6-c6fbaddf98ae`, `reviewResolved=true` |
| Actual mutation and independent verification | **No verified duplicate operation** | `registry.track.duplicate_repair/v1`: **succeeded**, `verifier_status=passed`; 4 affected rows; exact grant `c0cafb31-5e0e-482d-aab4-b9b1e66eae02` **consumed**; one linked canonical write receipt and one `registry_track_resolution_events` **success** | `registry.track.duplicate_repair/v1`: **succeeded**, `verifier_status=passed`; 13 affected rows; exact grant `ed1412ab-b32f-4a2b-8f2a-56b3b1806307` **consumed**; one linked canonical write receipt and one resolution event **success** |
| Current WAKILISHA Charts v2 canonical survivor / peer pointers | **17 / 0** | **6 / 0** | **17 / 0** |
| Provider links on survivor / peer | **1 / 0**, survivor `apple_music:matched` | **1 / 0**, survivor `apple_music:matched` | **1 / 0**, survivor `apple_music:matched` |
| Active Release membership on survivor | **1**, SUMBUA `sumbua:active` | **0** (not required by the frozen D2 acceptance fixture) | **0** (not required by the frozen D3 fixture) |

**DESIRE's exact unresolved blocker:** The `desire` duplicate still has a `needs_review` primary credit to artist `lilmaina` whose canonical Artist row is **archived**, and a separate `needs_review` primary credit to active `lil-maina`; Nikita Kering' is separately credited as featured on the source. The active `desire-2a895a` survivor already has one active `lil-maina` primary and one active Nikita Kering' featured credit, with the credited-as field retained. Blindly transferring all three peer credits would create a redundant primary and violate original D1 safeguards. The existing decision is **not** a canonical write grant; the source remains `needs_review`, the human review remains open, and there is no verified operation. Preserve the archived alias evidence and historical spelling. Any later credit correction needs the separately proved reviewed exact operation and independent row/pointer verifier; **do not repeat the duplicate repair or silently mutate the credit set as part of this audit**.

**Ficha and Colors historical completion is now independently revalidated:** both peers remain archived and have two archived source credits; both active surviving Tracks retain two active credits including their primary and featured artist. Both reviews resolved on **10 October 2026**, with their recorded human decisions linked to the actually verified duplicate operations above. No direct references to either archived peer remain in the sampled current Chart v2 canonical ID or provider-link surfaces. This supports **historical Registry repair completion for D2/D3**; it does **not** show the still-unpromoted Headquarters frontend presents those receipts correctly, nor that a new MIZIZI Production case workflow executed them.

**Community qualification:** One open `public.community_threads` Track thread refers to the canonical DESIRE survivor UUID and its `desire-2a895a` slug. No source-peer Track-associated Community posts were found in `community_posts.registry_track_id` for these six UUIDs. A separate current/legacy Community pointer and comment-history acceptance may still be required; a table-level count alone is not the full public reader/route proof.

**Zero-authority qualification:** `platform_private.registry_execution_grants` has **zero** `active`; nonrevoked, unexpired `system_actor_capability_grants` are **zero**, and no duplicate-repair mutation operations are pending. The `registry.track.duplicate_repair/v1` operation *type* currently has `enabled=true`; that does **not** equal a currently issued execution grant. Do not claim all operations are disabled, nor that it authorizes any new repair. Review cohort retains **149 open and 75 resolved** `mizizi_data_hygiene` records, including D1 open and D2/D3 resolved.

**Release interpretation, no invented acceptance:**

- **D1 / DESIRE:** existing exact human decision and open review plus concrete archived-Artist alias credit blocker are verified in real Production. **Canonical repair is NOT complete**; the final first-class Headquarters presentation, source-bound case receipt, stale/restart proof against this historical source, and future separately reviewed exact credit operation remain gated. Slice 1 does not need autonomous Production mutation; the UI must honestly show this as blocked and never suggest completed.
- **D2 / Ficha and D3 / Colors:** their original historical duplicate repairs and final review receipts are independently **verified as already completed**. Preserve these UUIDs and receipts, never execute the duplicate operation again. The new Headquarters must show them as **resolved history**, not actionable work, after its separately gated Production SQL/frontend promotion.
- **No Slice 1 release approval from this census.** The new Headquarters schema is still only in isolated Preview (230 migrations), Production is at 216; the original 40 ledger v15 contains **38 LOCAL_EXECUTED / 2 PARTIAL_EVIDENCE** with both C17/H37 explicitly assigned to Slice 3, and all **40 Production acceptance entries NOT_RUN**. The remaining authentic operator UI, exact D1 read-only rendering and historical D2/D3 resolver continuity, protected merge and separate Production promotions/acceptance are not inferred from the read-only data. No grants, reviews, cases, or Track/Artist writes were performed for this audit.
