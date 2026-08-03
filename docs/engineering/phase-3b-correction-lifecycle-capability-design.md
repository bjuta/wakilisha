# Phase 3B Correction Lifecycle and Capability Design

Date: 3 August 2026

## Status

Lifecycle and capability design defined.

Correction schema and command design is defined in `phase-3b-correction-schema-command-design.md`.

Migration 1 implementation is unblocked after the schema-design PR is accepted and merged.

No migration has been written or applied.

Production has not changed.

## Purpose

This document defines the correction case lifecycle, decision outcomes, capabilities, role assignments, concurrency rules, Article application gates, public-note gates, closure rules, and first acceptance proof.

It does not define final SQL tables, columns, indexes, triggers, RLS policies, RPC signatures, or migration order.

## Authority boundary

The correction system owns:

- correction case identity and lifecycle
- investigation assignment
- evidence links
- append-only decisions and events
- application receipts
- public correction notes
- related-resource review records
- contributor-notification requests

It does not own community intake, Source or Citation contents, Article version contents, Article review or publication, Registry canonical data, community notification delivery, or the shared command, job, and outbox platform.

## Intake boundary

`community_contributions` remains intake.

Creating a case from a contribution must retain the contribution ID, contributor ID, submission type, submitted description, and submission time. It must leave the contribution row intact and create an append-only case-created event.

A contribution may create at most one controlling correction case unless an explicit split operation creates linked cases.

## Controlled vocabularies

### Origins

Initial origins:

- `community_contribution`
- `internal_editorial`

Later origins may include Registry review, automated detection, external partner, legal or rights request, and related-resource review.

Automated detection may create intake only. It cannot create a decision.

### Correction kinds

- `factual_error`
- `attribution_error`
- `missing_credit`
- `classification_error`
- `outdated_information`
- `transcription_error`
- `broken_reference`
- `rights_or_consent`
- `other`

### Priority

- `low`
- `normal`
- `high`
- `urgent`

The default is `normal`. Priority never bypasses evidence, decision, application, review, or publication gates.

## Case lifecycle

### `submitted`

A case exists but has not completed triage.

Required: case identity, origin, submitted summary, created actor, created time, and revision.

Permitted transition: `triaged`.

### `triaged`

The institution has confirmed that the case is actionable enough to investigate.

Required: controlled correction kind, priority, primary target, triage reason, triage actor, and triage time.

Permitted transition: `investigating`.

### `investigating`

An investigator owns the evidence and analysis work.

Required: assigned investigator, assignment reason, assignment time, primary target, and observed target identity.

Permitted transition: `awaiting_decision`.

Evidence and assignment changes require governed commands and append-only events.

### `awaiting_decision`

The investigation is ready for institutional decision.

Required: investigation summary, investigator recommendation, evidence-readiness confirmation, submission actor, and submission time.

Permitted transitions:

- `decided`
- `investigating`

Returning to investigation requires a reason.

### `decided`

A current append-only decision exists.

For `correction_required`, application may be attempted. A stale or rejected application leaves the case in `decided`. A successful application advances it to `applied`.

For non-correction outcomes, the case may advance to `closed`.

A later decision creates a new record and does not alter the earlier decision.

### `applied`

A governed domain result exists.

For the first Article slice:

- a new immutable Article version exists
- the resulting version is linked to the application
- the challenged published version remains preserved
- the public publication pointer has not been changed by the application command

Permitted transition: `closed`.

Article review and publication remain outside the correction state machine.

### `closed`

No active institutional work remains.

Closure requires reason, actor, time, and final disposition.

A closed case remains readable and is not deleted through normal correction commands.

Permitted transition: `investigating` through an explicit reopen command with a reason.

## Transition graph

```text
submitted
  -> triaged
  -> investigating
  -> awaiting_decision
  -> decided
```

For `correction_required`:

```text
decided
  -> applied
  -> closed
```

For non-correction outcomes:

```text
decided
  -> closed
```

Additional-work transition:

```text
awaiting_decision
  -> investigating
```

Reopening transition:

```text
closed
  -> investigating
```

No other transition is permitted in the first slice.

## Decision outcomes

### `correction_required`

A material error, omission, or governed problem requires change.

### `no_change_required`

The investigation found no correction requiring change.

### `insufficient_evidence`

Available evidence does not support an institutional correction decision.

### `duplicate`

Another correction case already owns the issue. The decision must link the controlling case.

### `out_of_scope`

The submission does not describe a correction governed by this system.

Every decision records case identity, observed case revision, outcome, reason, private analysis, optional public-safe explanation, deciding actor, decision time, observed target state, and correlation ID.

Decision records are append-only. Only the current decision may authorize application or closure.

The originating public contributor cannot be the institutional deciding actor.

## Case revision

Every case has a monotonic revision beginning at `1`.

The revision advances when governed case facts change, including triage, priority, targets, assignment, evidence links, investigation summary, state, current decision, application result, public-note disposition, related-resource disposition, closure, or reopening.

Every mutation command requires `expected_case_revision`.

A mismatched revision rejects the mutation and changes no case fact.

## Correction capabilities

### `view_corrections`

View internal correction workspaces and governed history.

### `triage_corrections`

Create cases from intake, create internal cases, classify cases, set priority, attach primary targets, and assign investigators.

### `investigate_corrections`

Link approved evidence, record investigation notes and summaries, submit cases for decision, and return cases for more investigation.

### `decide_corrections`

Record append-only decisions, supersede decisions through new records, close cases, and reopen cases.

### `apply_corrections`

Execute a correction application adapter. This capability must be combined with target-domain mutation authority.

