# Phase 3B Correction Schema and Command Design

Date: 3 August 2026

## Status

Schema contract proposed for implementation.

This document translates the accepted Phase 3B authority boundary and lifecycle design into an implementable PostgreSQL and Supabase contract.

No migration may be written until this schema contract is reviewed, merged, and accepted.

Production has not changed.

## Locked inputs

This design is constrained by:

- the Phase 3B correction authority boundary
- successful live verification of reused authorities
- the Phase 3B correction lifecycle and capability design
- Phase 1A stable resource identity
- Phase 1B command receipts, durable jobs, and transactional outbox
- Phase 2A immutable Article versions
- Phase 2B Article review and publication authority
- Phase 3A Sources, Citations, Credits, and public-safe trust reads

The design must extend those authorities without replacing or duplicating them.

## Design principles

The correction system must provide:

- one stable institutional identity per correction case
- immutable origin snapshots
- typed resource and version targets
- shared Source and Citation evidence links
- explicit investigation ownership
- append-only decisions
- append-only correction events
- optimistic concurrency
- durable command receipts
- exact application-result identity
- immutable public correction notes
- related-resource review records
- contributor-notification follow-up through the existing job and outbox platform
- narrow internal and public read models

The design must preserve:

- canonical Article resource identity
- immutable Article versions
- Article review and publication authority
- Registry canonical-write authority
- Phase 3A Source and Citation authority
- private orchestration tables
- domain-specific operational histories
- public-safe separation

## Schema location

Canonical correction tables belong in the `editorial` schema.

Reasons:

- corrections are institutional editorial authority
- direct anonymous table access is not required
- authenticated users must not directly mutate canonical correction rows
- correction evidence and investigation material can be restricted
- public presentation must use a narrow allowlisted function
- correction cases must integrate with `editorial.resources`

Public read functions belong in the `public` schema.

Durable receipts, jobs, and outbox events remain in `platform_private`.

## Stable correction resource identity

Add the controlled resource kind:

`correction_case`

to:

`editorial.resource_kinds`

Each correction case is also a stable platform resource.

The correction case resource allows:

- command receipts to reference the case through `platform_private.command_receipts.resource_id`
- jobs and outbox events to use the case as their aggregate
- stable internal links
- future cross-resource relationships
- one canonical UUID for the case

A correction case does not receive a public route by default.

## Capability additions

Add these capability definitions:

- `view_corrections`
- `triage_corrections`
- `investigate_corrections`
- `decide_corrections`
- `apply_corrections`
- `publish_correction_notes`

Initial role assignments follow the accepted lifecycle design.

### administrator

All six correction capabilities.

### editor

All six correction capabilities.

Existing Article capabilities remain separately required.

### reviewer

- `view_corrections`
- `triage_corrections`
- `investigate_corrections`
- `decide_corrections`

### registry_editor

- `view_corrections`

Additional Registry correction permissions are deferred until the Registry adapter design.

### author, writer, viewer

No internal correction capability by default.

## Controlled vocabularies

Future-extensible classification values use reference tables.

Fixed lifecycle values use table constraints because changing them changes the accepted state machine.

### Correction kinds

Table:

`editorial.correction_kinds`

Columns:

- `correction_kind text primary key`
- `label text not null`
- `description text not null`
- `enabled boolean not null default true`
- `sort_order integer not null default 100`
- `created_at timestamptz not null default now()`

Initial values:

- `factual_error`
- `attribution_error`
- `missing_credit`
- `classification_error`
- `outdated_information`
- `transcription_error`
- `broken_reference`
- `rights_or_consent`
- `other`

### Evidence roles

Table:

`editorial.correction_evidence_roles`

Columns:

- `evidence_role text primary key`
- `label text not null`
- `description text not null`
- `enabled boolean not null default true`
- `sort_order integer not null default 100`
- `created_at timestamptz not null default now()`

Initial values:

- `supports_correction`
- `challenges_correction`
- `context`
- `identity`
- `rights_or_consent`
- `methodology`
- `other`

### Event types

Table:

`editorial.correction_event_types`

Columns:

- `event_type text primary key`
- `label text not null`
- `description text not null`
- `public_eligible boolean not null default false`
- `enabled boolean not null default true`
- `sort_order integer not null default 100`
- `created_at timestamptz not null default now()`

Initial event types:

- `case_created`
- `case_triaged`
- `target_attached`
- `target_replaced`
- `investigator_assigned`
- `investigator_reassigned`
- `evidence_linked`
- `evidence_unlinked`
- `investigation_updated`
- `submitted_for_decision`
- `returned_to_investigation`
- `decision_recorded`
- `decision_superseded`
- `application_accepted`
- `application_rejected_stale`
- `application_failed`
- `application_succeeded`
- `public_note_published`
- `public_note_superseded`
- `related_resource_added`
- `related_resource_dispositioned`
- `contributor_notification_requested`
- `case_closed`
- `case_reopened`

