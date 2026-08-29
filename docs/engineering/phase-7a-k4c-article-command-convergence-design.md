# Phase 7A K4C: Article Command Convergence Design

Status: DESIGN LOCK CANDIDATE

Opened: 29 August 2026

Accepted main / production baseline:

- accepted main: `57fa697d9731e196b6fa88adc6f80a0ee3e95176`
- production migrations: `61`
- production head:
  `20260829092902_phase_7a_k4c_a3_audio_pointer_compatibility_retirement`
- K4C-A3 production verifier: PASS
- production pending migrations: `0`
- Playlist pointer compatibility debt: `0`
- Audio pointer compatibility debt: `0`

Predecessor authority:

- Phase 7A K0 Resource Version Foundation
- Phase 7A K1 Resource Lifecycle Position Convergence
- Phase 7A K2 Video Authority Foundation
- Phase 7A K3 Resource Review and Lifecycle Event Convergence Design
- Phase 7A K4A Shared Resource Event Authority
- Phase 7A K4B Video Governed Lifecycle Commands
- Phase 7A K4C Playlist Command Convergence P1/P2/P3
- Phase 7A K4C Audio Command Convergence A1/A2/A3

## Purpose

Article is the third and final legacy K4C domain.

Playlist and Audio proved that mature publication domains can stop writing typed
review/lifecycle history and consume canonical shared Resource event authority
without changing browser contracts.

Article must now converge on the same primitives, but Article is structurally
different from Playlist and Audio.

Article already uses canonical lifecycle position on
`editorial.resources.current_*_version_id`. Its binding table is already reduced
to identity only:

- `resource_id`
- `resource_kind`
- `article_id`

There are no Article typed lifecycle pointer columns to retire.

The remaining Article convergence debt is instead:

1. ten governed functions still write `editorial.article_lifecycle_events`
2. three live readers still depend on that typed lifecycle table
3. no new Article command has yet written canonical shared Resource events after
   the K4A historical backfill
4. Article review decisions have no canonical shared Resource review events yet
5. the legacy Article RPC signatures predate the command-receipt and external
   idempotency contract used by Video, Playlist, and Audio
6. publishing, scheduling, Corrections, review suggestions, and editorial
   derivation all intersect the Article lifecycle surface

K4C Article therefore converges event and command authority without inventing a
second pointer-retirement problem that does not exist.

## Production evidence at design open

### Canonical Article Resource position

Production contains `217` Article Resources.

Current canonical positions:

- working: `217`
- submitted: `2`
- approved: `2`
- published: `208`

`editorial.article_resources` contains only binding identity. All current
working/submitted/approved/published position lives on
`editorial.resources`.

K4C Article must preserve that architecture. It must not add lifecycle pointers
back to the typed Article binding.

### Legacy Article lifecycle history

Production `editorial.article_lifecycle_events` rows: `35`.

Latest typed event:

`2026-08-06T19:42:45.87305+00:00`

Action distribution:

- `submitted`: `16`
- `approved`: `9`
- `changes_requested`: `5`
- `published`: `2`
- `archived`: `2`
- `restored`: `1`

K4A already imported all 35 rows into
`editorial.resource_lifecycle_events`.

Current backfill state:

- typed Article lifecycle rows: `35`
- shared rows with
  `legacy_source_authority = 'article_lifecycle'`: `35`
- unmapped typed rows: `0`
- total shared Article lifecycle rows: `35`
- new non-legacy shared Article lifecycle rows: `0`
- shared Article review rows: `0`

There has therefore been no Article typed-event drift since K4A.

### Direct legacy lifecycle writers

Production has exactly ten direct writers of
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

All ten are `SECURITY DEFINER` functions.

All ten currently preserve legacy RPC result shapes. Nine return Article
lifecycle result rows. Suggestion acceptance returns its established suggestion
decision result.

K4C Article must preserve those browser-visible signatures and return columns.

### Remaining typed lifecycle readers

Three production functions still read
`editorial.article_lifecycle_events`:

1. `public.list_article_lifecycle_events`
2. `editorial.correction_article_publication_proof`
3. `editorial.derive_publishing_editorial_state`

The Article review workspace itself does not read the typed lifecycle table.

`public.get_article_review_workspace(uuid)` already composes Article Resource
position and review thread/comment state without using
`editorial.article_lifecycle_events`.

### Shared event primitives already available

K4C Article must reuse the accepted shared helpers:

`editorial.append_resource_lifecycle_event(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  jsonb,
  uuid,
  uuid,
  uuid
)`

Accepted production MD5:

`d84d503da70733c010a93025bca7cda7`

`editorial.append_resource_review_event(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  uuid,
  uuid
)`

Accepted production MD5:

`54b3f889a5b91bf399bb64b52b830134`

