# Phase 3B Migration 2 Evidence and Decision Contract Lock

Date: 4 August 2026

## Status

Migration 2 sequence locked for implementation review.

No Migration 2 SQL has been written.

Production has not changed through this contract lock.

## Authority

This document resolves the sequencing gaps found by the read-only Phase 3B Migration 2 contract audit.

Where this document narrows or corrects the earlier Migration 2 sequence in `phase-3b-correction-schema-command-design.md`, this document controls Migration 2 implementation.

The accepted lifecycle and authority boundary remain unchanged unless this document states a narrower temporary gate required by migration sequencing.

## Locked Migration 2 scope

Migration 2 creates:

- `editorial.correction_evidence_links`
- `editorial.correction_decisions`
- `editorial.correction_related_resource_reviews`
- `editorial.correction_cases.current_decision_id`
- evidence, decision, and related-resource integrity functions and triggers
- append-only protection for decisions
- correction command registry rows required by Migration 2
- shared private receipt and terminal-event helpers required by Migration 2
- case creation, triage, assignment, evidence, investigation, submission, decision, related-resource, non-correction closure, and reopen commands
- internal correction queue and workspace read functions
- a pure SQL structural verifier

Migration 2 does not create:

- correction applications
- the Article correction application adapter
- the `correction` Article version kind
- public correction notes
- public Article correction-note reads
- contributor notification jobs or delivery projections
- correction frontend authority
- Registry correction adapters
- production correction case rows

## Lock 1: Case creation belongs to Migration 2

Migration 2 creates both governed case-creation commands:

- `public.create_correction_case_from_contribution`
- `public.create_internal_correction_case`

Their controlled command types are:

- `correction.case.create_from_contribution`
- `correction.case.create_internal`

Both commands require:

- authenticated actor or service role
- `triage_corrections`
- idempotency key
- request fingerprint
- correlation ID
- durable command receipt
- accepted and terminal outbox events
- one stable correction-case resource
- one correction case row
- one append-only `case_created` event

Contribution-origin creation must preserve the contribution row unchanged and retain its immutable origin snapshot.

Internal creation must require a non-blank origin summary and an authenticated creating actor.

## Lock 2: Command registry and receipt authority moves into Migration 2

Migration 2 introduces the shared correction command registry rows and private receipt helpers needed by every Migration 2 mutation command.

Migration 2 must not create unreceipted public mutation functions.

Migration 2 must reuse:

- `platform_private.command_types`
- `platform_private.command_receipts`
- `platform_private.jobs`
- `platform_private.outbox_events`

Private helpers may include:

- `platform_private.begin_resource_command(...)`
- `platform_private.complete_resource_command(...)`
- `platform_private.reject_resource_command(...)`
- `platform_private.append_command_event(...)`

The helpers remain private and service-owned.

Every public Migration 2 command must:

- produce one idempotent receipt identity
- reject conflicting idempotency reuse
- record accepted and terminal outbox events
- record one or more ordered correction events
- return the original receipt on safe replay
- leave no hidden partial state

Migration 3 adds only the Article-application command type and any adapter-specific receipt extension required by `public.apply_article_correction`.

## Lock 3: Migration 2 closure is limited to non-correction outcomes

Migration 2 creates `public.close_correction_case`, but it may close only cases whose current decision outcome is one of:

- `no_change_required`
- `insufficient_evidence`
- `duplicate`
- `out_of_scope`

A current decision outcome of `correction_required` must be rejected with no case mutation during Migration 2.

Correction-required closure remains unavailable until:

- a successful correction application exists
- the corrected public content has completed normal review and publication where required
- the public-note or no-note disposition authority exists
- contributor follow-up authority exists
- related-resource reviews satisfy final closure gates

These authorities arrive in Migrations 3 and 4.

## Lock 4: Current decision pointer and state integrity

Migration 2 adds:

`editorial.correction_cases.current_decision_id uuid`

The pointer:

- references `editorial.correction_decisions(id)`
- uses `on delete restrict`
- is deferrable
- must belong to the same correction case

Migration 2 replaces the Migration 1 deferred case-state integrity function with a version that allows:

- `decided` with a valid current decision
- `closed` for a valid non-correction current decision

Migration 2 continues to reject:

- `applied`
- correction-required `closed`
- any current application pointer
- any decision pointer belonging to another case
- any case revision that does not match its latest successful correction event revision

