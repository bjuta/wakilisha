# Phase 3B Corrections and Provenance Authority Boundary Audit

Date: 3 August 2026

## Status

Authority boundary defined.

Live reused-authority verification is complete.

Correction lifecycle and capability design is defined in `phase-3b-correction-lifecycle-capability-design.md`.

Correction schema and command design is defined in `phase-3b-correction-schema-command-design.md`.

Migration 1 implementation is unblocked after the schema-design PR is accepted and merged.

No Phase 3B migration has been written or applied.

Production has not changed.

## Starting baseline

Phase 3A is complete.

The accepted trust baseline provides:

- reusable Sources
- immutable Source versions
- typed Citations
- governed Credits
- immutable Article versions
- separate working and published trust
- public-safe trust reads
- append-only Source review history
- Article review and publication authority
- Phase 1B command, job and transactional outbox infrastructure

PR 3B must extend this baseline. It must not replace or duplicate it.

## Audit evidence

The repository audit scanned 1,486 files.

Existing foundations include:

- `community_contributions`
- `community_notifications`
- `admin_audit_events`
- `registry_provenance_links`
- `registry_canonical_write_events`
- `publishing_item_events`
- immutable Article versions
- Article review and suggestion events
- Registry evidence and review commands
- Phase 1B commands, receipts, jobs and outbox events

The audit found no authoritative:

- correction cases
- correction targets
- correction evidence links
- correction decisions
- correction events
- correction notification jobs
- public correction notes
- affected-resource review records

The only `apply_correction` occurrence is a programme contract example. No implemented command exists.

## Live reused-authority verification

A read-only production verification completed successfully on 3 August 2026.

The verification confirmed the existence and required boundaries of:

- `platform_private.command_types`
- `platform_private.command_receipts`
- `platform_private.jobs`
- `platform_private.outbox_events`
- `public.community_contributions`
- `public.community_notifications`
- `public.admin_audit_events`
- `public.registry_provenance_links`
- `public.registry_canonical_write_events`
- `editorial.resources`
- `editorial.article_resources`
- `editorial.article_versions`
- `editorial.article_suggestion_events`
- `editorial.publishing_item_events`
- `editorial.sources`
- `editorial.source_versions`
- `editorial.source_review_events`
- `editorial.citations`
- `editorial.resource_citations`
- `editorial.credits`
- `editorial.credit_governance`
- `editorial.resource_credits`

The live security verification confirmed:

- browser roles cannot use the private orchestration schema
- browser roles cannot read command receipts, jobs, or outbox events
- anonymous users cannot submit platform commands
- authenticated users and the service role retain the intended command grant
- Article versions remain protected by their immutability trigger
- Source versions remain protected by their immutability trigger
- Source review events remain append-only
- Publishing item events remain append-only

The observed live counts were:

- controlled command types: 1
- command receipts: 1
- durable jobs: 1
- outbox events: 1
- community contributions: 1
- community notifications: 0
- Sources: 2
- Source versions: 2
- Citations: 2
- Article-version Citation attachments: 2
- Registry provenance links: 6,332
- Registry canonical-write events: 0

The final verification result was:

`Phase 3B reused foundations verified`

The correction-case authority was:

`ABSENT AS EXPECTED`

No correction-case table, correction-target table, correction-event table, correction-notification-job table, public correction-note table, affected-resource flag table, `apply_correction` command, or public correction-note publication command exists in production.

The empty community notification count is not a missing authority. The notification table and read functions exist, but no live notification rows were present during verification.

The empty Registry canonical-write-event count does not block the first Article correction slice. The later Registry correction adapter must include a production proof that creates or references an authoritative Registry canonical-write event.

This live proof closes the reused-authority verification gate.

Correction lifecycle and capability design may now proceed.

Schema implementation remains blocked until that design is accepted.

## Authority conclusion

PR 3B requires a new shared correction-case authority.

Existing contribution, review, audit, notification and provenance records are supporting systems. None is sufficient to become the correction authority without creating conflicting ownership or mutable history.

## Reuse decisions

### Sources and Citations

Phase 3A Sources and Citations remain the evidence authority.

A correction case may link to:

- one or more Sources
- exact immutable Source versions
- typed Citations where a precise passage, timestamp, field or locator matters

PR 3B must not create a second general evidence table containing copied URLs, titles, summaries and claims.