## Correction cases

### Table

`editorial.correction_cases`

### Identity

`resource_id` is both:

- the primary key of the correction case
- a foreign key to `editorial.resources(id, resource_kind)`

Required constant:

`resource_kind = 'correction_case'`

No separate case UUID is introduced.

### Human reference

Use:

- `case_number bigint generated always as identity`
- unique `case_number`

Internal and UI reads format it as:

`COR-` plus a zero-padded case number.

The formatted reference is presentation. The UUID resource identity remains canonical.

### Columns

- `resource_id uuid primary key`
- `resource_kind text not null default 'correction_case'`
- `case_number bigint generated always as identity`
- `origin_type text not null`
- `origin_contribution_id uuid`
- `origin_submitter_user_id uuid`
- `origin_submitted_at timestamptz`
- `origin_type_snapshot text`
- `origin_summary_snapshot text not null`
- `correction_kind text not null`
- `priority text not null default 'normal'`
- `case_state text not null default 'submitted'`
- `current_revision bigint not null default 1`
- `assigned_investigator_id uuid`
- `assignment_reason text`
- `assigned_at timestamptz`
- `triage_reason text`
- `triaged_by uuid`
- `triaged_at timestamptz`
- `investigation_summary text`
- `investigator_recommendation text`
- `evidence_ready boolean not null default false`
- `submitted_for_decision_by uuid`
- `submitted_for_decision_at timestamptz`
- `current_decision_id uuid`
- `current_application_id uuid`
- `public_note_disposition text`
- `public_note_no_note_reason text`
- `closed_reason text`
- `closed_by uuid`
- `closed_at timestamptz`
- `created_by uuid`
- `updated_by uuid`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### Foreign keys

- `(resource_id, resource_kind)` references `editorial.resources(id, resource_kind)` with `on delete restrict`
- `correction_kind` references `editorial.correction_kinds(correction_kind)`
- `origin_contribution_id` references `public.community_contributions(id)` with `on delete restrict`
- `assigned_investigator_id` references `auth.users(id)` with `on delete set null`
- `created_by` and `updated_by` reference `auth.users(id)` with `on delete set null`
- current decision and application pointers are added after their tables exist

Historical actor fields may remain UUID snapshots without foreign keys where preserving identity is more important than account deletion behaviour.

### Origin constraints

Supported initial origins:

- `community_contribution`
- `internal_editorial`

For `community_contribution`:

- `origin_contribution_id` is required
- `origin_submitter_user_id` is required
- `origin_submitted_at` is required
- origin type and summary snapshots are required

For `internal_editorial`:

- `origin_contribution_id` is null
- `created_by` is required
- origin summary snapshot is required

Use a unique partial index on `origin_contribution_id` where not null.

This prevents duplicate controlling cases for the same contribution.

### Priority constraint

Supported values:

- `low`
- `normal`
- `high`
- `urgent`

### State constraint

Supported values:

- `submitted`
- `triaged`
- `investigating`
- `awaiting_decision`
- `decided`
- `applied`
- `closed`

### Revision constraint

- `current_revision >= 1`

Every successful governed case mutation increments the revision exactly once.

No-op and rejected commands do not increment it.

### State metadata integrity

A deferred constraint trigger verifies:

- `triaged`, `investigating`, `awaiting_decision`, `decided`, `applied`, and `closed` cases have triage metadata
- `investigating`, `awaiting_decision`, `decided`, and `applied` cases have an assigned investigator
- `awaiting_decision` requires investigation summary, recommendation, evidence-ready confirmation, submitting actor, and submission time
- `decided`, `applied`, and correction-required `closed` cases have a valid current decision
- `applied` and correction-required `closed` cases have a valid current application
- `closed` requires close reason, actor, and time
- non-closed cases do not carry partial closure metadata
- current decision and application pointers belong to the same case
- current revision matches the latest successful case event revision

The trigger validates integrity. Trusted commands remain responsible for legal transitions.

## Correction targets

### Table

`editorial.correction_targets`

### Purpose

Bind a correction case to the exact resource and version being challenged.

### Columns

- `id uuid primary key default gen_random_uuid()`
- `case_resource_id uuid not null`
- `target_resource_id uuid not null`
- `target_resource_kind text not null`
- `target_version_type text not null`
- `target_version_id uuid not null`
- `target_role text not null default 'primary'`
- `target_summary text`
- `observed_resource_revision bigint`
- `observed_content_fingerprint text`
- `created_by uuid`
- `created_at timestamptz not null default now()`

