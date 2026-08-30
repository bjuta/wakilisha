# Phase 7A K4C-A1: Audio Shared-Event Convergence Implementation Audit

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


Status: PREVIEW SEALED - READY FOR PRE-PR PROMOTION.

Opened: 28 August 2026

Accepted main at implementation open:

`3d8d5f6ff1fdb0f07a3b4c193b34f840787785d6`

Accepted production migration head at implementation open:

`20260827205119_phase_7a_k4c_p3_playlist_pointer_compatibility_retirement`

Accepted production migration count at implementation open:

`58`

Canonical native A1 migration:

`supabase/migrations/20260828120229_phase_7a_k4c_a1_audio_shared_event_convergence.sql`

Design authority:

`docs/engineering/phase-7a-k4c-audio-command-convergence-design.md`

## Scope

K4C-A1 retires Audio typed review and lifecycle tables as new-write authority without deleting historical rows or removing K1 Audio pointer compatibility.

The implementation candidate:

- catches up any typed Audio review or lifecycle events written after K4A;
- moves Audio submit to shared Resource lifecycle and review history;
- moves Audio review decisions to shared Resource review history and shared lifecycle history only for durable lifecycle transitions;
- moves Audio publish to canonical Resource approved/published pointers and shared lifecycle history;
- routes `audio.append_publication_lifecycle_event` into the shared Resource lifecycle helper;
- moves rewritten Audio submit, review, and publish pointer reads/writes to `editorial.resources.current_*`;
- moves the admin Audio workspace review/lifecycle history to shared Resource ledgers;
- moves the Audio editorial workbench current submitted pointer to canonical Resource position;
- moves new timed-review thread exact-submitted checks to canonical Resource position;
- moves the timed-review integrity trigger exact-submitted check to canonical Resource position;
- preserves Audio-specific timed discussion tables and semantics;
- preserves Audio Media public-safety gates, immutable version identity, podcast GUID, enclosure identity, and publication snapshots;
- preserves public RPC signatures and JSON response contracts;
- preserves K1 Audio typed-pointer mirror compatibility until A3;
- preserves typed Audio event tables as immutable compatibility history;
- leaves remaining Audio pointer writer convergence to A2 and pointer-column retirement to A3.

## Native migration identity

The canonical migration filename was minted on the project Mac with Supabase CLI `2.107.0` from exact accepted main.

Migration version:

`20260828120229`

The native open gate proved:

- local main fast-forwarded to accepted `3d8d5f6f...`;
- linked production project was `pgzizndxdyhqmtyywjmt`;
- production was exactly 58 migrations at P3;
- `supabase db push --dry-run` reported zero pending migrations;
- A1 branch was created from exact accepted main;
- exactly one empty untracked native migration file existed;
- no production mutation, commit, push, PR, Edge, frontend, or Readdy action occurred.

## Production evidence before candidate construction

Read-only production evidence on 28 August 2026 proved:

- typed Audio review rows: 3;
- typed Audio review fingerprint: `eb181a1390cbb1b732a2ce3bfa05faf3`;
- typed Audio lifecycle rows: 0;
- typed Audio lifecycle fingerprint: `d41d8cd98f00b204e9800998ecf8427e`;
- typed Audio review rows missing from shared K4A history: 0;
- typed Audio lifecycle rows missing from shared K4A history: 0;
- Audio Resource/typed lifecycle pointer parity drift: 0;
- live typed Audio event writers: exactly 3.

The three live typed-event writers were:

1. `public.submit_audio_publication_for_review`
2. `public.review_audio_publication`
3. `audio.append_publication_lifecycle_event`

`public.publish_audio_publication_version` did not write a typed lifecycle row before A1, but A1 must add canonical shared `published` lifecycle history.

## Live authority metadata pinned before rewrite

The candidate was derived against current production definitions, not memory.

Pinned security contracts:

- all changed functions are owned by `postgres`;
- all changed functions are `SECURITY DEFINER`;
- browser RPCs remain executable by `authenticated` and `service_role`, not PUBLIC or `anon`;
- internal lifecycle and trigger helpers remain non-executable by application roles;
- each existing function search path is preserved exactly.

Pinned live definition fingerprints before A1 included:

- submit: `954074ab122752f6b054966455172288`
- review: `438af33b1ef0e2ad5fffc68fbc8b92db`
- publish: `15ed51212e77ff1fea9d8862cb773126`
- admin workspace: `bcba6a7321c352b0a4ba59fb40c9d6ca`
- editorial workbench: `f0ae0223bfb43536d1c2aa74e7c61f1c`
- time-review create: `a426579239db84909b2b8cf3493f06e6`
- timed-review integrity trigger helper: `11aa801272bfb316eb91a54544fd93b7`
- Audio lifecycle helper: `f2bdf932aca85f76b3ef14ecbd8beeb6`
- shared lifecycle append helper: `d84d503da70733c010a93025bca7cda7`
- shared review append helper: `54b3f889a5b91bf399bb64b52b830134`

