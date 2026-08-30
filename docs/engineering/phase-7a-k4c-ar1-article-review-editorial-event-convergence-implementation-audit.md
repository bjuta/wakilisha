# Phase 7A K4C-AR1: Article Review and Editorial Event Convergence Implementation Audit

Status: PREVIEW SCHEMA + RUNTIME ACCEPTED. WAITING CANONICAL NATIVE MIGRATION PUSH.

Opened: 29 August 2026

Design authority:

`docs/engineering/phase-7a-k4c-article-command-convergence-design.md`

Accepted main / production baseline:

- accepted main: `a668d8113316b27307b474f7b961d6f2bcdd8506`
- production migrations: `61`
- production head:
  `20260829092902_phase_7a_k4c_a3_audio_pointer_compatibility_retirement`
- K4C-A3 production verifier: PASS
- production pending migrations: `0`

Canonical AR1 migration identity:

`20260829114236_phase_7a_k4c_ar1_article_review_editorial_event_convergence`

The migration timestamp was minted through the pinned local Supabase CLI
`2.107.0` from the exact accepted main and 61/A3 production boundary.

## Purpose

AR1 is the first Article slice of K4C legacy command convergence.

It moves the review-side Article lifecycle writers onto canonical shared
Resource lifecycle/review ledgers while preserving the existing Article editor,
review, suggestion, and RPC contracts.

AR1 does not modify publication or scheduling authority. Those six typed-event
writers remain deliberately deferred to AR2.

## Production opening evidence

Independent production introspection established:

- Article Resources: `217`
- Article Resources with working pointer: `217`
- with submitted pointer: `2`
- with approved pointer: `2`
- with published pointer: `208`
- Article binding columns:
  `resource_id`, `resource_kind`, `article_id`
- typed Article lifecycle rows: `35`
- shared K4A imports: `35`
- unmapped typed rows: `0`
- shared Article lifecycle rows: `35`
- new non-legacy Article shared lifecycle rows: `0`
- shared Article review rows: `0`

Typed action distribution at AR1 open:

- submitted: `16`
- approved: `9`
- changes_requested: `5`
- published: `2`
- archived: `2`
- restored: `1`

Latest typed Article lifecycle event:

`2026-08-06T19:42:45.87305+00:00`

No Article typed lifecycle drift occurred between K4A and AR1 design open.

## Direct typed lifecycle writers at AR1 open

Production contains exactly ten functions that directly insert into
`editorial.article_lifecycle_events`:

1. `public.submit_article_for_review`
2. `public.request_article_changes`
3. `public.approve_article_version`
4. `public.accept_article_suggestion`
5. `public.publish_article_version`
6. `public.schedule_article_publication`
7. `public.publish_due_article_publications`
8. `public.unpublish_article`
9. `public.archive_article`
10. `public.restore_article_from_archive`

AR1 rewrites only the first four.

After AR1, the expected direct typed writer set is exactly:

1. `public.archive_article`
2. `public.publish_article_version`
3. `public.publish_due_article_publications`
4. `public.restore_article_from_archive`
5. `public.schedule_article_publication`
6. `public.unpublish_article`

Those six are byte-pinned to the accepted production definitions and must not
change in AR1.

## Remaining typed lifecycle readers at AR1 open

Three production functions read typed Article lifecycle history:

1. `public.list_article_lifecycle_events`
2. `editorial.correction_article_publication_proof`
3. `editorial.derive_publishing_editorial_state`

AR1 rewrites only the public lifecycle list RPC.

Corrections and Publishing readers remain deferred to AR3.

## Shared primitive authority

AR1 reuses without modification:

`editorial.append_resource_lifecycle_event(...)`

Accepted production MD5:

`d84d503da70733c010a93025bca7cda7`

`editorial.append_resource_review_event(...)`

Accepted production MD5:

`54b3f889a5b91bf399bb64b52b830134`

Both remain internal, `SECURITY DEFINER`, fixed-search-path functions with
execution revoked from browser/application roles.

## Legacy Article command-receipt bridge

The existing Article review RPC signatures predate caller-supplied idempotency
and correlation parameters.

