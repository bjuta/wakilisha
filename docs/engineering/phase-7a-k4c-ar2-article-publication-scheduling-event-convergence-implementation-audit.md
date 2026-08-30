# Phase 7A K4C-AR2: Article Publication and Scheduling Event Convergence Implementation Audit

Status: LOCAL CANDIDATE BUILT. PREVIEW NOT YET APPLIED.

Opened: 30 August 2026

Design authority:

`docs/engineering/phase-7a-k4c-article-command-convergence-design.md`

Accepted main / production baseline:

- accepted main:
  `9736260bf66d82933f0ea2a7e5c7a2d0e2b9fa39`
- production migrations: `62`
- production head:
  `20260829114236_phase_7a_k4c_ar1_article_review_editorial_event_convergence`
- AR1 permanent production verifier: PASS
- production pending migrations: `0`
- paid AR1 preview: deleted after production seal

Canonical AR2 migration identity:

`20260830063344_phase_7a_k4c_ar2_article_publication_scheduling_event_convergence`

The migration timestamp was minted with the pinned local Supabase CLI
`2.107.0` from exact accepted main and the sealed 62/AR1 production boundary.

## Purpose

AR2 is the second Article slice of K4C command convergence.

It moves the six remaining Article lifecycle writers from
`editorial.article_lifecycle_events` onto canonical shared Resource lifecycle
history while preserving:

- public Article RPC names, arguments, and result columns
- WordPress-style `wp_status` behavior
- canonical Resource lifecycle pointers
- `editorial.article_scheduled_publications` as schedule authority
- `editorial.publish_article_snapshot` as publication snapshot authority
- public Article publication snapshot identity and route behavior
- AR1 review/suggestion authority
- Corrections and Publishing readers for AR3

AR2 does not drop the typed lifecycle table.

After AR2 that table remains immutable historical compatibility and has no live
writer.

## Canonical opening boundary

The local opening gate proved:

- accepted main:
  `9736260bf66d82933f0ea2a7e5c7a2d0e2b9fa39`
- production project ref:
  `pgzizndxdyhqmtyywjmt`
- production migration count: `62`
- production head: `20260829114236`
- pending migrations: `0`
- Supabase CLI: `2.107.0`
- AR2 branch:
  `agent/phase-7a-k4c-ar2-article-publication-scheduling-event-convergence`
- canonical migration initial SHA-256:
  `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`

No database mutation occurred during opening.

## Six target production writers

AR2 pins and rewrites exactly:

1. `public.publish_article_version`
   - accepted MD5:
     `d3c2a715d0596e4033e7e319c0b3d4f4`
2. `public.schedule_article_publication`
   - accepted MD5:
     `105d47e009ec279e3a7e5a362662a31d`
3. `public.publish_due_article_publications`
   - accepted MD5:
     `09b9ecbbec742481f6146fdaa250b435`
4. `public.unpublish_article`
   - accepted MD5:
     `8f52aca8823b4d23ec995526745176dc`
5. `public.archive_article`
   - accepted MD5:
     `bc19cc8ba0945d118d743eb709b80d2d`
6. `public.restore_article_from_archive`
   - accepted MD5:
     `d4239c78dd5cbb2f7da7823b7cf60873`

At AR2 open:

- typed Article lifecycle writer count: `6`
- all six target functions write
  `editorial.article_lifecycle_events`
- none of the six writes shared Resource lifecycle history

AR2 exit requires typed writer count `0`.

## Historical catch-up

AR2 repeats the K4A/AR1 historical gap defense before retiring the final writers.

Any typed Article lifecycle row written after AR1 promotion but before AR2 apply
must be copied to shared Resource history before writer replacement.

The catch-up:

- preserves source UUID
- preserves Resource identity
- preserves Resource Version identity
- preserves action/status/note/metadata/actor/timestamp
- preserves typed source rows unchanged
- rejects unrelated UUID collisions
- preserves contiguous per-Resource shared lifecycle numbering

The migration snapshots typed-row count and fingerprint before work and requires
them to remain unchanged after work.

## Shared lifecycle primitive

AR2 reuses without modification:

`editorial.append_resource_lifecycle_event(...)`

Accepted MD5:

`d84d503da70733c010a93025bca7cda7`

AR2 does not fork or replace that primitive.

## Publication snapshot authority

AR2 reuses without modification:

`editorial.publish_article_snapshot(
  uuid,
  timestamp with time zone,
  boolean
)`

Accepted MD5:

`790c6a5667abd56406ed6fe8eb174997`

Direct and scheduled publication continue to:

1. create a new immutable published Article Version
2. call the existing publication-snapshot helper
3. update `wk_articles.wp_status`
4. update canonical Resource published position

The helper itself remains byte-pinned.

## AR2 command vocabulary