### Foreign keys

- `case_resource_id` references `editorial.correction_cases(resource_id)` with `on delete restrict`
- `(target_resource_id, target_resource_kind)` references `editorial.resources(id, resource_kind)` with `on delete restrict`
- `created_by` references `auth.users(id)` with `on delete set null`

### First-slice target contract

The first migration supports:

- `target_resource_kind = 'article'`
- `target_version_type = 'article_version'`
- `target_version_id` references `editorial.article_versions(id)`

A constraint trigger verifies:

- the Article version exists
- the Article version belongs to `target_resource_id`
- a valid `editorial.article_resources` binding exists
- the challenged version is immutable
- the primary target identifies the exact published version observed during triage

### Target roles

Initial values:

- `primary`
- `secondary`

Use a unique partial index to enforce at most one primary target per case.

The first Article application adapter requires exactly one primary Article target.

### Duplicate constraint

Reject duplicate identity within one case across:

- case resource
- target resource
- target version type
- target version ID
- target role

## Correction evidence links

### Table

`editorial.correction_evidence_links`

### Purpose

Link one correction case to reviewed Phase 3A evidence without copying Source or Citation content.

### Columns

- `id uuid primary key default gen_random_uuid()`
- `case_resource_id uuid not null`
- `source_id uuid not null`
- `source_version_id uuid not null`
- `citation_id uuid`
- `evidence_role text not null`
- `internal_note text`
- `created_by uuid`
- `created_at timestamptz not null default now()`

### Foreign keys

- `case_resource_id` references `editorial.correction_cases(resource_id)` with `on delete restrict`
- `source_id` references `editorial.sources(id)` with `on delete restrict`
- `source_version_id` references `editorial.source_versions(id)` with `on delete restrict`
- `citation_id` references `editorial.citations(id)` with `on delete restrict`
- `evidence_role` references `editorial.correction_evidence_roles(evidence_role)`
- `created_by` references `auth.users(id)` with `on delete set null`

### Integrity

A constraint trigger verifies:

- Source version belongs to Source
- Source version is the Source's approved version at link time
- Source is not archived
- when Citation is present, Citation belongs to the same Source and Source version
- Citation is active
- internal note length is bounded
- duplicate evidence identity is rejected

Evidence may use restricted or confidential approved Sources.

Access to restricted Source details remains governed by Phase 3A trust permissions.

### Mutation boundary

Links are created and removed through governed commands.

A removal deletes the current link but appends an `evidence_unlinked` correction event preserving the historical identity and reason.

Direct authenticated insert, update, and delete are denied.

## Correction decisions

### Table

`editorial.correction_decisions`

### Purpose

Append-only institutional correction decisions.

### Columns

- `id uuid primary key default gen_random_uuid()`
- `case_resource_id uuid not null`
- `decision_number bigint not null`
- `outcome text not null`
- `reason text not null`
- `private_analysis text`
- `public_safe_explanation text`
- `case_revision_observed bigint not null`
- `target_state_observed jsonb not null default '{}'::jsonb`
- `duplicate_of_case_resource_id uuid`
- `supersedes_decision_id uuid`
- `decided_by uuid`
- `correlation_id uuid`
- `created_at timestamptz not null default now()`

### Foreign keys

- `case_resource_id` references `editorial.correction_cases(resource_id)` with `on delete restrict`
- `duplicate_of_case_resource_id` references `editorial.correction_cases(resource_id)` with `on delete restrict`
- `supersedes_decision_id` references `editorial.correction_decisions(id)` with `on delete restrict`

Decision actor identity is a historical UUID snapshot.

### Outcomes

Supported values:

- `correction_required`
- `no_change_required`
- `insufficient_evidence`
- `duplicate`
- `out_of_scope`

### Constraints

- `decision_number >= 1`
- unique `(case_resource_id, decision_number)`
- non-blank reason
- `case_revision_observed >= 1`
- target state is a JSON object with a bounded size
- `duplicate` requires `duplicate_of_case_resource_id`
- non-duplicate outcomes require it to be null
- a decision cannot duplicate its own case
- a superseded decision belongs to the same case
- decision update and delete are blocked

### Current-decision pointer

`editorial.correction_cases.current_decision_id` references `editorial.correction_decisions(id)` with `on delete restrict` and is deferrable.

A deferred trigger verifies the decision belongs to the case.

Recording a new decision:

- locks the case
- verifies expected case revision
- creates the next decision number
- sets `supersedes_decision_id` to the prior current decision when present
- moves the current-decision pointer
- changes the case state to `decided`
- increments case revision exactly once
- appends decision and state events in the same transaction

## Correction events

### Table

`editorial.correction_events`

### Purpose

Append-only reconstructable institutional history.

### Columns

- `id uuid primary key default gen_random_uuid()`
- `case_resource_id uuid not null`
- `event_number bigint not null`
- `event_type text not null`
- `case_revision_before bigint not null`
- `case_revision_after bigint not null`
- `prior_state text`
- `resulting_state text`
- `actor_id uuid`
- `reason text`
- `decision_id uuid`
- `application_id uuid`
- `target_id uuid`
- `evidence_link_id uuid`
- `public_note_id uuid`
- `related_resource_review_id uuid`
- `command_receipt_id uuid`
- `correlation_id uuid`
- `metadata jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`

### Foreign keys

- `case_resource_id` references `editorial.correction_cases(resource_id)` with `on delete restrict`
- `event_type` references `editorial.correction_event_types(event_type)`
- optional object pointers reference their canonical tables after those tables exist

Actor ID remains a historical UUID snapshot.

Command receipt ID is retained as a historical orchestration reference.

### Constraints

- `event_number >= 1`
- unique `(case_resource_id, event_number)`
- revisions are at least 1
- successful mutation events normally satisfy `case_revision_after = case_revision_before + 1`
- rejected stale-application events may use equal before and after revisions
- metadata is a JSON object with a bounded size
- update and delete are blocked
- direct authenticated insert is denied

### Ordering

Commands lock the case and allocate:

`max(event_number) + 1`

inside the same transaction.

Event number, not timestamp alone, is the canonical per-case ordering.

## Successful correction applications

### Table

`editorial.correction_applications`

### Purpose

Immutable record of a successful domain application.

Rejected or failed attempts remain represented by:

- durable command receipts
- correction events
- outbox events where appropriate

They do not create successful application rows.

### Columns

- `id uuid primary key default gen_random_uuid()`
- `case_resource_id uuid not null`
- `decision_id uuid not null`
- `command_receipt_id uuid not null`
- `command_type text not null`
- `adapter_type text not null`
- `target_id uuid not null`
- `target_resource_id uuid not null`
- `challenged_version_id uuid not null`
- `expected_published_version_id uuid not null`
- `expected_working_version_id uuid`
- `expected_working_fingerprint text`
- `resulting_version_id uuid not null`
- `application_summary text`
- `applied_by uuid`
- `correlation_id uuid`
- `applied_at timestamptz not null default now()`

### Foreign keys

- `case_resource_id` references `editorial.correction_cases(resource_id)` with `on delete restrict`
- `decision_id` references `editorial.correction_decisions(id)` with `on delete restrict`
- `target_id` references `editorial.correction_targets(id)` with `on delete restrict`
- `target_resource_id` references `editorial.resources(id)` with `on delete restrict`
- challenged, expected published, expected working, and resulting version IDs reference `editorial.article_versions(id)` where non-null
- `(command_receipt_id, case_resource_id, command_type)` references `platform_private.command_receipts(id, resource_id, command_type)` with `on delete restrict`

### First adapter

Supported initial value:

- `adapter_type = 'article'`
- `command_type = 'correction.apply_article'`

### Constraints and integrity

- unique `command_receipt_id`
- at most one successful application for the current decision
- decision belongs to case
- decision outcome is `correction_required`
- target belongs to case
- target resource matches application resource
- challenged version matches target version
- expected published version matches the challenged version for the first proof
- all Article versions belong to the target resource
- resulting version differs from challenged and expected working versions
- application row is immutable
- current public publication pointer was not changed by the application command

### Current-application pointer

`editorial.correction_cases.current_application_id` references `editorial.correction_applications(id)` with `on delete restrict` and is deferrable.

A deferred trigger verifies the application belongs to the case and current decision.

## Public correction notes

### Table

`editorial.correction_public_notes`

### Purpose

Immutable public-safe explanation of one applied correction.

Drafting and private investigation text do not live here.

### Columns

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

### Foreign keys

- `case_resource_id` references `editorial.correction_cases(resource_id)` with `on delete restrict`
- `application_id` references `editorial.correction_applications(id)` with `on delete restrict`
- `(affected_resource_id, affected_resource_kind)` references `editorial.resources(id, resource_kind)` with `on delete restrict`
- challenged and corrected version IDs reference `editorial.article_versions(id)` with `on delete restrict`
- `supersedes_note_id` references `editorial.correction_public_notes(id)` with `on delete restrict`

Publisher identity is a historical UUID snapshot.