## Compatibility catch-up

K4A already mapped all currently known Audio typed history into shared Resource history.

A1 still contains a compatibility-window catch-up so correctness does not depend on production remaining idle between K4A and A1.

For missing typed lifecycle history the catch-up:

- preserves the source event UUID as canonical shared event UUID;
- preserves Resource and Resource Version identity;
- preserves action, prior/resulting status, note, metadata, actor, receipt, and timestamp;
- records `legacy_source_authority = 'audio_publication_lifecycle'`;
- records `legacy_source_event_id`;
- appends after existing canonical event sequence;
- never changes the source typed row.

For missing typed review history the catch-up additionally preserves exact target/result version and correlation identity and records `legacy_source_authority = 'audio_publication_review'`.

A1 fails before catch-up if it finds:

- missing or cross-Resource version identity;
- UUID collision with unrelated shared history;
- disabled or unknown shared action vocabulary;
- invalid command receipt Resource/actor identity;
- pre-existing Audio pointer parity drift.

Production currently requires zero catch-up rows. Preview must prove both catch-up paths with committed compatibility-window fixtures before A1 apply.

## Audio submit convergence

`public.submit_audio_publication_for_review` retains its existing signature, idempotency key, expected authority revision, permission check, result shape, and Media public-safety checks.

A1 changes authority only:

- locks the canonical Resource row;
- writes `current_submitted_version_id` and clears `current_approved_version_id` on `editorial.resources`;
- relies on K1 reverse synchronization to keep typed Audio mirrors equal;
- records shared lifecycle `submitted`;
- records shared review `submitted` targeting the exact immutable submitted version;
- uses one correlation ID for both events;
- writes no new typed Audio review event.

The current Media gate remains intact, including exact current master, selected `audio_delivery` variant, verified `audio/mpeg`, non-zero byte size, SHA-256, immutable media delivery URL, active asset state, public-safety approval, consent, rights, and embargo checks.

## Audio review convergence

`public.review_audio_publication` retains:

- `start_review`;
- `request_changes`;
- `approve`;
- review capability checks;
- expected authority revision;
- exact submitted version identity;
- stale content fingerprint rejection;
- frozen Media selection during decision;
- immutable approved version creation;
- existing return contract.

Authority changes:

- exact submitted position comes from `editorial.resources.current_submitted_version_id`;
- `start_review` appends shared review `review_started` only;
- `request_changes` appends shared review and lifecycle `changes_requested`;
- `approve` appends shared review and lifecycle `approved`;
- lifecycle transition prior status comes from the last shared lifecycle event, so `review_started` does not invent a lifecycle state;
- current approved pointer changes on canonical Resource authority;
- no new typed Audio review event is written.

## Audio publish convergence

`public.publish_audio_publication_version` retains the accepted M3 publication identity contract:

- exact approved immutable version;
- last-moment Media public-safety assertion;
- stable `urn:uuid:<publication-id>` podcast GUID;
- stable `https://wakilisha.africa/audio/enclosures/<publication-id>.mp3` enclosure identity;
- immutable published Audio version;
- immutable publication snapshot with exact Media delivery evidence;
- command idempotency and expected authority revision.

A1 moves approved/published pointer authority to Resource and appends canonical shared lifecycle `published`.

## Audio lifecycle adapter

The existing internal signature remains:

`audio.append_publication_lifecycle_event(uuid,uuid,uuid,text,text,text,text,uuid,uuid,jsonb)`

Its implementation becomes a one-way adapter.

It:

- verifies publication to Resource binding;
- verifies Resource Version identity when present;
- verifies command receipt Resource and actor identity;
- resolves correlation from explicit metadata, request payload, or result payload;
- fails closed if canonical correlation identity cannot be established;
- adds publication identity to shared event metadata;
- writes through `editorial.append_resource_lifecycle_event`;
- returns the canonical shared event UUID;
- never inserts into `audio.publication_lifecycle_events`.

This lets untouched archive/restore and other A2-deferred commands converge event history without widening A1 pointer scope.

## Audio workspaces

`public.get_admin_audio_publication_workspace` keeps its current JSON keys while moving:

- current working/submitted/approved/published pointers to canonical Resource fields;
- review history to `editorial.resource_review_events`;
- lifecycle history to `editorial.resource_lifecycle_events`;
- Trust current-working target resolution to the canonical Resource working pointer.

It preserves publication, master, transcript, chapters, Trust, feed identity, and capability payloads.

`public.get_audio_editorial_workbench` keeps its current frontend JSON contract and continues to expose:

- exact frozen submitted delivery URL;
- waveform URL;
- duration;
- source probe;
- frozen submitted chapters;
- time-anchored review threads and rich comments.

Only current submitted pointer authority changes to `editorial.resources`.

## Time-anchored Audio review remains domain-specific

A1 does not migrate `audio.publication_review_threads` or `audio.publication_review_comments` into shared Resource event ledgers.

`public.create_audio_time_review_thread` and `audio.assert_publication_review_thread_integrity` now resolve exact current submitted identity from the canonical Resource row while preserving:

- time-point anchors;
- time-range anchors;
- open/resolved thread state;
- rich comment semantics;
- immutable submitted-version binding;
- duration-bound anchor validation.

## Security boundary

A1 creates no new browser mutation RPC.

The migration explicitly normalizes replaced public RPCs to the accepted perimeter:

- PUBLIC: no execute;
- `anon`: no execute;
- `authenticated`: execute;
- `service_role`: execute.

Internal helpers remain closed to all application roles.

Typed Audio event tables gain no application-role INSERT, UPDATE, or DELETE authority.

Changed function owner, `SECURITY DEFINER`, and fixed search paths are permanently verified.

## Primitive compounding and cross-domain ratchets

A1 must not regress previously accepted shared primitives.

The candidate and permanent verifier keep these ratchets explicit:

- Playlist P3 typed lifecycle pointer columns stay retired;
- Video typed review/lifecycle event tables remain absent;
- shared Resource event sequences remain contiguous;
- K1 Audio typed-pointer mirrors remain exactly equal during the A1 compatibility window;
- shared append helpers remain hardened and internal.

## Required local gates

Before preview:

1. exact branch and native migration prestate;
2. exact four-file implementation scope;
3. focused A1 static contract;
4. K4A/K4B/P1/P2/P3 ratchets;
5. Primitive Compounding;
6. `git diff --check`;
7. `npm run test:critical`;
8. `npm run build:app`;
9. exact final four-file byte seal.

No GA4 or full SEO build is required because A1 changes only SQL/control-plane artifacts.

## Required preview acceptance

A fresh disposable preview must first replay all 58 accepted migrations through Playlist P3.

Before applying A1, the preview must create committed compatibility-window fixture state containing:

1. temporary Audio Resource/publication;
2. exact immutable Audio Resource Version identity;
3. one typed Audio review event not yet mapped to shared history;
4. one typed Audio lifecycle event not yet mapped to shared history.

A1 apply must catch up both exactly while leaving typed source rows unchanged.

After apply, rollback-only governed Audio proof must cover the A1 design acceptance contract, including submit, review_started, timed point/range feedback, invalid duration rejection, changes request, resubmit, approve, publish, stable GUID/enclosure identity, archive/restore adapter behavior, idempotency, stale revision rejection, JSON-shape stability, no typed event growth, pointer parity, and zero fixture residue.

The permanent A1 verifier must then pass independently.


## Preview apply correction

The first A1 preview apply attempt on the fresh 58/P3 disposable branch rolled back inside the migration-local structural proof before migration history advanced.

The failure was a verifier defect, not a command-authority defect. The submit rewrite correctly locks the canonical Resource and writes `current_submitted_version_id = v_snapshot.version_id` on `editorial.resources`; it does not need to read a pre-existing `v_resource.current_submitted_version_id` value.

The migration-local proof and permanent verifier were corrected to assert the exact canonical submitted-pointer write instead of requiring that unnecessary read. A focused regression assertion now pins this distinction.

No governed Audio runtime function body changed as part of this correction. The failed migration transaction left the preview at 58/P3 with the committed compatibility-window fixture intact and unmapped.

## Canonical preview acceptance seal

Canonical preview:

- project ref: `uojfovzbfqwrugiogibn`
- branch id: `483e8f97-5396-46bc-9fd8-17d66b11f4b8`
- migration count: 59
- migration head: `20260828120229`
- migration SHA-256:
  `81bcde64ed132559708bfe143e296d6fe403c5525c2b4bd3fa019721376c96c9`
- permanent verifier SHA-256:
  `3d26d814bf4281f34f2de3e32d9db2de4a4a8eecf80451cbf7ddea7ee19a0ef0`