AR2 introduces exactly six additional command types:

1. `article.publication.publish`
2. `article.publication.schedule`
3. `article.publication.publish_scheduled`
4. `article.publication.unpublish`
5. `article.publication.archive`
6. `article.publication.restore`

No Corrections or Publishing command vocabulary is introduced.

## Authenticated legacy command bridge

AR1 established:

`platform_private.begin_legacy_authenticated_article_command(text,uuid,jsonb)`

AR2 reuses and extends that same internal bridge instead of creating a second
authenticated Article bridge.

The bridge keeps all four AR1 review command types and adds all six AR2
publication command types.

Legacy browser RPC signatures still do not accept caller-controlled
idempotency/correlation identity.

Each legacy invocation therefore receives a fresh internal command identity.

AR2 does not claim external retry idempotency for these legacy RPCs.

## Scheduled service command bridge

`public.publish_due_article_publications(integer)` can execute through the
existing service-role boundary and through an authenticated publisher.

AR2 creates one internal-only helper for the service path:

`platform_private.begin_legacy_service_article_command(
  text,
  uuid,
  uuid,
  jsonb
)`

For service execution it:

- requires `service_role`
- permits only `article.publication.publish_scheduled`
- uses principal `service:service_role`
- stores `actor_user_id = NULL`
- allocates one correlation UUID per scheduled publication
- derives a deterministic schedule-scoped idempotency key from schedule UUID
- fingerprints the request through the existing command fingerprint primitive
- creates one accepted command receipt per schedule
- creates one accepted outbox event per schedule
- rejects an unexpected duplicate existing schedule receipt
- remains inaccessible directly to `PUBLIC`, `anon`, `authenticated`, and
  `service_role`

The public batch function calls the helper internally under its existing
`SECURITY DEFINER` authority.

When the batch is invoked by an authenticated publisher instead of service role,
the accepted authenticated Article bridge is used and actor identity remains the
calling editor.

This satisfies the design rule that a whole due-publication batch must never
share one ambiguous receipt.

## Direct publication convergence

`public.publish_article_version` preserves:

- authentication
- publication permission gate
- approved-version equality check
- approved Article Version kind check
- immutable published-version copy
- `editorial.publish_article_snapshot`
- `wk_articles.wp_status = 'publish'`
- canonical current published Resource pointer
- public return shape

It replaces the typed lifecycle INSERT with shared lifecycle `published`
history and completes one command receipt.

Shared event metadata records:

- Article id
- approved source version id
- direct publication mode
- requested publication timestamp

## Scheduling convergence

`public.schedule_article_publication` preserves:

- authentication
- publication permission gate
- future-time validation
- exact approved-version equality
- scheduled immutable Article Version creation
- `editorial.article_scheduled_publications`
- `wk_articles.wp_status = 'future'`
- canonical Resource privacy/lifecycle position
- public return shape

It now captures the created schedule UUID internally and writes that identity to
shared lifecycle metadata and command result payload.

It replaces the typed `scheduled` lifecycle INSERT with shared lifecycle
history.

## Bounded scheduler defect repair

The production function currently checks:

`version.kind = 'approved'`

The live Article Version table exposes:

`version.version_kind`

AR2 changes only that exact expression to:

`version.version_kind = 'approved'`

The permanent verifier and focused test require:

- corrected expression present
- invalid expression absent
- all surrounding schedule authority preserved

This repair was explicitly authorized by the AR2 design and is not permission
for broader scheduler redesign.

## Due scheduled publication convergence

`public.publish_due_article_publications(integer)` preserves:

- service-role or publisher permission gate
- bounded batch limit
- `status = 'scheduled'`
- `run_after <= now()`
- ordering by earliest schedule
- `FOR UPDATE SKIP LOCKED`
- missing Article/Resource failure handling
- immutable published-version copy
- publication snapshot helper
- `wk_articles.wp_status = 'publish'`
- canonical Resource published pointer
- schedule status transition to `published`
- public return columns

For every successfully processed schedule AR2 now creates:

- one command receipt
- one correlation identity
- one shared `published` lifecycle event
- one succeeded command receipt result

Shared metadata preserves:

- scheduled publication id
- scheduled time
- scheduled source version id
- scheduled publication mode

## Unpublish convergence

`public.unpublish_article` preserves:

- publication permission
- active publication snapshot deactivation
- Article return to draft
- draft-version increment
- Resource return to private draft state
- legacy target-version fallback
- public return columns

It replaces typed `unpublished` history with shared lifecycle authority.

## Archive convergence

`public.archive_article` preserves:

- publication permission
- Article `wp_status = 'trash'`
- draft-version increment
- active snapshot deactivation
- Resource archived/private state
- legacy target-version fallback
- public return columns

It replaces typed `archived` history with shared lifecycle authority.

## Restore convergence