### Constraints

- affected resource kind is `article` in the first slice
- non-blank note
- bounded public-note length
- non-blank deterministic fingerprint
- unique `(case_resource_id, affected_resource_id, corrected_version_id, note_fingerprint)`
- superseded note belongs to the same case and affected resource
- note application belongs to the same case and resource
- corrected version equals the successful application result
- corrected version is the current published version when the note is published
- challenged version remains identifiable
- update and delete are blocked

### Supersession

A later correction-note change creates a new row with `supersedes_note_id`.

Public reads expose the latest unsuperseded note while preserving prior notes internally.

No mutable `superseded_by` pointer is required.

## Related-resource reviews

### Table

`editorial.correction_related_resource_reviews`

### Purpose

Track related resources that may require follow-up without mutating those resources.

### Columns

- `id uuid primary key default gen_random_uuid()`
- `case_resource_id uuid not null`
- `related_resource_id uuid not null`
- `related_resource_kind text not null`
- `review_state text not null default 'pending'`
- `disposition text`
- `reason text`
- `linked_correction_case_resource_id uuid`
- `review_revision bigint not null default 1`
- `created_by uuid`
- `updated_by uuid`
- `resolved_by uuid`
- `resolved_at timestamptz`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### Foreign keys

- case references `editorial.correction_cases(resource_id)` with `on delete restrict`
- related resource references `editorial.resources(id, resource_kind)` with `on delete restrict`
- linked correction case references `editorial.correction_cases(resource_id)` with `on delete restrict`
- current actor fields reference `auth.users(id)` with `on delete set null`

### Review states

- `pending`
- `resolved`

### Dispositions

- `review_required`
- `correction_required`
- `no_action_required`
- `notification_only`
- `deferred`

### Constraints

- unique `(case_resource_id, related_resource_id)`
- `review_revision >= 1`
- pending rows have no final disposition or resolution metadata
- resolved rows require disposition, reason, actor, and time
- `correction_required` should link a correction case when one exists
- related resource cannot be the correction case resource itself
- every governed update requires expected review revision
- successful updates increment revision exactly once

Correction events preserve additions and disposition changes.

## Contributor notification authority

Do not create a second correction notification queue.

Use:

- `platform_private.jobs`
- `platform_private.outbox_events`
- existing community notification projection later

The first slice registers the event:

`correction.contributor_notification.requested`

The first slice may create a durable follow-up job:

`correction.contributor_notification`

The payload includes only:

- case resource ID
- originating contribution ID
- contributor user ID
- public-safe outcome
- public correction-note ID where available
- correlation ID

The payload excludes:

- private investigation text
- restricted Source detail
- unsafe quotations
- private moderation history

## Command registry design

Add controlled command types to `platform_private.command_types`.

Recommended command types:

- `correction.case.create_from_contribution`
- `correction.case.create_internal`
- `correction.case.triage`
- `correction.case.assign`
- `correction.evidence.link`
- `correction.evidence.unlink`
- `correction.investigation.update`
- `correction.case.submit_for_decision`
- `correction.decision.record`
- `correction.article.apply`
- `correction.note.publish`
- `correction.related_resource.disposition`
- `correction.case.close`
- `correction.case.reopen`

Each command type receives unique:

- job type
- accepted event type
- success event type
- failure event type
- retry event type

Synchronous lifecycle commands may complete inside the request transaction.

They still create:

- an idempotent command receipt
- accepted and terminal outbox events
- a correction event
- no hidden partial state

The Article application command may create a durable follow-up job for contributor notification and related asynchronous work.

## Shared command helper boundary

The implementation may add private helpers to avoid duplicating receipt logic.

Recommended helpers:

- `platform_private.begin_resource_command(...)`
- `platform_private.complete_resource_command(...)`
- `platform_private.reject_resource_command(...)`
- `platform_private.append_command_event(...)`

These helpers remain private and service-owned.

They must not become a generic browser-accessible resource mutation RPC.

Every public correction RPC remains domain-specific and validates its own payload and transition.

## Public correction RPCs

Proposed public function names:

- `public.create_correction_case_from_contribution`
- `public.create_internal_correction_case`
- `public.triage_correction_case`
- `public.assign_correction_case`
- `public.link_correction_evidence`
- `public.unlink_correction_evidence`
- `public.update_correction_investigation`
- `public.submit_correction_for_decision`
- `public.return_correction_to_investigation`
- `public.record_correction_decision`
- `public.apply_article_correction`
- `public.publish_correction_note`
- `public.add_related_resource_review`
- `public.set_related_resource_disposition`
- `public.close_correction_case`
- `public.reopen_correction_case`