Legacy Registry and Inquiry evidence may only enter the shared trust layer through an explicit reviewed mapping.

### Commands, receipts, jobs and outbox

Phase 1B remains the orchestration authority.

Correction commands must use:

- authenticated actor context
- capability checks
- expected current revision
- expected target version or fingerprint
- idempotency key
- command payload
- correlation ID
- durable command receipt
- transactional outbox events
- safely retryable jobs

No correction feature may create a hidden queue or a second command bus.

### Article authority

Article correction application must use the existing Article resource and immutable-version authority.

A correction targeting an Article records:

- stable Article resource identity
- the exact Article version being challenged
- the Article version current when application begins
- the new Article version created by the correction application

Applying a correction must not mutate an immutable Article version or silently replace the current published snapshot.

Normal Article review and publication remain responsible for approving and publishing the corrected version.

### Registry authority

Registry correction application must use reviewed canonical Registry commands.

The correction system records the case, evidence, decision and application receipt.

The Registry remains authoritative for:

- canonical entity identity
- canonical relationship identity
- review rules
- canonical writes
- Registry-specific validation
- Registry write history

PR 3B must not write directly into canonical Registry tables.

### Notifications

The Phase 1B outbox and job platform owns asynchronous correction follow-up.

Community notifications may display a delivered notification to a contributor.

`community_notifications` is not the correction notification job authority.

## Adapt decisions

### Community contributions

`community_contributions` remains public and community intake.

It may originate a correction case through an explicit triage command.

It does not become the correction case itself because it currently has:

- a mutable status
- a generic JSON payload
- direct approval, rejection and merge updates
- no immutable decision history
- no stable target-version contract
- no correction application receipt
- no public correction-note authority
- no optimistic-concurrency revision

A correction case may retain the originating contribution ID.

Creating a case must not delete or rewrite the original contribution.

### Existing review workflows

Article, Source and Registry review systems provide reusable patterns:

- explicit decisions
- required reasons
- actor and timestamp
- optimistic concurrency
- append-only events
- public-safe separation

Their tables and domain-specific status vocabularies remain separate.

PR 3B defines correction-specific lifecycle states and commands.

## Keep-separate decisions

### Registry provenance

`registry_provenance_links` remains internal legacy Registry provenance.

It preserves historical source-to-media links and must not become:

- correction history
- shared editorial provenance
- a public correction-note table
- a correction target table

### Operational and domain histories

These remain separate:

- `admin_audit_events`
- `publishing_item_events`
- Article suggestion events
- Source review events
- Registry canonical write events
- chart ingest audit events

Correction events may reference related domain events through stable IDs and correlation IDs.

They do not replace those histories.

## New shared authority

PR 3B must introduce the concepts below.

Exact SQL names remain subject to schema design.

### Correction case

A stable institutional record of an alleged error, omission or material problem.

A case records:

- case identity
- case number or stable display reference
- origin
- correction kind
- summary
- private investigation detail
- public-safe summary where permitted
- lifecycle state
- priority
- assigned investigator
- current revision
- created actor and time
- closed actor and time
- correlation ID

### Correction target

A typed binding between a case and the work being challenged.

A target records:

- resource kind
- stable resource identity
- exact observed version or snapshot identity where available
- target role
- target summary
- target revision or fingerprint observed during triage
- whether it is the primary target

The target contract must support Articles first and later support:

- Registry records
- Registry relationships
- playlists
- playlist items or notes
- audio episodes
- transcripts
- video
- charts
- chart methodology
- Inquiry Findings

### Evidence link

A correction case links to shared Source and Citation authority.

The link records the role the evidence plays in the case.

The correction system does not copy or own the Source contents.

### Investigation ownership

Assignment is explicit and historically visible.

Reassignment requires a reason and creates an append-only event.

### Decision history

Decisions are append-only.

A decision records:

- outcome
- reason
- private analysis
- public-safe explanation where appropriate
- deciding actor
- decision time
- case revision
- target state observed when deciding

Changing a decision creates a new decision record. It does not rewrite the previous decision.

### Correction application

Application is an explicit governed command.

It must:

- require an accepted decision
- require expected case revision
- require expected target version or fingerprint
- reject stale target state
- reject repeated application unless the retry is idempotent
- execute domain changes transactionally where possible
- return a command receipt
- record resulting resource or version identity
- create append-only correction events
- enqueue follow-up through the existing outbox