AR1 preserves those signatures.

The candidate introduces one internal-only helper:

`platform_private.begin_legacy_authenticated_article_command(text,uuid,jsonb)`

The helper:

- requires an authenticated user
- permits only the four AR1 command types
- generates one correlation UUID per legacy RPC invocation
- generates a unique legacy idempotency key from that UUID
- delegates receipt creation to the existing
  `platform_private.begin_authenticated_resource_command`
- marks the request payload with `legacy_rpc_bridge = true`
- returns only receipt and correlation identity
- has a fixed search path
- has execution revoked from `PUBLIC`, `anon`, `authenticated`, and
  `service_role`

This does not claim externally idempotent legacy Article RPC behavior. A retry
is still a new legacy invocation.

## Public RPC ACL preservation

A native disposable-preview apply exposed a Supabase/Postgres privilege side
effect that the permanent verifier correctly rejected: the five replaced public
Article functions acquired explicit `anon` execute while accepted production
has only `authenticated` and `service_role` execute.

The canonical migration now restores the accepted production perimeter
explicitly after replacement:

- revoke `PUBLIC` and `anon`
- grant `authenticated` and `service_role`

This is not a browser contract change. It prevents an unintended widening and
makes the accepted production ACL an explicit migration invariant.

## AR1 command vocabulary

The candidate registers exactly four enabled command types:

1. `article.review.submit`
2. `article.review.request_changes`
3. `article.review.approve`
4. `article.review.suggestion.accept`

Each uses the established synchronous command/outbox naming pattern:

- `.sync`
- `.accepted`
- `.succeeded`
- `.failed`
- `.retry_scheduled`

No publication/scheduling Article command type is introduced by AR1.

## Submit convergence

`public.submit_article_for_review(uuid,bigint,text)` keeps its existing public
signature and return shape.

It still:

- requires authentication
- locks the Article and canonical Resource
- requires Article edit permission
- enforces exact expected draft version
- moves `wk_articles.wp_status` to `pending`
- increments `draft_version`
- creates an immutable submitted Article Version
- sets canonical
  `editorial.resources.current_submitted_version_id`

It now additionally:

- begins one internal Article review-submit receipt
- appends shared lifecycle `submitted`
- appends shared review `submitted`
- completes the receipt with the legacy RPC result identity

It no longer inserts typed Article lifecycle history.

## Changes-requested convergence

`public.request_article_changes(uuid,uuid,text)` preserves:

- required note
- review permission
- exact target version resolution
- Article return to draft
- draft-version increment
- canonical Resource draft/private state
- legacy return shape

It now writes shared lifecycle and review `changes_requested` events through one
internal receipt.

It no longer inserts typed Article lifecycle history.

## Approval convergence

`public.approve_article_version(uuid,uuid,text)` preserves:

- review permission
- source-version resolution
- immutable copied approved Article Version
- canonical approved pointer
- legacy return shape

The shared lifecycle event points at the new approved version.

The shared review event binds:

- target: exact reviewed/source version
- result: new approved version
- action: `approved`

It no longer inserts typed Article lifecycle history.

## Accepted-suggestion convergence

`public.accept_article_suggestion(uuid,bigint,text)` preserves the existing
stale branch byte-for-behavior: stale suggestions resolve their thread and write
only suggestion audit history, without inventing a lifecycle transition.

For the accepted branch it preserves:

- exact submitted target identity
- target fingerprint validation
- `editorial.apply_article_review_snapshot`
- accepted suggestion event
- resolved accepted thread
- remaining competing suggestions marked stale
- Article return to draft
- complete proposed-document snapshot semantics

It now adds:

- shared lifecycle `changes_requested`
- shared review `changes_requested`
- target version = submitted review-round target
- review result version = `NULL`, preserving the accepted K4A rule that only
  `approved` review events may carry `result_version_id`
- applied working-version identity remains in the existing suggestion audit and
  lifecycle metadata
- lifecycle metadata retaining suggestion identity and review-round closure facts
- one completed internal receipt