Every state-changing RPC requires:

- authenticated actor or service role
- required correction capability
- target-domain capability where applicable
- idempotency key
- expected case revision where a case already exists
- correlation ID
- non-blank reason where the lifecycle requires one
- explicit payload validation
- transactional receipt and event recording

## Article application command

### Function

`public.apply_article_correction`

### Required authority

- `apply_corrections`
- administrator, or `edit_others_articles`

### Inputs

- correction case resource ID
- expected case revision
- expected current decision ID
- primary correction target ID
- challenged Article version ID
- expected current published Article version ID
- expected current working Article version ID, including explicit null
- expected working fingerprint where applicable
- complete corrected Article snapshot payload
- idempotency key
- correlation ID
- application summary

### Transactional behaviour

1. establish actor and capability context
2. validate idempotency key and request fingerprint
3. lock the correction case
4. resolve or create the durable command receipt
5. return the prior receipt for a safe replay
6. reject conflicting idempotency reuse
7. verify expected case revision
8. verify case state is `decided`
9. verify current decision and `correction_required` outcome
10. verify primary target identity
11. lock the Article resource and mutable Article row
12. verify current published version
13. verify current working version identity, including null
14. verify working fingerprint where applicable
15. on stale state:
    - mark receipt rejected
    - record error code and message
    - append `application_rejected_stale`
    - leave case revision and state unchanged
    - create no Article version
    - return a rejected receipt without raising an exception that would roll back the record
16. validate the complete corrected Article snapshot
17. allocate the next Article version number
18. create one new immutable Article version with a correction-specific version kind or accepted existing kind
19. do not move the current published pointer
20. move the working pointer only if the accepted Article authority contract requires it and no unrelated working edit is overwritten
21. create the immutable correction application row
22. move the case current-application pointer
23. change case state to `applied`
24. increment case revision exactly once
25. append correction events
26. mark command receipt succeeded
27. create success outbox event
28. enqueue allowed asynchronous follow-up
29. return receipt, application, resulting version, and resulting case revision

### Article version kind

The schema implementation must decide whether to:

- add `correction` to `editorial.article_versions.version_kind`, or
- use an existing immutable manual-save kind with explicit correction application linkage

Preferred design:

- add `correction`

Reasons:

- correction-created versions become directly auditable
- ordinary manual saves remain distinguishable
- application proof is easier to verify
- the Article lifecycle still controls review and publication

Adding the kind must not change publication rules.

### Working-version preservation

The command must not overwrite unrelated working edits.

Preferred first-slice rule:

- application requires the expected working version identity
- when a working version exists, its fingerprint must match the expected fingerprint
- the corrected version becomes the new working version only after exact concurrency verification
- when the working state changed, the application is rejected stale

## Stale rejection codes

Initial controlled rejection codes:

- `case_revision_changed`
- `decision_changed`
- `decision_not_correction_required`
- `target_changed`
- `published_version_changed`
- `working_version_changed`
- `working_fingerprint_changed`
- `application_already_succeeded`
- `idempotency_conflict`

Rejected receipts are durable.

A stale rejection changes no canonical Article or correction state.

## Public correction-note publication command

### Function

`public.publish_correction_note`

### Required authority

- `publish_correction_notes`
- administrator, or `publish_articles`

### Required gates

- expected case revision matches
- case state is `applied`
- current application is valid
- corrected Article version has completed normal review
- corrected Article version is the current published version
- affected Article resource matches the application target
- public note is non-blank and public-safe
- superseded note identity is valid where supplied
- no private evidence fields are accepted in the payload

### Result

- immutable public-note row
- correction event
- case revision increment
- contributor-notification request event where appropriate

Publishing a note does not close the case automatically.

## Closure command

`public.close_correction_case`

For correction-required cases, closure requires:

- current successful application
- corrected version published where public content changed
- public note published or no-note disposition with reason
- no pending related-resource review
- contributor notification requested or unavailable or unsafe reason recorded

For non-correction outcomes, closure requires:

- current decision
- no pending related-resource review
- contributor notification requested or unavailable or unsafe reason recorded

Closure records actor, reason, time, state, revision, receipt, and event atomically.

## Reopening command

`public.reopen_correction_case`

Required authority:

- `decide_corrections`

Required inputs:

- case resource ID
- expected case revision
- reason
- idempotency key
- correlation ID

Behaviour:

- lock case
- verify closed state
- preserve prior decisions, applications, and notes
- clear active closure metadata
- return state to `investigating`
- retain or explicitly reassign investigator
- increment case revision
- append reopening event
- complete durable receipt

## Canonical-table grants and RLS