For Articles, the caller also requires administrator authority or `edit_others_articles`.

For a later Registry adapter, the caller also requires administrator authority or `manage_registry`.

### `publish_correction_notes`

Publish reviewed public-safe correction notes. This capability must be combined with target-domain publication authority.

For Articles, the caller also requires administrator authority or `publish_articles`.

## Initial role assignments

### Administrator

All six correction capabilities.

### Editor

All six correction capabilities. Existing Article capabilities still apply.

### Reviewer

- `view_corrections`
- `triage_corrections`
- `investigate_corrections`
- `decide_corrections`

A reviewer cannot apply an Article correction or publish a correction note without separately holding the required correction and domain capabilities.

### Registry editor

`view_corrections` only during the Article slice.

Registry-specific assignments are deferred until the Registry adapter is designed.

### Author, writer, viewer, and public contributor

No internal correction capability by default.

Authenticated contributors continue to submit through community intake.

## Governed command responsibilities

Provisional commands:

- `create_correction_case_from_contribution`
- `create_internal_correction_case`
- `triage_correction_case`
- `assign_correction_case`
- `link_correction_evidence`
- `update_correction_investigation`
- `submit_correction_for_decision`
- `record_correction_decision`
- `apply_article_correction`
- `publish_correction_note`
- `close_correction_case`
- `reopen_correction_case`

Exact SQL function names remain subject to schema design.

### Apply Article correction

Required authority:

- `apply_corrections`
- Article edit authority
- current decision outcome `correction_required`

Required concurrency inputs:

- expected case revision
- expected current decision ID
- challenged Article version ID
- expected current published Article version ID
- expected current working Article version identity, including explicit null
- expected working-version fingerprint where applicable
- idempotency key
- correlation ID

Successful result:

- new immutable Article version ID
- unchanged public publication pointer
- durable application receipt
- append-only correction application event
- case state `applied`
- follow-up outbox events

Application must never update an immutable Article version, publish automatically, overwrite unrelated working edits, bypass review or publication, mutate Source or Citation contents, or leave partial hidden state.

## Stale-write rules

Application is rejected when:

- case revision changed
- current decision changed
- decision outcome is no longer `correction_required`
- challenged version identity is invalid
- current published version changed
- current working version changed
- working fingerprint changed
- an application already succeeded
- an idempotency key was reused for a different request

A stale rejection must create:

- a durable rejected command receipt
- an append-only correction event
- no Article version
- no publication-pointer change
- no case-state change

A safe retry with the same idempotency key and fingerprint returns the original receipt.

## Public correction notes

A public note may expose what changed, the affected public work, challenged and corrected versions or publication dates, a concise public-safe explanation, and publication time.

It must not expose private contributor identity without permission, internal investigation notes, restricted Source details, unsafe quotations, private moderation history, or internal assignment history.

Published notes are immutable. A later change creates a superseding note.

Not every correction requires a public note. A no-note disposition requires a recorded reason.

## Affected-resource review

A related-resource record uses one disposition:

- `review_required`
- `correction_required`
- `no_action_required`
- `notification_only`
- `deferred`

Linking a related resource does not mutate it.

The first Article proof must flag and disposition one related resource.

## Contributor notification

Correction commands enqueue follow-up through the existing transactional outbox.

Initial event:

`correction.contributor_notification.requested`

The payload may include case ID, contribution ID, contributor user ID, public-safe outcome, correction-note ID, notification reason, and correlation ID.

It must not contain private investigation notes or restricted evidence.

Community notifications may later display the delivery projection. They are not the correction job authority.

## Closure gates

For `correction_required`, closure requires:

- successful application receipt
- resulting version identity
- normal Article review and publication where public content changed
- public correction note or recorded no-note reason
- related-resource reviews dispositioned
- contributor notification requested or an unavailable or unsafe reason recorded

For non-correction decisions, closure requires the current decision, closure reason, related-resource dispositions, and notification request or exception reason.

## Reopening

A closed case may be reopened for material new evidence, unresolved application, wider related-resource impact, materially incomplete public note, or procedural invalidity.

Reopening preserves all prior decisions, applications, and notes, returns the case to `investigating`, advances the revision, and records an append-only event.

## First Article acceptance proof

1. One authenticated community contribution exists.
2. Triage creates one correction case.
3. The original contribution remains intact.
4. The case targets one stable Article resource.
5. It identifies the exact published version being challenged.
6. One approved Source version or active Citation is linked.
7. One investigator is assigned.
8. The case reaches `awaiting_decision`.
9. One append-only `correction_required` decision is recorded.
10. One stale application is durably rejected.
11. The stale attempt changes no Article version or pointer.
12. One valid application creates a new immutable Article version.
13. The current published pointer remains unchanged.
14. The resulting version completes normal Article review.
15. The resulting version is published through existing Article authority.
16. One public-safe correction note is published.
17. One related resource is flagged and dispositioned.
18. One contributor-notification outbox event is created.
19. The case is closed.
20. The complete history explains what changed and why.

## Schema design now unblocked

The next design must determine exact schema placement, table names, case-number format, vocabularies, target polymorphism, evidence-link keys, decision-pointer integrity, receipt linkage, event shapes, note supersession, related-resource identity, command-type entries, RLS, indexes, append-only triggers, read authority, migration order, and rollback.

## Immediate non-goals

Do not implement correction tables, RPCs, command types, jobs, outbox events, Article correction UI, public correction UI, Registry adapter, anonymous intake, email delivery, AI decisions, or bulk contribution migration until the schema design is accepted.

## Next gate

Create and accept the Phase 3B correction schema design.

Only after that acceptance may the first correction migration be written.
