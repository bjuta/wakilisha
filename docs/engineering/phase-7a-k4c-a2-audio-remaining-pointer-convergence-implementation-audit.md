# Phase 7A K4C-A2: Audio Remaining Pointer Convergence Implementation Audit

## Current-state reconciliation — 30 August 2026

**The kernel movement described in this document is closed.**

Current authority is recorded in
`docs/engineering/phase-7a-kernel-closure-record.md`.

The accepted kernel baseline is production **64/AR3**:
`20260830070752_phase_7a_k4c_ar3_article_cross_system_reader_convergence_typed_event_retirement`.

Playlist and Audio typed lifecycle pointer compatibility is physically retired.
Playlist/Audio typed event writers are retired.
Article typed lifecycle readers/writers are retired.
Video uses the shared Resource kernel directly and has no typed lifecycle/review ledger.

A bounded post-kernel hardening candidate at commit
`79b26e4c8db83fe178459c4c497c8fbc8714bb2b`
repairs two separately tracked business-logic defects and freezes retained typed
event tables as inaccessible historical evidence. It does **not** reopen this
kernel milestone.

Any older `Status`, `Current boundary`, `Next test`, production migration
count, or preview instruction below is historical evidence for that checkpoint,
not the current programme state.


Status: PREVIEW ACCEPTED. READY FOR REPLAY/SCHEMA SEAL AND PR.

Opened: 28 August 2026

Design authority:

`docs/engineering/phase-7a-k4c-audio-command-convergence-design.md`

Accepted main / production baseline:

- main: `f0d7ff642aa7861098a91d9cd6dae892d716ce87`
- production migrations: `59`
- production head: `20260828120229_phase_7a_k4c_a1_audio_shared_event_convergence`
- A1 permanent verifier: PASS
- typed Audio event writers: `0`
- Audio typed/shared pointer drift: `0`

## Purpose

A2 removes the remaining business-command and helper dependence on the four
Audio typed lifecycle pointer mirrors while deliberately retaining those four
columns and both K1 synchronization directions for A3.

This is a mechanical authority-convergence slice. It does not redesign Audio
business logic, Media authority, review semantics, public RPC contracts, or the
Audio workbench.

## Exact post-A1 dependency manifest

Production introspection after A1 narrowed the broad 18-function design scan to
exactly ten live business functions that still consumed typed Audio pointers:

1. `public.create_audio_publication`
2. `public.snapshot_audio_publication_working_version`
3. `public.archive_audio_publication`
4. `public.save_resource_version_editorial_metadata`
5. `audio.insert_current_publication_snapshot`
6. `audio.publication_content_fingerprint`
7. `public.get_public_audio_publication_m1`
8. `public.replace_audio_publication_version_citations`
9. `public.replace_audio_publication_version_credits`
10. `public.restore_audio_publication_from_archive`

Only four governed business functions wrote typed pointers before A2:

- `public.create_audio_publication`
- `public.snapshot_audio_publication_working_version`
- `public.archive_audio_publication`
- the Audio branch of `public.save_resource_version_editorial_metadata`

One additional writer remains by design after A2:

`editorial.sync_typed_lifecycle_from_resource()`

That is the K1 Resource-to-typed compatibility writer retained until A3.

No `src/` browser code directly consumes the typed Audio pointer fields.

## Production compatibility seal

At A2 open:

- Audio binding rows: `2`
- complete Audio binding fingerprint:
  `2ba835c978321c768be76b03fd2d69c0`
- pointer parity drift: `0`
- Audio typed pointer columns: `4`
- Audio pointer foreign keys: `4`
- typed-to-Resource helper MD5:
  `1a9a366b7a26d023aa589767a2024651`
- Resource-to-typed Audio-only helper MD5:
  `619a2bd22f9066594f84dada7a119902`

The accepted definitions, owner, `SECURITY DEFINER` state, volatility, fixed
search path, and ACLs of all ten A2 targets were pinned before rewrite.

## Rewrite strategy