All correction canonical tables must:

- enable RLS
- revoke all privileges from `public`
- revoke all privileges from `anon`
- revoke direct mutation privileges from `authenticated`
- grant required access to `service_role`
- expose authenticated access only through narrow security-definer functions
- force RLS where it does not break trusted command execution

Canonical tables include:

- `editorial.correction_kinds`
- `editorial.correction_evidence_roles`
- `editorial.correction_event_types`
- `editorial.correction_cases`
- `editorial.correction_targets`
- `editorial.correction_evidence_links`
- `editorial.correction_decisions`
- `editorial.correction_events`
- `editorial.correction_applications`
- `editorial.correction_public_notes`
- `editorial.correction_related_resource_reviews`

Vocabulary reads may be exposed to authenticated users through a narrow function or explicit read policy.

No correction canonical table is anonymously readable.

## Internal read-authority helpers

Create:

- `editorial.current_user_can_view_correction(uuid)`
- `editorial.current_user_can_triage_correction(uuid)`
- `editorial.current_user_can_investigate_correction(uuid)`
- `editorial.current_user_can_decide_correction(uuid)`
- `editorial.current_user_can_apply_correction(uuid)`
- `editorial.current_user_can_publish_correction_note(uuid)`

The helpers allow:

- service role
- administrator
- users with the relevant correction capability

Application and public-note helpers do not independently grant domain capability.

The public RPC must separately verify Article or Registry authority.

## Internal correction read models

### `public.list_correction_cases`

Returns a narrow correction index.

Recommended fields:

- case resource ID
- formatted case reference
- origin type
- correction kind
- priority
- case state
- current revision
- primary target resource kind
- primary target summary
- assigned investigator label
- current decision outcome
- created time
- updated time
- closed time

Requires `view_corrections`.

It does not expose private investigation text or restricted evidence.

### `public.get_correction_case_workspace`

Returns one governed internal workspace.

Recommended sections:

- case identity and lifecycle
- origin snapshot
- targets
- evidence-link summaries
- assignment
- investigation summary
- decision history
- application history
- public-note history
- related-resource reviews
- correction event history
- command receipt summaries safe for the caller

Requires `view_corrections`.

Restricted Source contents require the existing Phase 3A restricted Source read authority.

### `public.list_correction_case_events`

Returns ordered event summaries by `event_number`.

Requires `view_corrections`.

Private event metadata is allowlisted by capability.

## Public Article correction read authority

Create:

`public.public_get_article_correction_notes(p_slug text)`

The function is security definer with a narrow fixed return type.

A row is public only when:

- the Article exists
- the affected resource is bound to that Article
- the correction note is immutable and published
- the corrected Article version is the current active published version
- the note is not superseded by a later note
- the correction case and application identities are valid
- only public-safe note fields are returned

Recommended fields:

- Article ID
- resource ID
- case reference
- correction note ID
- challenged version ID
- corrected version ID
- note text
- correction publication time

The function must not expose:

- case UUID where unnecessary
- contributor identity
- internal case summary
- private analysis
- evidence links
- Source URLs
- Citation quotation
- actor account details
- command receipt details
- related-resource reviews
- private event history

Grant execute to:

- `anon`
- `authenticated`

No direct public grant is added to correction tables.

## Indexes

### Correction cases

- unique `(case_number)`
- unique partial `(origin_contribution_id)` where not null
- `(case_state, priority, updated_at desc)`
- `(assigned_investigator_id, case_state, updated_at desc)` where assigned
- `(correction_kind, case_state, updated_at desc)`
- `(created_at desc)`

### Targets

- unique partial one-primary-target index per case
- `(case_resource_id, created_at)`
- `(target_resource_id, target_version_id)`
- `(target_resource_kind, target_resource_id)`

### Evidence

- `(case_resource_id, created_at)`
- `(source_version_id, case_resource_id)`
- `(citation_id, case_resource_id)` where citation is not null

### Decisions

- unique `(case_resource_id, decision_number)`
- `(case_resource_id, created_at desc)`
- `(outcome, created_at desc)`

### Events

- unique `(case_resource_id, event_number)`
- `(case_resource_id, created_at desc)`
- `(correlation_id)` where not null
- `(command_receipt_id)` where not null

### Applications

- unique `(command_receipt_id)`
- `(case_resource_id, applied_at desc)`
- `(target_resource_id, applied_at desc)`
- `(resulting_version_id)`

### Public notes

- `(affected_resource_id, published_at desc)`
- `(case_resource_id, published_at desc)`
- `(corrected_version_id)`
- `(supersedes_note_id)` where not null

### Related resources