The detailed suggestion tables remain the fine-grained suggestion audit
authority.

## Lifecycle list convergence

`public.list_article_lifecycle_events(uuid,integer)` preserves its public
signature and return columns.

It now reads:

- Article identity from `editorial.article_resources`
- lifecycle events from `editorial.resource_lifecycle_events`
- version number from `editorial.article_versions`
- actor label from `auth.users`

It no longer reads `editorial.article_lifecycle_events`.

Historical rows preserve their UUID and timestamps through the K4A mapping, so
the list remains continuous across historical and post-AR1 shared events.

## Deferred AR2 authority

AR1 preflight, migration postflight, permanent verifier, and focused tests
byte-pin the six deferred publication/scheduling definitions:

- publish:
  `d3c2a715d0596e4033e7e319c0b3d4f4`
- due scheduled publish:
  `09b9ecbbec742481f6146fdaa250b435`
- schedule:
  `105d47e009ec279e3a7e5a362662a31d`
- unpublish:
  `8f52aca8823b4d23ec995526745176dc`
- archive:
  `bc19cc8ba0945d118d743eb709b80d2d`
- restore:
  `d4239c78dd5cbb2f7da7823b7cf60873`

The known pre-existing scheduler reference to `version.kind` therefore remains
untouched in AR1 and is still explicit AR2 debt.

## Candidate files

AR1 currently contains:

1. `supabase/migrations/20260829114236_phase_7a_k4c_ar1_article_review_editorial_event_convergence.sql`
2. `scripts/control-plane/verify-phase-7a-k4c-ar1-article-review-editorial-event-convergence.sql`
3. `test/control-plane/phase-7a-k4c-ar1-article-review-editorial-event-convergence.test.ts`
4. this implementation audit

## Permanent verifier contract

The verifier proves:

- all typed Article lifecycle history remains mapped
- exactly six typed Article lifecycle writers remain, all deferred AR2 functions
- all four AR1 review writers use shared lifecycle/review append helpers
- no AR1 writer inserts typed Article lifecycle history
- the lifecycle list RPC reads shared history
- bridge search path/security perimeter is closed
- existing public Article RPC execution perimeter remains present for
  `authenticated`
- exactly four AR1 command types exist and are enabled
- shared append helpers remain byte-identical
- all six AR2 functions remain byte-identical
- shared event numbering remains contiguous
- Playlist/Audio pointer-retirement ratchets remain closed
- Video typed event authority remains absent

Acceptance marker:

`PHASE_7A_K4C_AR1_ARTICLE_REVIEW_EDITORIAL_EVENT_CONVERGENCE_PASS`

## Preview findings and runtime proof

Disposable preview v2:

- branch id: `19b53356-9909-41fa-81b4-92e31e70a603`
- project ref: `jmdljplffkuumpeireht`
- hourly cost: `$0.01344`
- baseline history: exact `61`
- baseline head:
  `20260829092902_phase_7a_k4c_a3_audio_pointer_compatibility_retirement`
- A3 permanent verifier: PASS before AR1 candidate execution

The first disposable preview was discarded after MCP `apply_migration` minted
a competing preview-only migration version instead of the canonical CLI-minted
`20260829114236` identity. That preview was deleted rather than normalized.

Preview v2 intentionally uses direct SQL for schema/runtime proof so migration
history remains exact 61/A3 until the canonical native CLI push.

### K4A review-result shape correction

Before preview apply, shared review constraints proved that only `approved`
events may carry non-null `result_version_id`.

The first candidate had mapped accepted suggestions as
`changes_requested` with the newly applied working version in
`result_version_id`.

AR1 was corrected before preview acceptance:

- review target = submitted review-round version
- review result = `NULL`
- applied working version remains in the existing suggestion audit and shared
  lifecycle metadata

No shared primitive or constraint was widened.

### Preview ACL provisioning drift

A fresh 61/A3 Supabase preview provisions the five Article RPCs with explicit
`anon` execute even though production does not.

The permanent AR1 verifier rejected that broader perimeter.

The canonical migration now explicitly restores production-equivalent ACLs
after replacement:

- `PUBLIC`: no execute
- `anon`: no execute
- `authenticated`: execute
- `service_role`: execute

The corrected candidate passes the permanent verifier with this perimeter.

### Permanent verifier result

Preview v2 result:

`PHASE_7A_K4C_AR1_ARTICLE_REVIEW_EDITORIAL_EVENT_CONVERGENCE_PASS`

Observed static authority after AR1 candidate schema apply:

- typed Article lifecycle writers remaining: `6`
- remaining writer set: exactly AR2 publication/scheduling functions
- typed Article lifecycle rows in no-data preview: `0`
- shared Article lifecycle rows before runtime fixtures: `0`
- shared Article review rows before runtime fixtures: `0`

### Submit runtime fixture

Rollback-safe authenticated administrator fixture proved:

- Article status: `draft -> pending`
- draft version: `1 -> 2`
- auto-provisioned Article Resource owner: fixture editor
- canonical submitted pointer: populated
- typed Article lifecycle writes: `0`
- shared lifecycle events: one `submitted`
- shared review events: one `submitted`
- lifecycle/review command receipt identity: same receipt
- correlation identity: non-null and shared
- command receipt status: `succeeded`
- command type: `article.review.submit`

### Changes-requested + resubmit + approve fixture

Rollback-safe runtime path proved the sequence:

`submitted -> changes_requested -> submitted -> approved`

All four command receipts completed as `succeeded`.

Review-event shape proved:

- submit result version: `NULL`
- changes-requested result version: `NULL`
- approved target: exact submitted version
- approved result: new immutable approved version

Typed Article lifecycle writes remained `0`.

### Accepted-suggestion fixture

Rollback-safe accepted suggestion proved:

- Article returns `pending -> draft`
- content changes to proposed snapshot
- draft version increments
- accepted suggestion stores `applied_version_id`
- suggestion thread resolves
- `article.review.suggestion.accept` receipt succeeds
- shared lifecycle appends `changes_requested`
- lifecycle metadata preserves:
  - suggestion id
  - applied working version id
  - decision
  - review-round closure
- shared review appends `changes_requested`
- review target = submitted review-round version
- review result = `NULL`
- typed Article lifecycle writes remain `0`

### Stale-suggestion fixture

Rollback-safe stale-path proof deliberately invalidated the active submitted
pointer after creating the review suggestion.

Observed behavior:

- suggestion becomes `stale`
- thread resolves
- no `article.review.suggestion.accept` receipt is created
- no additional lifecycle event is created
- no additional review event is created
- only the original submit receipt/event remains

This preserves the pre-existing stale branch rather than inventing lifecycle
history for a stale suggestion.

### Lifecycle list runtime proof

The stale-path fixture called
`public.list_article_lifecycle_events(uuid,integer)` after submit.

It returned the shared `submitted` lifecycle event, proving the public reader
works against canonical shared history at runtime.

### Fixture residue

Post-rollback residue proof:

- fixture auth users: `0`
- fixture Articles: `0`
- fixture review threads: `0`
- fixture suggestions: `0`
- typed Article lifecycle rows: `0`
- shared Article lifecycle rows: `0`
- shared Article review rows: `0`
- preview migration count: `61`
- preview migration head: `20260829092902`

### Advisor delta

AR1-specific security advisor comparison is clean.

Production and preview both report the same five existing
`authenticated_security_definer_function_executable` WARN findings for the
five public Article RPCs. Those warnings are intentional existing API exposure
and are not new in AR1.

There is no AR1-specific performance advisor finding.

The preview has broader project-wide `anon` advisor noise caused by Supabase
preview ACL provisioning. The five AR1 RPCs are explicitly corrected to the
production perimeter by the migration and permanent verifier.

## Remaining preview acceptance plan

Before any production mutation:

Completed before canonical native migration push:

1. fresh paid disposable preview from production
2. exact 61/A3 baseline
3. full transactional candidate dry-run
4. corrected candidate schema apply through untracked direct SQL
5. permanent verifier PASS
6. authenticated rollback-safe runtime fixtures:
   - submit
   - changes requested
   - approve
   - accepted suggestion
   - stale suggestion
   - lifecycle listing