A2 reuses the production-proven K4C-P2/P3 fail-closed pattern.

The migration does not copy complete function bodies. It reads each accepted
function with `pg_get_functiondef`, requires the exact old-fragment occurrence
count, substitutes only the typed-pointer fragment, and executes the otherwise
unchanged definition.

The transformations are limited to:

- creation working pointer to `editorial.resources`
- working snapshot read/write to canonical Resource authority
- archive target resolution and published clear to canonical Resource authority
- restore target resolution to canonical Resource authority
- snapshot Trust-copy source to canonical Resource working position
- current content fingerprint Discovery target to canonical Resource working position
- public Audio read to canonical Resource published position
- Citation/Credit exact-current-working checks to canonical Resource authority
- Audio Discovery metadata current/successor working position to canonical Resource authority

The migration contains no `GRANT` or `REVOKE`. Migration-local postflight
compares owner, `SECURITY DEFINER`, fixed search path, volatility, and exact
pre-A2 ACL bytes dynamically against the transaction baseline.

The permanent verifier validates ACL authority semantically with
`has_function_privilege` rather than comparing `proacl::text` array order,
because PostgreSQL may preserve identical grants in a different array order.

## Preview chronology and corrections

A premature disposable preview was initially created before the documented local
candidate gate and was deleted before any A2 apply. It is not A2 evidence.

The canonical A2-only preview was created only after the final local candidate
passed the required focused contracts, critical suite, build, exact scope, and
byte seal.

Canonical preview:

- project ref: `liuvgtilojskelwsgkxu`
- branch id: `e8da5fc4-1944-49a3-ae75-a5141933fbbd`
- baseline migration count/head: `59` / `20260828120229`
- accepted A2 migration count/head: `60` / `20260828135801`
- A2 migration SHA-256:
  `3fe5411079dab4ff198e0b66b93b25ff2ad776e654de66fac4eeb1eca66518f5`

Two failed native preview applies rolled back before migration history advanced:

1. the first exposed a greedy typed-writer detector that falsely classified
   the non-pointer binding `INSERT` in `public.create_audio_publication`
2. the second exposed missing parentheses around the corrected `AND (regex OR
   regex)` predicate, which allowed `pg_get_functiondef` to reach aggregates

Neither failure changed production or advanced preview migration history.

The final migration bytes were then executed end-to-end on the canonical preview
inside a rollback transaction, including preflight, all ten exact-fragment
rewrites, and postflight, before native apply was retried.

Full rollback rehearsal result:

`PHASE_7A_K4C_A2_REHEARSAL_AND_VERIFIER_EQUIVALENT_PASS`

Rehearsed authority result:

- business typed-pointer readers: `0`
- total typed-pointer writers: `1`
- pointer drift: `0`

Those same migration bytes then applied natively and reached exactly `60/A2`
with zero pending.

## Permanent verifier acceptance

The permanent A2 verifier passed independently on the live 60/A2 preview:

`PHASE_7A_K4C_A2_AUDIO_REMAINING_POINTER_CONVERGENCE_PASS`

Result counts:

- business typed-pointer readers: `0`
- total typed-pointer writers: `1`
- pointer drift: `0`

The sole remaining typed pointer writer is the K1 compatibility helper retained
for A3.

## Targeted governed behavior acceptance

A rollback-only authenticated administrator fixture exercised the A2-changed
runtime path without replaying the already-proven A1 lifecycle.

The fixture covered:

1. standalone Audio publication creation
2. canonical Resource working pointer creation with typed mirror parity
3. a changed-content working snapshot taking the new-snapshot path
4. Citation replacement against the exact canonical current working version
5. Credit replacement against the exact canonical current working version
6. archive through the A1 shared lifecycle adapter
7. restore through the A1 shared lifecycle adapter
8. zero typed/Resource pointer drift throughout
9. zero fixture residue after rollback

Acceptance marker:

`K4C_A2_TARGETED_GOVERNED_BEHAVIOR_PROOF_PASS`

Post-rollback result:

- fixture residue: `0`
- business typed-pointer readers: `0`
- total typed-pointer writers: `1`
- pointer drift: `0`

## Pre-existing working-snapshot reuse defect

The targeted fixture also exposed a pre-existing defect in
`public.snapshot_audio_publication_working_version`.

Production/A1 already declares `v_snapshot record` and then, on the unchanged
same-content reuse branch, assigns fields such as
`v_snapshot.version_id := v_current.id` before the untyped record has acquired a
tuple structure. PostgreSQL raises:

`record "v_snapshot" is not assigned yet`

Production definition MD5 before A2:

`694a3b1c0495aaa6f60ad18423ab46dd`

A2 did not introduce this defect and does not widen into a business-logic repair.
The A2 fixture therefore changed fixture content inside the rollback transaction
so the governed snapshot command exercised the new-snapshot path whose pointer
authority A2 actually changes.

This defect must remain explicit legacy debt for a separately bounded repair.

## Advisor acceptance

A2-specific preview-versus-production advisor comparison found:

- new A2-related security warnings: `0`
- new A2-related performance regressions: `0`
- one preview-only `unused_index` INFO on
  `editorial.resources.resources_visibility_idx`

That INFO is usage-history noise on a fresh preview. A2 creates no table or
index.

## A2 exit proof

A2 has now proved:

- no governed Audio command directly writes typed Audio pointer fields
- no business function reads typed Audio pointer fields
- all four typed compatibility columns still exist
- both K1 synchronization directions remain live
- pointer parity remains zero
- A1 typed event-writer retirement remains intact
- Playlist P3 pointer retirement remains intact
- Video still has no typed event authority
- target function security and execution perimeter remain accepted
- zero rollback-fixture residue

The only remaining typed writer is the K1 Resource-to-typed compatibility
primitive, exactly as required before A3.

## Required repository seal before PR

The existing control-plane tooling must now bind the accepted preview to the
repository:

1. regenerate `src/types/database.types.ts` and require no semantic type change
2. regenerate `docs/engineering/live-schema-baseline.json` in preview-seal mode
3. write the canonical migration replay proof for
   `20260828135801_phase_7a_k4c_a2_audio_remaining_pointer_convergence.sql`
4. run `verify-migration-replay-contract.mjs`
5. restore the production link
6. run `verify-live-schema.sh`, which must accept one pending production
   migration through the replay contract
7. run the final focused, critical, build, and diff gates on the exact PR bytes
8. commit and push only after all gates are green

Preview-proven migration bytes must remain byte-identical through PR and
production promotion.

## Deployment boundary

- SQL migration needed: Yes
- Supabase Edge Function deploy needed: No
- frontend deploy needed: No
- Readdy Finish update needed: No
- schema columns change in A2: No
- generated database types expected to change in A2: No semantic type change
- production mutation before merge: No
- A3 compatibility retirement: Deferred until A2 is production-sealed

## Repository replay/schema seal

Canonical replay/schema seal completed after preview acceptance.

- preview project ref: `liuvgtilojskelwsgkxu`
- preview branch id: `e8da5fc4-1944-49a3-ae75-a5141933fbbd`
- migration head: `20260828135801`
- migration SHA-256: `3fe5411079dab4ff198e0b66b93b25ff2ad776e654de66fac4eeb1eca66518f5`
- permanent verifier SHA-256: `2dbc4a744453572fff8717b3411a021ef4cd29251da566519e560d5855446250`
- database types SHA-256: `b881539a4d8b8d09c3eb44301757320d80b820222c79c37634145a9b9b6acb3f`
- live-schema baseline SHA-256: `9b46f8e138f5946566d291ad4ab4900352f789a485726cae530fbd51ec0a645d`
- replay proof SHA-256: `e16b8fcdb89ed24cda3593cb6f17c3895f9dc6c6944b065477b308ee4d0fd211`
- semantic database type change: none
- replay contract: PASS

A2 is repository-sealed and ready for PR/CI.
