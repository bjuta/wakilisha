# Phase 7A K4C-AR1: Article Review and Editorial Event Convergence Implementation Audit

Status: LOCAL CANDIDATE BUILT. PREVIEW NOT YET APPLIED.

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

## Preview acceptance plan

Before any production mutation:

1. create a fresh paid disposable Supabase preview from production
2. require the preview to reach exact 61/A3 baseline first
3. run full candidate migration transactionally with terminal commit replaced by
   rollback
4. prove no schema/history residue
5. apply the byte-identical canonical migration natively
6. run the permanent verifier
7. run authenticated rollback-safe Article fixtures for:
   - submit
   - changes requested
   - approve
   - accepted suggestion
   - stale suggestion
   - lifecycle listing
8. prove typed Article history count/fingerprint unchanged
9. prove new shared lifecycle/review rows and completed receipts
10. prove zero fixture residue after rollback
11. compare security/performance advisors to production
12. regenerate database types and require no semantic schema change
13. record replay proof and live-schema baseline
14. run focused tests, critical suite, application build, replay contract,
    live-schema contract, and exact-scope diff
15. commit/push only preview-proven bytes
16. open protected PR
17. promote only after CI and preview acceptance
18. rerun production verifier
19. compare production/preview advisor and migration parity
20. delete the paid preview only after the production seal

## Current boundary

Production remains untouched at 61/A3.

AR1 is not yet preview-proven.

No Edge Function deployment is required.

No frontend deployment is required.

No Readdy Finish update is required.
