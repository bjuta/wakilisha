# Phase 3B Migration 4 Public Note and Contributor Follow-up Contract Lock

## Status

Accepted implementation contract for Phase 3B Migration 4.

Amended before SQL implementation to preserve the existing Article lifecycle contract: Migration 3 creates an immutable `correction` working version, while normal Article review and publication create later immutable `submitted`, `approved`, and `published` lifecycle versions.

This document resolves the remaining public-note, no-note, contributor follow-up, public-read, and correction-required closure boundaries before SQL implementation.

No Migration 4 SQL may be written until this contract is merged.

## Accepted baseline

Migration 4 starts after:

- Migration 1 correction identity foundation
- Migration 2 evidence, decisions, related-resource review, and non-correction closure authority
- Migration 3 Article correction application authority
- 186 synchronized production migrations
- zero production correction cases, applications, receipts, events, or correction outbox rows
- preserved Migration 3 validation volume

Migration 4 does not change the Article application adapter.

## Migration 4 scope

Migration 4 adds only:

1. immutable public correction notes
2. public-note publication authority
3. governed no-note disposition
4. contributor follow-up request authority
5. public Article correction-note reads
6. correction-required closure authority
7. internal workspace public-note and contributor-follow-up history
8. a pure SQL structural and transactional verifier

Migration 4 does not add:

- Registry correction adapters
- Playlist, chart, audio, video, transcript, or Inquiry correction adapters
- automatic Article publication
- a second notification queue
- a notification delivery worker
- frontend authority
- Supabase Edge Function code
- production correction fixtures

## Lock 1: Public correction note identity

Create:

`editorial.correction_public_notes`

The table is append-only and public-safe.

Required columns:

- `id uuid primary key default gen_random_uuid()`
- `case_resource_id uuid not null`
- `application_id uuid not null`
- `affected_resource_id uuid not null`
- `affected_resource_kind text not null`
- `challenged_version_id uuid not null`
- `corrected_version_id uuid not null`
- `note_text text not null`
- `note_fingerprint text not null`
- `supersedes_note_id uuid`
- `published_by uuid`
- `published_at timestamptz not null default now()`

Required foreign keys:

- case to `editorial.correction_cases(resource_id)` with `on delete restrict`
- application to `editorial.correction_applications(id)` with `on delete restrict`
- affected resource to `editorial.resources(id, resource_kind)` with `on delete restrict`
- challenged and corrected versions to `editorial.article_versions(id)` with `on delete restrict`
- superseded note to `editorial.correction_public_notes(id)` with `on delete restrict`

The first slice supports only `affected_resource_kind = 'article'`.

The note must be non-blank, public-safe, and no longer than 8,000 characters.

The deterministic note fingerprint is SHA-256 over the canonical public-note identity and text.

The table must enforce uniqueness for:

`(case_resource_id, affected_resource_id, corrected_version_id, note_fingerprint)`

The successful application must belong to the same case and affected resource.

The challenged version must equal the application challenged version.

The application resulting version remains the immutable `correction` version created by Migration 3.

The corrected version is the later immutable `published` lifecycle version created by the normal Article review and publication authority.

The corrected version must:

- belong to the same Article resource and Article as the application result
- have the same canonical content fingerprint as the application result
- be the resource current published version
- be the active Article publication snapshot version
- have a governed `published` lifecycle event

This distinction preserves normal Article publication authority. Migration 4 must never move the published pointer directly to the application result.

Publisher identity is a historical UUID snapshot and may become null through account deletion only if the accepted user foreign-key pattern requires it.

Update and delete are blocked.

## Lock 2: Note supersession and withdrawal

A note change creates a new immutable row with `supersedes_note_id`.

The superseded note must belong to the same:

- correction case
- application
- affected resource
- challenged version
- corrected version

The latest public note is a note for which no later note names it as `supersedes_note_id`.

No mutable `superseded_by` pointer is added.

Migration 4 adds no independent withdrawal state or delete command.

A materially incorrect public note requires governed case reopening and a superseding public-safe note. Historical notes remain available internally.

## Lock 3: Public-note disposition

The existing case columns become controlled authority:

- `public_note_disposition`
- `public_note_no_note_reason`

Allowed `public_note_disposition` values:

- `published`
- `not_required`

Rules:

- `published` requires at least one current unsuperseded public note for the current application
- `published` requires `public_note_no_note_reason` to be null
- `not_required` requires a non-blank reason no longer than 2,000 characters
- `not_required` requires no public note for the current application
- non-correction outcomes leave both fields null
- reopening clears neither historical notes nor prior events, but the next governed correction-required closure must re-evaluate the current application and note disposition

The note publication command sets the disposition to `published`.

No separate no-note RPC is added.

For the no-note path, `public.close_correction_case` records `not_required` and the required reason atomically with closure.