Both helpers:

- are `SECURITY DEFINER`
- use fixed search paths
- have no direct browser execution
- lock the Resource before allocating event number
- require canonical Resource / Resource Version identity
- require command receipt and correlation identity
- are idempotent on accepted command identity
- never write typed compatibility history

K4C Article must not fork these helpers.

## Article command-receipt compatibility problem

The existing Article lifecycle RPCs predate the newer command contract.

They do not expose caller-supplied:

- `p_idempotency_key`
- `p_correlation_id`

There are also currently no enabled `article.*` rows in
`platform_private.command_types`.

This means K4C Article cannot call the shared event append helpers correctly by
simply replacing the legacy INSERT statements.

It must establish canonical command receipt and correlation identity first.

### Compatibility rule

K4C Article must preserve the current public RPC signatures.

It must not add required browser arguments merely to satisfy the newer internal
event primitive.

The migration may create internal Article command-receipt bridge helpers and
register the required `article.*` command types.

For legacy authenticated RPCs, the bridge may generate an invocation-scoped
idempotency key and correlation ID inside the transaction.

That generated identity exists to give the canonical event ledger a durable
command receipt. It does not make the old public API externally idempotent.

K4C must therefore state this truth explicitly:

**legacy Article RPC retry semantics remain unchanged until a separate public
command-contract modernization introduces caller-supplied idempotency keys.**

The bridge must not collapse two separate legacy invocations into one receipt.

### Scheduled execution rule

`public.publish_due_article_publications` is a batch executor and is callable
through the existing service boundary.

It must not be forced through the authenticated-editor command helper.

Each due schedule execution should receive its own canonical command receipt and
correlation identity so one batch cannot become one ambiguous lifecycle receipt
covering multiple Articles.

The service principal must remain explicit and actor identity must remain
nullable where the existing command-receipt schema permits system execution.

## Sequencing decision

Article convergence is split into three bounded slices.

The labels use `AR` to avoid collision with Audio `A1/A2/A3`.

### K4C-AR1: Article review and editorial event convergence

Purpose:

Move the review-side Article lifecycle writers onto canonical shared Resource
event authority while preserving the public Article review product.

AR1 rewrites:

1. `public.submit_article_for_review`
2. `public.request_article_changes`
3. `public.approve_article_version`
4. `public.accept_article_suggestion`

AR1 will:

1. register only the Article command types needed by AR1
2. add the minimal internal legacy Article receipt bridge needed by those
   existing RPC signatures
3. catch up any typed Article lifecycle event written after this design lock but
   before AR1 apply
4. preserve all existing Article Resource pointer writes on canonical
   `editorial.resources`
5. replace new typed lifecycle INSERTs with
   `editorial.append_resource_lifecycle_event`
6. append canonical shared review events for:
   - submit
   - changes requested
   - approval
   - accepted suggestion when it closes the submitted review round
7. preserve Article review threads, comments, suggestions, and suggestion-event
   tables exactly
8. preserve existing permission gates
9. preserve all public RPC signatures and return columns
10. move `public.list_article_lifecycle_events` to canonical shared lifecycle
    history while preserving its existing return contract
11. leave `editorial.article_lifecycle_events` physically present as historical
    compatibility

AR1 must not rewrite publication/scheduling commands yet.

### Review event mapping

Submit:

- lifecycle action: `submitted`
- review action: `submitted`
- target version: new submitted version
- result version: null

Changes requested:

- lifecycle action: `changes_requested`
- review action: `changes_requested`
- target version: exact reviewed/submitted version
- result version: null unless the command actually creates a canonical result
  version

Approve:

- lifecycle action: `approved`
- review action: `approved`
- target version: exact submitted/reviewed source version
- result version: new approved version

Accepted suggestion:

The current command applies a new working snapshot, returns the Article to
draft, records a typed `changes_requested` lifecycle event, resolves the
accepted thread, and marks remaining open suggestions from that review round
stale.

AR1 must preserve that behavior.

Its shared review event should bind:

- target version: the submitted review-round target
- result version: `NULL`; K4A permits non-null review result identity only for
  `approved` events
- action: `changes_requested`
- reason/note: the accepted suggestion decision note or the existing fallback
- applied working-version identity remains in the existing suggestion audit and
  canonical lifecycle metadata
- correlation metadata: suggestion identity remains in canonical lifecycle
  metadata

The Article suggestion tables remain the detailed suggestion audit authority.
The shared review event is the cross-domain review decision timeline, not a
replacement for suggestion evidence.

### K4C-AR2: Article publication and scheduling event convergence

Purpose:

Move Article publication lifecycle writers onto canonical shared Resource event
authority without disturbing public publication snapshots, scheduling proof, or
legacy Article URLs.

AR2 rewrites:

1. `public.publish_article_version`
2. `public.schedule_article_publication`
3. `public.publish_due_article_publications`
4. `public.unpublish_article`
5. `public.archive_article`
6. `public.restore_article_from_archive`

AR2 will:

1. register only the additional Article command types needed by AR2
2. preserve exact public RPC signatures and result rows
3. preserve `wk_articles.wp_status` semantics
4. preserve canonical Resource pointer behavior
5. preserve `editorial.article_scheduled_publications` as schedule authority
6. preserve `editorial.publish_article_snapshot` behavior and public snapshot
   identity
7. append only shared Resource lifecycle events
8. create one command receipt per due scheduled Article publication, not one
   receipt for an entire batch
9. leave the typed Article lifecycle table historical and unwritten by AR2
10. prove no publication/scheduling command still inserts typed Article
    lifecycle history

### Known pre-existing schedule defect

Production `public.schedule_article_publication` currently checks:

`version.kind = 'approved'`

The live `editorial.article_versions` table exposes
`version_kind`, not `kind`.

This is pre-existing Article scheduler debt. K4C did not introduce it.

AR2 must not hide this defect.

Because AR2 necessarily replaces the same scheduling function and cannot prove
the scheduled path while retaining an invalid column reference, AR2 may correct
only this exact reference to `version.version_kind` inside the bounded rewrite.

That correction requires a dedicated focused regression assertion and must not
be used as permission to redesign scheduling behavior.

### K4C-AR3: Article cross-system reader convergence and typed-event retirement

Purpose:

Remove the final live dependence on typed Article lifecycle history after all
governed writers have moved to the shared ledger.

AR3 rewrites:

1. `editorial.correction_article_publication_proof`
2. `editorial.derive_publishing_editorial_state`
3. any other live function discovered by the final dependency scan that still
   reads `editorial.article_lifecycle_events`

AR3 will:

1. source lifecycle proof from `editorial.resource_lifecycle_events`
2. preserve Corrections publication proof result shape and semantics
3. preserve Publishing editorial-state derivation
4. require zero direct writers of typed Article lifecycle history
5. require zero live readers of typed Article lifecycle history
6. require the historical typed table row count and fingerprint to remain
   unchanged under governed commands
7. keep `editorial.article_lifecycle_events` physically present as immutable
   historical compatibility
8. not drop historical rows merely because no live reader depends on them

AR3 closes K4C Article event-authority convergence.

## K4A catch-up rule

Every implementation slice must defend the gap between the accepted production
baseline and candidate apply.

Before the first writer rewrite in a fresh preview, the migration must:

1. identify typed Article lifecycle rows that are not mapped through
   `legacy_source_authority = 'article_lifecycle'`
2. reject missing or cross-Resource Resource Version identity
3. reject legacy UUID collisions with unrelated shared events
4. append missing legacy history deterministically
5. preserve source UUID as canonical shared row identity where the K4A contract
   permits it
6. leave typed source rows unchanged
7. prove continuous per-Resource event numbering after catch-up

At design open the unmapped count is exactly `0`.

## Browser and product contract

K4C Article is an authority migration, not an Article editor redesign.

It must preserve:

- existing Article editor routes
- current review workspace JSON shape
- review thread/comment behavior
- suggestion behavior
- public Article URLs and slugs
- preview-link behavior
- public publication snapshot identity
- Trust/Citation/Credit behavior
- current Article RPC names
- current Article RPC argument names
- current Article RPC return columns
- current WordPress-compatible `wp_status` meanings
- current canonical Resource pointer semantics

No frontend change is required merely because event history moves from a typed
table to the shared Resource ledgers.

## Corrections boundary

Article participates in Corrections.

K4C must not weaken or bypass:

- correction case authority
- challenged-version identity
- application resulting-version identity
- publication proof
- public correction-note continuity
- correction idempotency or command receipts

AR3 may change only the source of lifecycle proof from typed Article history to
canonical shared Resource history.

If that proof cannot be made byte/semantically equivalent in preview, AR3 stops.
Corrections must not be rewritten casually to make the test pass.

## Publishing boundary

Article also participates in Publishing state derivation.

K4C must preserve the meaning of
`editorial.derive_publishing_editorial_state(uuid)`.

The migration may replace typed lifecycle-event reads with shared Resource
lifecycle-event reads, but must not change Publishing workflow state vocabulary
or downstream publication planning semantics.

## Historical typed table rule

`editorial.article_lifecycle_events` remains historical compatibility after
K4C.

The table is not new-write authority after AR2.

It is not a source for live lifecycle decisions after AR3.

K4C does not physically drop it.

A future archival or storage-retirement milestone may reconsider its physical
existence only with separate provenance and rollback proof.

## Permanent verifier contract

Each slice receives its own permanent read-only verifier.