7. zero fixture residue
8. advisor delta

Remaining:

1. reset preview v2 to clean 61/A3 schema
2. native CLI push of exact canonical
   `20260829114236_phase_7a_k4c_ar1_article_review_editorial_event_convergence.sql`
3. require exact 62/AR1 migration history
4. rerun permanent verifier
5. rerun focused runtime smoke after canonical push
6. regenerate database types and require no semantic schema change outside
   intended function/command authority
7. record replay proof and live-schema baseline
8. run focused tests, critical suite, application build, replay contract,
   live-schema contract, and exact-scope diff
9. commit/push only preview-proven bytes
10. open protected PR
11. promote only after green CI and sealed preview
12. rerun production verifier after SQL promotion
13. compare production/preview advisor and migration parity
14. delete the paid preview only after the production seal

## Current boundary

Production remains untouched at 61/A3.

AR1 canonical preview migration, schema/runtime behavior, permanent verifier, advisor delta, and post-push runtime smoke are proven. Repository replay/live-schema sealing remains.

No Edge Function deployment is required.

No frontend deployment is required.

No Readdy Finish update is required.


## Canonical native preview push

Canonical CLI-native preview promotion completed on preview v3.

Preview v3:

- branch id: `b629663f-0bae-46fa-aaab-e2d94d02874a`
- project ref: `prewofyufkculzxqbyac`
- baseline before push: exact `61/A3`
- canonical pending migration count before push: `1`
- canonical pending migration:
  `20260829114236_phase_7a_k4c_ar1_article_review_editorial_event_convergence.sql`
- migration SHA-256:
  `43c347967718a6a06e598c3ecddecb6ef10239674e772e82a214cb2f8365696c`
- focused AR1 static tests: `14/14 PASS`
- application build: PASS
- native `supabase db push --linked`: PASS
- preview migration count after push: `62`
- preview migration head after push: `20260829114236`
- preview pending migrations after push: `0`
- production mutation: none

A first native-push handoff stopped falsely before mutation because Supabase CLI
2.107.0 emits dry-run status lines on stderr and the shell gate captured stdout
only. Independent preview history remained 61/A3. The corrected resume captured
stdout and stderr together, proved exactly one pending canonical migration, and
then pushed the same migration bytes.

## Independent canonical preview seal

After canonical native push, independent control-plane checks against
`prewofyufkculzxqbyac` proved:

- permanent AR1 verifier:
  `PHASE_7A_K4C_AR1_ARTICLE_REVIEW_EDITORIAL_EVENT_CONVERGENCE_PASS`
- typed Article lifecycle writer count: `6`
- production migration count/head: `61/A3`
- preview migration count/head: `62/AR1`
- first 61 migration versions: exact production/preview parity
- AR1-only security advisor findings: `0`
- AR1-only performance advisor findings: `0`
- generated TypeScript database types: byte-identical between production and
  preview
- generated type byte length: `618219` in both environments

The five existing authenticated `SECURITY DEFINER` Article RPC advisor WARNs
are identical between production and preview and remain intentional existing API
exposure. AR1 introduces no additional Article-relevant advisor finding.

## Canonical post-push runtime smoke

A fresh rollback-safe authenticated administrator fixture was executed after
the canonical migration was stamped as preview migration 62.

Decision path:

`submitted -> changes_requested -> submitted -> approved`

Observed:

- all four command receipts: `succeeded`
- approved review event target: exact submitted version
- approved review event result: immutable approved version
- non-approved review event result versions: `NULL`
- typed Article lifecycle writes: `0`

Accepted-suggestion path:

- submit receipt: `succeeded`
- suggestion-accept receipt: `succeeded`
- Article status after acceptance: `draft`
- Article draft version after acceptance: `3`
- Article content: accepted revised snapshot
- shared review sequence:
  `submitted -> changes_requested`
- suggestion `changes_requested` review result version: `NULL`
- typed Article lifecycle writes: `0`

The entire canonical post-push smoke transaction rolled back.