## Lock 4: Public-note publication command

Create command type:

`correction.note.publish`

Create RPC:

`public.publish_correction_note`

Required authority:

- `publish_correction_notes`
- administrator or `publish_articles`

Required inputs:

- correction case resource ID
- expected case revision
- expected current application ID
- expected current published Article version ID
- public note text
- optional superseded note ID
- contributor follow-up disposition
- contributor follow-up reason where required
- idempotency key
- correlation ID

Required gates:

1. authenticated actor or service role
2. exact correction and Article publication capabilities
3. safe idempotent replay
4. conflicting idempotency reuse rejection
5. exact expected case revision
6. case state is `applied`
7. current application belongs to the case
8. current decision outcome is `correction_required`
9. application target is the affected Article resource
10. application challenged version matches the note
11. note corrected version belongs to the application Article resource
12. note corrected version has the same canonical content fingerprint as the application resulting version
13. note corrected version is an immutable `published` lifecycle version
14. note corrected version is the current published version and active publication snapshot
15. a governed Article `published` lifecycle event identifies the corrected version
16. note text is non-blank, bounded, and contains no private payload fields
17. superseded note identity is exact where supplied
18. contributor follow-up contract is satisfied for a community-contribution origin

Successful publication:

- creates one immutable note
- sets `public_note_disposition = 'published'`
- clears `public_note_no_note_reason`
- increments case revision exactly once
- appends `public_note_superseded` first where applicable
- appends `public_note_published`
- creates accepted and succeeded command outbox events
- creates contributor follow-up authority where required
- returns the durable receipt, note, case revision, and contributor follow-up result

Publishing a note does not close the case.

## Lock 5: Corrected publication proof

Migration 4 does not publish the corrected Article.

The accepted proof distinguishes the Migration 3 application version from the later published lifecycle version:

- the case current application is valid
- the application resulting version belongs to the affected Article resource
- the application resulting version retains `version_kind = 'correction'`
- the Article resource current published version belongs to the same Article resource and Article
- the current published version retains `version_kind = 'published'`
- the current published version has the same canonical content fingerprint as the application resulting version
- the active Article publication snapshot identifies the current published version
- a governed Article lifecycle event records `published` for the current published version
- the public Article row has the same canonical content fingerprint as the current published version
- the application challenged version remains identifiable

The normal Article authority may create submitted, approved, and published lifecycle copies after application. Migration 4 accepts that chain only when the final published version preserves the application-result fingerprint.

A note or correction-required closure fails stale when the current published version no longer proves this exact application lineage.

## Lock 6: Contributor follow-up state

Add controlled case fields:

- `contributor_follow_up_disposition text`
- `contributor_follow_up_reason text`
- `contributor_follow_up_job_id uuid`
- `contributor_follow_up_requested_at timestamptz`

Allowed dispositions:

- `requested`
- `unavailable`
- `unsafe`

Rules for a `community_contribution` origin:

- one disposition is required before correction-required closure
- `requested` requires a durable contributor follow-up job, job ID, and request time
- `requested` requires the reason to be null
- `unavailable` requires a non-blank reason and no job ID
- `unsafe` requires a non-blank reason and no job ID
- exception reasons are bounded to 2,000 characters

Rules for an `internal_editorial` origin:

- contributor follow-up fields remain null
- no contributor follow-up job is created
- contributor follow-up is not a closure gate

The contributor user ID comes only from the immutable case origin snapshot.

No contributor identity enters the public correction note or anonymous public read.

## Lock 7: Contributor follow-up command and job

Register internal command type:

`correction.contributor_notification.request`

Its job type is:

`correction.contributor_notification`

Its accepted event type is:

`correction.contributor_notification.requested`

Its terminal command events follow the normal command registry pattern.

No public RPC is created for this internal child command.

A private helper invoked by note publication or correction-required closure creates:

- one durable child command receipt
- one queued `platform_private.jobs` row
- one accepted `platform_private.outbox_events` row
- one correction event of type `contributor_notification_requested`

The child idempotency identity is deterministic from:

- case resource ID
- originating contribution ID
- current application or current decision ID
- public note ID where available
- parent command receipt ID

The job payload contains only:

- case resource ID
- originating contribution ID
- contributor user ID
- public-safe outcome
- public correction-note ID where available
- notification reason
- correlation ID

The payload excludes:

- private investigation text
- restricted Source detail
- unsafe quotations
- private moderation history
- private event metadata

Migration 4 proves durable request and scheduling only.

Actual delivery and community-notification projection remain later work.

A later dead-letter outcome does not erase the durable request or automatically reopen the case.

## Lock 8: Correction-required closure

Replace the current correction-required closure rejection with governed closure authority in:

`public.close_correction_case`