Migration 3 replaces the temporary applied-state block after application authority exists.

## Lock 5: Evidence unlink history snapshot

`public.unlink_correction_evidence` deletes the current evidence-link row only after copying its governed identity into the append-only `evidence_unlinked` correction event.

The event must preserve:

- evidence link ID
- case resource ID
- Source ID
- Source version ID
- optional Citation ID
- evidence role
- link creator ID
- link creation time
- unlinking actor ID
- unlink reason
- command receipt ID
- correlation ID

The event metadata must be a bounded JSON object.

The unlink command must increment the case revision exactly once and must not alter Source, Source-version, or Citation records.

## Lock 6: Related-resource closure gate

Every related-resource review linked to a case must be resolved before Migration 2 permits non-correction closure.

A resolved review requires:

- final disposition
- non-blank reason
- resolving actor
- resolution time
- expected review revision
- exactly one revision increment

A pending review blocks closure.

A related-resource disposition of `correction_required` may link another correction case when one exists. It does not mutate the related resource.

Correction-required cases cannot close in Migration 2, so their related-resource reviews may remain open across Migrations 3 and 4.

## Lock 7: Decision recording and supersession

`public.record_correction_decision` is permitted when the case is:

- `awaiting_decision`
- `decided`

For the first decision:

- the case moves from `awaiting_decision` to `decided`
- one append-only decision row is created
- `current_decision_id` points to the new row
- case revision increments exactly once
- one `decision_recorded` event is appended

For a superseding decision:

- the case remains `decided`
- one new append-only decision row is created
- `supersedes_decision_id` points to the previous current decision
- `current_decision_id` moves to the new row
- case revision increments exactly once
- a `decision_superseded` event is appended first
- a `decision_recorded` event is appended second

Both supersession events:

- receive consecutive event numbers
- carry the same case revision before and after values
- identify the prior and new decision IDs
- share the command receipt ID and correlation ID

Decision recording is rejected from:

- `submitted`
- `triaged`
- `investigating`
- `applied`
- `closed`

A closed case must first use the governed reopen command and complete investigation and submission again.

## Migration 2 command set

Migration 2 registers and implements:

- `correction.case.create_from_contribution`
- `correction.case.create_internal`
- `correction.case.triage`
- `correction.case.assign`
- `correction.evidence.link`
- `correction.evidence.unlink`
- `correction.investigation.update`
- `correction.case.submit_for_decision`
- `correction.case.return_to_investigation`
- `correction.decision.record`
- `correction.related_resource.add`
- `correction.related_resource.disposition`
- `correction.case.close`
- `correction.case.reopen`

The SQL implementation must lock exact job and outbox event names before insertion.

## Migration 2 public RPC set

Migration 2 implements:

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
- `public.add_related_resource_review`
- `public.set_related_resource_disposition`
- `public.close_correction_case`
- `public.reopen_correction_case`

No generic browser-accessible correction mutation RPC is permitted.

## Internal reads

Migration 2 creates:

- `public.list_correction_cases`
- `public.get_correction_case_workspace`
- `public.list_correction_case_events`

All require `view_corrections`.

The workspace may expose governed Source and Citation summaries only when the caller also holds the existing restricted Source read authority where required.

No anonymous correction read is introduced in Migration 2.

## Verification lock

The Migration 2 verifier must prove:

- all three Migration 2 tables exist
- `current_decision_id` exists and is deferrable
- exact foreign keys, checks, indexes, triggers, RLS, grants, and policies
- decisions are append-only
- browser roles cannot directly mutate canonical rows
- case creation preserves contribution intake
- internal case creation requires actor and summary
- evidence links use approved, non-archived Source versions
- optional Citations match Source and Source version and remain active
- evidence unlink preserves its full event snapshot
- stale case and review revisions change nothing
- idempotent replay returns the original receipt
- conflicting idempotency reuse fails
- first decisions and superseding decisions obey the locked event sequence
- correction-required closure is impossible
- non-correction closure requires all related-resource reviews resolved
- `applied` remains impossible
- no correction application, public note, notification, or frontend authority exists

## Implementation gate

No Migration 2 SQL may be written until this contract lock is reviewed, merged, and accepted.

After merge, implementation begins with a repository and live-schema preflight against the exact accepted document identity.