AR1 verifier must prove at minimum:

1. production baseline remains 61/A3 before candidate apply
2. all historical Article lifecycle rows remain mapped
3. AR1 target writers no longer write the typed lifecycle table
4. AR2 publication writers remain unchanged until AR2
5. new submit/changes-requested/approved review actions append shared lifecycle
   and shared review events
6. accepted suggestion preserves suggestion audit and appends canonical shared
   review/lifecycle history
7. `list_article_lifecycle_events` preserves its public return contract from
   shared history
8. Article Resource pointers remain canonical and valid
9. Playlist/Audio K4C ratchets remain intact
10. Video still has no typed event authority

AR2 verifier must prove at minimum:

1. all ten governed Article lifecycle writers have stopped writing typed history
2. publication/schedule/archive/restore/unpublish actions append shared
   lifecycle events
3. scheduled execution creates one receipt/event identity per Article execution
4. schedule rows and publication snapshots remain coherent
5. public publication identity remains stable
6. the exact `version.kind` defect is absent and no broader scheduling rewrite
   slipped in
7. typed Article lifecycle row count/fingerprint remains unchanged under AR2
   governed commands
8. AR1 review-event ratchets remain intact

AR3 verifier must prove at minimum:

1. no live function writes `editorial.article_lifecycle_events`
2. no live function reads `editorial.article_lifecycle_events`
3. all 35 historical rows remain represented in shared lifecycle history
4. Corrections publication proof is sourced from shared history and remains
   equivalent
5. Publishing editorial-state derivation is sourced from shared history and
   remains equivalent
6. shared Article review history exists for new governed review decisions
7. typed Article lifecycle history remains physically present and unchanged
8. Playlist and Audio pointer compatibility debt remains zero
9. shared Resource event helper ACL/security/search-path authority remains
   unchanged

## Preview acceptance

Each implementation slice follows the established WAKILISHA migration workflow.

For AR1, a fresh disposable preview must first replay the complete accepted
61/A3 migration history.

If baseline replay fails, AR1 has not failed.

The exact old migration must be diagnosed and repaired separately before a fresh
preview is created.

Only after a healthy baseline may the candidate Article migration apply.

Preview acceptance must include:

1. exact migration history
2. zero unexpected pending migrations
3. permanent verifier PASS
4. rollback-safe authenticated fixtures
5. service-path fixture where AR2 scheduled execution requires it
6. zero fixture residue
7. focused tests
8. critical control-plane suite
9. application build
10. replay proof
11. live-schema parity
12. advisor comparison
13. exact changed-file scope

Preview-proven migration bytes must remain byte-identical through PR and
production promotion.

## Advisor acceptance

Article is an existing mature production surface.

Advisor comparison must therefore be delta-based.

A slice fails advisor acceptance if it introduces:

- a new Article-relevant security WARN/ERROR
- a new Article-relevant performance WARN/ERROR that is not explained by fresh
  preview usage-history noise
- a broadened RPC execution perimeter
- a new public/internal helper exposure
- a mutable search path on newly privileged code

Pre-existing project-wide advisor debt is not silently folded into K4C.

## Explicit non-goals

K4C Article does not:

- add Article lifecycle pointer columns
- change Resource Version identity
- redesign the Article editor
- redesign review threads or comments
- redesign suggestions
- redesign Corrections
- redesign Publishing
- redesign Article Trust
- change public Article routes
- change Article preview URLs
- change WordPress status vocabulary
- change public Article snapshot schema
- physically drop `editorial.article_lifecycle_events`
- expose new browser-callable internal helpers
- deploy an Edge Function
- require a frontend deploy when RPC contracts remain compatible
- update Readdy
- claim the legacy public Article RPCs have caller-controlled idempotent replay

## K4C Article exit condition

K4C Article closes when:

- all ten governed Article lifecycle writers append canonical shared Resource
  history instead of typed Article lifecycle history
- review-side commands append canonical shared review history
- no live reader depends on typed Article lifecycle history
- all historical typed rows remain represented in shared history
- Corrections publication proof remains correct
- Publishing editorial-state derivation remains correct
- scheduled publication remains correct
- public Article publication identity remains stable
- existing Article RPC/browser contracts remain compatible
- the historical typed lifecycle table remains unchanged by governed commands
- Playlist and Audio convergence ratchets remain clean

## Deployment classification

This design lock is documentation only.

- SQL migration needed: No
- Supabase Edge Function deploy needed: No
- Readdy Finish update needed: No
- frontend deploy needed: No
- production runtime change needed: No

## Exit condition for this design lock

This design closes when merged through protected CI.

The next implementation milestone is:

**Phase 7A K4C-AR1 Article Review and Editorial Event Convergence**

from the accepted 61-migration K4C-A3 production baseline.