- focused A1 test SHA-256:
  `223c645c403f5274d6ec21372643c6544432b51637855432dc7f545f377d7bf2`
- generated database types SHA-256:
  `b881539a4d8b8d09c3eb44301757320d80b820222c79c37634145a9b9b6acb3f`
- replay proof SHA-256:
  `adaf57e9abe54b94b981258f8310385829c79dbe4d6df0266add84626f261c3d`
- live-schema baseline SHA-256:
  `c293c8b63e3028b035dbbd4a8ad7b5d14ee4068192a12eaa556c89dae27ee8fd`

The preview was created data-less and replayed all 58 accepted migrations through
K4C-P3 before A1 was allowed to apply.

Pre-A1 compatibility-window fixture proof:

- typed Audio review rows under fixture: 1
- typed Audio lifecycle rows under fixture: 1
- shared review mappings under fixture: 0
- shared lifecycle mappings under fixture: 0
- Audio typed/shared pointer drift: 0

A1 then reached 59 migrations / `20260828120229` with zero pending.

Post-A1 compatibility catch-up proof:

- typed Audio review rows: 1
- typed Audio lifecycle rows: 1
- mapped shared Audio review rows: 1
- mapped shared Audio lifecycle rows: 1
- live typed Audio event writer functions: 0
- Audio typed/shared pointer drift: 0

Independent permanent verifier:

`PHASE_7A_K4C_A1_AUDIO_SHARED_EVENT_CONVERGENCE_PASS`

Permanent-verifier result counts:

- typed Audio review events: 1
- typed Audio lifecycle events: 1
- shared Audio review events: 1
- shared Audio lifecycle events: 1

Rollback-safe governed runtime fixture:

`K4C_A1_GOVERNED_BEHAVIOR_PROOF_PASS`

The governed fixture proved:

1. canonical Audio master attachment through `public.set_audio_publication_master`
2. stale authority-revision submit rejection
3. submit to shared lifecycle + review history
4. submit idempotent replay with the same receipt and submitted version
5. canonical Resource/typed submitted pointer parity
6. `review_started` in review history without inventing a lifecycle transition
7. time-point and time-range review threads against the exact submitted version
8. out-of-duration review anchor rejection
9. existing admin-workspace and Audio-workbench JSON contracts
10. changes-requested lifecycle + review transition
11. resubmit to a new immutable submitted version
12. stale prior-submitted review rejection
13. second review start and exact submitted targeting
14. approval with canonical Resource/typed approved pointer parity
15. publish with canonical Resource/typed published pointer parity
16. stable `urn:uuid:` podcast GUID identity
17. stable WAKILISHA enclosure URL identity
18. archive and restore routed through shared lifecycle authority
19. no typed Audio review/lifecycle row growth
20. final Audio pointer parity

Observed rollback-fixture output before rollback:

- final restored publication status: `draft`
- shared review events: 6
- shared lifecycle events: 7
- timed review threads: 2

Post-rollback residue proof was zero across the synthetic auth user, role
assignment, Resource, publication, typed/shared versions, shared events, timed
review threads, command receipts, Media asset, Media files, Media revision,
Media governance version, delivery variant, and Audio master usage.

Advisor acceptance:

- all A1-relevant security advisor fingerprints on the preview already exist
  on production/P3
- A1 introduced no new A1-specific security warning
- RLS-with-no-policy INFO findings on the typed/shared event stores are the
  existing closed-table model, not new application access
- performance INFO differences on the fresh preview are environment-sensitive
  unused-index/foreign-key observations and are not A1 schema regressions
- A1 creates no table or index

The first A1 candidate apply stopped transactionally on an over-constrained
submit verifier assertion. That verifier-only defect was corrected to prove the
actual canonical submitted-pointer write. No governed Audio runtime function
body changed in that correction.

Two later rollback-fixture stops were also harness-only discoveries: Audio
master setup must use the governed master command, and the Audio workbench
contract uses `target_version` / `threads` keys. Both attempts rolled back with
no residue and required no A1 runtime change.

## Deployment boundary

Current candidate phase:

- SQL migration needed: Yes, preview-proven and ready for PR.
- canonical migration filename minted: Yes.
- canonical preview replay/schema seal: Complete.
- permanent A1 verifier: Pass.
- governed rollback behavior proof: Pass.
- Supabase Edge Function deploy needed: No.
- Readdy Finish update needed: No.
- frontend deploy needed: No.
- production mutation: No.
- PR needed now: Yes, after this sealed candidate is committed and pushed.

Production remains at 58/P3. A1 production SQL promotion must happen only from
merged main after protected CI is green and the PR is merged.