Non-correction closure behavior remains compatible with Migration 2.

For `correction_required`, closure requires:

1. expected case revision matches
2. case state is `applied`
3. current decision belongs to the case and remains `correction_required`
4. current application belongs to the case and current decision
5. the current published Article version is an immutable `published` lifecycle copy with the same canonical content fingerprint as the application resulting `correction` version
6. the active publication snapshot and governed `published` lifecycle event identify that current published version
7. public note disposition is `published` with a current unsuperseded note, or the close command records `not_required` with a reason
8. every related-resource review is resolved
9. a community-contribution origin has contributor follow-up disposition `requested`, `unavailable`, or `unsafe`
10. `requested` has a durable queued or later-state job
11. `unavailable` or `unsafe` has a recorded reason
12. internal-origin cases have no contributor follow-up fields
13. closure reason is non-blank
14. one case revision increment occurs
15. one ordered `case_closed` event is appended
16. command receipt and accepted and succeeded outbox events complete atomically

The no-note disposition and contributor follow-up exception or request may be established atomically by the close command.

Closure does not wait for contributor message delivery.

## Lock 9: Public Article correction read

Create:

`public.public_get_article_correction_notes(p_slug text)`

The function is security definer with a fixed narrow return type.

Grant execute to:

- `anon`
- `authenticated`
- `service_role`

Do not grant direct access to correction tables.

Return only:

- Article ID
- Article resource ID
- public case reference, not the case UUID
- correction note ID
- challenged version ID
- corrected version ID
- note text
- note publication time

A row is public only when:

- the Article exists for the supplied slug
- the affected resource is bound to the Article
- the note is immutable and published
- the note is the latest unsuperseded note
- the note case, application, and version identities are valid
- the note corrected version is the current active published version
- the note corrected version has the same canonical content fingerprint as the application resulting `correction` version
- the active publication snapshot and governed `published` lifecycle event identify the note corrected version

The function must not expose:

- contributor identity
- internal case summary
- private analysis
- evidence links
- Source URLs
- Citation quotations
- actor account details
- command receipts
- related-resource reviews
- private event history

## Lock 10: Internal workspace and events

`public.get_correction_case_workspace` adds:

- complete immutable public-note history
- current public-note disposition
- no-note reason
- contributor follow-up disposition
- contributor follow-up reason
- contributor follow-up job identity and status where authorized

`public.list_correction_case_events` continues ordered event reads.

Private event metadata remains capability-allowlisted.

Required event types already present and reused:

- `public_note_published`
- `public_note_superseded`
- `contributor_notification_requested`
- `case_closed`

No mutable history is introduced.

## Lock 11: Grants and RLS

`editorial.correction_public_notes`:

- has RLS enabled
- grants no direct access to `public`, `anon`, or `authenticated`
- grants required canonical access to `service_role`
- blocks update and delete

All state changes occur through security-definer RPCs.

The public Article correction read is the only anonymous note surface.

The internal contributor child command helper is executable only by trusted definer functions and `service_role`.

## Lock 12: Migration 4 verifier

The pure SQL verifier runs in one transaction and rolls back.

It must prove:

1. all required tables, fields, constraints, functions, grants, RLS, and triggers exist
2. exactly 17 correction command types exist
3. `correction.note.publish` is registered exactly
4. `correction.contributor_notification.request` is registered exactly
5. browser roles cannot mutate canonical correction tables
6. public read exposes only the fixed allowlist
7. stale note publication creates a durable rejected receipt and no note
8. conflicting idempotency reuse fails
9. valid note publication creates one immutable note
10. published note increments case revision exactly once
11. note supersession creates ordered same-command events
12. public read returns only the latest unsuperseded note
13. community-origin note publication creates one child receipt, job, outbox event, and correction event
14. internal-origin note publication creates no contributor job
15. no-note correction-required closure records disposition and reason atomically
16. correction-required closure fails before the final published lifecycle version proves the application-result fingerprint lineage
17. correction-required closure fails with pending related-resource reviews
18. correction-required closure fails without contributor follow-up proof where required
19. valid correction-required closure succeeds once
20. all verifier fixtures roll back to the exact baseline

The verifier creates no production fixtures.

## Implementation sequence

1. merge this contract lock
2. create a new isolated Migration 4 implementation branch from updated `main`
3. clone the preserved Migration 3 validation volume
4. implement Migration 4 SQL and verifier
5. validate transactional behavior and complete rollback
6. commit exactly the migration and verifier
7. open and pass the implementation PR
8. merge, deploy, verify production read-only, and reconcile generated live types

## Deployment boundary

SQL migration needed after the contract lock: Yes.

Supabase Edge Function deployment: No.

Frontend deployment: No.

Readdy Finish update: No.

Production changes from this contract lock: No.