### Public correction note

A public note is a reviewed, public-safe record linked to:

- correction case
- affected resource
- challenged version or snapshot
- corrected version or Registry write
- publication time

Public notes contain no private evidence, private contributor details, investigation notes or unsafe source material.

Not every internal correction requires a public note.

### Affected-resource review

Related resources are linked to the correction case through typed review records.

A related-resource record may require:

- no action
- review
- correction
- notification
- later investigation

PR 3B must not add an unstructured correction flag independently to every resource table.

### Correction events

Correction events are append-only and reconstruct the institutional history of the case.

Expected event families include:

- submitted
- triaged
- target attached
- evidence attached
- assigned
- reassigned
- investigation updated
- decision recorded
- application started
- application rejected as stale
- application completed
- public note published
- affected resource flagged
- contributor notification queued
- contributor notification delivered
- case closed
- case reopened

Every public correction action has an internal correction event.

Not every internal event is public.

## Permission boundary

The first slice uses these roles:

### Submit

An authenticated contributor may submit a correction through the existing contribution intake.

Anonymous public intake is not part of the first proof.

### Triage

An editor or administrator may:

- create a correction case from intake
- classify the correction
- attach targets
- attach evidence
- set priority
- assign an investigator

### Investigate

An assigned editor, reviewer or administrator may add investigation records and request more evidence.

### Decide

A user with correction-decision authority may record the institutional outcome.

The deciding actor should normally differ from an external contributor.

### Apply

Application requires both correction authority and the domain capability needed to change the target.

Article correction application requires Article edit authority.

Publishing the resulting Article version continues to require Article publication authority.

Registry correction application requires Registry management authority.

### Publish public note

Public correction-note publication requires explicit publication authority.

## Concurrency boundary

Every correction mutation requires the expected case revision.

Application also requires the expected target version, target revision or deterministic fingerprint.

A command must fail when:

- the case changed after the editor loaded it
- the target changed after the decision
- the target was already corrected through another path
- the decision is no longer current
- the application receipt already exists under a different idempotency key

Safe retries return the existing receipt.

## First implementation proof

The first vertical slice is Article correction.

Acceptance requires:

1. Submit one authenticated community correction.
2. Triage the contribution into a stable correction case.
3. Bind the case to the stable Article resource.
4. Record the exact published Article version being challenged.
5. Attach at least one approved Phase 3A Source or Citation.
6. Assign an investigator.
7. Record an append-only decision.
8. Attempt one stale application and prove rejection.
9. Apply the accepted correction through a governed command.
10. Create a new immutable Article version.
11. Prove the current published version remains unchanged before normal publication.
12. Review and publish the corrected Article version through existing Article authority.
13. Publish a public-safe correction note.
14. Flag one related resource for review.
15. Create an outbox event for contributor notification.
16. Prove the correction event history reconstructs what changed and why.

## Later adapter proof

After the Article proof, add one Registry correction adapter.

The Registry proof must:

- target one canonical Registry record or relationship
- use reviewed Registry write authority
- create or reference the Registry canonical write event
- preserve the correction case and decision history
- publish a public-safe explanation where appropriate

## Immediate non-goals

Do not include these in the first implementation slice:

- anonymous public correction intake
- automatic AI correction decisions
- automatic evidence approval
- automatic conversion of every community contribution into a case
- automatic migration of legacy evidence
- direct mutation of published Article versions
- direct writes to canonical Registry tables
- Playlist authority
- Audio authority
- Video authority
- transcript correction tooling
- chart methodology correction tooling
- Inquiry correction tooling
- email delivery implementation
- webhook delivery
- a second job queue
- a second command bus
- public exposure of private investigation material
- public correction-page redesign

## Recommended implementation sequence

1. Live schema and permission verification for the reused foundations.
2. Correction lifecycle and capability design.
3. Correction identity and target schema.
4. Evidence-link schema.
5. Append-only decision and event schema.
6. Read authority for correction workspaces.
7. Triage, assignment and decision commands.
8. Article correction application command.
9. Outbox event and job types.
10. Public correction-note read authority.
11. Admin Article correction workspace.
12. Article acceptance proof.
13. Registry adapter design and proof.
14. Final Phase 3B closure record.

No schema migration should proceed until the live authority verification confirms the exact existing command, job, outbox, Article, Source, Citation, notification and Registry contracts.
