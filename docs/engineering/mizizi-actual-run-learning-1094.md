# MIZIZI actual-run learning: #1094

Status: **Production-observed baseline, not a new mutation authority.** Captured 9 October 2026 from read-only Registry queries against Production `pgzizndxdyhqmtyywjmt`. This document records what happened, not what a future runner is permitted to skip.

## Run class A: completed safe Track slug canonicalization

- Governing slice: [#1094](https://github.com/bjuta/wakilisha/issues/1094).
- Reviewed trigger merged through [#1210](https://github.com/bjuta/wakilisha/pull/1210), main `01170a6111f89cb3237324aa1807b68169807001`.
- Typed operation: `registry.track_slug.canonicalize`, version 1.
- On 2026-10-09, **12 operations succeeded and 12 independent operation verifiers passed**. Completion times span **11:46:51.052011 to 11:46:55.480969 UTC**.
- The associated 12 safe-slug human decisions have resolved Admin review rows (separately confirmed in the earlier #1094 Production census).
- Current grant census after the run: **1,680 consumed; zero active or other grant statuses**, as observed by grouping `platform_private.registry_execution_grants` by status. This proves execution grants are consumed at capture time; the additional MIZIZI operation-enable and capability-grant-at-rest checks remain required for a complete zero-at-rest assertion.
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