`public.restore_article_from_archive` preserves:

- authentication
- Resource-scoped edit permission
- Article return to draft
- draft-version increment
- Resource draft/private state
- legacy target-version fallback
- public return columns

It replaces typed `restored` history with shared lifecycle authority.

## RPC privilege preservation

All six public target RPCs are existing authenticated/service APIs.

AR2 explicitly restores the accepted perimeter after replacement because
Supabase preview provisioning/default function privileges can otherwise widen
`EXECUTE`.

For all six target RPCs:

- `PUBLIC`: revoked
- `anon`: revoked
- `authenticated`: granted
- `service_role`: granted

The internal service bridge has no browser/service direct execution grant.

This matches the current Supabase guidance that function execution should be
explicitly revoked from roles that do not need it and that privileged functions
must have a controlled search path.

## AR1 ratchet

AR2 must not rewrite the AR1 public review/list functions.

Permanent verifier MD5 pins:

- submit:
  `539bf98f189212294b8e1ce65d97e00e`
- request changes:
  `0421228df4bf205da2f663cc14c41e80`
- approve:
  `707058aadc9c53746bfcaaa62d893f7f`
- accepted suggestion:
  `d92af169eeb9e48e65e4c749cf9e6403`
- lifecycle list:
  `f5c977c58e87556e18f0fd07573dabe3`

AR2 extends only the internal authenticated bridge vocabulary.

## Deferred AR3 reader authority

After AR2, exactly two live typed-history readers must remain:

1. `editorial.correction_article_publication_proof(uuid)`
   - accepted MD5:
     `3bdd9467a857da7a8f6373a50e237295`
2. `editorial.derive_publishing_editorial_state(uuid)`
   - accepted MD5:
     `f89b6060e68ae2e1154f689a741dc831`

AR2 does not modify either function.

AR3 owns that convergence.

## Candidate files

AR2 currently contains:

1. `supabase/migrations/20260830063344_phase_7a_k4c_ar2_article_publication_scheduling_event_convergence.sql`
2. `scripts/control-plane/verify-phase-7a-k4c-ar2-article-publication-scheduling-event-convergence.sql`
3. `test/control-plane/phase-7a-k4c-ar2-article-publication-scheduling-event-convergence.test.ts`
4. this implementation audit

## Permanent verifier contract

The AR2 permanent verifier proves:

- every typed Article lifecycle row remains mapped to shared history
- typed Article lifecycle writer count is exactly `0`
- all six publication functions append shared lifecycle events
- all six publication functions complete command receipts
- direct publication keeps snapshot + published pointer authority
- scheduling keeps schedule table authority
- scheduler uses `version.version_kind`, never `version.kind`
- due publication retains `FOR UPDATE SKIP LOCKED`
- due publication has service and authenticated per-schedule command identity
- exactly six AR2 command types are enabled
- internal service bridge remains internal
- public publication RPCs remain unavailable to anon
- public publication RPCs remain available to authenticated
- shared lifecycle helper remains byte-pinned
- publication snapshot helper remains byte-pinned
- AR1 review/list functions remain byte-pinned
- exactly two AR3 typed-history readers remain
- both AR3 readers remain byte-pinned
- lifecycle event numbering remains contiguous
- Playlist/Audio pointer-retirement ratchets remain closed
- Video typed-event authority remains absent

Acceptance marker:

`PHASE_7A_K4C_AR2_ARTICLE_PUBLICATION_SCHEDULING_EVENT_CONVERGENCE_PASS`

## Preview acceptance plan

Before production mutation AR2 requires a fresh disposable preview from the
sealed 62/AR1 production boundary.

Acceptance must include:

1. exact 62/AR1 baseline replay
2. AR1 permanent production authority still represented at baseline
3. candidate migration transactional dry-run
4. canonical native migration push with exact
   `20260830063344` identity
5. AR2 permanent verifier PASS
6. authenticated rollback-safe fixtures for:
   - direct publish
   - unpublish
   - archive
   - restore
   - schedule
7. service-path rollback-safe fixture for due scheduled publication
8. proof that schedule UUID remains schedule authority
9. proof that public publication snapshot identity remains coherent
10. proof that no new typed Article lifecycle row is written
11. proof that each successful scheduled publication gets one receipt
12. zero fixture residue
13. security/performance advisor delta
14. generated database-type parity
15. replay proof and live-schema seal
16. focused AR2 tests
17. critical control-plane suite
18. application build
19. exact changed-file scope
20. protected PR and CI
21. separate production SQL promotion
22. independent production verifier/parity seal
23. disposable preview deletion only after production seal

## Current boundary

Production remains untouched at exact 62/AR1.

AR2 is not yet preview-proven.

No Edge Function deployment is required.

No frontend deployment is required.

No Readdy update is required.