- unique `(case_resource_id, related_resource_id)`
- `(case_resource_id, review_state, updated_at desc)`
- `(related_resource_id, review_state)`

## Append-only protection

Create one reusable private protection function or narrow table-specific functions that raise on update or delete.

Apply append-only protection to:

- `editorial.correction_decisions`
- `editorial.correction_events`
- `editorial.correction_applications`
- `editorial.correction_public_notes`

Do not grant authenticated mutation privileges.

## Transaction and locking order

To reduce deadlocks, commands use a consistent lock order:

1. correction case resource row
2. correction case row
3. primary target row
4. target domain resource row
5. target mutable domain row
6. trust or related-resource revision row
7. command receipt row
8. job and outbox rows

Idempotent replay lookup may occur before locking the case when safe.

Conflicting idempotency reuse must be rejected before domain mutation.

## Migration sequence

Do not implement PR 3B as one uncontrolled migration.

### Migration 1: Correction identity foundation

Creates:

- capabilities and initial role assignments
- `correction_case` resource kind
- correction vocabulary tables
- correction cases
- correction targets
- correction events
- indexes
- RLS and grants
- pointer and state integrity helpers
- internal read-authority helpers
- structural verifier

No production correction case is created yet.

### Migration 2: Evidence, decisions, and related-resource authority

Creates:

- correction evidence links
- correction decisions
- related-resource reviews
- current decision pointer
- append-only protection
- triage, assignment, evidence, investigation, submission, decision, related-resource, close, and reopen commands
- internal workspace reads
- verifier

### Migration 3: Article correction application adapter

Creates:

- `correction` Article version kind
- correction applications
- current application pointer
- command registry rows and private receipt helpers
- `public.apply_article_correction`
- stale rejection codes
- durable receipt and event integration
- Article adapter verifier

This migration does not publish an Article automatically.

### Migration 4: Public notes and contributor follow-up

Creates:

- public correction notes
- note publication command
- public Article correction-note function
- contributor notification job and outbox event contract
- closure gate integration
- verifier

### Frontend slices

Only after the relevant read and mutation authority is live:

1. correction queue and case workspace
2. Article correction application controls
3. public Article correction history
4. contributor notification projection

## Verification requirements

Every migration receives a pure SQL verifier that confirms:

- required objects exist
- grants are exact
- RLS is enabled
- browser roles cannot directly mutate canonical tables
- append-only triggers are active
- pointer integrity triggers are active
- controlled vocabularies are complete
- unsupported transitions fail
- stale revisions fail without mutation
- idempotent replay returns the original receipt
- conflicting idempotency reuse fails
- public functions expose only allowlisted fields

## First production proof

The first Article proof must use one real authenticated community contribution and one existing published Article.

It must verify:

1. contribution remains unchanged
2. one correction case resource is created
3. one primary Article target identifies the exact published version
4. one approved Source version or active Citation is linked
5. investigator assignment is recorded
6. case reaches awaiting decision
7. append-only correction-required decision is recorded
8. stale Article application creates a durable rejected receipt and event
9. stale application creates no Article version and changes no pointer
10. valid application creates one immutable correction Article version
11. public published pointer remains unchanged after application
12. corrected version completes normal Article review
13. corrected version is published through existing Article authority
14. one immutable public correction note is published
15. one related resource is dispositioned
16. contributor notification follow-up job and outbox event exist
17. case closes through the governed command
18. ordered correction history reconstructs what changed and why

## Rollback strategy

Before production proof:

- disable public correction RPCs
- remove grants
- remove views and functions
- remove command-type rows only when no receipts reference them
- drop correction tables in reverse dependency order through a follow-up migration
- remove correction capabilities and resource kind only when no rows depend on them

After production proof:

Do not destructively erase correction history.

Rollback becomes:

- disable correction command types
- revoke mutation-function execution
- hide frontend entry points
- preserve cases, decisions, events, applications, notes, receipts, jobs, and outbox history
- correct defects through follow-up migrations

Never edit or delete an already-applied migration.

## Immediate non-goals

The schema design does not include:

- Registry correction application
- Playlist correction application
- Audio or video correction application
- transcript correction tooling
- chart correction tooling
- Inquiry correction tooling
- anonymous correction intake
- email delivery
- webhook delivery
- AI decisions
- direct public access to correction tables
- bulk conversion of existing contributions
- automatic case creation for every contribution
- automatic Source approval
- automatic Article publication

## Implementation gate

After this schema contract is merged and accepted:

- Migration 1 implementation is unblocked.
- Later migrations remain blocked behind the acceptance of the preceding migration.
- No frontend work begins before its read and mutation authorities are live.
